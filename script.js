// Enhanced loadCiliaHubData function with corrected statistics and filtering
async function loadCiliaHubData() {
    const tableBody = document.getElementById('ciliahub-table-body');
    const searchInput = document.getElementById('ciliahub-search');
    const filterSelect = document.getElementById('ciliahub-filter');
    const omimFilter = document.getElementById('omim-filter');
    const referenceFilter = document.getElementById('reference-filter');
    const synonymFilter = document.getElementById('synonym-filter');
    const resetBtn = document.getElementById('ciliahub-reset');
    
    // Download buttons
    const downloadCsvBtn = document.getElementById('download-csv-button');
    const downloadJsonBtn = document.getElementById('download-json-button');
    
    const exportFilteredBtn = document.getElementById('export-filtered');
    const batchQueryBtn = document.getElementById('batchQueryBtn');
    const batchGenesInput = document.getElementById('batchGenes');
    const batchResultsDiv = document.getElementById('batchResults');
    const batchResultsContainer = document.getElementById('batchResultsContainer');
    const clearBatchResultsBtn = document.getElementById('clearBatchResults');
    const popularGenesList = document.getElementById('popularGenesList');
    const errorDiv = document.getElementById('ciliahub-error');
    const loadingDiv = document.getElementById('ciliahub-loading');
    const table = document.querySelector('.ciliahub-table');
    const resultsCounter = document.getElementById('results-counter');
    const suggestionsDiv = document.getElementById('search-suggestions');

    let data = [];
    let filteredData = [];
    let searchCounts = JSON.parse(sessionStorage.getItem('popularGenes')) || {};
    let debounceTimeout;
    let allGeneNames = new Set();
    let allSynonyms = new Set();
    let allEnsemblIds = new Set();

    let statsData = {
        totalCiliaGenes: 0,
        ciliaLocalizations: new Set(),
        ciliaWithOMIM: 0,
        ciliaWithReferences: 0,
        ciliaLocalizationCounts: {}
    };

    const ciliaRelatedCategories = {
        'cilia': ['cilia', 'cilium', 'ciliary'],
        'transition zone': ['transition zone', 'transition-zone'],
        'basal body': ['basal body', 'basal-body', 'centriole'],
        'flagella': ['flagella', 'flagellum'],
        'cilia associated': ['cilia associated', 'ciliary associated', 'cilia-associated', 'ciliary-associated']
    };

    function isCiliaRelated(localization) {
        if (!localization) return false;
        const locLower = localization.toLowerCase().trim();
        for (const [category, keywords] of Object.entries(ciliaRelatedCategories)) {
            for (const keyword of keywords) {
                if (locLower.includes(keyword)) return category;
            }
        }
        return null;
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        loadingDiv.style.display = 'none';
        table.style.display = 'none';
    }

    function hideError() {
        errorDiv.style.display = 'none';
    }

    function formatReference(reference) {
        if (!reference) return 'N/A';
        const refs = reference.split(';').map(ref => ref.trim()).filter(ref => ref);
        return refs.map(ref => {
            if (/^\d+$/.test(ref)) {
                return `<a href="https://pubmed.ncbi.nlm.nih.gov/${ref}/" target="_blank">${ref}</a>`;
            } else if (ref.startsWith('https://doi.org/') || /^10\.\d{4,}/.test(ref)) {
                const doi = ref.replace('https://doi.org/', '');
                return `<a href="https://doi.org/${doi}" target="_blank">${doi}</a>`;
            } else if (ref.startsWith('http')) {
                return `<a href="${ref}" target="_blank">${ref}</a>`;
            }
            return ref;
        }).join(', ');
    }

    function updateResultsCounter(count) {
        if (resultsCounter) {
            resultsCounter.textContent = `Showing ${count} of ${data.length} genes`;
            resultsCounter.style.display = 'block';
        }
    }

    function populateTable(dataToShow = []) {
        tableBody.innerHTML = '';
        filteredData = dataToShow;
        
        if (dataToShow.length === 0 && (searchInput.value || filterSelect.value || omimFilter.value || referenceFilter.value || synonymFilter.value)) {
             tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No results found for your query.</td></tr>';
        } else {
            dataToShow.forEach(item => {
                const sanitizedLocalization = (item.localization || '').toLowerCase().replace(/[\s,]+/g, '-');
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><a href="https://www.ncbi.nlm.nih.gov/gene/?term=${item.gene}" target="_blank">${item.gene}</a></td>
                    <td><a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${item.ensembl_id}" target="_blank">${item.ensembl_id}</a></td>
                    <td class="description" data-full-text="${item.description || ''}">${item.description || ''}</td>
                    <td>${(item.synonym || '').split(',').join('<br>')}</td>
                    <td><a href="https://www.omim.org/entry/${item.omim_id}" target="_blank">${item.omim_id}</a></td>
                    <td class="reference" data-tooltip="${item.reference || ''}">${formatReference(item.reference)}</td>
                    <td>${item.localization || ''}</td>
                `;
                if (sanitizedLocalization) row.classList.add(sanitizedLocalization);
                tableBody.appendChild(row);
            });
        }
        
        loadingDiv.style.display = 'none';
        table.style.display = 'table';
        updateResultsCounter(dataToShow.length);
    }

    function updatePopularGenes() {
        const sortedGenes = Object.entries(searchCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        popularGenesList.innerHTML = sortedGenes.length ? sortedGenes.map(([gene, count]) => `<li>${gene} (${count} searches)</li>`).join('') : '<li>No searches yet.</li>';
    }

    function showSearchPrompt() {
        loadingDiv.innerHTML = 'Enter a search term or apply filters to explore the CiliaHub database...';
        loadingDiv.style.display = 'block';
        table.style.display = 'none';
        updateResultsCounter(0);
    }

    function showSuggestions(query) {
        if (!query || query.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        const suggestions = [];
        const queryLower = query.toLowerCase();
        [...allGeneNames].forEach(gene => { if (gene.toLowerCase().includes(queryLower) && suggestions.length < 8) suggestions.push({ text: gene, type: 'gene' }); });
        [...allSynonyms].forEach(synonym => { if (synonym.toLowerCase().includes(queryLower) && suggestions.length < 8) suggestions.push({ text: synonym, type: 'synonym' }); });
        [...allEnsemblIds].forEach(id => { if (id.toLowerCase().includes(queryLower) && suggestions.length < 8) suggestions.push({ text: id, type: 'ensembl' }); });
        if (suggestions.length > 0) {
            suggestionsDiv.innerHTML = suggestions.map(s => `<div class="suggestion-item" data-type="${s.type}">${s.text} <span class="suggestion-type">${s.type}</span></div>`).join('');
            suggestionsDiv.style.display = 'block';
            suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    searchInput.value = item.textContent.replace(/\s+(gene|synonym|ensembl)$/, '');
                    suggestionsDiv.style.display = 'none';
                    applyFilters();
                });
            });
        } else {
            suggestionsDiv.style.display = 'none';
        }
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) suggestionsDiv.style.display = 'none';
    });

    function applyFilters() {
        hideError();
        const query = searchInput.value.toLowerCase().trim();
        const localizationFilter = filterSelect.value.toLowerCase();
        const omimFilterValue = omimFilter.value;
        const referenceFilterValue = referenceFilter.value;
        const synonymFilterValue = synonymFilter.value.toLowerCase().trim();
        
        if (!query && !localizationFilter && !omimFilterValue && !referenceFilterValue && !synonymFilterValue) {
            showSearchPrompt();
            return;
        }

        if (query) {
            searchCounts[query] = (searchCounts[query] || 0) + 1;
            sessionStorage.setItem('popularGenes', JSON.stringify(searchCounts));
            updatePopularGenes();
        }

        let filtered = data.filter(item => {
            const textMatch = !query || (item.gene && item.gene.toLowerCase().includes(query)) || (item.ensembl_id && item.ensembl_id.toLowerCase().includes(query)) || (item.synonym && item.synonym.toLowerCase().includes(query)) || (item.omim_id && item.omim_id.toLowerCase().includes(query)) || (item.reference && item.reference.toLowerCase().includes(query));
            const localizationMatch = !localizationFilter || (item.localization || '').toLowerCase().replace(/[\s,]+/g, '-') === localizationFilter;
            const omimMatch = (omimFilterValue === 'has-omim' ? (item.omim_id && item.omim_id.trim() !== '') : omimFilterValue === 'no-omim' ? (!item.omim_id || item.omim_id.trim() === '') : true);
            const referenceMatch = (referenceFilterValue === 'has-reference' ? (item.reference && item.reference.trim() !== '') : referenceFilterValue === 'no-reference' ? (!item.reference || item.reference.trim() === '') : true);
            const synonymMatch = !synonymFilterValue || (item.synonym && item.synonym.toLowerCase().includes(synonymFilterValue));
            return textMatch && localizationMatch && omimMatch && referenceMatch && synonymMatch;
        });
        
        populateTable(filtered);
    }

    function debounce(func, wait) {
        return function (...args) {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function calculateStatistics() {
        const ciliaRelatedGenes = data.filter(item => isCiliaRelated(item.localization));
        statsData.totalCiliaGenes = ciliaRelatedGenes.length;
        statsData.ciliaWithOMIM = ciliaRelatedGenes.filter(item => item.omim_id && item.omim_id.trim()).length;
        statsData.ciliaWithReferences = ciliaRelatedGenes.filter(item => item.reference && item.reference.trim()).length;
        statsData.ciliaLocalizationCounts = {};
        ciliaRelatedGenes.forEach(item => {
            if (item.localization && item.localization.trim()) {
                const category = isCiliaRelated(item.localization);
                if (category) {
                    statsData.ciliaLocalizations.add(category);
                    statsData.ciliaLocalizationCounts[category] = (statsData.ciliaLocalizationCounts[category] || 0) + 1;
                }
            }
        });
        document.getElementById('total-genes').textContent = statsData.totalCiliaGenes;
        document.getElementById('unique-localizations').textContent = statsData.ciliaLocalizations.size;
        document.getElementById('with-omim').textContent = statsData.ciliaWithOMIM;
        document.getElementById('with-references').textContent = statsData.ciliaWithReferences;
    }

    function createCharts() {
        const locCtx = document.getElementById('localizationChart');
        if (locCtx) {
            const ciliaLocData = Object.entries(statsData.ciliaLocalizationCounts).sort((a, b) => b[1] - a[1]);
            new Chart(locCtx, {
                type: 'pie',
                data: {
                    labels: ciliaLocData.map(([label]) => label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')),
                    datasets: [{
                        data: ciliaLocData.map(([, count]) => count),
                        backgroundColor: ['#203c78', '#4a6fa5', '#6d8bc9', '#90a7dd', '#b3c3f1'],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 15, padding: 10, font: { size: 11 }, usePointStyle: true }}, title: { display: true, text: 'Cilia-Related Gene Distribution by Localization', font: { size: 14, weight: 'bold' }, color: '#203c78' }, tooltip: { callbacks: { label: (c) => `${c.label || ''}: ${c.parsed} genes (${((c.parsed / c.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)` }}}}
            });
        }

        const growthCtx = document.getElementById('growthChart');
        if (growthCtx) {
            new Chart(growthCtx, {
                type: 'line',
                data: {
                    labels: ['2013', '2021', '2025'],
                    datasets: [{
                        label: 'Ciliary Gold Standard Genes',
                        data: [303, 688, 2011],
                        borderColor: '#203c78',
                        backgroundColor: 'rgba(32, 60, 120, 0.1)',
                        fill: true,
                        tension: 0.1,
                        pointBackgroundColor: '#203c78',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Ciliary Genes', font: { size: 12, weight: 'bold' }, color: '#203c78' }}, x: { title: { display: true, text: 'Year', font: { size: 12, weight: 'bold' }, color: '#203c78' }}}, plugins: { legend: { display: true, position: 'top' }, title: { display: true, text: 'Ciliary Gold Standard Genes Growth Over Time', font: { size: 14, weight: 'bold' }, color: '#203c78' }}}
            });
        }
    }
    
    function downloadFile(content, fileName, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    try {
        const response = await fetch('https://raw.githubusercontent.com/rarediseaselab/home/main/ciliahub_data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        data = await response.json();
        
        data.forEach(item => {
            if (item.gene) allGeneNames.add(item.gene);
            if (item.ensembl_id) allEnsemblIds.add(item.ensembl_id);
            if (item.synonym) item.synonym.split(',').forEach(syn => { if (syn.trim()) allSynonyms.add(syn.trim()); });
        });

        calculateStatistics();
        createCharts();
        showSearchPrompt();
        updatePopularGenes();
    } catch (error) {
        console.error('Error loading CiliaHub data:', error);
        showError('Failed to load CiliaHub data. Please check your network or contact support.');
        return;
    }
    
    // Event listeners
    searchInput.addEventListener('input', debounce(e => { showSuggestions(e.target.value); applyFilters(); }, 300));
    [filterSelect, omimFilter, referenceFilter].forEach(el => el.addEventListener('change', applyFilters));
    synonymFilter.addEventListener('input', debounce(applyFilters, 300));

    resetBtn.addEventListener('click', () => {
        hideError();
        searchInput.value = '';
        filterSelect.value = '';
        omimFilter.value = '';
        referenceFilter.value = '';
        synonymFilter.value = '';
        suggestionsDiv.style.display = 'none';
        sessionStorage.removeItem('popularGenes');
        searchCounts = {};
        updatePopularGenes();
        showSearchPrompt();
    });

    downloadCsvBtn.addEventListener('click', () => {
        const csv = [Object.keys(data[0]).join(','), ...data.map(row => Object.values(row).map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))].join('\n');
        downloadFile(csv, 'ciliahub_data.csv', 'text/csv;charset=utf-8;');
    });

    downloadJsonBtn.addEventListener('click', () => {
        downloadFile(JSON.stringify(data, null, 2), 'ciliahub_data.json', 'application/json;charset=utf-8;');
    });

    exportFilteredBtn.addEventListener('click', () => {
        if (filteredData.length === 0) { alert('No filtered data to export.'); return; }
        const csv = [Object.keys(filteredData[0]).join(','), ...filteredData.map(row => Object.values(row).map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))].join('\n');
        downloadFile(csv, `ciliahub_filtered_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    });

    batchQueryBtn.addEventListener('click', () => {
        hideError();
        const input = batchGenesInput.value.trim();
        if (!input) { batchResultsDiv.innerHTML = '<p style="color: red;">Please enter at least one gene name or ID.</p>'; batchResultsContainer.style.display = 'block'; return; }
        const queries = input.split(/[\s,\n]+/).filter(q => q.trim()).map(q => q.toLowerCase());
        queries.forEach(q => { searchCounts[q] = (searchCounts[q] || 0) + 1; });
        sessionStorage.setItem('popularGenes', JSON.stringify(searchCounts));
        updatePopularGenes();
        const batchFiltered = data.filter(item => queries.some(q => (item.gene && item.gene.toLowerCase() === q) || (item.ensembl_id && item.ensembl_id.toLowerCase() === q) || (item.synonym && item.synonym.toLowerCase().includes(q)) || (item.omim_id && item.omim_id.toLowerCase() === q)));
        if (batchFiltered.length === 0) { batchResultsDiv.innerHTML = '<p>No matching genes found.</p>'; batchResultsContainer.style.display = 'block'; return; }
        batchResultsDiv.innerHTML = `<table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #003366; color: white;"><th>Gene</th><th>Ensembl ID</th><th>Description</th><th>Synonym</th><th>OMIM ID</th><th>Reference</th><th>Localization</th></tr></thead><tbody>${batchFiltered.map(item => `<tr><td><a href="https://www.ncbi.nlm.nih.gov/gene/?term=${item.gene}" target="_blank">${item.gene}</a></td><td><a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${item.ensembl_id}" target="_blank">${item.ensembl_id}</a></td><td>${item.description || ''}</td><td>${item.synonym || ''}</td><td><a href="https://www.omim.org/entry/${item.omim_id}" target="_blank">${item.omim_id}</a></td><td>${formatReference(item.reference)}</td><td>${item.localization || ''}</td></tr>`).join('')}</tbody></table>`;
        batchResultsContainer.style.display = 'block';
    });

    clearBatchResultsBtn.addEventListener('click', () => {
        batchResultsDiv.innerHTML = '';
        batchResultsContainer.style.display = 'none';
        batchGenesInput.value = '';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadCiliaHubData();
    
    const backToTopBtn = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => { backToTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none'; });
    backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    const nightModeToggle = document.getElementById('night-mode-toggle');
    if (localStorage.getItem('nightMode') === 'enabled') document.body.classList.add('night-mode');
    nightModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('night-mode');
        localStorage.setItem('nightMode', document.body.classList.contains('night-mode') ? 'enabled' : 'disabled');
    });

    // Handle initial section display based on URL hash
    const hash = window.location.hash.substring(1);
    if (hash) {
        showSection(hash);
    } else {
        showSection('home');
    }
});
