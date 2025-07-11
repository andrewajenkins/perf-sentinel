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
      describe: 'Specify the reporter(s) to use (e.g., console, markdown)',
      type: 'array',
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
        throw new Error('Either --config, --db-connection, or --history-file must be provided');
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
    const storage = new StorageService(storageOptions);

    const runFilePath = path.resolve(argv.runFile);
    const historyFilePath = storageOptions.historyFile ? path.resolve(storageOptions.historyFile) : null;

    // Initialize storage adapter
    await storage.initializeAdapter();

    console.log(`Reading latest run data from: ${runFilePath}`);
    const latestRunRaw = await fs.readFile(runFilePath, 'utf-8');
    const latestRun = JSON.parse(latestRunRaw);

    console.log(`Using ${storage.getStorageType()} storage`);
    const history = await storage.getHistory(historyFilePath);

    const { report, updatedHistory } = analyze(latestRun, history, config, configLoader);

    // Save the current run to database for historical tracking
    if (storage.getStorageType() === 'database') {
      await storage.savePerformanceRun(latestRun);
    }

    // Invoke reporters
    const reporters = config.reporting.default_reporters;
    for (const reporterName of reporters) {
      try {
        const reporter = require(`../reporters/${reporterName}`);
        reporter.generateReport(report, config.reporting[reporterName] || {});
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

    // Clean up
    await storage.close();

  } catch (error) {
    console.error('Error during analysis:', error);
    process.exit(1);
  }
}; 