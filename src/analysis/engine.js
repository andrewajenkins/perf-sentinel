function calculateAverage(durations) {
  if (durations.length === 0) return 0;
  const sum = durations.reduce((total, duration) => total + duration, 0);
  return sum / durations.length;
}

function calculateStdDev(durations, average) {
  if (durations.length < 2) return 0;
  const variance = durations.reduce((total, duration) => total + Math.pow(duration - average, 2), 0) / (durations.length -1);
  return Math.sqrt(variance);
}

function calculateTrend(durations, config = {}) {
  const windowSize = config.window_size || 3;
  const minSignificance = config.min_significance || 10;
  
  if (durations.length < windowSize * 2) return { trend: 0, isSignificant: false };
  
  const recentWindow = durations.slice(-windowSize);
  const olderWindow = durations.slice(-(windowSize * 2), -windowSize);
  
  const recentAvg = calculateAverage(recentWindow);
  const olderAvg = calculateAverage(olderWindow);
  
  const trend = recentAvg - olderAvg;
  const isSignificant = Math.abs(trend) > minSignificance;
  
  return { trend, isSignificant };
}

// Helper function to calculate tag-based performance analysis
function analyzeTagPerformance(steps, tagToAnalyze) {
  const tagSteps = steps.filter(step => 
    step.context && step.context.tags && step.context.tags.includes(tagToAnalyze)
  );
  
  if (tagSteps.length === 0) {
    return null;
  }
  
  const durations = tagSteps.map(step => step.duration || step.currentDuration);
  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
  
  return {
    tag: tagToAnalyze,
    stepCount: tagSteps.length,
    avgDuration: totalDuration / tagSteps.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    totalDuration: totalDuration,
    steps: tagSteps,
    suites: [...new Set(tagSteps.map(step => step.context.suite))],
    testFiles: [...new Set(tagSteps.map(step => step.context.testFile))]
  };
}

// Helper function to identify critical path issues
function analyzeCriticalPath(regressions, trends, newSteps) {
  const criticalTags = ['@critical', '@smoke', '@security', '@performance'];
  const criticalIssues = [];
  
  // Check regressions in critical path
  const criticalRegressions = regressions.filter(regression => 
    regression.context && regression.context.tags && 
    regression.context.tags.some(tag => criticalTags.includes(tag))
  );
  
  if (criticalRegressions.length > 0) {
    criticalIssues.push({
      type: 'critical_regressions',
      severity: 'high',
      count: criticalRegressions.length,
      issues: criticalRegressions,
      message: `${criticalRegressions.length} regression(s) detected in critical path steps`
    });
  }
  
  // Check trends in critical path
  const criticalTrends = trends.filter(trend => 
    trend.context && trend.context.tags && 
    trend.context.tags.some(tag => criticalTags.includes(tag))
  );
  
  if (criticalTrends.length > 0) {
    criticalIssues.push({
      type: 'critical_trends',
      severity: 'medium',
      count: criticalTrends.length,
      issues: criticalTrends,
      message: `${criticalTrends.length} performance drift(s) detected in critical path steps`
    });
  }
  
  // Check new steps in critical path
  const criticalNewSteps = newSteps.filter(step => 
    step.context && step.context.tags && 
    step.context.tags.some(tag => criticalTags.includes(tag))
  );
  
  if (criticalNewSteps.length > 0) {
    criticalIssues.push({
      type: 'critical_new_steps',
      severity: 'low',
      count: criticalNewSteps.length,
      issues: criticalNewSteps,
      message: `${criticalNewSteps.length} new step(s) detected in critical path`
    });
  }
  
  return {
    totalIssues: criticalIssues.reduce((sum, issue) => sum + issue.count, 0),
    highSeverityIssues: criticalIssues.filter(issue => issue.severity === 'high').length,
    issues: criticalIssues,
    overallSeverity: criticalIssues.length > 0 ? 
      (criticalIssues.some(issue => issue.severity === 'high') ? 'high' : 
       criticalIssues.some(issue => issue.severity === 'medium') ? 'medium' : 'low') : 'none'
  };
}

