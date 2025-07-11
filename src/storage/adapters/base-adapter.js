/**
 * Base Storage Adapter Interface
 * 
 * All storage adapters must implement this interface to ensure consistent behavior
 * across different storage backends (file system, database, S3, etc.)
 */
class BaseStorageAdapter {
  constructor(options = {}) {
    this.options = options;
    this.isConnected = false;
  }

  /**
   * Initialize the storage adapter
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() method must be implemented by storage adapter');
  }

  /**
   * Clean up and close connections
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() method must be implemented by storage adapter');
  }

  /**
   * Check if the adapter is properly initialized and ready
   * @returns {boolean}
   */
  isReady() {
    return this.isConnected;
  }

  /**
   * Get performance history for a project
   * @param {string} projectId - Project identifier
   * @param {Object} options - Additional options (file path, etc.)
   * @returns {Promise<Object>} History data
   */
  async getHistory(projectId, options = {}) {
    throw new Error('getHistory() method must be implemented by storage adapter');
  }

  /**
   * Save performance history for a project
   * @param {Object} history - History data to save
   * @param {string} projectId - Project identifier
   * @param {Object} options - Additional options (file path, etc.)
   * @returns {Promise<void>}
   */
  async saveHistory(history, projectId, options = {}) {
    throw new Error('saveHistory() method must be implemented by storage adapter');
  }

  /**
   * Seed history from aggregated run data
   * @param {Object} aggregatedData - Aggregated performance data
   * @param {string} projectId - Project identifier
   * @param {Object} options - Additional options
   * @returns {Promise<void>}
   */
  async seedHistory(aggregatedData, projectId, options = {}) {
    throw new Error('seedHistory() method must be implemented by storage adapter');
  }

  /**
   * Save a single performance run for historical tracking
   * @param {Array} runData - Performance run data
   * @param {string} projectId - Project identifier
   * @param {Object} metadata - Run metadata (timestamp, job info, etc.)
   * @returns {Promise<void>}
   */
  async savePerformanceRun(runData, projectId, metadata = {}) {
    throw new Error('savePerformanceRun() method must be implemented by storage adapter');
  }

  /**
   * Get historical performance runs
   * @param {string} projectId - Project identifier
   * @param {Object} options - Query options (limit, startDate, endDate, etc.)
   * @returns {Promise<Array>} Array of performance runs
   */
  async getPerformanceRuns(projectId, options = {}) {
    throw new Error('getPerformanceRuns() method must be implemented by storage adapter');
  }

  /**
   * Aggregate results from multiple jobs/sources
   * @param {string} projectId - Project identifier
   * @param {Array} jobIds - Array of job identifiers to aggregate
   * @param {Object} options - Aggregation options
   * @returns {Promise<Object>} Aggregated results
   */
  async aggregateResults(projectId, jobIds, options = {}) {
    throw new Error('aggregateResults() method must be implemented by storage adapter');
  }

  /**
   * Register a job for coordination
   * @param {string} projectId - Project identifier
   * @param {string} jobId - Job identifier
   * @param {Object} jobInfo - Job information (status, metadata, etc.)
   * @returns {Promise<void>}
   */
  async registerJob(projectId, jobId, jobInfo = {}) {
    throw new Error('registerJob() method must be implemented by storage adapter');
  }

  /**
   * Update job status
   * @param {string} projectId - Project identifier
   * @param {string} jobId - Job identifier
   * @param {string} status - Job status (pending, running, completed, failed)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async updateJobStatus(projectId, jobId, status, metadata = {}) {
    throw new Error('updateJobStatus() method must be implemented by storage adapter');
  }

  /**
   * Get job status and information
   * @param {string} projectId - Project identifier
   * @param {string} jobId - Job identifier
   * @returns {Promise<Object|null>} Job information or null if not found
   */
  async getJobInfo(projectId, jobId) {
    throw new Error('getJobInfo() method must be implemented by storage adapter');
  }

  /**
   * Wait for jobs to complete
   * @param {string} projectId - Project identifier
   * @param {Array} jobIds - Array of job identifiers to wait for
   * @param {Object} options - Wait options (timeout, polling interval, etc.)
   * @returns {Promise<Object>} Job completion status
   */
  async waitForJobs(projectId, jobIds, options = {}) {
    throw new Error('waitForJobs() method must be implemented by storage adapter');
  }

  /**
   * Clean up old data based on retention policies
   * @param {string} projectId - Project identifier
   * @param {Object} retentionPolicy - Retention policy configuration
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanup(projectId, retentionPolicy = {}) {
    throw new Error('cleanup() method must be implemented by storage adapter');
  }

  /**
   * Get storage adapter type/name
   * @returns {string} Adapter type identifier
   */
  getType() {
    throw new Error('getType() method must be implemented by storage adapter');
  }

  /**
   * Get storage adapter health status
   * @returns {Promise<Object>} Health status information
   */
  async getHealthStatus() {
    return {
      type: this.getType(),
      isReady: this.isReady(),
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = BaseStorageAdapter; 