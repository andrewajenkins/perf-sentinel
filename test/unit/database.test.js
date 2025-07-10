const DatabaseService = require('../../src/storage/database');
const { MongoClient } = require('mongodb');

// Mock MongoDB client
jest.mock('mongodb', () => ({
  MongoClient: jest.fn()
}));

// Mock console to prevent logs during tests
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('DatabaseService', () => {
  let dbService;
  let mockClient;
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock objects
    mockCollection = {
      findOne: jest.fn(),
      replaceOne: jest.fn(),
      insertOne: jest.fn(),
      find: jest.fn(),
      createIndex: jest.fn()
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };

    mockClient = {
      connect: jest.fn(),
      close: jest.fn(),
      db: jest.fn().mockReturnValue(mockDb)
    };

    MongoClient.mockImplementation(() => mockClient);
    
    dbService = new DatabaseService('mongodb://localhost:27017', 'test-db');
  });

  describe('constructor', () => {
    it('should initialize with connection string and database name', () => {
      expect(dbService.connectionString).toBe('mongodb://localhost:27017');
      expect(dbService.databaseName).toBe('test-db');
      expect(dbService.client).toBeNull();
      expect(dbService.db).toBeNull();
    });

    it('should use default database name if not provided', () => {
      const service = new DatabaseService('mongodb://localhost:27017');
      expect(service.databaseName).toBe('perf-sentinel');
    });
  });

  describe('connect', () => {
    it('should connect to MongoDB and return database instance', async () => {
      const result = await dbService.connect();
      
      expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017', {
        connectTimeoutMS: 3000,
        serverSelectionTimeoutMS: 3000,
        socketTimeoutMS: 5000,
        maxPoolSize: 10,
        retryWrites: true,
        w: 'majority'
      });
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.db).toHaveBeenCalledWith('test-db');
      expect(result).toBe(mockDb);
      expect(global.console.log).toHaveBeenCalledWith('Connected to MongoDB database: test-db');
    });

    it('should return existing database if already connected', async () => {
      // First connection
      await dbService.connect();
      jest.clearAllMocks();
      
      // Second connection attempt
      const result = await dbService.connect();
      
      expect(MongoClient).not.toHaveBeenCalled();
      expect(mockClient.connect).not.toHaveBeenCalled();
      expect(result).toBe(mockDb);
    });

    it('should throw error if connection fails', async () => {
      const connectionError = new Error('Connection failed');
      mockClient.connect.mockRejectedValue(connectionError);
      
      await expect(dbService.connect()).rejects.toThrow('Connection failed');
      expect(global.console.error).toHaveBeenCalledWith('Failed to connect to MongoDB:', connectionError);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from MongoDB', async () => {
      await dbService.connect();
      await dbService.disconnect();
      
      expect(mockClient.close).toHaveBeenCalled();
      expect(dbService.client).toBeNull();
      expect(dbService.db).toBeNull();
      expect(global.console.log).toHaveBeenCalledWith('Disconnected from MongoDB');
    });

    it('should do nothing if not connected', async () => {
      await dbService.disconnect();
      expect(mockClient.close).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    beforeEach(async () => {
      await dbService.connect();
    });

    it('should retrieve history for a project', async () => {
      const mockHistory = { 'step1': { durations: [100, 200], average: 150, stdDev: 50 } };
      mockCollection.findOne.mockResolvedValue({ 
        projectId: 'test-project', 
        history: mockHistory 
      });

      const result = await dbService.getHistory('test-project');
      
      expect(mockDb.collection).toHaveBeenCalledWith('performance_history');
      expect(mockCollection.findOne).toHaveBeenCalledWith({ projectId: 'test-project' });
      expect(result).toEqual(mockHistory);
    });

    it('should return empty object if no history found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await dbService.getHistory('non-existent-project');
      
      expect(result).toEqual({});
    });

    it('should use default project ID if not provided', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      await dbService.getHistory();
      
      expect(mockCollection.findOne).toHaveBeenCalledWith({ projectId: 'default' });
    });

    it('should throw error if database operation fails', async () => {
      const dbError = new Error('Database error');
      mockCollection.findOne.mockRejectedValue(dbError);

      await expect(dbService.getHistory()).rejects.toThrow('Database error');
      expect(global.console.error).toHaveBeenCalledWith('Error retrieving history from database:', dbError);
    });
  });

  describe('saveHistory', () => {
    beforeEach(async () => {
      await dbService.connect();
    });

    it('should save history to database', async () => {
      const history = { 'step1': { durations: [100, 200], average: 150, stdDev: 50 } };
      mockCollection.replaceOne.mockResolvedValue({ acknowledged: true });

      await dbService.saveHistory(history, 'test-project');
      
      expect(mockCollection.replaceOne).toHaveBeenCalledWith(
        { projectId: 'test-project' },
        expect.objectContaining({
          projectId: 'test-project',
          history: history,
          lastUpdated: expect.any(Date)
        }),
        { upsert: true }
      );
      expect(global.console.log).toHaveBeenCalledWith('History saved to database for project: test-project');
    });

    it('should use default project ID if not provided', async () => {
      const history = { 'step1': { durations: [100], average: 100, stdDev: 0 } };
      mockCollection.replaceOne.mockResolvedValue({ acknowledged: true });

      await dbService.saveHistory(history);
      
      expect(mockCollection.replaceOne).toHaveBeenCalledWith(
        { projectId: 'default' },
        expect.objectContaining({
          projectId: 'default',
          history: history
        }),
        { upsert: true }
      );
    });

    it('should throw error if save operation fails', async () => {
      const saveError = new Error('Save failed');
      mockCollection.replaceOne.mockRejectedValue(saveError);

      await expect(dbService.saveHistory({}, 'test-project')).rejects.toThrow('Save failed');
      expect(global.console.error).toHaveBeenCalledWith('Error saving history to database:', saveError);
    });
  });

  describe('seedHistory', () => {
    beforeEach(async () => {
      await dbService.connect();
    });

    it('should seed history with aggregated data', async () => {
      const aggregatedData = { 'step1': { durations: [100, 200], average: 150, stdDev: 50 } };
      mockCollection.replaceOne.mockResolvedValue({ acknowledged: true });

      await dbService.seedHistory(aggregatedData, 'test-project');
      
      expect(mockCollection.replaceOne).toHaveBeenCalledWith(
        { projectId: 'test-project' },
        expect.objectContaining({
          projectId: 'test-project',
          history: aggregatedData,
          lastUpdated: expect.any(Date),
          seedDate: expect.any(Date)
        }),
        { upsert: true }
      );
      expect(global.console.log).toHaveBeenCalledWith('History seeded to database for project: test-project');
    });
  });

  describe('savePerformanceRun', () => {
    beforeEach(async () => {
      await dbService.connect();
    });

    it('should save performance run data', async () => {
      const runData = [{ stepText: 'step1', duration: 100 }];
      mockCollection.insertOne.mockResolvedValue({ acknowledged: true });

      await dbService.savePerformanceRun(runData, 'test-project');
      
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        projectId: 'test-project',
        runData: runData,
        timestamp: expect.any(Date)
      });
      expect(global.console.log).toHaveBeenCalledWith('Performance run saved to database for project: test-project');
    });

    it('should use default project ID if not provided', async () => {
      const runData = [{ stepText: 'step1', duration: 100 }];
      mockCollection.insertOne.mockResolvedValue({ acknowledged: true });

      await dbService.savePerformanceRun(runData);
      
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        projectId: 'default',
        runData: runData,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('getPerformanceRuns', () => {
    beforeEach(async () => {
      await dbService.connect();
    });

    it('should retrieve performance runs with sorting and limit', async () => {
      const mockRuns = [
        { projectId: 'test-project', runData: [], timestamp: new Date() }
      ];
      
      const mockCursor = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(mockRuns)
      };
      
      mockCollection.find.mockReturnValue(mockCursor);

      const result = await dbService.getPerformanceRuns('test-project', 50);
      
      expect(mockCollection.find).toHaveBeenCalledWith({ projectId: 'test-project' });
      expect(mockCursor.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(mockCursor.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockRuns);
    });

    it('should use default parameters', async () => {
      const mockCursor = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([])
      };
      
      mockCollection.find.mockReturnValue(mockCursor);

      await dbService.getPerformanceRuns();
      
      expect(mockCollection.find).toHaveBeenCalledWith({ projectId: 'default' });
      expect(mockCursor.limit).toHaveBeenCalledWith(100);
    });
  });

  describe('createIndexes', () => {
    beforeEach(async () => {
      await dbService.connect();
    });

    it('should create indexes on both collections', async () => {
      mockCollection.createIndex.mockResolvedValue('index_created');

      await dbService.createIndexes();
      
      expect(mockDb.collection).toHaveBeenCalledWith('performance_history');
      expect(mockDb.collection).toHaveBeenCalledWith('performance_runs');
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ projectId: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ projectId: 1, timestamp: -1 });
      expect(global.console.log).toHaveBeenCalledWith('Database indexes created successfully');
    });

    it('should throw error if index creation fails', async () => {
      const indexError = new Error('Index creation failed');
      mockCollection.createIndex.mockRejectedValue(indexError);

      await expect(dbService.createIndexes()).rejects.toThrow('Index creation failed');
      expect(global.console.error).toHaveBeenCalledWith('Error creating database indexes:', indexError);
    });
  });
}); 