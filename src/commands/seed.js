const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const StorageService = require('../storage/storage');
const ConfigLoader = require('../config/config-loader');

exports.command = 'seed';
exports.desc = 'Seed the history file from a collection of run files';

exports.builder = (yargs) => {
  return yargs
    .option('run-files', {
      describe: 'Glob pattern for the run files to seed from',
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
      describe: 'Path to the historical performance data JSON file to create (fallback when database is not used)',
      type: 'string',
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
        throw new Error('Either --db-connection or --history-file must be provided');
      }
      return true;
    });
};

exports.handler = async (argv) => {
  const startTime = Date.now();
  const configLoader = new ConfigLoader();
  
  try {
    // Debug logging
    if (argv.debug || global.PERF_SENTINEL_DEBUG) {
      console.log('🔧 Debug mode enabled for seed command');
      console.log('📋 Seed arguments:', JSON.stringify(argv, null, 2));
    }
    // Load configuration
    const config = await configLoader.load({
      configPath: argv.config,
      environment: argv.environment,
      profile: argv.profile,
      cliOverrides: {
        dbConnection: argv.dbConnection,
        dbName: argv.dbName,
        projectId: argv.projectId,
        historyFile: argv.historyFile
      }
    });

    // Get storage options from configuration
    const storageOptions = configLoader.getStorageOptions(config);
    const storage = new StorageService(storageOptions);

    const historyFilePath = storageOptions.historyFile ? path.resolve(storageOptions.historyFile) : null;
    
    // Initialize storage adapter
    await storage.initializeAdapter();

    console.log(`Using ${storage.getStorageType()} storage`);
    
    if (storage.getStorageType() === 'database') {
      console.log(`Seeding history database for project: ${config.project.id}`);
    } else {
      console.log(`Seeding history file at: ${historyFilePath}`);
    }
    
    const allFiles = glob.sync(argv.runFiles);
    if (allFiles.length === 0) {
        console.log('No files found matching the provided glob pattern');
        await storage.close();
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

    await storage.seedHistory(aggregatedData, historyFilePath);

    if (storage.getStorageType() === 'database') {
      console.log(`History seeded successfully in database for project: ${config.project.id} with data from ${allFiles.length} files.`);
    } else {
      console.log(`History seeded successfully with data from ${allFiles.length} files.`);
    }

    // Clean up
    await storage.close();

    // Log execution metrics
    const executionTime = Date.now() - startTime;
    const memoryUsage = process.memoryUsage();
    const totalSteps = Object.keys(aggregatedData).length;
    
    console.log(`\n⏱️  Seeding completed:`);
    console.log(`   • Files processed: ${allFiles.length}`);
    console.log(`   • Unique steps seeded: ${totalSteps}`);
    console.log(`   • Seeding duration: ${(executionTime / 1000).toFixed(1)}s`);
    console.log(`   • Memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);

  } catch (error) {
    console.error('Error seeding history:', error.message);
    
    // Log execution metrics even on failure
    const executionTime = Date.now() - startTime;
    const memoryUsage = process.memoryUsage();
    
    console.log(`\n⏱️  Seeding failed after ${(executionTime / 1000).toFixed(1)}s`);
    console.log(`   • Memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    
    if (argv.debug || global.PERF_SENTINEL_DEBUG) {
      console.error('🔧 Full error details:', error);
    }
    
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}; 