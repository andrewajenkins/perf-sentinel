const fs = require('fs').promises;
const path = require('path');
const { analyze } = require('../../src/analysis/engine');
const ConfigLoader = require('../../src/config/config-loader');

describe('Enhanced Context Integration Tests', () => {
  let configLoader;
  let testConfig;
  
  beforeAll(async () => {
    configLoader = new ConfigLoader();
    
    // Load test configuration with suite and tag overrides
    testConfig = {
      analysis: {
        threshold: 2.0,
        max_history: 50,
        step_types: {
          very_fast: { max_duration: 50, rules: { min_absolute_slowdown: 15, min_percentage_change: 10 } },
          fast: { max_duration: 100, rules: { min_absolute_slowdown: 10, min_percentage_change: 10 } },
          medium: { max_duration: 500, rules: { min_absolute_slowdown: 25, min_percentage_change: 5 } },
          slow: { max_duration: null, rules: { min_absolute_slowdown: 50, min_percentage_change: 3 } }
        },
        global_rules: {
          min_percentage_change: 3,
          filter_stable_steps: true,
          stable_threshold: 2,
          stable_min_slowdown: 5
        },
        trends: { enabled: true, window_size: 3, min_significance: 10, min_history_required: 6, only_upward: true },
        step_overrides: {},
        suite_overrides: {
          authentication: {
            threshold: 1.5,
            rules: { min_percentage_change: 2, min_absolute_slowdown: 8 }
          },
          shopping: {
            threshold: 2.5,
            rules: { min_percentage_change: 6, min_absolute_slowdown: 30 }
          }
        },
        tag_overrides: {
          "@critical": {
            threshold: 1.2,
            rules: { min_percentage_change: 1, min_absolute_slowdown: 5 }
          },
          "@slow": {
            threshold: 3.0,
            rules: { min_percentage_change: 10, min_absolute_slowdown: 50 }
          }
        }
      }
    };
  });

  describe('Enhanced Cucumber Hook Integration', () => {
    it('should validate sample enhanced run data structure', async () => {
      const sampleEnhancedData = await fs.readFile(
        path.join(__dirname, '..', '..', 'examples', 'sample-enhanced-run.json'), 
        'utf-8'
      );
      
      const runData = JSON.parse(sampleEnhancedData);
      
      // Validate structure
      expect(Array.isArray(runData)).toBe(true);
      expect(runData.length).toBeGreaterThan(0);
      
      // Validate each step has required context
      runData.forEach(step => {
        expect(step).toHaveProperty('stepText');
        expect(step).toHaveProperty('duration');
        expect(step).toHaveProperty('timestamp');
        expect(step).toHaveProperty('context');
        expect(step.context).toHaveProperty('testFile');
        expect(step.context).toHaveProperty('testName');
        expect(step.context).toHaveProperty('suite');
        expect(step.context).toHaveProperty('tags');
        expect(step.context).toHaveProperty('jobId');
        expect(step.context).toHaveProperty('workerId');
        
        // Validate types
        expect(typeof step.stepText).toBe('string');
        expect(typeof step.duration).toBe('number');
        expect(typeof step.timestamp).toBe('string');
        expect(typeof step.context.testFile).toBe('string');
        expect(typeof step.context.testName).toBe('string');
        expect(typeof step.context.suite).toBe('string');
        expect(Array.isArray(step.context.tags)).toBe(true);
        expect(typeof step.context.jobId).toBe('string');
        expect(typeof step.context.workerId).toBe('string');
      });
    });

    it('should recognize different suites from sample data', async () => {
      const sampleEnhancedData = await fs.readFile(
        path.join(__dirname, '..', '..', 'examples', 'sample-enhanced-run.json'), 
        'utf-8'
      );
      
      const runData = JSON.parse(sampleEnhancedData);
      const suites = new Set(runData.map(step => step.context.suite));
      
      expect(suites.has('authentication')).toBe(true);
      expect(suites.has('shopping')).toBe(true);
    });

    it('should recognize different tags from sample data', async () => {
      const sampleEnhancedData = await fs.readFile(
        path.join(__dirname, '..', '..', 'examples', 'sample-enhanced-run.json'), 
        'utf-8'
      );
      
      const runData = JSON.parse(sampleEnhancedData);
      const allTags = new Set();
      runData.forEach(step => {
        step.context.tags.forEach(tag => allTags.add(tag));
      });
      
      expect(allTags.has('@authentication')).toBe(true);
      expect(allTags.has('@critical')).toBe(true);
      expect(allTags.has('@smoke')).toBe(true);
      expect(allTags.has('@shopping')).toBe(true);
      expect(allTags.has('@payment')).toBe(true);
    });
  });

  describe('Context-Aware Analysis Integration', () => {
    const enhancedRunData = [
      {
        stepText: "I navigate to login page",
        duration: 155, // Slight regression
        timestamp: "2024-01-15T10:00:00.000Z",
        context: {
          testFile: "auth/login.feature",
          testName: "User Login",
          suite: "authentication",
          tags: ["@authentication", "@critical"],
          jobId: "job-123",
          workerId: "worker-1"
        }
      },
      {
        stepText: "I add item to cart",
        duration: 480, // Slight increase but within shopping suite tolerance
        timestamp: "2024-01-15T10:01:00.000Z",
        context: {
          testFile: "shopping/cart.feature",
          testName: "Add to Cart",
          suite: "shopping",
          tags: ["@shopping"],
          jobId: "job-456",
          workerId: "worker-2"
        }
      },
      {
        stepText: "I process payment",
        duration: 1260, // Should trigger critical tag rules
        timestamp: "2024-01-15T10:02:00.000Z",
        context: {
          testFile: "payment/process.feature",
          testName: "Payment Processing",
          suite: "payment",
          tags: ["@payment", "@critical"],
          jobId: "job-789",
          workerId: "worker-3"
        }
      },
      {
        stepText: "I export large report",
        duration: 2100, // Should be okay due to @slow tag
        timestamp: "2024-01-15T10:03:00.000Z",
        context: {
          testFile: "reports/export.feature",
          testName: "Report Export",
          suite: "reports",
          tags: ["@reports", "@slow"],
          jobId: "job-101",
          workerId: "worker-4"
        }
      }
    ];

    const enhancedHistory = {
      "I navigate to login page": {
        durations: [145, 150, 148, 152],
        average: 148.75,
        stdDev: 2.99,
        context: { suite: "authentication", tags: ["@authentication", "@critical"] }
      },
      "I add item to cart": {
        durations: [450, 460, 455, 465],
        average: 457.5,
        stdDev: 6.45,
        context: { suite: "shopping", tags: ["@shopping"] }
      },
      "I process payment": {
        durations: [1200, 1210, 1205, 1215],
        average: 1207.5,
        stdDev: 6.45,
        context: { suite: "payment", tags: ["@payment", "@critical"] }
      },
      "I export large report": {
        durations: [2000, 2050, 2025, 2075],
        average: 2037.5,
        stdDev: 31.54,
        context: { suite: "reports", tags: ["@reports", "@slow"] }
      }
    };

    it('should apply context-aware configuration rules', () => {
      const { report } = analyze(enhancedRunData, enhancedHistory, testConfig, configLoader);
      
      // Authentication step should be flagged due to strict @critical rules
      const authRegressions = report.regressions.filter(r => r.context.suite === 'authentication');
      expect(authRegressions.length).toBeGreaterThan(0);
      
      // Shopping step should NOT be flagged due to lenient shopping suite rules
      const shoppingRegressions = report.regressions.filter(r => r.context.suite === 'shopping');
      expect(shoppingRegressions.length).toBe(0);
      
      // Payment step should be flagged due to strict @critical rules
      const paymentRegressions = report.regressions.filter(r => r.context.suite === 'payment');
      expect(paymentRegressions.length).toBeGreaterThan(0);
      
      // Report step should NOT be flagged due to lenient @slow tag rules
      const reportRegressions = report.regressions.filter(r => r.context.suite === 'reports');
      expect(reportRegressions.length).toBe(0);
    });

    it('should provide comprehensive suite analysis', () => {
      const { report } = analyze(enhancedRunData, enhancedHistory, testConfig, configLoader);
      
      expect(Object.keys(report.suites)).toHaveLength(4);
      expect(report.suites.authentication).toBeDefined();
      expect(report.suites.shopping).toBeDefined();
      expect(report.suites.payment).toBeDefined();
      expect(report.suites.reports).toBeDefined();
      
      // Check suite health scores
      expect(report.suites.authentication.healthScore).toBeDefined();
      expect(report.suites.shopping.healthScore).toBeDefined();
      expect(report.suites.payment.healthScore).toBeDefined();
      expect(report.suites.reports.healthScore).toBeDefined();
      
      // Check suite categories
      expect(report.suites.authentication.category).toBeDefined();
      expect(report.suites.shopping.category).toBeDefined();
      expect(report.suites.payment.category).toBeDefined();
      expect(report.suites.reports.category).toBeDefined();
    });

    it('should provide tag-based analysis', () => {
      const { report } = analyze(enhancedRunData, enhancedHistory, testConfig, configLoader);
      
      expect(report.tagAnalysis).toBeDefined();
      expect(report.tagAnalysis['@critical']).toBeDefined();
      expect(report.tagAnalysis['@slow']).toBeDefined();
      
      // Critical tag should span multiple suites
      expect(report.tagAnalysis['@critical'].suites.length).toBeGreaterThan(1);
      expect(report.tagAnalysis['@critical'].suites).toContain('authentication');
      expect(report.tagAnalysis['@critical'].suites).toContain('payment');
    });

    it('should provide critical path analysis', () => {
      const { report } = analyze(enhancedRunData, enhancedHistory, testConfig, configLoader);
      
      expect(report.criticalPath).toBeDefined();
      expect(report.criticalPath.totalIssues).toBeDefined();
      expect(report.criticalPath.overallSeverity).toBeDefined();
      expect(report.criticalPath.issues).toBeDefined();
      
      // Should detect critical path issues
      if (report.regressions.some(r => r.context.tags.includes('@critical'))) {
        expect(report.criticalPath.overallSeverity).not.toBe('none');
      }
    });

    it('should generate contextual recommendations', () => {
      const { report } = analyze(enhancedRunData, enhancedHistory, testConfig, configLoader);
      
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      
      // Should include suite-specific recommendations
      const suiteRecommendations = Object.values(report.suites)
        .flatMap(suite => suite.recommendations || []);
      expect(suiteRecommendations.length).toBeGreaterThan(0);
    });

    it('should calculate overall system health', () => {
      const { report } = analyze(enhancedRunData, enhancedHistory, testConfig, configLoader);
      
      expect(report.metadata.overallHealth).toBeDefined();
      expect(report.metadata.overallHealth).toBeGreaterThanOrEqual(0);
      expect(report.metadata.overallHealth).toBeLessThanOrEqual(100);
      
      // Should be based on suite health scores
      const suiteScores = Object.values(report.suites).map(suite => suite.healthScore);
      const expectedOverallHealth = Math.round(suiteScores.reduce((sum, score) => sum + score, 0) / suiteScores.length);
      expect(report.metadata.overallHealth).toBe(expectedOverallHealth);
    });

    it('should maintain context in history updates', () => {
      const { updatedHistory } = analyze(enhancedRunData, enhancedHistory, testConfig, configLoader);
      
      // Check that context is preserved and updated
      expect(updatedHistory["I navigate to login page"].context).toBeDefined();
      expect(updatedHistory["I navigate to login page"].context.suite).toBe('authentication');
      expect(updatedHistory["I navigate to login page"].context.tags).toContain('@critical');
      
      // Check suite history tracking
      expect(updatedHistory._suiteHistory).toBeDefined();
      expect(updatedHistory._suiteHistory.authentication).toBeDefined();
      expect(updatedHistory._suiteHistory.authentication.avgDurationHistory).toBeDefined();
      expect(updatedHistory._suiteHistory.authentication.regressionRateHistory).toBeDefined();
    });
  });

  describe('Hierarchical Reporting Integration', () => {
    it('should generate hierarchical console output', () => {
      const mockRunData = [
        {
          stepText: "I perform critical action",
          duration: 150,
          timestamp: "2024-01-15T10:00:00.000Z",
          context: {
            testFile: "critical/action.feature",
            testName: "Critical Action Test",
            suite: "critical",
            tags: ["@critical", "@smoke"],
            jobId: "job-123",
            workerId: "worker-1"
          }
        }
      ];

      const { report } = analyze(mockRunData, {}, testConfig, configLoader);
      
      // Verify hierarchical structure in report
      expect(report.metadata.suites).toContain('critical');
      expect(report.metadata.tags).toContain('@critical');
      expect(report.metadata.tags).toContain('@smoke');
      
      expect(report.suites.critical).toBeDefined();
      expect(report.suites.critical.totalSteps).toBe(1);
      expect(report.suites.critical.criticalSteps).toBe(1);
      expect(report.suites.critical.smokeSteps).toBe(1);
    });

    it('should support filtering by context', () => {
      const multiContextData = [
        {
          stepText: "I perform auth action",
          duration: 100,
          timestamp: "2024-01-15T10:00:00.000Z",
          context: { suite: "authentication", tags: ["@auth"], testFile: "auth.feature" }
        },
        {
          stepText: "I perform api action",
          duration: 200,
          timestamp: "2024-01-15T10:01:00.000Z",
          context: { suite: "api", tags: ["@api"], testFile: "api.feature" }
        },
        {
          stepText: "I perform critical action",
          duration: 300,
          timestamp: "2024-01-15T10:02:00.000Z",
          context: { suite: "critical", tags: ["@critical"], testFile: "critical.feature" }
        }
      ];

      const { report } = analyze(multiContextData, {}, testConfig, configLoader);
      
      // Should be able to filter by suite
      const authSuiteSteps = Object.values(report.suites).find(s => s.suite === 'authentication');
      expect(authSuiteSteps.totalSteps).toBe(1);
      
      // Should be able to filter by tag
      const criticalTagSteps = report.tagAnalysis['@critical'];
      expect(criticalTagSteps.stepCount).toBe(1);
      expect(criticalTagSteps.suites).toContain('critical');
    });
  });

  describe('Backward Compatibility Integration', () => {
    it('should handle mixed legacy and enhanced data', () => {
      const mixedData = [
        // Legacy format
        {
          stepText: "I perform legacy action",
          duration: 100,
          timestamp: "2024-01-15T10:00:00.000Z"
        },
        // Enhanced format
        {
          stepText: "I perform enhanced action",
          duration: 200,
          timestamp: "2024-01-15T10:01:00.000Z",
          context: {
            suite: "enhanced",
            tags: ["@enhanced"],
            testFile: "enhanced.feature",
            testName: "Enhanced Test",
            jobId: "job-123",
            workerId: "worker-1"
          }
        }
      ];

      const { report } = analyze(mixedData, {}, testConfig, configLoader);
      
      // Should handle both formats
      expect(report.metadata.totalSteps).toBe(2);
      expect(report.metadata.suites).toContain('unknown'); // Legacy step
      expect(report.metadata.suites).toContain('enhanced'); // Enhanced step
      
      // Should provide suite analysis for both
      expect(report.suites.unknown).toBeDefined();
      expect(report.suites.enhanced).toBeDefined();
    });

    it('should upgrade legacy history with context', () => {
      const legacyHistory = {
        "I perform action": {
          durations: [100, 105, 102],
          average: 102.33,
          stdDev: 2.52
        }
      };

      const enhancedRun = [
        {
          stepText: "I perform action",
          duration: 110,
          timestamp: "2024-01-15T10:00:00.000Z",
          context: {
            suite: "upgraded",
            tags: ["@upgraded"],
            testFile: "upgraded.feature",
            testName: "Upgraded Test",
            jobId: "job-123",
            workerId: "worker-1"
          }
        }
      ];

      const { updatedHistory } = analyze(enhancedRun, legacyHistory, testConfig, configLoader);
      
      // Should add context to legacy history entry
      expect(updatedHistory["I perform action"].context).toBeDefined();
      expect(updatedHistory["I perform action"].context.suite).toBe('upgraded');
      expect(updatedHistory["I perform action"].context.tags).toContain('@upgraded');
    });
  });

  describe('End-to-End Validation', () => {
    it('should validate complete enhanced workflow', async () => {
      // Load sample enhanced data
      const sampleEnhancedData = await fs.readFile(
        path.join(__dirname, '..', '..', 'examples', 'sample-enhanced-run.json'), 
        'utf-8'
      );
      const runData = JSON.parse(sampleEnhancedData);

      // Create mock history
      const mockHistory = {};
      runData.forEach(step => {
        if (!mockHistory[step.stepText]) {
          mockHistory[step.stepText] = {
            durations: [step.duration - 10, step.duration - 5, step.duration],
            average: step.duration - 5,
            stdDev: 5,
            context: step.context
          };
        }
      });

      // Run full analysis
      const { report, updatedHistory } = analyze(runData, mockHistory, testConfig, configLoader);

      // Validate all enhanced features are working
      expect(report.metadata.totalSteps).toBeGreaterThan(0);
      expect(report.metadata.suites.length).toBeGreaterThan(0);
      expect(report.metadata.tags.length).toBeGreaterThan(0);
      expect(report.metadata.overallHealth).toBeDefined();

      expect(Object.keys(report.suites).length).toBeGreaterThan(0);
      expect(Object.keys(report.tagAnalysis).length).toBeGreaterThan(0);
      expect(report.criticalPath).toBeDefined();
      expect(report.recommendations).toBeDefined();

      expect(updatedHistory._suiteHistory).toBeDefined();
      
      // Steps from the enhanced run should have context
      runData.forEach(runStep => {
        if (updatedHistory[runStep.stepText]) {
          expect(updatedHistory[runStep.stepText].context).toBeDefined();
        }
      });
    });

    it('should maintain performance with large datasets', () => {
      // Create large dataset
      const largeDataset = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          stepText: `I perform action ${i}`,
          duration: 100 + Math.random() * 100,
          timestamp: new Date().toISOString(),
          context: {
            suite: `suite-${i % 10}`,
            tags: [`@tag-${i % 5}`, '@performance'],
            testFile: `test-${i % 10}.feature`,
            testName: `Test ${i}`,
            jobId: `job-${i % 3}`,
            workerId: `worker-${i % 5}`
          }
        });
      }

      const startTime = Date.now();
      const { report } = analyze(largeDataset, {}, testConfig, configLoader);
      const endTime = Date.now();

      // Should complete within reasonable time (< 5 seconds for 1000 steps)
      expect(endTime - startTime).toBeLessThan(5000);

      // Should handle large dataset correctly
      expect(report.metadata.totalSteps).toBe(1000);
      expect(Object.keys(report.suites).length).toBe(10);
      expect(Object.keys(report.tagAnalysis).length).toBeGreaterThan(0);
    });
  });
}); 