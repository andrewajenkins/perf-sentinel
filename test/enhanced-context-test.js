const { analyze, validateAndNormalizeContext, extractStepData } = require('../src/analysis/engine');
const ConfigLoader = require('../src/config/config-loader');

// Sample enhanced run data with rich context
const sampleEnhancedRun = [
  {
    "stepText": "I am on the login page",
    "duration": 152.5,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "context": {
      "testFile": "examples/features/authentication/login.feature",
      "testName": "Successful login with valid credentials",
      "suite": "authentication",
      "tags": ["@authentication", "@critical", "@smoke", "@fast"],
      "jobId": "job-auth-123",
      "workerId": "worker-1"
    }
  },
  {
    "stepText": "I click the login button",
    "duration": 1200.8,
    "timestamp": "2024-01-15T10:30:02.000Z",
    "context": {
      "testFile": "examples/features/authentication/login.feature",
      "testName": "Successful login with valid credentials",
      "suite": "authentication",
      "tags": ["@authentication", "@critical", "@smoke", "@fast"],
      "jobId": "job-auth-123",
      "workerId": "worker-1"
    }
  },
  {
    "stepText": "I am on the checkout page",
    "duration": 325.1,
    "timestamp": "2024-01-15T10:32:00.000Z",
    "context": {
      "testFile": "examples/features/shopping/checkout.feature",
      "testName": "Successful checkout with credit card",
      "suite": "shopping",
      "tags": ["@shopping", "@checkout", "@medium", "@smoke", "@payment"],
      "jobId": "job-shopping-456",
      "workerId": "worker-2"
    }
  },
  {
    "stepText": "I click the complete purchase button",
    "duration": 2100.6,
    "timestamp": "2024-01-15T10:32:03.000Z",
    "context": {
      "testFile": "examples/features/shopping/checkout.feature",
      "testName": "Successful checkout with credit card",
      "suite": "shopping",
      "tags": ["@shopping", "@checkout", "@medium", "@smoke", "@payment"],
      "jobId": "job-shopping-456",
      "workerId": "worker-2"
    }
  }
];

// Sample history data
const sampleHistory = {
  "I am on the login page": {
    "durations": [150, 155, 148, 152],
    "average": 151.25,
    "stdDev": 3.09,
    "context": {
      "testFile": "examples/features/authentication/login.feature",
      "testName": "Successful login with valid credentials",
      "suite": "authentication",
      "tags": ["@authentication", "@critical", "@smoke"],
      "jobId": "previous-job",
      "workerId": "previous-worker"
    }
  },
  "I click the login button": {
    "durations": [1000, 1100, 1050, 1200],
    "average": 1087.5,
    "stdDev": 88.03,
    "context": {
      "testFile": "examples/features/authentication/login.feature",
      "testName": "Successful login with valid credentials",
      "suite": "authentication",
      "tags": ["@authentication", "@critical"],
      "jobId": "previous-job",
      "workerId": "previous-worker"
    }
  }
};

async function testEnhancedContextAnalysis() {
  console.log('🧪 Testing Enhanced Context Analysis...\n');
  
  try {
    // Test context validation function
    console.log('1. Testing context validation...');
    const validContext = validateAndNormalizeContext({
      testFile: 'test.feature',
      testName: 'Test Scenario',
      suite: 'test-suite',
      tags: ['@test'],
      jobId: 'job-123',
      workerId: 'worker-1'
    });
    console.log('✅ Valid context normalized:', validContext);
    
    const invalidContext = validateAndNormalizeContext(null);
    console.log('✅ Invalid context normalized:', invalidContext);
    
    // Test step data extraction
    console.log('\n2. Testing step data extraction...');
    const stepData = extractStepData(sampleEnhancedRun[0]);
    console.log('✅ Step data extracted:', stepData);
    
    // Test enhanced analysis
    console.log('\n3. Testing enhanced analysis...');
    const configLoader = new ConfigLoader();
    const config = await configLoader.load({
      configPath: 'src/config/defaults.yml'
    });
    
    const { report, updatedHistory } = analyze(sampleEnhancedRun, sampleHistory, config, configLoader);
    
    console.log('✅ Analysis completed successfully!');
    console.log('\n📊 Analysis Results:');
    console.log(`   • Total Steps: ${report.metadata.totalSteps}`);
    console.log(`   • Unique Steps: ${report.metadata.uniqueSteps}`);
    console.log(`   • Suites: ${report.metadata.suites.join(', ')}`);
    console.log(`   • Tags: ${report.metadata.tags.join(', ')}`);
    console.log(`   • Jobs: ${report.metadata.jobs.join(', ')}`);
    console.log(`   • Regressions: ${report.regressions.length}`);
    console.log(`   • New Steps: ${report.newSteps.length}`);
    console.log(`   • OK Steps: ${report.ok.length}`);
    
    // Display suite summary
    console.log('\n🏢 Suite Summary:');
    Object.values(report.suites).forEach(suite => {
      console.log(`   • ${suite.suite}: ${suite.totalSteps} steps, avg ${suite.avgDuration.toFixed(1)}ms`);
      console.log(`     - Files: ${suite.testFiles.join(', ')}`);
      console.log(`     - Tags: ${suite.tags.join(', ')}`);
      console.log(`     - R:${suite.regressions} N:${suite.newSteps} OK:${suite.okSteps}`);
    });
    
    // Display regression details with context
    if (report.regressions.length > 0) {
      console.log('\n🔴 Regressions with Context:');
      report.regressions.forEach((regression, index) => {
        console.log(`   ${index + 1}. "${regression.stepText}"`);
        console.log(`      - Current: ${regression.currentDuration.toFixed(1)}ms vs Average: ${regression.average.toFixed(1)}ms`);
        console.log(`      - Slowdown: +${regression.slowdown.toFixed(1)}ms (+${regression.percentage.toFixed(1)}%)`);
        console.log(`      - Suite: ${regression.context.suite}`);
        console.log(`      - Test: ${regression.context.testName}`);
        console.log(`      - Tags: ${regression.context.tags.join(', ')}`);
      });
    }
    
    // Display new steps with context
    if (report.newSteps.length > 0) {
      console.log('\n🆕 New Steps with Context:');
      report.newSteps.forEach((newStep, index) => {
        console.log(`   ${index + 1}. "${newStep.stepText}"`);
        console.log(`      - Duration: ${newStep.duration.toFixed(1)}ms`);
        console.log(`      - Suite: ${newStep.context.suite}`);
        console.log(`      - Test: ${newStep.context.testName}`);
        console.log(`      - Tags: ${newStep.context.tags.join(', ')}`);
      });
    }
    
    // Test updated history with context
    console.log('\n📈 Updated History with Context:');
    Object.keys(updatedHistory).forEach(stepText => {
      const historyEntry = updatedHistory[stepText];
      console.log(`   • "${stepText}"`);
      console.log(`     - Average: ${historyEntry.average.toFixed(1)}ms`);
      console.log(`     - Suite: ${historyEntry.context.suite}`);
      console.log(`     - Tags: ${historyEntry.context.tags.join(', ')}`);
      console.log(`     - Data points: ${historyEntry.durations.length}`);
    });
    
    console.log('\n✅ All enhanced context tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testEnhancedContextAnalysis(); 