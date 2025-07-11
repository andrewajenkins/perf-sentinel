const { calculateAverage, calculateStdDev, calculateTrend } = require('./engine');

/**
 * PR Intelligence Module
 * Provides PR-level performance analysis including multi-commit analysis,
 * confidence scoring, and PR lifecycle management
 */

class PRIntelligence {
  constructor(config = {}) {
    this.config = {
      confidenceThreshold: config.confidenceThreshold || 0.7,
      minCommitsForTrend: config.minCommitsForTrend || 3,
      maxCommitsHistory: config.maxCommitsHistory || 50,
      falsePositiveReduction: config.falsePositiveReduction || true,
      patternRecognition: config.patternRecognition || true,
      ...config
    };
  }

  /**
   * Extract PR context from environment variables and metadata
   */
  extractPRContext() {
    const prContext = {
      prNumber: process.env.PR_NUMBER || process.env.PULL_REQUEST_NUMBER || 
                process.env.GITHUB_PR_NUMBER || process.env.CI_MERGE_REQUEST_IID || null,
      commitSha: process.env.COMMIT_SHA || process.env.GITHUB_SHA || 
                 process.env.CI_COMMIT_SHA || process.env.GIT_COMMIT || null,
      branch: process.env.BRANCH_NAME || process.env.GITHUB_HEAD_REF || 
              process.env.CI_COMMIT_REF_NAME || process.env.GIT_BRANCH || null,
      targetBranch: process.env.TARGET_BRANCH || process.env.GITHUB_BASE_REF || 
                    process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME || 'main',
      authorName: process.env.COMMIT_AUTHOR_NAME || process.env.GITHUB_ACTOR || 
                  process.env.CI_COMMIT_AUTHOR || null,
      authorEmail: process.env.COMMIT_AUTHOR_EMAIL || process.env.CI_COMMIT_AUTHOR_EMAIL || null,
      timestamp: new Date().toISOString(),
      buildNumber: process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || 
                   process.env.CI_PIPELINE_ID || null,
      buildUrl: process.env.BUILD_URL || process.env.GITHUB_SERVER_URL || 
                process.env.CI_PIPELINE_URL || null,
      repository: process.env.GITHUB_REPOSITORY || process.env.CI_PROJECT_PATH || null,
      platform: this.detectCIPlatform()
    };

    // Validate required fields
    if (!prContext.prNumber && !prContext.commitSha) {
      console.warn('⚠️  PR Intelligence: Neither PR number nor commit SHA found. PR-level analysis will be limited.');
    }

    return prContext;
  }

  /**
   * Detect CI platform based on environment variables
   */
  detectCIPlatform() {
    if (process.env.GITHUB_ACTIONS) return 'github-actions';
    if (process.env.JENKINS_URL) return 'jenkins';
    if (process.env.GITLAB_CI) return 'gitlab-ci';
    if (process.env.AZURE_DEVOPS) return 'azure-devops';
    if (process.env.CIRCLECI) return 'circleci';
    if (process.env.TRAVIS) return 'travis';
    return 'unknown';
  }

  /**
   * Extract PR lifecycle state
   */
  extractPRLifecycleState() {
    const eventType = process.env.GITHUB_EVENT_NAME || process.env.CI_PIPELINE_SOURCE || 'unknown';
    const isDraft = process.env.GITHUB_DRAFT === 'true' || process.env.CI_MERGE_REQUEST_DRAFT === 'true';
    const isApproved = process.env.GITHUB_APPROVED === 'true' || process.env.CI_MERGE_REQUEST_APPROVED === 'true';
    
    let state = 'unknown';
    let phase = 'development';
    
    if (eventType === 'pull_request' || eventType === 'merge_request') {
      if (isDraft) {
        state = 'draft';
        phase = 'development';
      } else if (isApproved) {
        state = 'approved';
        phase = 'ready-to-merge';
      } else {
        state = 'review';
        phase = 'code-review';
      }
    } else if (eventType === 'push') {
      state = 'push';
      phase = 'development';
    } else if (eventType === 'merge' || eventType === 'merged') {
      state = 'merged';
      phase = 'merged';
    }

    return {
      state,
      phase,
      eventType,
      isDraft,
      isApproved
    };
  }

