# perf-sentinel

A lightweight, generic, and automated system that detects performance regressions early in the development lifecycle. It empowers teams by providing immediate feedback on how their code changes impact application speed, directly within their existing workflows.

## ✨ Enterprise-Scale Features

**NEW: Rich Context & Hierarchical Analysis**
- **🏢 Suite-Level Intelligence**: Track performance across test suites with health scoring and regression detection
- **🏷️ Tag-Based Analysis**: Cross-cutting performance insights for `@critical`, `@smoke`, `@slow` operations
- **📊 Multi-Level Reporting**: Suite → Test → Step level performance breakdown
- **🎯 Context-Aware Configuration**: Different thresholds and rules based on test context
- **💡 Smart Recommendations**: Automated suggestions based on performance patterns

## Features

-   **Easy Integration**: Add a simple hook to your Cucumber.js test suite to start capturing data.
-   **Statistical Analysis**: Uses standard deviation to intelligently detect performance regressions, avoiding noise from minor fluctuations.
-   **Rich Context Collection**: Automatically captures test suite, file, tags, and job information for comprehensive analysis.
-   **Hierarchical Performance Analysis**: Monitor performance at suite, test, and step levels with health scoring.
-   **Tag-Based Insights**: Identify critical path issues and cross-cutting performance patterns.
-   **Context-Aware Configuration**: Apply different performance rules based on test suite, tags, or specific steps.
-   **Flexible Storage**: Choose between file-based storage (JSON) or database storage (MongoDB/DocumentDB).
-   **Multi-Project Support**: Organize performance data by project when using database storage.
-   **Multiple Reporters**: Get results where you need them: Console, Markdown, Slack (TBD), PR Comment (TBD), and HTML (TBD).
-   **CI/CD Ready**: Designed to be a part of your automated pipeline.
-   **Auto-Fallback**: Automatically falls back to file storage if database connection fails.

## Getting Started

### 1. Installation

```bash
npm install perf-sentinel --save-dev
```

### 2. Configuration

`perf-sentinel` supports flexible YAML-based configuration to fine-tune performance monitoring for your specific use case. You can:

- Use the built-in defaults for quick setup
- Create custom configuration files for different environments
- Override settings via command-line arguments
- Use predefined profiles for common scenarios
- Configure suite-specific and tag-based performance rules

### 3. Add the Enhanced Cucumber Hook

Create a `support/hooks.js` file (or add to your existing one) in your test suite with rich context collection:

```javascript
const { AfterStep, After, Status } = require('@cucumber/cucumber');
const fs = require('fs');
const path = require('path');

const performanceData = [];

// Helper functions for context extraction
function extractSuiteName(filePath) {
  if (!filePath) return 'unknown';
  const dir = path.dirname(filePath);
  const dirName = path.basename(dir);
  if (dirName && dirName !== '.' && dirName !== 'features') {
    return dirName;
  }
  const fileName = path.basename(filePath, '.feature');
  return fileName || 'unknown';
}

function extractTags(testCase) {
  const tags = [];
  // Get tags from scenario and feature levels
  if (testCase.pickle && testCase.pickle.tags) {
    testCase.pickle.tags.forEach(tag => {
      if (tag.name && tag.name.startsWith('@')) {
        tags.push(tag.name);
      }
    });
  }
  if (testCase.gherkinDocument && testCase.gherkinDocument.feature && testCase.gherkinDocument.feature.tags) {
    testCase.gherkinDocument.feature.tags.forEach(tag => {
      if (tag.name && tag.name.startsWith('@') && !tags.includes(tag.name)) {
        tags.push(tag.name);
      }
    });
  }
  return tags;
}

function getTestName(testCase) {
  if (testCase.pickle && testCase.pickle.name) {
    return testCase.pickle.name;
  }
  return 'Unknown Test';
}

function getRelativeTestPath(testCase) {
  if (testCase.pickle && testCase.pickle.uri) {
    return path.relative(process.cwd(), testCase.pickle.uri);
  }
  return 'unknown.feature';
}

AfterStep(function (testStep, testCase) {
  if (testStep.result.status === Status.PASSED && testStep.pickleStep) {
    // Extract rich context information
    const testFile = getRelativeTestPath(testCase);
    const suite = extractSuiteName(testFile);
    const testName = getTestName(testCase);
    const tags = extractTags(testCase);
    
    // Get job and worker information from environment variables
    const jobId = process.env.CI_JOB_ID || process.env.GITHUB_JOB || process.env.JENKINS_BUILD_NUMBER || 'local';
    const workerId = process.env.CI_RUNNER_ID || process.env.GITHUB_RUNNER_ID || process.env.EXECUTOR_NUMBER || 'local';
    
    // Create enhanced performance data with rich context
    performanceData.push({
      stepText: testStep.pickleStep.text,
      duration: testStep.result.duration.nanos / 1_000_000, // Convert to ms
      timestamp: new Date().toISOString(),
      context: {
        testFile: testFile,
        testName: testName,
        suite: suite,
        tags: tags,
        jobId: jobId,
        workerId: workerId
      }
    });
  }
});

After(async function () {
  const outputDir = path.join(process.cwd(), 'performance-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'latest-run.json'),
    JSON.stringify(performanceData, null, 2)
  );
  
  // Enhanced logging with suite and tag information
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
  
  console.log(`   • Job ID: ${performanceData[0]?.context?.jobId || 'N/A'}`);
  console.log(`   • Data saved to: ${path.join(outputDir, 'latest-run.json')}\n`);
});
```

