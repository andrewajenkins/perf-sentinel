// support/hooks.js
const { AfterStep, After, Status } = require('@cucumber/cucumber');
const fs = require('fs');
const path = require('path');

// Use a temporary array to store results during the run
const performanceData = [];

// Helper function to extract suite name from file path
function extractSuiteName(filePath) {
  if (!filePath) return 'unknown';
  
  // Extract the directory name containing the feature file
  const dir = path.dirname(filePath);
  const dirName = path.basename(dir);
  
  // If the feature file is in a subdirectory, use that as the suite name
  // Otherwise, use the feature file name without extension
  if (dirName && dirName !== '.' && dirName !== 'features') {
    return dirName;
  }
  
  // Fallback to feature file name without extension
  const fileName = path.basename(filePath, '.feature');
  return fileName || 'unknown';
}

// Helper function to extract tags from test scenario
function extractTags(testCase) {
  const tags = [];
  
  // Get tags from the test case (scenario level)
  if (testCase.pickle && testCase.pickle.tags) {
    testCase.pickle.tags.forEach(tag => {
      if (tag.name && tag.name.startsWith('@')) {
        tags.push(tag.name);
      }
    });
  }
  
  // Get tags from the feature level
  if (testCase.gherkinDocument && testCase.gherkinDocument.feature && testCase.gherkinDocument.feature.tags) {
    testCase.gherkinDocument.feature.tags.forEach(tag => {
      if (tag.name && tag.name.startsWith('@') && !tags.includes(tag.name)) {
        tags.push(tag.name);
      }
    });
  }
  
  return tags;
}

// Helper function to get test name from scenario
function getTestName(testCase) {
  if (testCase.pickle && testCase.pickle.name) {
    return testCase.pickle.name;
  }
  
  // Fallback to step text if scenario name not available
  return 'Unknown Test';
}

// Helper function to get relative test file path
function getRelativeTestPath(testCase) {
  if (testCase.pickle && testCase.pickle.uri) {
    // Convert absolute path to relative path from project root
    const relativePath = path.relative(process.cwd(), testCase.pickle.uri);
    return relativePath;
  }
  
  return 'unknown.feature';
}

AfterStep(function (testStep, testCase) {
  // We only care about the performance of steps that passed successfully
  if (testStep.result.status === Status.PASSED && testStep.pickleStep) {
    
    // Extract rich context information
    const testFile = getRelativeTestPath(testCase);
    const suite = extractSuiteName(testFile);
    const testName = getTestName(testCase);
    const tags = extractTags(testCase);
    
    // Get job and worker information from environment variables
    const jobId = process.env.CI_JOB_ID || process.env.GITHUB_JOB || process.env.JENKINS_BUILD_NUMBER || 'local';
    const workerId = process.env.CI_RUNNER_ID || process.env.GITHUB_RUNNER_ID || process.env.EXECUTOR_NUMBER || 'local';
    
    // Get PR-level context information
    const prNumber = process.env.PR_NUMBER || process.env.PULL_REQUEST_NUMBER || 
                     process.env.GITHUB_PR_NUMBER || process.env.CI_MERGE_REQUEST_IID || null;
    const commitSha = process.env.COMMIT_SHA || process.env.GITHUB_SHA || 
                      process.env.CI_COMMIT_SHA || process.env.GIT_COMMIT || null;
    const branch = process.env.BRANCH_NAME || process.env.GITHUB_HEAD_REF || 
                   process.env.CI_COMMIT_REF_NAME || process.env.GIT_BRANCH || null;
    const targetBranch = process.env.TARGET_BRANCH || process.env.GITHUB_BASE_REF || 
                         process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME || 'main';
    const authorName = process.env.COMMIT_AUTHOR_NAME || process.env.GITHUB_ACTOR || 
                       process.env.CI_COMMIT_AUTHOR || null;
    const authorEmail = process.env.COMMIT_AUTHOR_EMAIL || process.env.CI_COMMIT_AUTHOR_EMAIL || null;
    
    // Create enhanced performance data with rich context including PR information
    performanceData.push({
      stepText: testStep.pickleStep.text,
      // The duration from Cucumber is in nanoseconds. We convert to milliseconds.
      duration: testStep.result.duration.nanos / 1_000_000,
      timestamp: new Date().toISOString(),
      context: {
        testFile: testFile,
        testName: testName,
        suite: suite,
        tags: tags,
        jobId: jobId,
        workerId: workerId,
        // Add PR-level context
        prNumber: prNumber,
        commitSha: commitSha,
        branch: branch,
        targetBranch: targetBranch,
        authorName: authorName,
        authorEmail: authorEmail
      }
    });
  }
});

// After all tests are finished, write the results to a file
After(async function () {
  // Ensure the output directory exists
  const outputDir = path.join(process.cwd(), 'performance-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  // Write the data to a file. This is the input for our CLI tool.
  fs.writeFileSync(
    path.join(outputDir, 'latest-run.json'),
    JSON.stringify(performanceData, null, 2)
  );
  
  // Enhanced logging with suite, tag, and PR information
  console.log(`\n📊 Performance data collected:`);
  console.log(`   • ${performanceData.length} steps recorded`);
  
  // Group by suite for summary
  const suiteStats = {};
  performanceData.forEach(step => {
    const suite = step.context.suite;
    if (!suiteStats[suite]) {
      suiteStats[suite] = { count: 0, avgDuration: 0, totalDuration: 0 };
    }
    suiteStats[suite].count++;
    suiteStats[suite].totalDuration += step.duration;
  });
  
  // Calculate averages and display suite summary
  Object.keys(suiteStats).forEach(suite => {
    const stats = suiteStats[suite];
    stats.avgDuration = stats.totalDuration / stats.count;
    console.log(`   • Suite "${suite}": ${stats.count} steps, avg ${stats.avgDuration.toFixed(1)}ms`);
  });
  
  // Show unique tags found
  const allTags = new Set();
  performanceData.forEach(step => {
    step.context.tags.forEach(tag => allTags.add(tag));
  });
  
  if (allTags.size > 0) {
    console.log(`   • Tags found: ${Array.from(allTags).join(', ')}`);
  }
  
  // Enhanced logging with PR context
  console.log(`   • Job ID: ${performanceData[0]?.context?.jobId || 'N/A'}`);
  console.log(`   • Worker ID: ${performanceData[0]?.context?.workerId || 'N/A'}`);
  
  // Add PR-level context to logging
  const prContext = performanceData[0]?.context;
  if (prContext) {
    if (prContext.prNumber) {
      console.log(`   • PR Number: ${prContext.prNumber}`);
    }
    if (prContext.commitSha) {
      console.log(`   • Commit SHA: ${prContext.commitSha.substring(0, 8)}...`);
    }
    if (prContext.branch) {
      console.log(`   • Branch: ${prContext.branch}`);
    }
    if (prContext.targetBranch && prContext.targetBranch !== 'main') {
      console.log(`   • Target Branch: ${prContext.targetBranch}`);
    }
    if (prContext.authorName) {
      console.log(`   • Author: ${prContext.authorName}`);
    }
  }
  
  console.log(`   • Data saved to: ${path.join(outputDir, 'latest-run.json')}\n`);
}); 