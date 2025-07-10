const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const { calculateAverage, calculateStdDev } = require('../analysis/engine');

exports.command = 'seed';
exports.desc = 'Seed the history file from a collection of run files';

exports.builder = (yargs) => {
  return yargs
    .option('run-files', {
      describe: 'Glob pattern for the run files to seed from',
      type: 'string',
      demandOption: true,
    })
    .option('history-file', {
      alias: 'h',
      describe: 'Path to the historical performance data JSON file to create',
      type: 'string',
      demandOption: true,
    });
};

exports.handler = async (argv) => {
  try {
    const historyFilePath = path.resolve(argv.historyFile);
    console.log(`Seeding history file at: ${historyFilePath}`);
    
    const allFiles = glob.sync(argv.runFiles);
    if (allFiles.length === 0) {
        console.warn('No files found matching the provided glob pattern.');
        return;
    }

    const aggregatedData = {};

    for (const file of allFiles) {
        const fileContent = await fs.readFile(file, 'utf-8');
        const runData = JSON.parse(fileContent);
        for (const step of runData) {
            if (!aggregatedData[step.stepText]) {
                aggregatedData[step.stepText] = { durations: [] };
            }
            aggregatedData[step.stepText].durations.push(step.duration);
        }
    }

    const newHistory = {};
    for (const stepText in aggregatedData) {
        const { durations } = aggregatedData[stepText];
        const average = calculateAverage(durations);
        const stdDev = calculateStdDev(durations, average);
        newHistory[stepText] = { durations, average, stdDev };
    }

    await fs.writeFile(historyFilePath, JSON.stringify(newHistory, null, 2));
    console.log(`History seeded successfully with data from ${allFiles.length} files.`);

  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}; 