## Configuration

### Enhanced Configuration with Suite & Tag Support

Create a `perf-sentinel.yml` configuration file to customize analysis behavior:

```yaml
# Basic configuration
project:
  id: "my-app"
  name: "My Application"

# Analysis settings
analysis:
  threshold: 2.0              # Standard deviations for regression detection
  max_history: 50             # Max historical data points per step
  
  # Step classification with different rules for different performance categories
  step_types:
    very_fast:
      max_duration: 50        # Steps under 50ms
      rules:
        min_absolute_slowdown: 15
        min_percentage_change: 10
        
    fast:
      max_duration: 100       # Steps under 100ms  
      rules:
        min_absolute_slowdown: 10
        min_percentage_change: 10
        check_trends: true
        
    medium:
      max_duration: 500       # Steps under 500ms
      rules:
        min_absolute_slowdown: 25
        min_percentage_change: 5
        
    slow:
      max_duration: null      # All other steps
      rules:
        min_absolute_slowdown: 50
        min_percentage_change: 3

  # NEW: Suite-level configuration overrides
  suite_overrides:
    authentication:
      threshold: 1.5          # More sensitive for auth suite
      rules:
        min_percentage_change: 2
        min_absolute_slowdown: 15
    shopping:
      threshold: 2.5          # More lenient for shopping suite
      rules:
        min_percentage_change: 5

  # NEW: Tag-based configuration overrides
  tag_overrides:
    "@critical":
      threshold: 1.2          # Very sensitive for critical tagged steps
      rules:
        min_absolute_slowdown: 10
        min_percentage_change: 5
    "@smoke":
      threshold: 1.8          # Moderately sensitive for smoke tests
      rules:
        min_absolute_slowdown: 12
        min_percentage_change: 8
    "@slow":
      threshold: 3.0          # More lenient for known slow operations
      rules:
        min_absolute_slowdown: 100
        min_percentage_change: 10

  # Trend detection
  trends:
    enabled: true
    window_size: 3
    min_significance: 10      # Minimum trend significance in ms
    
  # Step-specific overrides
  step_overrides:
    "I log in as a standard user":
      threshold: 1.5          # More sensitive for critical steps
      rules:
        min_absolute_slowdown: 25

# Reporting configuration  
reporting:
  default_reporters: ["console", "markdown"]
  console:
    show_analysis_rules: true
    colors: true
```

### Environment-Specific Configuration

Use environment overrides for different deployment stages:

```yaml
# In your perf-sentinel.yml
environments:
  production:
    analysis:
      threshold: 1.8          # Stricter in production
      suite_overrides:
        authentication:
          threshold: 1.5      # Extra strict for auth in production
      tag_overrides:
        "@critical":
          threshold: 1.2      # Ultra strict for critical in production
        
  development:
    analysis:
      threshold: 2.5          # More lenient in dev
      trends:
        enabled: false        # Skip trend analysis in dev
      suite_overrides:
        authentication:
          threshold: 2.0      # Less strict for auth in dev
```

### Predefined Profiles

Use built-in profiles for common scenarios:

```bash
# Strict monitoring for performance-critical applications
npx perf-sentinel analyze --config perf-sentinel.yml --profile strict

# Lenient monitoring for development
npx perf-sentinel analyze --config perf-sentinel.yml --profile lenient

# CI/CD optimized settings
npx perf-sentinel analyze --config perf-sentinel.yml --profile ci_focused
```

## Enhanced Analysis Output

The enhanced analysis provides multi-level insights:

