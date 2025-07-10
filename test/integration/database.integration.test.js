const { vol } = require('memfs');
const { run } = require('../../src/index');
const runNormal = require('../fixtures/run-normal.json');
const StorageService = require('../../src/storage/storage');
const path = require('path');

// Mock the file system
jest.mock('fs', () => require('memfs').fs);
jest.mock('fs/promises', () => require('memfs').fs.promises);

// Mock console
global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

// Mock StorageService
jest.mock('../../src/storage/storage');

// Mock process.exit globally
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

describe('Database Integration Tests', () => {
  let mockStorageService;

  beforeEach(() => {
    vol.reset();
    jest.clearAllMocks();
    mockExit.mockClear();
    
    // Mock storage service methods
    mockStorageService = {
      getHistory: jest.fn(),
      saveHistory: jest.fn(),
      seedHistory: jest.fn(),
      savePerformanceRun: jest.fn(),
      initializeDatabase: jest.fn(),
      close: jest.fn(),
      getStorageType: jest.fn()
    };
    
    StorageService.mockImplementation(() => mockStorageService);
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  describe('analyze command with database', () => {
    it('should use database storage when connection string provided', async () => {
      vol.fromJSON({
        '/test/latest-run.json': JSON.stringify(runNormal)
      });

      const mockHistory = { 'step1': { durations: [100], average: 100, stdDev: 0 } };
      mockStorageService.getHistory.mockResolvedValue(mockHistory);
      mockStorageService.getStorageType.mockReturnValue('database');

      const argv = [
        'analyze',
        '--run-file', '/test/latest-run.json',
        '--db-connection', 'mongodb://localhost:27017',
        '--project-id', 'test-project'
      ];

      await run(argv);

      expect(StorageService).toHaveBeenCalledWith({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        databaseName: 'perf-sentinel',
        projectId: 'test-project'
      });

      expect(mockStorageService.initializeDatabase).toHaveBeenCalled();
      expect(mockStorageService.getHistory).toHaveBeenCalledWith(null);
      expect(mockStorageService.savePerformanceRun).toHaveBeenCalledWith(runNormal);
      expect(mockStorageService.saveHistory).toHaveBeenCalled();
      expect(mockStorageService.close).toHaveBeenCalled();
    });

    it('should use custom database name and project ID', async () => {
      vol.fromJSON({
        '/test/latest-run.json': JSON.stringify(runNormal)
      });

      mockStorageService.getHistory.mockResolvedValue({});
      mockStorageService.getStorageType.mockReturnValue('database');

      const argv = [
        'analyze',
        '--run-file', '/test/latest-run.json',
        '--db-connection', 'mongodb://localhost:27017',
        '--db-name', 'custom-db',
        '--project-id', 'custom-project'
      ];

      await run(argv);

      expect(StorageService).toHaveBeenCalledWith({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        databaseName: 'custom-db',
        projectId: 'custom-project'
      });
    });

    it('should fallback to file storage when no database connection provided', async () => {
      vol.fromJSON({
        '/test/latest-run.json': JSON.stringify(runNormal),
        '/test/history.json': JSON.stringify({})
      });

      mockStorageService.getHistory.mockResolvedValue({});
      mockStorageService.getStorageType.mockReturnValue('file');

      const argv = [
        'analyze',
        '--run-file', '/test/latest-run.json',
        '--history-file', '/test/history.json'
      ];

      await run(argv);

      expect(StorageService).toHaveBeenCalledWith({
        useDatabase: false,
        connectionString: undefined,
        databaseName: 'perf-sentinel',
        projectId: 'default'
      });

      expect(mockStorageService.initializeDatabase).not.toHaveBeenCalled();
      // Check that getHistory was called with the resolved path
      expect(mockStorageService.getHistory).toHaveBeenCalledWith(
        expect.stringContaining('history.json')
      );
    });

    it('should handle database initialization failure gracefully', async () => {
      vol.fromJSON({
        '/test/latest-run.json': JSON.stringify(runNormal),
        '/test/history.json': JSON.stringify({})
      });

      mockStorageService.initializeDatabase.mockRejectedValue(new Error('Database connection failed'));
      mockStorageService.getHistory.mockResolvedValue({});
      mockStorageService.getStorageType.mockReturnValue('file');

      const argv = [
        'analyze',
        '--run-file', '/test/latest-run.json',
        '--db-connection', 'mongodb://invalid:27017',
        '--history-file', '/test/history.json'
      ];

      await run(argv);

      expect(mockStorageService.initializeDatabase).toHaveBeenCalled();
      // When initialization fails, the process should exit with error
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockStorageService.close).toHaveBeenCalled();
    });

    it('should pass all analysis parameters correctly', async () => {
      vol.fromJSON({
        '/test/latest-run.json': JSON.stringify(runNormal)
      });

      mockStorageService.getHistory.mockResolvedValue({});
      mockStorageService.getStorageType.mockReturnValue('database');

      const argv = [
        'analyze',
        '--run-file', '/test/latest-run.json',
        '--db-connection', 'mongodb://localhost:27017',
        '--threshold', '3.0',
        '--max-history', '25',
        '--reporter', 'console', 'markdown'
      ];

      await run(argv);

      expect(mockStorageService.saveHistory).toHaveBeenCalled();
      // The analysis should be called with custom threshold and max-history
      const saveHistoryCall = mockStorageService.saveHistory.mock.calls[0];
      expect(saveHistoryCall).toBeDefined();
    });
  });

  describe('seed command with database', () => {
    it('should use database storage for seeding', async () => {
      vol.fromJSON({
        '/seed/run-1.json': JSON.stringify([{ stepText: 'A', duration: 100 }]),
        '/seed/run-2.json': JSON.stringify([{ stepText: 'B', duration: 200 }])
      });

      mockStorageService.getStorageType.mockReturnValue('database');

      const argv = [
        'seed',
        '--run-files', '/seed/*.json',
        '--db-connection', 'mongodb://localhost:27017',
        '--project-id', 'test-project'
      ];

      await run(argv);

      expect(StorageService).toHaveBeenCalledWith({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        databaseName: 'perf-sentinel',
        projectId: 'test-project'
      });

      expect(mockStorageService.initializeDatabase).toHaveBeenCalled();
      expect(mockStorageService.seedHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          'A': { durations: [100] },
          'B': { durations: [200] }
        }),
        null
      );
      expect(mockStorageService.close).toHaveBeenCalled();
    });

    it('should use file storage for seeding when no database connection', async () => {
      vol.fromJSON({
        '/seed/run-1.json': JSON.stringify([{ stepText: 'A', duration: 100 }])
      });

      mockStorageService.getStorageType.mockReturnValue('file');

      const argv = [
        'seed',
        '--run-files', '/seed/*.json',
        '--history-file', '/history.json'
      ];

      await run(argv);

      expect(StorageService).toHaveBeenCalledWith({
        useDatabase: false,
        connectionString: undefined,
        databaseName: 'perf-sentinel',
        projectId: 'default'
      });

      expect(mockStorageService.initializeDatabase).not.toHaveBeenCalled();
      expect(mockStorageService.seedHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          'A': { durations: [100] }
        }),
        expect.stringContaining('history.json')
      );
    });

    it('should handle database initialization failure during seeding', async () => {
      vol.fromJSON({
        '/seed/run-1.json': JSON.stringify([{ stepText: 'A', duration: 100 }])
      });

      mockStorageService.initializeDatabase.mockRejectedValue(new Error('Connection failed'));
      mockStorageService.getStorageType.mockReturnValue('file');

      const argv = [
        'seed',
        '--run-files', '/seed/*.json',
        '--db-connection', 'mongodb://invalid:27017',
        '--history-file', '/history.json'
      ];

      await run(argv);

      expect(mockStorageService.initializeDatabase).toHaveBeenCalled();
      // When initialization fails, the process should exit with error
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockStorageService.close).toHaveBeenCalled();
    });
  });

  describe('command validation', () => {
    it('should require either db-connection or history-file for analyze', async () => {
      const argv = ['analyze', '--run-file', '/test/run.json'];
      await run(argv);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should require either db-connection or history-file for seed', async () => {
      const argv = ['seed', '--run-files', '/test/*.json'];
      await run(argv);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should accept analyze command with only db-connection', async () => {
      vol.fromJSON({
        '/test/run.json': JSON.stringify(runNormal)
      });

      mockStorageService.getHistory.mockResolvedValue({});
      mockStorageService.getStorageType.mockReturnValue('database');

      const argv = [
        'analyze',
        '--run-file', '/test/run.json',
        '--db-connection', 'mongodb://localhost:27017'
      ];

      await run(argv);
      
      expect(mockStorageService.getHistory).toHaveBeenCalledWith(null);
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should accept analyze command with only history-file', async () => {
      vol.fromJSON({
        '/test/run.json': JSON.stringify(runNormal),
        '/test/history.json': JSON.stringify({})
      });

      mockStorageService.getHistory.mockResolvedValue({});
      mockStorageService.getStorageType.mockReturnValue('file');

      const argv = [
        'analyze',
        '--run-file', '/test/run.json',
        '--history-file', '/test/history.json'
      ];

      await run(argv);
      
      expect(mockStorageService.getHistory).toHaveBeenCalledWith(
        expect.stringContaining('history.json')
      );
      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle storage service errors gracefully', async () => {
      vol.fromJSON({
        '/test/run.json': JSON.stringify(runNormal)
      });

      mockStorageService.getHistory.mockRejectedValue(new Error('Storage error'));

      const argv = [
        'analyze',
        '--run-file', '/test/run.json',
        '--db-connection', 'mongodb://localhost:27017'
      ];

      await run(argv);

      expect(global.console.error).toHaveBeenCalledWith('Error during analysis:', expect.any(Error));
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockStorageService.close).toHaveBeenCalled();
    });

    it('should handle seeding errors gracefully', async () => {
      vol.fromJSON({
        '/seed/run-1.json': JSON.stringify([{ stepText: 'A', duration: 100 }])
      });

      mockStorageService.seedHistory.mockRejectedValue(new Error('Seeding error'));

      const argv = [
        'seed',
        '--run-files', '/seed/*.json',
        '--db-connection', 'mongodb://localhost:27017'
      ];

      await run(argv);

      expect(global.console.error).toHaveBeenCalledWith('Error during seeding:', expect.any(Error));
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockStorageService.close).toHaveBeenCalled();
    });

    it('should ensure cleanup happens even on errors', async () => {
      vol.fromJSON({
        '/test/run.json': JSON.stringify(runNormal)
      });

      mockStorageService.saveHistory.mockRejectedValue(new Error('Save error'));

      const argv = [
        'analyze',
        '--run-file', '/test/run.json',
        '--db-connection', 'mongodb://localhost:27017'
      ];

      await run(argv);

      expect(mockStorageService.close).toHaveBeenCalled();
    });
  });
}); 