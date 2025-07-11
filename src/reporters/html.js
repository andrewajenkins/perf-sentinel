const fs = require('fs').promises;
const path = require('path');

/**
 * Generate a comprehensive, self-contained HTML performance report
 * @param {Object} report - The analysis report object
 * @param {Object} options - Optional configuration
 * @returns {Promise<string>} - Generated HTML content
 */
async function generateReport(report, options = {}) {
  const { 
    outputPath,
    title = 'Performance Analysis Report',
    includeCharts = true,
    includeInteractive = true 
  } = options;

  const html = await generateHTMLContent(report, { title, includeCharts, includeInteractive });

  if (outputPath) {
    await fs.writeFile(outputPath, html, 'utf-8');
    console.log(`📊 HTML report generated: ${outputPath}`);
  } else {
    console.log(html);
  }

  return html;
}

/**
 * Generate the complete HTML content
 */
async function generateHTMLContent(report, options) {
  const { title, includeCharts, includeInteractive } = options;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${await getEmbeddedCSS()}
    ${includeCharts ? await getChartJSLibrary() : ''}
</head>
<body>
    <div class="container">
        ${generateHeader(report)}
        ${generateExecutiveSummary(report)}
        ${generateNavigationTabs()}
        ${generateOverviewSection(report)}
        ${generateSuiteAnalysisSection(report)}
        ${generateRegressionsSection(report)}
        ${generateTagAnalysisSection(report)}
        ${generateStepDetailsSection(report)}
        ${generateRecommendationsSection(report)}
        ${generateMetadataSection(report)}
    </div>
    
    ${includeInteractive ? await getEmbeddedJavaScript() : ''}
    ${includeCharts ? generateChartsScript(report) : ''}
</body>
</html>`;
}

/**
 * Generate the page header with branding and metadata
 */
function generateHeader(report) {
  const timestamp = new Date().toISOString();
  const projectId = report.metadata?.projectId || 'Unknown Project';
  
  return `
    <header class="header">
        <div class="header-content">
            <h1>
                <span class="logo">⚡</span>
                Performance Sentinel
            </h1>
            <div class="header-meta">
                <div class="meta-item">
                    <strong>Project:</strong> ${projectId}
                </div>
                <div class="meta-item">
                    <strong>Generated:</strong> ${new Date(timestamp).toLocaleString()}
                </div>
                <div class="meta-item">
                    <strong>Total Steps:</strong> ${report.metadata?.totalSteps || 'N/A'}
                </div>
            </div>
        </div>
    </header>`;
}

/**
 * Generate executive summary with key metrics
 */
function generateExecutiveSummary(report) {
  const regressionCount = report.regressions?.length || 0;
  const newStepCount = report.newSteps?.length || 0;
  const okStepCount = report.ok?.length || 0;
  const suiteCount = Object.keys(report.suites || {}).length;
  const overallHealth = report.metadata?.overallHealth || 'Unknown';
  
  const healthClass = getHealthClass(overallHealth);
  const statusClass = regressionCount > 0 ? 'critical' : newStepCount > 0 ? 'warning' : 'success';
  
  return `
    <section class="executive-summary">
        <div class="summary-grid">
            <div class="summary-card ${statusClass}">
                <div class="card-icon">${getStatusIcon(statusClass)}</div>
                <div class="card-content">
                    <h3>Overall Status</h3>
                    <div class="metric-value">${getStatusText(regressionCount, newStepCount)}</div>
                </div>
            </div>
            
            <div class="summary-card">
                <div class="card-icon">🎯</div>
                <div class="card-content">
                    <h3>System Health</h3>
                    <div class="metric-value ${healthClass}">${overallHealth}%</div>
                </div>
            </div>
            
            <div class="summary-card">
                <div class="card-icon">🔴</div>
                <div class="card-content">
                    <h3>Regressions</h3>
                    <div class="metric-value">${regressionCount}</div>
                </div>
            </div>
            
            <div class="summary-card">
                <div class="card-icon">🆕</div>
                <div class="card-content">
                    <h3>New Steps</h3>
                    <div class="metric-value">${newStepCount}</div>
                </div>
            </div>
            
            <div class="summary-card">
                <div class="card-icon">✅</div>
                <div class="card-content">
                    <h3>Healthy Steps</h3>
                    <div class="metric-value">${okStepCount}</div>
                </div>
            </div>
            
            <div class="summary-card">
                <div class="card-icon">📁</div>
                <div class="card-content">
                    <h3>Test Suites</h3>
                    <div class="metric-value">${suiteCount}</div>
                </div>
            </div>
        </div>
    </section>`;
}

/**
 * Generate navigation tabs for different sections
 */
function generateNavigationTabs() {
  return `
    <nav class="nav-tabs">
        <button class="tab-button active" data-tab="overview">Overview</button>
        <button class="tab-button" data-tab="suites">Test Suites</button>
        <button class="tab-button" data-tab="regressions">Regressions</button>
        <button class="tab-button" data-tab="tags">Tag Analysis</button>
        <button class="tab-button" data-tab="steps">Step Details</button>
        <button class="tab-button" data-tab="recommendations">Recommendations</button>
        <button class="tab-button" data-tab="metadata">Metadata</button>
    </nav>`;
}

/**
 * Generate overview section with charts
 */
function generateOverviewSection(report) {
  return `
    <section class="tab-content active" id="overview">
        <h2>Performance Overview</h2>
        
        <div class="charts-grid">
            <div class="chart-container">
                <h3>Step Status Distribution</h3>
                <canvas id="statusChart" width="400" height="200"></canvas>
            </div>
            
            <div class="chart-container">
                <h3>Suite Performance Health</h3>
                <canvas id="suiteHealthChart" width="400" height="200"></canvas>
            </div>
        </div>
        
        ${generateTrendSection(report)}
    </section>`;
}

/**
 * Generate suite analysis section
 */
function generateSuiteAnalysisSection(report) {
  const suites = Object.values(report.suites || {});
  
  return `
    <section class="tab-content" id="suites">
        <h2>Test Suite Analysis</h2>
        
        <div class="suite-grid">
            ${suites.map(suite => generateSuiteCard(suite)).join('')}
        </div>
    </section>`;
}

/**
 * Generate individual suite card
 */
function generateSuiteCard(suite) {
  const healthClass = getHealthClass(suite.healthScore);
  const categoryClass = getCategoryClass(suite.category);
  
  return `
    <div class="suite-card ${categoryClass}">
        <div class="suite-header">
            <h3>${suite.suite}</h3>
            <div class="suite-health ${healthClass}">${suite.healthScore}%</div>
        </div>
        
        <div class="suite-metrics">
            <div class="metric">
                <span class="metric-label">Category:</span>
                <span class="metric-value ${categoryClass}">${suite.category.toUpperCase()}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Severity:</span>
                <span class="metric-value">${suite.severity}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Total Steps:</span>
                <span class="metric-value">${suite.totalSteps}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Avg Duration:</span>
                <span class="metric-value">${suite.avgDuration?.toFixed(1)}ms</span>
            </div>
        </div>
        
        <div class="suite-breakdown">
            <div class="breakdown-item regression">
                <span class="breakdown-count">${suite.regressions}</span>
                <span class="breakdown-label">Regressions</span>
            </div>
            <div class="breakdown-item new">
                <span class="breakdown-count">${suite.newSteps}</span>
                <span class="breakdown-label">New</span>
            </div>
            <div class="breakdown-item ok">
                <span class="breakdown-count">${suite.okSteps}</span>
                <span class="breakdown-label">OK</span>
            </div>
        </div>
        
        ${suite.recommendations?.length > 0 ? `
            <div class="suite-recommendations">
                <h4>Recommendations:</h4>
                <ul>
                    ${suite.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    </div>`;
}

/**
 * Generate regressions section
 */
function generateRegressionsSection(report) {
  const regressions = report.regressions || [];
  
  if (regressions.length === 0) {
    return `
        <section class="tab-content" id="regressions">
            <h2>Performance Regressions</h2>
            <div class="no-issues">
                <div class="no-issues-icon">✅</div>
                <h3>No Performance Regressions Found</h3>
                <p>All steps are performing within expected thresholds.</p>
            </div>
        </section>`;
  }
  
  return `
    <section class="tab-content" id="regressions">
        <h2>Performance Regressions (${regressions.length})</h2>
        
        <div class="filter-controls">
            <input type="text" id="regressionFilter" placeholder="Filter regressions..." class="filter-input">
            <select id="regressionSort" class="filter-select">
                <option value="slowdown">Sort by Slowdown</option>
                <option value="percentage">Sort by Percentage</option>
                <option value="duration">Sort by Duration</option>
                <option value="suite">Sort by Suite</option>
            </select>
        </div>
        
        <div class="regression-list" id="regressionList">
            ${regressions.map(regression => generateRegressionItem(regression)).join('')}
        </div>
    </section>`;
}

/**
 * Generate individual regression item
 */
function generateRegressionItem(regression) {
  const severityClass = getSeverityClass(regression.percentage);
  const suite = regression.context?.suite || 'Unknown Suite';
  const testFile = regression.context?.testFile || 'Unknown File';
  const tags = regression.context?.tags || [];
  
  return `
    <div class="regression-item ${severityClass}" data-suite="${suite}" data-tags="${tags.join(',')}" data-slowdown="${regression.slowdown}" data-percentage="${regression.percentage}">
        <div class="regression-header">
            <h4 class="step-text">${regression.stepText}</h4>
            <div class="regression-impact">
                <span class="slowdown">+${regression.slowdown?.toFixed(1)}ms</span>
                <span class="percentage">+${regression.percentage?.toFixed(1)}%</span>
            </div>
        </div>
        
        <div class="regression-details">
            <div class="timing-info">
                <div class="timing-item">
                    <span class="timing-label">Current:</span>
                    <span class="timing-value">${regression.currentDuration?.toFixed(1)}ms</span>
                </div>
                <div class="timing-item">
                    <span class="timing-label">Baseline:</span>
                    <span class="timing-value">${regression.average?.toFixed(1)}ms</span>
                </div>
            </div>
            
            <div class="context-info">
                <div class="context-item">
                    <span class="context-label">Suite:</span>
                    <span class="context-value">${suite}</span>
                </div>
                <div class="context-item">
                    <span class="context-label">File:</span>
                    <span class="context-value">${testFile}</span>
                </div>
                ${tags.length > 0 ? `
                    <div class="context-item">
                        <span class="context-label">Tags:</span>
                        <span class="context-value">${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    </div>`;
}

/**
 * Generate tag analysis section
 */
function generateTagAnalysisSection(report) {
  const tagAnalysis = report.tagAnalysis || {};
  const tags = Object.keys(tagAnalysis);
  
  if (tags.length === 0) {
    return `
        <section class="tab-content" id="tags">
            <h2>Tag Analysis</h2>
            <div class="no-data">
                <p>No tag analysis data available.</p>
            </div>
        </section>`;
  }
  
  return `
    <section class="tab-content" id="tags">
        <h2>Tag Analysis</h2>
        
        <div class="tag-grid">
            ${tags.map(tag => generateTagCard(tag, tagAnalysis[tag])).join('')}
        </div>
    </section>`;
}

/**
 * Generate individual tag card
 */
function generateTagCard(tag, analysis) {
  return `
    <div class="tag-card">
        <div class="tag-header">
            <h3 class="tag-name">${tag}</h3>
            <div class="tag-count">${analysis.stepCount} steps</div>
        </div>
        
        <div class="tag-metrics">
            <div class="metric">
                <span class="metric-label">Suites:</span>
                <span class="metric-value">${analysis.suites?.length || 0}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Avg Duration:</span>
                <span class="metric-value">${analysis.avgDuration?.toFixed(1)}ms</span>
            </div>
            <div class="metric">
                <span class="metric-label">Issues:</span>
                <span class="metric-value">${analysis.issues || 0}</span>
            </div>
        </div>
        
        ${analysis.suites?.length > 0 ? `
            <div class="tag-suites">
                <span class="suites-label">Suites:</span>
                ${analysis.suites.map(suite => `<span class="suite-tag">${suite}</span>`).join('')}
            </div>
        ` : ''}
    </div>`;
}

/**
 * Generate step details section
 */
function generateStepDetailsSection(report) {
  const allSteps = [
    ...((report.regressions || []).map(s => ({ ...s, status: 'regression' }))),
    ...((report.newSteps || []).map(s => ({ ...s, status: 'new' }))),
    ...((report.ok || []).map(s => ({ ...s, status: 'ok' })))
  ];
  
  // Performance optimization: Only render first 100 steps initially
  const isLargeDataset = allSteps.length > 500;
  const initialPageSize = isLargeDataset ? 100 : allSteps.length;
  const initialSteps = allSteps.slice(0, initialPageSize);
  
  return `
    <section class="tab-content" id="steps">
        <h2>Step Details (${allSteps.length} total)</h2>
        
        ${isLargeDataset ? `
            <div class="performance-warning">
                <span class="warning-icon">⚠️</span>
                <strong>Large dataset detected (${allSteps.length} steps)</strong> - 
                Using paginated view for better performance. Use filters to narrow down results.
            </div>
        ` : ''}
        
        <div class="filter-controls">
            <input type="text" id="stepFilter" placeholder="Filter steps..." class="filter-input">
            <select id="stepStatusFilter" class="filter-select">
                <option value="all">All Steps</option>
                <option value="regression">Regressions Only</option>
                <option value="new">New Steps Only</option>
                <option value="ok">Healthy Steps Only</option>
            </select>
            <select id="stepSuiteFilter" class="filter-select">
                <option value="all">All Suites</option>
                ${Object.keys(report.suites || {}).map(suite => 
                  `<option value="${suite}">${suite}</option>`
                ).join('')}
            </select>
            <select id="pageSizeSelect" class="filter-select">
                <option value="50">50 per page</option>
                <option value="100" ${isLargeDataset ? 'selected' : ''}>100 per page</option>
                <option value="200">200 per page</option>
                <option value="500">500 per page</option>
            </select>
        </div>
        
        <div class="step-table-container">
            <table class="step-table" id="stepTable">
                <thead>
                    <tr>
                        <th class="sortable" data-sort="stepText">Step</th>
                        <th class="sortable" data-sort="status">Status</th>
                        <th class="sortable" data-sort="duration">Duration</th>
                        <th class="sortable" data-sort="suite">Suite</th>
                        <th class="sortable" data-sort="tags">Tags</th>
                        <th>Impact</th>
                    </tr>
                </thead>
                <tbody id="stepTableBody">
                    ${initialSteps.map(step => generateStepRow(step)).join('')}
                </tbody>
            </table>
        </div>
        
        ${isLargeDataset ? `
            <div class="pagination-controls">
                <div class="pagination-info">
                    Showing <span id="currentStart">1</span> to <span id="currentEnd">${Math.min(initialPageSize, allSteps.length)}</span> 
                    of <span id="totalSteps">${allSteps.length}</span> steps
                </div>
                <div class="pagination-buttons">
                    <button id="prevPage" class="btn btn-secondary" disabled>Previous</button>
                    <span id="pageInfo">Page 1 of ${Math.ceil(allSteps.length / initialPageSize)}</span>
                    <button id="nextPage" class="btn btn-secondary" ${allSteps.length <= initialPageSize ? 'disabled' : ''}>Next</button>
                </div>
            </div>
        ` : ''}
        
        <div class="table-actions">
            <button id="exportSteps" class="btn btn-secondary">Export Filtered Data (CSV)</button>
            ${isLargeDataset ? `<button id="loadAllSteps" class="btn btn-outline">Load All Steps (Warning: May slow browser)</button>` : ''}
        </div>
    </section>
    
    <script type="application/json" id="allStepsData">
        ${JSON.stringify(allSteps)}
    </script>`;
}

/**
 * Generate individual step row
 */
function generateStepRow(step) {
  const statusClass = step.status;
  const suite = step.context?.suite || 'Unknown';
  const tags = step.context?.tags || [];
  const duration = step.duration || step.currentDuration || 0;
  
  return `
    <tr class="step-row ${statusClass}" data-status="${step.status}" data-suite="${suite}" data-tags="${tags.join(',')}">
        <td class="step-text">${step.stepText}</td>
        <td><span class="status-badge ${statusClass}">${step.status.toUpperCase()}</span></td>
        <td class="duration">${duration.toFixed(1)}ms</td>
        <td class="suite">${suite}</td>
        <td class="tags">${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</td>
        <td class="impact">
            ${step.status === 'regression' ? 
              `<span class="regression-impact">+${step.slowdown?.toFixed(1)}ms (+${step.percentage?.toFixed(1)}%)</span>` :
              step.status === 'new' ? '<span class="new-impact">New</span>' : 
              '<span class="ok-impact">✓</span>'
            }
        </td>
    </tr>`;
}

/**
 * Generate recommendations section
 */
function generateRecommendationsSection(report) {
  const recommendations = report.recommendations || [];
  
  return `
    <section class="tab-content" id="recommendations">
        <h2>Performance Recommendations</h2>
        
        ${recommendations.length > 0 ? `
            <div class="recommendations-list">
                ${recommendations.map(rec => `
                    <div class="recommendation-item">
                        <div class="recommendation-icon">💡</div>
                        <div class="recommendation-text">${rec}</div>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="no-data">
                <p>No specific recommendations available. System appears to be performing well.</p>
            </div>
        `}
        
        <div class="general-recommendations">
            <h3>General Performance Best Practices</h3>
            <ul>
                <li>Monitor critical path steps (tagged with @critical) closely</li>
                <li>Set up alerts for regressions > 20% in critical functionality</li>
                <li>Review and optimize steps consistently taking > 1000ms</li>
                <li>Implement performance budgets for new features</li>
                <li>Regular performance testing in CI/CD pipeline</li>
            </ul>
        </div>
    </section>`;
}

/**
 * Generate metadata section
 */
function generateMetadataSection(report) {
  const metadata = report.metadata || {};
  
  return `
    <section class="tab-content" id="metadata">
        <h2>Analysis Metadata</h2>
        
        <div class="metadata-grid">
            <div class="metadata-card">
                <h3>Test Execution</h3>
                <div class="metadata-list">
                    <div class="metadata-item">
                        <span class="metadata-label">Total Steps:</span>
                        <span class="metadata-value">${metadata.totalSteps || 'N/A'}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Unique Steps:</span>
                        <span class="metadata-value">${metadata.uniqueSteps || 'N/A'}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Test Suites:</span>
                        <span class="metadata-value">${metadata.suites?.length || 0}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Job IDs:</span>
                        <span class="metadata-value">${metadata.jobs?.length || 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="metadata-card">
                <h3>Analysis Configuration</h3>
                <div class="metadata-list">
                    <div class="metadata-item">
                        <span class="metadata-label">Analysis Rules:</span>
                        <span class="metadata-value">Context-aware thresholds</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Suite Detection:</span>
                        <span class="metadata-value">Enabled</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Tag Analysis:</span>
                        <span class="metadata-value">Enabled</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Trend Analysis:</span>
                        <span class="metadata-value">Enabled</span>
                    </div>
                </div>
            </div>
            
            ${generatePRIntelligenceCard(report)}
        </div>
    </section>`;
}

/**
 * Generate PR Intelligence card for metadata section
 */
function generatePRIntelligenceCard(report) {
  const metadata = report.metadata || {};
  const prContext = metadata.prContext;
  const prIntelligence = report.prIntelligence;
  
  if (!prContext && !prIntelligence) {
    return '';
  }
  
  let prItems = '';
  
  if (prContext?.primaryPrNumber) {
    prItems += `
      <div class="metadata-item">
        <span class="metadata-label">PR Number:</span>
        <span class="metadata-value">${prContext.primaryPrNumber}</span>
      </div>
    `;
  }
  
  if (prContext?.primaryCommitSha) {
    prItems += `
      <div class="metadata-item">
        <span class="metadata-label">Commit SHA:</span>
        <span class="metadata-value">${prContext.primaryCommitSha.substring(0, 8)}...</span>
      </div>
    `;
  }
  
  if (prContext?.primaryBranch) {
    prItems += `
      <div class="metadata-item">
        <span class="metadata-label">Branch:</span>
        <span class="metadata-value">${prContext.primaryBranch}</span>
      </div>
    `;
  }
  
  if (prIntelligence?.confidence) {
    prItems += `
      <div class="metadata-item">
        <span class="metadata-label">Analysis Confidence:</span>
        <span class="metadata-value">${(prIntelligence.confidence * 100).toFixed(1)}%</span>
      </div>
    `;
  }
  
  if (prIntelligence?.summary?.overallHealthTrend) {
    prItems += `
      <div class="metadata-item">
        <span class="metadata-label">Health Trend:</span>
        <span class="metadata-value">${prIntelligence.summary.overallHealthTrend}</span>
      </div>
    `;
  }
  
  if (prIntelligence?.summary?.totalCommits) {
    prItems += `
      <div class="metadata-item">
        <span class="metadata-label">Total Commits:</span>
        <span class="metadata-value">${prIntelligence.summary.totalCommits}</span>
      </div>
    `;
  }
  
  if (prItems) {
    return `
      <div class="metadata-card pr-intelligence">
        <h3>🔍 PR Intelligence</h3>
        <div class="metadata-list">
          ${prItems}
        </div>
      </div>
    `;
  }
  
  return '';
}

/**
 * Generate trend section for overview
 */
function generateTrendSection(report) {
  const trends = report.trends || [];
  
  if (trends.length === 0) {
    return `
        <div class="trend-section">
            <h3>Performance Trends</h3>
            <div class="no-trends">
                <p>No significant performance trends detected.</p>
            </div>
        </div>`;
  }
  
  return `
    <div class="trend-section">
        <h3>Performance Trends (${trends.length})</h3>
        <div class="trend-list">
            ${trends.map(trend => `
                <div class="trend-item">
                    <div class="trend-step">${trend.stepText}</div>
                    <div class="trend-change">+${trend.trend?.toFixed(1)}ms drift</div>
                    <div class="trend-suite">${trend.context?.suite || 'Unknown Suite'}</div>
                </div>
            `).join('')}
        </div>
    </div>`;
}

// Helper functions for styling and classification
function getHealthClass(health) {
  if (health >= 90) return 'excellent';
  if (health >= 75) return 'good';
  if (health >= 60) return 'fair';
  return 'poor';
}

function getCategoryClass(category) {
  const categoryMap = {
    'excellent': 'excellent',
    'good': 'good', 
    'fair': 'fair',
    'poor': 'poor',
    'critical': 'critical'
  };
  return categoryMap[category?.toLowerCase()] || 'unknown';
}

function getSeverityClass(percentage) {
  if (percentage >= 50) return 'critical';
  if (percentage >= 25) return 'high';
  if (percentage >= 10) return 'medium';
  return 'low';
}

function getStatusIcon(status) {
  const icons = {
    'success': '✅',
    'warning': '⚠️',
    'critical': '🔴'
  };
  return icons[status] || '❓';
}

function getStatusText(regressionCount, newStepCount) {
  if (regressionCount > 0) return `${regressionCount} Regressions Found`;
  if (newStepCount > 0) return `${newStepCount} New Steps`;
  return 'All Steps Healthy';
}

/**
 * Get embedded CSS styles for self-contained HTML
 */
async function getEmbeddedCSS() {
  return `
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* Header Styles */
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .logo {
            font-size: 3rem;
        }
        
        .header-meta {
            display: flex;
            gap: 2rem;
            flex-wrap: wrap;
        }
        
        .meta-item {
            text-align: right;
        }
        
        /* Executive Summary */
        .executive-summary {
            margin-bottom: 2rem;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .summary-card {
            background: white;
            padding: 1.5rem;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 1rem;
            transition: transform 0.2s;
        }
        
        .summary-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        .summary-card.critical {
            border-left: 4px solid #e74c3c;
        }
        
        .summary-card.warning {
            border-left: 4px solid #f39c12;
        }
        
        .summary-card.success {
            border-left: 4px solid #27ae60;
        }
        
        .card-icon {
            font-size: 2rem;
        }
        
        .card-content h3 {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 0.5rem;
        }
        
        .metric-value {
            font-size: 1.8rem;
            font-weight: 700;
        }
        
        .metric-value.excellent { color: #27ae60; }
        .metric-value.good { color: #2ecc71; }
        .metric-value.fair { color: #f39c12; }
        .metric-value.poor { color: #e74c3c; }
        
        /* Navigation Tabs */
        .nav-tabs {
            display: flex;
            background: white;
            border-radius: 10px;
            padding: 0.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            overflow-x: auto;
        }
        
        .tab-button {
            background: none;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
            white-space: nowrap;
        }
        
        .tab-button:hover {
            background: #f8f9fa;
        }
        
        .tab-button.active {
            background: #667eea;
            color: white;
        }
        
        /* Tab Content */
        .tab-content {
            display: none;
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .tab-content h2 {
            font-size: 1.8rem;
            margin-bottom: 1.5rem;
            color: #2c3e50;
        }
        
        /* Charts */
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }
        
        .chart-container {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
        }
        
        .chart-container h3 {
            margin-bottom: 1rem;
            color: #495057;
        }
        
        /* Suite Grid */
        .suite-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 1.5rem;
        }
        
        .suite-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 1.5rem;
            transition: all 0.2s;
        }
        
        .suite-card:hover {
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .suite-card.excellent { border-left: 4px solid #27ae60; }
        .suite-card.good { border-left: 4px solid #2ecc71; }
        .suite-card.fair { border-left: 4px solid #f39c12; }
        .suite-card.poor { border-left: 4px solid #e74c3c; }
        .suite-card.critical { border-left: 4px solid #c0392b; }
        
        .suite-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .suite-header h3 {
            font-size: 1.2rem;
            color: #2c3e50;
        }
        
        .suite-health {
            font-weight: 700;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.9rem;
        }
        
        .suite-health.excellent { background: #d4edda; color: #155724; }
        .suite-health.good { background: #d1ecf1; color: #0c5460; }
        .suite-health.fair { background: #fff3cd; color: #856404; }
        .suite-health.poor { background: #f8d7da; color: #721c24; }
        
        .suite-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 0.25rem 0;
        }
        
        .metric-label {
            color: #666;
            font-size: 0.9rem;
        }
        
        .metric-value {
            font-weight: 600;
        }
        
        .suite-breakdown {
            display: flex;
            justify-content: space-around;
            padding: 1rem 0;
            border-top: 1px solid #e9ecef;
            margin-top: 1rem;
        }
        
        .breakdown-item {
            text-align: center;
        }
        
        .breakdown-count {
            display: block;
            font-size: 1.5rem;
            font-weight: 700;
        }
        
        .breakdown-item.regression .breakdown-count { color: #e74c3c; }
        .breakdown-item.new .breakdown-count { color: #f39c12; }
        .breakdown-item.ok .breakdown-count { color: #27ae60; }
        
        .breakdown-label {
            font-size: 0.8rem;
            color: #666;
        }
        
        /* Filter Controls */
        .filter-controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
        }
        
        .filter-input, .filter-select {
            padding: 0.5rem 1rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 0.9rem;
        }
        
        .filter-input {
            flex: 1;
            min-width: 200px;
        }
        
        /* Regression List */
        .regression-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .regression-item {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 1.5rem;
            transition: all 0.2s;
        }
        
        .regression-item:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .regression-item.critical { border-left: 4px solid #c0392b; }
        .regression-item.high { border-left: 4px solid #e74c3c; }
        .regression-item.medium { border-left: 4px solid #f39c12; }
        .regression-item.low { border-left: 4px solid #f1c40f; }
        
        .regression-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }
        
        .step-text {
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .regression-impact {
            display: flex;
            gap: 0.5rem;
        }
        
        .slowdown, .percentage {
            background: #f8d7da;
            color: #721c24;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .regression-details {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 1rem;
        }
        
        .timing-info, .context-info {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
        }
        
        .timing-item, .context-item {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        
        .timing-label, .context-label {
            font-size: 0.8rem;
            color: #666;
            font-weight: 500;
        }
        
        .timing-value, .context-value {
            font-weight: 600;
        }
        
        /* Tags */
        .tag {
            background: #e9ecef;
            color: #495057;
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
            margin-right: 0.25rem;
        }
        
        .suite-tag {
            background: #d4edda;
            color: #155724;
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
            margin-right: 0.25rem;
        }
        
        /* Tag Grid */
        .tag-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        
        .tag-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 1.5rem;
        }
        
        .tag-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .tag-name {
            color: #2c3e50;
            font-weight: 600;
        }
        
        .tag-count {
            background: #f8f9fa;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.9rem;
            color: #495057;
        }
        
        /* Step Table */
        .step-table-container {
            overflow-x: auto;
        }
        
        .step-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        
        .step-table th,
        .step-table td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }
        
        .step-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
            cursor: pointer;
            position: relative;
        }
        
        .step-table th.sortable:hover {
            background: #e9ecef;
        }
        
        .step-table th.sortable::after {
            content: '↕️';
            position: absolute;
            right: 0.5rem;
            opacity: 0.5;
        }
        
        .step-row:hover {
            background: #f8f9fa;
        }
        
        /* Performance Warning */
        .performance-warning {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            border-radius: 4px;
            padding: 1rem;
            margin-bottom: 1rem;
            color: #856404;
        }
        
        .warning-icon {
            margin-right: 0.5rem;
        }
        
        /* Pagination Controls */
        .pagination-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 1rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 4px;
        }
        
        .pagination-info {
            color: #666;
            font-size: 0.9rem;
        }
        
        .pagination-buttons {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        
        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover:not(:disabled) {
            background: #5a6268;
        }
        
        .btn-outline {
            background: white;
            color: #6c757d;
            border: 1px solid #6c757d;
        }
        
        .btn-outline:hover:not(:disabled) {
            background: #6c757d;
            color: white;
        }
        
        /* Table Actions */
        .table-actions {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
        }
        
        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-badge.regression {
            background: #f8d7da;
            color: #721c24;
        }
        
        .status-badge.new {
            background: #fff3cd;
            color: #856404;
        }
        
        .status-badge.ok {
            background: #d4edda;
            color: #155724;
        }
        
        .regression-impact {
            color: #e74c3c;
            font-weight: 600;
        }
        
        .new-impact {
            color: #f39c12;
            font-weight: 600;
        }
        
        .ok-impact {
            color: #27ae60;
            font-weight: 600;
        }
        
        /* No Data States */
        .no-issues, .no-data, .no-trends {
            text-align: center;
            padding: 3rem;
            color: #666;
        }
        
        .no-issues-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        
        .no-issues h3 {
            color: #27ae60;
            margin-bottom: 0.5rem;
        }
        
        /* Recommendations */
        .recommendations-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .recommendation-item {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #17a2b8;
        }
        
        .recommendation-icon {
            font-size: 1.5rem;
        }
        
        .recommendation-text {
            font-weight: 500;
        }
        
        .general-recommendations {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #6c757d;
        }
        
        .general-recommendations h3 {
            margin-bottom: 1rem;
            color: #495057;
        }
        
        .general-recommendations ul {
            padding-left: 1.5rem;
        }
        
        .general-recommendations li {
            margin-bottom: 0.5rem;
            color: #495057;
        }
        
        /* Metadata */
        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        
        .metadata-card {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #6c757d;
        }
        
        .metadata-card h3 {
            margin-bottom: 1rem;
            color: #495057;
        }
        
        .metadata-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .metadata-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #dee2e6;
        }
        
        .metadata-label {
            color: #666;
            font-weight: 500;
        }
        
        .metadata-value {
            font-weight: 600;
            color: #495057;
        }
        
        /* Trend Section */
        .trend-section {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #f39c12;
            margin-top: 2rem;
        }
        
        .trend-section h3 {
            margin-bottom: 1rem;
            color: #495057;
        }
        
        .trend-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .trend-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            padding: 0.75rem;
            border-radius: 4px;
        }
        
        .trend-step {
            font-weight: 500;
            color: #2c3e50;
        }
        
        .trend-change {
            color: #f39c12;
            font-weight: 600;
        }
        
        .trend-suite {
            color: #666;
            font-size: 0.9rem;
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header-content {
                flex-direction: column;
                text-align: center;
                gap: 1rem;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .summary-grid {
                grid-template-columns: 1fr;
            }
            
            .charts-grid {
                grid-template-columns: 1fr;
            }
            
            .filter-controls {
                flex-direction: column;
            }
            
            .regression-header {
                flex-direction: column;
                gap: 1rem;
            }
            
            .regression-details {
                grid-template-columns: 1fr;
            }
            
            .timing-info, .context-info {
                flex-direction: column;
            }
        }
        
        /* Print Styles */
        @media print {
            body {
                background: white;
            }
            
            .nav-tabs {
                display: none;
            }
            
            .tab-content {
                display: block !important;
                page-break-inside: avoid;
                margin-bottom: 2rem;
            }
            
            .summary-card,
            .suite-card,
            .regression-item {
                break-inside: avoid;
            }
        }
    </style>`;
}

/**
 * Get Chart.js library for embedded charts
 */
async function getChartJSLibrary() {
  return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>`;
}

/**
 * Get embedded JavaScript for interactivity
 */
async function getEmbeddedJavaScript() {
  return `
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            initializeTabs();
            initializeFilters();
            initializeSorting();
            initializeStepData();
            initializePagination();
            initializeExport();
        });
        
        // Tab Navigation
        function initializeTabs() {
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const targetTab = button.getAttribute('data-tab');
                    
                    // Remove active class from all tabs and buttons
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));
                    
                    // Add active class to clicked button and corresponding content
                    button.classList.add('active');
                    document.getElementById(targetTab).classList.add('active');
                });
            });
        }
        
        // Filter Functionality
        function initializeFilters() {
            // Regression filters
            const regressionFilter = document.getElementById('regressionFilter');
            const regressionSort = document.getElementById('regressionSort');
            
            if (regressionFilter) {
                regressionFilter.addEventListener('input', filterRegressions);
            }
            
            if (regressionSort) {
                regressionSort.addEventListener('change', sortRegressions);
            }
            
            // Step filters
            const stepFilter = document.getElementById('stepFilter');
            const stepStatusFilter = document.getElementById('stepStatusFilter');
            const stepSuiteFilter = document.getElementById('stepSuiteFilter');
            
            if (stepFilter) {
                stepFilter.addEventListener('input', filterSteps);
            }
            
            if (stepStatusFilter) {
                stepStatusFilter.addEventListener('change', filterSteps);
            }
            
            if (stepSuiteFilter) {
                stepSuiteFilter.addEventListener('change', filterSteps);
            }
        }
        
        // Sorting Functionality
        function initializeSorting() {
            const sortableHeaders = document.querySelectorAll('.sortable');
            
            sortableHeaders.forEach(header => {
                header.addEventListener('click', () => {
                    const sortKey = header.getAttribute('data-sort');
                    sortTable(sortKey);
                });
            });
        }
        
        // Filter Regressions
        function filterRegressions() {
            const filterValue = document.getElementById('regressionFilter').value.toLowerCase();
            const regressionItems = document.querySelectorAll('.regression-item');
            
            regressionItems.forEach(item => {
                const stepText = item.querySelector('.step-text').textContent.toLowerCase();
                const suite = item.getAttribute('data-suite').toLowerCase();
                const tags = item.getAttribute('data-tags').toLowerCase();
                
                const matches = stepText.includes(filterValue) || 
                               suite.includes(filterValue) || 
                               tags.includes(filterValue);
                
                item.style.display = matches ? 'block' : 'none';
            });
        }
        
        // Sort Regressions
        function sortRegressions() {
            const sortValue = document.getElementById('regressionSort').value;
            const regressionList = document.getElementById('regressionList');
            const items = Array.from(regressionList.querySelectorAll('.regression-item'));
            
            items.sort((a, b) => {
                let aValue, bValue;
                
                switch (sortValue) {
                    case 'slowdown':
                        aValue = parseFloat(a.getAttribute('data-slowdown'));
                        bValue = parseFloat(b.getAttribute('data-slowdown'));
                        return bValue - aValue; // Descending
                    
                    case 'percentage':
                        aValue = parseFloat(a.getAttribute('data-percentage'));
                        bValue = parseFloat(b.getAttribute('data-percentage'));
                        return bValue - aValue; // Descending
                    
                    case 'suite':
                        aValue = a.getAttribute('data-suite');
                        bValue = b.getAttribute('data-suite');
                        return aValue.localeCompare(bValue);
                    
                    default: // duration
                        aValue = parseFloat(a.querySelector('.timing-value').textContent);
                        bValue = parseFloat(b.querySelector('.timing-value').textContent);
                        return bValue - aValue; // Descending
                }
            });
            
            // Re-append sorted items
            items.forEach(item => regressionList.appendChild(item));
        }
        
        // Global variables for pagination
        let currentPage = 1;
        let pageSize = 100;
        let allStepsData = [];
        let filteredSteps = [];
        
        // Initialize step data
        function initializeStepData() {
            const dataScript = document.getElementById('allStepsData');
            if (dataScript) {
                try {
                    allStepsData = JSON.parse(dataScript.textContent);
                    filteredSteps = [...allStepsData];
                } catch (e) {
                    console.error('Error parsing step data:', e);
                    allStepsData = [];
                    filteredSteps = [];
                }
            }
        }
        
        // Filter Steps with pagination support
        function filterSteps() {
            const filterValue = document.getElementById('stepFilter').value.toLowerCase();
            const statusFilter = document.getElementById('stepStatusFilter').value;
            const suiteFilter = document.getElementById('stepSuiteFilter').value;
            
            // Filter the data
            filteredSteps = allStepsData.filter(step => {
                const textMatches = step.stepText.toLowerCase().includes(filterValue) ||
                                  (step.context?.tags || []).some(tag => tag.toLowerCase().includes(filterValue));
                const statusMatches = statusFilter === 'all' || step.status === statusFilter;
                const suiteMatches = suiteFilter === 'all' || step.context?.suite === suiteFilter;
                
                return textMatches && statusMatches && suiteMatches;
            });
            
            // Reset to first page
            currentPage = 1;
            
            // Re-render the table
            renderStepsTable();
            updatePaginationControls();
        }
        
        // Render steps table with current page
        function renderStepsTable() {
            const tbody = document.getElementById('stepTableBody');
            if (!tbody) return;
            
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const pageSteps = filteredSteps.slice(startIndex, endIndex);
            
            tbody.innerHTML = pageSteps.map(step => generateStepRowHTML(step)).join('');
        }
        
        // Generate HTML for a single step row
        function generateStepRowHTML(step) {
            const statusClass = step.status;
            const suite = step.context?.suite || 'Unknown';
            const tags = step.context?.tags || [];
            const duration = step.duration || step.currentDuration || 0;
            
            return \`<tr class="step-row \${statusClass}" data-status="\${step.status}" data-suite="\${suite}" data-tags="\${tags.join(',')}">
                <td class="step-text">\${step.stepText}</td>
                <td><span class="status-badge \${statusClass}">\${step.status.toUpperCase()}</span></td>
                <td class="duration">\${duration.toFixed(1)}ms</td>
                <td class="suite">\${suite}</td>
                <td class="tags">\${tags.map(tag => '<span class="tag">' + tag + '</span>').join('')}</td>
                <td class="impact">
                    \${step.status === 'regression' ? 
                      '<span class="regression-impact">+' + (step.slowdown ? step.slowdown.toFixed(1) : '0') + 'ms (+' + (step.percentage ? step.percentage.toFixed(1) : '0') + '%)</span>' :
                      step.status === 'new' ? '<span class="new-impact">New</span>' : 
                      '<span class="ok-impact">✓</span>'
                    }
                </td>
            </tr>\`;
        }
        
        // Update pagination controls
        function updatePaginationControls() {
            const totalPages = Math.ceil(filteredSteps.length / pageSize);
            const startIndex = (currentPage - 1) * pageSize + 1;
            const endIndex = Math.min(currentPage * pageSize, filteredSteps.length);
            
            const currentStart = document.getElementById('currentStart');
            const currentEnd = document.getElementById('currentEnd');
            const totalSteps = document.getElementById('totalSteps');
            const pageInfo = document.getElementById('pageInfo');
            const prevPage = document.getElementById('prevPage');
            const nextPage = document.getElementById('nextPage');
            
            if (currentStart) currentStart.textContent = startIndex;
            if (currentEnd) currentEnd.textContent = endIndex;
            if (totalSteps) totalSteps.textContent = filteredSteps.length;
            if (pageInfo) pageInfo.textContent = \`Page \${currentPage} of \${totalPages}\`;
            
            if (prevPage) {
                prevPage.disabled = currentPage === 1;
            }
            if (nextPage) {
                nextPage.disabled = currentPage === totalPages;
            }
        }
        
        // Initialize pagination controls
        function initializePagination() {
            const prevPage = document.getElementById('prevPage');
            const nextPage = document.getElementById('nextPage');
            const pageSizeSelect = document.getElementById('pageSizeSelect');
            
            if (prevPage) {
                prevPage.addEventListener('click', () => {
                    if (currentPage > 1) {
                        currentPage--;
                        renderStepsTable();
                        updatePaginationControls();
                    }
                });
            }
            
            if (nextPage) {
                nextPage.addEventListener('click', () => {
                    const totalPages = Math.ceil(filteredSteps.length / pageSize);
                    if (currentPage < totalPages) {
                        currentPage++;
                        renderStepsTable();
                        updatePaginationControls();
                    }
                });
            }
            
            if (pageSizeSelect) {
                pageSizeSelect.addEventListener('change', (e) => {
                    pageSize = parseInt(e.target.value);
                    currentPage = 1;
                    renderStepsTable();
                    updatePaginationControls();
                });
            }
        }
        
        // Sort Table
        function sortTable(sortKey) {
            const table = document.getElementById('stepTable');
            const tbody = document.getElementById('stepTableBody');
            const rows = Array.from(tbody.querySelectorAll('.step-row'));
            
            rows.sort((a, b) => {
                let aValue, bValue;
                
                switch (sortKey) {
                    case 'stepText':
                        aValue = a.querySelector('.step-text').textContent;
                        bValue = b.querySelector('.step-text').textContent;
                        return aValue.localeCompare(bValue);
                    
                    case 'status':
                        aValue = a.getAttribute('data-status');
                        bValue = b.getAttribute('data-status');
                        return aValue.localeCompare(bValue);
                    
                    case 'duration':
                        aValue = parseFloat(a.querySelector('.duration').textContent);
                        bValue = parseFloat(b.querySelector('.duration').textContent);
                        return bValue - aValue; // Descending
                    
                    case 'suite':
                        aValue = a.querySelector('.suite').textContent;
                        bValue = b.querySelector('.suite').textContent;
                        return aValue.localeCompare(bValue);
                    
                    default:
                        return 0;
                }
            });
            
            // Re-append sorted rows
            rows.forEach(row => tbody.appendChild(row));
        }
        
        // Utility Functions
        function exportToCSV() {
            const rows = document.querySelectorAll('.step-row:not([style*="display: none"])');
            const csvData = [];
            
            // Header
            csvData.push(['Step', 'Status', 'Duration (ms)', 'Suite', 'Tags', 'Impact']);
            
            // Data rows
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const rowData = Array.from(cells).map(cell => {
                    return cell.textContent.trim().replace(/,/g, ';');
                });
                csvData.push(rowData);
            });
            
            // Create and download CSV
            const csvContent = csvData.map(row => row.join(',')).join('\\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'performance-report.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        }
        
        // Add export button if not exists
        function addExportButton() {
            const stepsSection = document.getElementById('steps');
            if (stepsSection && !document.getElementById('exportButton')) {
                const exportButton = document.createElement('button');
                exportButton.id = 'exportButton';
                exportButton.textContent = 'Export to CSV';
                exportButton.style.cssText = 'background: #667eea; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; margin-left: 1rem;';
                exportButton.addEventListener('click', exportToCSV);
                
                const filterControls = stepsSection.querySelector('.filter-controls');
                if (filterControls) {
                    filterControls.appendChild(exportButton);
                }
            }
        }
        
        // Initialize export functionality
        function initializeExport() {
            const exportButton = document.getElementById('exportSteps');
            const loadAllButton = document.getElementById('loadAllSteps');
            
            if (exportButton) {
                exportButton.addEventListener('click', exportFilteredSteps);
            }
            
            if (loadAllButton) {
                loadAllButton.addEventListener('click', loadAllSteps);
            }
        }
        
        // Export filtered steps to CSV
        function exportFilteredSteps() {
            const csvData = [];
            
            // Header
            csvData.push(['Step', 'Status', 'Duration (ms)', 'Suite', 'Tags', 'Impact']);
            
            // Data rows
            filteredSteps.forEach(step => {
                const suite = (step.context && step.context.suite) || 'Unknown';
                const tags = (step.context && step.context.tags || []).join(';');
                const duration = step.duration || step.currentDuration || 0;
                let impact = '';
                
                if (step.status === 'regression') {
                    impact = '+' + (step.slowdown ? step.slowdown.toFixed(1) : '0') + 'ms (+' + (step.percentage ? step.percentage.toFixed(1) : '0') + '%)';
                } else if (step.status === 'new') {
                    impact = 'New';
                } else {
                    impact = 'OK';
                }
                
                csvData.push([
                    step.stepText,
                    step.status.toUpperCase(),
                    duration.toFixed(1),
                    suite,
                    tags,
                    impact
                ]);
            });
            
            // Create and download CSV
            const csvContent = csvData.map(row => 
                row.map(cell => '"' + cell.toString().replace(/"/g, '""') + '"').join(',')
            ).join('\\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `performance-steps-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }
        
        // Load all steps (warning: may slow browser)
        function loadAllSteps() {
            if (confirm('This will load all steps at once and may slow down your browser. Are you sure?')) {
                pageSize = allStepsData.length;
                currentPage = 1;
                renderStepsTable();
                updatePaginationControls();
                
                // Hide the load all button
                const loadAllButton = document.getElementById('loadAllSteps');
                if (loadAllButton) {
                    loadAllButton.style.display = 'none';
                }
            }
        }
    </script>`;
}

/**
 * Generate Chart.js scripts for data visualization
 */
function generateChartsScript(report) {
  const regressionCount = (report.regressions && report.regressions.length) || 0;
  const newStepCount = (report.newSteps && report.newSteps.length) || 0;
  const okStepCount = (report.ok && report.ok.length) || 0;
  
  const suites = Object.values(report.suites || {});
  const suiteNames = suites.map(s => s.suite);
  const suiteHealthScores = suites.map(s => s.healthScore || 0);
  
  return `
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            initializeCharts();
        });
        
        function initializeCharts() {
            // Wait a bit for DOM to be fully ready
            setTimeout(() => {
                createStatusChart();
                createSuiteHealthChart();
            }, 100);
        }
        
        function createStatusChart() {
            const ctx = document.getElementById('statusChart');
            if (!ctx) return;
            
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Healthy Steps', 'Regressions', 'New Steps'],
                    datasets: [{
                        data: [${okStepCount}, ${regressionCount}, ${newStepCount}],
                        backgroundColor: [
                            '#27ae60',
                            '#e74c3c',
                            '#f39c12'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true
                            }
                        }
                    }
                }
            });
        }
        
        function createSuiteHealthChart() {
            const ctx = document.getElementById('suiteHealthChart');
            if (!ctx) return;
            
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(suiteNames)},
                    datasets: [{
                        label: 'Health Score (%)',
                        data: ${JSON.stringify(suiteHealthScores)},
                        backgroundColor: ${JSON.stringify(suiteHealthScores.map(score => {
                          if (score >= 90) return '#27ae60';
                          if (score >= 75) return '#2ecc71';
                          if (score >= 60) return '#f39c12';
                          return '#e74c3c';
                        }))},
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    </script>`;
}

module.exports = { generateReport, generateHTMLContent }; 