const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const cliPath = path.resolve(__dirname, '../../bin/perf-sentinel');
const fixturesDir = path.resolve(__dirname, '../fixtures');
const tempDir = path.resolve(__dirname, '../temp-e2e');

function runCLI(args) {
    return new Promise((resolve) => {
        exec(`node ${cliPath} ${args}`, (error, stdout, stderr) => {
            resolve({
                code: error ? error.code : 0,
                error,
                stdout,
                stderr,
            });
        });
    });
}

describe('E2E Tests for perf-sentinel CLI', () => {
    beforeEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
        await fs.mkdir(tempDir, { recursive: true });
    });

    afterAll(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should run successfully and report no regressions (happy path)', async () => {
        const runFilePath = path.join(tempDir, 'run-normal.json');
        const historyFilePath = path.join(tempDir, 'history.json');
        await fs.copyFile(path.join(fixturesDir, 'run-normal.json'), runFilePath);
        await fs.copyFile(path.join(fixturesDir, 'history-baseline.json'), historyFilePath);

        const { stdout, code } = await runCLI(`analyze --run-file ${runFilePath} --history-file ${historyFilePath}`);
        
        expect(code).toBe(0);
        expect(stdout).toContain('All steps are within the expected performance threshold');
    });

    it('should correctly report a regression', async () => {
        const runFilePath = path.join(tempDir, 'run-with-regression.json');
        const historyFilePath = path.join(tempDir, 'history.json');
        await fs.copyFile(path.join(fixturesDir, 'run-with-regression.json'), runFilePath);
        await fs.copyFile(path.join(fixturesDir, 'history-baseline.json'), historyFilePath);

        const { stdout, code } = await runCLI(`analyze --run-file ${runFilePath} --history-file ${historyFilePath}`);
        
        expect(code).toBe(0);
        expect(stdout).toContain('Regressions Found');
        expect(stdout).toContain('I log in as a standard user');
    });

    it('should generate both console and markdown reports', async () => {
        const runFilePath = path.join(tempDir, 'run-with-regression.json');
        const historyFilePath = path.join(tempDir, 'history.json');
        await fs.copyFile(path.join(fixturesDir, 'run-with-regression.json'), runFilePath);
        await fs.copyFile(path.join(fixturesDir, 'history-baseline.json'), historyFilePath);

        const { stdout, code } = await runCLI(`analyze --run-file ${runFilePath} --history-file ${historyFilePath} --reporter console --reporter markdown`);

        expect(code).toBe(0);
        // Check for console output
        expect(stdout).toContain('Performance Regression Report');
        // Check for markdown output
        expect(stdout).toContain('| Step | Current | Average | Slowdown |');
    });

    it('should run the seed command successfully', async () => {
        const historyFilePath = path.join(tempDir, 'new-history.json');
        const seedFixtures = path.join(fixturesDir, 'seed-data', '*.json');
        
        const { stdout, code } = await runCLI(`seed --run-files "${seedFixtures}" --history-file ${historyFilePath}`);

        expect(code).toBe(0);
        expect(stdout).toContain('History seeded successfully');
        
        const historyRaw = await fs.readFile(historyFilePath, 'utf-8');
        const history = JSON.parse(historyRaw);
        expect(history['I checkout my cart']).toBeDefined();
        expect(history['I checkout my cart'].average).toBe(410);
    });
}); 