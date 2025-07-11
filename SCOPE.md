# perf-sentinel: Large-Scale Performance Monitoring Scope

## Current State Analysis

### Limitations Identified
1. **Scale Challenges**: Current design struggles with 260 tests running ~1000 steps across 25 suites
2. **Context Loss**: No visibility into which test/suite a slow step belongs to
3. **Job Aggregation**: No mechanism to collect results from multiple parallel CI jobs
4. **PR Workflow**: Missing PR-level analysis across multiple commits/pushes
5. **Data Management**: No lifecycle management for large volumes of performance data

## Proposed Architecture: Enterprise-Scale Performance Monitoring

### Phase 1: Enhanced Data Model & Context

#### 1.1 Rich Step Context
**Current**:
```json
{
  "stepText": "I log in as a standard user",
  "duration": 1200,
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

**Proposed**:
```json
{
  "stepText": "I log in as a standard user",
  "duration": 1200,
  "timestamp": "2023-12-01T10:00:00.000Z",
  "context": {
    "testFile": "auth/login.feature",
    "testName": "User can log in with valid credentials",
    "suite": "authentication",
    "tags": ["@smoke", "@auth", "@critical"],
    "jobId": "job-123",
    "workerId": "worker-5"
  }
}
```

#### 1.2 Hierarchical Performance Analysis
- **Suite-level analysis**: Identify which test suites are degrading
- **Test-level analysis**: Pinpoint specific test files with issues
- **Step-level analysis**: Current granular step analysis
- **Cross-cutting analysis**: Performance by tags (e.g., @critical, @smoke)

### Phase 2: Distributed Data Collection

#### 2.1 Storage Adapter Pattern
**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Adapter Pattern                  │
├─────────────────┬─────────────────┬─────────────────────────┤
│ FileSystemAdapter│    S3Adapter    │    DatabaseAdapter      │
│ (Local Dev)     │   (CI/CD)       │   (Future/Optional)     │
│                 │                 │                         │
│ • Local files   │ • S3 buckets    │ • MongoDB/DocumentDB    │
│ • No setup      │ • Aggregation   │ • Multi-project         │
│ • Fast feedback │ • Scalable      │ • Analytics ready       │
└─────────────────┴─────────────────┴─────────────────────────┘
```

**Implementation Tiers**:

**Tier 1: FileSystemAdapter (Local Development)**
- Local file storage with standardized directory structure
- Perfect for development, testing, and small teams
- No external dependencies or configuration required
- Immediate feedback loop for developers

**Tier 2: S3Adapter (CI/CD Production)**
- Each job uploads results to S3 with standardized naming
- Analysis job downloads all results and aggregates
- Pros: Scalable, no database dependency, cost-effective
- Cons: File management, requires S3 setup

**Tier 3: DatabaseAdapter (Future/Optional)**
- Direct database storage for advanced analytics
- Enables real-time dashboards and complex queries
- Pros: Atomic operations, better concurrency, analytics-ready
- Cons: Database dependency, higher complexity

#### 2.2 Multi-Job Result Aggregation
**CI/CD Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline                           │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│   Job 1     │   Job 2     │   Job 3     │   ...Job N      │
│ (Suite A-D) │ (Suite E-H) │ (Suite I-L) │ (Suite M-Z)     │
│     │       │     │       │     │       │       │         │
│     ▼       │     ▼       │     ▼       │       ▼         │
│ S3/FileSystem│ S3/FileSystem│ S3/FileSystem│ S3/FileSystem  │
└─────────────┴─────────────┴─────────────┴─────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Analysis Job       │
                    │  (Aggregates All)   │
                    └─────────────────────┘
```

#### 2.3 Result Coordination
```yaml
# CI Pipeline Configuration
stages:
  - test-parallel:
      jobs:
        - suite-a-d
        - suite-e-h
        - suite-i-l
        - suite-m-z
  - performance-analysis:
      dependencies: [suite-a-d, suite-e-h, suite-i-l, suite-m-z]
      script: |
        # Wait for all jobs to complete
        perf-sentinel aggregate \
          --pr-number $PR_NUMBER \
          --commit-sha $COMMIT_SHA \
          --wait-for-jobs suite-a-d,suite-e-h,suite-i-l,suite-m-z
        
        # Analyze aggregated results
        perf-sentinel analyze \
          --pr-number $PR_NUMBER \
          --commit-sha $COMMIT_SHA \
          --context full-suite
