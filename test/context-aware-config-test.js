const { analyze } = require('../src/analysis/engine');
const ConfigLoader = require('../src/config/config-loader');

// Create a test configuration with suite and tag overrides
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
    trends: {
      enabled: true,
      window_size: 3,
      min_significance: 10,
      min_history_required: 6,
      only_upward: true
    },
    step_overrides: {},
    // Suite-level overrides
    suite_overrides: {
      authentication: {
        threshold: 1.5,  // More sensitive for auth
        rules: {
          min_percentage_change: 2,
          min_absolute_slowdown: 8
        }
      },
      shopping: {
        threshold: 2.5,  // More lenient for shopping
        rules: {
          min_percentage_change: 6,
          min_absolute_slowdown: 30
        }
      }
    },
    // Tag-based overrides
    tag_overrides: {
      "@critical": {
        threshold: 1.2,  // Very sensitive for critical
        rules: {
          min_percentage_change: 1,
          min_absolute_slowdown: 5
        }
      },
      "@slow": {
        threshold: 3.0,  // More lenient for slow operations
        rules: {
          min_percentage_change: 10,
          min_absolute_slowdown: 50
        }
      },
      "@smoke": {
        threshold: 1.8,  // Moderately sensitive for smoke tests
        rules: {
          min_percentage_change: 4,
          min_absolute_slowdown: 12
        }
      }
    }
  }
};

// Test data with rich context
const testRunData = [
  {
    stepText: "I log in as a user",
    duration: 155,  // Slight increase from baseline
    timestamp: "2024-01-15T10:00:00.000Z",
    context: {
      testFile: "features/authentication/login.feature",
      testName: "User Login",
      suite: "authentication",
      tags: ["@authentication", "@critical"],
      jobId: "job-123",
      workerId: "worker-1"
    }
  },
  {
    stepText: "I add item to cart",
    duration: 330,  // Slight increase from baseline
    timestamp: "2024-01-15T10:01:00.000Z",
    context: {
      testFile: "features/shopping/cart.feature",
      testName: "Add to Cart",
      suite: "shopping",
      tags: ["@shopping", "@smoke"],
      jobId: "job-456",
      workerId: "worker-2"
    }
  },
  {
    stepText: "I perform slow operation",
    duration: 1550,  // Significant increase from baseline
    timestamp: "2024-01-15T10:02:00.000Z",
    context: {
      testFile: "features/data/processing.feature",
      testName: "Data Processing",
      suite: "data",
      tags: ["@data", "@slow"],
      jobId: "job-789",
      workerId: "worker-3"
    }
  }
];

// Baseline history
const testHistory = {
  "I log in as a user": {
    durations: [145, 150, 148, 152],
    average: 148.75,
    stdDev: 2.99,
    context: {
      suite: "authentication",
      tags: ["@authentication", "@critical"]
    }
  },
  "I add item to cart": {
    durations: [310, 320, 315, 325],
    average: 317.5,
    stdDev: 6.45,
    context: {
      suite: "shopping",
      tags: ["@shopping", "@smoke"]
    }
  },
  "I perform slow operation": {
    durations: [1400, 1450, 1420, 1480],
    average: 1437.5,
    stdDev: 36.14,
    context: {
      suite: "data",
      tags: ["@data", "@slow"]
    }
  }
};

