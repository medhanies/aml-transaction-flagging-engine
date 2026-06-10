// Main application logic with Pyodide integration

let pyodide = null;
let pyodideReady = false;

// Initialize Pyodide
async function initPyodide() {
    try {
        console.log('Loading Pyodide...');
        pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/' });
        console.log('Pyodide loaded successfully');

        // Mount the Python modules
        console.log('Setting up Python environment...');
        await pyodide.runPythonAsync(`
import sys
from pathlib import Path

# Setup path to find aml_engine module
sys.path.insert(0, '/python')
print('Python path configured')
        `);

        pyodideReady = true;
        console.log('Pyodide ready for analysis');
    } catch (error) {
        console.error('Error initializing Pyodide:', error);
        showError('Failed to initialize Python environment: ' + error.message);
    }
}

// Main analysis function
async function runAnalysis(seed, customers, days) {
    if (!pyodideReady) {
        showError('Python environment not ready. Please refresh the page and try again.');
        return;
    }

    hideError();
    showLoading();
    const startTime = performance.now();

    try {
        // Run Python analysis
        console.log(`Starting analysis: seed=${seed}, customers=${customers}, days=${days}`);

        const result = await pyodide.runPythonAsync(`
import json
from decimal import Decimal
from aml_engine import generator, engine

# Custom JSON encoder for Decimal
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

# Generate dataset
print(f'Generating dataset with {${customers}} customers...')
customers_list, accounts_list, transactions_list = generator.generate_dataset(
    num_customers=${customers},
    num_days=${days},
    seed=${seed}
)
print(f'Generated {len(transactions_list)} transactions')

# Run detection
print('Running detection...')
alerts, customer_risks, rules_summary = engine.run_detection(
    customers_list,
    accounts_list,
    transactions_list
)
print(f'Generated {len(alerts)} alerts')

# Prepare output
output = {
    'alerts': [
        {
            'alert_id': a.alert_id,
            'customer_id': a.customer_id,
            'rule_id': a.rule_id,
            'risk_tier': a.risk_tier,
            'risk_score': float(a.risk_score) if hasattr(a.risk_score, '__float__') else a.risk_score,
            'description': a.description,
            'flagged_amount': float(a.flagged_amount) if hasattr(a.flagged_amount, '__float__') else a.flagged_amount,
            'affected_accounts': a.affected_accounts,
            'temporal_context': a.temporal_context
        }
        for a in alerts
    ],
    'customer_risks': [
        {
            'customer_id': cr.customer_id,
            'name': cr.name,
            'risk_score': float(cr.risk_score) if hasattr(cr.risk_score, '__float__') else cr.risk_score,
            'risk_tier': cr.risk_tier,
            'rules_triggered': cr.rules_triggered,
            'flagged_amount': float(cr.flagged_amount) if hasattr(cr.flagged_amount, '__float__') else cr.flagged_amount,
            'num_accounts': cr.num_accounts,
            'activity_summary': cr.activity_summary
        }
        for cr in customer_risks
    ],
    'dataset_info': {
        'num_customers': len(customers_list),
        'num_accounts': len(accounts_list),
        'num_transactions': len(transactions_list),
        'num_alerts': len(alerts),
        'num_flagged_customers': len(customer_risks)
    }
}

json.dumps(output, cls=DecimalEncoder)
        `);

        // Parse results
        const data = JSON.parse(result);
        console.log('Analysis complete:', data);

        // Display results
        displayResults(data);

        // Store for export
        window.currentAnalysisData = data;

    } catch (error) {
        console.error('Error during analysis:', error);
        showError('Error during analysis: ' + error.message);
    } finally {
        hideLoading();
        const endTime = performance.now();
        const executionTime = ((endTime - startTime) / 1000).toFixed(2);
        document.getElementById('executionTime').textContent = `Execution time: ${executionTime}s`;
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Slider listeners
    document.getElementById('customersSlider').addEventListener('input', (e) => {
        updateSliderLabel('customersSlider', 'customersValue');
    });

    document.getElementById('daysSlider').addEventListener('input', (e) => {
        updateSliderLabel('daysSlider', 'daysValue');
    });

    // Form submission
    document.getElementById('analysisForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const seed = parseInt(document.getElementById('seedInput').value) || 42;
        const customers = parseInt(document.getElementById('customersSlider').value) || 200;
        const days = parseInt(document.getElementById('daysSlider').value) || 90;

        // Validation
        if (seed < 0 || seed > 10000) {
            showError('Seed must be between 0 and 10000');
            return;
        }
        if (customers < 10 || customers > 500) {
            showError('Number of customers must be between 10 and 500');
            return;
        }
        if (days < 7 || days > 365) {
            showError('Observation window must be between 7 and 365 days');
            return;
        }

        await runAnalysis(seed, customers, days);
    });

    // Export CSV button
    document.getElementById('exportCsvBtn').addEventListener('click', () => {
        if (window.currentWorklistData && window.currentWorklistData.length > 0) {
            exportToCSV(window.currentWorklistData, 'sar_worklist.csv');
        } else {
            showError('No data to export');
        }
    });

    // Initialize Pyodide on load
    initPyodide();
});