```

### Phase 3: PR-Level Performance Intelligence

#### 3.1 Multi-Commit Analysis
**Challenge**: Developer pushes branch 20 times before looking at report
**Solution**: Cumulative PR analysis

```
PR Branch Lifecycle:
Commit 1: [Performance Data] ─┐
Commit 2: [Performance Data] ─┤
Commit 3: [Performance Data] ─┼─► Cumulative Analysis
...                           ─┤   (All commits in PR)
Commit N: [Performance Data] ─┘
```

**Implementation**:
```javascript
// PR-level aggregation
const prAnalysis = {
  prNumber: 123,
  baseBranch: 'main',
  commits: [
    { sha: 'abc123', timestamp: '...', performanceData: [...] },
    { sha: 'def456', timestamp: '...', performanceData: [...] },
    // ... all commits in PR
  ],
  aggregatedBaseline: {}, // Performance baseline from main branch
  cumulativeAnalysis: {}, // Analysis across all PR commits
  regressionTrends: [],   // Steps that consistently degrade
  improvements: []        // Steps that consistently improve
};
```

#### 3.2 Smart Regression Detection
- **Immediate regressions**: Current commit vs baseline
- **Trend regressions**: Degradation across multiple commits in PR
- **Cumulative impact**: Overall PR impact on performance
- **Confidence scoring**: Higher confidence for consistent patterns

## Reporting Strategy

### Two-Pronged Approach

#### Immediate Feedback: Self-Contained HTML Reports
**Purpose**: Quick, actionable feedback for developers and PR reviewers
**Implementation**: Generate pytest-style HTML reports that can be viewed immediately

```html
<!-- Example HTML Report Structure -->
<!DOCTYPE html>
<html>
<head>
    <title>Performance Analysis Report</title>
    <style>/* Embedded CSS for self-contained report */</style>
</head>
<body>
    <div class="summary">
        <h1>Performance Report - PR #123</h1>
        <div class="metrics">
            <div class="metric regression">5 Regressions</div>
            <div class="metric new">2 New Steps</div>
            <div class="metric ok">147 OK</div>
        </div>
    </div>
    
    <div class="details">
        <table class="regressions">
            <tr><th>Step</th><th>Current</th><th>Baseline</th><th>Slowdown</th><th>Suite</th></tr>
            <!-- Regression details with suite context -->
        </table>
    </div>
    
    <div class="charts">
        <!-- Embedded JavaScript charts using Chart.js or similar -->
    </div>
