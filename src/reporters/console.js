const chalk = require('chalk');

function generateReport(report) {
  console.log(chalk.bold.underline('\nPerformance Regression Report'));

  if (report.regressions.length > 0) {
    console.log(chalk.red.bold('\n❌ Regressions Found'));
    report.regressions.forEach(r => {
      const slowdown = r.currentDuration - r.average;
      const percentage = ((slowdown / r.average) * 100).toFixed(2);
      console.log(
        `  - ${chalk.cyan(r.stepText)}: ${chalk.yellow(r.currentDuration.toFixed(2) + 'ms')} (was ${r.average.toFixed(2)}ms, a ${percentage}% slowdown)`
      );
    });
  }

  if (report.newSteps.length > 0) {
    console.log(chalk.yellow.bold('\n✨ New Steps'));
    report.newSteps.forEach(n => {
      console.log(`  - ${chalk.cyan(n.stepText)}: ${n.duration.toFixed(2)}ms`);
    });
  }
  
  if (report.regressions.length === 0 && report.newSteps.length === 0) {
      console.log(chalk.green.bold('\n✅ All steps are within the expected performance threshold.'));
  } else if (report.ok.length > 0) {
      console.log(chalk.green.bold(`\n✅ ${report.ok.length} steps passed successfully.`));
  }

  console.log(''); // Newline for spacing
}

module.exports = { generateReport }; 