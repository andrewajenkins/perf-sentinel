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
  console.log('Seeding history with the following options:');
  console.log(argv);
}; 