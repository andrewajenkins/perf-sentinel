function generateReport(report) {
  const lines = ['# Performance Regression Report'];

  if (report.regressions.length > 0) {
    lines.push('\n## ❌ Significant Regressions Found\n');
    lines.push('| Step | Current | Average | Slowdown | % Change |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');
    report.regressions.forEach(r => {
      const slowdown = r.slowdown || (r.currentDuration - r.average);
      const percentage = r.percentage || ((slowdown / r.average) * 100);
      lines.push(
        `| ${r.stepText} | ${r.currentDuration.toFixed(2)}ms | ${r.average.toFixed(2)}ms | **+${slowdown.toFixed(2)}ms** | **+${percentage.toFixed(1)}%** |`
      );
    });
  }

  if (report.trends && report.trends.length > 0) {
    lines.push('\n## ⚠️ Performance Drift Detected\n');
    lines.push('| Step | Current | Average | Trend |');
    lines.push('| :--- | :--- | :--- | :--- |');
    report.trends.forEach(t => {
      lines.push(
        `| ${t.stepText} | ${t.currentDuration.toFixed(2)}ms | ${t.average.toFixed(2)}ms | **+${t.trend.toFixed(1)}ms** drift |`
      );
    });
  }

  if (report.newSteps.length > 0) {
    lines.push('\n## ✨ New Steps\n');
    lines.push('| Step | Duration |');
    lines.push('| :--- | :--- |');
    report.newSteps.forEach(n => {
      lines.push(`| ${n.stepText} | ${n.duration.toFixed(2)}ms |`);
    });
  }

  if (report.regressions.length === 0 && (!report.trends || report.trends.length === 0)) {
    lines.push('\n## ✅ No Significant Issues Found\n');
    lines.push('All steps performed within the expected performance threshold.');
  }

  // Analysis rules summary
  lines.push('\n## 📊 Analysis Rules');
  lines.push('- **Very fast steps (<50ms)**: require 15ms+ slowdown');
  lines.push('- **Fast steps (<100ms)**: require 10ms+ slowdown and 10%+ change');
  lines.push('- **All steps**: require 3%+ slowdown, filters out noise on stable steps');
  lines.push('- **Trend detection**: monitors 6+ runs for performance drift');

  // To use this output, you might pipe it to a file:
  // npx perf-sentinel analyze ... --reporter markdown > report.md
  console.log(lines.join('\n'));
}

module.exports = { generateReport }; 