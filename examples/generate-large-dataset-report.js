#!/usr/bin/env node

/**
 * Example script showing how to generate an optimized HTML report for large datasets
 */

const fs = require('fs');
const path = require('path');
const { generateReport } = require('../src/reporters/html-simple');

// Create a large dataset for testing
function createLargeDataset() {
  const steps = [];
  const stepTemplates = [
    'I navigate to the login page',
    'I enter valid username and password',
    'I click the login button',
    'I should be redirected to the dashboard',
    'I am on the checkout page',
    'I select credit card as payment method',
    'I enter valid credit card details',
    'I click the complete purchase button',
    'I should see order confirmation',
    'I attempt to login with wrong credentials',
    'my account should be locked'
  ];

  const suites = ['authentication', 'shopping', 'user-management', 'reports', 'admin'];
  const tags = ['@critical', '@smoke', '@fast', '@medium', '@slow', '@security'];

  // Generate 600 steps to trigger the large dataset optimization
  for (let i = 0; i < 600; i++) {
    const stepTemplate = stepTemplates[i % stepTemplates.length];
    const suite = suites[i % suites.length];
    const randomTags = tags.slice(0, Math.floor(Math.random() * 3) + 1);
    
    steps.push({
      stepText: `${stepTemplate} (test ${i + 1})`,
      duration: Math.random() * 2000 + 50, // 50-2050ms
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      context: {
        testFile: `examples/features/${suite}/test-${i}.feature`,
        testName: `Test scenario ${i + 1}`,
        suite: suite,
        tags: randomTags,
        jobId: `job-${suite}-${Math.floor(i / 10)}`,
        workerId: `worker-${(i % 5) + 1}`
      }
    });
  }

  return steps;
}

// Generate a mock report with the large dataset
function generateMockReport() {
  const allSteps = createLargeDataset();
  
  // Split into different categories for realistic report
  const regressions = allSteps.slice(0, 25).map(step => ({
    ...step,
    average: step.duration * 0.8,
    slowdown: step.duration * 0.2,
    percentage: 20 + Math.random() * 30
  }));

  const newSteps = allSteps.slice(25, 50);
  const ok = allSteps.slice(50);

  return {
    regressions,
    newSteps,
    ok,
    metadata: {
      totalSteps: allSteps.length,
      uniqueSteps: allSteps.length,
      suites: ['authentication', 'shopping', 'user-management', 'reports', 'admin'],
      tags: ['@critical', '@smoke', '@fast', '@medium', '@slow', '@security'],
      jobs: ['job-1', 'job-2', 'job-3'],
      timestamp: new Date().toISOString(),
      overallHealth: 75
    }
  };
}

// Main function
async function main() {
  console.log('🚀 Generating large dataset HTML report...');
  
  const report = generateMockReport();
  const outputPath = path.join(__dirname, 'large-dataset-report.html');
  
  try {
    await generateReport(report, {
      outputPath,
      title: 'Large Dataset Performance Report - Demo',
      includeCharts: false,
      includeInteractive: true
    });
    
    console.log(`✅ Report generated successfully!`);
    console.log(`📊 Report contains ${report.regressions.length + report.newSteps.length + report.ok.length} steps`);
    console.log(`📁 File saved to: ${outputPath}`);
    console.log(`🌐 Open the file in your browser to view the optimized report`);
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
} 