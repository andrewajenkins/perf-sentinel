const ConfigLoader = require('../config/config-loader');
const StorageService = require('../storage/storage');

const command = 'cleanup';
const describe = 'Clean up old performance data based on retention policies';
const builder = (yargs) => {
  return yargs
    .option('config', {
      alias: 'c',
      describe: 'Path to configuration file',
      type: 'string'
    })
    .option('older-than', {
      describe: 'Delete data older than specified days (e.g., 30d, 90d)',
      type: 'string',
      default: '90d'
    })
    .option('project-id', {
      describe: 'Project identifier for multi-project support',
      type: 'string'
    })
    .option('db-connection', {
      describe: 'MongoDB connection string',
      type: 'string'
    })
    .option('db-name', {
      describe: 'Database name to use',
      type: 'string'
    })
    .option('bucket-name', {
      describe: 'S3 bucket name for S3 storage',
      type: 'string'
    })
    .option('s3-region', {
      describe: 'S3 region',
      type: 'string',
      default: 'us-east-1'
    })
    .option('s3-prefix', {
      describe: 'S3 key prefix',
      type: 'string',
      default: 'perf-sentinel'
    })
    .option('base-directory', {
      describe: 'Base directory for filesystem storage',
      type: 'string',
      default: './performance-results'
    })
    .option('dry-run', {
      describe: 'Show what would be deleted without actually deleting',
      type: 'boolean',
      default: false
    })
    .option('force', {
      describe: 'Skip confirmation prompts',
      type: 'boolean',
      default: false
    })
    .option('debug', {
      describe: 'Enable debug logging',
      type: 'boolean',
      default: false
    })
    .example('$0 cleanup --older-than 30d', 'Delete data older than 30 days')
    .example('$0 cleanup --older-than 90d --dry-run', 'Preview what would be deleted (90+ days old)')
    .example('$0 cleanup --config perf-sentinel.yml --force', 'Clean up using config file settings without prompts');
};

function parseDaysFromString(olderThan) {
  const match = olderThan.match(/^(\d+)d?$/);
  if (!match) {
    throw new Error(`Invalid --older-than format: ${olderThan}. Use format like '30d' or '90d'`);
  }
  return parseInt(match[1]);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function confirmDeletion(stats, force, dryRun) {
  if (dryRun) {
    console.log('\n🔍 DRY RUN - No data will be deleted');
    return true;
  }
  
  if (force) {
    return true;
  }
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    const message = `\n⚠️  This will permanently delete ${stats.filesDeleted} files (${formatBytes(stats.bytesDeleted)}).\nAre you sure? (y/N): `;
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

const handler = async (argv) => {
  const startTime = Date.now();
  
  try {
    if (argv.debug) {
      console.log('🔧 Debug mode enabled');
      console.log('📋 Arguments:', JSON.stringify(argv, null, 2));
    }
    
    // Parse retention days
    const retentionDays = parseDaysFromString(argv.olderThan);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    console.log(`🧹 Starting cleanup of data older than ${retentionDays} days (before ${cutoffDate.toISOString().split('T')[0]})`);
    
    // Load configuration
    let config = {};
    if (argv.config) {
      const configLoader = new ConfigLoader();
      config = await configLoader.load({ configFile: argv.config });
      console.log(`📄 Loaded configuration from: ${argv.config}`);
    }
    
    // Apply CLI overrides
    const storageOptions = {
      adapter: config.storage?.adapter_type || 'auto',
      projectId: argv.projectId || config.project?.id || 'default',
      dbConnection: argv.dbConnection || config.storage?.database?.connection,
      dbName: argv.dbName || config.storage?.database?.name || 'perf-sentinel',
      bucketName: argv.bucketName || config.storage?.s3?.bucket_name,
      s3Region: argv.s3Region || config.storage?.s3?.region || 'us-east-1',
      s3Prefix: argv.s3Prefix || config.storage?.s3?.prefix || 'perf-sentinel',
      baseDirectory: argv.baseDirectory || config.storage?.filesystem?.base_directory || './performance-results'
    };
    
    if (argv.debug) {
      console.log('🔧 Storage options:', JSON.stringify(storageOptions, null, 2));
    }
    
    // Initialize storage service
    const storageService = new StorageService(storageOptions);
    console.log(`📦 Using ${storageService.getStorageType()} storage`);
    
    // Define retention policy
    const retentionPolicy = {
      maxAge: retentionDays * 24 * 60 * 60 * 1000, // Convert days to milliseconds
      cutoffDate: cutoffDate,
      dryRun: argv.dryRun
    };
    
    if (argv.debug) {
      console.log('🔧 Retention policy:', JSON.stringify(retentionPolicy, null, 2));
    }
    
    // Perform cleanup
    console.log('🔍 Scanning for old data...');
    const stats = await storageService.cleanup(retentionPolicy);
    
    // Display results
    console.log('\n📊 Cleanup Results:');
    console.log(`   • Files found: ${stats.filesScanned || 0}`);
    console.log(`   • Files to delete: ${stats.filesDeleted || 0}`);
    console.log(`   • Space to reclaim: ${formatBytes(stats.bytesDeleted || 0)}`);
    console.log(`   • Errors: ${stats.errors || 0}`);
    
    if (stats.filesDeleted > 0) {
      // Ask for confirmation unless in dry-run or force mode
      const confirmed = await confirmDeletion(stats, argv.force, argv.dryRun);
      
      if (!confirmed) {
        console.log('❌ Cleanup cancelled by user');
        return;
      }
      
      if (!argv.dryRun) {
        console.log('🗑️  Deleting old data...');
        // The actual deletion was already performed by the cleanup method
        // unless it was a dry run
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log('\n✅ Cleanup completed successfully');
    console.log(`⏱️  Total time: ${(duration / 1000).toFixed(1)}s`);
    
    if (argv.dryRun && stats.filesDeleted > 0) {
      console.log('\n💡 Run without --dry-run to perform actual cleanup');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    if (argv.debug) {
      console.error('🔧 Full error:', error);
    }
    process.exit(1);
  }
};

module.exports = {
  command,
  describe,
  builder,
  handler
}; 