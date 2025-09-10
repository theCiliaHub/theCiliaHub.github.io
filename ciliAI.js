// ciliAI.js

function displayCiliAIPage() {
    hideAllPages(); // Ensure other pages are hidden
    const page = document.querySelector('#ciliAI-page');
    if (page) page.style.display = 'block';
}

// Load DOM elements safely
const geneInput = document.querySelector('#gene-input');
const geneFile = document.querySelector('#gene-file');
const analyzeBtn = document.querySelector('#analyze-btn');
const resultsContainer = document.querySelector('#results-container');
const resultsTbody = document.querySelector('#results-tbody');
const progressContainer = document.querySelector('#progress-container');
const progressBar = document.querySelector('#progress-bar');
const progressText = document.querySelector('#progress-text');
const infoDisplay = document.querySelector('#info-display');
const exportBtn = document.querySelector('#export-btn');
const clearBtn = document.querySelector('#clear-btn');

if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        const genes = geneInput.value.split('\n').map(g => g.trim()).filter(Boolean);
        if (genes.length === 0) return alert("Please enter at least one gene.");
        resultsTbody.innerHTML = '';
        resultsContainer.classList.remove('hidden');
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = '0%';

        // Simulated processing loop
        for (let i = 0; i < genes.length; i++) {
            const gene = genes[i];
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-2">${gene}</td>
                <td class="px-4 py-2">High</td>
                <td class="px-4 py-2">80%</td>
                <td class="px-4 py-2">5.2 μm</td>
                <td class="px-4 py-2">PMID:123456</td>
            `;
            resultsTbody.appendChild(row);
            const percent = Math.round(((i+1)/genes.length)*100);
            progressBar.style.width = percent + '%';
            progressText.textContent = percent + '%';
            await new Promise(r => setTimeout(r, 100)); // Simulate async
        }

        progressContainer.classList.add('hidden');
    });
}

if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        resultsTbody.innerHTML = '';
        resultsContainer.classList.add('hidden');
        geneInput.value = '';
    });
}

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const rows = [...resultsTbody.querySelectorAll('tr')];
        const csvContent = rows.map(r => [...r.querySelectorAll('td')].map(td => td.textContent).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'CiliAI_results.csv';
        a.click();
        URL.revokeObjectURL(url);
    });
}