// Helper function to generate tag-based recommendations
function generateTagRecommendations(tagAnalysis, criticalPath) {
  const recommendations = [];
  
  // Critical path recommendations
  if (criticalPath.overallSeverity === 'high') {
    recommendations.push({
      priority: 'high',
      category: 'critical_path',
      message: 'Immediate attention required for critical path regressions',
      actions: ['Investigate critical regressions immediately', 'Consider rollback if necessary', 'Alert development team']
    });
  } else if (criticalPath.overallSeverity === 'medium') {
    recommendations.push({
      priority: 'medium',
      category: 'critical_path',
      message: 'Monitor critical path performance trends',
      actions: ['Review trending performance issues', 'Consider performance testing', 'Monitor closely']
    });
  }
  
  // Tag-specific recommendations
  Object.values(tagAnalysis).forEach(analysis => {
    if (!analysis) return;
    
    if (analysis.tag === '@slow' && analysis.avgDuration > 2000) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        message: `Slow-tagged steps averaging ${analysis.avgDuration.toFixed(0)}ms - consider optimization`,
        actions: ['Profile slow operations', 'Implement caching', 'Optimize database queries']
      });
    }
    
    if (analysis.tag === '@critical' && analysis.stepCount > 0) {
      const avgDuration = analysis.avgDuration;
      if (avgDuration > 1000) {
        recommendations.push({
          priority: 'high',
          category: 'critical_performance',
          message: `Critical steps averaging ${avgDuration.toFixed(0)}ms - performance impact on user experience`,
          actions: ['Optimize critical user flows', 'Implement performance monitoring', 'Consider UX impact']
        });
      }
    }
    
    if (analysis.tag === '@smoke' && analysis.stepCount > 0) {
      const suiteCount = analysis.suites.length;
      if (suiteCount > 3) {
        recommendations.push({
          priority: 'low',
          category: 'test_organization',
          message: `Smoke tests span ${suiteCount} suites - consider test suite organization`,
          actions: ['Review smoke test distribution', 'Optimize test parallelization', 'Consider suite boundaries']
        });
      }
    }
  });
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

// Helper function to calculate suite health score
function calculateSuiteHealthScore(suiteData, suiteHistory = null) {
  let healthScore = 100; // Start with perfect score
  
  // Factor 1: Regression rate (30% weight)
  const regressionRate = suiteData.regressions / suiteData.totalSteps;
  const regressionPenalty = Math.min(regressionRate * 100, 30); // Max 30 point penalty
  healthScore -= regressionPenalty;
  
  // Factor 2: Performance trend (25% weight)
  if (suiteHistory && suiteHistory.avgDurationHistory && suiteHistory.avgDurationHistory.length >= 3) {
    const { trend, isSignificant } = calculateTrend(suiteHistory.avgDurationHistory, { window_size: 3, min_significance: 50 });
    if (isSignificant && trend > 0) {
      const trendPenalty = Math.min((trend / suiteData.avgDuration) * 25, 25); // Max 25 point penalty
      healthScore -= trendPenalty;
    }
  }
  
  // Factor 3: Step stability (20% weight)
  const newStepRate = suiteData.newSteps / suiteData.totalSteps;
  if (newStepRate > 0.1) { // More than 10% new steps indicates instability
    const stabilityPenalty = Math.min((newStepRate - 0.1) * 100, 20); // Max 20 point penalty
    healthScore -= stabilityPenalty;
  }
  
  // Factor 4: Critical path impact (25% weight)
  const tagsArray = Array.from(suiteData.tags || []);
  const hasCriticalTags = tagsArray.some(tag => tag.includes('@critical') || tag.includes('@smoke'));
  if (hasCriticalTags && suiteData.regressions > 0) {
    const criticalPenalty = Math.min(suiteData.regressions * 5, 25); // Max 25 point penalty
    healthScore -= criticalPenalty;
  }
  
  return Math.max(0, Math.round(healthScore));
}

