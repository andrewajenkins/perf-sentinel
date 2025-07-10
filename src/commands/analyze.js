const fs = require('fs').promises;
const path = require('path');
const { analyze } = require('../analysis/engine');
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
      describe: 'Path to the historical performance data JSON file',
      type: 'string',
      demandOption: true,
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
    });
};

exports.handler = async (argv) => {
  try {
    const runFilePath = path.resolve(argv.runFile);
    const historyFilePath = path.resolve(argv.historyFile);

    console.log(`Reading latest run data from: ${runFilePath}`);
    const latestRunRaw = await fs.readFile(runFilePath, 'utf-8');
    const latestRun = JSON.parse(latestRunRaw);

    let history = {};
    try {
      console.log(`Reading history data from: ${historyFilePath}`);
      const historyRaw = await fs.readFile(historyFilePath, 'utf-8');
      history = JSON.parse(historyRaw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('History file not found. A new one will be created.');
      } else {
        throw error;
      }
    }

    const { report, updatedHistory } = analyze(latestRun, history, argv.threshold);

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

    await fs.writeFile(historyFilePath, JSON.stringify(updatedHistory, null, 2));
    console.log(`History file updated successfully at ${historyFilePath}`);
  } catch (error) {
    console.error('Error during analysis:', error);
    process.exit(1);
  }
}; 