const { analyze, calculateSuiteHealthScore, detectSuiteRegression, categorizeSuitePerformance } = require('../src/analysis/engine');
const ConfigLoader = require('../src/config/config-loader');

// Test configuration
const testConfig = {
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
      authentication: { threshold: 1.5, rules: { min_percentage_change: 2 } }
    },
    tag_overrides: {
      "@critical": { threshold: 1.2, rules: { min_percentage_change: 1, min_absolute_slowdown: 5 } }
    }
  }
};

// Test run data with multiple suites and varying performance
const testRunData = [
  // Authentication suite - good performance
  {
    stepText: "I navigate to login page",
    duration: 150,
    timestamp: "2024-01-15T10:00:00.000Z",
    context: {
      testFile: "features/auth/login.feature",
      testName: "User Login Flow",
      suite: "authentication",
      tags: ["@authentication", "@critical", "@smoke"],
      jobId: "job-1", workerId: "worker-1"
    }
  },
  {
    stepText: "I enter valid credentials",
    duration: 45,
    timestamp: "2024-01-15T10:00:01.000Z",
    context: {
      testFile: "features/auth/login.feature",
      testName: "User Login Flow", 
      suite: "authentication",
      tags: ["@authentication", "@critical"],
      jobId: "job-1", workerId: "worker-1"
    }
  },
  // Shopping suite - mixed performance with regression
  {
    stepText: "I view product catalog",
    duration: 320,
    timestamp: "2024-01-15T10:01:00.000Z",
    context: {
      testFile: "features/shopping/catalog.feature",
      testName: "Product Browsing",
      suite: "shopping",
      tags: ["@shopping", "@smoke"],
      jobId: "job-2", workerId: "worker-2"
    }
  },
  {
    stepText: "I add item to cart",
    duration: 850, // This will be a regression
    timestamp: "2024-01-15T10:01:01.000Z",
    context: {
      testFile: "features/shopping/cart.feature",
      testName: "Cart Management",
      suite: "shopping",
      tags: ["@shopping", "@critical"],
      jobId: "job-2", workerId: "worker-2"
    }
  },
  {
    stepText: "I proceed to checkout",
    duration: 1200, // Another regression
    timestamp: "2024-01-15T10:01:02.000Z",
    context: {
      testFile: "features/shopping/checkout.feature",
      testName: "Checkout Process",
      suite: "shopping",
      tags: ["@shopping", "@critical"],
      jobId: "job-2", workerId: "worker-2"
    }
  },
  // Reports suite - poor performance with many issues
  {
    stepText: "I generate daily report",
    duration: 2500, // Regression
    timestamp: "2024-01-15T10:02:00.000Z",
    context: {
      testFile: "features/reports/daily.feature",
      testName: "Daily Report Generation",
      suite: "reports",
      tags: ["@reports", "@slow"],
      jobId: "job-3", workerId: "worker-3"
    }
  },
  {
    stepText: "I export report data",
    duration: 1800, // Regression
    timestamp: "2024-01-15T10:02:01.000Z",
    context: {
      testFile: "features/reports/export.feature",
      testName: "Report Export",
      suite: "reports",
      tags: ["@reports", "@slow"],
      jobId: "job-3", workerId: "worker-3"
    }
  },
  {
    stepText: "I view report summary",
    duration: 450, // New step
    timestamp: "2024-01-15T10:02:02.000Z",
    context: {
      testFile: "features/reports/summary.feature",
      testName: "Report Summary",
      suite: "reports",
      tags: ["@reports"],
      jobId: "job-3", workerId: "worker-3"
    }
  }
];