// Helper function to detect suite-level regressions
function detectSuiteRegression(suiteData, suiteHistory, suiteConfig) {
  if (!suiteHistory || !suiteHistory.avgDurationHistory || suiteHistory.avgDurationHistory.length < 2) {
    return null; // Not enough history for suite-level regression detection
  }
  
  const historicalAvg = calculateAverage(suiteHistory.avgDurationHistory);
  const historicalStdDev = calculateStdDev(suiteHistory.avgDurationHistory, historicalAvg);
  const threshold = suiteConfig.threshold || 2.0;
  
  // Check if current suite average is significantly higher than historical average
  const isRegression = suiteData.avgDuration > (historicalAvg + (threshold * historicalStdDev));
  
  if (isRegression) {
    const slowdown = suiteData.avgDuration - historicalAvg;
    const percentage = ((slowdown / historicalAvg) * 100);
    
    return {
      type: 'suite_regression',
      suite: suiteData.suite,
      currentAvg: suiteData.avgDuration,
      historicalAvg: historicalAvg,
      slowdown: slowdown,
      percentage: percentage,
      threshold: threshold,
      affectedSteps: suiteData.totalSteps,
      regressionSteps: suiteData.regressions
    };
  }
  
  return null;
}

// Helper function to categorize suite performance
function categorizeSuitePerformance(suiteData, suiteConfig) {
  const avgDuration = suiteData.avgDuration;
  const regressionRate = suiteData.regressions / suiteData.totalSteps;
  const healthScore = suiteData.healthScore;
  
  // Determine performance category
  let category = 'good';
  let severity = 'low';
  
  if (healthScore < 50 || regressionRate > 0.3) {
    category = 'critical';
    severity = 'high';
  } else if (healthScore < 70 || regressionRate > 0.15) {
    category = 'warning';
    severity = 'medium';
  } else if (healthScore < 85 || regressionRate > 0.05) {
    category = 'attention';
    severity = 'low';
  }
  
  return {
    category,
    severity,
    recommendations: generateSuiteRecommendations(suiteData, category)
  };
}

// Helper function to generate suite-specific recommendations
function generateSuiteRecommendations(suiteData, category) {
  const recommendations = [];
  
  if (suiteData.regressions > 0) {
    recommendations.push(`Investigate ${suiteData.regressions} regressed step(s) in this suite`);
  }
  
  if (suiteData.newSteps / suiteData.totalSteps > 0.1) {
    recommendations.push('High number of new steps detected - review test coverage changes');
  }
  
  if (suiteData.avgDuration > 1000) {
    recommendations.push('Suite average duration exceeds 1 second - consider optimization');
  }
  
  const tagsArray = Array.from(suiteData.tags || []);
  const hasCriticalTags = tagsArray.some(tag => tag.includes('@critical'));
  if (hasCriticalTags && category !== 'good') {
    recommendations.push('Critical-tagged tests affected - prioritize investigation');
  }
  
  if (suiteData.testFiles.length > 10) {
    recommendations.push('Large test suite - consider splitting for better parallel execution');
  }
  
  return recommendations;
}

// Helper function to validate and normalize context data
function validateAndNormalizeContext(context) {
  if (!context || typeof context !== 'object') {
    return {
      testFile: 'unknown.feature',
      testName: 'Unknown Test',
      suite: 'unknown',
      tags: [],
      jobId: 'local',
      workerId: 'local'
    };
  }
  
  return {
    testFile: context.testFile || 'unknown.feature',
    testName: context.testName || 'Unknown Test',
    suite: context.suite || 'unknown',
    tags: Array.isArray(context.tags) ? context.tags : [],
    jobId: context.jobId || 'local',
    workerId: context.workerId || 'local'
  };
}

