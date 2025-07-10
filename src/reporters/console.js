const chalk = require('chalk');

function generateReport(report) {
  console.log(chalk.bold.underline('\nPerformance Regression Report'));

  if (report.regressions.length > 0) {
    console.log(chalk.red.bold('\n❌ Significant Regressions Found'));
    report.regressions.forEach(r => {
      const slowdown = r.slowdown || (r.currentDuration - r.average);
      const percentage = r.percentage || ((slowdown / r.average) * 100);
      console.log(
        `  - ${chalk.cyan(r.stepText)}: ${chalk.yellow(r.currentDuration.toFixed(2) + 'ms')} (was ${r.average.toFixed(2)}ms, +${slowdown.toFixed(2)}ms / ${percentage.toFixed(1)}% slower)`
      );
    });
  }

  if (report.trends && report.trends.length > 0) {
    console.log(chalk.yellow.bold('\n⚠️  Performance Drift Detected'));
    report.trends.forEach(t => {
      console.log(
        `  - ${chalk.cyan(t.stepText)}: ${chalk.yellow(t.currentDuration.toFixed(2) + 'ms')} (avg: ${t.average.toFixed(2)}ms, trending +${t.trend.toFixed(1)}ms over recent runs)`
      );
    });
  }

  if (report.newSteps.length > 0) {
    console.log(chalk.yellow.bold('\n✨ New Steps'));
    report.newSteps.forEach(n => {
      console.log(`  - ${chalk.cyan(n.stepText)}: ${n.duration.toFixed(2)}ms`);
    });
  }
  
  if (report.regressions.length === 0 && report.newSteps.length === 0 && (!report.trends || report.trends.length === 0)) {
      console.log(chalk.green.bold('\n✅ All steps are within the expected performance threshold.'));
  } else if (report.ok.length > 0) {
      console.log(chalk.green.bold(`\n✅ ${report.ok.length} steps passed performance checks.`));
  }

  // Add summary of filtering rules
  console.log(chalk.gray('\n📊 Analysis Rules:'));
  console.log(chalk.gray('   • Very fast steps (<50ms): require 15ms+ slowdown'));
  console.log(chalk.gray('   • Fast steps (<100ms): require 10ms+ slowdown and 10%+ change'));
  console.log(chalk.gray('   • All steps: require 3%+ slowdown, filters out noise on stable steps'));
  console.log(chalk.gray('   • Trend detection: monitors 6+ runs for performance drift'));

  console.log(''); // Newline for spacing
}

module.exports = { generateReport }; 