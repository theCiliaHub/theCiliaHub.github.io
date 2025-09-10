// =======================
// CiliAI: Gene Evidence Analyzer
// =======================

document.addEventListener('DOMContentLoaded', () => {
    const geneInput = document.getElementById('gene-input');
    const geneFile = document.getElementById('gene-file');
    const analyzeBtn = document.getElementById('analyze-btn');
    const clearBtn = document.getElementById('clear-btn');
    const exportBtn = document.getElementById('export-btn');
    const infoDisplay = document.getElementById('info-display');
    const infoText = infoDisplay.querySelector('p');
    const progressContainer = document.getElementById('progress-container');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    const resultsContainer = document.getElementById('results-container');
    const resultsTbody = document.getElementById('results-tbody');

    let results = [];
    let isAnalyzing = false;

    // =====================
    // Utility functions
    // =====================
    const showInfo = (message, isWarning = false) => {
        infoText.textContent = message;
        infoDisplay.classList.remove('hidden');
        infoDisplay.className = isWarning 
            ? 'mb-4 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
            : 'mb-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    };

    const hideInfo = () => infoDisplay.classList.add('hidden');

    const updateProgress = (current, total) => {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        progressText.textContent = `Processing gene ${current} of ${total}...`;
        progressBar.style.width = pct + '%';
        progressBar.textContent = pct + '%';
        progressContainer.classList.remove('hidden');
    };

    const getConfidenceClass = (confidence) => {
        switch ((confidence || '').toLowerCase()) {
            case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'low': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const addResultToTable = (result) => {
        const row = resultsTbody.insertRow();
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
        row.innerHTML = `
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">${result.gene}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getConfidenceClass(result.confidence)}">
                    ${result.confidence || 'N/A'}
                </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">${result.ciliationFreq}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">${result.ciliaLength}</td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 table-cell-truncate" title="${result.sourceRef}">${result.sourceRef}</td>
        `;
    };

    const handleClear = () => {
        results = [];
        resultsTbody.innerHTML = '';
        resultsContainer.classList.add('hidden');
        progressContainer.classList.add('hidden');
        geneInput.value = '';
        if(geneFile) geneFile.value = '';
        hideInfo();
    };

    const handleExport = () => {
        if (!results.length) return;
        const headers = ['Gene', 'Confidence', 'Ciliation Frequency', 'Cilia Length', 'Source Reference'];
        const csvContent = [
            headers.join(','),
            ...results.map(r => [r.gene, r.confidence, r.ciliationFreq, r.ciliaLength, r.sourceRef].map(f => `"${(f||'N/A').replace(/"/g,'""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'cilia_evidence_results.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // =====================
    // Mock database fetch
    // =====================
    const fetchGeneEvidence = async (gene) => {
        const mockDatabase = {
            'WDR54': { confidence: 'Low', ciliationFreq: 'Not found', ciliaLength: 'Not found', sourceRef: 'Predicted role, no experimental data [1,3,6]' },
            'ZDHHC5': { confidence: 'Medium', ciliationFreq: 'No significant effect', ciliaLength: 'Increased', sourceRef: 'Loss of ZDHHC5 causes ciliary lengthening (Rezi et al., 2024)' },
            'IFT88': { confidence: 'High', ciliationFreq: 'Decreased', ciliaLength: 'Shortened / Absent', sourceRef: 'Loss-of-function reduces ciliation [1,2,6]' },
            'ARL13B': { confidence: 'High', ciliationFreq: 'Decreased', ciliaLength: 'Shortened', sourceRef: 'Essential for cilia formation (Caspary et al., 2007)'},
            'BBS5': { confidence: 'High', ciliationFreq: 'No significant effect', ciliaLength: 'Lengthened', sourceRef: 'BBSome component loss leads to longer cilia (Nachury et al., 2007)'}
        };
        await new Promise(res => setTimeout(res, 1));
        return mockDatabase[gene.toUpperCase()] || { confidence: 'Low', ciliationFreq: 'Not found', ciliaLength: 'Not found', sourceRef: 'No structured literature evidence found.' };
    };

    // =====================
    // Batch processing
    // =====================
    const processInBatches = (genes, onProgressUpdate) => {
        let queue = [...genes];
        let processed = 0;
        const total = genes.length;
        const batchSize = 50;

        const processNext = () => {
            if (!queue.length) {
                onProgressUpdate(total, total, true);
                return;
            }
            const batch = queue.splice(0, batchSize);
            const promises = batch.map(g => fetchGeneEvidence(g).then(res => {
                const result = { gene: g, ...res };
                results.push(result);
                addResultToTable(result);
                processed++;
            }));
            Promise.all(promises).then(() => {
                onProgressUpdate(processed, total, false);
                requestAnimationFrame(processNext);
            });
        };
        processNext();
    };

    // =====================
    // Event handlers
    // =====================
    const handleAnalyze = () => {
        if (isAnalyzing) return;
        const genes = geneInput.value.split('\n').map(g => g.trim()).filter(Boolean);
        if (!genes.length) { showInfo('Please enter at least one gene.'); return; }
        hideInfo();
        isAnalyzing = true;
        analyzeBtn.disabled = true;
        handleClear();
        resultsContainer.classList.add('hidden');
        updateProgress(0, genes.length);

        processInBatches(genes, (current, total, finished) => {
            updateProgress(current, total);
            if (finished) {
                progressText.textContent = 'Analysis complete!';
                resultsContainer.classList.remove('hidden');
                analyzeBtn.disabled = false;
                isAnalyzing = false;
            }
        });
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => { geneInput.value = e.target.result; };
        reader.readAsText(file);
    };

    // =====================
    // Attach events
    // =====================
    analyzeBtn.addEventListener('click', handleAnalyze);
    if(clearBtn) clearBtn.addEventListener('click', handleClear);
    if(exportBtn) exportBtn.addEventListener('click', handleExport);
    if(geneFile) geneFile.addEventListener('change', handleFileChange);
});
