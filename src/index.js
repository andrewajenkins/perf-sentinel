const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

function run(argv) {
  return yargs(argv)
    .commandDir('commands')
    .demandCommand(1, 'You need to specify a command (e.g., analyze, seed).')
    .strict()
    .help()
    .argv;
}

// Ensure the CLI runs when executed directly
if (require.main === module) {
  run(hideBin(process.argv));
}

module.exports = { run }; 