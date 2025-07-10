const { analyze, calculateAverage, calculateStdDev } = require('../../src/analysis/engine');
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
      const { report } = analyze(runWithRegression, historyBaseline, 10.0); // High threshold
      expect(report.regressions).toHaveLength(0);
    });

    it('should correctly identify a new step', () => {
      const { report } = analyze(runWithNewStep, historyBaseline);
      expect(report.newSteps).toHaveLength(1);
      expect(report.newSteps[0].stepText).toBe('I see the product inventory page');
    });

    it('should update the history with the new run data', () => {
      const { updatedHistory } = analyze(runNormal, historyBaseline);
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
  });
}); 