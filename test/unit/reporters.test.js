const consoleReporter = require('../../src/reporters/console');
const markdownReporter = require('../../src/reporters/markdown');
const htmlReporter = require('../../src/reporters/html');
const prCommentReporter = require('../../src/reporters/pr-comment');
const slackReporter = require('../../src/reporters/slack');

describe('Reporters', () => {
  let consoleOutput = '';
  const originalConsoleLog = console.log;

  beforeEach(() => {
    consoleOutput = '';
    console.log = jest.fn((message) => {
      consoleOutput += message + '\n';
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Console Reporter', () => {
    it('should correctly format a regression', () => {
      const report = {
        regressions: [{ stepText: 'A slow step', currentDuration: 200, average: 100, slowdown: 100, percentage: 100 }],
        ok: [],
        newSteps: []
      };
      consoleReporter.generateReport(report);
      expect(consoleOutput).toContain('Significant Regressions Found');
      expect(consoleOutput).toContain('A slow step');
    });

    it('should correctly format a new step', () => {
      const report = {
        regressions: [],
        ok: [],
        newSteps: [{ stepText: 'A new step', duration: 150 }]
      };
      consoleReporter.generateReport(report);
      expect(consoleOutput).toContain('New Steps');
      expect(consoleOutput).toContain('A new step');
    });

    it('should show a success message when no regressions are found', () => {
      const report = {
        regressions: [],
        ok: [{ stepText: 'A good step', duration: 100 }],
        newSteps: []
      };
      consoleReporter.generateReport(report);
      expect(consoleOutput).toContain('All steps are within the expected performance threshold');
    });

    it('should show the ok count if there are also regressions', () => {
      const mixedReport = {
        regressions: [{ stepText: 'A slow step', currentDuration: 200, average: 100, slowdown: 100, percentage: 100 }],
        ok: [{ stepText: 'A good step', duration: 100 }],
        newSteps: []
      };
      consoleReporter.generateReport(mixedReport);
      expect(consoleOutput).toContain('Significant Regressions Found');
      expect(consoleOutput).toContain('1 steps passed performance checks');
    });
  });

  describe('Markdown Reporter', () => {
    it('should generate a markdown table for regressions', () => {
      const report = {
        regressions: [{ stepText: 'A slow step', currentDuration: 200, average: 100, slowdown: 100, percentage: 100 }],
        ok: [],
        newSteps: []
      };
      markdownReporter.generateReport(report);
      expect(consoleOutput).toContain('| A slow step |');
      expect(consoleOutput).toContain('| :--- |');
    });

    it('should generate a success message if there are no regressions', () => {
      const reportWithNoRegressions = {
        regressions: [],
        ok: [{ stepText: 'A good step', duration: 100 }],
        newSteps: []
      };
      markdownReporter.generateReport(reportWithNoRegressions);
      expect(consoleOutput).toContain('## ✅ No Significant Issues Found');
    });
  });

  describe('Placeholder Reporters', () => {
    it('should log a "not implemented" message for the html reporter', () => {
      htmlReporter.generateReport({});
      expect(consoleOutput).toContain('HTML reporter is not yet implemented');
    });

    it('should log a "not implemented" message for the pr-comment reporter', () => {
      prCommentReporter.generateReport({});
      expect(consoleOutput).toContain('PR Comment reporter is not yet implemented');
    });

    it('should log a "not implemented" message for the slack reporter', () => {
      slackReporter.generateReport({});
      expect(consoleOutput).toContain('Slack reporter is not yet implemented');
    });
  });
}); 