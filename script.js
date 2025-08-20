async function loadCiliaHubData() {
    const tableBody = document.getElementById('ciliahub-table-body');
    const searchInput = document.getElementById('ciliahub-search');
    const filterSelect = document.getElementById('ciliahub-filter');
    const omimFilter = document.getElementById('omim-filter');
    const referenceFilter = document.getElementById('reference-filter');
    const synonymFilter = document.getElementById('synonym-filter');
    const resetBtn = document.getElementById('ciliahub-reset');
    const downloadBtn = document.getElementById('download-ciliahub');
    const exportFilteredBtn = document.getElementById('export-filtered');
    const batchQueryBtn = document.getElementById('batchQueryBtn');
    const batchGenesInput = document.getElementById('batchGenes');
    const batchResultsDiv = document.getElementById('batchResults');
    const batchResultsContainer = document.getElementById('batchResultsContainer');
    const clearBatchResultsBtn = document.getElementById('clearBatchResults');
    const popularGenesList = document.getElementById('popularGenesList');
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

    // Statistics tracking
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
                if (locLower.includes(keyword)) {
                    return category;
                }
            }
        }
        return null;
    }

    function showError(message) {
        loadingDiv.textContent = message;
        loadingDiv.style.display = 'block';
        table.style.display = 'none';
    }

    function hideError() {
        loadingDiv.style.display = 'none';
    }

    function formatReference(reference) {
        if (!reference) return 'N/A';
        const refs = reference.split(';').map(ref => ref.trim()).filter(ref => ref);
        const formattedRefs = refs.map(ref => {
            if (/^\d+$/.test(ref)) {
                return `<a href="https://pubmed.ncbi.nlm.nih.gov/${ref}/" target="_blank">${ref}</a>`;
            } else if (ref.startsWith('https://doi.org/') || /^10\.\d{4,}/.test(ref)) {
                const doi = ref.startsWith('https://doi.org/') ? ref.replace('https://doi.org/', '') : ref;
                const doiUrl = `https://doi.org/${doi}`;
                return `<a href="${doiUrl}" target="_blank">${doi}</a>`;
            } else if (ref.startsWith('http://') || ref.startsWith('https://')) {
                return `<a href="${ref}" target="_blank">${ref}</a>`;
            } else {
                return ref;
            }
        });
        return formattedRefs.join(', ');
    }

    function updateResultsCounter(count) {
        if (resultsCounter) {
            resultsCounter.textContent = `Showing ${count} genes`;
            resultsCounter.style.display = count > 0 ? 'block' : 'none';
        }
    }

    function populateTable(dataToShow = []) {
        tableBody.innerHTML = '';
        filteredData = dataToShow;
       
        if (dataToShow.length === 0) {
            loadingDiv.style.display = 'none';
            table.style.display = 'none';
            updateResultsCounter(0);
            return;
        }

        dataToShow.forEach(item => {
            const sanitizedLocalization = (item.localization || '')
                .toLowerCase()
                .replace(/[\s,]+/g, '-');

            const referenceLinks = formatReference(item.reference);
            const synonyms = item.synonym ? item.synonym.split(',').map(s => s.trim()).join('<br>') : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><a href="#home/${item.gene}" onclick="showSection('gene-card', '${item.gene}')">${item.gene}</a></td>
                <td><a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${item.ensembl_id}" target="_blank">${item.ensembl_id}</a></td>
                <td class="description" data-full-text="${item.description || ''}">${item.description || ''}</td>
                <td>${synonyms}</td>
                <td><a href="https://www.omim.org/entry/${item.omim_id}" target="_blank">${item.omim_id}</a></td>
                <td class="reference" data-tooltip="${item.reference || ''}">${referenceLinks}</td>
                <td>${item.localization || ''}</td>
            `;
            if (sanitizedLocalization) row.classList.add(sanitizedLocalization);
            tableBody.appendChild(row);
        });
       
        loadingDiv.style.display = 'none';
        table.style.display = 'table';
        updateResultsCounter(dataToShow.length);
    }

    function updatePopularGenes() {
        const sortedGenes = Object.entries(searchCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        popularGenesList.innerHTML = sortedGenes.length
            ? sortedGenes.map(([gene, count]) => `<li><a href="#home/${gene}" onclick="showSection('gene-card', '${gene}')">${gene}</a> (${count} searches)</li>`).join('')
            : '<li>No searches yet.</li>';
    }

    function showSearchPrompt() {
        loadingDiv.innerHTML = 'Enter a search term to explore the CiliaHub database...';
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

        [...allGeneNames].forEach(gene => {
            if (gene.toLowerCase().includes(queryLower) && suggestions.length < 8) {
                suggestions.push({ text: gene, type: 'gene' });
            }
        });

        [...allSynonyms].forEach(synonym => {
            if (synonym.toLowerCase().includes(queryLower) && suggestions.length < 8) {
                suggestions.push({ text: synonym, type: 'synonym' });
            }
        });

        [...allEnsemblIds].forEach(id => {
            if (id.toLowerCase().includes(queryLower) && suggestions.length < 8) {
                suggestions.push({ text: id, type: 'ensembl' });
            }
        });

        if (suggestions.length > 0) {
            suggestionsDiv.innerHTML = suggestions.map(s =>
                `<div class="suggestion-item" data-type="${s.type}" data-value="${s.text}">${s.text} <span class="suggestion-type">${s.type}</span></div>`
            ).join('');
            suggestionsDiv.style.display = 'block';

            suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    const value = item.getAttribute('data-value');
                    searchInput.value = value;
                    suggestionsDiv.style.display = 'none';
                    const geneData = data.find(item => 
                        item.gene.toLowerCase() === value.toLowerCase() ||
                        item.ensembl_id.toLowerCase() === value.toLowerCase() ||
                        (item.synonym && item.synonym.toLowerCase().includes(value.toLowerCase()))
                    );
                    if (geneData) {
                        showSection('gene-card', geneData.gene);
                    } else {
                        applyFilters();
                    }
                });
            });
        } else {
            suggestionsDiv.style.display = 'none';
        }
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            suggestionsDiv.style.display = 'none';
        }
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
            let textMatch = true;
            if (query) {
                textMatch = (item.gene && item.gene.toLowerCase().includes(query)) ||
                           (item.ensembl_id && item.ensembl_id.toLowerCase().includes(query)) ||
                           (item.synonym && item.synonym.toLowerCase().includes(query)) ||
                           (item.omim_id && item.omim_id.toLowerCase().includes(query)) ||
                           (item.reference && item.reference.toLowerCase().includes(query));
            }

            let localizationMatch = true;
            if (localizationFilter) {
                localizationMatch = (item.localization || '').toLowerCase().replace(/[\s,]+/g, '-') === localizationFilter;
            }

            let omimMatch = true;
            if (omimFilterValue === 'has-omim') {
                omimMatch = item.omim_id && item.omim_id.trim() !== '';
            } else if (omimFilterValue === 'no-omim') {
                omimMatch = !item.omim_id || item.omim_id.trim() === '';
            }

            let referenceMatch = true;
            if (referenceFilterValue === 'has-reference') {
                referenceMatch = item.reference && item.reference.trim() !== '';
            } else if (referenceFilterValue === 'no-reference') {
                referenceMatch = !item.reference || item.reference.trim() === '';
            }

            let synonymMatch = true;
            if (synonymFilterValue) {
                synonymMatch = item.synonym && item.synonym.toLowerCase().includes(synonymFilterValue);
            }

            return textMatch && localizationMatch && omimMatch && referenceMatch && synonymMatch;
        });

        if (filtered.length === 1 && query) {
            showSection('gene-card', filtered[0].gene);
        } else {
            populateTable(filtered);
        }
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
                    if (!statsData.ciliaLocalizations.has(category)) {
                        statsData.ciliaLocalizations.add(category);
                    }
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
            const ciliaLocData = Object.entries(statsData.ciliaLocalizationCounts)
                .sort((a, b) => b[1] - a[1]);

            new Chart(locCtx, {
                type: 'pie',
                data: {
                    labels: ciliaLocData.map(([label]) => {
                        return label.split(' ').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                    }),
                    datasets: [{
                        data: ciliaLocData.map(([, count]) => count),
                        backgroundColor: [
                            '#203c78',
                            '#4a6fa5',
                            '#6d8bc9',
                            '#90a7dd',
                            '#b3c3f1'
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
                                boxWidth: 15,
                                padding: 10,
                                font: { size: 11 },
                                usePointStyle: true
                            }
                        },
                        title: {
                            display: true,
                            text: 'Cilia-Related Gene Distribution by Localization',
                            font: { size: 14, weight: 'bold' },
                            color: '#203c78'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value} genes (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        const growthCtx = document.getElementById('growthChart');
        if (growthCtx) {
            const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
            const ciliaGeneCounts = [300, 450, 700, 950, 1200, statsData.totalCiliaGenes];

            new Chart(growthCtx, {
                type: 'line',
                data: {
                    labels: years,
                    datasets: [{
                        label: 'Cilia-Related Genes',
                        data: ciliaGeneCounts,
                        borderColor: '#203c78',
                        backgroundColor: 'rgba(32, 60, 120, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointBackgroundColor: '#203c78',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Cilia-Related Genes',
                                font: { size: 12, weight: 'bold' },
                                color: '#203c78'
                            },
                            grid: {
                                color: 'rgba(32, 60, 120, 0.1)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Year',
                                font: { size: 12, weight: 'bold' },
                                color: '#203c78'
                            },
                            grid: {
                                color: 'rgba(32, 60, 120, 0.1)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 11 }
                            }
                        },
                        title: {
                            display: true,
                            text: 'CiliaHub Database Growth Over Time',
                            font: { size: 14, weight: 'bold' },
                            color: '#203c78'
                        }
                    }
                }
            });
        }
    }

    function showGeneCard(geneId) {
        const geneData = data.find(item => item.gene === geneId);
        if (!geneData) {
            document.getElementById('gene-card-content').innerHTML = '<p>Gene not found.</p>';
            return;
        }

        const referenceLinks = formatReference(geneData.reference);
        const synonyms = geneData.synonym ? geneData.synonym.split(',').map(s => s.trim()).join(', ') : 'N/A';

        document.getElementById('gene-card-title').textContent = geneData.gene || 'N/A';
        document.getElementById('gene-card-ensembl').innerHTML = geneData.ensembl_id
            ? `<a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${geneData.ensembl_id}" target="_blank">${geneData.ensembl_id}</a>`
            : 'N/A';
        document.getElementById('gene-card-description').textContent = geneData.description || 'N/A';
        document.getElementById('gene-card-synonyms').textContent = synonyms;
        document.getElementById('gene-card-omim').innerHTML = geneData.omim_id
            ? `<a href="https://www.omim.org/entry/${geneData.omim_id}" target="_blank">${geneData.omim_id}</a>`
            : 'N/A';
        document.getElementById('gene-card-references').innerHTML = referenceLinks;
        document.getElementById('gene-card-localization').textContent = geneData.localization || 'N/A';
    }

    try {
        const response = await fetch('https://raw.githubusercontent.com/rarediseaselab/home/main/ciliahub_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        data = await response.json();
        console.log('Loaded entries:', data.length);
       
        data.forEach(item => {
            if (item.gene) allGeneNames.add(item.gene);
            if (item.ensembl_id) allEnsemblIds.add(item.ensembl_id);
            if (item.synonym) {
                item.synonym.split(',').forEach(syn => {
                    const trimmed = syn.trim();
                    if (trimmed) allSynonyms.add(trimmed);
                });
            }
        });

        calculateStatistics();
        createCharts();
        showSearchPrompt();
        updatePopularGenes();

        window.addEventListener('showGeneCard', (event) => {
            showGeneCard(event.detail.geneId);
        });
    } catch (error) {
        console.error('Error loading CiliaHub data:', error);
        showError('Failed to load CiliaHub data. Please check your network or contact support.');
        return;
    }

    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value;
        showSuggestions(query);
        applyFilters();
    }, 300));

    filterSelect.addEventListener('change', applyFilters);
    omimFilter.addEventListener('change', applyFilters);
    referenceFilter.addEventListener('change', applyFilters);
    synonymFilter.addEventListener('input', debounce(applyFilters, 300));

    resetBtn.addEventListener('click', () => {
        hideError();
        searchInput.value = '';
        filterSelect.value = '';
        omimFilter.value = '';
        referenceFilter.value = '';
        synonymFilter.value = '';
        suggestionsDiv.style.display = 'none';
        searchCounts = {};
        sessionStorage.removeItem('popularGenes');
        updatePopularGenes();
        showSearchPrompt();
    });

    downloadBtn.addEventListener('click', () => {
        const csv = [
            ['Gene', 'Ensembl ID', 'Gene Description', 'Synonym', 'OMIM ID', 'Reference', 'Ciliary Localization'],
            ...data.map(item => [
                item.gene || '',
                item.ensembl_id || '',
                item.description || '',
                item.synonym || '',
                item.omim_id || '',
                item.reference || '',
                item.localization || ''
            ])
        ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ciliahub_data.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    });

    exportFilteredBtn.addEventListener('click', () => {
        if (filteredData.length === 0) {
            alert('No filtered data to export. Please apply filters first.');
            return;
        }
       
        const csv = [
            ['Gene', 'Ensembl ID', 'Gene Description', 'Synonym', 'OMIM ID', 'Reference', 'Ciliary Localization'],
            ...filteredData.map(item => [
                item.gene || '',
                item.ensembl_id || '',
                item.description || '',
                item.synonym || '',
                item.omim_id || '',
                item.reference || '',
                item.localization || ''
            ])
        ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ciliahub_filtered_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    });

    batchQueryBtn.addEventListener('click', () => {
        hideError();
        const input = batchGenesInput.value.trim();
        if (!input) {
            batchResultsDiv.innerHTML = '<p style="color: red;">Please enter at least one gene name or ID.</p>';
            batchResultsContainer.style.display = 'block';
            return;
        }
        const queries = input.split(/[\s,\n]+/).filter(q => q.trim()).map(q => q.toLowerCase());
        queries.forEach(query => {
            searchCounts[query] = (searchCounts[query] || 0) + 1;
            sessionStorage.setItem('popularGenes', JSON.stringify(searchCounts));
        });
        updatePopularGenes();
        const batchFiltered = data.filter(item =>
            queries.some(query =>
                (item.gene && item.gene.toLowerCase() === query) ||
                (item.ensembl_id && item.ensembl_id.toLowerCase() === query) ||
                (item.synonym && item.synonym.toLowerCase().includes(query)) ||
                (item.omim_id && item.omim_id.toLowerCase() === query)
            )
        );
        if (batchFiltered.length === 0) {
            batchResultsDiv.innerHTML = '<p>No matching genes found.</p>';
            batchResultsContainer.style.display = 'block';
            return;
        }
        batchResultsDiv.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #003366; color: white;">
                        <th style="padding: 10px; width: 10%;">Gene</th>
                        <th style="padding: 10px; width: 10%;">Ensembl ID</th>
                        <th style="padding: 10px; width: 25%;">Description</th>
                        <th style="padding: 10px; width: 10%;">Synonym</th>
                        <th style="padding: 10px; width: 10%;">OMIM ID</th>
                        <th style="padding: 10px; width: 20%;">Reference</th>
                        <th style="padding: 10px; width: 15%;">Localization</th>
                    </tr>
                </thead>
                <tbody>
                    ${batchFiltered.map(item => {
                        const referenceLinks = formatReference(item.reference);
                        return `
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><a href="#home/${item.gene}" onclick="showSection('gene-card', '${item.gene}')">${item.gene}</a></td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${item.ensembl_id}" target="_blank">${item.ensembl_id}</a></td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.description || ''}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.synonym || ''}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><a href="https://www.omim.org/entry/${item.omim_id}" target="_blank">${item.omim_id}</a></td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${referenceLinks}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.localization || ''}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        batchResultsContainer.style.display = 'block';
    });

    clearBatchResultsBtn.addEventListener('click', () => {
        batchResultsDiv.innerHTML = '';
        batchResultsContainer.style.display = 'none';
        batchGenesInput.value = '';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('home')) {
        loadCiliaHubData();
    }
});
