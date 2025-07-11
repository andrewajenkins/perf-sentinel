const { 
  analyze, 
  calculateAverage, 
  calculateStdDev, 
  calculateTrend, 
  shouldReportRegression,
  validateAndNormalizeContext,
  extractStepData,
  calculateSuiteHealthScore,
  detectSuiteRegression,
  categorizeSuitePerformance
} = require('../../src/analysis/engine');
const ConfigLoader = require('../../src/config/config-loader');
const historyBaseline = require('../fixtures/history-baseline.json');
const runNormal = require('../fixtures/run-normal.json');
const runWithRegression = require('../fixtures/run-with-regression.json');
const runWithNewStep = require('../fixtures/run-with-new-step.json');

describe('Analysis Engine', () => {
  let configLoader;
  let defaultConfig;

  beforeAll(async () => {
    configLoader = new ConfigLoader();
    defaultConfig = await configLoader.load({});
  });

  // Helper function to create step config for testing
  function createStepConfig(threshold = 2.0, rules = {}) {
    const defaultRules = {
      min_absolute_slowdown: 15,
      min_percentage_change: 3,
      check_trends: false,
      filter_stable_steps: true,
      stable_threshold: 2,
      stable_min_slowdown: 5
    };
    
    return {
      threshold,
      rules: { ...defaultRules, ...rules }
    };
  }

  // Helper function to create trend config for testing
  function createTrendConfig(config = {}) {
    return {
      window_size: 3,
      min_significance: 10,
      min_history_required: 6,
      enabled: true,
      only_upward: true,
      ...config
    };
  }

  // Helper function to create enhanced run data with context
  function createContextualStep(stepText, duration, context = {}) {
    return {
      stepText,
      duration,
      timestamp: new Date().toISOString(),
      context: {
        testFile: 'test.feature',
        testName: 'Test Scenario',
        suite: 'test-suite',
        tags: ['@test'],
        jobId: 'job-123',
        workerId: 'worker-1',
        ...context
      }
    };
  }

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

  describe('Context Validation and Extraction', () => {
    it('should validate and normalize valid context', () => {
      const validContext = {
        testFile: 'auth/login.feature',
        testName: 'User Login',
        suite: 'authentication',
        tags: ['@auth', '@critical'],
        jobId: 'job-123',
        workerId: 'worker-1'
      };
      
      const result = validateAndNormalizeContext(validContext);
      expect(result).toEqual(validContext);
    });

    it('should provide defaults for missing context', () => {
      const invalidContext = null;
      const result = validateAndNormalizeContext(invalidContext);
      
      expect(result).toEqual({
        testFile: 'unknown.feature',
        testName: 'Unknown Test',
        suite: 'unknown',
        tags: [],
        jobId: 'local',
        workerId: 'local'
      });
    });

    it('should handle partial context with defaults', () => {
      const partialContext = {
        testFile: 'test.feature',
        suite: 'api'
      };
      
      const result = validateAndNormalizeContext(partialContext);
      expect(result.testFile).toBe('test.feature');
      expect(result.suite).toBe('api');
      expect(result.testName).toBe('Unknown Test');
      expect(result.tags).toEqual([]);
      expect(result.jobId).toBe('local');
      expect(result.workerId).toBe('local');
    });

    it('should extract step data with context validation', () => {
      const step = createContextualStep('I log in', 150, {
        suite: 'authentication',
        tags: ['@auth', '@critical']
      });
      
      const result = extractStepData(step);
      expect(result.stepText).toBe('I log in');
      expect(result.duration).toBe(150);
      expect(result.context.suite).toBe('authentication');
      expect(result.context.tags).toEqual(['@auth', '@critical']);
    });
  });

  describe('Suite Health Scoring', () => {
    it('should calculate perfect health score for suite with no issues', () => {
      const goodSuiteData = {
        suite: 'authentication',
        totalSteps: 10,
        regressions: 0,
        newSteps: 0,
        avgDuration: 150,
        tags: ['@auth']
      };
      
      const score = calculateSuiteHealthScore(goodSuiteData);
      expect(score).toBe(100);
    });

    it('should penalize suites with high regression rate', () => {
      const regressedSuiteData = {
        suite: 'problematic',
        totalSteps: 10,
        regressions: 5, // 50% regression rate
        newSteps: 0,
        avgDuration: 150,
        tags: ['@api']
      };
      
      const score = calculateSuiteHealthScore(regressedSuiteData);
      expect(score).toBeLessThan(80); // Should be penalized
    });

    it('should penalize suites with many new steps (instability)', () => {
      const unstableSuiteData = {
        suite: 'unstable',
        totalSteps: 10,
        regressions: 0,
        newSteps: 3, // 30% new steps
        avgDuration: 150,
        tags: ['@api']
      };
      
      const score = calculateSuiteHealthScore(unstableSuiteData);
      expect(score).toBeLessThan(90); // Should be penalized for instability
    });

    it('should heavily penalize critical suites with regressions', () => {
      const criticalSuiteData = {
        suite: 'authentication',
        totalSteps: 10,
        regressions: 2,
        newSteps: 0,
        avgDuration: 150,
        tags: ['@critical', '@auth']
      };
      
      const score = calculateSuiteHealthScore(criticalSuiteData);
      expect(score).toBeLessThan(85); // Should be heavily penalized
    });
  });

  describe('Suite Regression Detection', () => {
    it('should detect suite-level regression', () => {
      const suiteData = {
        suite: 'api',
        avgDuration: 500
      };
      
      const suiteHistory = {
        avgDurationHistory: [300, 310, 305, 320, 315]
      };
      
      const suiteConfig = { threshold: 2.0 };
      
      const regression = detectSuiteRegression(suiteData, suiteHistory, suiteConfig);
      expect(regression).toBeTruthy();
      expect(regression.type).toBe('suite_regression');
      expect(regression.suite).toBe('api');
      expect(regression.currentAvg).toBe(500);
    });

    it('should not detect regression with insufficient history', () => {
      const suiteData = {
        suite: 'api',
        avgDuration: 500
      };
      
      const suiteHistory = {
        avgDurationHistory: [300] // Not enough history
      };
      
      const suiteConfig = { threshold: 2.0 };
      
      const regression = detectSuiteRegression(suiteData, suiteHistory, suiteConfig);
      expect(regression).toBeNull();
    });
  });

  describe('Suite Performance Categorization', () => {
    it('should categorize good performance suite', () => {
      const goodSuiteData = {
        suite: 'authentication',
        regressions: 0,
        totalSteps: 10,
        healthScore: 95,
        tags: ['@auth'],
        testFiles: ['auth/login.feature', 'auth/register.feature'],
        avgDuration: 150
      };
      
      const category = categorizeSuitePerformance(goodSuiteData, {});
      expect(category.category).toBe('good');
      expect(category.severity).toBe('low');
    });

    it('should categorize critical performance suite', () => {
      const criticalSuiteData = {
        suite: 'payment',
        regressions: 4,
        totalSteps: 10, // 40% regression rate
        healthScore: 30,
        tags: ['@payment', '@critical'],
        testFiles: ['payment/checkout.feature', 'payment/billing.feature'],
        avgDuration: 800
      };
      
      const category = categorizeSuitePerformance(criticalSuiteData, {});
      expect(category.category).toBe('critical');
      expect(category.severity).toBe('high');
      expect(category.recommendations).toContain('Investigate 4 regressed step(s) in this suite');
    });

    it('should categorize warning performance suite', () => {
      const warningSuiteData = {
        suite: 'api',
        regressions: 2,
        totalSteps: 10, // 20% regression rate
        healthScore: 65,
        tags: ['@api'],
        testFiles: ['api/users.feature', 'api/products.feature'],
        avgDuration: 300
      };
      
      const category = categorizeSuitePerformance(warningSuiteData, {});
      expect(category.category).toBe('warning');
      expect(category.severity).toBe('medium');
    });
  });

  describe('Trend Detection', () => {
    it('should detect upward trend in durations', () => {
      const durations = [100, 102, 101, 115, 118, 120]; // Recent 3 avg: 117.7, older 3 avg: 101
      const trendConfig = createTrendConfig();
      const { trend, isSignificant } = calculateTrend(durations, trendConfig);
      expect(trend).toBeCloseTo(16.7, 1);
      expect(isSignificant).toBe(true);
    });

    it('should not detect trend with insufficient data', () => {
      const durations = [100, 102, 101];
      const trendConfig = createTrendConfig();
      const { trend, isSignificant } = calculateTrend(durations, trendConfig);
      expect(trend).toBe(0);
      expect(isSignificant).toBe(false);
    });

    it('should not flag small trends as significant', () => {
      const durations = [100, 102, 101, 105, 104, 106]; // Small trend
      const trendConfig = createTrendConfig();
      const { trend, isSignificant } = calculateTrend(durations, trendConfig);
      expect(isSignificant).toBe(false);
    });

    it('should use custom window size from config', () => {
      const durations = [100, 102, 101, 115, 118, 120, 125, 130];
      const trendConfig = createTrendConfig({ window_size: 4 });
      const { trend, isSignificant } = calculateTrend(durations, trendConfig);
      // Recent window: [120, 125, 130, 118] = avg 123.25
      // Older window: [115, 101, 102, 100] = avg 104.5  
      // Trend = 123.25 - 104.5 = 18.75
      expect(trend).toBeCloseTo(18.75, 1);
      expect(isSignificant).toBe(true);
    });
  });

  describe('Regression Filtering Logic', () => {
    it('should filter out small percentage changes', () => {
      const historyEntry = { durations: [200, 202, 201, 203, 202] };
      const stepConfig = createStepConfig(2.0, { min_percentage_change: 3, min_absolute_slowdown: 5 });
      const trendConfig = createTrendConfig();
      const shouldReport = shouldReportRegression(206, 202, 2, historyEntry, stepConfig, trendConfig); // 2% slowdown
      expect(shouldReport).toBe(false);
    });

    it('should report significant percentage changes', () => {
      const historyEntry = { durations: [200, 202, 201, 203, 202] };
      const stepConfig = createStepConfig(2.0, { min_percentage_change: 3, min_absolute_slowdown: 5 });
      const trendConfig = createTrendConfig();
      const shouldReport = shouldReportRegression(220, 202, 2, historyEntry, stepConfig, trendConfig); // 8.9% slowdown
      expect(shouldReport).toBe(true);
    });

    it('should filter out small absolute slowdowns', () => {
      const historyEntry = { durations: [30, 32, 31, 33, 32] };
      const stepConfig = createStepConfig(2.0, { min_percentage_change: 3, min_absolute_slowdown: 15 });
      const trendConfig = createTrendConfig();
      const shouldReport = shouldReportRegression(45, 32, 2, historyEntry, stepConfig, trendConfig); // 13ms slowdown
      expect(shouldReport).toBe(false);
    });

    it('should report significant absolute slowdowns', () => {
      const historyEntry = { durations: [30, 32, 31, 33, 32] };
      const stepConfig = createStepConfig(2.0, { min_percentage_change: 3, min_absolute_slowdown: 15 });
      const trendConfig = createTrendConfig();
      const shouldReport = shouldReportRegression(50, 32, 2, historyEntry, stepConfig, trendConfig); // 18ms slowdown
      expect(shouldReport).toBe(true);
    });

    it('should require cumulative drift when trend checking is enabled', () => {
      const historyEntry = { durations: [50, 52, 51, 53, 52, 54] }; // No significant trend
      const stepConfig = createStepConfig(2.0, { 
        min_percentage_change: 3, 
        min_absolute_slowdown: 5, 
        check_trends: true,
        trend_sensitivity: 20
      });
      const trendConfig = createTrendConfig();
      const shouldReport = shouldReportRegression(65, 52, 2, historyEntry, stepConfig, trendConfig); // 13ms slowdown but no trend
      expect(shouldReport).toBe(false);
    });

    it('should report steps with significant cumulative drift', () => {
      const historyEntry = { durations: [50, 52, 51, 95, 98, 100] }; // Significant upward trend
      const stepConfig = createStepConfig(2.0, { 
        min_percentage_change: 3, 
        min_absolute_slowdown: 5, 
        check_trends: true,
        trend_sensitivity: 20
      });
      const trendConfig = createTrendConfig();
      const shouldReport = shouldReportRegression(110, 74.3, 2, historyEntry, stepConfig, trendConfig);
      expect(shouldReport).toBe(true);
    });

    it('should filter out noise on very stable steps', () => {
      const historyEntry = { durations: [500, 502, 501, 503, 502] };
      const stepConfig = createStepConfig(1.0, { 
        min_percentage_change: 3, 
        min_absolute_slowdown: 5,
        filter_stable_steps: true,
        stable_threshold: 2,
        stable_min_slowdown: 5
      });
      const trendConfig = createTrendConfig();
      const shouldReport = shouldReportRegression(505, 502, 1, historyEntry, stepConfig, trendConfig); // Only 3ms slowdown, very stable
      expect(shouldReport).toBe(false);
    });

    it('should respect custom step configuration rules', () => {
      const historyEntry = { durations: [100, 102, 101, 103, 102] };
      const stepConfig = createStepConfig(1.0, { // Lower threshold to trigger basic regression
        min_percentage_change: 1, // Very strict percentage 
        min_absolute_slowdown: 2, // Very strict absolute
        filter_stable_steps: false // Disable stable step filtering for this test
      });
      const trendConfig = createTrendConfig();
      const shouldReport = shouldReportRegression(105, 102, 1, historyEntry, stepConfig, trendConfig); // 3ms slowdown, ~3%
      expect(shouldReport).toBe(true);
    });
  });

  describe('Enhanced Analysis with Context', () => {
    const contextualRunData = [
      createContextualStep('I log in', 150, {
        suite: 'authentication',
        tags: ['@auth', '@critical'],
        testFile: 'auth/login.feature',
        testName: 'User Login'
      }),
      createContextualStep('I view dashboard', 300, {
        suite: 'dashboard',
        tags: ['@dashboard', '@smoke'],
        testFile: 'dashboard/view.feature',
        testName: 'Dashboard View'
      }),
      createContextualStep('I search products', 450, {
        suite: 'search',
        tags: ['@search', '@slow'],
        testFile: 'search/products.feature',
        testName: 'Product Search'
      }),
      createContextualStep('I add to cart', 200, {
        suite: 'shopping',
        tags: ['@shopping', '@critical'],
        testFile: 'shopping/cart.feature',
        testName: 'Add to Cart'
      })
    ];

    const contextualHistory = {
      'I log in': {
        durations: [145, 150, 148],
        average: 147.7,
        stdDev: 2.5,
        context: { suite: 'authentication', tags: ['@auth', '@critical'] }
      },
      'I view dashboard': {
        durations: [295, 300, 305],
        average: 300,
        stdDev: 5,
        context: { suite: 'dashboard', tags: ['@dashboard', '@smoke'] }
      },
      'I search products': {
        durations: [400, 420, 410],
        average: 410,
        stdDev: 10,
        context: { suite: 'search', tags: ['@search', '@slow'] }
      }
    };

    it('should analyze with rich context data', () => {
      const { report } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      expect(report.metadata.totalSteps).toBe(4);
      expect(report.metadata.suites).toContain('authentication');
      expect(report.metadata.suites).toContain('dashboard');
      expect(report.metadata.suites).toContain('search');
      expect(report.metadata.suites).toContain('shopping');
      expect(report.metadata.tags).toContain('@critical');
      expect(report.metadata.tags).toContain('@smoke');
      expect(report.metadata.tags).toContain('@slow');
    });

    it('should provide suite-level analysis', () => {
      const { report } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      expect(report.suites).toBeDefined();
      expect(report.suites['authentication']).toBeDefined();
      expect(report.suites['authentication'].totalSteps).toBe(1);
      expect(report.suites['authentication'].avgDuration).toBe(150);
      expect(report.suites['authentication'].healthScore).toBeDefined();
      expect(report.suites['authentication'].category).toBeDefined();
      expect(report.suites['authentication'].tags).toContain('@auth');
      expect(report.suites['authentication'].tags).toContain('@critical');
    });

    it('should track suite statistics correctly', () => {
      const { report } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      const authSuite = report.suites['authentication'];
      expect(authSuite.criticalSteps).toBe(1);
      expect(authSuite.testFiles).toContain('auth/login.feature');
      expect(authSuite.minDuration).toBe(150);
      expect(authSuite.maxDuration).toBe(150);
    });

    it('should provide tag-based analysis', () => {
      const { report } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      expect(report.tagAnalysis).toBeDefined();
      expect(report.tagAnalysis['@critical']).toBeDefined();
      expect(report.tagAnalysis['@critical'].stepCount).toBe(2);
      expect(report.tagAnalysis['@critical'].suites).toContain('authentication');
      expect(report.tagAnalysis['@critical'].suites).toContain('shopping');
    });

    it('should provide critical path analysis', () => {
      const { report } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      expect(report.criticalPath).toBeDefined();
      expect(report.criticalPath.overallSeverity).toBeDefined();
      expect(report.criticalPath.totalIssues).toBeDefined();
      expect(report.criticalPath.issues).toBeDefined();
    });

    it('should generate system-wide recommendations', () => {
      const { report } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should calculate overall system health', () => {
      const { report } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      expect(report.metadata.overallHealth).toBeDefined();
      expect(report.metadata.overallHealth).toBeGreaterThanOrEqual(0);
      expect(report.metadata.overallHealth).toBeLessThanOrEqual(100);
    });

    it('should detect suite-level regressions', () => {
      const { report } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      expect(report.suiteRegressions).toBeDefined();
      expect(Array.isArray(report.suiteRegressions)).toBe(true);
    });

    it('should preserve context in updated history', () => {
      const { updatedHistory } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      expect(updatedHistory['I log in'].context).toBeDefined();
      expect(updatedHistory['I log in'].context.suite).toBe('authentication');
      expect(updatedHistory['I log in'].context.tags).toContain('@auth');
      expect(updatedHistory['I log in'].context.tags).toContain('@critical');
    });

    it('should update suite history', () => {
      const { updatedHistory } = analyze(contextualRunData, contextualHistory, defaultConfig, configLoader);
      
      expect(updatedHistory._suiteHistory).toBeDefined();
      expect(updatedHistory._suiteHistory['authentication']).toBeDefined();
      expect(updatedHistory._suiteHistory['authentication'].avgDurationHistory).toBeDefined();
      expect(updatedHistory._suiteHistory['authentication'].avgDurationHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Main Analysis Logic', () => {
    it('should report no regressions for a normal run', () => {
      const { report } = analyze(runNormal, historyBaseline, defaultConfig, configLoader);
      expect(report.regressions).toHaveLength(0);
      expect(report.ok).toHaveLength(2);
    });

    it('should correctly identify a regression', () => {
      const { report } = analyze(runWithRegression, historyBaseline, defaultConfig, configLoader);
      expect(report.regressions).toHaveLength(1);
      expect(report.regressions[0].stepText).toBe('I log in as a standard user');
      expect(report.ok).toHaveLength(1);
    });

    it('should not flag a regression if the threshold is increased', async () => {
      const lenientConfig = await configLoader.load({
        cliOverrides: { threshold: 20.0 }
      });
      const { report } = analyze(runWithRegression, historyBaseline, lenientConfig, configLoader);
      expect(report.regressions).toHaveLength(0);
    });

    it('should correctly identify a new step', () => {
      const { report } = analyze(runWithNewStep, historyBaseline, defaultConfig, configLoader);
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
      
      const { updatedHistory } = analyze(simpleRun, simpleBaseline, defaultConfig, configLoader);
      const stepHistory = updatedHistory['I navigate to the login page'];
      
      expect(stepHistory.durations).toHaveLength(4);
      expect(stepHistory.durations).toContain(152);
      expect(stepHistory.average).toBeCloseTo(151.25);
    });
    
    it('should create a new history file if one does not exist', () => {
      const { report, updatedHistory } = analyze(runNormal, {}, defaultConfig, configLoader);
      expect(report.newSteps).toHaveLength(2);
      expect(updatedHistory['I navigate to the login page'].average).toBe(152);
    });

    it('should trim the history to the max length', async () => {
        const longHistory = {
            "A step": {
                durations: Array(50).fill(100),
                average: 100,
                stdDev: 0
            }
        };
        const newRun = [{"stepText": "A step", "duration": 110}];
        const config = await configLoader.load({
          cliOverrides: { maxHistory: 50 }
        });
        const { updatedHistory } = analyze(newRun, longHistory, config, configLoader);
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
      const { report } = analyze(newRun, driftHistory, defaultConfig, configLoader);
      
      expect(report.trends).toHaveLength(1);
      expect(report.trends[0].stepText).toBe("Slow drifting step");
      expect(report.trends[0].trend).toBeGreaterThan(10);
    });

    it('should respect trend configuration', async () => {
      const noTrendConfig = await configLoader.load({
        cliOverrides: { 
          // We'll disable trends via a custom config structure if needed
        }
      });
      // Update the config to disable trends
      noTrendConfig.analysis.trends.enabled = false;
      
      const driftHistory = {
        "Slow drifting step": {
          durations: [100, 102, 104, 118, 120, 122],
          average: 111,
          stdDev: 10
        }
      };
      const newRun = [{"stepText": "Slow drifting step", "duration": 115}];
      const { report } = analyze(newRun, driftHistory, noTrendConfig, configLoader);
      
      expect(report.trends).toHaveLength(0);
    });

    it('should include slowdown and percentage in regression reports', () => {
      const { report } = analyze(runWithRegression, historyBaseline, defaultConfig, configLoader);
      expect(report.regressions).toHaveLength(1);
      expect(report.regressions[0]).toHaveProperty('slowdown');
      expect(report.regressions[0]).toHaveProperty('percentage');
      expect(report.regressions[0].slowdown).toBeGreaterThan(0);
      expect(report.regressions[0].percentage).toBeGreaterThan(0);
    });

    it('should apply step-specific overrides', async () => {
      const customConfig = await configLoader.load({});
      customConfig.analysis.step_overrides = {
        'I log in as a standard user': {
          threshold: 1.0, // Very strict threshold
          rules: {
            min_absolute_slowdown: 5,
            min_percentage_change: 1
          }
        }
      };
      
      const { report } = analyze(runWithRegression, historyBaseline, customConfig, configLoader);
      expect(report.regressions).toHaveLength(1);
      expect(report.regressions[0].stepText).toBe('I log in as a standard user');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle legacy run data without context', () => {
      const legacyRun = [
        { stepText: 'I navigate to the login page', duration: 152, timestamp: '2023-01-01T00:00:00.000Z' },
        { stepText: 'I log in as a standard user', duration: 545, timestamp: '2023-01-01T00:00:01.000Z' }
      ];
      
      const { report } = analyze(legacyRun, historyBaseline, defaultConfig, configLoader);
      expect(report.regressions).toHaveLength(0);
      expect(report.ok).toHaveLength(2);
      
      // Should create default context
      expect(report.metadata.suites).toContain('unknown');
      expect(report.suites['unknown']).toBeDefined();
    });

    it('should handle legacy history without context', () => {
      const legacyHistory = {
        'I navigate to the login page': {
          durations: [150, 155, 148],
          average: 151,
          stdDev: 3.6
        }
      };
      
      const contextualRun = [createContextualStep('I navigate to the login page', 152)];
      
      const { updatedHistory } = analyze(contextualRun, legacyHistory, defaultConfig, configLoader);
      expect(updatedHistory['I navigate to the login page'].context).toBeDefined();
    });
  });
}); 