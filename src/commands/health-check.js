const ConfigLoader = require('../config/config-loader');
const StorageService = require('../storage/storage');

const command = 'health-check';
const describe = 'Check system health and validate configuration';
const builder = (yargs) => {
  return yargs
    .option('config', {
      alias: 'c',
      describe: 'Path to configuration file',
      type: 'string'
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
    .option('debug', {
      describe: 'Enable debug logging',
      type: 'boolean',
      default: false
    })
    .example('$0 health-check', 'Check system health with default settings')
    .example('$0 health-check --config perf-sentinel.yml', 'Check health using config file')
    .example('$0 health-check --db-connection mongodb://localhost:27017', 'Check database connection');
};

class HealthChecker {
  constructor(debug = false) {
    this.debug = debug;
    this.results = {
      overall: 'unknown',
      checks: [],
      errors: [],
      warnings: []
    };
  }

  log(message, level = 'info') {
    if (level === 'debug' && !this.debug) return;
    
    const prefix = {
      info: '💡',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      debug: '🔧'
    }[level] || '📝';
    
    console.log(`${prefix} ${message}`);
  }

  addCheck(name, status, message, details = null) {
    this.results.checks.push({
      name,
      status, // 'pass', 'fail', 'warning'
      message,
      details
    });

    if (status === 'fail') {
      this.results.errors.push(`${name}: ${message}`);
    } else if (status === 'warning') {
      this.results.warnings.push(`${name}: ${message}`);
    }
  }

  async checkConfigurationSyntax(configPath) {
    this.log('🔍 Checking configuration syntax...', 'info');
    
    try {
      if (!configPath) {
        this.addCheck('Configuration File', 'warning', 'No configuration file specified, using defaults');
        return {};
      }

      const configLoader = new ConfigLoader();
      const config = await configLoader.load({ configFile: configPath });
      
      this.addCheck('Configuration Syntax', 'pass', 'Configuration file syntax is valid');
      this.log(`✅ Configuration loaded successfully from: ${configPath}`, 'success');
      
      // Validate required sections
      if (!config.project) {
        this.addCheck('Project Configuration', 'warning', 'No project configuration found, using defaults');
      }
      
      if (!config.analysis) {
        this.addCheck('Analysis Configuration', 'warning', 'No analysis configuration found, using defaults');
      }
      
      if (!config.storage) {
        this.addCheck('Storage Configuration', 'warning', 'No storage configuration found, using defaults');
      }

      return config;
      
    } catch (error) {
      this.addCheck('Configuration Syntax', 'fail', `Invalid configuration: ${error.message}`, error);
      this.log(`❌ Configuration error: ${error.message}`, 'error');
      return null;
    }
  }

  async checkStorageConnectivity(storageOptions) {
    this.log('🔍 Checking storage connectivity...', 'info');
    
    try {
      const storageService = new StorageService(storageOptions);
      const storageType = storageService.getStorageType();
      
      this.log(`📦 Testing ${storageType} storage...`, 'info');
      
      // Get health status
      const healthStatus = await storageService.getHealthStatus();
      
      if (healthStatus.status === 'healthy') {
        this.addCheck('Storage Connectivity', 'pass', `${storageType} storage is healthy`);
        this.log(`✅ ${storageType} storage connection successful`, 'success');
        
        if (healthStatus.details) {
          this.log(`🔧 Storage details: ${JSON.stringify(healthStatus.details)}`, 'debug');
        }
      } else {
        this.addCheck('Storage Connectivity', 'fail', `${storageType} storage is unhealthy: ${healthStatus.error}`, healthStatus);
        this.log(`❌ ${storageType} storage connection failed: ${healthStatus.error}`, 'error');
      }
      
      return healthStatus;
      
    } catch (error) {
      this.addCheck('Storage Connectivity', 'fail', `Storage connection error: ${error.message}`, error);
      this.log(`❌ Storage connection error: ${error.message}`, 'error');
      return null;
    }
  }

  async checkSystemDependencies() {
    this.log('🔍 Checking system dependencies...', 'info');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    
    if (majorVersion >= 14) {
      this.addCheck('Node.js Version', 'pass', `Node.js ${nodeVersion} is supported`);
    } else {
      this.addCheck('Node.js Version', 'warning', `Node.js ${nodeVersion} may not be fully supported (recommend 14+)`);
    }

    // Check available memory
    const memUsage = process.memoryUsage();
    const totalMemMB = Math.round(memUsage.rss / 1024 / 1024);
    
    if (totalMemMB < 100) {
      this.addCheck('Memory Usage', 'pass', `Memory usage: ${totalMemMB}MB`);
    } else {
      this.addCheck('Memory Usage', 'warning', `High memory usage: ${totalMemMB}MB`);
    }

    // Check write permissions for performance results
    try {
      const fs = require('fs');
      const path = require('path');
      const testDir = './performance-results';
      
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      const testFile = path.join(testDir, '.health-check-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      this.addCheck('File System Permissions', 'pass', 'Can write to performance results directory');
    } catch (error) {
      this.addCheck('File System Permissions', 'fail', `Cannot write to performance results directory: ${error.message}`, error);
    }
  }

  async checkEnvironmentVariables() {
    this.log('🔍 Checking environment variables...', 'info');
    
    const envVars = [
      'MONGODB_CONNECTION_STRING',
      'MONGODB_DB_NAME', 
      'S3_BUCKET_NAME',
      'AWS_REGION',
      'S3_PREFIX'
    ];
    
    let foundVars = 0;
    envVars.forEach(varName => {
      if (process.env[varName]) {
        foundVars++;
        this.log(`🔧 Found ${varName}`, 'debug');
      }
    });
    
    if (foundVars > 0) {
      this.addCheck('Environment Variables', 'pass', `Found ${foundVars} storage-related environment variables`);
    } else {
      this.addCheck('Environment Variables', 'warning', 'No storage-related environment variables found (using defaults)');
    }
  }

  calculateOverallHealth() {
    const failedChecks = this.results.checks.filter(check => check.status === 'fail').length;
    const warningChecks = this.results.checks.filter(check => check.status === 'warning').length;
    const passedChecks = this.results.checks.filter(check => check.status === 'pass').length;
    
    if (failedChecks > 0) {
      this.results.overall = 'unhealthy';
    } else if (warningChecks > 0) {
      this.results.overall = 'degraded';
    } else {
      this.results.overall = 'healthy';
    }
    
    return {
      overall: this.results.overall,
      passed: passedChecks,
      warnings: warningChecks,
      failed: failedChecks,
      total: this.results.checks.length
    };
  }

  printSummary() {
    const summary = this.calculateOverallHealth();
    
    console.log('\n📊 Health Check Summary:');
    console.log(`   • Overall Status: ${this.getStatusIcon(summary.overall)} ${summary.overall.toUpperCase()}`);
    console.log(`   • Total Checks: ${summary.total}`);
    console.log(`   • Passed: ${summary.passed}`);
    console.log(`   • Warnings: ${summary.warnings}`);
    console.log(`   • Failed: ${summary.failed}`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ Critical Issues:');
      this.results.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.results.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    // Recommendations
    if (summary.failed > 0) {
      console.log('\n💡 Recommendations:');
      console.log('   • Fix critical issues before running analysis');
      console.log('   • Check configuration file syntax and storage credentials');
      console.log('   • Run with --debug for detailed error information');
    } else if (summary.warnings > 0) {
      console.log('\n💡 Recommendations:');
      console.log('   • Review warnings for potential improvements');
      console.log('   • Consider updating configuration for better performance');
    } else {
      console.log('\n🎉 System is healthy and ready for performance monitoring!');
    }
  }

  getStatusIcon(status) {
    return {
      healthy: '🟢',
      degraded: '🟡',
      unhealthy: '🔴'
    }[status] || '⚪';
  }
}

const handler = async (argv) => {
  const startTime = Date.now();
  
  try {
    console.log('🏥 Starting health check...\n');
    
    const checker = new HealthChecker(argv.debug);
    
    // 1. Check configuration syntax
    const config = await checker.checkConfigurationSyntax(argv.config);
    
    // 2. Check system dependencies
    await checker.checkSystemDependencies();
    
    // 3. Check environment variables
    await checker.checkEnvironmentVariables();
    
    // 4. Check storage connectivity
    if (config !== null) {
      const storageOptions = {
        adapter: config?.storage?.adapter_type || 'auto',
        projectId: argv.projectId || config?.project?.id || 'default',
        dbConnection: argv.dbConnection || config?.storage?.database?.connection,
        dbName: argv.dbName || config?.storage?.database?.name || 'perf-sentinel',
        bucketName: argv.bucketName || config?.storage?.s3?.bucket_name,
        s3Region: argv.s3Region || config?.storage?.s3?.region || 'us-east-1',
        s3Prefix: argv.s3Prefix || config?.storage?.s3?.prefix || 'perf-sentinel',
        baseDirectory: argv.baseDirectory || config?.storage?.filesystem?.base_directory || './performance-results'
      };
      
      await checker.checkStorageConnectivity(storageOptions);
    }
    
    // Print summary
    checker.printSummary();
    
    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Health check completed in ${(duration / 1000).toFixed(1)}s`);
    
    // Exit with appropriate code
    const summary = checker.calculateOverallHealth();
    if (summary.failed > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
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