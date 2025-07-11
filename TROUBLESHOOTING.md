# perf-sentinel Troubleshooting Guide

This guide helps you diagnose and fix common issues with perf-sentinel. For each problem, we provide symptoms, causes, and step-by-step solutions.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Configuration Issues](#configuration-issues)
3. [Storage Problems](#storage-problems)
4. [Analysis Errors](#analysis-errors)
5. [CI/CD Integration Issues](#cicd-integration-issues)
6. [Performance Issues](#performance-issues)
7. [Common Error Messages](#common-error-messages)
8. [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check Command

Always start troubleshooting with the health check:

```bash
# Basic health check
perf-sentinel health-check --config perf-sentinel.yml

# Detailed health check with debug info
perf-sentinel health-check --config perf-sentinel.yml --debug

# Test specific storage backend
perf-sentinel health-check --db-connection mongodb://localhost:27017 --debug
```

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Global debug flag
perf-sentinel --debug analyze --config perf-sentinel.yml --run-file data.json

# Or use verbose flag
perf-sentinel --verbose analyze --config perf-sentinel.yml --run-file data.json
```

## Configuration Issues

### Problem: "Configuration file not found"

**Symptoms:**
```
Error: Configuration file not found: perf-sentinel.yml
```

**Causes:**
- File doesn't exist
- Wrong file path
- Incorrect working directory

**Solutions:**

1. **Check if file exists:**
   ```bash
   ls -la perf-sentinel.yml
   ```

2. **Create basic configuration:**
   ```yaml
   # perf-sentinel.yml
   project:
     id: "my-app"
   
   storage:
     adapter_type: "filesystem"
     filesystem:
       base_directory: "./performance-results"
   
   analysis:
     threshold: 2.0
   
   reporting:
     default_reporters: ["console"]
   ```

3. **Use absolute path:**
   ```bash
   perf-sentinel analyze --config /full/path/to/perf-sentinel.yml
   ```

### Problem: "Invalid YAML syntax"

**Symptoms:**
```
Error: Invalid configuration: YAMLException: bad indentation
```

**Causes:**
- Incorrect YAML indentation
- Missing colons
- Invalid characters

**Solutions:**

1. **Validate YAML syntax:**
   ```bash
   # Use online YAML validator or
   node -e "console.log(require('js-yaml').load(require('fs').readFileSync('perf-sentinel.yml')))"
   ```

2. **Check indentation (use spaces, not tabs):**
   ```yaml
   # Correct
   project:
     id: "my-app"
     name: "My Application"
   
   # Incorrect (mixed tabs/spaces)
   project:
   	id: "my-app"
     name: "My Application"
   ```

3. **Use health check to validate:**
   ```bash
   perf-sentinel health-check --config perf-sentinel.yml
   ```

### Problem: "Environment variables not resolving"

**Symptoms:**
```
Error: Connection string is undefined
```

**Causes:**
- Environment variables not set
- Incorrect variable names
- Missing default values

**Solutions:**

1. **Check environment variables:**
   ```bash
   echo $MONGODB_CONNECTION_STRING
   echo $S3_BUCKET_NAME
   ```

2. **Set environment variables:**
   ```bash
   export MONGODB_CONNECTION_STRING="mongodb://localhost:27017"
   export S3_BUCKET_NAME="my-bucket"
   ```

3. **Use default values in config:**
   ```yaml
   database:
     connection: "${MONGODB_CONNECTION_STRING:-mongodb://localhost:27017}"
     name: "${MONGODB_DB_NAME:-perf-sentinel}"
   ```

4. **Test variable resolution:**
   ```bash
   perf-sentinel health-check --config perf-sentinel.yml --debug
   ```

## Storage Problems

### Problem: "MongoDB connection failed"

**Symptoms:**
```
❌ Storage connection error: MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017
```

**Causes:**
- MongoDB server not running
- Incorrect connection string
- Network connectivity issues
- Authentication problems

**Solutions:**

1. **Check MongoDB server:**
   ```bash
   # Check if MongoDB is running
   ps aux | grep mongod
   
   # Start MongoDB (if installed locally)
   sudo systemctl start mongod
   # or
   brew services start mongodb-community
   ```

2. **Test connection manually:**
   ```bash
   # Test connection with mongo client
   mongo mongodb://localhost:27017
   
   # Or with Node.js
   node -e "require('mongodb').MongoClient.connect('mongodb://localhost:27017', console.log)"
   ```

3. **Fix connection string:**
   ```bash
   # Local MongoDB
   export MONGODB_CONNECTION_STRING="mongodb://localhost:27017"
   
   # MongoDB Atlas
   export MONGODB_CONNECTION_STRING="mongodb+srv://username:password@cluster.mongodb.net/"
   
   # With authentication
   export MONGODB_CONNECTION_STRING="mongodb://username:password@localhost:27017"
   ```

4. **Check network connectivity:**
   ```bash
   # Test network connection
   telnet localhost 27017
   # or
   nc -zv localhost 27017
   ```

### Problem: "S3 access denied"

**Symptoms:**
```
❌ S3 storage connection failed: AccessDenied: Access Denied
```

**Causes:**
- Invalid AWS credentials
- Insufficient permissions
- Incorrect bucket name
- Wrong region

**Solutions:**

1. **Check AWS credentials:**
   ```bash
   # Check environment variables
   echo $AWS_ACCESS_KEY_ID
   echo $AWS_SECRET_ACCESS_KEY
   
   # Check AWS CLI configuration
   aws configure list
   ```

2. **Set correct credentials:**
   ```bash
   export AWS_ACCESS_KEY_ID="your-access-key"
   export AWS_SECRET_ACCESS_KEY="your-secret-key"
   export AWS_REGION="us-east-1"
   ```

3. **Test S3 access:**
   ```bash
   # Test with AWS CLI
   aws s3 ls s3://your-bucket-name
   
   # Test specific region
   aws s3 ls s3://your-bucket-name --region us-east-1
   ```

4. **Check IAM permissions:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-bucket-name",
           "arn:aws:s3:::your-bucket-name/*"
         ]
       }
     ]
   }
   ```

### Problem: "File system permissions"

**Symptoms:**
```
❌ Cannot write to performance results directory: EACCES: permission denied
```

**Causes:**
- Insufficient file permissions
- Directory doesn't exist
- Disk space issues

**Solutions:**

1. **Check directory permissions:**
   ```bash
   ls -la ./performance-results
   ```

2. **Create directory with proper permissions:**
   ```bash
   mkdir -p ./performance-results
   chmod 755 ./performance-results
   ```

3. **Check disk space:**
   ```bash
   df -h .
   ```

4. **Use different directory:**
   ```bash
   # Use /tmp directory
   perf-sentinel analyze --base-directory /tmp/performance-results
   ```

## Analysis Errors

### Problem: "Run file not found"

**Symptoms:**
```
Error: ENOENT: no such file or directory, open './performance-results/latest-run.json'
```

**Causes:**
- File doesn't exist
- Wrong file path
- Test didn't generate data

**Solutions:**

1. **Check if file exists:**
   ```bash
   ls -la ./performance-results/latest-run.json
   ```

2. **Verify test data generation:**
   ```bash
   # Check if tests generated any files
   ls -la ./performance-results/
   
   # Check file contents
   cat ./performance-results/latest-run.json
   ```

3. **Use correct file path:**
   ```bash
   # Use absolute path
   perf-sentinel analyze --run-file /full/path/to/latest-run.json
   ```

4. **Generate test data:**
   ```bash
   # Run your tests to generate performance data
   npm run test:performance
   ```

### Problem: "Invalid JSON format"

**Symptoms:**
```
Error: Unexpected token in JSON at position 0
```

**Causes:**
- Malformed JSON file
- Empty file
- Incorrect file format

**Solutions:**

1. **Validate JSON:**
   ```bash
   # Check JSON syntax
   cat ./performance-results/latest-run.json | jq '.'
   
   # Or with Node.js
   node -e "JSON.parse(require('fs').readFileSync('./performance-results/latest-run.json'))"
   ```

2. **Check file content:**
   ```bash
   # Check if file is empty
   wc -l ./performance-results/latest-run.json
   
   # Check file content
   head -n 10 ./performance-results/latest-run.json
   ```

3. **Expected JSON format:**
   ```json
   [
     {
       "stepText": "I log in as a standard user",
       "duration": 1200,
       "timestamp": "2023-12-01T10:00:00.000Z",
       "context": {
         "testFile": "auth/login.feature",
         "testName": "User can log in",
         "suite": "authentication",
         "tags": ["@smoke", "@auth"]
       }
     }
   ]
   ```

### Problem: "No historical data"

**Symptoms:**
```
Warning: No historical data found for analysis
```

**Causes:**
- First run with no history
- History file doesn't exist
- Database connection issues

**Solutions:**

1. **Seed historical data:**
   ```bash
   # Create history from existing runs
   perf-sentinel seed --config perf-sentinel.yml --run-files "./historical-runs/*.json"
   ```

2. **Check history file:**
   ```bash
   # Check if history file exists
   ls -la ./performance-results/history.json
   
   # Check history content
   cat ./performance-results/history.json | jq '.'
   ```

3. **Allow empty history for first run:**
   ```bash
   # First run will create history
   perf-sentinel analyze --config perf-sentinel.yml --run-file latest-run.json
   ```

## CI/CD Integration Issues

### Problem: "Command not found in CI"

**Symptoms:**
```
perf-sentinel: command not found
```

**Causes:**
- perf-sentinel not installed in CI environment
- Wrong installation method
- PATH issues

**Solutions:**

1. **Install in CI script:**
   ```yaml
   # GitHub Actions
   - name: Install perf-sentinel
     run: npm install -g perf-sentinel
   
   # Or install locally
   - name: Install perf-sentinel
     run: npm install perf-sentinel
   ```

2. **Use npx for local installation:**
   ```bash
   npx perf-sentinel analyze --config perf-sentinel.yml
   ```

3. **Check PATH:**
   ```bash
   echo $PATH
   which perf-sentinel
   ```

### Problem: "Permission denied in CI"

**Symptoms:**
```
Error: EACCES: permission denied, mkdir '/performance-results'
```

**Causes:**
- CI runner permissions
- Read-only file system
- Docker container restrictions

**Solutions:**

1. **Use writable directory:**
   ```yaml
   # Use workspace directory
   - name: Analyze performance
     run: |
       perf-sentinel analyze \
         --config perf-sentinel.yml \
         --base-directory ./performance-results
   ```

2. **Create directory first:**
   ```yaml
   - name: Create directories
     run: mkdir -p ./performance-results
   
   - name: Analyze performance
     run: perf-sentinel analyze --config perf-sentinel.yml
   ```

3. **Use /tmp directory:**
   ```bash
   perf-sentinel analyze --base-directory /tmp/performance-results
   ```

### Problem: "Environment variables not available"

**Symptoms:**
```
Error: Connection string is undefined
```

**Causes:**
- Secrets not configured
- Environment variables not set
- Incorrect variable names

**Solutions:**

1. **Configure secrets in GitHub:**
   ```yaml
   # .github/workflows/test.yml
   env:
     MONGODB_CONNECTION_STRING: ${{ secrets.MONGODB_CONNECTION_STRING }}
     S3_BUCKET_NAME: ${{ secrets.S3_BUCKET_NAME }}
   ```

2. **Set environment variables:**
   ```yaml
   # GitLab CI
   variables:
     MONGODB_CONNECTION_STRING: "$MONGODB_CONNECTION_STRING"
   ```

3. **Use default values:**
   ```yaml
   # perf-sentinel.yml
   database:
     connection: "${MONGODB_CONNECTION_STRING:-mongodb://localhost:27017}"
   ```

## Performance Issues

### Problem: "Analysis taking too long"

**Symptoms:**
- Commands timeout
- High memory usage
- Slow response times

**Causes:**
- Large datasets
- Complex analysis rules
- Insufficient resources

**Solutions:**

1. **Monitor performance:**
   ```bash
   # Check execution time and memory usage
   perf-sentinel --debug analyze --config perf-sentinel.yml
   ```

2. **Optimize configuration:**
   ```yaml
   analysis:
     max_history: 25        # Reduce history size
     trends:
       enabled: false       # Disable trends for speed
   ```

3. **Use cleanup:**
   ```bash
   # Regular cleanup to reduce data size
   perf-sentinel cleanup --older-than 30d --config perf-sentinel.yml
   ```

4. **Increase resources:**
   ```yaml
   # GitHub Actions
   runs-on: ubuntu-latest
   # or
   runs-on: ubuntu-latest-8-cores
   ```

### Problem: "High memory usage"

**Symptoms:**
```
⚠️ High memory usage: 512MB
```

**Causes:**
- Large datasets
- Memory leaks
- Inefficient processing

**Solutions:**

1. **Monitor memory:**
   ```bash
   # Check memory usage
   perf-sentinel --debug analyze --config perf-sentinel.yml
   ```

2. **Reduce dataset size:**
   ```bash
   # Process smaller batches
   perf-sentinel cleanup --older-than 30d
   ```

3. **Optimize analysis:**
   ```yaml
   analysis:
     max_history: 20        # Reduce history
     trends:
       enabled: false       # Disable complex analysis
   ```

## Common Error Messages

### Error: "Either --db-connection or --history-file must be provided"

**Cause:** No storage configuration provided

**Solution:**
```bash
# Provide storage configuration
perf-sentinel analyze --config perf-sentinel.yml --run-file data.json

# Or specify directly
perf-sentinel analyze --history-file history.json --run-file data.json
```

### Error: "Invalid --older-than format"

**Cause:** Incorrect cleanup time format

**Solution:**
```bash
# Correct format
perf-sentinel cleanup --older-than 30d

# Not: --older-than 30 days
# Not: --older-than 30
```

### Error: "Job coordination timeout"

**Cause:** Jobs not completing within timeout

**Solution:**
```bash
# Increase timeout
perf-sentinel aggregate --job-ids "job1,job2" --timeout 600

# Or disable waiting
perf-sentinel aggregate --job-ids "job1,job2" --wait-for-jobs false
```

### Error: "Cannot read property 'length' of undefined"

**Cause:** Malformed data structure

**Solution:**
1. **Validate data format:**
   ```bash
   # Check run file structure
   cat latest-run.json | jq '.[0]'
   ```

2. **Use debug mode:**
   ```bash
   perf-sentinel --debug analyze --config perf-sentinel.yml
   ```

## Getting Help

### 1. Enable Debug Mode

Always start with debug mode for detailed information:

```bash
perf-sentinel --debug [command] [options]
```

### 2. Run Health Check

Use health check to diagnose system issues:

```bash
perf-sentinel health-check --config perf-sentinel.yml --debug
```

### 3. Check Configuration

Validate your configuration:

```bash
# Test configuration file
perf-sentinel health-check --config perf-sentinel.yml

# Test specific storage
perf-sentinel health-check --db-connection mongodb://localhost:27017
```

### 4. Common Debug Commands

```bash
# Full debug run
perf-sentinel --debug analyze --config perf-sentinel.yml --run-file data.json

# Test storage connectivity
perf-sentinel health-check --config perf-sentinel.yml

# Validate JSON files
cat latest-run.json | jq '.'

# Check environment variables
env | grep -E "(MONGODB|S3|AWS)"
```

### 5. Gathering Information for Support

When reporting issues, include:

1. **Command that failed:**
   ```bash
   perf-sentinel --debug analyze --config perf-sentinel.yml
   ```

2. **Configuration file:**
   ```bash
   cat perf-sentinel.yml
   ```

3. **Environment information:**
   ```bash
   node --version
   npm --version
   perf-sentinel --version
   ```

4. **System information:**
   ```bash
   uname -a
   free -h
   df -h
   ```

5. **Error output:**
   ```bash
   # Complete error output with debug enabled
   perf-sentinel --debug [command] > output.log 2>&1
   ```

### 6. Quick Recovery Steps

If you're stuck, try these recovery steps:

1. **Reset to filesystem storage:**
   ```yaml
   # Minimal config
   project:
     id: "my-app"
   storage:
     adapter_type: "filesystem"
   analysis:
     threshold: 2.0
   reporting:
     default_reporters: ["console"]
   ```

2. **Clear data and restart:**
   ```bash
   # Clean up old data
   rm -rf ./performance-results
   mkdir -p ./performance-results
   
   # Run fresh analysis
   perf-sentinel analyze --config perf-sentinel.yml --run-file data.json
   ```

3. **Use minimal command:**
   ```bash
   # Simplest possible command
   perf-sentinel analyze --history-file history.json --run-file data.json
   ```

Remember: Most issues are related to configuration, file permissions, or network connectivity. The health check command is your best friend for diagnosing problems! 