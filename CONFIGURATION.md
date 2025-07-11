# perf-sentinel Configuration Guide

This guide provides comprehensive configuration examples for setting up perf-sentinel with different storage adapters and CI/CD integrations.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Storage Adapters](#storage-adapters)
3. [Analysis Configuration](#analysis-configuration)
4. [CI/CD Integration](#cicd-integration)
5. [Environment-Specific Configuration](#environment-specific-configuration)
6. [Advanced Configuration](#advanced-configuration)
7. [Configuration Reference](#configuration-reference)

## Quick Start

### Basic Configuration File

Create a `perf-sentinel.yml` file in your project root:

```yaml
# Basic perf-sentinel configuration
project:
  id: "my-app"
  name: "My Application"

# Use filesystem storage (easiest to get started)
storage:
  adapter_type: "filesystem"
  filesystem:
    base_directory: "./performance-results"

# Basic analysis settings
analysis:
  threshold: 2.0
  max_history: 50

# Console reporting
reporting:
  default_reporters: ["console"]
```

### Using the Configuration

```bash
# Analyze performance data
npx perf-sentinel analyze --config perf-sentinel.yml --run-file latest-run.json

# Seed historical data
npx perf-sentinel seed --config perf-sentinel.yml --run-files "./historical-runs/*.json"

# Check system health
npx perf-sentinel health-check --config perf-sentinel.yml
```

## Storage Adapters

### FileSystem Adapter (Development)

**Best for**: Local development, small teams, getting started

```yaml
# perf-sentinel-dev.yml
project:
  id: "my-app-dev"
  name: "My Application (Development)"

storage:
  adapter_type: "filesystem"
  filesystem:
    base_directory: "./performance-results"
  
  # Data retention (optional)
  retention:
    performance_runs: 30    # Keep run data for 30 days
    job_coordination: 7     # Keep job data for 7 days
    completed_jobs: 3       # Keep completed job data for 3 days

analysis:
  threshold: 2.5  # More lenient for development
  trends:
    enabled: false  # Skip trend analysis in dev

reporting:
  default_reporters: ["console", "html"]
  html:
    template: "standard"
    include_charts: true
```

### S3 Adapter (CI/CD Production)

**Best for**: CI/CD pipelines, distributed testing, scalable storage

```yaml
# perf-sentinel-ci.yml
project:
  id: "my-app-prod"
  name: "My Application (Production)"

storage:
  adapter_type: "s3"
  s3:
    bucket_name: "${S3_BUCKET_NAME}"
    region: "${AWS_REGION:-us-east-1}"
    prefix: "${S3_PREFIX:-perf-sentinel}"
  
  # Data retention for cost management
  retention:
    performance_runs: 90    # Keep run data for 90 days
    job_coordination: 30    # Keep job data for 30 days
    completed_jobs: 7       # Keep completed job data for 7 days

analysis:
  threshold: 1.8  # Stricter for production
  suite_overrides:
    authentication:
      threshold: 1.5  # Extra strict for auth
  tag_overrides:
    "@critical":
      threshold: 1.2  # Ultra strict for critical paths

reporting:
  default_reporters: ["console", "html"]
  html:
    template: "standard"
    include_charts: true
```

#### S3 Environment Variables

```bash
# Set these environment variables for S3 adapter
export S3_BUCKET_NAME="my-perf-monitoring-bucket"
export AWS_REGION="us-east-1"
export S3_PREFIX="perf-sentinel"

# AWS credentials (use IAM roles in production)
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
```

### Database Adapter (Analytics)

**Best for**: Large teams, high-frequency testing, advanced analytics

```yaml
# perf-sentinel-analytics.yml
project:
  id: "my-app-analytics"
  name: "My Application (Analytics)"

storage:
  adapter_type: "database"
  database:
    connection: "${MONGODB_CONNECTION_STRING}"
    name: "${MONGODB_DB_NAME:-perf-sentinel}"
  
  # Data retention for database optimization
  retention:
    performance_runs: 180   # Keep run data for 6 months
    job_coordination: 60    # Keep job data for 2 months
    completed_jobs: 30      # Keep completed job data for 1 month

analysis:
  threshold: 2.0
  trends:
    enabled: true
    window_size: 5
    min_significance: 15

reporting:
  default_reporters: ["console", "html"]
  html:
    template: "standard"
    include_charts: true
```

#### Database Environment Variables

```bash
# MongoDB Atlas
export MONGODB_CONNECTION_STRING="mongodb+srv://user:pass@cluster.mongodb.net/"
export MONGODB_DB_NAME="perf-sentinel"

# Local MongoDB
export MONGODB_CONNECTION_STRING="mongodb://localhost:27017/"

# AWS DocumentDB
export MONGODB_CONNECTION_STRING="mongodb://user:pass@docdb-cluster.cluster-id.region.docdb.amazonaws.com:27017/"
```

### Auto-Detection (Recommended)

The adapter can automatically detect the best storage type based on your configuration:

```yaml
# perf-sentinel-auto.yml
project:
  id: "my-app"
  name: "My Application"

storage:
  adapter_type: "auto"  # Automatically detect based on available config
  
  # Define all possible storage options
  database:
    connection: "${MONGODB_CONNECTION_STRING}"
    name: "${MONGODB_DB_NAME:-perf-sentinel}"
  
  s3:
    bucket_name: "${S3_BUCKET_NAME}"
    region: "${AWS_REGION:-us-east-1}"
    prefix: "${S3_PREFIX:-perf-sentinel}"
  
  filesystem:
    base_directory: "./performance-results"
  
  # Priority order (if multiple are configured):
  # 1. Database (if connection string provided)
  # 2. S3 (if bucket name provided)
  # 3. Filesystem (fallback)
```

## Analysis Configuration

### Context-Aware Performance Rules

```yaml
analysis:
  # Base threshold (standard deviations)
  threshold: 2.0
  
  # Suite-specific rules
  suite_overrides:
    authentication:
      threshold: 1.5          # More sensitive for auth
      rules:
        min_percentage_change: 3
        min_absolute_slowdown: 20
    
    shopping:
      threshold: 2.5          # More lenient for shopping
      rules:
        min_percentage_change: 8
        min_absolute_slowdown: 50
    
    reporting:
      threshold: 3.0          # Most lenient for reports
      rules:
        min_percentage_change: 15
        min_absolute_slowdown: 100

  # Tag-based rules
  tag_overrides:
    "@critical":
      threshold: 1.2          # Ultra strict for critical
      rules:
        min_percentage_change: 2
        min_absolute_slowdown: 10
    
    "@smoke":
      threshold: 1.8          # Strict for smoke tests
      rules:
        min_percentage_change: 5
        min_absolute_slowdown: 15
    
    "@slow":
      threshold: 4.0          # Lenient for known slow ops
      rules:
        min_percentage_change: 20
        min_absolute_slowdown: 200

  # Step-specific overrides
  step_overrides:
    "I log in as a standard user":
      threshold: 1.3          # Critical login step
      rules:
        min_absolute_slowdown: 25
        min_percentage_change: 5
```

### Performance Step Classification

```yaml
analysis:
  # Classify steps by duration for different rules
  step_types:
    very_fast:
      max_duration: 50      # Under 50ms
      rules:
        min_absolute_slowdown: 15
        min_percentage_change: 10
        ignore_small_changes: true
    
    fast:
      max_duration: 100     # Under 100ms
      rules:
        min_absolute_slowdown: 10
        min_percentage_change: 10
        check_trends: true
    
    medium:
      max_duration: 500     # Under 500ms
      rules:
        min_absolute_slowdown: 25
        min_percentage_change: 5
    
    slow:
      max_duration: null    # 500ms and above
      rules:
        min_absolute_slowdown: 50
        min_percentage_change: 3
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/performance-monitoring.yml
name: Performance Monitoring

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]

jobs:
  performance-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install perf-sentinel
      run: npm install -g perf-sentinel
    
    - name: Run tests and collect performance data
      run: |
        # Your test command that generates performance data
        npm run test:performance
        
    - name: Analyze performance
      env:
        S3_BUCKET_NAME: ${{ secrets.S3_BUCKET_NAME }}
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        AWS_REGION: "us-east-1"
      run: |
        perf-sentinel analyze \
          --config perf-sentinel-ci.yml \
          --run-file ./performance-results/latest-run.json \
          --reporter console html \
          --html-output performance-report.html
    
    - name: Upload performance report
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: performance-report
        path: performance-report.html
    
    - name: Comment on PR
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          if (fs.existsSync('performance-report.html')) {
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '📊 Performance report generated! Check the Actions artifacts for the detailed HTML report.'
            });
          }
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        S3_BUCKET_NAME = credentials('s3-bucket-name')
        AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')
        AWS_REGION = 'us-east-1'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
                sh 'npm install -g perf-sentinel'
            }
        }
        
        stage('Run Performance Tests') {
            steps {
                sh 'npm run test:performance'
            }
        }
        
        stage('Analyze Performance') {
            steps {
                sh '''
                    perf-sentinel analyze \
                        --config perf-sentinel-ci.yml \
                        --run-file ./performance-results/latest-run.json \
                        --reporter console html \
                        --html-output performance-report.html
                '''
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'performance-report.html', allowEmptyArchive: true
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: '.',
                reportFiles: 'performance-report.html',
                reportName: 'Performance Report'
            ])
        }
    }
}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - performance

variables:
  S3_BUCKET_NAME: "$S3_BUCKET_NAME"
  AWS_REGION: "us-east-1"

performance-analysis:
  stage: performance
  image: node:18
  
  before_script:
    - npm ci
    - npm install -g perf-sentinel
  
  script:
    - npm run test:performance
    - |
      perf-sentinel analyze \
        --config perf-sentinel-ci.yml \
        --run-file ./performance-results/latest-run.json \
        --reporter console html \
        --html-output performance-report.html
  
  artifacts:
    reports:
      junit: performance-report.html
    paths:
      - performance-report.html
    expire_in: 1 week
  
  only:
    - merge_requests
    - main
```

### Multi-Job CI/CD (Parallel Testing)

```yaml
# .github/workflows/parallel-performance.yml
name: Parallel Performance Testing

on:
  pull_request:
    branches: [ main ]

jobs:
  # Run tests in parallel
  test-auth:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install dependencies
      run: |
        npm ci
        npm install -g perf-sentinel
    - name: Run auth tests
      env:
        JOB_ID: "auth-${{ github.run_id }}"
      run: |
        npm run test:auth
        perf-sentinel analyze \
          --config perf-sentinel-ci.yml \
          --run-file ./performance-results/latest-run.json
  
  test-api:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install dependencies
      run: |
        npm ci
        npm install -g perf-sentinel
    - name: Run API tests
      env:
        JOB_ID: "api-${{ github.run_id }}"
      run: |
        npm run test:api
        perf-sentinel analyze \
          --config perf-sentinel-ci.yml \
          --run-file ./performance-results/latest-run.json
  
  # Aggregate results
  aggregate:
    needs: [test-auth, test-api]
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install dependencies
      run: |
        npm ci
        npm install -g perf-sentinel
    - name: Aggregate results
      env:
        S3_BUCKET_NAME: ${{ secrets.S3_BUCKET_NAME }}
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      run: |
        perf-sentinel aggregate \
          --config perf-sentinel-ci.yml \
          --job-ids "auth-${{ github.run_id }},api-${{ github.run_id }}" \
          --wait-for-jobs true \
          --timeout 300 \
          --reporter console html \
          --html-output aggregated-performance-report.html
    - name: Upload aggregated report
      uses: actions/upload-artifact@v3
      with:
        name: aggregated-performance-report
        path: aggregated-performance-report.html
```

## Environment-Specific Configuration

### Development Environment

```yaml
# perf-sentinel-dev.yml
project:
  id: "my-app-dev"

storage:
  adapter_type: "filesystem"
  filesystem:
    base_directory: "./performance-results"

analysis:
  threshold: 3.0          # Very lenient
  trends:
    enabled: false        # Skip trend analysis
  suite_overrides:
    authentication:
      threshold: 2.5
  tag_overrides:
    "@critical":
      threshold: 2.0

reporting:
  default_reporters: ["console"]
  console:
    colors: true
    show_analysis_rules: true
```

### Staging Environment

```yaml
# perf-sentinel-staging.yml
project:
  id: "my-app-staging"

storage:
  adapter_type: "auto"
  s3:
    bucket_name: "${S3_BUCKET_NAME_STAGING}"
    region: "${AWS_REGION:-us-east-1}"
    prefix: "perf-sentinel-staging"
  filesystem:
    base_directory: "./performance-results"

analysis:
  threshold: 2.0          # Moderate
  suite_overrides:
    authentication:
      threshold: 1.6
  tag_overrides:
    "@critical":
      threshold: 1.4

reporting:
  default_reporters: ["console", "html"]
```

### Production Environment

```yaml
# perf-sentinel-prod.yml
project:
  id: "my-app-prod"

storage:
  adapter_type: "auto"
  database:
    connection: "${MONGODB_CONNECTION_STRING}"
    name: "perf-sentinel-prod"
  s3:
    bucket_name: "${S3_BUCKET_NAME_PROD}"
    region: "${AWS_REGION:-us-east-1}"
    prefix: "perf-sentinel-prod"

analysis:
  threshold: 1.8          # Strict
  suite_overrides:
    authentication:
      threshold: 1.5      # Extra strict
  tag_overrides:
    "@critical":
      threshold: 1.2      # Ultra strict

reporting:
  default_reporters: ["console", "html"]
  html:
    template: "standard"
    include_charts: true
```

## Advanced Configuration

### Multi-Project Setup

```yaml
# perf-sentinel-multi.yml
# This configuration supports multiple projects
project:
  id: "${PROJECT_ID:-default}"
  name: "${PROJECT_NAME:-Default Project}"

storage:
  adapter_type: "auto"
  database:
    connection: "${MONGODB_CONNECTION_STRING}"
    name: "${MONGODB_DB_NAME:-perf-sentinel}"
  s3:
    bucket_name: "${S3_BUCKET_NAME}"
    region: "${AWS_REGION:-us-east-1}"
    prefix: "${S3_PREFIX:-perf-sentinel}"

# Project-specific analysis rules
analysis:
  threshold: 2.0
  
  # Rules can be overridden per project via environment variables
  suite_overrides: {}
  tag_overrides: {}
  
# Environment-specific overrides
environments:
  production:
    analysis:
      threshold: 1.8
  staging:
    analysis:
      threshold: 2.0
  development:
    analysis:
      threshold: 2.5
```

Usage:
```bash
# Project A
export PROJECT_ID="project-a"
export PROJECT_NAME="Project A"
perf-sentinel analyze --config perf-sentinel-multi.yml --environment production

# Project B
export PROJECT_ID="project-b"
export PROJECT_NAME="Project B"
perf-sentinel analyze --config perf-sentinel-multi.yml --environment staging
```

### Custom Profiles

```yaml
# perf-sentinel-profiles.yml
project:
  id: "my-app"

storage:
  adapter_type: "auto"
  # ... storage configuration

# Define custom profiles
profiles:
  ultra-strict:
    analysis:
      threshold: 1.0
      suite_overrides:
        authentication:
          threshold: 0.8
      tag_overrides:
        "@critical":
          threshold: 0.5
  
  performance-focused:
    analysis:
      threshold: 1.5
      step_types:
        very_fast:
          max_duration: 25    # Tighter thresholds
        fast:
          max_duration: 75
        medium:
          max_duration: 300
  
  ci-optimized:
    analysis:
      threshold: 2.0
      trends:
        enabled: false        # Skip trends in CI
    reporting:
      default_reporters: ["console"]
      console:
        colors: false         # Better for CI logs
```

Usage:
```bash
# Use ultra-strict profile for critical releases
perf-sentinel analyze --config perf-sentinel-profiles.yml --profile ultra-strict

# Use performance-focused profile for performance testing
perf-sentinel analyze --config perf-sentinel-profiles.yml --profile performance-focused
```

## Configuration Reference

### Complete Configuration Schema

```yaml
# Project identification
project:
  id: string                    # Required: Unique project identifier
  name: string                  # Optional: Human-readable project name
  description: string           # Optional: Project description

# Storage configuration
storage:
  adapter_type: string          # "auto", "filesystem", "database", "s3"
  
  # Database adapter
  database:
    connection: string          # MongoDB connection string
    name: string               # Database name
  
  # Filesystem adapter
  filesystem:
    base_directory: string     # Base directory for files
  
  # S3 adapter
  s3:
    bucket_name: string        # S3 bucket name
    region: string             # AWS region
    prefix: string             # S3 key prefix
  
  # Data retention policies
  retention:
    performance_runs: number   # Days to keep performance run data
    job_coordination: number   # Days to keep job coordination data
    completed_jobs: number     # Days to keep completed job data

# Analysis configuration
analysis:
  threshold: number            # Base threshold (standard deviations)
  max_history: number          # Maximum historical data points
  
  # Step classification
  step_types:
    very_fast:
      max_duration: number     # Maximum duration in milliseconds
      rules:
        min_absolute_slowdown: number
        min_percentage_change: number
        ignore_small_changes: boolean
    # ... other step types
  
  # Global rules
  global_rules:
    min_percentage_change: number
    filter_stable_steps: boolean
    stable_threshold: number
  
  # Trend detection
  trends:
    enabled: boolean
    window_size: number
    min_significance: number
    min_history_required: number
  
  # Context-specific overrides
  suite_overrides:
    [suite_name]:
      threshold: number
      rules: object
  
  tag_overrides:
    [tag_name]:
      threshold: number
      rules: object
  
  step_overrides:
    [step_text]:
      threshold: number
      rules: object

# Reporting configuration
reporting:
  default_reporters: array      # Array of reporter names
  
  console:
    show_analysis_rules: boolean
    colors: boolean
    show_trends: boolean
  
  html:
    template: string
    include_charts: boolean
  
  markdown:
    include_metadata: boolean
    show_analysis_rules: boolean
  
  # ... other reporters

# Environment-specific configurations
environments:
  [environment_name]:
    analysis: object           # Override analysis settings
    reporting: object          # Override reporting settings
    storage: object            # Override storage settings

# Predefined profiles
profiles:
  [profile_name]:
    analysis: object           # Override analysis settings
    reporting: object          # Override reporting settings
```

### Environment Variable Interpolation

perf-sentinel supports environment variable interpolation in configuration files:

```yaml
# Use environment variables with defaults
database:
  connection: "${MONGODB_CONNECTION_STRING}"
  name: "${MONGODB_DB_NAME:-perf-sentinel}"

project:
  id: "${PROJECT_ID:-default}"
  name: "${PROJECT_NAME:-Default Project}"

# Conditional configuration based on environment
storage:
  adapter_type: "${STORAGE_TYPE:-auto}"
  
  database:
    connection: "${MONGODB_CONNECTION_STRING}"
  
  s3:
    bucket_name: "${S3_BUCKET_NAME}"
    region: "${AWS_REGION:-us-east-1}"
```

### CLI Override Priority

Configuration values are resolved in the following priority order (highest to lowest):

1. **CLI Arguments** (e.g., `--threshold 1.5`)
2. **Environment Variables** (e.g., `PERF_SENTINEL_THRESHOLD=1.5`)
3. **Configuration File** (e.g., `perf-sentinel.yml`)
4. **Profile Overrides** (e.g., `--profile strict`)
5. **Environment Overrides** (e.g., `--environment production`)
6. **Default Values** (built-in defaults)

## Best Practices

### 1. Use Environment-Specific Configurations

```bash
# Development
perf-sentinel analyze --config perf-sentinel.yml --environment development

# Production
perf-sentinel analyze --config perf-sentinel.yml --environment production
```

### 2. Leverage Profiles for Different Use Cases

```bash
# Code review (strict)
perf-sentinel analyze --config perf-sentinel.yml --profile strict

# CI/CD (optimized)
perf-sentinel analyze --config perf-sentinel.yml --profile ci_focused
```

### 3. Use Auto-Detection for Flexibility

```yaml
storage:
  adapter_type: "auto"  # Automatically chooses best available adapter
```

### 4. Secure Sensitive Configuration

```bash
# Use environment variables for sensitive data
export MONGODB_CONNECTION_STRING="mongodb+srv://user:pass@cluster.mongodb.net/"
export S3_BUCKET_NAME="my-secure-bucket"

# Don't commit credentials to version control
echo "*.env" >> .gitignore
```

### 5. Regular Cleanup

```bash
# Regular cleanup to manage storage costs
perf-sentinel cleanup --config perf-sentinel.yml --older-than 30d
```

### 6. Health Checks

```bash
# Verify configuration before running analysis
perf-sentinel health-check --config perf-sentinel.yml
```

This configuration guide provides comprehensive examples for setting up perf-sentinel in various environments and use cases. Copy and paste these examples as starting points, then customize them for your specific needs. 