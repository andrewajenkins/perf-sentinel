const fs = require('fs').promises;
const path = require('path');
const DatabaseService = require('./database');
const { calculateAverage, calculateStdDev } = require('../analysis/engine');

class StorageService {
  constructor(options = {}) {
    this.useDatabase = options.useDatabase || false;
    this.connectionString = options.connectionString;
    this.databaseName = options.databaseName || 'perf-sentinel';
    this.projectId = options.projectId || 'default';
    this.dbService = null;
    
    if (this.useDatabase && this.connectionString) {
      this.dbService = new DatabaseService(this.connectionString, this.databaseName);
    }
  }

  async getHistory(historyFilePath = null) {
    if (this.dbService) {
      try {
        return await this.dbService.getHistory(this.projectId);
      } catch (error) {
        console.warn('Database operation failed, falling back to file storage:', error.message);
        // Fall back to file storage
        this.useDatabase = false;
      }
    }

    // File storage fallback
    if (!historyFilePath) {
      return {};
    }

    try {
      const historyRaw = await fs.readFile(historyFilePath, 'utf-8');
      return JSON.parse(historyRaw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  async saveHistory(history, historyFilePath = null) {
    if (this.dbService) {
      try {
        await this.dbService.saveHistory(history, this.projectId);
        return;
      } catch (error) {
        console.warn('Database operation failed, falling back to file storage:', error.message);
        // Fall back to file storage
        this.useDatabase = false;
      }
    }

    // File storage fallback
    if (historyFilePath) {
      await fs.writeFile(historyFilePath, JSON.stringify(history, null, 2));
    }
  }

  async seedHistory(aggregatedData, historyFilePath = null) {
    const newHistory = {};
    for (const stepText in aggregatedData) {
      const { durations } = aggregatedData[stepText];
      const average = calculateAverage(durations);
      const stdDev = calculateStdDev(durations, average);
      newHistory[stepText] = { durations, average, stdDev };
    }

    if (this.dbService) {
      try {
        await this.dbService.seedHistory(newHistory, this.projectId);
        return;
      } catch (error) {
        console.warn('Database operation failed, falling back to file storage:', error.message);
        // Fall back to file storage
        this.useDatabase = false;
      }
    }

    // File storage fallback
    if (historyFilePath) {
      await fs.writeFile(historyFilePath, JSON.stringify(newHistory, null, 2));
    }
  }

  async savePerformanceRun(runData) {
    if (this.dbService) {
      try {
        await this.dbService.savePerformanceRun(runData, this.projectId);
      } catch (error) {
        console.warn('Failed to save performance run to database:', error.message);
        // Continue execution - this is just for historical tracking
      }
    }
  }

  async initializeDatabase() {
    if (this.dbService) {
      try {
        await this.dbService.connect();
        await this.dbService.createIndexes();
        console.log('Database initialized successfully');
      } catch (error) {
        console.warn('Database initialization failed:', error.message);
        this.useDatabase = false;
      }
    }
  }

  async close() {
    if (this.dbService) {
      await this.dbService.disconnect();
    }
  }

  getStorageType() {
    return this.useDatabase && this.dbService ? 'database' : 'file';
  }
}

module.exports = StorageService; 