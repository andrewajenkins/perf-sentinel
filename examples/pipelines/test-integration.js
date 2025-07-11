#!/usr/bin/env node

/**
 * Test script to verify pipeline integration works correctly
 * Simulates multi-job CI/CD scenario locally
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  projectId: 'pipeline-test',
  buildId: `test-${Date.now()}`,
  jobIds: ['auth-tests', 'api-tests', 'ui-tests'],
  configFile: './examples/perf-sentinel-ci.yml',
  testDataFile: './examples/test-data-large.json',
  resultsDir: './pipeline-test-results',
  timeout: 60 // seconds
};

// Create mock performance data for each job
function createMockJobData(jobId, suite) {
  const baseData = require(path.resolve(CONFIG.testDataFile));
  
  // Modify data to simulate different job contexts
  const jobData = baseData.map(step => ({
    ...step,
    context: {
      ...step.context,
      jobId: `${jobId}-${CONFIG.buildId}`,
      suite: suite,
      workerId: `worker-${jobId}`,
      timestamp: new Date().toISOString()
    }
  }));
  
  return jobData;
}

// Run perf-sentinel analyze for a single job
async function runJobAnalysis(jobId, suite) {
  console.log(`🔄 Running analysis for job: ${jobId} (${suite})`);
  
  const jobData = createMockJobData(jobId, suite);
  const jobFile = path.join(CONFIG.resultsDir, `${jobId}-data.json`);
  
  // Write job data to file
  fs.writeFileSync(jobFile, JSON.stringify(jobData, null, 2));
  
  // Run perf-sentinel analyze
  const command = `npx perf-sentinel analyze \
    --run-file "${jobFile}" \
    --config "${CONFIG.configFile}" \
    --project-id "${CONFIG.projectId}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(`✅ Job ${jobId} analysis completed`);
    if (stderr) console.log(`   Warning: ${stderr}`);
    return true;
  } catch (error) {
    console.error(`❌ Job ${jobId} analysis failed:`, error.message);
    return false;
  }
}

// Run perf-sentinel aggregate to combine all jobs
async function runAggregation() {
  console.log(`🔄 Aggregating results from ${CONFIG.jobIds.length} jobs...`);
  
  const jobIdsList = CONFIG.jobIds.map(id => `${id}-${CONFIG.buildId}`).join(',');
  const outputFile = path.join(CONFIG.resultsDir, 'aggregated-results.json');
  
  const command = `npx perf-sentinel aggregate \
    --config "${CONFIG.configFile}" \
    --project-id "${CONFIG.projectId}" \
    --job-ids "${jobIdsList}" \
    --wait-for-jobs true \
    --timeout ${CONFIG.timeout} \
    --output-file "${outputFile}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(`✅ Aggregation completed`);
    if (stderr) console.log(`   Warning: ${stderr}`);
    
    // Check if aggregated file exists
    if (fs.existsSync(outputFile)) {
      const aggregatedData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      console.log(`📊 Aggregated data contains ${aggregatedData.length} steps`);
      return outputFile;
    } else {
      console.error(`❌ Aggregated results file not found: ${outputFile}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Aggregation failed:`, error.message);
    return null;
  }
}

// Generate HTML report from aggregated results
async function generateReport(aggregatedFile) {
  console.log(`🔄 Generating HTML report...`);
  
  const reportFile = path.join(CONFIG.resultsDir, 'pipeline-test-report.html');
  
  const command = `npx perf-sentinel analyze \
    --run-file "${aggregatedFile}" \
    --config "${CONFIG.configFile}" \
    --project-id "${CONFIG.projectId}" \
    --environment production \
    --reporter html \
    --html-output "${reportFile}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(`✅ HTML report generated: ${reportFile}`);
    if (stderr) console.log(`   Warning: ${stderr}`);
    
    // Check report size
    const stats = fs.statSync(reportFile);
    console.log(`📄 Report size: ${(stats.size / 1024).toFixed(1)} KB`);
    
    return reportFile;
  } catch (error) {
    console.error(`❌ HTML report generation failed:`, error.message);
    return null;
  }
}

// Main test function
async function runPipelineIntegrationTest() {
  console.log('🚀 Starting Pipeline Integration Test');
  console.log('=====================================');
  console.log(`Project ID: ${CONFIG.projectId}`);
  console.log(`Build ID: ${CONFIG.buildId}`);
  console.log(`Jobs: ${CONFIG.jobIds.join(', ')}`);
  console.log(`Results Directory: ${CONFIG.resultsDir}`);
  console.log('');
  
  // Setup
  if (!fs.existsSync(CONFIG.resultsDir)) {
    fs.mkdirSync(CONFIG.resultsDir, { recursive: true });
  }
  
  // Check if test data file exists
  if (!fs.existsSync(CONFIG.testDataFile)) {
    console.error(`❌ Test data file not found: ${CONFIG.testDataFile}`);
    process.exit(1);
  }
  
  // Check if config file exists
  if (!fs.existsSync(CONFIG.configFile)) {
    console.error(`❌ Config file not found: ${CONFIG.configFile}`);
    process.exit(1);
  }
  
  let allJobsSuccessful = true;
  
  // Phase 1: Run individual job analyses
  console.log('Phase 1: Individual Job Analysis');
  console.log('--------------------------------');
  
  for (let i = 0; i < CONFIG.jobIds.length; i++) {
    const jobId = CONFIG.jobIds[i];
    const suite = ['authentication', 'api', 'ui'][i];
    
    const success = await runJobAnalysis(jobId, suite);
    if (!success) {
      allJobsSuccessful = false;
    }
  }
  
  if (!allJobsSuccessful) {
    console.error('❌ Some job analyses failed. Stopping test.');
    process.exit(1);
  }
  
  console.log('');
  
  // Phase 2: Aggregate results
  console.log('Phase 2: Result Aggregation');
  console.log('---------------------------');
  
  const aggregatedFile = await runAggregation();
  if (!aggregatedFile) {
    console.error('❌ Aggregation failed. Stopping test.');
    process.exit(1);
  }
  
  console.log('');
  
  // Phase 3: Generate HTML report
  console.log('Phase 3: HTML Report Generation');
  console.log('-------------------------------');
  
  const reportFile = await generateReport(aggregatedFile);
  if (!reportFile) {
    console.error('❌ HTML report generation failed. Stopping test.');
    process.exit(1);
  }
  
  console.log('');
  
  // Summary
  console.log('🎉 Pipeline Integration Test Complete');
  console.log('====================================');
  console.log(`✅ All ${CONFIG.jobIds.length} job analyses completed successfully`);
  console.log(`✅ Multi-job aggregation successful`);
  console.log(`✅ HTML report generated successfully`);
  console.log('');
  console.log('📁 Generated Files:');
  console.log(`   📊 HTML Report: ${reportFile}`);
  console.log(`   📄 Aggregated Data: ${aggregatedFile}`);
  console.log(`   📂 Results Directory: ${CONFIG.resultsDir}`);
  console.log('');
  console.log('🌐 To view the HTML report, open it in your browser:');
  console.log(`   file://${path.resolve(reportFile)}`);
  console.log('');
  console.log('🧹 To clean up test files:');
  console.log(`   rm -rf ${CONFIG.resultsDir}`);
}

// Cleanup function
function cleanup() {
  console.log('\n🧹 Cleaning up test files...');
  try {
    if (fs.existsSync(CONFIG.resultsDir)) {
      fs.rmSync(CONFIG.resultsDir, { recursive: true, force: true });
      console.log('✅ Test files cleaned up');
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n⚠️  Test interrupted by user');
    cleanup();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n⚠️  Test terminated');
    cleanup();
    process.exit(0);
  });
  
  // Run the test
  runPipelineIntegrationTest()
    .then(() => {
      console.log('🎯 Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      cleanup();
      process.exit(1);
    });
}

module.exports = {
  runPipelineIntegrationTest,
  cleanup
}; 