### Suite-Level Analysis
```
🏢 Suite Analysis:
   📁 Suite: authentication
      • Performance: GOOD (low severity)
      • Health Score: 95% 🎯
      • Steps: 4 total (R:0 N:1 OK:3)
      • Duration: 425.2ms avg (45-1200ms range)
      • Critical Steps: 3, Smoke Steps: 2
      • Recommendations:
        - All steps performing within expected thresholds
```

### Tag-Based Analysis
```
🏷️ Tag Analysis:
   • @critical: 5 steps, avg 675ms across 2 suites
   • @smoke: 3 steps, avg 245ms across 3 suites
   • @slow: 2 steps, avg 1850ms - consider optimization
```

### Critical Path Analysis
```
🚨 Critical Path Issues:
   • 1 regression(s) detected in critical path steps
   • High priority: Investigate critical regressions immediately
```

## Storage Options

`perf-sentinel` supports two storage backends:

### File-Based Storage (Default)
- **Best for**: Small to medium teams, simple setups, getting started
- **Pros**: No external dependencies, version-controlled history, simple to debug
- **Cons**: Repository size growth, potential merge conflicts, not suitable for high-frequency runs

### Database Storage (MongoDB/DocumentDB)
- **Best for**: Large teams, high-frequency testing, multiple projects, production environments
- **Pros**: Scalable, supports multiple projects, no repository bloat, concurrent access
- **Cons**: Requires database setup and management

### Configuration

#### Using MongoDB/DocumentDB

```bash
# Set environment variables (recommended)
export MONGODB_CONNECTION_STRING="mongodb+srv://user:pass@cluster.mongodb.net/"
export MONGODB_DB_NAME="perf-sentinel"
export PROJECT_ID="my-project"

# Or pass directly via command line
npx perf-sentinel analyze \
  --run-file ./performance-results.json \
  --db-connection "$MONGODB_CONNECTION_STRING" \
  --db-name "perf-sentinel" \
  --project-id "my-project"
```

#### Connection String Examples

```bash
# MongoDB Atlas
mongodb+srv://username:password@cluster.mongodb.net/

# Local MongoDB
mongodb://localhost:27017/

# AWS DocumentDB
mongodb://username:password@docdb-cluster.cluster-id.region.docdb.amazonaws.com:27017/
```

## Usage

`perf-sentinel` is a command-line tool with two main commands: `analyze` and `seed`.

### `analyze`

Analyzes a new performance run against historical data, reports regressions, and updates the history file.

```bash
npx perf-sentinel analyze [options]
```

#### Quick Start Examples

```bash
# Using configuration file
npx perf-sentinel analyze --config perf-sentinel.yml --run-file results.json

# Using file storage (simple setup)
npx perf-sentinel analyze --run-file results.json --history-file history.json

# Using database storage
npx perf-sentinel analyze --run-file results.json --db-connection mongodb://localhost:27017

# Using environment-specific settings
npx perf-sentinel analyze --config perf-sentinel.yml --environment production

# Override configuration via CLI
npx perf-sentinel analyze --config perf-sentinel.yml --threshold 1.5 --reporter console markdown
```

#### Options

| Option | Alias | Description | Default | Required |
| :--- | :--- | :--- | :--- | :--- |
| `--run-file` | `-r` | Path to the latest performance run JSON file. | | Yes |
| `--config` | `-c` | Path to YAML configuration file. | | Conditional* |
| `--profile` | | Configuration profile to use (strict, lenient, ci_focused). | | No |
| `--environment` | `-e` | Environment-specific configuration (production, staging, development). | | No |
| `--history-file` | `-h` | Path to the historical performance JSON file (fallback when database not used). | | Conditional* |
| `--reporter` | | Specify the reporter(s) to use. | From config | No |
| `--threshold` | `-t` | Number of standard deviations to use as the regression threshold. | From config | No |
| `--max-history`| | Maximum number of data points to store per test step. | From config | No |
| `--db-connection` | | MongoDB connection string (enables database storage). | | Conditional* |
| `--db-name` | | Database name to use. | From config | No |
| `--project-id` | | Project identifier for multi-project support. | From config | No |

*Either `--config`, `--db-connection`, or `--history-file` must be provided.

### `seed`

Populates a new history file from a collection of past run files. This is useful for establishing an initial performance baseline.

```bash
npx perf-sentinel seed [options]
```

#### Examples

```bash
# Using configuration file
npx perf-sentinel seed --config perf-sentinel.yml --run-files "./historical-runs/*.json"

# Using file storage
npx perf-sentinel seed --run-files "./historical-runs/*.json" --history-file history.json

# Using database storage  
npx perf-sentinel seed --run-files "./historical-runs/*.json" --db-connection mongodb://localhost:27017
```