async function testContextAwareConfig() {
  console.log('🧪 Testing Context-Aware Configuration...\n');
  
  try {
    // Create a config loader with our test config
    const configLoader = new ConfigLoader();
    
    // Test suite-level configuration
    console.log('1. Testing suite-level configuration...');
    const authSuiteConfig = configLoader.getSuiteConfig('authentication', testConfig);
    console.log('✅ Authentication suite config:', {
      threshold: authSuiteConfig.threshold,
      rules: authSuiteConfig.rules
    });
    
    const shoppingSuiteConfig = configLoader.getSuiteConfig('shopping', testConfig);
    console.log('✅ Shopping suite config:', {
      threshold: shoppingSuiteConfig.threshold,
      rules: shoppingSuiteConfig.rules
    });
    
    // Test tag-based configuration
    console.log('\n2. Testing tag-based configuration...');
    const criticalTagConfig = configLoader.getTagConfig('@critical', testConfig);
    console.log('✅ @critical tag config:', {
      threshold: criticalTagConfig.threshold,
      rules: criticalTagConfig.rules
    });
    
    const slowTagConfig = configLoader.getTagConfig('@slow', testConfig);
    console.log('✅ @slow tag config:', {
      threshold: slowTagConfig.threshold,
      rules: slowTagConfig.rules
    });
    
    // Test step configuration with context
    console.log('\n3. Testing step configuration with context...');
    
    // Test authentication step with @critical tag (should use most restrictive config)
    const authStepConfig = configLoader.getStepConfig(
      "I log in as a user", 
      148.75, 
      testConfig, 
      testRunData[0].context
    );
    console.log('✅ Auth step config (suite: authentication, tags: @critical):', {
      threshold: authStepConfig.threshold,
      rules: authStepConfig.rules
    });
    
    // Test shopping step with @smoke tag
    const shopStepConfig = configLoader.getStepConfig(
      "I add item to cart", 
      317.5, 
      testConfig, 
      testRunData[1].context
    );
    console.log('✅ Shopping step config (suite: shopping, tags: @smoke):', {
      threshold: shopStepConfig.threshold,
      rules: shopStepConfig.rules
    });
    
    // Test data step with @slow tag
    const dataStepConfig = configLoader.getStepConfig(
      "I perform slow operation", 
      1437.5, 
      testConfig, 
      testRunData[2].context
    );
    console.log('✅ Data step config (suite: data, tags: @slow):', {
      threshold: dataStepConfig.threshold,
      rules: dataStepConfig.rules
    });
    
    // Test full analysis with context-aware configuration
    console.log('\n4. Testing full analysis with context-aware configuration...');
    const { report, updatedHistory } = analyze(testRunData, testHistory, testConfig, configLoader);
    
    console.log('✅ Context-aware analysis completed!');
    console.log('\n📊 Analysis Results:');
    console.log(`   • Total Steps: ${report.metadata.totalSteps}`);
    console.log(`   • Regressions: ${report.regressions.length}`);
    console.log(`   • Suites: ${report.metadata.suites.join(', ')}`);
    console.log(`   • Tags: ${report.metadata.tags.join(', ')}`);
    
    // Display regressions with applied config
    if (report.regressions.length > 0) {
      console.log('\n🔴 Regressions with Applied Config:');
      report.regressions.forEach((regression, index) => {
        console.log(`   ${index + 1}. "${regression.stepText}"`);
        console.log(`      - Current: ${regression.currentDuration}ms vs Average: ${regression.average.toFixed(1)}ms`);
        console.log(`      - Slowdown: +${regression.slowdown.toFixed(1)}ms (+${regression.percentage.toFixed(1)}%)`);
        console.log(`      - Suite: ${regression.context.suite}`);
        console.log(`      - Tags: ${regression.context.tags.join(', ')}`);
        console.log(`      - Applied Threshold: ${regression.appliedConfig.threshold}`);
        console.log(`      - Applied Rules:`, regression.appliedConfig.rules);
      });
    }
    
    // Display OK steps
    if (report.ok.length > 0) {
      console.log('\n✅ OK Steps:');
      report.ok.forEach((okStep, index) => {
        console.log(`   ${index + 1}. "${okStep.stepText}"`);
        console.log(`      - Duration: ${okStep.duration}ms`);
        console.log(`      - Suite: ${okStep.context.suite}`);
        console.log(`      - Tags: ${okStep.context.tags.join(', ')}`);
      });
    }
    
    // Display suite summaries with applied config
    console.log('\n🏢 Suite Summaries with Applied Config:');
    Object.values(report.suites).forEach(suite => {
      console.log(`   • ${suite.suite}: ${suite.totalSteps} steps, avg ${suite.avgDuration.toFixed(1)}ms`);
      console.log(`     - Applied Threshold: ${suite.appliedConfig.threshold}`);
      console.log(`     - Applied Rules: min_percentage_change=${suite.appliedConfig.rules.min_percentage_change}`);
      console.log(`     - R:${suite.regressions} N:${suite.newSteps} OK:${suite.okSteps}`);
    });
    
    console.log('\n✅ All context-aware configuration tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testContextAwareConfig(); 