</body>
</html>
```

**Benefits**:
- **No external dependencies**: Report works offline, in CI artifacts
- **Rich visualizations**: Charts, tables, and interactive elements
- **PR integration**: Easy to attach to GitHub/GitLab as artifacts
- **Developer-friendly**: Familiar format, works in any browser
- **Immediate feedback**: Available as soon as analysis completes

#### Long-Term Vision: Database + Grafana Integration
**Purpose**: Advanced analytics, trend monitoring, and team dashboards
**Implementation**: Push structured data to time-series database for visualization

```javascript
// Example data structure for Grafana
const performanceMetrics = {
  timestamp: Date.now(),
  project: "my-app",
  suite: "authentication",
  step: "I log in as a standard user",
  duration: 1200,
  baseline: 1000,
  regression: true,
  prNumber: 123,
  commitSha: "abc123",
  tags: ["@critical", "@auth"]
};
```

**Benefits**:
- **Historical trends**: Long-term performance tracking
- **Advanced analytics**: Complex queries and aggregations
- **Team dashboards**: Real-time monitoring across projects
- **Alerting**: Proactive notifications for systematic issues
- **Business intelligence**: Performance impact on business metrics

### Implementation Phases

#### Phase 1: HTML Report Foundation (Weeks 1-2)
- Create self-contained HTML report generator
- Embed charts using lightweight JavaScript libraries
- Generate reports that include rich context (suite, test file, tags)
- Ensure reports work offline and in CI environments

#### Phase 2: Enhanced HTML Reports (Weeks 3-4)
- Add interactive filtering and sorting
- Include performance history graphs
- Add export capabilities (PDF, CSV)
- Optimize for mobile viewing

#### Phase 3: Database Foundation (Future/Optional)
- Implement data pipeline to time-series database
- Create Grafana dashboards for trend analysis
- Set up alerting and notification systems
- Build team-specific performance monitoring

### Phase 4: Advanced Analytics & Insights (Future/Optional)

#### 4.1 Performance Dashboards
```
┌─────────────────────────────────────────────────────────────┐
│                 Performance Dashboard                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Suite Health  │   Critical Path │    Regression Trends    │
│                 │                 │                         │
│ ✅ Auth (✓)     │ Login: 1.2s     │ ↗️ Search: +15% (5 PRs) │
│ ⚠️  Cart (2)    │ Checkout: 2.1s  │ ↗️ Report: +8% (3 PRs)  │
│ ❌ Reports (5)  │ Search: 800ms   │ ↘️ Login: -5% (2 PRs)   │
└─────────────────┴─────────────────┴─────────────────────────┘
```

#### 4.2 Intelligent Alerting
- **Severity-based alerts**: Critical path regressions vs general slowdowns
- **Pattern recognition**: Detect systematic performance degradation
- **Proactive warnings**: Alert before regressions reach production
- **Team-specific routing**: Route suite-specific issues to appropriate teams

### Phase 5: Data Lifecycle Management

#### 5.1 Automated Data Cleanup
```yaml
Data Retention Policy:
  - Active PRs: Retain all performance data
  - Merged PRs: 
    - Keep summary analysis (30 days)
    - Archive detailed data (S3 Glacier)
    - Delete raw data (7 days post-merge)
  - Abandoned PRs: Delete after 14 days
  - Main branch: Keep rolling 90-day history
