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

function calculateTrend(durations, windowSize = 3) {
  if (durations.length < windowSize * 2) return { trend: 0, isSignificant: false };
  
  const recentWindow = durations.slice(-windowSize);
  const olderWindow = durations.slice(-(windowSize * 2), -windowSize);
  
  const recentAvg = calculateAverage(recentWindow);
  const olderAvg = calculateAverage(olderWindow);
  
  const trend = recentAvg - olderAvg;
  const isSignificant = Math.abs(trend) > 10; // 10ms minimum trend significance
  
  return { trend, isSignificant };
}

function shouldReportRegression(currentDuration, average, stdDev, historyEntry, threshold = 2.0) {
  const basicRegression = currentDuration > (average + (threshold * stdDev));
  
  if (!basicRegression) return false;
  
  // Calculate regression details
  const slowdown = currentDuration - average;
  const percentage = ((slowdown / average) * 100);
  
  // Rule 1: For very fast steps (under 50ms), be more lenient with small absolute changes
  if (average < 50 && slowdown < 15) {
    return false;
  }
  
  // Rule 2: For fast steps (under 100ms), don't report tiny slowdowns unless significant
  if (average < 100 && slowdown < 10 && percentage < 10) {
    return false;
  }
  
  // Rule 3: Don't report very small percentage changes on any step (under 3%)
  if (percentage < 3) {
    return false;
  }
  
  // Rule 4: For steps under 100ms with sufficient history, check for cumulative drift
  if (average < 100 && historyEntry.durations.length >= 6) {
    const { trend, isSignificant } = calculateTrend(historyEntry.durations);
    
    // If there's no significant trend and the slowdown is small, skip it
    if (!isSignificant && slowdown < 20) {
      return false;
    }
  }
  
  // Rule 5: Filter out noise - require minimum absolute slowdown for very stable steps
  if (stdDev < 2 && slowdown < 5) { // Very stable step with tiny slowdown
    return false;
  }
  
  return true;
}

function analyze(latestRun, history, threshold = 2.0, maxHistory = 50) {
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
      const isRegression = shouldReportRegression(duration, historyEntry.average, historyEntry.stdDev, historyEntry, threshold);

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
      if (historyEntry.durations.length >= 6) {
        const { trend, isSignificant } = calculateTrend(historyEntry.durations);
        
        if (isSignificant && trend > 0) { // Upward trend
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