const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const analyzeCommand = require('./commands/analyze');
const seedCommand = require('./commands/seed');
const aggregateCommand = require('./commands/aggregate');

function run(argv) {
  return yargs(argv)
    .command(analyzeCommand)
    .command(seedCommand)
    .command(aggregateCommand)
    .demandCommand(1, 'You need to specify a command (e.g., analyze, seed, aggregate).')
    .strict()
    .help()
    .argv;
}

module.exports = { run }; 