#### Options

| Option | Alias | Description | Default | Required |
| :--- | :--- | :--- | :--- | :--- |
| `--run-files` | | Glob pattern for the run files to seed from. | | Yes |
| `--config` | `-c` | Path to YAML configuration file. | | Conditional* |
| `--profile` | | Configuration profile to use (strict, lenient, ci_focused). | | No |
| `--environment` | `-e` | Environment-specific configuration (production, staging, development). | | No |
| `--history-file` | `-h` | Path to the historical performance JSON file to create (fallback when database not used). | | Conditional* |
| `--db-connection` | | MongoDB connection string (enables database storage). | | Conditional* |
| `--db-name` | | Database name to use. | From config | No |
| `--project-id` | | Project identifier for multi-project support. | From config | No |

*Either `--config`, `--db-connection`, or `--history-file` must be provided.

## How File-Based Storage Works in CI/CD

1. **The history file lives in your repository**: The `history.json` file is committed to your Git repository alongside your code
2. **Each CI run updates the file**: When the CI pipeline runs `perf-sentinel analyze`, it:
   - Reads the current `history.json` from the repository
   - Compares the new run data against it
   - Updates the file with new data points
   - The updated file becomes part of the commit/PR

3. **Git handles the persistence**: The history data persists across CI runs because it's version-controlled

## Example Workflows

### File-Based Storage Workflow

```bash
# In your CI pipeline:
git checkout main
npm run test:e2e  # This generates latest-run.json
npx perf-sentinel analyze \
  --run-file ./performance-results/latest-run.json \
  --history-file ./performance-results/history.json
git add performance-results/history.json
git commit -m "Update performance history"
git push
```

### Database Storage Workflow

```bash
# In your CI pipeline:
git checkout main
npm run test:e2e  # This generates latest-run.json

# Set environment variables (or use CI/CD secrets)
export MONGODB_CONNECTION_STRING="mongodb+srv://user:pass@cluster.mongodb.net/"
export PROJECT_ID="my-web-app"

# Analyze with database storage
npx perf-sentinel analyze \
  --run-file ./performance-results/latest-run.json \
  --db-connection "$MONGODB_CONNECTION_STRING" \
  --project-id "$PROJECT_ID"

# No need to commit history file - it's stored in database
```

### Multi-Project Setup

```bash
# Project A
npx perf-sentinel analyze \
  --run-file ./results.json \
  --db-connection "$MONGODB_CONNECTION_STRING" \
  --project-id "project-a"

# Project B
npx perf-sentinel analyze \
  --run-file ./results.json \
  --db-connection "$MONGODB_CONNECTION_STRING" \
  --project-id "project-b"
```

## Advanced Features

### Enterprise-Scale Performance Intelligence

**Suite Health Scoring**: Automated health scores (0-100) based on:
- Regression rate (30% weight)
- Performance trends (25% weight) 
- Step stability (20% weight)
- Critical path impact (25% weight)

**Smart Recommendations**: Context-aware suggestions:
- "Investigate 2 regressed step(s) in authentication suite"
- "Critical steps averaging 1250ms - performance impact on user experience"
- "Smoke tests span 4 suites - consider test suite organization"

**Tag-Based Intelligence**: Cross-cutting analysis:
- Critical path monitoring (`@critical`, `@smoke`, `@security`)
- Performance impact analysis across test suites
- Optimization recommendations for slow operations

**Context-Aware Configuration**: Different rules based on:
- Test suite (stricter for authentication, lenient for data processing)
- Tags (ultra-strict for `@critical`, relaxed for `@slow`)
- Environment (production vs development vs staging)

## Pros and Cons

### File-Based Storage

**Pros:**
- ✅ No external dependencies (no database setup)
- ✅ Simple to understand and debug
- ✅ History is version-controlled and auditable
- ✅ Works offline
- ✅ No authentication/connection issues

**Cons:**
- ❌ Repository size grows over time
- ❌ Potential merge conflicts if multiple PRs update history simultaneously
- ❌ Not suitable for very high-frequency runs
- ❌ History is tied to the repository

### Database Storage

**Pros:**
- ✅ Scalable for high-frequency testing
- ✅ Multi-project support
- ✅ No repository bloat
- ✅ Concurrent access from multiple teams/PRs
- ✅ Centralized performance data management
- ✅ Automatic fallback to file storage if database unavailable

