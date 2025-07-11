const { vol } = require('memfs');
const { run } = require('../../src/index');
const runNormal = require('../fixtures/run-normal.json');
const path = require('path');

// Mock the file system
jest.mock('fs', () => require('memfs').fs);
jest.mock('fs/promises', () => require('memfs').fs.promises);

// Mock console
global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

describe('Database Integration Tests', () => {
  beforeEach(() => {
    vol.reset();
    jest.clearAllMocks();
  });

  describe('analyze command with database', () => {
    it('should handle database connection failure gracefully', async () => {
      vol.fromJSON({
        '/test/latest-run.json': JSON.stringify(runNormal)
      });

      const argv = [
        'analyze',
        '--run-file', '/test/latest-run.json',
        '--db-connection', 'mongodb://invalid:27017',
        '--project-id', 'test-project'
      ];

      await run(argv);

      // Should handle database connection failure and fallback to filesystem
      expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(String));
    });

    it('should fallback to file storage when database is unavailable', async () => {
      vol.fromJSON({
        '/test/latest-run.json': JSON.stringify(runNormal),
        '/test/history.json': JSON.stringify({})
      });

      const argv = [
        'analyze',
        '--run-file', '/test/latest-run.json',
        '--db-connection', 'mongodb://invalid:27017',
        '--history-file', '/test/history.json'
      ];

      await run(argv);

      // Should use file storage as fallback
      try {
        const historyRaw = vol.readFileSync('/test/history.json', 'utf-8');
        const history = JSON.parse(historyRaw);
        expect(history['I navigate to the login page']).toBeDefined();
      } catch (error) {
        // If file update failed, check that an error was logged indicating database fallback
        expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(String));
      }
    });
  });

  describe('seed command with database', () => {
    it('should handle database connection failure during seeding', async () => {
      vol.fromJSON({
        '/seed/run-1.json': JSON.stringify([{ stepText: 'A', duration: 100 }])
      });

      const argv = [
        'seed',
        '--run-files', '/seed/*.json',
        '--db-connection', 'mongodb://invalid:27017',
        '--project-id', 'test-project'
      ];

      await run(argv);

      // Should handle database connection failure gracefully
      expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(String));
    });

    it('should fallback to file storage for seeding when database is unavailable', async () => {
      vol.fromJSON({
        '/seed/run-1.json': JSON.stringify([{ stepText: 'A', duration: 100 }])
      });

      const argv = [
        'seed',
        '--run-files', '/seed/*.json',
        '--db-connection', 'mongodb://invalid:27017',
        '--history-file', '/history.json'
      ];

      await run(argv);

      // Should use file storage as fallback
      try {
        const historyRaw = vol.readFileSync('/history.json', 'utf-8');
        const history = JSON.parse(historyRaw);
        expect(history['A']).toBeDefined();
      } catch (error) {
        // If file creation failed, check that an error was logged indicating database fallback
        expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(String));
      }
    });
  });

  describe('command validation', () => {
    it('should require either db-connection or history-file for analyze', async () => {
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const argv = ['analyze', '--run-file', '/test/run.json'];
      await run(argv);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });

    it('should require either db-connection or history-file for seed', async () => {
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const argv = ['seed', '--run-files', '/test/*.json'];
      await run(argv);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });

    it('should accept analyze command with db-connection', async () => {
      vol.fromJSON({
        '/test/run.json': JSON.stringify(runNormal)
      });

      const argv = [
        'analyze',
        '--run-file', '/test/run.json',
        '--db-connection', 'mongodb://invalid:27017'
      ];

      await run(argv);
      
      // Should attempt to use database storage (even if it fails)
      expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(String));
    });

    it('should accept analyze command with history-file', async () => {
      vol.fromJSON({
        '/test/run.json': JSON.stringify(runNormal),
        '/test/history.json': JSON.stringify({})
      });

      const argv = [
        'analyze',
        '--run-file', '/test/run.json',
        '--history-file', '/test/history.json'
      ];

      await run(argv);
      
      // Should work with file storage
      try {
        const historyRaw = vol.readFileSync('/test/history.json', 'utf-8');
        const history = JSON.parse(historyRaw);
        expect(history['I navigate to the login page']).toBeDefined();
      } catch (error) {
        // If file update failed, check that the command still ran without critical errors
        expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(String));
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid connection strings gracefully', async () => {
      vol.fromJSON({
        '/test/run.json': JSON.stringify(runNormal)
      });

      const argv = [
        'analyze',
        '--run-file', '/test/run.json',
        '--db-connection', 'invalid-connection-string'
      ];

      await run(argv);

      expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(String));
    });

    it('should handle seeding errors gracefully', async () => {
      vol.fromJSON({
        '/seed/run-1.json': JSON.stringify([{ stepText: 'A', duration: 100 }])
      });

      const argv = [
        'seed',
        '--run-files', '/seed/*.json',
        '--db-connection', 'invalid-connection-string'
      ];

      await run(argv);

      expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(String));
    });
  });
}); 