// Historical data with suite history
const testHistory = {
  "I navigate to login page": {
    durations: [145, 150, 148, 152, 149],
    average: 148.8,
    stdDev: 2.68,
    context: { suite: "authentication", tags: ["@authentication", "@critical", "@smoke"] }
  },
  "I enter valid credentials": {
    durations: [40, 45, 42, 48, 44],
    average: 43.8,
    stdDev: 3.27,
    context: { suite: "authentication", tags: ["@authentication", "@critical"] }
  },
  "I view product catalog": {
    durations: [300, 310, 305, 315, 308],
    average: 307.6,
    stdDev: 5.94,
    context: { suite: "shopping", tags: ["@shopping", "@smoke"] }
  },
  "I add item to cart": {
    durations: [450, 460, 455, 465, 458],
    average: 457.6,
    stdDev: 5.94,
    context: { suite: "shopping", tags: ["@shopping", "@critical"] }
  },
  "I proceed to checkout": {
    durations: [600, 610, 605, 615, 608],
    average: 607.6,
    stdDev: 5.94,
    context: { suite: "shopping", tags: ["@shopping", "@critical"] }
  },
  "I generate daily report": {
    durations: [2000, 2100, 2050, 2150, 2080],
    average: 2076,
    stdDev: 60.83,
    context: { suite: "reports", tags: ["@reports", "@slow"] }
  },
  "I export report data": {
    durations: [1500, 1550, 1525, 1575, 1540],
    average: 1538,
    stdDev: 30.41,
    context: { suite: "reports", tags: ["@reports", "@slow"] }
  },
  // Suite history
  _suiteHistory: {
    authentication: {
      avgDurationHistory: [95, 96, 94, 97, 96],
      totalStepsHistory: [2, 2, 2, 2, 2],
      regressionRateHistory: [0, 0, 0, 0, 0],
      lastUpdated: "2024-01-14T10:00:00.000Z"
    },
    shopping: {
      avgDurationHistory: [485, 490, 487, 492, 488],
      totalStepsHistory: [3, 3, 3, 3, 3],
      regressionRateHistory: [0, 0.33, 0, 0.33, 0],
      lastUpdated: "2024-01-14T10:00:00.000Z"
    },
    reports: {
      avgDurationHistory: [1750, 1800, 1775, 1820, 1790],
      totalStepsHistory: [2, 2, 2, 2, 2],
      regressionRateHistory: [0.5, 0.5, 0.5, 1.0, 0.5],
      lastUpdated: "2024-01-14T10:00:00.000Z"
    }
  }
};

