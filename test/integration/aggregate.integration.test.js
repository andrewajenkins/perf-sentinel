const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

describe('Aggregate Command Integration', () => {
  const testDir = path.join(__dirname, '../temp-aggregate-test');
  const configPath = path.join(testDir, 'test-config.yml');
  const outputPath = path.join(testDir, 'aggregated-results.json');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    await fs.mkdir(testDir, { recursive: true });

    // Create test configuration
    // Normalize path to use forward slashes for YAML compatibility
    const normalizedPath = testDir.replace(/\\/g, '/');
    const config = `
project:
  id: "aggregate-test"

storage:
  adapter_type: "filesystem"
  filesystem:
    base_directory: "${normalizedPath}/performance-results"

analysis:
  threshold: 2.0
  max_history: 50

reporting:
  default_reporters: ["console"]
`;
    await fs.writeFile(configPath, config);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('Basic aggregation functionality', () => {
    it('should show help for aggregate command', () => {
      const result = execSync('node bin/perf-sentinel aggregate --help', { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });

      expect(result).toContain('Aggregate results from multiple parallel test jobs');
      expect(result).toContain('--job-ids');
      expect(result).toContain('--wait-for-jobs');
      expect(result).toContain('--timeout');
    });

    it('should validate required options', () => {
      try {
        execSync('node bin/perf-sentinel aggregate', { 
          encoding: 'utf-8',
          stdio: 'pipe',
          cwd: process.cwd()
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.stderr).toContain('Either --config, --db-connection, --bucket-name, or --history-file must be provided');
      }
    });

    it('should aggregate results with filesystem storage', async () => {
      // Create some sample run data
      const run1 = [
        {
          stepText: 'I navigate to login page',
          duration: 100,
          timestamp: '2023-01-01T00:00:00Z',
          context: {
            suite: 'authentication',
            testFile: 'features/auth/login.feature',
            tags: ['@auth', '@critical'],
            jobId: 'job-1',
            workerId: 'worker-1'
          }
        }
      ];

      const run2 = [
        {
          stepText: 'I enter valid credentials',
          duration: 200,
          timestamp: '2023-01-01T00:00:01Z',
          context: {
            suite: 'authentication',
            testFile: 'features/auth/login.feature',
            tags: ['@auth'],
            jobId: 'job-2',
            workerId: 'worker-2'
          }
        }
      ];

      const runFile1 = path.join(testDir, 'run1.json');
      const runFile2 = path.join(testDir, 'run2.json');

      await fs.writeFile(runFile1, JSON.stringify(run1, null, 2));
      await fs.writeFile(runFile2, JSON.stringify(run2, null, 2));

      // First, analyze individual runs to populate storage
      try {
        execSync(`node bin/perf-sentinel analyze --config "${configPath}" --run-file "${runFile1}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          cwd: process.cwd()
        });
      } catch (error) {
        // May fail if no history exists, that's ok for this test
      }

      try {
        execSync(`node bin/perf-sentinel analyze --config "${configPath}" --run-file "${runFile2}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          cwd: process.cwd()
        });
      } catch (error) {
        // May fail if no history exists, that's ok for this test
      }

      // Now test aggregation
      const result = execSync(`node bin/perf-sentinel aggregate --config "${configPath}" --job-ids "job-1,job-2" --wait-for-jobs false --output-file "${outputPath}"`, {
        encoding: 'utf-8',
        cwd: process.cwd()
      });

      expect(result).toContain('Aggregating results for project: aggregate-test');
      expect(result).toContain('Using filesystem storage');
    });

    it('should handle empty job list gracefully', () => {
      const result = execSync(`node bin/perf-sentinel aggregate --config "${configPath}" --wait-for-jobs false`, {
        encoding: 'utf-8',
        cwd: process.cwd()
      });

      expect(result).toContain('Job IDs to aggregate: all available');
      expect(result).toContain('Using filesystem storage');
    });
  });

  describe('Configuration validation', () => {
    it('should work with S3 configuration', () => {
      // This should validate that S3 adapter is detected 
      const result = execSync('node bin/perf-sentinel aggregate --bucket-name "test-bucket" --wait-for-jobs false', {
        encoding: 'utf-8',
        cwd: process.cwd()
      });
      
      // Should not have argument validation error, but may have S3 connection issues
      expect(result).toContain('Aggregating results for project');
      expect(result).not.toContain('Either --config, --db-connection, --bucket-name, or --history-file must be provided');
    });

    it('should work with database configuration', () => {
      // This should validate that database adapter is detected and falls back gracefully
      const result = execSync('node bin/perf-sentinel aggregate --db-connection "mongodb://invalid:27017" --wait-for-jobs false', {
        encoding: 'utf-8',
        cwd: process.cwd()
      });
      
      // Should not have argument validation error, and should fall back to filesystem
      expect(result).toContain('Aggregating results for project');
      expect(result).toContain('Using filesystem storage');
      expect(result).not.toContain('Either --config, --db-connection, --bucket-name, or --history-file must be provided');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid job IDs gracefully', () => {
      const result = execSync(`node bin/perf-sentinel aggregate --config "${configPath}" --job-ids "nonexistent-job" --wait-for-jobs false`, {
        encoding: 'utf-8',
        cwd: process.cwd()
      });

      expect(result).toContain('Job IDs to aggregate: nonexistent-job');
      expect(result).toContain('Using filesystem storage');
      // Should complete without throwing an error
    });

    it('should validate timeout parameter', () => {
      const result = execSync(`node bin/perf-sentinel aggregate --config "${configPath}" --timeout 10 --wait-for-jobs false`, {
        encoding: 'utf-8',
        cwd: process.cwd()
      });

      expect(result).toContain('Using filesystem storage');
      // Should accept numeric timeout values
    });
  });
}); 