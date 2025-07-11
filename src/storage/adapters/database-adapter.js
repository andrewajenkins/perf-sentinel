const BaseStorageAdapter = require('./base-adapter');
const DatabaseService = require('../database');
const { calculateAverage, calculateStdDev } = require('../../analysis/engine');

/**
 * Database Storage Adapter
 * 
 * Implements storage using MongoDB/DocumentDB as the backend
 */
class DatabaseAdapter extends BaseStorageAdapter {
  constructor(options = {}) {
    super(options);
    this.connectionString = options.connectionString;
    this.databaseName = options.databaseName || 'perf-sentinel';
    this.dbService = null;
  }

  async initialize() {
    if (!this.connectionString) {
      throw new Error('Database connection string is required');
    }

    this.dbService = new DatabaseService(this.connectionString, this.databaseName);
    await this.dbService.connect();
    await this.dbService.createIndexes();
    this.isConnected = true;
    
    console.log(`Database adapter initialized: ${this.databaseName}`);
  }

  async close() {
    if (this.dbService) {
      await this.dbService.disconnect();
      this.isConnected = false;
    }
  }

  getType() {
    return 'database';
  }

  async getHistory(projectId, options = {}) {
    if (!this.isReady()) {
      throw new Error('Database adapter not initialized');
    }

    return await this.dbService.getHistory(projectId);
  }

  async saveHistory(history, projectId, options = {}) {
    if (!this.isReady()) {
      throw new Error('Database adapter not initialized');
    }

    await this.dbService.saveHistory(history, projectId);
  }

  async seedHistory(aggregatedData, projectId, options = {}) {
    if (!this.isReady()) {
      throw new Error('Database adapter not initialized');
    }

    // Transform aggregated data into proper history format
    const newHistory = {};
    for (const stepText in aggregatedData) {
      const { durations } = aggregatedData[stepText];
      const average = calculateAverage(durations);
      const stdDev = calculateStdDev(durations, average);
      newHistory[stepText] = { durations, average, stdDev };
    }

    await this.dbService.seedHistory(newHistory, projectId);
  }

  async savePerformanceRun(runData, projectId, metadata = {}) {
    if (!this.isReady()) {
      throw new Error('Database adapter not initialized');
    }

    await this.dbService.savePerformanceRun(runData, projectId);
  }

  async getPerformanceRuns(projectId, options = {}) {
    if (!this.isReady()) {
      throw new Error('Database adapter not initialized');
    }

    const limit = options.limit || 100;
    return await this.dbService.getPerformanceRuns(projectId, limit);
  }

  async aggregateResults(projectId, jobIds, options = {}) {
    if (!this.isReady()) {
      throw new Error('Database adapter not initialized');
    }

    // Get all performance runs for the specified jobs
    const allRuns = await this.getPerformanceRuns(projectId, { limit: 1000 });
    
    // Filter runs by job IDs if provided
    let relevantRuns = allRuns;
    if (jobIds && jobIds.length > 0) {
      relevantRuns = allRuns.filter(run => {
        const runJobIds = run.runData
          .map(step => step.context?.jobId)
          .filter(Boolean);
        return jobIds.some(jobId => runJobIds.includes(jobId));
      });
    }

    // Aggregate the run data
    const aggregatedSteps = [];
    relevantRuns.forEach(run => {
      aggregatedSteps.push(...run.runData);
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
      throw new Error('Database adapter not initialized');
    }

    // Store job information in a jobs collection
    const db = await this.dbService.connect();
    const jobsCollection = db.collection('job_coordination');

    await jobsCollection.replaceOne(
      { projectId, jobId },
      {
        projectId,
        jobId,
        status: 'registered',
        registeredAt: new Date(),
        lastUpdated: new Date(),
        ...jobInfo
      },
      { upsert: true }
    );
  }

  async updateJobStatus(projectId, jobId, status, metadata = {}) {
    if (!this.isReady()) {
      throw new Error('Database adapter not initialized');
    }

    const db = await this.dbService.connect();
    const jobsCollection = db.collection('job_coordination');

    await jobsCollection.updateOne(
      { projectId, jobId },
      {
        $set: {
          status,
          lastUpdated: new Date(),
          ...metadata
        }
      }
    );
  }

  async getJobInfo(projectId, jobId) {
    if (!this.isReady()) {
      throw new Error('Database adapter not initialized');
    }

    const db = await this.dbService.connect();
    const jobsCollection = db.collection('job_coordination');

    return await jobsCollection.findOne({ projectId, jobId });
  }

  async waitForJobs(projectId, jobIds, options = {}) {
    const timeout = options.timeout || 300000; // 5 minutes default
    const pollInterval = options.pollInterval || 5000; // 5 seconds default
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const jobStatuses = await Promise.all(
        jobIds.map(async (jobId) => {
          const jobInfo = await this.getJobInfo(projectId, jobId);
          return {
            jobId,
            status: jobInfo?.status || 'unknown',
            lastUpdated: jobInfo?.lastUpdated || null
          };
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
        const jobInfo = await this.getJobInfo(projectId, jobId);
        return {
          jobId,
          status: jobInfo?.status || 'unknown',
          lastUpdated: jobInfo?.lastUpdated || null
        };
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
      throw new Error('Database adapter not initialized');
    }

    const db = await this.dbService.connect();
    
    // Default retention policies
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
      const runsCollection = db.collection('performance_runs');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policies.performanceRuns);

      const result = await runsCollection.deleteMany({
        projectId,
        timestamp: { $lt: cutoffDate }
      });
      summary.performanceRunsDeleted = result.deletedCount;
    }

    // Clean up old job coordination data
    if (policies.jobCoordination > 0) {
      const jobsCollection = db.collection('job_coordination');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policies.jobCoordination);

      const result = await jobsCollection.deleteMany({
        projectId,
        lastUpdated: { $lt: cutoffDate }
      });
      summary.jobsDeleted = result.deletedCount;
    }

    // Clean up completed jobs separately with shorter retention
    if (policies.completedJobs > 0) {
      const jobsCollection = db.collection('job_coordination');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policies.completedJobs);

      const result = await jobsCollection.deleteMany({
        projectId,
        status: { $in: ['completed', 'failed'] },
        lastUpdated: { $lt: cutoffDate }
      });
      summary.completedJobsDeleted = result.deletedCount;
    }

    return summary;
  }

  async getHealthStatus() {
    const baseStatus = await super.getHealthStatus();
    
    if (!this.isReady()) {
      return {
        ...baseStatus,
        status: 'disconnected',
        error: 'Database not connected'
      };
    }

    try {
      // Test database connectivity
      const db = await this.dbService.connect();
      await db.admin().ping();

      return {
        ...baseStatus,
        status: 'healthy',
        database: this.databaseName,
        connectionString: this.connectionString?.replace(/\/\/.*@/, '//***:***@') // Hide credentials
      };
    } catch (error) {
      return {
        ...baseStatus,
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = DatabaseAdapter; 