// Helper function to extract step data with context validation
function extractStepData(step) {
  const stepText = step.stepText;
  const duration = step.duration;
  const timestamp = step.timestamp;
  const context = validateAndNormalizeContext(step.context);
  
  return {
    stepText,
    duration,
    timestamp,
    context
  };
}

function shouldReportRegression(currentDuration, average, stdDev, historyEntry, stepConfig, trendConfig) {
  const threshold = stepConfig.threshold;
  const rules = stepConfig.rules;
  
  const basicRegression = currentDuration > (average + (threshold * stdDev));
  
  if (!basicRegression) return false;
  
  // Calculate regression details
  const slowdown = currentDuration - average;
  const percentage = ((slowdown / average) * 100);
  
  // Check minimum percentage change
  if (percentage < rules.min_percentage_change) {
    return false;
  }
  
  // Check minimum absolute slowdown
  if (slowdown < rules.min_absolute_slowdown) {
    return false;
  }
  
  // Check for trend-based filtering if enabled
  if (rules.check_trends && historyEntry.durations.length >= (trendConfig.min_history_required || 6)) {
    const { trend, isSignificant } = calculateTrend(historyEntry.durations, trendConfig);
    
    // If there's no significant trend and the slowdown is small, skip it
    if (!isSignificant && slowdown < (rules.trend_sensitivity || 20)) {
      return false;
    }
  }
  
  // Filter out noise - require minimum absolute slowdown for very stable steps
  if (rules.filter_stable_steps && stdDev < (rules.stable_threshold || 2) && slowdown < (rules.stable_min_slowdown || 5)) {
    return false;
  }
  
  return true;
}

