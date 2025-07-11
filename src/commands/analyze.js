const fs = require('fs').promises;
const path = require('path');
const { analyze } = require('../analysis/engine');
const StorageService = require('../storage/storage');
const ConfigLoader = require('../config/config-loader');
const chalk = require('chalk');

exports.command = 'analyze';
exports.desc = 'Analyze a new performance run against historical data';

exports.builder = (yargs) => {
  return yargs
    .option('run-file', {
      alias: 'r',
      describe: 'Path to the latest performance run JSON file',
      type: 'string',
      demandOption: true,
    })
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
    .option('threshold', {
      alias: 't',
      describe: 'Number of standard deviations to use as the regression threshold',
      type: 'number',
    })
    .option('max-history', {
      describe: 'Maximum number of data points to store per test step',
      type: 'number',
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
    .check((argv) => {
      if (!argv.config && !argv.dbConnection && !argv.historyFile) {
        throw new Error('Either --db-connection or --history-file must be provided');
      }
      return true;
    });
};

exports.handler = async (argv) => {
  const configLoader = new ConfigLoader();
  let storage;
  
  try {
    // Load configuration
    const config = await configLoader.load({
      configPath: argv.config,
      environment: argv.environment,
      profile: argv.profile,
      cliOverrides: {
        threshold: argv.threshold,
        maxHistory: argv.maxHistory,
        reporter: argv.reporter,
        dbConnection: argv.dbConnection,
        dbName: argv.dbName,
        projectId: argv.projectId,
        historyFile: argv.historyFile
      }
    });

    // Get storage options from configuration
    const storageOptions = configLoader.getStorageOptions(config);
    storage = new StorageService(storageOptions);

    const runFilePath = path.resolve(argv.runFile);
    const historyFilePath = storageOptions.historyFile ? path.resolve(storageOptions.historyFile) : null;

    // Initialize storage adapter
    await storage.initializeAdapter();

    console.log(`Reading latest run data from: ${runFilePath}`);
    const latestRunRaw = await fs.readFile(runFilePath, 'utf-8');
    const latestRun = JSON.parse(latestRunRaw);

    // Register job if jobId is available in the data
    let jobId = null;
    if (latestRun.length > 0 && latestRun[0].context && latestRun[0].context.jobId) {
      jobId = latestRun[0].context.jobId;
      console.log(`Registering job: ${jobId}`);
      await storage.registerJob(jobId, {
        startTime: new Date().toISOString(),
        stepCount: latestRun.length,
        suites: [...new Set(latestRun.map(step => step.context?.suite).filter(Boolean))],
        tags: [...new Set(latestRun.flatMap(step => step.context?.tags || []))]
      });
    }

    console.log(`Using ${storage.getStorageType()} storage`);
    const history = await storage.getHistory(historyFilePath);

    const { report, updatedHistory } = analyze(latestRun, history, config, configLoader);

    // Save the current run for historical tracking (all storage adapters)
    await storage.savePerformanceRun(latestRun, {
      jobId: jobId,
      timestamp: new Date().toISOString(),
      stepCount: latestRun.length,
      suites: [...new Set(latestRun.map(step => step.context?.suite).filter(Boolean))],
      tags: [...new Set(latestRun.flatMap(step => step.context?.tags || []))]
    });

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
            title: `Performance Analysis Report - ${config.project.id}`,
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
    
    if (storage.getStorageType() === 'database') {
      console.log(`History updated successfully in database for project: ${config.project.id}`);
    } else {
      console.log(`History file updated successfully at ${historyFilePath}`);
    }

    // Update job status to completed if job was registered
    if (jobId) {
      console.log(`Marking job ${jobId} as completed`);
      await storage.updateJobStatus(jobId, 'completed', {
        endTime: new Date().toISOString(),
        regressionsFound: report.regressions?.length || 0,
        newStepsFound: report.newSteps?.length || 0,
        okStepsFound: report.ok?.length || 0
      });
    }

    // Clean up
    await storage.close();

  } catch (error) {
    console.error('Error during analysis:', error);
    
    // Update job status to failed if job was registered
    try {
      if (storage && typeof jobId !== 'undefined') {
        await storage.updateJobStatus(jobId, 'failed', {
          endTime: new Date().toISOString(),
          error: error.message
        });
      }
    } catch (updateError) {
      console.error('Error updating job status:', updateError);
    }
    
    if (storage) {
      await storage.close();
    }
    
    process.exit(1);
  }
}; 