const StorageService = require('../../src/storage/storage');
const DatabaseService = require('../../src/storage/database');
const { vol } = require('memfs');
const fs = require('fs').promises;

// Mock the database service
jest.mock('../../src/storage/database');

// Mock the file system
jest.mock('fs', () => require('memfs').fs);
jest.mock('fs/promises', () => require('memfs').fs.promises);

// Mock console
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('StorageService', () => {
  let storageService;
  let mockDbService;

  beforeEach(() => {
    vol.reset();
    jest.clearAllMocks();
    
    // Mock database service methods
    mockDbService = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      getHistory: jest.fn(),
      saveHistory: jest.fn(),
      seedHistory: jest.fn(),
      savePerformanceRun: jest.fn(),
      createIndexes: jest.fn()
    };
    
    DatabaseService.mockImplementation(() => mockDbService);
  });

  describe('constructor', () => {
    it('should initialize with file storage by default', () => {
      storageService = new StorageService();
      
      expect(storageService.useDatabase).toBe(false);
      expect(storageService.dbService).toBeNull();
      expect(storageService.projectId).toBe('default');
      expect(storageService.databaseName).toBe('perf-sentinel');
    });

    it('should initialize with database storage when connection string provided', () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        databaseName: 'test-db',
        projectId: 'test-project'
      });
      
      expect(storageService.useDatabase).toBe(true);
      expect(storageService.dbService).toBe(mockDbService);
      expect(storageService.projectId).toBe('test-project');
      expect(storageService.databaseName).toBe('test-db');
      expect(DatabaseService).toHaveBeenCalledWith('mongodb://localhost:27017', 'test-db');
    });

    it('should not create database service if useDatabase is false', () => {
      storageService = new StorageService({
        useDatabase: false,
        connectionString: 'mongodb://localhost:27017'
      });
      
      expect(storageService.useDatabase).toBe(false);
      expect(storageService.dbService).toBeNull();
    });

    it('should not create database service if no connection string', () => {
      storageService = new StorageService({
        useDatabase: true
      });
      
      expect(storageService.useDatabase).toBe(true);
      expect(storageService.dbService).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should get history from database when available', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        projectId: 'test-project'
      });

      const mockHistory = { 'step1': { durations: [100, 200], average: 150, stdDev: 50 } };
      mockDbService.getHistory.mockResolvedValue(mockHistory);

      const result = await storageService.getHistory();
      
      expect(mockDbService.getHistory).toHaveBeenCalledWith('test-project');
      expect(result).toEqual(mockHistory);
    });

    it('should fallback to file storage if database fails', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        projectId: 'test-project'
      });

      const mockHistory = { 'step1': { durations: [100], average: 100, stdDev: 0 } };
      mockDbService.getHistory.mockRejectedValue(new Error('Database error'));
      
      vol.fromJSON({
        '/history.json': JSON.stringify(mockHistory)
      });

      const result = await storageService.getHistory('/history.json');
      
      expect(mockDbService.getHistory).toHaveBeenCalled();
      expect(global.console.warn).toHaveBeenCalledWith(
        'Database operation failed, falling back to file storage:',
        'Database error'
      );
      expect(result).toEqual(mockHistory);
      expect(storageService.useDatabase).toBe(false);
    });

    it('should return empty object if file does not exist', async () => {
      storageService = new StorageService();

      const result = await storageService.getHistory('/nonexistent.json');
      
      expect(result).toEqual({});
    });

    it('should return empty object if no history file path provided', async () => {
      storageService = new StorageService();

      const result = await storageService.getHistory();
      
      expect(result).toEqual({});
    });

    it('should throw error for other file system errors', async () => {
      storageService = new StorageService();
      
      const readFileSpy = jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('Permission denied'));

      await expect(storageService.getHistory('/history.json')).rejects.toThrow('Permission denied');
      
      readFileSpy.mockRestore();
    });
  });

  describe('saveHistory', () => {
    it('should save history to database when available', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        projectId: 'test-project'
      });

      const history = { 'step1': { durations: [100], average: 100, stdDev: 0 } };
      mockDbService.saveHistory.mockResolvedValue();

      await storageService.saveHistory(history);
      
      expect(mockDbService.saveHistory).toHaveBeenCalledWith(history, 'test-project');
    });

    it('should fallback to file storage if database fails', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        projectId: 'test-project'
      });

      const history = { 'step1': { durations: [100], average: 100, stdDev: 0 } };
      mockDbService.saveHistory.mockRejectedValue(new Error('Database error'));

      await storageService.saveHistory(history, '/history.json');
      
      expect(mockDbService.saveHistory).toHaveBeenCalled();
      expect(global.console.warn).toHaveBeenCalledWith(
        'Database operation failed, falling back to file storage:',
        'Database error'
      );
      
      const savedData = JSON.parse(vol.readFileSync('/history.json', 'utf-8'));
      expect(savedData).toEqual(history);
      expect(storageService.useDatabase).toBe(false);
    });

    it('should save to file storage when no database service', async () => {
      storageService = new StorageService();

      const history = { 'step1': { durations: [100], average: 100, stdDev: 0 } };

      await storageService.saveHistory(history, '/history.json');
      
      const savedData = JSON.parse(vol.readFileSync('/history.json', 'utf-8'));
      expect(savedData).toEqual(history);
    });

    it('should do nothing if no database service and no file path', async () => {
      storageService = new StorageService();

      const history = { 'step1': { durations: [100], average: 100, stdDev: 0 } };

      await expect(storageService.saveHistory(history)).resolves.not.toThrow();
    });
  });

  describe('seedHistory', () => {
    it('should seed history in database when available', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        projectId: 'test-project'
      });

      const aggregatedData = { 'step1': { durations: [100, 200] } };
      mockDbService.seedHistory.mockResolvedValue();

      await storageService.seedHistory(aggregatedData);
      
      expect(mockDbService.seedHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          'step1': expect.objectContaining({
            durations: [100, 200],
            average: 150,
            stdDev: expect.any(Number)
          })
        }),
        'test-project'
      );
    });

    it('should fallback to file storage if database fails', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        projectId: 'test-project'
      });

      const aggregatedData = { 'step1': { durations: [100, 200] } };
      mockDbService.seedHistory.mockRejectedValue(new Error('Database error'));

      await storageService.seedHistory(aggregatedData, '/history.json');
      
      expect(mockDbService.seedHistory).toHaveBeenCalled();
      expect(global.console.warn).toHaveBeenCalledWith(
        'Database operation failed, falling back to file storage:',
        'Database error'
      );
      
      const savedData = JSON.parse(vol.readFileSync('/history.json', 'utf-8'));
      expect(savedData).toEqual(expect.objectContaining({
        'step1': expect.objectContaining({
          durations: [100, 200],
          average: 150,
          stdDev: expect.any(Number)
        })
      }));
    });

    it('should seed to file storage when no database service', async () => {
      storageService = new StorageService();

      const aggregatedData = { 'step1': { durations: [100, 200] } };

      await storageService.seedHistory(aggregatedData, '/history.json');
      
      const savedData = JSON.parse(vol.readFileSync('/history.json', 'utf-8'));
      expect(savedData).toEqual(expect.objectContaining({
        'step1': expect.objectContaining({
          durations: [100, 200],
          average: 150,
          stdDev: expect.any(Number)
        })
      }));
    });
  });

  describe('savePerformanceRun', () => {
    it('should save performance run to database when available', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        projectId: 'test-project'
      });

      const runData = [{ stepText: 'step1', duration: 100 }];
      mockDbService.savePerformanceRun.mockResolvedValue();

      await storageService.savePerformanceRun(runData);
      
      expect(mockDbService.savePerformanceRun).toHaveBeenCalledWith(runData, 'test-project');
    });

    it('should continue if database save fails', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017',
        projectId: 'test-project'
      });

      const runData = [{ stepText: 'step1', duration: 100 }];
      mockDbService.savePerformanceRun.mockRejectedValue(new Error('Database error'));

      await expect(storageService.savePerformanceRun(runData)).resolves.not.toThrow();
      expect(global.console.warn).toHaveBeenCalledWith(
        'Failed to save performance run to database:',
        'Database error'
      );
    });

    it('should do nothing if no database service', async () => {
      storageService = new StorageService();

      const runData = [{ stepText: 'step1', duration: 100 }];

      await expect(storageService.savePerformanceRun(runData)).resolves.not.toThrow();
    });
  });

  describe('initializeDatabase', () => {
    it('should initialize database successfully', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017'
      });

      mockDbService.connect.mockResolvedValue();
      mockDbService.createIndexes.mockResolvedValue();

      await storageService.initializeDatabase();
      
      expect(mockDbService.connect).toHaveBeenCalled();
      expect(mockDbService.createIndexes).toHaveBeenCalled();
      expect(global.console.log).toHaveBeenCalledWith('Database initialized successfully');
    });

    it('should handle initialization failure', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017'
      });

      mockDbService.connect.mockRejectedValue(new Error('Connection failed'));

      await storageService.initializeDatabase();
      
      expect(global.console.warn).toHaveBeenCalledWith(
        'Database initialization failed:',
        'Connection failed'
      );
      expect(storageService.useDatabase).toBe(false);
    });

    it('should do nothing if no database service', async () => {
      storageService = new StorageService();

      await expect(storageService.initializeDatabase()).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017'
      });

      mockDbService.disconnect.mockResolvedValue();

      await storageService.close();
      
      expect(mockDbService.disconnect).toHaveBeenCalled();
    });

    it('should do nothing if no database service', async () => {
      storageService = new StorageService();

      await expect(storageService.close()).resolves.not.toThrow();
    });
  });

  describe('getStorageType', () => {
    it('should return "database" when using database storage', () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017'
      });

      expect(storageService.getStorageType()).toBe('database');
    });

    it('should return "file" when using file storage', () => {
      storageService = new StorageService();

      expect(storageService.getStorageType()).toBe('file');
    });

    it('should return "file" when database is disabled after failure', () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017'
      });

      storageService.useDatabase = false;

      expect(storageService.getStorageType()).toBe('file');
    });

    it('should return "file" when database service is null', () => {
      storageService = new StorageService({
        useDatabase: true,
        connectionString: 'mongodb://localhost:27017'
      });

      storageService.dbService = null;

      expect(storageService.getStorageType()).toBe('file');
    });
  });
}); 