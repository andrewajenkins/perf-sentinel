const { analyze, calculateAverage, calculateStdDev, calculateTrend, shouldReportRegression } = require('../../src/analysis/engine');
const historyBaseline = require('../fixtures/history-baseline.json');
const runNormal = require('../fixtures/run-normal.json');
const runWithRegression = require('../fixtures/run-with-regression.json');
const runWithNewStep = require('../fixtures/run-with-new-step.json');

describe('Analysis Engine', () => {
  describe('Statistical Functions', () => {
    it('should calculate the average of a set of durations', () => {
      expect(calculateAverage([10, 20, 30])).toBe(20);
    });

    it('should return 0 for an empty set of durations', () => {
      expect(calculateAverage([])).toBe(0);
    });

    it('should calculate the standard deviation of a set of durations', () => {
      // Sample standard deviation for [150, 155, 148] is ~3.6
      expect(calculateStdDev([150, 155, 148], 151)).toBeCloseTo(3.605);
    });

     it('should return 0 for standard deviation if there are less than 2 durations', () => {
      expect(calculateStdDev([150], 150)).toBe(0);
    });
  });

  describe('Trend Detection', () => {
    it('should detect upward trend in durations', () => {
      const durations = [100, 102, 101, 115, 118, 120]; // Recent 3 avg: 117.7, older 3 avg: 101
      const { trend, isSignificant } = calculateTrend(durations);
      expect(trend).toBeCloseTo(16.7, 1);
      expect(isSignificant).toBe(true);
    });

    it('should not detect trend with insufficient data', () => {
      const durations = [100, 102, 101];
      const { trend, isSignificant } = calculateTrend(durations);
      expect(trend).toBe(0);
      expect(isSignificant).toBe(false);
    });

    it('should not flag small trends as significant', () => {
      const durations = [100, 102, 101, 105, 104, 106]; // Small trend
      const { trend, isSignificant } = calculateTrend(durations);
      expect(isSignificant).toBe(false);
    });
  });

  describe('Regression Filtering Logic', () => {
    it('should filter out small regressions on very fast steps (<50ms)', () => {
      const historyEntry = { durations: [30, 32, 31, 33, 32] };
      const shouldReport = shouldReportRegression(45, 32, 2, historyEntry); // 13ms slowdown on 32ms avg
      expect(shouldReport).toBe(false);
    });

    it('should report significant regressions on fast steps (>15ms slowdown)', () => {
      const historyEntry = { durations: [30, 32, 31, 33, 32] };
      const shouldReport = shouldReportRegression(50, 32, 2, historyEntry); // 18ms slowdown on 32ms avg
      expect(shouldReport).toBe(true);
    });

    it('should filter out very small percentage changes (<3%)', () => {
      const historyEntry = { durations: [200, 202, 201, 203, 202] };
      const shouldReport = shouldReportRegression(206, 202, 2, historyEntry); // 2% slowdown
      expect(shouldReport).toBe(false);
    });

    it('should report significant percentage changes (>3%)', () => {
      const historyEntry = { durations: [200, 202, 201, 203, 202] };
      const shouldReport = shouldReportRegression(220, 202, 2, historyEntry); // 8.9% slowdown
      expect(shouldReport).toBe(true);
    });

    it('should require cumulative drift for fast steps with long history', () => {
      const historyEntry = { durations: [50, 52, 51, 53, 52, 54] }; // No significant trend
      const shouldReport = shouldReportRegression(65, 52, 2, historyEntry); // 13ms slowdown but no trend
      expect(shouldReport).toBe(false);
    });

    it('should report fast steps with significant cumulative drift', () => {
      const historyEntry = { durations: [50, 52, 51, 95, 98, 100] }; // Significant upward trend
      const shouldReport = shouldReportRegression(110, 74.3, 2, historyEntry);
      expect(shouldReport).toBe(true);
    });

    it('should filter out noise with minimum absolute slowdown', () => {
      const historyEntry = { durations: [500, 502, 501, 503, 502] };
      const shouldReport = shouldReportRegression(505, 502, 1, historyEntry); // Only 3ms slowdown, very stable
      expect(shouldReport).toBe(false);
    });
  });

  describe('Main Analysis Logic', () => {
    it('should report no regressions for a normal run', () => {
      const { report } = analyze(runNormal, historyBaseline);
      expect(report.regressions).toHaveLength(0);
      expect(report.ok).toHaveLength(2);
    });

    it('should correctly identify a regression', () => {
      const { report } = analyze(runWithRegression, historyBaseline);
      expect(report.regressions).toHaveLength(1);
      expect(report.regressions[0].stepText).toBe('I log in as a standard user');
      expect(report.ok).toHaveLength(1);
    });

    it('should not flag a regression if the threshold is increased', () => {
      const { report } = analyze(runWithRegression, historyBaseline, 20.0); // Very high threshold
      expect(report.regressions).toHaveLength(0);
    });

    it('should correctly identify a new step', () => {
      const { report } = analyze(runWithNewStep, historyBaseline);
      expect(report.newSteps).toHaveLength(1);
      expect(report.newSteps[0].stepText).toBe('I see the product inventory page');
    });

    it('should update the history with the new run data', () => {
      // Use a simple baseline for this test
      const simpleBaseline = {
        'I navigate to the login page': {
          durations: [150, 155, 148],
          average: 151,
          stdDev: 3.6
        }
      };
      const simpleRun = [{ stepText: 'I navigate to the login page', duration: 152 }];
      
      const { updatedHistory } = analyze(simpleRun, simpleBaseline);
      const stepHistory = updatedHistory['I navigate to the login page'];
      
      expect(stepHistory.durations).toHaveLength(4);
      expect(stepHistory.durations).toContain(152);
      expect(stepHistory.average).toBeCloseTo(151.25);
    });
    
    it('should create a new history file if one does not exist', () => {
      const { report, updatedHistory } = analyze(runNormal, {});
      expect(report.newSteps).toHaveLength(2);
      expect(updatedHistory['I navigate to the login page'].average).toBe(152);
    });

    it('should trim the history to the max length', () => {
        const longHistory = {
            "A step": {
                durations: Array(50).fill(100),
                average: 100,
                stdDev: 0
            }
        };
        const newRun = [{"stepText": "A step", "duration": 110}];
        const { updatedHistory } = analyze(newRun, longHistory, 2.0, 50);
        expect(updatedHistory["A step"].durations).toHaveLength(50);
        // The first element should have been shifted out and the new one pushed in
        expect(updatedHistory["A step"].durations[49]).toBe(110);
    });

    it('should detect performance drift trends', () => {
      const driftHistory = {
        "Slow drifting step": {
          durations: [100, 102, 104, 118, 120, 122],
          average: 111,
          stdDev: 10
        }
      };
      const newRun = [{"stepText": "Slow drifting step", "duration": 115}];
      const { report } = analyze(newRun, driftHistory);
      
      expect(report.trends).toHaveLength(1);
      expect(report.trends[0].stepText).toBe("Slow drifting step");
      expect(report.trends[0].trend).toBeGreaterThan(10);
    });

    it('should include slowdown and percentage in regression reports', () => {
      const { report } = analyze(runWithRegression, historyBaseline);
      expect(report.regressions).toHaveLength(1);
      expect(report.regressions[0]).toHaveProperty('slowdown');
      expect(report.regressions[0]).toHaveProperty('percentage');
      expect(report.regressions[0].slowdown).toBeGreaterThan(0);
      expect(report.regressions[0].percentage).toBeGreaterThan(0);
    });
  });
}); 