const fs = require('fs').promises;
const path = require('path');
const { analyze } = require('../analysis/engine');
const StorageService = require('../storage/storage');
const ConfigLoader = require('../config/config-loader');
const chalk = require('chalk');

exports.command = 'aggregate';
exports.desc = 'Aggregate results from multiple parallel test jobs';

exports.builder = (yargs) => {
  return yargs
    .option('config', {
      alias: 'c',
      describe: 'Path to YAML configuration file',
      type: 'string',
    })
    .option('profile', {
      describe: 'Configuration profile to use (strict, lenient, ci_focused)',
      type: 'string',
    })
    .option('environment', {
      alias: 'e',
      describe: 'Environment-specific configuration (production, staging, development)',
      type: 'string',
    })
    .option('job-ids', {
      describe: 'Comma-separated list of job IDs to aggregate',
      type: 'string',
    })
    .option('wait-for-jobs', {
      describe: 'Wait for all jobs to complete before aggregating',
      type: 'boolean',
      default: true,
    })
    .option('timeout', {
      describe: 'Timeout in seconds to wait for jobs',
      type: 'number',
      default: 300,
    })
    .option('output-file', {
      describe: 'Path to save aggregated results JSON file',
      type: 'string',
    })
    .option('history-file', {
      alias: 'h',
      describe: 'Path to the historical performance data JSON file (fallback when database is not used)',
      type: 'string',
    })
    .option('reporter', {
      describe: 'Specify the reporter(s) to use (e.g., console, markdown, html)',
      type: 'array',
    })
    .option('html-output', {
      describe: 'Path to save HTML report file (when using html reporter)',
      type: 'string',
    })
    .option('db-connection', {
      describe: 'MongoDB connection string (enables database storage)',
      type: 'string',
    })
    .option('db-name', {
      describe: 'Database name to use',
      type: 'string',
    })
    .option('project-id', {
      describe: 'Project identifier for multi-project support',
      type: 'string',
    })
    .option('bucket-name', {
      describe: 'S3 bucket name for S3 storage',
      type: 'string',
    })
    .option('s3-region', {
      describe: 'S3 region',
      type: 'string',
    })
    .option('s3-prefix', {
      describe: 'S3 key prefix',
      type: 'string',
    })
    .check((argv) => {
      if (!argv.config && !argv.dbConnection && !argv.bucketName && !argv.historyFile) {
        throw new Error('Either --config, --db-connection, --bucket-name, or --history-file must be provided');
      }
      return true;
    });
};

