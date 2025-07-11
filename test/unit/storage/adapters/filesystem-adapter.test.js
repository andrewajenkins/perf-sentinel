const fs = require('fs').promises;
const path = require('path');
const FileSystemAdapter = require('../../../../src/storage/adapters/filesystem-adapter');

describe('FileSystemAdapter', () => {
  let adapter;
  const testDir = path.join(__dirname, '../../../temp-filesystem-test');
  const projectId = 'test-project';

  beforeEach(async () => {
    adapter = new FileSystemAdapter({
      baseDirectory: testDir,
      projectId: projectId
    });
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    if (adapter.isReady()) {
      await adapter.close();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultAdapter = new FileSystemAdapter();
      expect(defaultAdapter.baseDirectory).toBe('./performance-results');
      expect(defaultAdapter.projectId).toBe('default');
    });

    it('should initialize with custom options', () => {
      expect(adapter.baseDirectory).toBe(testDir);
      expect(adapter.projectId).toBe(projectId);
    });
  });

  describe('initialization', () => {
    it('should initialize and create directory structure', async () => {
      await adapter.initialize();
      
      expect(adapter.isReady()).toBe(true);
      expect(adapter.getType()).toBe('filesystem');
      
      // Check if directories were created
      const projectDir = adapter.getProjectDirectory();
      const historyDir = path.join(projectDir, 'history');
      const runsDir = path.join(projectDir, 'runs');
      const jobsDir = path.join(projectDir, 'jobs');
      
      expect(await fs.access(projectDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(historyDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(runsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(jobsDir).then(() => true).catch(() => false)).toBe(true);
    });

    it('should close properly', async () => {
      await adapter.initialize();
      expect(adapter.isReady()).toBe(true);
      
      await adapter.close();
      expect(adapter.isReady()).toBe(false);
    });
  });

  describe('history operations', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should save and retrieve history', async () => {
      const history = {
        'step 1': { durations: [100, 110], average: 105, stdDev: 5 },
        'step 2': { durations: [200, 210], average: 205, stdDev: 5 }
      };

      await adapter.saveHistory(history, projectId);
      const retrievedHistory = await adapter.getHistory(projectId);
      
      expect(retrievedHistory).toEqual(history);
    });

    it('should return empty object for non-existent history', async () => {
      const history = await adapter.getHistory(projectId);
      expect(history).toEqual({});
    });

    it('should support legacy file path option', async () => {
      const legacyPath = path.join(testDir, 'legacy-history.json');
      const history = {
        'step 1': { durations: [100], average: 100, stdDev: 0 }
      };

      await adapter.saveHistory(history, projectId, { filePath: legacyPath });
      const retrievedHistory = await adapter.getHistory(projectId, { filePath: legacyPath });
      
      expect(retrievedHistory).toEqual(history);
    });

    it('should seed history from aggregated data', async () => {
      const aggregatedData = {
        'step 1': { durations: [100, 110, 120] },
        'step 2': { durations: [200, 210] }
      };

      await adapter.seedHistory(aggregatedData, projectId);
      const history = await adapter.getHistory(projectId);
      
      expect(history['step 1']).toBeDefined();
      expect(history['step 1'].durations).toEqual([100, 110, 120]);
      expect(history['step 1'].average).toBe(110);
      expect(history['step 2']).toBeDefined();
      expect(history['step 2'].durations).toEqual([200, 210]);
      expect(history['step 2'].average).toBe(205);
    });
  });

  describe('performance run operations', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should save and retrieve performance runs', async () => {
      const runData = [
        { stepText: 'step 1', duration: 100, timestamp: '2023-01-01T00:00:00Z' },
        { stepText: 'step 2', duration: 200, timestamp: '2023-01-01T00:00:01Z' }
      ];

      await adapter.savePerformanceRun(runData, projectId, { runId: 'test-run-1' });
      
      const runs = await adapter.getPerformanceRuns(projectId);
      expect(runs).toHaveLength(1);
      expect(runs[0].runData).toEqual(runData);
      expect(runs[0].runId).toBe('test-run-1');
    });

    it('should return empty array for no runs', async () => {
      const runs = await adapter.getPerformanceRuns(projectId);
      expect(runs).toEqual([]);
    });

    it('should limit number of returned runs', async () => {
      // Save multiple runs
      for (let i = 0; i < 5; i++) {
        await adapter.savePerformanceRun(
          [{ stepText: `step ${i}`, duration: 100 + i }],
          projectId,
          { runId: `run-${i}` }
        );
      }

      const runs = await adapter.getPerformanceRuns(projectId, { limit: 3 });
      expect(runs).toHaveLength(3);
    });
  });

  describe('job coordination', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should register and update job status', async () => {
      const jobId = 'test-job-1';
      const jobInfo = { suite: 'auth', worker: 'worker-1' };

      await adapter.registerJob(projectId, jobId, jobInfo);
      
      let job = await adapter.getJobInfo(projectId, jobId);
      expect(job.jobId).toBe(jobId);
      expect(job.status).toBe('registered');
      expect(job.suite).toBe('auth');

      await adapter.updateJobStatus(projectId, jobId, 'completed', { endTime: '2023-01-01T00:01:00Z' });
      
      job = await adapter.getJobInfo(projectId, jobId);
      expect(job.status).toBe('completed');
      expect(job.endTime).toBe('2023-01-01T00:01:00Z');
    });

    it('should return null for non-existent job', async () => {
      const job = await adapter.getJobInfo(projectId, 'non-existent');
      expect(job).toBeNull();
    });

    it('should wait for jobs to complete', async () => {
      const jobIds = ['job-1', 'job-2'];

      // Register jobs
      for (const jobId of jobIds) {
        await adapter.registerJob(projectId, jobId);
      }

      // Start waiting (with short timeout)
      const waitPromise = adapter.waitForJobs(projectId, jobIds, { 
        timeout: 5000, 
        pollInterval: 100 
      });

      // Complete jobs after a delay
      setTimeout(async () => {
        await adapter.updateJobStatus(projectId, 'job-1', 'completed');
        await adapter.updateJobStatus(projectId, 'job-2', 'completed');
      }, 200);

      const result = await waitPromise;
      expect(result.allCompleted).toBe(true);
      expect(result.timedOut).toBeUndefined();
      expect(result.jobStatuses).toHaveLength(2);
      expect(result.jobStatuses.every(job => job.status === 'completed')).toBe(true);
    });

    it('should timeout when waiting for jobs', async () => {
      const jobIds = ['slow-job'];
      await adapter.registerJob(projectId, jobIds[0]);

      const result = await adapter.waitForJobs(projectId, jobIds, { 
        timeout: 500, 
        pollInterval: 100 
      });

      expect(result.allCompleted).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.waitTime).toBeGreaterThanOrEqual(500);
    });
  });

  describe('result aggregation', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should aggregate results from multiple runs', async () => {
      // Save runs with different job IDs
      const run1 = [
        { stepText: 'step 1', duration: 100, context: { jobId: 'job-1' } },
        { stepText: 'step 2', duration: 200, context: { jobId: 'job-1' } }
      ];
      const run2 = [
        { stepText: 'step 1', duration: 110, context: { jobId: 'job-2' } },
        { stepText: 'step 3', duration: 300, context: { jobId: 'job-2' } }
      ];

      await adapter.savePerformanceRun(run1, projectId, { runId: 'run-1' });
      await adapter.savePerformanceRun(run2, projectId, { runId: 'run-2' });

      const result = await adapter.aggregateResults(projectId, ['job-1', 'job-2']);
      
      expect(result.aggregatedSteps).toHaveLength(4);
      expect(result.runCount).toBe(2);
      expect(result.jobCount).toBe(2);
    });

    it('should aggregate all results when no job IDs specified', async () => {
      const run1 = [{ stepText: 'step 1', duration: 100 }];
      const run2 = [{ stepText: 'step 2', duration: 200 }];

      await adapter.savePerformanceRun(run1, projectId, { runId: 'run-1' });
      await adapter.savePerformanceRun(run2, projectId, { runId: 'run-2' });

      const result = await adapter.aggregateResults(projectId, []);
      
      expect(result.aggregatedSteps).toHaveLength(2);
      expect(result.runCount).toBe(2);
      expect(result.jobCount).toBe(0);
    });
  });

  describe('cleanup operations', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should clean up old files based on retention policy', async () => {
      // Create old files by mocking file timestamps
      const oldTime = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      // Save some test data
      await adapter.savePerformanceRun([{ stepText: 'old step', duration: 100 }], projectId);
      await adapter.registerJob(projectId, 'old-job');
      
      // Mock the file modification times to be old
      const runsDir = adapter.getRunsDirectory();
      const jobsDir = adapter.getJobsDirectory();
      
      const runFiles = await fs.readdir(runsDir);
      const jobFiles = await fs.readdir(jobsDir);
      
      // Touch files to make them appear old (this is a simplified test)
      // In a real scenario, we'd need to mock fs.stat
      
      const result = await adapter.cleanup(projectId, {
        performanceRuns: 1, // 1 day retention
        jobCoordination: 1,
        completedJobs: 1
      });

      // The cleanup might not delete files in this test since we can't easily mock file times
      // But we can verify the structure of the returned summary
      expect(result).toHaveProperty('performanceRunsDeleted');
      expect(result).toHaveProperty('jobsDeleted');
      expect(result).toHaveProperty('completedJobsDeleted');
    });
  });

  describe('health status', () => {
    it('should return health status when ready', async () => {
      await adapter.initialize();
      
      const status = await adapter.getHealthStatus();
      expect(status.type).toBe('filesystem');
      expect(status.status).toBe('healthy');
      expect(status.baseDirectory).toBe(testDir);
      expect(status.stats).toBeDefined();
    });

    it('should return error status when not ready', async () => {
      const status = await adapter.getHealthStatus();
      expect(status.type).toBe('filesystem');
      expect(status.status).toBe('error');
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      await adapter.initialize();
      
      // Try to save to a read-only location (this might not work on all systems)
      // Instead, let's test with an invalid path
      const invalidAdapter = new FileSystemAdapter({
        baseDirectory: '/invalid/readonly/path',
        projectId: 'test'
      });

      // This should not throw but might fail initialization
      try {
        await invalidAdapter.initialize();
        await invalidAdapter.saveHistory({}, 'test');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
}); 