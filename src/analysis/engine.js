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
  
  const report = {
    regressions: [],
    newSteps: [],
    ok: [],
    trends: [], // New: track significant trends
  };

  const updatedHistory = JSON.parse(JSON.stringify(history)); // Deep clone

  for (const step of latestRun) {
    const stepText = step.stepText;
    const duration = step.duration;
    const historyEntry = updatedHistory[stepText];

    if (!historyEntry) {
      // This is a new step that we've never seen before.
      updatedHistory[stepText] = {
        durations: [duration],
        average: duration,
        stdDev: 0,
      };
      report.newSteps.push({ stepText, duration });
    } else {
      // This step has a history. Let's analyze it.
      const stepConfig = configLoader.getStepConfig(stepText, historyEntry.average, config);
      const isRegression = shouldReportRegression(duration, historyEntry.average, historyEntry.stdDev, historyEntry, stepConfig, trendConfig);

      if (isRegression && historyEntry.durations.length > 1) { // Don't flag on the first run after seeding
        const slowdown = duration - historyEntry.average;
        const percentage = ((slowdown / historyEntry.average) * 100);
        
        report.regressions.push({
          stepText,
          currentDuration: duration,
          average: historyEntry.average,
          stdDev: historyEntry.stdDev,
          slowdown,
          percentage,
        });
      } else {
        report.ok.push({ stepText, duration });
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
            type: 'drift'
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
    }
  }

  return { report, updatedHistory };
}

module.exports = {
  analyze,
  calculateAverage,
  calculateStdDev,
  calculateTrend,
  shouldReportRegression,
}; 