  /**
   * Enhance context with PR-level information
   */
  enhanceContextWithPRInfo(context) {
    const prContext = this.extractPRContext();
    const lifecycleState = this.extractPRLifecycleState();
    
    return {
      ...context,
      pr: {
        ...prContext,
        lifecycle: lifecycleState,
        extractedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Analyze performance across multiple commits in a PR
   */
  analyzeMultiCommitPerformance(commitHistory, currentReport) {
    if (!commitHistory || commitHistory.length < 2) {
      return {
        type: 'single-commit',
        analysis: null,
        confidence: 0.5,
        message: 'Insufficient commit history for multi-commit analysis'
      };
    }

    const analysis = {
      type: 'multi-commit',
      totalCommits: commitHistory.length,
      cumulativeRegressions: [],
      consistentRegressions: [],
      improvements: [],
      trendAnalysis: {},
      confidence: 0
    };

    // Track step performance across commits
    const stepPerformance = {};
    
    // Collect performance data from all commits
    commitHistory.forEach((commit, index) => {
      if (!commit.report) return;
      
      // Process regressions
      commit.report.regressions?.forEach(regression => {
        const stepText = regression.stepText;
        if (!stepPerformance[stepText]) {
          stepPerformance[stepText] = {
            stepText,
            commits: [],
            regressionCount: 0,
            improvementCount: 0,
            avgDuration: [],
            consistencyScore: 0
          };
        }
        
        stepPerformance[stepText].commits.push({
          commitIndex: index,
          commitSha: commit.commitSha,
          status: 'regression',
          duration: regression.currentDuration,
          baseline: regression.average,
          slowdown: regression.slowdown,
          percentage: regression.percentage
        });
        
        stepPerformance[stepText].regressionCount++;
        stepPerformance[stepText].avgDuration.push(regression.currentDuration);
      });
      
      // Process OK steps for improvement detection
      commit.report.ok?.forEach(okStep => {
        const stepText = okStep.stepText;
        if (!stepPerformance[stepText]) {
          stepPerformance[stepText] = {
            stepText,
            commits: [],
            regressionCount: 0,
            improvementCount: 0,
            avgDuration: [],
            consistencyScore: 0
          };
        }
        
        stepPerformance[stepText].commits.push({
          commitIndex: index,
          commitSha: commit.commitSha,
          status: 'ok',
          duration: okStep.duration
        });
        
        stepPerformance[stepText].avgDuration.push(okStep.duration);
      });
    });

    // Analyze patterns across commits
    Object.keys(stepPerformance).forEach(stepText => {
      const stepData = stepPerformance[stepText];
      
      // Calculate consistency score
      const totalCommits = stepData.commits.length;
      const regressionRate = stepData.regressionCount / totalCommits;
      stepData.consistencyScore = regressionRate;
      
      // Identify consistent regressions (appear in multiple commits)
      if (stepData.regressionCount >= Math.min(2, totalCommits * 0.6)) {
        analysis.consistentRegressions.push({
          stepText,
          regressionCount: stepData.regressionCount,
          totalCommits,
          consistencyScore: stepData.consistencyScore,
          avgDuration: calculateAverage(stepData.avgDuration),
          commits: stepData.commits
        });
      }
      
      // Check for improvements (consistently faster over time)
      if (stepData.avgDuration.length >= 3) {
        // Try advanced trend calculation first
        const { trend, isSignificant } = calculateTrend(stepData.avgDuration);
        if (isSignificant && trend < 0) { // Negative trend = improvement
          analysis.improvements.push({
            stepText,
            trend,
            improvement: Math.abs(trend),
            commits: stepData.commits
          });
        } else if (stepData.avgDuration.length >= 3) {
          // Fallback to simple trend detection for fewer data points
          const firstDuration = stepData.avgDuration[0];
          const lastDuration = stepData.avgDuration[stepData.avgDuration.length - 1];
          const totalImprovement = firstDuration - lastDuration;
          
          // Check if there's a consistent improvement of at least 10ms or 5%
          if (totalImprovement > 10 || (totalImprovement / firstDuration) > 0.05) {
            analysis.improvements.push({
              stepText,
              trend: -totalImprovement / stepData.avgDuration.length,
              improvement: totalImprovement,
              commits: stepData.commits
            });
          }
        }
      }
    });

    // Calculate overall confidence score
    analysis.confidence = this.calculateMultiCommitConfidence(analysis, commitHistory);

    return analysis;
  }

  /**
   * Calculate confidence score for multi-commit analysis
   */
  calculateMultiCommitConfidence(analysis, commitHistory) {
    let confidence = 0.5; // Base confidence
    
    // Factor 1: Number of commits (more commits = higher confidence)
    const commitFactor = Math.min(commitHistory.length / 10, 1) * 0.2;
    confidence += commitFactor;
    
    // Factor 2: Consistency of regressions (consistent patterns = higher confidence)
    const consistencyFactor = analysis.consistentRegressions.length > 0 ? 
      analysis.consistentRegressions.reduce((sum, reg) => sum + reg.consistencyScore, 0) / 
      analysis.consistentRegressions.length * 0.3 : 0;
    confidence += consistencyFactor;
    
    // Factor 3: Total number of data points
    const totalRegressions = analysis.consistentRegressions.reduce((sum, reg) => sum + reg.regressionCount, 0);
    const dataFactor = Math.min(totalRegressions / 20, 1) * 0.2;
    confidence += dataFactor;
    
    // Factor 4: Pattern recognition (if enabled)
    if (this.config.patternRecognition) {
      const patternFactor = this.detectPatterns(analysis) * 0.3;
      confidence += patternFactor;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Detect patterns in performance data for enhanced confidence
   */
  detectPatterns(analysis) {
    let patternScore = 0;
    
    // Pattern 1: Consistent regressions across multiple steps
    if (analysis.consistentRegressions.length > 3) {
      patternScore += 0.3;
    }
    
    // Pattern 2: Regressions in critical path
    const criticalRegressions = analysis.consistentRegressions.filter(reg => 
      reg.commits.some(commit => 
        commit.context?.tags?.some(tag => tag.includes('@critical'))
      )
    );
    if (criticalRegressions.length > 0) {
      patternScore += 0.4;
    }
    
    // Pattern 3: Escalating performance degradation
    const escalatingRegressions = analysis.consistentRegressions.filter(reg => {
      const durations = reg.commits.map(c => c.duration).slice(-3);
      return durations.length >= 2 && durations[durations.length - 1] > durations[0];
    });
    if (escalatingRegressions.length > 0) {
      patternScore += 0.3;
    }
    
    return Math.min(patternScore, 1.0);
  }

  /**
   * Calculate regression confidence score
   */
  calculateRegressionConfidence(regression, stepHistory, prHistory) {
    let confidence = 0.5; // Base confidence
    
    // Factor 1: Statistical significance
    const zScore = Math.abs(regression.slowdown / (regression.stdDev || 1));
    const statisticalFactor = Math.min(zScore / 3, 1) * 0.3;
    confidence += statisticalFactor;
    
    // Factor 2: Historical consistency
    if (stepHistory && stepHistory.length >= 5) {
      const recentAvg = calculateAverage(stepHistory.slice(-3));
      const olderAvg = calculateAverage(stepHistory.slice(0, -3));
      const consistencyFactor = recentAvg > olderAvg ? 0.2 : 0;
      confidence += consistencyFactor;
    }
    
    // Factor 3: PR-level context
    if (prHistory) {
      const prFactor = this.calculatePRContextFactor(regression, prHistory);
      confidence += prFactor * 0.3;
    }
    
    // Factor 4: Magnitude of regression
    const magnitudeFactor = Math.min(regression.percentage / 50, 1) * 0.2;
    confidence += magnitudeFactor;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate PR context factor for confidence scoring
   */
  calculatePRContextFactor(regression, prHistory) {
    let factor = 0;
    
    // Check if this step has regressed in this PR before
    const prRegressions = prHistory.filter(commit => 
      commit.report?.regressions?.some(reg => reg.stepText === regression.stepText)
    );
    
    if (prRegressions.length > 1) {
      factor += 0.4; // Consistent regression in this PR
    }
    
    // Check if this affects critical path
    if (regression.context?.tags?.some(tag => tag.includes('@critical'))) {
      factor += 0.3;
    }
    
    // Check if this is a large regression
    if (regression.percentage > 25) {
      factor += 0.3;
    }
    
    return Math.min(factor, 1.0);
  }

  /**
   * Apply false positive reduction filters
   */
  applyFalsePositiveReduction(regressions, confidence) {
    if (!this.config.falsePositiveReduction) {
      return regressions;
    }
    
    return regressions.filter(regression => {
      // Filter out low-confidence regressions
      if (confidence < this.config.confidenceThreshold) {
        return false;
      }
      
      // Filter out very small regressions in noisy steps
      if (regression.percentage < 10 && regression.stdDev > regression.slowdown) {
        return false;
      }
      
      // Filter out regressions in very fast steps (likely noise)
      if (regression.currentDuration < 50 && regression.percentage < 20) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Generate PR-level summary report
   */
  generatePRSummary(prAnalysis, currentReport) {
    const summary = {
      prContext: prAnalysis.prContext,
      lifecycle: prAnalysis.lifecycle,
      multiCommitAnalysis: prAnalysis.multiCommitAnalysis,
      confidence: prAnalysis.confidence,
      summary: {
        totalCommits: prAnalysis.multiCommitAnalysis?.totalCommits || 1,
        consistentRegressions: prAnalysis.multiCommitAnalysis?.consistentRegressions?.length || 0,
        improvements: prAnalysis.multiCommitAnalysis?.improvements?.length || 0,
        currentRegressions: currentReport.regressions?.length || 0,
        overallHealthTrend: this.calculateHealthTrend(prAnalysis)
      },
      recommendations: this.generatePRRecommendations(prAnalysis, currentReport)
    };
    
    return summary;
  }

  /**
   * Calculate overall health trend for the PR
   */
  calculateHealthTrend(prAnalysis) {
    if (!prAnalysis.multiCommitAnalysis || prAnalysis.multiCommitAnalysis.type === 'single-commit') {
      return 'insufficient-data';
    }
    
    const analysis = prAnalysis.multiCommitAnalysis;
    const regressionsCount = analysis.consistentRegressions.length;
    const improvementsCount = analysis.improvements.length;
    
    if (regressionsCount > improvementsCount * 2) {
      return 'declining';
    } else if (improvementsCount > regressionsCount * 2) {
      return 'improving';
    } else {
      return 'stable';
    }
  }

  /**
   * Generate PR-specific recommendations
   */
  generatePRRecommendations(prAnalysis, currentReport) {
    const recommendations = [];
    
    if (prAnalysis.multiCommitAnalysis?.consistentRegressions?.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'pr-regressions',
        message: `${prAnalysis.multiCommitAnalysis.consistentRegressions.length} steps showing consistent regressions across multiple commits`,
        actions: [
          'Review performance impact of changes in this PR',
          'Consider profiling the affected operations',
          'Evaluate if performance trade-offs are acceptable'
        ]
      });
    }
    
    if (prAnalysis.confidence < 0.6) {
      recommendations.push({
        priority: 'medium',
        category: 'data-quality',
        message: 'Low confidence in regression detection due to insufficient data',
        actions: [
          'Increase test coverage for performance monitoring',
          'Collect more historical data for better baselines',
          'Consider running performance tests multiple times'
        ]
      });
    }
    
    if (prAnalysis.lifecycle?.state === 'draft' && currentReport.regressions?.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'draft-pr',
        message: 'Performance regressions detected in draft PR',
        actions: [
          'Address performance issues before marking PR as ready',
          'Consider performance implications of current changes',
          'Run additional performance tests if needed'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Main analysis function that integrates PR intelligence with standard analysis
   */
  analyzePRPerformance(currentReport, prHistory = [], currentContext = {}) {
    const prContext = this.extractPRContext();
    const lifecycle = this.extractPRLifecycleState();
    const enhancedContext = this.enhanceContextWithPRInfo(currentContext);
    
    // Multi-commit analysis
    const multiCommitAnalysis = this.analyzeMultiCommitPerformance(prHistory, currentReport);
    
    // Calculate confidence scores for current regressions
    const enhancedRegressions = currentReport.regressions.map(regression => {
      const stepHistory = prHistory.map(commit => 
        commit.report?.regressions?.find(reg => reg.stepText === regression.stepText)
      ).filter(Boolean);
      
      const confidence = this.calculateRegressionConfidence(regression, stepHistory, prHistory);
      
      return {
        ...regression,
        confidence,
        prContext: enhancedContext.pr
      };
    });
    
    // Apply false positive reduction
    const filteredRegressions = this.applyFalsePositiveReduction(
      enhancedRegressions, 
      multiCommitAnalysis.confidence
    );
    
    // Generate PR-level analysis
    const prAnalysis = {
      prContext,
      lifecycle,
      multiCommitAnalysis,
      confidence: multiCommitAnalysis.confidence,
      enhancedRegressions: filteredRegressions,
      context: enhancedContext
    };
    
    // Generate summary
    const summary = this.generatePRSummary(prAnalysis, {
      ...currentReport,
      regressions: filteredRegressions
    });
    
    return {
      ...prAnalysis,
      summary,
      enhancedReport: {
        ...currentReport,
        regressions: filteredRegressions,
        prIntelligence: summary
      }
    };
  }
}

module.exports = {
  PRIntelligence
}; 