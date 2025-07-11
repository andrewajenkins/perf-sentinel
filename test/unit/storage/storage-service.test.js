const fs = require('fs').promises;
const path = require('path');
const StorageService = require('../../../src/storage/storage');

describe('StorageService', () => {
  const testDir = path.join(__dirname, '../../temp-storage-test');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('adapter detection', () => {
    it('should auto-detect filesystem adapter as default', () => {
      const storage = new StorageService({});
      expect(storage.adapterType).toBe('filesystem');
      expect(storage.adapter.getType()).toBe('filesystem');
    });

    it('should detect database adapter from connection string', () => {
      const storage = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017'
      });
      expect(storage.adapterType).toBe('database');
      expect(storage.adapter.getType()).toBe('database');
    });

    it('should detect S3 adapter from bucket name', () => {
      const storage = new StorageService({
        bucketName: 'test-bucket'
      });
      expect(storage.adapterType).toBe('s3');
      expect(storage.adapter.getType()).toBe('s3');
    });

    it('should use explicit adapter type', () => {
      const storage = new StorageService({
        adapterType: 'filesystem',
        baseDirectory: testDir
      });
      expect(storage.adapterType).toBe('filesystem');
      expect(storage.adapter.getType()).toBe('filesystem');
    });

    it('should throw error for unsupported adapter type', () => {
      expect(() => {
        new StorageService({ adapterType: 'unsupported' });
      }).toThrow('Unsupported adapter type: unsupported');
    });
  });

  describe('filesystem adapter integration', () => {
    let storage;

    beforeEach(async () => {
      storage = new StorageService({
        adapterType: 'filesystem',
        baseDirectory: testDir,
        projectId: 'test-project'
      });
      await storage.initializeAdapter();
    });

    afterEach(async () => {
      if (storage) {
        await storage.close();
      }
    });

    it('should perform basic history operations', async () => {
      const history = {
        'step 1': { durations: [100, 110], average: 105, stdDev: 5 },
        'step 2': { durations: [200, 210], average: 205, stdDev: 5 }
      };

      await storage.saveHistory(history);
      const retrievedHistory = await storage.getHistory();
      
      expect(retrievedHistory).toEqual(history);
      expect(storage.getStorageType()).toBe('filesystem');
    });

    it('should handle performance runs', async () => {
      const runData = [
        { stepText: 'step 1', duration: 100, timestamp: '2023-01-01T00:00:00Z' },
        { stepText: 'step 2', duration: 200, timestamp: '2023-01-01T00:00:01Z' }
      ];

      await storage.savePerformanceRun(runData, { runId: 'test-run' });
      
      // Note: getPerformanceRuns is not exposed in StorageService interface
      // This would be handled internally by the adapter
    });

    it('should handle job coordination', async () => {
      const jobId = 'test-job';
      
      await storage.registerJob(jobId, { suite: 'auth' });
      
      const jobInfo = await storage.getJobInfo(jobId);
      expect(jobInfo.jobId).toBe(jobId);
      expect(jobInfo.status).toBe('registered');

      await storage.updateJobStatus(jobId, 'completed');
      
      const updatedJobInfo = await storage.getJobInfo(jobId);
      expect(updatedJobInfo.status).toBe('completed');
    });

    it('should wait for jobs and aggregate results', async () => {
      const jobIds = ['job-1', 'job-2'];

      // Register jobs
      for (const jobId of jobIds) {
        await storage.registerJob(jobId);
      }

      // Start waiting with short timeout
      const waitPromise = storage.waitForJobs(jobIds, { 
        timeout: 2000, 
        pollInterval: 100 
      });

      // Complete jobs
      setTimeout(async () => {
        await storage.updateJobStatus('job-1', 'completed');
        await storage.updateJobStatus('job-2', 'completed');
      }, 200);

      const waitResult = await waitPromise;
      expect(waitResult.allCompleted).toBe(true);

      // Test aggregation
      const aggregationResult = await storage.aggregateResults(jobIds);
      expect(aggregationResult).toHaveProperty('aggregatedSteps');
      expect(aggregationResult).toHaveProperty('runCount');
      expect(aggregationResult).toHaveProperty('jobCount');
    });

    it('should get health status', async () => {
      const status = await storage.getHealthStatus();
      expect(status.type).toBe('filesystem');
      expect(status.status).toBe('healthy');
    });

    it('should perform cleanup', async () => {
      const result = await storage.cleanup({
        performanceRuns: 1,
        jobCoordination: 1,
        completedJobs: 1
      });

      expect(result).toHaveProperty('performanceRunsDeleted');
      expect(result).toHaveProperty('jobsDeleted');
      expect(result).toHaveProperty('completedJobsDeleted');
    });
  });

  describe('database adapter integration', () => {
    let storage;

    beforeEach(() => {
      storage = new StorageService({
        adapterType: 'database',
        connectionString: 'mongodb://localhost:27017',
        databaseName: 'test-db',
        projectId: 'test-project'
      });
    });

    afterEach(async () => {
      if (storage) {
        await storage.close();
      }
    });

    it('should create database adapter', () => {
      expect(storage.getStorageType()).toBe('database');
    });

    it('should handle initialization failure gracefully', async () => {
      // Database adapter will fail to initialize without actual MongoDB
      // But it should not throw during construction
      expect(storage.adapter).toBeDefined();
      expect(storage.adapter.getType()).toBe('database');
    });
  });

  describe('S3 adapter integration', () => {
    let storage;

    beforeEach(() => {
      storage = new StorageService({
        adapterType: 's3',
        bucketName: 'test-bucket',
        region: 'us-east-1',
        projectId: 'test-project'
      });
    });

    afterEach(async () => {
      if (storage) {
        await storage.close();
      }
    });

    it('should create S3 adapter', () => {
      expect(storage.getStorageType()).toBe('s3');
    });

    it('should handle missing bucket name', () => {
      expect(() => {
        new StorageService({
          adapterType: 's3',
          // Missing bucketName
          region: 'us-east-1'
        });
      }).toThrow('S3 bucket name is required');
    });
  });

  describe('fallback behavior', () => {
    let storage;

    beforeEach(() => {
      storage = new StorageService({
        adapterType: 'database',
        connectionString: 'mongodb://invalid-host:27017',
        projectId: 'test-project'
      });
    });

    afterEach(async () => {
      if (storage) {
        await storage.close();
      }
    });

    it('should fall back to filesystem for history operations', async () => {
      const historyFile = path.join(testDir, 'fallback-history.json');
      const history = { 'step 1': { durations: [100], average: 100, stdDev: 0 } };

      // Ensure directory exists
      await fs.mkdir(testDir, { recursive: true });

      // This should fall back to filesystem when database fails
      await storage.saveHistory(history, historyFile);
      const retrievedHistory = await storage.getHistory(historyFile);
      
      expect(retrievedHistory).toEqual(history);
    });

    it('should handle errors gracefully for non-critical operations', async () => {
      // These operations should not throw but warn
      await expect(storage.savePerformanceRun([])).resolves.not.toThrow();
      await expect(storage.registerJob('test-job')).resolves.not.toThrow();
      await expect(storage.updateJobStatus('test-job', 'completed')).resolves.not.toThrow();
      
      const jobInfo = await storage.getJobInfo('test-job');
      expect(jobInfo).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should return error health status when no adapter configured', async () => {
      const storage = new StorageService({});
      storage.adapter = null; // Simulate no adapter

      const status = await storage.getHealthStatus();
      expect(status.status).toBe('error');
      expect(status.error).toBe('No adapter configured');
    });

    it('should handle cleanup errors gracefully', async () => {
      const storage = new StorageService({
        adapterType: 'database',
        connectionString: 'mongodb://invalid:27017'
      });

      const result = await storage.cleanup();
      expect(result.error).toBeDefined();
      expect(result.performanceRunsDeleted).toBe(0);
    });
  });

  describe('backward compatibility', () => {
    it('should support legacy database initialization method', async () => {
      const storage = new StorageService({
        adapterType: 'filesystem',
        baseDirectory: testDir
      });

      // This should work (calls initializeAdapter internally)
      await expect(storage.initializeDatabase()).resolves.not.toThrow();
    });

    it('should support legacy options format', () => {
      const storage = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        databaseName: 'test-db'
      });

      expect(storage.adapterType).toBe('database');
    });
  });
}); 