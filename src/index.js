const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const analyzeCommand = require('./commands/analyze');
const seedCommand = require('./commands/seed');

function run(argv) {
  return yargs(argv)
    .command(analyzeCommand)
    .command(seedCommand)
    .demandCommand(1, 'You need to specify a command (e.g., analyze, seed).')
    .strict()
    .help()
    .argv;
}

module.exports = { run }; 