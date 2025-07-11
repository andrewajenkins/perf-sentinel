const BaseStorageAdapter = require('./base-adapter');
const { calculateAverage, calculateStdDev } = require('../../analysis/engine');

/**
 * S3 Storage Adapter
 * 
 * Implements storage using AWS S3 for CI/CD production environments
 * 
 * Note: Requires AWS SDK installation: npm install aws-sdk
 */
class S3Adapter extends BaseStorageAdapter {
  constructor(options = {}) {
    super(options);
    this.bucketName = options.bucketName;
    this.region = options.region || 'us-east-1';
    this.prefix = options.prefix || 'perf-sentinel';
    this.s3Client = null;
    
    // Validate required options
    if (!this.bucketName) {
      throw new Error('S3 bucket name is required');
    }
  }

  async initialize() {
    try {
      // Dynamically import AWS SDK
      const AWS = require('aws-sdk');
      
      // Configure AWS SDK
      this.s3Client = new AWS.S3({
        region: this.region,
        maxRetries: 3,
        retryDelayOptions: {
          base: 300 // 300ms base delay
        }
      });

      // Test bucket access
      await this.s3Client.headBucket({ Bucket: this.bucketName }).promise();
      
      this.isConnected = true;
      console.log(`S3 adapter initialized: s3://${this.bucketName}/${this.prefix}`);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error('AWS SDK not installed. Run: npm install aws-sdk');
      }
      throw new Error(`Failed to initialize S3 adapter: ${error.message}`);
    }
  }

  async close() {
    // S3 client doesn't need explicit closing
    this.isConnected = false;
  }

  getType() {
    return 's3';
  }

  getKey(projectId, type, filename = '') {
    return `${this.prefix}/${projectId}/${type}/${filename}`.replace(/\/+/g, '/');
  }

  async putObjectWithRetry(key, body, options = {}) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const params = {
          Bucket: this.bucketName,
          Key: key,
          Body: typeof body === 'string' ? body : JSON.stringify(body, null, 2),
          ContentType: 'application/json',
          ...options
        };

        await this.s3Client.putObject(params).promise();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 100; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to put object after ${maxRetries} attempts: ${lastError.message}`);
  }

  async getObjectWithRetry(key) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const params = {
          Bucket: this.bucketName,
          Key: key
        };

        const result = await this.s3Client.getObject(params).promise();
        return JSON.parse(result.Body.toString());
      } catch (error) {
        lastError = error;
        if (error.code === 'NoSuchKey') {
          return null;
        }
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 100; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to get object after ${maxRetries} attempts: ${lastError.message}`);
  }

  async listObjectsWithRetry(prefix, maxKeys = 1000) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const params = {
          Bucket: this.bucketName,
          Prefix: prefix,
          MaxKeys: maxKeys
        };

        const result = await this.s3Client.listObjectsV2(params).promise();
        return result.Contents || [];
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 100; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to list objects after ${maxRetries} attempts: ${lastError.message}`);
  }

  async getHistory(projectId, options = {}) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    const key = this.getKey(projectId, 'history', 'performance-history.json');
    const history = await this.getObjectWithRetry(key);
    return history || {};
  }

  async saveHistory(history, projectId, options = {}) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    const key = this.getKey(projectId, 'history', 'performance-history.json');
    await this.putObjectWithRetry(key, history);
  }

  async seedHistory(aggregatedData, projectId, options = {}) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    // Transform aggregated data into proper history format
    const newHistory = {};
    for (const stepText in aggregatedData) {
      const { durations } = aggregatedData[stepText];
      const average = calculateAverage(durations);
      const stdDev = calculateStdDev(durations, average);
      newHistory[stepText] = { durations, average, stdDev };
    }

    await this.saveHistory(newHistory, projectId, options);
  }

  async savePerformanceRun(runData, projectId, metadata = {}) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    const timestamp = metadata.timestamp || new Date().toISOString();
    const runId = metadata.runId || `run-${Date.now()}`;
    const runFileName = `${runId}.json`;
    const key = this.getKey(projectId, 'runs', runFileName);

    const runDocument = {
      runId,
      projectId,
      runData,
      timestamp,
      metadata
    };

    await this.putObjectWithRetry(key, runDocument);
  }

  async getPerformanceRuns(projectId, options = {}) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    const limit = options.limit || 100;
    const prefix = this.getKey(projectId, 'runs', '');
    
    const objects = await this.listObjectsWithRetry(prefix, limit * 2); // Get more to account for non-JSON files
    
    // Sort by last modified (newest first)
    const jsonObjects = objects
      .filter(obj => obj.Key.endsWith('.json'))
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .slice(0, limit);

    // Fetch the actual run data
    const runs = await Promise.all(
      jsonObjects.map(async (obj) => {
        try {
          return await this.getObjectWithRetry(obj.Key);
        } catch (error) {
          console.warn(`Failed to fetch run data from ${obj.Key}:`, error.message);
          return null;
        }
      })
    );

    return runs.filter(Boolean);
  }

  async aggregateResults(projectId, jobIds, options = {}) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    // Get all performance runs
    const allRuns = await this.getPerformanceRuns(projectId, { limit: 1000 });
    
    // Filter runs by job IDs if provided
    let relevantRuns = allRuns;
    if (jobIds && jobIds.length > 0) {
      relevantRuns = allRuns.filter(run => {
        if (!run.runData) return false;
        
        const runJobIds = run.runData
          .map(step => step.context?.jobId)
          .filter(Boolean);
        return jobIds.some(jobId => runJobIds.includes(jobId));
      });
    }

    // Aggregate the run data
    const aggregatedSteps = [];
    relevantRuns.forEach(run => {
      if (run.runData) {
        aggregatedSteps.push(...run.runData);
      }
    });

    return {
      aggregatedSteps,
      jobCount: jobIds?.length || 0,
      runCount: relevantRuns.length,
      aggregationTimestamp: new Date().toISOString()
    };
  }

  async registerJob(projectId, jobId, jobInfo = {}) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    const key = this.getKey(projectId, 'jobs', `${jobId}.json`);
    
    const jobDocument = {
      projectId,
      jobId,
      status: 'registered',
      registeredAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      ...jobInfo
    };

    await this.putObjectWithRetry(key, jobDocument);
  }

  async updateJobStatus(projectId, jobId, status, metadata = {}) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    const key = this.getKey(projectId, 'jobs', `${jobId}.json`);
    
    // Get existing job info
    let jobInfo = await this.getObjectWithRetry(key);
    if (!jobInfo) {
      // Create new job info if it doesn't exist
      jobInfo = {
        projectId,
        jobId,
        registeredAt: new Date().toISOString()
      };
    }

    // Update status and metadata
    jobInfo.status = status;
    jobInfo.lastUpdated = new Date().toISOString();
    Object.assign(jobInfo, metadata);

    await this.putObjectWithRetry(key, jobInfo);
  }

  async getJobInfo(projectId, jobId) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    const key = this.getKey(projectId, 'jobs', `${jobId}.json`);
    return await this.getObjectWithRetry(key);
  }

  async waitForJobs(projectId, jobIds, options = {}) {
    const timeout = options.timeout || 300000; // 5 minutes default
    const pollInterval = options.pollInterval || 5000; // 5 seconds default
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const jobStatuses = await Promise.all(
        jobIds.map(async (jobId) => {
          try {
            const jobInfo = await this.getJobInfo(projectId, jobId);
            return {
              jobId,
              status: jobInfo?.status || 'unknown',
              lastUpdated: jobInfo?.lastUpdated || null
            };
          } catch (error) {
            return {
              jobId,
              status: 'error',
              error: error.message
            };
          }
        })
      );

      const completedJobs = jobStatuses.filter(job => 
        job.status === 'completed' || job.status === 'failed'
      );

      if (completedJobs.length === jobIds.length) {
        return {
          allCompleted: true,
          jobStatuses,
          waitTime: Date.now() - startTime
        };
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout reached
    const finalStatuses = await Promise.all(
      jobIds.map(async (jobId) => {
        try {
          const jobInfo = await this.getJobInfo(projectId, jobId);
          return {
            jobId,
            status: jobInfo?.status || 'unknown',
            lastUpdated: jobInfo?.lastUpdated || null
          };
        } catch (error) {
          return {
            jobId,
            status: 'error',
            error: error.message
          };
        }
      })
    );

    return {
      allCompleted: false,
      jobStatuses: finalStatuses,
      waitTime: timeout,
      timedOut: true
    };
  }

  async cleanup(projectId, retentionPolicy = {}) {
    if (!this.isReady()) {
      throw new Error('S3 adapter not initialized');
    }

    const defaultPolicies = {
      performanceRuns: 90, // days
      jobCoordination: 30, // days
      completedJobs: 7 // days
    };

    const policies = { ...defaultPolicies, ...retentionPolicy };
    const summary = {
      performanceRunsDeleted: 0,
      jobsDeleted: 0,
      completedJobsDeleted: 0
    };

    // Clean up old performance runs
    if (policies.performanceRuns > 0) {
      const runsPrefix = this.getKey(projectId, 'runs', '');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policies.performanceRuns);

      const objects = await this.listObjectsWithRetry(runsPrefix, 10000);
      const objectsToDelete = objects.filter(obj => 
        new Date(obj.LastModified) < cutoffDate
      );

      for (const obj of objectsToDelete) {
        try {
          await this.s3Client.deleteObject({
            Bucket: this.bucketName,
            Key: obj.Key
          }).promise();
          summary.performanceRunsDeleted++;
        } catch (error) {
          console.warn(`Failed to delete ${obj.Key}:`, error.message);
        }
      }
    }

    // Clean up old job coordination data
    if (policies.jobCoordination > 0) {
      const jobsPrefix = this.getKey(projectId, 'jobs', '');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policies.jobCoordination);

      const objects = await this.listObjectsWithRetry(jobsPrefix, 10000);
      
      for (const obj of objects) {
        if (new Date(obj.LastModified) < cutoffDate) {
          try {
            await this.s3Client.deleteObject({
              Bucket: this.bucketName,
              Key: obj.Key
            }).promise();
            summary.jobsDeleted++;
          } catch (error) {
            console.warn(`Failed to delete ${obj.Key}:`, error.message);
          }
        }
      }
    }

    // Clean up completed jobs with shorter retention
    if (policies.completedJobs > 0) {
      const jobsPrefix = this.getKey(projectId, 'jobs', '');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policies.completedJobs);

      const objects = await this.listObjectsWithRetry(jobsPrefix, 10000);
      
      for (const obj of objects) {
        try {
          const jobInfo = await this.getObjectWithRetry(obj.Key);
          
          if (jobInfo && 
              (jobInfo.status === 'completed' || jobInfo.status === 'failed') &&
              jobInfo.lastUpdated) {
            const lastUpdated = new Date(jobInfo.lastUpdated);
            
            if (lastUpdated < cutoffDate) {
              await this.s3Client.deleteObject({
                Bucket: this.bucketName,
                Key: obj.Key
              }).promise();
              summary.completedJobsDeleted++;
            }
          }
        } catch (error) {
          console.warn(`Failed to process/delete ${obj.Key}:`, error.message);
        }
      }
    }

    return summary;
  }

  async getHealthStatus() {
    const baseStatus = await super.getHealthStatus();
    
    if (!this.isReady()) {
      return {
        ...baseStatus,
        status: 'disconnected',
        error: 'S3 adapter not initialized'
      };
    }

    try {
      // Test S3 connectivity
      await this.s3Client.headBucket({ Bucket: this.bucketName }).promise();

      // Get bucket statistics
      const stats = await this.getBucketStats();

      return {
        ...baseStatus,
        status: 'healthy',
        bucket: this.bucketName,
        region: this.region,
        prefix: this.prefix,
        stats
      };
    } catch (error) {
      return {
        ...baseStatus,
        status: 'error',
        error: error.message
      };
    }
  }

  async getBucketStats() {
    const stats = {
      historyObjects: 0,
      runObjects: 0,
      jobObjects: 0,
      totalSize: 0
    };

    try {
      // Get stats for different object types
      const prefixes = ['history', 'runs', 'jobs'];
      
      for (const type of prefixes) {
        const prefix = this.getKey('*', type, '');
        const objects = await this.listObjectsWithRetry(prefix, 10000);
        
        switch (type) {
          case 'history':
            stats.historyObjects = objects.length;
            break;
          case 'runs':
            stats.runObjects = objects.length;
            break;
          case 'jobs':
            stats.jobObjects = objects.length;
            break;
        }
        
        stats.totalSize += objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      }
    } catch (error) {
      // Return partial stats if some operations fail
      stats.error = error.message;
    }

    return stats;
  }
}

module.exports = S3Adapter; 