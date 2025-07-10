const { MongoClient } = require('mongodb');

class DatabaseService {
  constructor(connectionString, databaseName = 'perf-sentinel') {
    this.connectionString = connectionString;
    this.databaseName = databaseName;
    this.client = null;
    this.db = null;
  }

  async connect() {
    if (this.client) return this.db;

    try {
      // Configure connection options for faster timeouts
      const clientOptions = {
        connectTimeoutMS: 3000,      // 3 second connection timeout
        serverSelectionTimeoutMS: 3000,  // 3 second server selection timeout  
        socketTimeoutMS: 5000,       // 5 second socket timeout
        maxPoolSize: 10,             // Maintain up to 10 socket connections
        retryWrites: true,           // Enable retry for write operations
        w: 'majority'                // Write concern
      };

      this.client = new MongoClient(this.connectionString, clientOptions);
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      console.log(`Connected to MongoDB database: ${this.databaseName}`);
      return this.db;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('Disconnected from MongoDB');
    }
  }

  async getHistory(projectId = 'default') {
    if (!this.db) await this.connect();
    
    try {
      const collection = this.db.collection('performance_history');
      const document = await collection.findOne({ projectId });
      
      if (!document) {
        return {};
      }

      return document.history || {};
    } catch (error) {
      console.error('Error retrieving history from database:', error);
      throw error;
    }
  }

  async saveHistory(history, projectId = 'default') {
    if (!this.db) await this.connect();
    
    try {
      const collection = this.db.collection('performance_history');
      
      await collection.replaceOne(
        { projectId },
        { 
          projectId,
          history,
          lastUpdated: new Date()
        },
        { upsert: true }
      );
      
      console.log(`History saved to database for project: ${projectId}`);
    } catch (error) {
      console.error('Error saving history to database:', error);
      throw error;
    }
  }

  async seedHistory(aggregatedData, projectId = 'default') {
    if (!this.db) await this.connect();
    
    try {
      const collection = this.db.collection('performance_history');
      
      await collection.replaceOne(
        { projectId },
        { 
          projectId,
          history: aggregatedData,
          lastUpdated: new Date(),
          seedDate: new Date()
        },
        { upsert: true }
      );
      
      console.log(`History seeded to database for project: ${projectId}`);
    } catch (error) {
      console.error('Error seeding history to database:', error);
      throw error;
    }
  }

  async getPerformanceRuns(projectId = 'default', limit = 100) {
    if (!this.db) await this.connect();
    
    try {
      const collection = this.db.collection('performance_runs');
      const runs = await collection
        .find({ projectId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      return runs;
    } catch (error) {
      console.error('Error retrieving performance runs from database:', error);
      throw error;
    }
  }

  async savePerformanceRun(runData, projectId = 'default') {
    if (!this.db) await this.connect();
    
    try {
      const collection = this.db.collection('performance_runs');
      
      await collection.insertOne({
        projectId,
        runData,
        timestamp: new Date()
      });
      
      console.log(`Performance run saved to database for project: ${projectId}`);
    } catch (error) {
      console.error('Error saving performance run to database:', error);
      throw error;
    }
  }

  async createIndexes() {
    if (!this.db) await this.connect();
    
    try {
      const historyCollection = this.db.collection('performance_history');
      const runsCollection = this.db.collection('performance_runs');
      
      await historyCollection.createIndex({ projectId: 1 });
      await runsCollection.createIndex({ projectId: 1, timestamp: -1 });
      
      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating database indexes:', error);
      throw error;
    }
  }
}

module.exports = DatabaseService; 