```

#### 5.2 Storage Optimization
- **Hot data**: Recent PRs, active analysis (DocumentDB)
- **Warm data**: Historical summaries (S3 Standard)
- **Cold data**: Long-term archives (S3 Glacier)
- **Automatic tiering**: Based on access patterns and age

## Implementation Roadmap

### Phase 1: Foundation (4-6 weeks)
- [ ] Enhanced data model with test context
- [ ] Hierarchical analysis (suite/test/step levels)
- [ ] Storage Adapter Pattern implementation
- [ ] FileSystemAdapter for local development
- [ ] Updated Cucumber hook for rich context

### Phase 2: Core Distribution (6-8 weeks)
- [ ] Multi-job result aggregation
- [ ] S3Adapter for CI/CD environments
- [ ] Job coordination mechanisms
- [ ] Self-contained HTML report generation

### Phase 3: HTML Report Generation (8-10 weeks)
- [x] Interactive HTML dashboard with self-contained reports
- [x] Rich data visualization with Chart.js integration
- [x] Context-aware hierarchical reporting
- [x] Enhanced HTML reports with interactivity

### Phase 4: Production Readiness (4-6 weeks)
- [ ] Automated cleanup and lifecycle management
- [ ] Storage optimization
- [ ] Monitoring and observability
- [ ] Performance testing and optimization

### Future/Optional Phases

#### Phase 5: Advanced Analytics (Future/Optional)
- [ ] DatabaseAdapter implementation
- [ ] Performance dashboards (Grafana integration)
- [ ] Advanced alerting and notifications
- [ ] Team-specific routing and insights
- [ ] Pattern recognition and ML capabilities

#### Phase 6: Enterprise Features (Future/Optional)
- [ ] Multi-tenant architecture
- [ ] Advanced security and compliance
- [ ] Custom integrations and APIs
- [ ] Enterprise reporting and analytics

## Technical Considerations

### Scalability Targets
- **Data Volume**: 10,000+ steps per analysis run
- **Concurrent Jobs**: 50+ parallel test jobs
- **PR Frequency**: 100+ PRs per day
- **Data Retention**: 90-day rolling window
- **Response Time**: <30 seconds for full analysis

### Infrastructure Requirements

#### Tier 1: Local Development (FileSystemAdapter)
- **Storage**: Local filesystem with structured directories
- **Compute**: Local process execution
- **Dependencies**: None (zero-setup development)
- **Monitoring**: File-based logging and console output

#### Tier 2: CI/CD Production (S3Adapter)
- **Storage**: S3 buckets with lifecycle policies
- **Compute**: Containerized analysis jobs
- **Dependencies**: AWS SDK, S3 access permissions
- **Monitoring**: CloudWatch integration

#### Tier 3: Enterprise Analytics (DatabaseAdapter - Future/Optional)
- **Database**: DocumentDB/MongoDB with sharding
- **Storage**: S3 + Database hybrid approach
- **Compute**: Containerized analysis jobs + analytics pipeline
- **Monitoring**: Full observability stack (Grafana, Prometheus)

### Cost Optimization

#### Immediate (Phases 1-4)
- **FileSystemAdapter**: Zero infrastructure costs for development
- **S3Adapter**: Pay-as-you-go storage with lifecycle management
- **HTML Reports**: No hosting costs, self-contained artifacts
- **Efficient algorithms**: Minimize computation time and storage

#### Future/Optional (Phases 5-6)
- **Intelligent sampling**: Reduce data volume for stable steps
- **Compression**: Optimize storage for historical data
- **Caching**: Cache frequently accessed baselines
- **Tiered storage**: Automatic data lifecycle management

## Risk Assessment

### High Risk (Phases 1-4)
- **Performance impact**: Analysis must not slow CI/CD
- **Multi-job coordination**: Ensuring reliable result aggregation
- **Context accuracy**: Maintaining test-to-step mapping across jobs

### Medium Risk (Phases 1-4)
- **Storage costs**: S3 costs for large-scale usage
- **False positives**: Tuning algorithms to reduce noise
- **HTML report size**: Managing report size with large datasets

### Low Risk (Phases 1-4)
- **FileSystemAdapter reliability**: Well-understood local file operations
- **Developer adoption**: Familiar HTML report format
- **Integration complexity**: Gradual adapter-based migration

### Mitigated Risks (Deferred to Future/Optional)
- **Database complexity**: Moved to optional Phase 5
- **Advanced analytics overhead**: Deferred until core value proven
- **Multi-tenant architecture**: Simplified to single-project focus initially

## Success Metrics

### Phase 1-4 Core Metrics

#### Developer Experience
- **Time to identify**: <2 minutes to identify slow test/suite from HTML report
- **Setup time**: <5 minutes to configure FileSystemAdapter for local development
- **False positive rate**: <5% of reported regressions
- **Report accessibility**: 100% of HTML reports work offline and in CI artifacts

#### Operational Excellence
- **Performance**: 95% of analyses complete in <30 seconds
- **Storage efficiency**: <50MB storage per 1000 test runs (S3Adapter)
- **Reliability**: 99.5% successful job aggregation in CI/CD pipelines
- **Cost efficiency**: <$10/month per 1000 daily test runs (S3 only)

#### Business Impact
- **Regression prevention**: 70% of performance issues caught pre-merge
- **Developer productivity**: 20% reduction in performance debugging time
- **Adoption rate**: 80% of development teams using local FileSystemAdapter

### Future/Optional Phase Metrics

#### Advanced Analytics (Phase 5)
- **Dashboard adoption**: 50% of teams using Grafana dashboards
- **Trend detection**: 90% of systematic performance degradation caught
- **Historical analysis**: 6-month performance trend availability

#### Enterprise Features (Phase 6)
- **Multi-tenant support**: 100+ projects supported simultaneously
- **API usage**: 1000+ API calls per day for integrations
- **Enterprise adoption**: 10+ large organizations using the platform

## Migration Strategy

### Adapter-Based Migration Path

#### Stage 1: Local Development (Weeks 1-4)
- Start with FileSystemAdapter for individual developer workstations
- Validate enhanced data model and HTML reports
- Gather developer feedback and iterate
- No infrastructure dependencies or setup required

#### Stage 2: CI/CD Pilot (Weeks 5-8)
- Deploy S3Adapter to 2-3 pilot teams
- Validate multi-job aggregation and coordination
- Test HTML report generation in CI/CD pipelines
- Monitor storage costs and performance

#### Stage 3: Production Rollout (Weeks 9-16)
- Expand S3Adapter to all teams over 8 weeks
- Provide training and migration support
- Monitor performance and adjust configurations
- Establish operational procedures

#### Stage 4: Future/Optional Enhancements
- **DatabaseAdapter**: Only if teams require advanced analytics
- **Grafana Integration**: Based on demand for historical dashboards
- **Enterprise Features**: Driven by organizational needs

### Zero-Downtime Migration
- **Backward compatibility**: Maintain existing file-based workflows
- **Gradual adoption**: Teams can migrate at their own pace
- **Adapter flexibility**: Easy switching between storage types
- **Rollback capability**: Simple revert to previous adapter if needed

## Conclusion

This scope addresses the core challenges of operating perf-sentinel at enterprise scale while maintaining simplicity and achievability:

### Core Achievements (Phases 1-4)
1. **Context**: Rich test/suite metadata for actionable insights
2. **Scale**: Distributed architecture using Storage Adapter Pattern
3. **Workflow**: PR-level intelligence across multiple commits
4. **Developer Experience**: Self-contained HTML reports for immediate feedback
5. **Operational Simplicity**: FileSystemAdapter for development, S3Adapter for production

### Key Strategic Decisions
- **Adapter Pattern**: Enables gradual migration from simple file storage to enterprise-scale solutions
- **HTML-First Reporting**: Provides immediate value without infrastructure dependencies
- **Future-Proof Architecture**: Database and advanced analytics capabilities deferred but planned
- **Reduced Complexity**: Focus on core functionality first, advanced features second

### Implementation Benefits
- **Lower Risk**: Phased approach with well-understood technologies
- **Faster Time-to-Value**: Developers can start using enhanced reports immediately
- **Cost Effective**: Minimal infrastructure requirements for initial phases
- **Scalable Foundation**: Architecture supports future growth without redesign

The proposed architecture transforms perf-sentinel from a simple regression detector into a comprehensive performance intelligence platform, delivered through manageable phases that each provide immediate value while building toward the enterprise-scale vision.

## Implementation Roadmap for Cursor & Claude-4

This roadmap breaks down the enterprise-scale upgrade into manageable, sequential tasks designed for iterative development with AI assistance. Each phase builds upon the previous one while maintaining working functionality.

### Phase 1: Enhanced Context & Data Model (Weeks 1-4)

#### 1.1 Rich Step Context Model
- [x] **Update Cucumber Hook** - Enhance `examples/cucumber/hooks.js` to collect rich context
  - [x] Add test file path detection
  - [x] Add suite name extraction from file path
  - [x] Add tag parsing from test steps
  - [x] Add job ID and worker ID from environment variables
  - [x] Update data structure to include context object
  - [x] Test with sample feature files

- [x] **Update Engine Data Processing** - Modify `src/analysis/engine.js` to handle rich context
  - [x] Update analyze() function to accept context-rich data
  - [x] Add context validation and normalization
  - [x] Preserve context in history updates
  - [x] Test with enhanced data structures

- [x] **Context-Aware Configuration** - Enhance `src/config/config-loader.js`
  - [x] Add context-based rule matching (by suite, tags, etc.)
  - [x] Add suite-level configuration overrides
  - [x] Add tag-based configuration rules
  - [x] Test configuration resolution with context

#### 1.2 Hierarchical Analysis
- [x] **Suite-Level Analysis** - Add suite aggregation to engine
  - [x] Create suite performance summary
  - [x] Add suite-level regression detection
  - [x] Add suite health scoring
  - [x] Test with multi-suite data

- [x] **Tag-Based Analysis** - Add cross-cutting analysis
  - [x] Add tag-based performance grouping
  - [x] Add critical path analysis (@critical, @smoke tags)
  - [x] Add tag-based reporting
  - [x] Test with tagged test scenarios

- [x] **Enhanced Reporting** - Update existing reporters with context
  - [x] Update console reporter to show suite information
  - [x] Update markdown reporter with hierarchical structure
  - [x] Add context filtering options
  - [x] Test hierarchical report generation

#### 1.3 Phase 1 Testing & Validation
- [x] **Unit Tests** - Update existing tests for enhanced context
  - [x] Update `test/unit/engine.test.js` with context scenarios
  - [x] Add context validation tests
  - [x] Add hierarchical analysis tests
  - [x] Ensure all existing tests still pass

- [x] **Integration Tests** - Test end-to-end with rich context
  - [x] Test enhanced Cucumber hook
  - [x] Test context-aware analysis
  - [x] Test hierarchical reporting
  - [x] Validate backward compatibility

### Phase 2: Storage Adapter Pattern (Weeks 5-8)

#### 2.1 Storage Abstraction Layer
- [x] **Create Base Storage Interface** - Define adapter contract
  - [x] Create `src/storage/adapters/base-adapter.js` interface
  - [x] Define standard methods (getHistory, saveHistory, aggregate, etc.)
  - [x] Add adapter lifecycle management
  - [x] Test interface design

- [x] **Refactor Current Storage** - Abstract existing storage logic
  - [x] Create `src/storage/adapters/database-adapter.js`
  - [x] Move existing database logic to adapter
  - [x] Update `src/storage/storage.js` to use adapter pattern
  - [x] Test database adapter functionality

#### 2.2 FileSystemAdapter Implementation
- [x] **Create FileSystemAdapter** - Local development storage
  - [x] Create `src/storage/adapters/filesystem-adapter.js`
  - [x] Implement structured directory layout
  - [x] Add project-specific file organization
  - [x] Add atomic file operations
  - [x] Test local development workflow

- [x] **Configuration Integration** - Add adapter selection
  - [x] Update `src/config/defaults.yml` with adapter options
  - [x] Add adapter-specific configuration
  - [x] Update config loader for adapter selection
  - [x] Test configuration-driven adapter selection

#### 2.3 S3Adapter Implementation
- [x] **Create S3Adapter** - CI/CD production storage
  - [x] Create `src/storage/adapters/s3-adapter.js`
  - [x] Implement S3 SDK integration
  - [x] Add standardized naming conventions
  - [x] Add retry logic and error handling
  - [x] Test S3 operations (with mocked S3)

- [x] **Multi-Job Coordination** - Handle distributed results
  - [x] Add job coordination logic
  - [x] Implement result aggregation
  - [x] Add job completion detection
  - [x] Test multi-job scenarios

#### 2.4 Phase 2 Testing & Validation
- [x] **Adapter Tests** - Test each adapter independently
  - [x] Create `test/unit/storage/adapters/` test suite
  - [x] Test FileSystemAdapter operations
  - [x] Test S3Adapter operations (mocked)
  - [x] Test adapter switching and fallback

- [x] **Integration Tests** - Test adapter patterns
  - [x] Test storage service with different adapters
  - [x] Test configuration-driven adapter selection
  - [x] Test multi-job coordination
  - [x] Validate existing functionality unchanged

### Phase 3: HTML Report Generation (Weeks 9-12)

#### 3.1 HTML Report Foundation
- [x] **Create HTML Reporter** - Self-contained report generator
  - [x] Create `src/reporters/html.js` implementation
  - [x] Design responsive HTML template
  - [x] Add embedded CSS for styling
  - [x] Add basic JavaScript for interactivity
  - [x] Test report generation

- [x] **Rich Data Visualization** - Charts and tables
  - [x] Integrate Chart.js or similar lightweight library
  - [x] Add performance trend charts
  - [x] Add regression detail tables
  - [x] Add suite health dashboard
  - [x] Test visualizations with sample data

#### 3.2 Context-Aware HTML Reports
- [x] **Hierarchical Report Structure** - Organize by context
  - [x] Add suite-level sections
  - [x] Add tag-based filtering
  - [x] Add expandable/collapsible sections
  - [x] Add search and filter functionality
  - [x] Test hierarchical navigation

- [x] **Interactive Features** - Enhanced user experience
  - [x] Add client-side filtering
  - [x] Add sorting capabilities
  - [x] Add export functionality (CSV, PDF)
  - [x] Add bookmark/sharing features
  - [x] Test interactive features across browsers

#### 3.3 Performance History in HTML
- [x] **Historical Trend Integration** - Show performance over time
  - [x] Add trend charts for individual steps
  - [x] Add historical comparison tables
  - [x] Add performance health indicators
  - [x] Test with historical data

#### 3.4 Phase 3 Testing & Validation
- [x] **HTML Generation Tests** - Test report output
  - [x] Create `test/unit/reporters/html.test.js`
  - [x] Test HTML structure and validity
  - [x] Test embedded assets (CSS, JS)
  - [x] Test report size and performance

- [x] **Visual Regression Tests** - Ensure consistent output
  - [x] Add sample HTML report generation
  - [x] Test across different data scenarios
  - [x] Validate report accessibility
  - [x] Test mobile responsiveness

### Phase 4: Multi-Job Aggregation (Weeks 13-16)

#### 4.1 Job Coordination System
- [x] **Add Aggregation Commands** - New CLI commands
  - [x] Create `src/commands/aggregate.js`
  - [x] Add job waiting and coordination logic
  - [x] Add result collection from multiple sources
  - [x] Test aggregation command

- [x] **Job Metadata Management** - Track job completion
  - [x] Add job registration and tracking
  - [x] Add completion status monitoring
  - [x] Add timeout and error handling
  - [x] Test job lifecycle management

#### 4.2 Result Aggregation Engine
- [x] **Multi-Job Analysis** - Aggregate results across jobs
  - [x] Update `src/analysis/engine.js` for multi-job analysis
  - [x] Add result merging logic
  - [x] Add job-level performance metrics
  - [x] Test aggregated analysis

- [x] **Enhanced HTML Reports** - Multi-job visualization
  - [x] Add job-level performance sections
  - [x] Add cross-job comparison charts
  - [x] Add job failure/success indicators
  - [x] Test multi-job report generation

#### 4.3 CI/CD Pipeline Integration
- [x] **Pipeline Configuration Examples** - Document integration
  - [x] Create `examples/pipelines/` directory
  - [x] Add GitHub Actions example
  - [x] Add Jenkins pipeline example
  - [x] Add GitLab CI example
  - [x] Add Azure DevOps example
  - [x] Test pipeline integration

#### 4.4 Phase 4 Testing & Validation
- [x] **Aggregation Tests** - Test multi-job scenarios
  - [x] Create `test/integration/aggregate.integration.test.js`
  - [x] Test job coordination logic
  - [x] Test result merging
  - [x] Test error handling in aggregation

- [x] **End-to-End Tests** - Test complete workflow
  - [x] Simulate multi-job CI/CD scenario
  - [x] Test aggregation with different storage adapters
  - [x] Test integration test scenarios
  - [x] Validate basic performance scenarios

### Phase 5: PR-Level Intelligence (Weeks 17-20)

#### 5.1 PR Context Management
- [ ] **PR Metadata Collection** - Track PR information
  - [ ] Add PR number and commit SHA tracking
  - [ ] Add branch and merge target detection
  - [ ] Add PR lifecycle state management
  - [ ] Test PR context collection

- [ ] **Multi-Commit Analysis** - Analyze across PR commits
  - [ ] Add cumulative performance analysis
  - [ ] Add commit-to-commit comparison
  - [ ] Add PR-level trend detection
  - [ ] Test multi-commit scenarios

#### 5.2 Smart Regression Detection
- [ ] **Confidence Scoring** - Improve regression accuracy
  - [ ] Add confidence algorithms
  - [ ] Add pattern recognition for consistent issues
  - [ ] Add false positive reduction
  - [ ] Test confidence scoring

- [ ] **PR-Level Reporting** - Comprehensive PR analysis
  - [ ] Add PR summary reports
  - [ ] Add commit-level breakdowns
  - [ ] Add improvement detection
  - [ ] Test PR-level HTML reports

#### 5.3 Phase 5 Testing & Validation
- [ ] **PR Intelligence Tests** - Test PR-level features
  - [ ] Create `test/unit/pr-intelligence.test.js`
  - [ ] Test multi-commit analysis
  - [ ] Test confidence scoring
  - [ ] Test PR-level aggregation

### Phase 6: Production Readiness (Weeks 21-24)

**Phase 6: Minimum Viable Production Readiness (Alpha)**

This revised phase focuses on the essentials for stability, maintainability, and user support for the initial alpha release. It defers advanced optimizations until they are proven necessary.

#### 6.1 Core Data Management (Essential)
This is critical for managing storage costs and ensuring data quality.

- [ ] **Implement Data Retention Policies**:
  - Add a configuration option to automatically delete test run data older than a specified number of days (e.g., `dataRetentionDays: 90`)
  - This prevents indefinite data growth and keeps storage costs (like S3) under control

- [ ] **Create a Manual Cleanup Command**:
  - Add a CLI command (`perf-sentinel cleanup --older-than 30d`) to allow users to manually purge old data
  - This is crucial for housekeeping and managing corrupted or unwanted test data

#### 6.2 Essential Observability & Support (The "It Works" Essentials)
Instead of full-blown monitoring, this focuses on basic diagnostics.

- [ ] **Tool Execution Logging**:
  - Enhance the tool's output to include its own performance metrics. For example:
    ```
    Analysis complete.
    - Steps analyzed: 150
    - Analysis duration: 12.5s
    - Report generation: 1.2s
    ```
  - This helps identify if the tool itself is a performance bottleneck in the CI pipeline

- [ ] **Implement a health-check Command**:
  - Create a simple command (`perf-sentinel health-check`) that:
    - Validates the config.yml file syntax
    - Attempts to connect to the configured storage backend (S3, MongoDB, etc.) with the provided credentials
    - Reports success or provides a clear error message (e.g., "Connection to S3 failed: Invalid access key")

- [ ] **Add a --debug Flag**:
  - Implement a global `--debug` or `--verbose` flag that enables detailed logging for easier troubleshooting of user-reported issues

#### 6.3 Foundational Documentation (Essential for Adoption)
Focus on practical, "how-to" documentation. Defer video tutorials.

- [ ] **Update README.md**:
  - Ensure the main README.md is a comprehensive guide for the alpha version, covering installation, basic usage, and the PR comparison workflow

- [ ] **Create a Configuration Guide**:
  - Add a CONFIGURATION.md file with clear, copy-pasteable examples for setting up the different storage adapters (S3, MongoDB) and CI integration (GitHub Actions)

- [ ] **Create a Basic Troubleshooting Guide**:
  - Add a TROUBLESHOOTING.md that lists common errors (e.g., from the health-check) and their solutions

#### 6.4 Deferred for Post-Alpha
These items from the original plan are important for a mature product but are not critical for the alpha.

- **Deferred**: Analysis Engine Optimization (Profile only if it becomes a problem)
- **Deferred**: Data Compression (Implement only when storage costs or transfer times are a proven issue)
- **Deferred**: Advanced Operational Tools
- **Deferred**: Video Tutorials/Demos

### Development Guidelines for Cursor & Claude-4

#### Working with Each Phase
1. **Complete one phase before moving to next** - Each phase should be fully functional
2. **Maintain backward compatibility** - Existing functionality should continue working
3. **Test incrementally** - Run tests after each major component
4. **Update documentation** - Keep README and examples current

#### Testing Strategy
- **Unit Tests First** - Write tests for new components as you build them
- **Integration Tests** - Test component interactions within each phase
- **E2E Tests** - Test complete workflows at phase completion
- **Performance Tests** - Validate performance targets are met

#### Code Quality Guidelines
- **Consistent Patterns** - Follow existing code patterns in the codebase
- **Error Handling** - Add comprehensive error handling and recovery
- **Logging** - Add appropriate logging for debugging and monitoring
- **Configuration** - Make new features configurable through YAML

#### Phase Completion Criteria
Each phase is complete when:
- [ ] All checkboxes in the phase are completed
- [ ] All tests pass (unit, integration, e2e)
- [ ] Documentation is updated
- [ ] Backward compatibility is maintained
- [ ] Performance targets are met 