exports.handler = async (argv) => {
  const configLoader = new ConfigLoader();
  
  try {
    // Load configuration
    const config = await configLoader.load({
      configPath: argv.config,
      environment: argv.environment,
      profile: argv.profile,
      cliOverrides: {
        reporter: argv.reporter,
        dbConnection: argv.dbConnection,
        dbName: argv.dbName,
        projectId: argv.projectId,
        historyFile: argv.historyFile,
        bucketName: argv.bucketName,
        s3Region: argv.s3Region,
        s3Prefix: argv.s3Prefix
      }
    });

    // Get storage options from configuration
    const storageOptions = configLoader.getStorageOptions(config);
    const storage = new StorageService(storageOptions);

    // Initialize storage adapter
    await storage.initializeAdapter();

    const projectId = config.project.id;
    console.log(`Aggregating results for project: ${projectId}`);
    console.log(`Using ${storage.getStorageType()} storage`);

    // Parse job IDs
    let jobIds = [];
    if (argv.jobIds) {
      jobIds = argv.jobIds.split(',').map(id => id.trim()).filter(Boolean);
    }

    console.log(`Job IDs to aggregate: ${jobIds.length > 0 ? jobIds.join(', ') : 'all available'}`);

    // Wait for jobs to complete if requested
    if (argv.waitForJobs && jobIds.length > 0) {
      console.log(`Waiting for ${jobIds.length} job(s) to complete (timeout: ${argv.timeout}s)...`);
      
      const waitResult = await storage.waitForJobs(jobIds, {
        timeout: argv.timeout * 1000, // Convert to milliseconds
        pollInterval: 5000 // 5 seconds
      });

      if (waitResult.timedOut) {
        console.warn(chalk.yellow(`Timeout reached after ${argv.timeout}s. Some jobs may not be complete.`));
      } else {
        console.log(chalk.green(`All jobs completed in ${Math.round(waitResult.waitTime / 1000)}s`));
      }

      // Display job statuses
      console.log('\nJob Status Summary:');
      waitResult.jobStatuses.forEach(job => {
        const statusColor = job.status === 'completed' ? 'green' : 
                           job.status === 'failed' ? 'red' : 'yellow';
        console.log(`  ${chalk[statusColor](job.status.padEnd(10))} ${job.jobId}`);
      });
    }

    // Aggregate results
    console.log('\nAggregating results...');
    const aggregationResult = await storage.aggregateResults(jobIds, {
      includeMetadata: true
    });

    console.log(`Aggregated ${aggregationResult.aggregatedSteps.length} steps from ${aggregationResult.runCount} run(s)`);

    if (aggregationResult.aggregatedSteps.length === 0) {
      console.warn(chalk.yellow('No performance data found to aggregate'));
      await storage.close();
      return;
    }

    // Save aggregated results if output file specified
    if (argv.outputFile) {
      const outputPath = path.resolve(argv.outputFile);
      
      // Save in the same format as raw performance data (array of steps)
      // This allows the aggregated results to be used as input for analyze command
      const aggregatedData = aggregationResult.aggregatedSteps;

      await fs.writeFile(outputPath, JSON.stringify(aggregatedData, null, 2));
      console.log(`Aggregated results saved to: ${outputPath}`);
      console.log(`  - ${aggregatedData.length} steps from ${aggregationResult.runCount} run(s)`);
      console.log(`  - Job IDs: ${jobIds.join(', ')}`);
    }

    // Perform analysis on aggregated data
    console.log('\nPerforming analysis on aggregated data...');
    
    const historyFilePath = storageOptions.historyFile ? path.resolve(storageOptions.historyFile) : null;
    const history = await storage.getHistory(historyFilePath);

    const { report, updatedHistory } = analyze(aggregationResult.aggregatedSteps, history, config, configLoader);

    // Invoke reporters
    const reporters = config.reporting.default_reporters;
    for (const reporterName of reporters) {
      try {
        let reporter;
        
        // Use optimized HTML reporter for all datasets (fallback due to complex reporter issues)
        if (reporterName === 'html') {
          const totalSteps = (report.regressions?.length || 0) + (report.newSteps?.length || 0) + (report.ok?.length || 0);
          
          if (totalSteps > 500) {
            console.log(chalk.yellow(`Large dataset detected (${totalSteps} steps) - Using optimized HTML reporter for better performance`));
          } else {
            console.log(chalk.blue(`Using optimized HTML reporter`));
          }
          reporter = require(`../reporters/html-simple`);
        } else {
          reporter = require(`../reporters/${reporterName}`);
        }
        
        // Handle HTML reporter with output file option
        if (reporterName === 'html' && argv.htmlOutput) {
          const outputPath = path.resolve(argv.htmlOutput);
          await reporter.generateReport(report, { 
            outputPath,
            title: `Aggregated Performance Analysis Report - ${config.project.id}`,
            ...config.reporting[reporterName] 
          });
        } else {
          await reporter.generateReport(report, config.reporting[reporterName] || {});
        }
      } catch (error) {
        console.warn(chalk.yellow(`Could not load reporter: ${reporterName}`));
        console.error(error);
      }
    }

    // Save updated history
    await storage.saveHistory(updatedHistory, historyFilePath);
    
    console.log(`\nAnalysis completed. Aggregated data from ${aggregationResult.runCount} run(s) across ${aggregationResult.jobCount || 'all'} job(s).`);

    // Clean up
    await storage.close();

  } catch (error) {
    console.error('Error during aggregation:', error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}; 