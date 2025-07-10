const consoleReporter = require('../../src/reporters/console');
const markdownReporter = require('../../src/reporters/markdown');
const htmlReporter = require('../../src/reporters/html');
const prCommentReporter = require('../../src/reporters/pr-comment');
const slackReporter = require('../../src/reporters/slack');

// Mock console to capture output
let consoleOutput;
const mockedConsoleLog = (output) => { consoleOutput += output + '\n'; };
global.console = { log: mockedConsoleLog, error: mockedConsoleLog, warn: mockedConsoleLog, info: mockedConsoleLog };

describe('Reporters', () => {
  beforeEach(() => {
    consoleOutput = '';
  });

  const reportWithRegressions = {
    regressions: [{ stepText: 'A slow step', currentDuration: 200, average: 100, stdDev: 10 }],
    newSteps: [],
    ok: [],
  };

  const reportWithNewSteps = {
    regressions: [],
    newSteps: [{ stepText: 'A new step', duration: 50 }],
    ok: [],
  };

  const reportWithNoRegressions = {
    regressions: [],
    newSteps: [],
    ok: [{ stepText: 'An ok step', duration: 120 }],
  };

  describe('Console Reporter', () => {
    it('should correctly format a regression', () => {
      consoleReporter.generateReport(reportWithRegressions);
      expect(consoleOutput).toContain('Regressions Found');
      expect(consoleOutput).toContain('A slow step');
    });

    it('should correctly format a new step', () => {
      consoleReporter.generateReport(reportWithNewSteps);
      expect(consoleOutput).toContain('New Steps');
      expect(consoleOutput).toContain('A new step');
    });
    
    it('should show a success message when no regressions are found', () => {
      consoleReporter.generateReport(reportWithNoRegressions);
      expect(consoleOutput).toContain('All steps are within the expected performance threshold');
    });

    it('should show the ok count if there are also regressions', () => {
        const mixedReport = {
            regressions: [{ stepText: 'A slow step', currentDuration: 200, average: 100, stdDev: 10 }],
            newSteps: [],
            ok: [{ stepText: 'An ok step', duration: 120 }],
        };
        consoleReporter.generateReport(mixedReport);
        expect(consoleOutput).toContain('Regressions Found');
        expect(consoleOutput).toContain('1 steps passed successfully');
    });
  });

  describe('Markdown Reporter', () => {
    it('should generate a markdown table for regressions', () => {
      markdownReporter.generateReport(reportWithRegressions);
      expect(consoleOutput).toContain('| Step | Current | Average | Slowdown |');
      expect(consoleOutput).toContain('| A slow step |');
    });
    
    it('should generate a success message if there are no regressions', () => {
      markdownReporter.generateReport(reportWithNoRegressions);
      expect(consoleOutput).toContain('## ✅ No Regressions Found');
    });
  });

  describe('Placeholder Reporters', () => {
    it('should log a "not implemented" message for the html reporter', () => {
      htmlReporter.generateReport({});
      expect(consoleOutput).toContain('HTML reporter is not yet implemented.');
    });

    it('should log a "not implemented" message for the pr-comment reporter', () => {
      prCommentReporter.generateReport({});
      expect(consoleOutput).toContain('PR Comment reporter is not yet implemented.');
    });

    it('should log a "not implemented" message for the slack reporter', () => {
      slackReporter.generateReport({});
      expect(consoleOutput).toContain('Slack reporter is not yet implemented.');
    });
  });
}); 