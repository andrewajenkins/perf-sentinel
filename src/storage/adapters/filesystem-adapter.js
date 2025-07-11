const BaseStorageAdapter = require('./base-adapter');
const fs = require('fs').promises;
const path = require('path');
const { calculateAverage, calculateStdDev } = require('../../analysis/engine');

/**
 * FileSystem Storage Adapter
 * 
 * Implements storage using local file system for development and simple deployments
 */
class FileSystemAdapter extends BaseStorageAdapter {
  constructor(options = {}) {
    super(options);
    this.baseDirectory = options.baseDirectory || './performance-results';
    this.projectId = options.projectId || 'default';
  }

  async initialize() {
    // Create base directory structure
    await this.ensureDirectoryStructure();
    this.isConnected = true;
    console.log(`FileSystem adapter initialized: ${this.baseDirectory}`);
  }

  async close() {
    // No connections to close for file system
    this.isConnected = false;
  }

  getType() {
    return 'filesystem';
  }

  async ensureDirectoryStructure() {
    const projectDir = this.getProjectDirectory();
    const directories = [
      projectDir,
      path.join(projectDir, 'history'),
      path.join(projectDir, 'runs'),
      path.join(projectDir, 'jobs'),
      path.join(projectDir, 'temp')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  getProjectDirectory() {
    return path.join(this.baseDirectory, this.projectId);
  }

  getHistoryFilePath() {
    return path.join(this.getProjectDirectory(), 'history', 'performance-history.json');
  }

  getRunsDirectory() {
    return path.join(this.getProjectDirectory(), 'runs');
  }

  getJobsDirectory() {
    return path.join(this.getProjectDirectory(), 'jobs');
  }

  async readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async writeJsonFileAtomically(filePath, data) {
    const tempPath = `${filePath}.tmp`;
    const content = JSON.stringify(data, null, 2);
    
    // Write to temporary file first
    await fs.writeFile(tempPath, content, 'utf-8');
    
    // Atomically move to final location
    await fs.rename(tempPath, filePath);
  }

  async getHistory(projectId, options = {}) {
    // Support legacy file path option for backward compatibility
    if (options.filePath) {
      const history = await this.readJsonFile(options.filePath);
      return history || {};
    }

    const historyPath = this.getHistoryFilePath();
    const history = await this.readJsonFile(historyPath);
    return history || {};
  }

  async saveHistory(history, projectId, options = {}) {
    // Support legacy file path option for backward compatibility
    if (options.filePath) {
      await this.writeJsonFileAtomically(options.filePath, history);
      return;
    }

    const historyPath = this.getHistoryFilePath();
    await this.writeJsonFileAtomically(historyPath, history);
  }

  async seedHistory(aggregatedData, projectId, options = {}) {
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
    const timestamp = metadata.timestamp || new Date().toISOString();
    const runId = metadata.runId || `run-${Date.now()}`;
    const runFileName = `${runId}.json`;
    const runFilePath = path.join(this.getRunsDirectory(), runFileName);

    const runDocument = {
      runId,
      projectId,
      runData,
      timestamp,
      metadata
    };

    await this.writeJsonFileAtomically(runFilePath, runDocument);
  }

  async getPerformanceRuns(projectId, options = {}) {
    const runsDir = this.getRunsDirectory();
    const limit = options.limit || 100;
    
    try {
      const files = await fs.readdir(runsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      // Sort by modification time (newest first)
      const fileStats = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(runsDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );
      
      fileStats.sort((a, b) => b.mtime - a.mtime);
      
      // Read the most recent files up to the limit
      const recentFiles = fileStats.slice(0, limit);
      const runs = await Promise.all(
        recentFiles.map(async ({ file }) => {
          const filePath = path.join(runsDir, file);
          return await this.readJsonFile(filePath);
        })
      );
      
      return runs.filter(Boolean);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async aggregateResults(projectId, jobIds, options = {}) {
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
    const jobFilePath = path.join(this.getJobsDirectory(), `${jobId}.json`);
    
    const jobDocument = {
      projectId,
      jobId,
      status: 'registered',
      registeredAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      ...jobInfo
    };

    await this.writeJsonFileAtomically(jobFilePath, jobDocument);
  }

  async updateJobStatus(projectId, jobId, status, metadata = {}) {
    const jobFilePath = path.join(this.getJobsDirectory(), `${jobId}.json`);
    
    // Read existing job info
    let jobInfo = await this.readJsonFile(jobFilePath);
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

    await this.writeJsonFileAtomically(jobFilePath, jobInfo);
  }

  async getJobInfo(projectId, jobId) {
    const jobFilePath = path.join(this.getJobsDirectory(), `${jobId}.json`);
    return await this.readJsonFile(jobFilePath);
  }

  async waitForJobs(projectId, jobIds, options = {}) {
    const timeout = options.timeout || 300000; // 5 minutes default
    const pollInterval = options.pollInterval || 2000; // 2 seconds default (faster for local)
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
    const defaultPolicies = {
      performanceRuns: 30, // days (shorter for local dev)
      jobCoordination: 7, // days
      completedJobs: 1 // day
    };

    const policies = { ...defaultPolicies, ...retentionPolicy };
    const summary = {
      performanceRunsDeleted: 0,
      jobsDeleted: 0,
      completedJobsDeleted: 0
    };

    // Clean up old performance runs
    if (policies.performanceRuns > 0) {
      const runsDir = this.getRunsDirectory();
      const cutoffTime = Date.now() - (policies.performanceRuns * 24 * 60 * 60 * 1000);

      try {
        const files = await fs.readdir(runsDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        for (const file of jsonFiles) {
          const filePath = path.join(runsDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            summary.performanceRunsDeleted++;
          }
        }
      } catch (error) {
        // Ignore if directory doesn't exist
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    // Clean up old job files
    if (policies.jobCoordination > 0) {
      const jobsDir = this.getJobsDirectory();
      const cutoffTime = Date.now() - (policies.jobCoordination * 24 * 60 * 60 * 1000);

      try {
        const files = await fs.readdir(jobsDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        for (const file of jsonFiles) {
          const filePath = path.join(jobsDir, file);
          const jobInfo = await this.readJsonFile(filePath);

          if (jobInfo && jobInfo.lastUpdated) {
            const lastUpdated = new Date(jobInfo.lastUpdated).getTime();
            
            if (lastUpdated < cutoffTime) {
              await fs.unlink(filePath);
              summary.jobsDeleted++;
            }
          }
        }
      } catch (error) {
        // Ignore if directory doesn't exist
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    // Clean up completed jobs with shorter retention
    if (policies.completedJobs > 0) {
      const jobsDir = this.getJobsDirectory();
      const cutoffTime = Date.now() - (policies.completedJobs * 24 * 60 * 60 * 1000);

      try {
        const files = await fs.readdir(jobsDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        for (const file of jsonFiles) {
          const filePath = path.join(jobsDir, file);
          const jobInfo = await this.readJsonFile(filePath);

          if (jobInfo && 
              (jobInfo.status === 'completed' || jobInfo.status === 'failed') &&
              jobInfo.lastUpdated) {
            const lastUpdated = new Date(jobInfo.lastUpdated).getTime();
            
            if (lastUpdated < cutoffTime) {
              await fs.unlink(filePath);
              summary.completedJobsDeleted++;
            }
          }
        }
      } catch (error) {
        // Ignore if directory doesn't exist
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    return summary;
  }

  async getHealthStatus() {
    const baseStatus = await super.getHealthStatus();
    
    try {
      // Test write access
      const testDir = this.getProjectDirectory();
      const testFile = path.join(testDir, 'health-check.tmp');
      
      await fs.writeFile(testFile, 'health check');
      await fs.unlink(testFile);

      // Get directory size info
      const stats = await this.getDirectoryStats();

      return {
        ...baseStatus,
        status: 'healthy',
        baseDirectory: this.baseDirectory,
        projectDirectory: this.getProjectDirectory(),
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

  async getDirectoryStats() {
    const projectDir = this.getProjectDirectory();
    const stats = {
      historyFiles: 0,
      runFiles: 0,
      jobFiles: 0,
      totalSize: 0
    };

    try {
      // Count history files
      const historyDir = path.join(projectDir, 'history');
      const historyFiles = await fs.readdir(historyDir);
      stats.historyFiles = historyFiles.filter(f => f.endsWith('.json')).length;

      // Count run files
      const runsDir = path.join(projectDir, 'runs');
      const runFiles = await fs.readdir(runsDir);
      stats.runFiles = runFiles.filter(f => f.endsWith('.json')).length;

      // Count job files
      const jobsDir = path.join(projectDir, 'jobs');
      const jobFiles = await fs.readdir(jobsDir);
      stats.jobFiles = jobFiles.filter(f => f.endsWith('.json')).length;

      // Calculate total size (approximate)
      const allFiles = [
        ...historyFiles.map(f => path.join(historyDir, f)),
        ...runFiles.map(f => path.join(runsDir, f)),
        ...jobFiles.map(f => path.join(jobsDir, f))
      ];

      for (const file of allFiles) {
        try {
          const fileStat = await fs.stat(file);
          stats.totalSize += fileStat.size;
        } catch (error) {
          // Ignore individual file errors
        }
      }
    } catch (error) {
      // Return partial stats if some directories don't exist
    }

    return stats;
  }
}

module.exports = FileSystemAdapter; 