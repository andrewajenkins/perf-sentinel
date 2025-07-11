const DatabaseAdapter = require('./adapters/database-adapter');
const FileSystemAdapter = require('./adapters/filesystem-adapter');
const S3Adapter = require('./adapters/s3-adapter');

/**
 * Storage Service using Adapter Pattern
 * 
 * Manages different storage backends through a unified interface
 */
class StorageService {
  constructor(options = {}) {
    this.options = options;
    this.adapter = null;
    this.adapterType = options.adapterType || 'auto';
    this.projectId = options.projectId || 'default';
    
    // Auto-detect adapter type if not specified
    if (this.adapterType === 'auto') {
      this.adapterType = this.detectAdapterType(options);
    }
    
    // Create the appropriate adapter
    this.adapter = this.createAdapter(this.adapterType, options);
  }

  detectAdapterType(options) {
    // Priority: explicit type > S3 config > database config > filesystem
    if (options.bucketName) {
      return 's3';
    } else if (options.useDatabase && options.connectionString) {
      return 'database';
    } else {
      return 'filesystem';
    }
  }

  createAdapter(type, options) {
    switch (type) {
      case 'database':
        return new DatabaseAdapter({
          connectionString: options.connectionString,
          databaseName: options.databaseName || 'perf-sentinel',
          projectId: this.projectId
        });
      
      case 'filesystem':
        return new FileSystemAdapter({
          baseDirectory: options.baseDirectory || './performance-results',
          projectId: this.projectId
        });
      
      case 's3':
        return new S3Adapter({
          bucketName: options.bucketName,
          region: options.region,
          prefix: options.prefix || 'perf-sentinel',
          projectId: this.projectId
        });
      
      default:
        throw new Error(`Unsupported adapter type: ${type}`);
    }
  }

  async initializeAdapter() {
    if (!this.adapter.isReady()) {
      try {
        await this.adapter.initialize();
      } catch (error) {
        // If the primary adapter fails and it's not filesystem, fallback to filesystem
        if (this.adapter.getType() !== 'filesystem') {
          console.warn(`${this.adapter.getType()} storage failed, falling back to filesystem storage:`, error.message);
          console.log('Using filesystem storage');
          
          // Switch to filesystem adapter
          this.adapter = new FileSystemAdapter({
            baseDirectory: './performance-results',
            projectId: this.projectId
          });
          this.adapterType = 'filesystem';
          
          await this.adapter.initialize();
        } else {
          throw error;
        }
      }
    }
  }

  async getHistory(historyFilePath = null) {
    await this.initializeAdapter();
    const options = historyFilePath ? { filePath: historyFilePath } : {};
    return await this.adapter.getHistory(this.projectId, options);
  }

  async saveHistory(history, historyFilePath = null) {
    await this.initializeAdapter();
    const options = historyFilePath ? { filePath: historyFilePath } : {};
    await this.adapter.saveHistory(history, this.projectId, options);
  }

  async seedHistory(aggregatedData, historyFilePath = null) {
    await this.initializeAdapter();
    const options = historyFilePath ? { filePath: historyFilePath } : {};
    await this.adapter.seedHistory(aggregatedData, this.projectId, options);
  }

  async savePerformanceRun(runData, metadata = {}) {
    try {
      await this.initializeAdapter();
      await this.adapter.savePerformanceRun(runData, this.projectId, metadata);
    } catch (error) {
      console.warn('Failed to save performance run:', error.message);
      // Continue execution - this is just for historical tracking
    }
  }

  // Multi-job coordination methods
  async registerJob(jobId, jobInfo = {}) {
    try {
      await this.initializeAdapter();
      await this.adapter.registerJob(this.projectId, jobId, jobInfo);
    } catch (error) {
      console.warn('Failed to register job:', error.message);
    }
  }

  async updateJobStatus(jobId, status, metadata = {}) {
    try {
      await this.initializeAdapter();
      await this.adapter.updateJobStatus(this.projectId, jobId, status, metadata);
    } catch (error) {
      console.warn('Failed to update job status:', error.message);
    }
  }

  async getJobInfo(jobId) {
    try {
      await this.initializeAdapter();
      return await this.adapter.getJobInfo(this.projectId, jobId);
    } catch (error) {
      console.warn('Failed to get job info:', error.message);
      return null;
    }
  }

  async waitForJobs(jobIds, options = {}) {
    try {
      await this.initializeAdapter();
      return await this.adapter.waitForJobs(this.projectId, jobIds, options);
    } catch (error) {
      console.warn('Failed to wait for jobs:', error.message);
      throw error;
    }
  }

  async aggregateResults(jobIds, options = {}) {
    try {
      await this.initializeAdapter();
      return await this.adapter.aggregateResults(this.projectId, jobIds, options);
    } catch (error) {
      console.warn('Failed to aggregate results:', error.message);
      throw error;
    }
  }

  async initializeDatabase() {
    // For backward compatibility - now handled by adapter initialization
    await this.initializeAdapter();
  }

  async close() {
    if (this.adapter) {
      await this.adapter.close();
    }
  }

  getStorageType() {
    return this.adapter ? this.adapter.getType() : 'unknown';
  }

  async getHealthStatus() {
    if (!this.adapter) {
      return {
        status: 'error',
        error: 'No adapter configured'
      };
    }

    return await this.adapter.getHealthStatus();
  }

  async cleanup(retentionPolicy = {}) {
    try {
      await this.initializeAdapter();
      return await this.adapter.cleanup(this.projectId, retentionPolicy);
    } catch (error) {
      console.warn('Failed to cleanup storage:', error.message);
      return {
        performanceRunsDeleted: 0,
        jobsDeleted: 0,
        completedJobsDeleted: 0,
        error: error.message
      };
    }
  }
}

module.exports = StorageService; 