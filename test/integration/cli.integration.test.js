const { vol } = require('memfs');
const { run } = require('../../src/index');
const historyBaseline = require('../fixtures/history-baseline.json');
const runNormal = require('../fixtures/run-normal.json');
const fs = require('fs/promises');

// Mock the file system before each test
jest.mock('fs', () => require('memfs').fs);
jest.mock('fs/promises', () => require('memfs').fs.promises);

// Mock console to prevent logs from cluttering test output
global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

describe('CLI Integration Tests (with memfs)', () => {
  beforeEach(() => {
    // Reset the virtual file system to a clean state before each test
    vol.reset();
  });

  describe('analyze command', () => {
    it('should correctly analyze a run and update the history file', async () => {
      // 1. Setup: Create mock files in the virtual file system
      vol.fromJSON({
        '/test/history.json': JSON.stringify(historyBaseline),
        '/test/latest-run.json': JSON.stringify(runNormal),
      });

      // 2. Execute: Run the CLI's main function with simulated arguments
      const argv = ['analyze', '--run-file', '/test/latest-run.json', '--history-file', '/test/history.json'];
      await run(argv);

      // 3. Assert: Read the updated history file and check its contents
      const updatedHistoryRaw = vol.readFileSync('/test/history.json', 'utf-8');
      const updatedHistory = JSON.parse(updatedHistoryRaw);

      const stepHistory = updatedHistory['I navigate to the login page'];
      expect(stepHistory.durations).toHaveLength(4);
      expect(stepHistory.durations).toContain(152);
    });

    it('should create a new history file if one does not exist', async () => {
        vol.fromJSON({
            '/test/latest-run.json': JSON.stringify(runNormal),
        });

        const argv = ['analyze', '--run-file', '/test/latest-run.json', '--history-file', '/test/new-history.json'];
        await run(argv);

        const newHistoryRaw = vol.readFileSync('/test/new-history.json', 'utf-8');
        const newHistory = JSON.parse(newHistoryRaw);
        expect(newHistory['I navigate to the login page']).toBeDefined();
        expect(newHistory['I navigate to the login page'].average).toBe(152);
    });

    it('should exit gracefully if the run-file is not found', async () => {
        const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        const argv = ['analyze', '--run-file', '/non-existent.json', '--history-file', '/history.json'];
        await run(argv);

        expect(global.console.error).toHaveBeenCalledWith(expect.stringContaining('Error during analysis:'), expect.any(Error));
        expect(processExitSpy).toHaveBeenCalledWith(1);
        processExitSpy.mockRestore();
    });

    it('should warn if a specified reporter cannot be found', async () => {
        vol.fromJSON({
            '/test/latest-run.json': JSON.stringify(runNormal),
        });
        const argv = ['analyze', '--run-file', '/test/latest-run.json', '--history-file', '/h.json', '--reporter', 'non-existent'];
        await run(argv);
        expect(global.console.warn).toHaveBeenCalledWith(expect.stringContaining('Could not load reporter: non-existent'));
    });

    it('should exit gracefully on a file-system read error', async () => {
        const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        const readFileSpy = jest.spyOn(fs, 'readFile').mockImplementation(() => Promise.reject(new Error('Read error')));

        const argv = ['analyze', '--run-file', '/test/latest-run.json', '--history-file', '/h.json'];
        await run(argv);

        expect(global.console.error).toHaveBeenCalledWith('Error during analysis:', expect.any(Error));
        expect(processExitSpy).toHaveBeenCalledWith(1);

        processExitSpy.mockRestore();
        readFileSpy.mockRestore();
    });
  });

  describe('seed command', () => {
    it('should create and populate a history file from a directory of run files', async () => {
        // 1. Setup
        vol.fromJSON({
            '/seed/run-1.json': JSON.stringify([{ stepText: 'A', duration: 100 }]),
            '/seed/run-2.json': JSON.stringify([{ stepText: 'A', duration: 120 }, { stepText: 'B', duration: 200 }]),
            '/seed/run-3.json': JSON.stringify([{ stepText: 'B', duration: 210 }]),
        });

        // 2. Execute
        const argv = ['seed', '--run-files', '/seed/*.json', '--history-file', '/history.json'];
        // The seed command isn't implemented yet, so this test will fail.
        // I am adding it now according to the test plan.
        await run(argv);

        // 3. Assert
        const historyRaw = vol.readFileSync('/history.json', 'utf-8');
        const history = JSON.parse(historyRaw);

        expect(history['A']).toBeDefined();
        expect(history['A'].durations).toEqual([100, 120]);
        expect(history['A'].average).toBe(110);

        expect(history['B']).toBeDefined();
        expect(history['B'].durations).toEqual([200, 210]);
        expect(history['B'].average).toBe(205);
    });

    it('should warn if no files match the glob pattern', async () => {
        const argv = ['seed', '--run-files', '/non-existent/*.json', '--history-file', '/h.json'];
        await run(argv);
        expect(global.console.warn).toHaveBeenCalledWith('No files found matching the provided glob pattern.');
    });

    it('should exit gracefully on a file-system write error', async () => {
        const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        const writeFileSpy = jest.spyOn(fs, 'writeFile').mockImplementation(() => Promise.reject(new Error('Write error')));

        vol.fromJSON({
            '/seed/run-1.json': JSON.stringify([{ stepText: 'A', duration: 100 }]),
        });

        const argv = ['seed', '--run-files', '/seed/*.json', '--history-file', '/history.json'];
        await run(argv);

        expect(global.console.error).toHaveBeenCalledWith('Error during seeding:', expect.any(Error));
        expect(processExitSpy).toHaveBeenCalledWith(1);

        processExitSpy.mockRestore();
        writeFileSpy.mockRestore();
    });
  });
}); 