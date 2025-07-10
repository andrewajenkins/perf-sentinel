# perf-sentinel

A lightweight, generic, and automated system that detects performance regressions early in the development lifecycle. It empowers teams by providing immediate feedback on how their code changes impact application speed, directly within their existing workflows.

## Core Principle

The system operates on a simple, three-step principle:

1.  **Capture**: Automatically capture timing data from every test run.
2.  **Compare**: Analyze the new data against a historical baseline to identify statistically significant slowdowns.
3.  **Report**: Notify developers of regressions through actionable, non-blocking reports in formats they already use (like PR comments and Slack).

This tool is packaged as a standalone NPM package and is designed to be easily integrated into any Node.js project that uses Cucumber.js for testing.

## Features

-   **Easy Integration**: Add a simple hook to your Cucumber.js test suite to start capturing data.
-   **Statistical Analysis**: Uses standard deviation to intelligently detect performance regressions, avoiding noise from minor fluctuations.
-   **File-Based Storage**: No external database required. History is stored in a simple JSON file.
-   **Multiple Reporters**: Get results where you need them:
    -   Console
    -   Markdown (for PR comments)
    -   Slack
    -   HTML Reports
-   **CI/CD Ready**: Designed to be a part of your automated pipeline.

## Getting Started

### 1. Installation

```bash
npm install perf-sentinel --save-dev
```

### 2. Add the Cucumber Hook

Create a `support/hooks.js` file (or add to your existing one) in your test suite:

```javascript
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
```

### 3. Run the Analysis

After your tests run and `latest-run.json` is generated, run the analysis tool.

```bash
npx perf-sentinel analyze --run-file ./performance-results/latest-run.json --history-file ./performance-results/history.json
```

## CI/CD Integration Example (GitHub Actions)

Here’s how you can integrate `perf-sentinel` into your GitHub Actions workflow:

```yaml
# .github/workflows/ci.yml
name: CI with Performance Check

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run E2E Tests
        # This step runs Cucumber and generates 'latest-run.json'
        run: npm run test:e2e

      - name: Analyze Performance
        # This is where our tool runs
        run: >
          npx perf-sentinel analyze
          --run-file ./performance-results/latest-run.json
          --history-file ./performance-results/history.json
          --reporter pr-comment
          --reporter slack
        env:
          # Secrets are configured in GitHub repository settings
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_PERF_WEBHOOK }}
``` 