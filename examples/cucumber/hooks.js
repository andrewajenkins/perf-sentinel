// support/hooks.js
const { AfterStep, After, Status } = require('@cucumber/cucumber');
const fs = require('fs');
const path = require('path');

// Use a temporary array to store results during the run
const performanceData = [];

AfterStep(function (testStep) {
  // We only care about the performance of steps that passed successfully
  if (testStep.result.status === Status.PASSED && testStep.pickleStep) {
    performanceData.push({
      stepText: testStep.pickleStep.text,
      // The duration from Cucumber is in nanoseconds. We convert to milliseconds.
      duration: testStep.result.duration.nanos / 1_000_000,
      timestamp: new Date().toISOString()
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
}); 