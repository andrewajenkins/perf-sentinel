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

function analyze(latestRun, history, threshold = 2.0, maxHistory = 50) {
  const report = {
    regressions: [],
    newSteps: [],
    ok: [],
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
      const isRegression = duration > (historyEntry.average + (threshold * historyEntry.stdDev));

      if (isRegression && historyEntry.durations.length > 1) { // Don't flag on the first run after seeding
        report.regressions.push({
          stepText,
          currentDuration: duration,
          average: historyEntry.average,
          stdDev: historyEntry.stdDev,
        });
      } else {
        report.ok.push({ stepText, duration });
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
}; 