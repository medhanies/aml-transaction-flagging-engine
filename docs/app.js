// Main application logic with Pyodide integration

let pyodide = null;
let pyodideReady = false;

// Python modules to load into Pyodide's virtual filesystem.
const PYTHON_FILES = [
    'aml_engine/__init__.py',
    'aml_engine/models.py',
    'aml_engine/reference_data.py',
    'aml_engine/scoring.py',
    'aml_engine/generator.py',
    'aml_engine/engine.py',
    'aml_engine/rules/__init__.py',
    'aml_engine/rules/structuring.py',
    'aml_engine/rules/jurisdiction.py',
    'aml_engine/rules/beneficial_ownership.py',
];

// Initialize Pyodide and copy the engine source into its filesystem
async function initPyodide() {
    try {
        setStatus('Loading Python runtime (first load takes ~10s)...');
        pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/' });

        setStatus('Loading AML engine modules...');
        pyodide.FS.mkdirTree('/python/aml_engine/rules');
        for (const file of PYTHON_FILES) {
            const resp = await fetch(`python/${file}`);
            if (!resp.ok) {
                throw new Error(`Failed to fetch python/${file} (HTTP ${resp.status})`);
            }
            const source = await resp.text();
            pyodide.FS.writeFile(`/python/${file}`, source);
        }

        await pyodide.runPythonAsync(`
import sys
sys.path.insert(0, '/python')
import aml_engine
print('aml_engine', aml_engine.__version__, 'ready')
        `);

        pyodideReady = true;
        setStatus('Ready. Click "Generate & Analyze" to run.');
    } catch (error) {
        console.error('Error initializing Pyodide:', error);
        showError('Failed to initialize Python environment: ' + error.message);
        setStatus('');
    }
}

function setStatus(message) {
    document.getElementById('executionTime').textContent = message;
}

// Main analysis function
async function runAnalysis(seed, customers, days) {
    if (!pyodideReady) {
        showError('Python environment is still loading. Please wait a moment and try again.');
        return;
    }

    hideError();
    showLoading();
    const startTime = performance.now();

    try {
        const result = await pyodide.runPythonAsync(`
import json
from aml_engine.generator import generate_dataset
from aml_engine.engine import run_detection

ds = generate_dataset(seed=${seed}, n_customers=${customers}, days=${days})
res = run_detection(ds.transactions, ds.accounts, ds.customers)

output = {
    'alerts': [
        {
            'rule_id': a.rule_id,
            'rule_name': a.rule_name,
            'citation': a.citation,
            'severity': str(a.severity),
            'tier': str(a.tier),
            'base_score': a.base_score,
            'final_score': a.final_score,
            'customer_id': a.customer_id,
            'narrative': a.narrative,
            'txn_count': len(a.txn_ids),
        }
        for a in res.alerts
    ],
    'customer_risks': [
        {
            'customer_id': r.customer_id,
            'customer_name': r.customer_name,
            'score': r.score,
            'tier': str(r.tier),
            'rules_fired': r.rules_fired,
            'alert_count': r.alert_count,
            'flagged_amount': float(r.flagged_amount),
            'first_activity': r.first_activity.isoformat() if r.first_activity else None,
            'last_activity': r.last_activity.isoformat() if r.last_activity else None,
        }
        for r in res.customer_risks
    ],
    'dataset_info': {
        'num_customers': len(ds.customers),
        'num_accounts': len(ds.accounts),
        'num_transactions': len(ds.transactions),
    },
}
json.dumps(output)
        `);

        const data = JSON.parse(result);
        displayResults(data);
        window.currentAnalysisData = data;
    } catch (error) {
        console.error('Error during analysis:', error);
        showError('Error during analysis: ' + error.message);
    } finally {
        hideLoading();
        const executionTime = ((performance.now() - startTime) / 1000).toFixed(2);
        setStatus(`Execution time: ${executionTime}s`);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('customersSlider').addEventListener('input', () => {
        updateSliderLabel('customersSlider', 'customersValue');
    });

    document.getElementById('daysSlider').addEventListener('input', () => {
        updateSliderLabel('daysSlider', 'daysValue');
    });

    document.getElementById('analysisForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const seed = parseInt(document.getElementById('seedInput').value) || 42;
        const customers = parseInt(document.getElementById('customersSlider').value) || 200;
        const days = parseInt(document.getElementById('daysSlider').value) || 90;

        if (seed < 0 || seed > 10000) {
            showError('Seed must be between 0 and 10000');
            return;
        }
        if (customers < 10 || customers > 500) {
            showError('Number of customers must be between 10 and 500');
            return;
        }
        if (days < 28 || days > 365) {
            showError('Observation window must be between 28 and 365 days');
            return;
        }

        await runAnalysis(seed, customers, days);
    });

    document.getElementById('exportCsvBtn').addEventListener('click', () => {
        if (window.currentWorklistData && window.currentWorklistData.length > 0) {
            exportToCSV(window.currentWorklistData, 'sar_worklist.csv');
        } else {
            showError('No data to export');
        }
    });

    initPyodide();
});
