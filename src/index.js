const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const analyzeCommand = require('./commands/analyze');
const seedCommand = require('./commands/seed');
const aggregateCommand = require('./commands/aggregate');
const cleanupCommand = require('./commands/cleanup');
const healthCheckCommand = require('./commands/health-check');

function run(argv) {
  return yargs(argv)
    .command(analyzeCommand)
    .command(seedCommand)
    .command(aggregateCommand)
    .command(cleanupCommand)
    .command(healthCheckCommand)
    .option('debug', {
      describe: 'Enable debug logging for detailed troubleshooting',
      type: 'boolean',
      default: false,
      global: true
    })
    .option('verbose', {
      alias: 'v',
      describe: 'Enable verbose output (same as --debug)',
      type: 'boolean',
      default: false,
      global: true
    })
    .demandCommand(1, 'You need to specify a command (e.g., analyze, seed, aggregate, cleanup, health-check).')
    .strict()
    .help()
    .middleware((argv) => {
      // Set debug flag if verbose is enabled
      if (argv.verbose) {
        argv.debug = true;
      }
      
      // Set global debug state
      global.PERF_SENTINEL_DEBUG = argv.debug;
      
      // Enable detailed logging if debug is enabled
      if (argv.debug) {
        console.log('🔧 Debug mode enabled');
        console.log('📋 CLI Arguments:', JSON.stringify(argv, null, 2));
      }
    })
    .argv;
}

module.exports = { run }; 