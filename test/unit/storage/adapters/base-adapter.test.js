const BaseStorageAdapter = require('../../../../src/storage/adapters/base-adapter');

describe('BaseStorageAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new BaseStorageAdapter();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(adapter.options).toEqual({});
      expect(adapter.isConnected).toBe(false);
    });

    it('should initialize with provided options', () => {
      const options = { test: 'value' };
      const customAdapter = new BaseStorageAdapter(options);
      expect(customAdapter.options).toEqual(options);
    });
  });

  describe('abstract methods', () => {
    it('should throw error for initialize()', async () => {
      await expect(adapter.initialize()).rejects.toThrow('initialize() method must be implemented by storage adapter');
    });

    it('should throw error for close()', async () => {
      await expect(adapter.close()).rejects.toThrow('close() method must be implemented by storage adapter');
    });

    it('should throw error for getHistory()', async () => {
      await expect(adapter.getHistory('test')).rejects.toThrow('getHistory() method must be implemented by storage adapter');
    });

    it('should throw error for saveHistory()', async () => {
      await expect(adapter.saveHistory({}, 'test')).rejects.toThrow('saveHistory() method must be implemented by storage adapter');
    });

    it('should throw error for seedHistory()', async () => {
      await expect(adapter.seedHistory({}, 'test')).rejects.toThrow('seedHistory() method must be implemented by storage adapter');
    });

    it('should throw error for savePerformanceRun()', async () => {
      await expect(adapter.savePerformanceRun([], 'test')).rejects.toThrow('savePerformanceRun() method must be implemented by storage adapter');
    });

    it('should throw error for getPerformanceRuns()', async () => {
      await expect(adapter.getPerformanceRuns('test')).rejects.toThrow('getPerformanceRuns() method must be implemented by storage adapter');
    });

    it('should throw error for aggregateResults()', async () => {
      await expect(adapter.aggregateResults('test', [])).rejects.toThrow('aggregateResults() method must be implemented by storage adapter');
    });

    it('should throw error for registerJob()', async () => {
      await expect(adapter.registerJob('test', 'job1')).rejects.toThrow('registerJob() method must be implemented by storage adapter');
    });

    it('should throw error for updateJobStatus()', async () => {
      await expect(adapter.updateJobStatus('test', 'job1', 'completed')).rejects.toThrow('updateJobStatus() method must be implemented by storage adapter');
    });

    it('should throw error for getJobInfo()', async () => {
      await expect(adapter.getJobInfo('test', 'job1')).rejects.toThrow('getJobInfo() method must be implemented by storage adapter');
    });

    it('should throw error for waitForJobs()', async () => {
      await expect(adapter.waitForJobs('test', ['job1'])).rejects.toThrow('waitForJobs() method must be implemented by storage adapter');
    });

    it('should throw error for cleanup()', async () => {
      await expect(adapter.cleanup('test')).rejects.toThrow('cleanup() method must be implemented by storage adapter');
    });

    it('should throw error for getType()', () => {
      expect(() => adapter.getType()).toThrow('getType() method must be implemented by storage adapter');
    });
  });

  describe('implemented methods', () => {
    it('should return correct ready status', () => {
      expect(adapter.isReady()).toBe(false);
      adapter.isConnected = true;
      expect(adapter.isReady()).toBe(true);
    });

    it('should return health status', async () => {
      // This should fail because getType() is not implemented
      await expect(adapter.getHealthStatus()).rejects.toThrow('getType() method must be implemented by storage adapter');
    });
  });
}); 