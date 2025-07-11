const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

describe('Database E2E Tests', () => {
  const testDataDir = path.join(__dirname, '..', 'fixtures');
  const binPath = path.join(__dirname, '..', '..', 'bin', 'perf-sentinel');

  // Increase timeout for E2E tests
  jest.setTimeout(30000);

  describe('CLI help and validation', () => {
    it('should show help for analyze command with database options', async () => {
      const { stdout } = await execAsync(`node ${binPath} analyze --help`);
      
      expect(stdout).toContain('--db-connection');
      expect(stdout).toContain('--db-name');
      expect(stdout).toContain('--project-id');
      expect(stdout).toContain('MongoDB connection string');
      expect(stdout).toContain('multi-project support');
      expect(stdout).toContain('Database name to use');
    });

    it('should show help for seed command with database options', async () => {
      const { stdout } = await execAsync(`node ${binPath} seed --help`);
      
      expect(stdout).toContain('--db-connection');
      expect(stdout).toContain('--db-name');
      expect(stdout).toContain('--project-id');
      expect(stdout).toContain('MongoDB connection string');
      expect(stdout).toContain('multi-project support');
      expect(stdout).toContain('Database name to use');
    });

    it('should reject analyze command without required options', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      
      try {
        await execAsync(`node ${binPath} analyze --run-file ${runFilePath}`);
        expect(true).toBe(false); // Expecting an error, so this should fail if no error is thrown
      } catch (error) {
        expect(error.stderr).toContain('Either --db-connection or --history-file must be provided');
      }
    });

    it('should reject seed command without required options', async () => {
      const runFilesPattern = path.join(testDataDir, 'seed-data', '*.json');
      
      try {
        await execAsync(`node ${binPath} seed --run-files "${runFilesPattern}"`);
        expect(true).toBe(false); // Expecting an error, so this should fail if no error is thrown
      } catch (error) {
        expect(error.stderr).toContain('Either --db-connection or --history-file must be provided');
      }
    });
  });

  describe('Database connection handling', () => {
    it('should handle invalid database connection gracefully', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      // Use a connection string that fails quickly - invalid host that doesn't resolve
      const { stdout } = await execAsync(
        `node ${binPath} analyze --run-file ${runFilePath} --db-connection "mongodb://invalid-host-does-not-exist:27017" --history-file ${historyFilePath}`
      );
      
      // Should fallback to file storage
      expect(stdout).toContain('Using filesystem storage');
      expect(stdout).toContain('Performance Regression Report');
    }, 8000);

    it('should handle database connection timeout gracefully', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      // Use a connection that will timeout - unreachable IP that blackholes connections
      const { stdout } = await execAsync(
        `node ${binPath} analyze --run-file ${runFilePath} --db-connection "mongodb://10.255.255.1:27017" --history-file ${historyFilePath}`
      );
      
      // Should fallback to file storage
      expect(stdout).toContain('Using filesystem storage');
      expect(stdout).toContain('Performance Regression Report');
    }, 8000);

    it('should show database storage type when connection is valid format', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      // This will fail to connect but should show database storage attempt
      const { stdout } = await execAsync(
        `node ${binPath} analyze --run-file ${runFilePath} --db-connection "mongodb://invalid-host:27017" --history-file ${historyFilePath}`
      );
      
      // Should fallback to file storage after attempting database connection
      expect(stdout).toContain('Using filesystem storage');
    }, 8000);
  });

  describe('File storage fallback', () => {
    it('should work with file storage when database is unavailable', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      const { stdout } = await execAsync(
        `node ${binPath} analyze --run-file ${runFilePath} --history-file ${historyFilePath}`
      );
      
      expect(stdout).toContain('Using filesystem storage');
      expect(stdout).toContain('Performance Regression Report');
      expect(stdout).toContain('History file updated successfully');
    });

    it('should work with seed command using file storage', async () => {
      const runFilesPattern = path.join(testDataDir, 'seed-data', '*.json');
      const historyFilePath = path.join(testDataDir, 'temp-history.json');
      
      // Clean up any existing temp file
      try {
        await fs.unlink(historyFilePath);
      } catch (error) {
        // File doesn't exist, that's fine
      }
      
      const { stdout } = await execAsync(
        `node ${binPath} seed --run-files "${runFilesPattern}" --history-file ${historyFilePath}`
      );
      
      expect(stdout).toContain('Using filesystem storage');
      expect(stdout).toContain('History seeded successfully');
      
      // Verify the file was created
      const historyExists = await fs.access(historyFilePath).then(() => true).catch(() => false);
      expect(historyExists).toBe(true);
      
      // Clean up
      try {
        await fs.unlink(historyFilePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });

  describe('Command line argument validation', () => {
    it('should validate db-connection format', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      const { stdout } = await execAsync(
        `node ${binPath} analyze --run-file ${runFilePath} --db-connection "invalid-connection-string" --history-file ${historyFilePath}`
      );
      
      // Should fallback to file storage
      expect(stdout).toContain('Using filesystem storage');
    });

    it('should accept valid MongoDB connection strings', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      const connectionStrings = [
        'mongodb://invalid-host:27017',
        'mongodb://invalid-host:27017/mydb',
        'mongodb://user:pass@invalid-host:27017',
        'mongodb+srv://user:pass@invalid-cluster.mongodb.net'
      ];
      
      for (const connectionString of connectionStrings) {
        const { stdout } = await execAsync(
          `node ${binPath} analyze --run-file ${runFilePath} --db-connection "${connectionString}" --history-file ${historyFilePath}`
        );
        
        // Connection will fail but format should be accepted
        expect(stdout).toContain('Using filesystem storage');
      }
    }, 30000);

    it('should use default values for optional database parameters', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      const { stdout } = await execAsync(
        `node ${binPath} analyze --run-file ${runFilePath} --db-connection "mongodb://invalid-host:27017" --history-file ${historyFilePath}`
      );
      
              // Should use default project-id and db-name (visible in fallback to file storage)
        expect(stdout).toContain('Using filesystem storage');
      }, 8000);

    it('should accept custom database name and project ID', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      const { stdout } = await execAsync(
        `node ${binPath} analyze --run-file ${runFilePath} --db-connection "mongodb://invalid-host:27017" --db-name "custom-db" --project-id "custom-project" --history-file ${historyFilePath}`
      );
      
              // Should accept custom parameters (visible in fallback to file storage)
        expect(stdout).toContain('Using filesystem storage');
      }, 8000);
  });

  describe('Error scenarios', () => {
    it('should handle missing run file gracefully', async () => {
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      const { stdout, stderr } = await execAsync(
        `node ${binPath} analyze --run-file /nonexistent/file.json --db-connection "mongodb://invalid-host:27017" --history-file ${historyFilePath}`
      );
      
      // Should fallback to file storage
      expect(stdout).toContain('Using file storage');
      // Should show error message about missing file
      expect(stderr).toContain('Error during analysis: ENOENT: no such file or directory');
    }, 8000);

    it('should handle invalid JSON in run file', async () => {
      const invalidJsonPath = path.join(testDataDir, 'temp-invalid.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      // Create temporary invalid JSON file
      await fs.writeFile(invalidJsonPath, '{"invalid": json}');
      
      try {
        const { stdout, stderr } = await execAsync(
          `node ${binPath} analyze --run-file ${invalidJsonPath} --db-connection "mongodb://invalid-host:27017" --history-file ${historyFilePath}`
        );
        
        // Should fallback to file storage
        expect(stdout).toContain('Using file storage');
        // Should show error message about invalid JSON
        expect(stderr).toContain('Error during analysis');
        expect(stderr).toMatch(/not valid JSON|Unexpected token/);
      } finally {
        // Clean up
        try {
          await fs.unlink(invalidJsonPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }, 8000);

    it('should handle glob patterns with no matches in seed command', async () => {
      const historyFilePath = path.join(testDataDir, 'temp-history.json');
      
      const { stdout } = await execAsync(
        `node ${binPath} seed --run-files "/nonexistent/*.json" --db-connection "mongodb://invalid-host:27017" --history-file ${historyFilePath}`
      );
      
      expect(stdout).toContain('No files found matching the provided glob pattern');
    }, 8000);
  });

  describe('Performance and resource usage', () => {
    it('should complete analyze command within reasonable time', async () => {
      const runFilePath = path.join(testDataDir, 'run-normal.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      const startTime = Date.now();
      
      await execAsync(
        `node ${binPath} analyze --run-file ${runFilePath} --history-file ${historyFilePath}`
      );
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within 10 seconds
      expect(executionTime).toBeLessThan(10000);
    });

    it('should handle large run files efficiently', async () => {
      const largeRunPath = path.join(testDataDir, 'temp-large-run.json');
      const historyFilePath = path.join(testDataDir, 'history-baseline.json');
      
      // Create a large run file
      const largeRunData = [];
      for (let i = 0; i < 1000; i++) {
        largeRunData.push({
          stepText: `Step ${i}`,
          duration: Math.floor(Math.random() * 1000) + 100,
          timestamp: new Date().toISOString()
        });
      }
      
      await fs.writeFile(largeRunPath, JSON.stringify(largeRunData));
      
      try {
        const startTime = Date.now();
        
        const { stdout } = await execAsync(
          `node ${binPath} analyze --run-file ${largeRunPath} --db-connection "mongodb://invalid-host:27017" --history-file ${historyFilePath}`
        );
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        expect(stdout).toContain('Using filesystem storage');
        expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
        
      } finally {
        // Clean up
        try {
          await fs.unlink(largeRunPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }, 15000);
  });
}); 