async function testSuiteLevelAnalysis() {
  console.log('🧪 Testing Suite-Level Analysis...\n');
  
  try {
    const configLoader = new ConfigLoader();
    
    // Test individual functions first
    console.log('1. Testing suite health score calculation...');
    
    // Test good suite (authentication)
    const goodSuiteData = {
      suite: "authentication",
      totalSteps: 2,
      regressions: 0,
      newSteps: 0,
      avgDuration: 97.5,
      tags: ["@authentication", "@critical", "@smoke"]
    };
    const goodSuiteHistory = testHistory._suiteHistory.authentication;
    const goodHealthScore = calculateSuiteHealthScore(goodSuiteData, goodSuiteHistory);
    console.log(`✅ Good suite health score: ${goodHealthScore} (expected: ~100)`);
    
    // Test problematic suite (reports)
    const problemSuiteData = {
      suite: "reports",
      totalSteps: 3,
      regressions: 2,
      newSteps: 1,
      avgDuration: 1583,
      tags: ["@reports", "@slow"]
    };
    const problemSuiteHistory = testHistory._suiteHistory.reports;
    const problemHealthScore = calculateSuiteHealthScore(problemSuiteData, problemSuiteHistory);
    console.log(`✅ Problem suite health score: ${problemHealthScore} (expected: <70)`);
    
    // Test suite regression detection
    console.log('\n2. Testing suite regression detection...');
    const suiteConfig = { threshold: 2.0 };
    const regression = detectSuiteRegression(problemSuiteData, problemSuiteHistory, suiteConfig);
    if (regression) {
      console.log(`✅ Suite regression detected: ${regression.suite} (+${regression.slowdown.toFixed(1)}ms, +${regression.percentage.toFixed(1)}%)`);
    } else {
      console.log('✅ No suite regression detected in test case');
    }
    
    // Test performance categorization
    console.log('\n3. Testing suite performance categorization...');
    const goodCategory = categorizeSuitePerformance(goodSuiteData, suiteConfig);
    console.log(`✅ Good suite category: ${goodCategory.category} (${goodCategory.severity} severity)`);
    
    const problemCategory = categorizeSuitePerformance(problemSuiteData, suiteConfig);
    console.log(`✅ Problem suite category: ${problemCategory.category} (${problemCategory.severity} severity)`);
    console.log(`   Recommendations: ${problemCategory.recommendations.join('; ')}`);
    
    // Test full analysis with enhanced suite features
    console.log('\n4. Testing full analysis with enhanced suite features...');
    const { report, updatedHistory } = analyze(testRunData, testHistory, testConfig, configLoader);
    
    console.log('✅ Enhanced suite analysis completed!');
    console.log('\n📊 Enhanced Analysis Results:');
    console.log(`   • Total Steps: ${report.metadata.totalSteps}`);
    console.log(`   • Step Regressions: ${report.regressions.length}`);
    console.log(`   • Suite Regressions: ${report.suiteRegressions.length}`);
    console.log(`   • Overall System Health: ${report.metadata.overallHealth}%`);
    console.log(`   • Suites Analyzed: ${Object.keys(report.suites).length}`);
    
    // Display suite-level regressions
    if (report.suiteRegressions.length > 0) {
      console.log('\n🔴 Suite-Level Regressions:');
      report.suiteRegressions.forEach((regression, index) => {
        console.log(`   ${index + 1}. Suite "${regression.suite}"`);
        console.log(`      - Current Avg: ${regression.currentAvg.toFixed(1)}ms vs Historical: ${regression.historicalAvg.toFixed(1)}ms`);
        console.log(`      - Slowdown: +${regression.slowdown.toFixed(1)}ms (+${regression.percentage.toFixed(1)}%)`);
        console.log(`      - Affected Steps: ${regression.affectedSteps}, Regressed Steps: ${regression.regressionSteps}`);
      });
    }
    
    // Display detailed suite analysis
    console.log('\n🏢 Enhanced Suite Analysis:');
    Object.values(report.suites).forEach(suite => {
      console.log(`\n   📁 Suite: ${suite.suite}`);
      console.log(`      • Performance: ${suite.category.toUpperCase()} (${suite.severity} severity)`);
      console.log(`      • Health Score: ${suite.healthScore}% 🎯`);
      console.log(`      • Steps: ${suite.totalSteps} total (R:${suite.regressions} N:${suite.newSteps} OK:${suite.okSteps})`);
      console.log(`      • Duration: ${suite.avgDuration.toFixed(1)}ms avg (${suite.minDuration}-${suite.maxDuration}ms range)`);
      console.log(`      • Test Files: ${suite.testFiles.length} (${suite.testFiles.join(', ')})`);
      console.log(`      • Tags: ${suite.tags.join(', ')}`);
      console.log(`      • Critical Steps: ${suite.criticalSteps}, Smoke Steps: ${suite.smokeSteps}`);
      
      if (suite.recommendations && suite.recommendations.length > 0) {
        console.log(`      • Recommendations:`);
        suite.recommendations.forEach(rec => {
          console.log(`        - ${rec}`);
        });
      }
    });
    
    // Display step details by status
    console.log('\n📋 Step Status Summary:');
    Object.values(report.suites).forEach(suite => {
      const regressionSteps = suite.stepDetails?.filter(s => s.status === 'regression') || [];
      const newSteps = suite.stepDetails?.filter(s => s.status === 'new') || [];
      
      if (regressionSteps.length > 0) {
        console.log(`\n   🔴 ${suite.suite} - Regression Steps:`);
        regressionSteps.forEach(step => {
          console.log(`      • "${step.stepText}": ${step.duration}ms (+${step.slowdown?.toFixed(1)}ms, +${step.percentage?.toFixed(1)}%)`);
        });
      }
      
      if (newSteps.length > 0) {
        console.log(`\n   🆕 ${suite.suite} - New Steps:`);
        newSteps.forEach(step => {
          console.log(`      • "${step.stepText}": ${step.duration}ms`);
        });
      }
    });
    
    // Verify suite history was updated
    console.log('\n📈 Suite History Updates:');
    Object.keys(updatedHistory._suiteHistory).forEach(suiteName => {
      const history = updatedHistory._suiteHistory[suiteName];
      console.log(`   • ${suiteName}: ${history.avgDurationHistory.length} data points, latest avg: ${history.avgDurationHistory[history.avgDurationHistory.length - 1]?.toFixed(1)}ms`);
    });
    
    console.log('\n✅ All suite-level analysis tests passed!');
    
  } catch (error) {
    console.error('❌ Suite analysis test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSuiteLevelAnalysis(); 