function analyze(latestRun, history, config, configLoader) {
  const threshold = config.analysis.threshold;
  const maxHistory = config.analysis.max_history;
  const trendConfig = config.analysis.trends;
  const analysisTimestamp = new Date().toISOString(); // Global timestamp for this analysis
  
  const report = {
    regressions: [],
    newSteps: [],
    ok: [],
    trends: [], // Track significant trends
    suites: {}, // Enhanced suite-level summary
    suiteRegressions: [], // Suite-level regressions
    tagAnalysis: {}, // Tag-based performance analysis
    criticalPath: {}, // Critical path analysis
    recommendations: [], // System-wide recommendations
    metadata: { // Run metadata
      totalSteps: 0,
      uniqueSteps: 0,
      suites: [],
      tags: [],
      jobs: [],
      timestamp: analysisTimestamp,
      overallHealth: 0 // Overall system health score
    }
  };

  const updatedHistory = JSON.parse(JSON.stringify(history)); // Deep clone
  const suiteStats = {};
  const runMetadata = {
    tags: new Set(),
    jobs: new Set(),
    suites: new Set()
  };

  // Initialize suite history if not exists
  if (!updatedHistory._suiteHistory) {
    updatedHistory._suiteHistory = {};
  }

  for (const step of latestRun) {
    const stepData = extractStepData(step);
    const { stepText, duration, timestamp, context } = stepData;
    
    // Collect metadata
    report.metadata.totalSteps++;
    context.tags.forEach(tag => runMetadata.tags.add(tag));
    runMetadata.jobs.add(context.jobId);
    runMetadata.suites.add(context.suite);
    
    // Track suite statistics
    if (!suiteStats[context.suite]) {
      suiteStats[context.suite] = {
        suite: context.suite,
        totalSteps: 0,
        regressions: 0,
        newSteps: 0,
        okSteps: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        testFiles: new Set(),
        tags: new Set(),
        stepDetails: [],
        criticalSteps: 0,
        smokeSteps: 0
      };
    }
    
    const suiteData = suiteStats[context.suite];
    suiteData.totalSteps++;
    suiteData.totalDuration += duration;
    suiteData.minDuration = Math.min(suiteData.minDuration, duration);
    suiteData.maxDuration = Math.max(suiteData.maxDuration, duration);
    suiteData.testFiles.add(context.testFile);
    context.tags.forEach(tag => suiteData.tags.add(tag));
    
    // Track critical and smoke steps
    if (context.tags.some(tag => tag.includes('@critical'))) {
      suiteData.criticalSteps++;
    }
    if (context.tags.some(tag => tag.includes('@smoke'))) {
      suiteData.smokeSteps++;
    }
    
    const historyEntry = updatedHistory[stepText];

    if (!historyEntry) {
      // This is a new step that we've never seen before.
      updatedHistory[stepText] = {
        durations: [duration],
        average: duration,
        stdDev: 0,
        context: context, // Store context in history
        firstSeen: timestamp,
        lastSeen: timestamp
      };
      
      const newStepData = { 
        stepText, 
        duration, 
        context,
        timestamp
      };
      
      report.newSteps.push(newStepData);
      suiteData.newSteps++;
      suiteData.stepDetails.push({ stepText, duration, status: 'new', context });
    } else {
      // This step has a history. Let's analyze it using context-aware configuration.
      const stepConfig = configLoader.getStepConfig(stepText, historyEntry.average, config, context);
      const isRegression = shouldReportRegression(duration, historyEntry.average, historyEntry.stdDev, historyEntry, stepConfig, trendConfig);

      if (isRegression && historyEntry.durations.length > 1) { // Don't flag on the first run after seeding
        const slowdown = duration - historyEntry.average;
        const percentage = ((slowdown / historyEntry.average) * 100);
        
        const regressionData = {
          stepText,
          currentDuration: duration,
          average: historyEntry.average,
          stdDev: historyEntry.stdDev,
          slowdown,
          percentage,
          context,
          timestamp,
          appliedConfig: stepConfig // Include the applied configuration for debugging
        };
        
        report.regressions.push(regressionData);
        suiteData.regressions++;
        suiteData.stepDetails.push({ stepText, duration, status: 'regression', context, slowdown, percentage });
      } else {
        const okData = { 
          stepText, 
          duration, 
          context,
          timestamp
        };
        
        report.ok.push(okData);
        suiteData.okSteps++;
        suiteData.stepDetails.push({ stepText, duration, status: 'ok', context });
      }
      
      // Check for significant trends even if not currently regressing
      if (trendConfig.enabled && historyEntry.durations.length >= trendConfig.min_history_required) {
        const { trend, isSignificant } = calculateTrend(historyEntry.durations, trendConfig);
        
        if (isSignificant && (!trendConfig.only_upward || trend > 0)) {
          report.trends.push({
            stepText,
            trend,
            currentDuration: duration,
            average: historyEntry.average,
            type: 'drift',
            context,
            timestamp
          });
        }
      }
      
      // Update the history for this step
      historyEntry.durations.push(duration);
      if (historyEntry.durations.length > maxHistory) {
        historyEntry.durations.shift(); // Keep the history to a manageable size
      }

      const newAverage = calculateAverage(historyEntry.durations);
      const newStdDev = calculateStdDev(historyEntry.durations, newAverage);
      historyEntry.average = newAverage;
      historyEntry.stdDev = newStdDev;
      historyEntry.lastSeen = timestamp;
      
      // Update context in history (merge with existing context)
      if (historyEntry.context) {
        historyEntry.context = {
          ...historyEntry.context,
          ...context,
          // Merge tags without duplicates
          tags: [...new Set([...historyEntry.context.tags, ...context.tags])]
        };
      } else {
        historyEntry.context = context;
      }
    }
  }

  // Enhanced suite analysis and populate suite summary
  let totalHealthScore = 0;
  Object.keys(suiteStats).forEach(suiteName => {
    const suite = suiteStats[suiteName];
    suite.avgDuration = suite.totalDuration / suite.totalSteps;
    suite.testFiles = Array.from(suite.testFiles);
    suite.tags = Array.from(suite.tags);
    
    // Fix minDuration if no steps were processed
    if (suite.minDuration === Infinity) {
      suite.minDuration = 0;
    }
    
    // Get suite configuration
    const suiteConfig = configLoader.getSuiteConfig(suiteName, config);
    suite.appliedConfig = {
      threshold: suiteConfig.threshold,
      rules: suiteConfig.rules
    };
    
    // Get or initialize suite history
    if (!updatedHistory._suiteHistory[suiteName]) {
      updatedHistory._suiteHistory[suiteName] = {
        avgDurationHistory: [],
        totalStepsHistory: [],
        regressionRateHistory: [],
        lastUpdated: analysisTimestamp
      };
    }
    
    const suiteHistory = updatedHistory._suiteHistory[suiteName];
    
    // Calculate suite health score
    suite.healthScore = calculateSuiteHealthScore(suite, suiteHistory);
    totalHealthScore += suite.healthScore;
    
    // Detect suite-level regressions
    const suiteRegression = detectSuiteRegression(suite, suiteHistory, suiteConfig);
    if (suiteRegression) {
      report.suiteRegressions.push(suiteRegression);
    }
    
    // Categorize suite performance
    const performanceCategory = categorizeSuitePerformance(suite, suiteConfig);
    suite.category = performanceCategory.category;
    suite.severity = performanceCategory.severity;
    suite.recommendations = performanceCategory.recommendations;
    
    // Update suite history
    suiteHistory.avgDurationHistory.push(suite.avgDuration);
    suiteHistory.totalStepsHistory.push(suite.totalSteps);
    suiteHistory.regressionRateHistory.push(suite.regressions / suite.totalSteps);
    suiteHistory.lastUpdated = analysisTimestamp;
    
    // Keep suite history manageable
    const maxSuiteHistory = 20;
    if (suiteHistory.avgDurationHistory.length > maxSuiteHistory) {
      suiteHistory.avgDurationHistory.shift();
      suiteHistory.totalStepsHistory.shift();
      suiteHistory.regressionRateHistory.shift();
    }
    
    report.suites[suiteName] = suite;
  });

  // Calculate overall system health
  const suiteCount = Object.keys(suiteStats).length;
  report.metadata.overallHealth = suiteCount > 0 ? Math.round(totalHealthScore / suiteCount) : 100;

  // Populate run metadata
  report.metadata.uniqueSteps = Object.keys(updatedHistory).length;
  report.metadata.suites = Array.from(runMetadata.suites);
  report.metadata.tags = Array.from(runMetadata.tags);
  report.metadata.jobs = Array.from(runMetadata.jobs);

  // Perform tag-based analysis
  const allSteps = [...report.regressions, ...report.newSteps, ...report.ok, ...report.trends];
  const uniqueTags = [...new Set(allSteps.flatMap(step => step.context?.tags || []))];
  
  // Analyze performance for each tag
  uniqueTags.forEach(tag => {
    const tagAnalysis = analyzeTagPerformance(allSteps, tag);
    if (tagAnalysis) {
      report.tagAnalysis[tag] = tagAnalysis;
    }
  });
  
  // Perform critical path analysis
  report.criticalPath = analyzeCriticalPath(report.regressions, report.trends, report.newSteps);
  
  // Generate system-wide recommendations
  report.recommendations = generateTagRecommendations(report.tagAnalysis, report.criticalPath);

  return { report, updatedHistory };
}

module.exports = {
  analyze,
  calculateAverage,
  calculateStdDev,
  calculateTrend,
  shouldReportRegression,
  validateAndNormalizeContext,
  extractStepData,
  calculateSuiteHealthScore,
  detectSuiteRegression,
  categorizeSuitePerformance,
}; 