**Cons:**
- ❌ Requires database setup and management
- ❌ Additional dependency (MongoDB)
- ❌ Network dependency for CI/CD
- ❌ Authentication/connection configuration needed

## Getting Started Recommendations

- **Start with file-based storage** if you're new to performance monitoring or have a small team
- **Migrate to database storage** when you experience repository bloat or merge conflicts
- **Use database storage from the start** if you have multiple projects or run tests very frequently

The tool automatically falls back to file storage if database connection fails, so you can set up database storage as a future enhancement without breaking existing workflows.

## Advanced Configuration Examples

### Performance-Critical Applications

For applications where performance is critical, use strict monitoring:

```yaml
# perf-sentinel-strict.yml
analysis:
  threshold: 1.5              # More sensitive
  suite_overrides:
    authentication:
      threshold: 1.2          # Ultra-strict for auth
      rules:
        min_percentage_change: 2
        min_absolute_slowdown: 10
    payment:
      threshold: 1.3          # Strict for payment
      rules:
        min_percentage_change: 3
        min_absolute_slowdown: 15
  tag_overrides:
    "@critical":
      threshold: 1.0          # Extremely strict for critical
      rules:
        min_percentage_change: 1
        min_absolute_slowdown: 5
    "@smoke":
      threshold: 1.4          # Strict for smoke tests
      rules:
        min_percentage_change: 4
        min_absolute_slowdown: 8
  global_rules:
    min_percentage_change: 2   # Report 2%+ changes
    filter_stable_steps: false # Don't filter anything
```

### Development Environment

For development, use lenient settings to avoid noise:

```yaml
# perf-sentinel-dev.yml
analysis:
  threshold: 3.0              # Very lenient
  suite_overrides:
    authentication:
      threshold: 2.5          # Less strict for auth in dev
    shopping:
      threshold: 3.5          # Very lenient for shopping
  tag_overrides:
    "@critical":
      threshold: 2.0          # Less strict for critical in dev
    "@slow":
      threshold: 4.0          # Very lenient for slow ops
  global_rules:
    min_percentage_change: 15 # Only major changes
  trends:
    enabled: false            # No trend analysis
```

### CI/CD Pipeline

For continuous integration, focus on immediate regressions:

```yaml
# perf-sentinel-ci.yml  
analysis:
  threshold: 1.8
  suite_overrides:
    authentication:
      threshold: 1.5          # Keep auth strict in CI
    api:
      threshold: 2.0          # Moderate for API tests
  tag_overrides:
    "@critical":
      threshold: 1.3          # Strict for critical in CI
    "@smoke":
      threshold: 1.6          # Moderate for smoke tests
  trends:
    enabled: false            # Faster execution
reporting:
  default_reporters: ["console"]
  console:
    colors: false             # Better for CI logs
    show_analysis_rules: false
```

### Step-Specific Tuning

Customize rules for specific operations:

```yaml
analysis:
  step_overrides:
    "I log in as a standard user":
      threshold: 1.2          # Critical login flow
      rules:
        min_absolute_slowdown: 25
        min_percentage_change: 5
        
    "I search for products":
      threshold: 2.5          # Search can be variable
      rules:
        min_absolute_slowdown: 100
        min_percentage_change: 15
        
    "I load large dataset":
      threshold: 3.0          # Expected to be slow
      step_type: "slow"
      rules:
        min_absolute_slowdown: 500
        min_percentage_change: 20
```

### Multi-Environment Setup

Use environment variables and overrides:

```yaml
# Base configuration
project:
  id: "${PROJECT_ID:-my-app}"

storage:
  type: "database"
  database:
    connection: "${MONGODB_CONNECTION_STRING}"
    name: "${MONGODB_DB_NAME:-perf-sentinel}"

environments:
  production:
    analysis:
      threshold: 1.5
      suite_overrides:
        authentication:
          threshold: 1.2
        payment:
          threshold: 1.3
      tag_overrides:
        "@critical":
          threshold: 1.0
  staging:
    analysis:
      threshold: 2.0
      suite_overrides:
        authentication:
          threshold: 1.6
      tag_overrides:
        "@critical":
          threshold: 1.4
  development:
    analysis:
      threshold: 3.0
      suite_overrides:
        authentication:
          threshold: 2.5
      tag_overrides:
        "@critical":
          threshold: 2.0
      trends:
        enabled: false
```

Then use:

```bash
export PROJECT_ID="my-app-prod"
export MONGODB_CONNECTION_STRING="mongodb://prod-server:27017"

npx perf-sentinel analyze --config perf-sentinel.yml --environment production
``` 