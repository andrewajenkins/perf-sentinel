function generateReport(report) {
  const lines = ['# Performance Regression Report'];

  if (report.regressions.length > 0) {
    lines.push('\n## ❌ Regressions Found\n');
    lines.push('| Step | Current | Average | Slowdown |');
    lines.push('| :--- | :--- | :--- | :--- |');
    report.regressions.forEach(r => {
      const slowdown = r.currentDuration - r.average;
      const percentage = ((slowdown / r.average) * 100).toFixed(1);
      lines.push(
        `| ${r.stepText} | ${r.currentDuration.toFixed(2)}ms | ${r.average.toFixed(2)}ms | **+${percentage}%** |`
      );
    });
  } else {
    lines.push('\n## ✅ No Regressions Found\n');
    lines.push('All steps performed within the expected performance threshold.');
  }
  
  // To use this output, you might pipe it to a file:
  // npx perf-sentinel analyze ... --reporter markdown > report.md
  console.log(lines.join('\n'));
}

module.exports = { generateReport }; 