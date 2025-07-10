const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

yargs(hideBin(process.argv))
  .commandDir('commands')
  .demandCommand(1, 'You need to specify a command (e.g., analyze, seed).')
  .strict()
  .help()
  .argv; 