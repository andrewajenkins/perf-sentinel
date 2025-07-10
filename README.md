# perf-sentinel

A lightweight, generic, and automated system that detects performance regressions early in the development lifecycle. It empowers teams by providing immediate feedback on how their code changes impact application speed, directly within their existing workflows.

## Features

-   **Easy Integration**: Add a simple hook to your Cucumber.js test suite to start capturing data.
-   **Statistical Analysis**: Uses standard deviation to intelligently detect performance regressions, avoiding noise from minor fluctuations.
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

### 2. Add the Cucumber Hook

Create a `support/hooks.js` file (or add to your existing one) in your test suite:

```javascript
const { AfterStep, After, Status } = require('@cucumber/cucumber');
const fs = require('fs');
const path = require('path');

const performanceData = [];

AfterStep(function (testStep) {
  if (testStep.result.status === Status.PASSED && testStep.pickleStep) {
    performanceData.push({
      stepText: testStep.pickleStep.text,
      duration: testStep.result.duration.nanos / 1_000_000, // Convert to ms
      timestamp: new Date().toISOString()
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
});
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

#### Options

| Option | Alias | Description | Default | Required |
| :--- | :--- | :--- | :--- | :--- |
| `--run-file` | `-r` | Path to the latest performance run JSON file. | | Yes |
| `--history-file` | `-h` | Path to the historical performance JSON file (fallback when database not used). | | Conditional* |
| `--reporter` | | Specify the reporter(s) to use. | `console` | No |
| `--threshold` | `-t` | Number of standard deviations to use as the regression threshold. | `2.0` | No |
| `--max-history`| | Maximum number of data points to store per test step. | `50` | No |
| `--db-connection` | | MongoDB connection string (enables database storage). | | Conditional* |
| `--db-name` | | Database name to use. | `perf-sentinel` | No |
| `--project-id` | | Project identifier for multi-project support. | `default` | No |

*Either `--db-connection` or `--history-file` must be provided.

### `seed`

Populates a new history file from a collection of past run files. This is useful for establishing an initial performance baseline.

```bash
npx perf-sentinel seed [options]
```

#### Options

| Option | Alias | Description | Default | Required |
| :--- | :--- | :--- | :--- | :--- |
| `--run-files` | | Glob pattern for the run files to seed from. | | Yes |
| `--history-file` | `-h` | Path to the historical performance JSON file to create (fallback when database not used). | | Conditional* |
| `--db-connection` | | MongoDB connection string (enables database storage). | | Conditional* |
| `--db-name` | | Database name to use. | `perf-sentinel` | No |
| `--project-id` | | Project identifier for multi-project support. | `default` | No |

*Either `--db-connection` or `--history-file` must be provided.

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