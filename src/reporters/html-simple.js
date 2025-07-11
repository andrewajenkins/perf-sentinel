const fs = require('fs').promises;
const path = require('path');

/**
 * Generate a performance-optimized HTML report for large datasets
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
 * Generate optimized HTML content for large datasets
 */
async function generateHTMLContent(report, options) {
  const { title, includeCharts, includeInteractive } = options;
  
  // Prepare data for optimization
  const allSteps = [
    ...((report.regressions || []).map(s => ({ ...s, status: 'regression' }))),
    ...((report.newSteps || []).map(s => ({ ...s, status: 'new' }))),
    ...((report.ok || []).map(s => ({ ...s, status: 'ok' })))
  ];
  
  const isLargeDataset = allSteps.length > 500;
  const pageSize = isLargeDataset ? 100 : 50;
  const initialSteps = allSteps.slice(0, pageSize);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #e9ecef;
        }
        
        .performance-warning {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            border-radius: 4px;
            padding: 1rem;
            margin: 1rem 0;
            color: #856404;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .summary-card {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #667eea;
        }
        
        .summary-card.critical { border-left-color: #e74c3c; }
        .summary-card.warning { border-left-color: #f39c12; }
        .summary-card.success { border-left-color: #27ae60; }
        
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            color: #333;
        }
        
        .metric-label {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 0.5rem;
        }
        
        .controls {
            margin: 1rem 0;
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
        }
        
        .filter-input, .filter-select {
            padding: 0.5rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 0.9rem;
        }
        
        .filter-input {
            flex: 1;
            min-width: 200px;
        }
        
        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            background: #667eea;
            color: white;
            transition: background 0.2s;
        }
        
        .btn:hover { background: #5a67d8; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .table-container {
            overflow-x: auto;
            margin: 1rem 0;
        }
        
        .steps-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        
        .steps-table th,
        .steps-table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }
        
        .steps-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }
        
        .steps-table tr:hover {
            background: #f8f9fa;
        }
        
        .status-badge {
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-badge.regression { background: #f8d7da; color: #721c24; }
        .status-badge.new { background: #fff3cd; color: #856404; }
        .status-badge.ok { background: #d4edda; color: #155724; }
        
        .tag {
            background: #e9ecef;
            color: #495057;
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.8rem;
            margin-right: 0.25rem;
        }
        
        .pagination {
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
        
        .pagination-controls {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        
        @media (max-width: 768px) {
            .controls {
                flex-direction: column;
            }
            
            .pagination {
                flex-direction: column;
                gap: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ Performance Analysis Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        ${generateSummarySection(report)}
        
        ${isLargeDataset ? `
            <div class="performance-warning">
                <strong>⚠️ Large dataset detected (${allSteps.length} steps)</strong> - 
                Using optimized paginated view for better performance.
            </div>
        ` : ''}
        
        <div class="controls">
            <input type="text" id="searchInput" placeholder="Search steps..." class="filter-input">
            <select id="statusFilter" class="filter-select">
                <option value="">All Status</option>
                <option value="regression">Regressions</option>
                <option value="new">New Steps</option>
                <option value="ok">OK Steps</option>
            </select>
            <select id="pageSizeSelect" class="filter-select">
                <option value="50">50 per page</option>
                <option value="100" ${isLargeDataset ? 'selected' : ''}>100 per page</option>
                <option value="200">200 per page</option>
            </select>
            <button id="exportBtn" class="btn">Export CSV</button>
        </div>
        
        <div class="table-container">
            <table class="steps-table">
                <thead>
                    <tr>
                        <th>Step</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Suite</th>
                        <th>Impact</th>
                    </tr>
                </thead>
                <tbody id="stepsTableBody">
                    ${generateStepRows(initialSteps)}
                </tbody>
            </table>
        </div>
        
        ${isLargeDataset ? `
            <div class="pagination">
                <div class="pagination-info">
                    Showing <span id="showingStart">1</span> to <span id="showingEnd">${Math.min(pageSize, allSteps.length)}</span> 
                    of <span id="totalCount">${allSteps.length}</span> steps
                </div>
                <div class="pagination-controls">
                    <button id="prevBtn" class="btn" disabled>Previous</button>
                    <span id="pageInfo">Page 1 of ${Math.ceil(allSteps.length / pageSize)}</span>
                    <button id="nextBtn" class="btn" ${allSteps.length <= pageSize ? 'disabled' : ''}>Next</button>
                </div>
            </div>
        ` : ''}
    </div>
    
    <script>
        // Store all step data
        const allStepsData = ${JSON.stringify(allSteps)};
        let filteredData = [...allStepsData];
        let currentPage = 1;
        let pageSize = ${pageSize};
        
        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', function() {
            initializeFilters();
            initializePagination();
            initializeExport();
        });
        
        function initializeFilters() {
            document.getElementById('searchInput').addEventListener('input', filterSteps);
            document.getElementById('statusFilter').addEventListener('change', filterSteps);
            document.getElementById('pageSizeSelect').addEventListener('change', function(e) {
                pageSize = parseInt(e.target.value);
                currentPage = 1;
                renderTable();
                updatePagination();
            });
        }
        
        function initializePagination() {
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            
            if (prevBtn) {
                prevBtn.addEventListener('click', function() {
                    if (currentPage > 1) {
                        currentPage--;
                        renderTable();
                        updatePagination();
                    }
                });
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', function() {
                    const totalPages = Math.ceil(filteredData.length / pageSize);
                    if (currentPage < totalPages) {
                        currentPage++;
                        renderTable();
                        updatePagination();
                    }
                });
            }
        }
        
        function initializeExport() {
            const exportBtn = document.getElementById('exportBtn');
            if (exportBtn) {
                exportBtn.addEventListener('click', exportToCSV);
            }
        }
        
        function filterSteps() {
            const searchText = document.getElementById('searchInput').value.toLowerCase();
            const statusFilter = document.getElementById('statusFilter').value;
            
            filteredData = allStepsData.filter(step => {
                const textMatch = step.stepText.toLowerCase().includes(searchText);
                const statusMatch = !statusFilter || step.status === statusFilter;
                return textMatch && statusMatch;
            });
            
            currentPage = 1;
            renderTable();
            updatePagination();
        }
        
        function renderTable() {
            const tbody = document.getElementById('stepsTableBody');
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            const pageData = filteredData.slice(start, end);
            
            tbody.innerHTML = pageData.map(step => {
                const suite = step.context?.suite || 'Unknown';
                const duration = step.duration || step.currentDuration || 0;
                const tags = step.context?.tags || [];
                
                let impact = '';
                if (step.status === 'regression') {
                    impact = '+' + (step.slowdown || 0).toFixed(1) + 'ms';
                } else if (step.status === 'new') {
                    impact = 'New';
                } else {
                    impact = 'OK';
                }
                
                return '<tr>' +
                    '<td>' + step.stepText + '</td>' +
                    '<td><span class="status-badge ' + step.status + '">' + step.status.toUpperCase() + '</span></td>' +
                    '<td>' + duration.toFixed(1) + 'ms</td>' +
                    '<td>' + suite + '</td>' +
                    '<td>' + impact + '</td>' +
                    '</tr>';
            }).join('');
        }
        
        function updatePagination() {
            const totalPages = Math.ceil(filteredData.length / pageSize);
            const start = (currentPage - 1) * pageSize + 1;
            const end = Math.min(currentPage * pageSize, filteredData.length);
            
            const showingStart = document.getElementById('showingStart');
            const showingEnd = document.getElementById('showingEnd');
            const totalCount = document.getElementById('totalCount');
            const pageInfo = document.getElementById('pageInfo');
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            
            if (showingStart) showingStart.textContent = start;
            if (showingEnd) showingEnd.textContent = end;
            if (totalCount) totalCount.textContent = filteredData.length;
            if (pageInfo) pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages;
            if (prevBtn) prevBtn.disabled = currentPage === 1;
            if (nextBtn) nextBtn.disabled = currentPage === totalPages;
        }
        
        function exportToCSV() {
            const headers = ['Step', 'Status', 'Duration (ms)', 'Suite', 'Impact'];
            const rows = [headers];
            
            filteredData.forEach(step => {
                const suite = step.context?.suite || 'Unknown';
                const duration = step.duration || step.currentDuration || 0;
                
                let impact = '';
                if (step.status === 'regression') {
                    impact = '+' + (step.slowdown || 0).toFixed(1) + 'ms';
                } else if (step.status === 'new') {
                    impact = 'New';
                } else {
                    impact = 'OK';
                }
                
                rows.push([
                    step.stepText,
                    step.status.toUpperCase(),
                    duration.toFixed(1),
                    suite,
                    impact
                ]);
            });
            
            const csvContent = rows.map(row => 
                row.map(cell => '"' + cell.toString().replace(/"/g, '""') + '"').join(',')
            ).join('\\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'performance-steps-' + new Date().toISOString().split('T')[0] + '.csv';
            link.click();
            URL.revokeObjectURL(link.href);
        }
    </script>
</body>
</html>`;
}

function generateSummarySection(report) {
  const regressionCount = report.regressions?.length || 0;
  const newStepCount = report.newSteps?.length || 0;
  const okStepCount = report.ok?.length || 0;
  const totalSteps = regressionCount + newStepCount + okStepCount;
  
  const statusClass = regressionCount > 0 ? 'critical' : newStepCount > 0 ? 'warning' : 'success';
  
  return `
    <div class="summary-grid">
        <div class="summary-card ${statusClass}">
            <div class="metric-label">Overall Status</div>
            <div class="metric-value">${regressionCount > 0 ? 'Issues Found' : 'All Good'}</div>
        </div>
        
        <div class="summary-card critical">
            <div class="metric-label">Regressions</div>
            <div class="metric-value">${regressionCount}</div>
        </div>
        
        <div class="summary-card warning">
            <div class="metric-label">New Steps</div>
            <div class="metric-value">${newStepCount}</div>
        </div>
        
        <div class="summary-card success">
            <div class="metric-label">Healthy Steps</div>
            <div class="metric-value">${okStepCount}</div>
        </div>
        
        <div class="summary-card">
            <div class="metric-label">Total Steps</div>
            <div class="metric-value">${totalSteps}</div>
        </div>
    </div>`;
}

function generateStepRows(steps) {
  return steps.map(step => {
    const suite = step.context?.suite || 'Unknown';
    const duration = step.duration || step.currentDuration || 0;
    
    let impact = '';
    if (step.status === 'regression') {
      impact = `+${(step.slowdown || 0).toFixed(1)}ms`;
    } else if (step.status === 'new') {
      impact = 'New';
    } else {
      impact = 'OK';
    }
    
    return `
      <tr>
          <td>${step.stepText}</td>
          <td><span class="status-badge ${step.status}">${step.status.toUpperCase()}</span></td>
          <td>${duration.toFixed(1)}ms</td>
          <td>${suite}</td>
          <td>${impact}</td>
      </tr>`;
  }).join('');
}

module.exports = { generateReport, generateHTMLContent }; 