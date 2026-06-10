// Chart and visualization management

let charts = {};

function displayResults(data) {
    // Show result containers
    document.getElementById('summaryCardsContainer').style.display = '';
    document.getElementById('severityCardsContainer').style.display = '';
    document.getElementById('resultTabs').style.display = '';

    // Extract data
    const alerts = data.alerts || [];
    const customerRisks = data.customer_risks || [];
    const datasetInfo = data.dataset_info || {};

    // Update summary cards
    updateSummaryCards(datasetInfo, alerts, customerRisks);

    // Update severity counts
    updateSeverityCards(alerts);

    // Render charts
    renderAlertsByRuleChart(alerts);
    renderSeverityDistributionChart(alerts);
    renderTopCustomersChart(customerRisks);

    // Populate worklist
    populateWorklistTable(customerRisks);

    hideError();
}

function updateSummaryCards(datasetInfo, alerts, customerRisks) {
    document.getElementById('statCustomers').textContent = formatNumber(datasetInfo.num_customers || 0);
    document.getElementById('statTransactions').textContent = formatNumber(datasetInfo.num_transactions || 0);
    document.getElementById('statTotalAlerts').textContent = formatNumber(alerts.length);

    const flaggedCustomers = new Set(alerts.map(a => a.customer_id)).size;
    document.getElementById('statFlaggedCustomers').textContent = formatNumber(flaggedCustomers);
}

function updateSeverityCards(alerts) {
    const severityCounts = {
        'CRITICAL': 0,
        'HIGH': 0,
        'MEDIUM': 0,
        'LOW': 0
    };

    alerts.forEach(alert => {
        const severity = alert.risk_tier || 'LOW';
        if (severityCounts.hasOwnProperty(severity)) {
            severityCounts[severity]++;
        }
    });

    document.getElementById('severityCritical').textContent = severityCounts['CRITICAL'];
    document.getElementById('severityHigh').textContent = severityCounts['HIGH'];
    document.getElementById('severityMedium').textContent = severityCounts['MEDIUM'];
    document.getElementById('severityLow').textContent = severityCounts['LOW'];
}

function renderAlertsByRuleChart(alerts) {
    // Count alerts by rule
    const ruleCounts = {};
    alerts.forEach(alert => {
        const ruleId = alert.rule_id || 'Unknown';
        ruleCounts[ruleId] = (ruleCounts[ruleId] || 0) + 1;
    });

    // Sort by count descending
    const sortedRules = Object.entries(ruleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    const labels = sortedRules.map(r => r[0]);
    const data = sortedRules.map(r => r[1]);

    const ctx = document.getElementById('alertsByRuleChart').getContext('2d');

    // Destroy existing chart if it exists
    if (charts.alertsByRule) {
        charts.alertsByRule.destroy();
    }

    charts.alertsByRule = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Alerts',
                data: data,
                backgroundColor: '#0d6efd',
                borderColor: '#0d6efd',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Alerts by Rule'
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderSeverityDistributionChart(alerts) {
    const severityCounts = {
        'CRITICAL': 0,
        'HIGH': 0,
        'MEDIUM': 0,
        'LOW': 0
    };

    alerts.forEach(alert => {
        const severity = alert.risk_tier || 'LOW';
        if (severityCounts.hasOwnProperty(severity)) {
            severityCounts[severity]++;
        }
    });

    const labels = Object.keys(severityCounts);
    const data = Object.values(severityCounts);
    const colors = ['#dc3545', '#fd7e14', '#0dcaf0', '#6c757d'];

    const ctx = document.getElementById('severityChart').getContext('2d');

    // Destroy existing chart if it exists
    if (charts.severity) {
        charts.severity.destroy();
    }

    charts.severity = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: 'white',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Alert Severity Distribution'
                }
            }
        }
    });
}

function renderTopCustomersChart(customerRisks) {
    // Sort by risk_score descending and take top 10
    const topCustomers = [...(customerRisks || [])]
        .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
        .slice(0, 10);

    const labels = topCustomers.map(c => (c.name || 'Unknown').substring(0, 15));
    const data = topCustomers.map(c => c.risk_score || 0);

    const ctx = document.getElementById('topCustomersChart').getContext('2d');

    // Destroy existing chart if it exists
    if (charts.topCustomers) {
        charts.topCustomers.destroy();
    }

    charts.topCustomers = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Risk Score',
                data: data,
                backgroundColor: '#fd7e14',
                borderColor: '#fd7e14',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'x',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Top 10 Flagged Customers (by Risk Score)'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function populateWorklistTable(customerRisks) {
    const tbody = document.getElementById('worklistTableBody');
    tbody.innerHTML = '';

    if (!customerRisks || customerRisks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No flagged customers</td></tr>';
        return;
    }

    // Sort by risk_score descending
    const sorted = [...customerRisks].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));

    sorted.forEach(customer => {
        const row = document.createElement('tr');
        const severity = customer.risk_tier || 'LOW';
        const severityBadgeHtml = getSeverityBadge(severity);

        const flaggedAmount = customer.flagged_amount || 0;
        const rulesTriggered = (customer.rules_triggered || []).join(', ') || 'N/A';

        row.innerHTML = `
            <td><code>${customer.customer_id || 'N/A'}</code></td>
            <td>${customer.name || 'Unknown'}</td>
            <td>${formatNumber(customer.risk_score || 0)}</td>
            <td>${severityBadgeHtml}</td>
            <td><small>${rulesTriggered}</small></td>
            <td>${formatCurrency(flaggedAmount)}</td>
        `;
        tbody.appendChild(row);
    });

    // Store data for export
    window.currentWorklistData = sorted.map(c => ({
        'Customer ID': c.customer_id || '',
        'Name': c.name || '',
        'Risk Score': c.risk_score || 0,
        'Risk Tier': c.risk_tier || '',
        'Rules Triggered': (c.rules_triggered || []).join('; '),
        'Flagged Amount': c.flagged_amount || 0
    }));
}
