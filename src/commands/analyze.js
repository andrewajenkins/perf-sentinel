const fs = require('fs').promises;
const path = require('path');
const { analyze } = require('../analysis/engine');
const StorageService = require('../storage/storage');
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
    .option('history-file', {
      alias: 'h',
      describe: 'Path to the historical performance data JSON file (fallback when database is not used)',
      type: 'string',
    })
    .option('reporter', {
      describe: 'Specify the reporter(s) to use (e.g., console, markdown)',
      type: 'array',
      default: ['console'],
    })
    .option('threshold', {
      alias: 't',
      describe: 'Number of standard deviations to use as the regression threshold',
      type: 'number',
      default: 2.0,
    })
    .option('max-history', {
      describe: 'Maximum number of data points to store per test step',
      type: 'number',
      default: 50,
    })
    .option('db-connection', {
      describe: 'MongoDB connection string (enables database storage)',
      type: 'string',
    })
    .option('db-name', {
      describe: 'Database name to use',
      type: 'string',
      default: 'perf-sentinel',
    })
    .option('project-id', {
      describe: 'Project identifier for multi-project support',
      type: 'string',
      default: 'default',
    })
    .check((argv) => {
      if (!argv.dbConnection && !argv.historyFile) {
        throw new Error('Either --db-connection or --history-file must be provided');
      }
      return true;
    });
};

exports.handler = async (argv) => {
  const storage = new StorageService({
    useDatabase: !!argv.dbConnection,
    connectionString: argv.dbConnection,
    databaseName: argv.dbName,
    projectId: argv.projectId,
  });

  try {
    const runFilePath = path.resolve(argv.runFile);
    const historyFilePath = argv.historyFile ? path.resolve(argv.historyFile) : null;

    // Initialize database if using database storage
    if (argv.dbConnection) {
      await storage.initializeDatabase();
    }

    console.log(`Reading latest run data from: ${runFilePath}`);
    const latestRunRaw = await fs.readFile(runFilePath, 'utf-8');
    const latestRun = JSON.parse(latestRunRaw);

    console.log(`Using ${storage.getStorageType()} storage`);
    const history = await storage.getHistory(historyFilePath);

    const { report, updatedHistory } = analyze(latestRun, history, argv.threshold, argv.maxHistory);

    // Save the current run to database for historical tracking
    if (storage.getStorageType() === 'database') {
      await storage.savePerformanceRun(latestRun);
    }

    // Invoke reporters
    for (const reporterName of argv.reporter) {
      try {
        const reporter = require(`../reporters/${reporterName}`);
        reporter.generateReport(report);
      } catch (error) {
        console.warn(chalk.yellow(`Could not load reporter: ${reporterName}`));
        console.error(error);
      }
    }

    // Save updated history
    await storage.saveHistory(updatedHistory, historyFilePath);
    
    if (storage.getStorageType() === 'database') {
      console.log(`History updated successfully in database for project: ${argv.projectId}`);
    } else {
      console.log(`History file updated successfully at ${historyFilePath}`);
    }

    // Clean up
    await storage.close();

  } catch (error) {
    console.error('Error during analysis:', error);
    await storage.close();
    process.exit(1);
  }
}; 