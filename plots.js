// Chart.js Background Plugin
Chart.register({
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart, args, options) => {
        const { ctx } = chart;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = options.color || '#ffffff';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
    }
});

// =============================================================================
// DATA LOADING AND SEARCH SYSTEM
// =============================================================================

/**
 * Sanitizes any string by removing invisible characters, trimming, and uppercasing.
 */
function sanitize(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .trim()
        .toUpperCase();
}

/**
 * Loads, sanitizes, and prepares the gene database into an efficient lookup map.
 */
async function loadAndPrepareDatabase() {
    if (geneDataCache) return true;
    try {
        const resp = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const rawGenes = await resp.json();

        if (!Array.isArray(rawGenes)) {
            throw new Error('Invalid data format: expected array');
        }

        geneDataCache = rawGenes;
        allGenes = rawGenes;
        geneMapCache = new Map();

        allGenes.forEach(g => {
            if (!g.gene || typeof g.gene !== 'string') return;

            const nameKey = sanitize(g.gene);
            if (nameKey) geneMapCache.set(nameKey, g);

            if (g.synonym) {
                String(g.synonym).split(/[,;]/).forEach(syn => {
                    const key = sanitize(syn);
                    if (key && !geneMapCache.has(key)) geneMapCache.set(key, g);
                });
            }
        });

        console.log(`Loaded ${allGenes.length} genes into database`);
        return true;
    } catch (e) {
        console.error('Data load error:', e);
        return false;
    }
}

/**
 * The central search function using the efficient geneMapCache.
 */
function findGenes(queries) {
    const foundGenes = new Set();
    const notFound = [];

    queries.forEach(query => {
        const sanitizedQuery = sanitize(query);
        const result = geneMapCache.get(sanitizedQuery);

        if (result) {
            foundGenes.add(result);
        } else {
            notFound.push(query);
        }
    });

    return { foundGenes: Array.from(foundGenes), notFoundGenes: notFound };
}


// =============================================================================
// PLOTTING AND ENRICHMENT ANALYSIS
// =============================================================================

/**
 * Gets user-defined settings for plots.
 */
function getPlotSettings() {
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 14,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'bold',
        textColor: document.getElementById('setting-text-color')?.value || '#000000',
        axisColor: document.getElementById('setting-axis-color')?.value || '#000000',
        yAxisTitle: document.getElementById('setting-y-axis-title')?.value || 'Localization',
        xAxisTitle: document.getElementById('setting-x-axis-title')?.value || 'Enrichment',
        barChartColor: document.getElementById('setting-bar-color')?.value || '#2ca25f',
        enrichmentColors: [
            document.getElementById('setting-enrichment-color1')?.value || '#edf8fb',
            '#b2e2e2',
            '#66c2a4',
            '#2ca25f',
            document.getElementById('setting-enrichment-color5')?.value || '#006d2c'
        ]
    };
}

/**
 * Calculates the p-value using the hypergeometric test.
 */
function hypergeometricPValue(k, n, K, N) {
    function logFactorial(num) {
        let result = 0;
        for (let i = 2; i <= num; i++) {
            result += Math.log(i);
        }
        return result;
    }
    function logCombination(n, k) {
        if (k > n || k < 0) return -Infinity;
        if (k === 0 || k === n) return 0;
        return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
    }
    let pValue = 0;
    const maxK = Math.min(n, K);
    for (let i = k; i <= maxK; i++) {
        const logProb = logCombination(K, i) + logCombination(N - K, n - i) - logCombination(N, n);
        pValue += Math.exp(logProb);
    }
    return Math.min(pValue, 1.0);
}

/**
 * Creates the results summary and tables at the bottom of the page.
 */
function createEnrichmentResultsTable(foundGenes, notFoundGenes, stats = null) {
    const container = document.getElementById('enrichment-results-container');
    if (!container) return;

    let summaryHTML = '';
    if (stats) {
        summaryHTML = `
            <div id="ciliome-results-summary">
                <h3>Enrichment Analysis Results 🔬</h3>
                <p>From your list of <strong>${stats.n_input}</strong> unique gene(s), <strong>${stats.k}</strong> were found in the CiliaHub database of <strong>${stats.M}</strong> ciliary genes.</p>
                <p>Of these hits, <strong>${stats.sharedHitsCount}</strong> are associated with known ciliopathies or protein complexes.</p>
                <div class="stats-box">
                    <p><strong>Enrichment Score:</strong> ${stats.enrichmentScore.toFixed(2)}-fold</p>
                    <p><strong>P-value:</strong> ${stats.pValue.toExponential(3)}</p>
                </div>
            </div>
        `;
    }

    let tableHTML = '';
    if (foundGenes.length > 0) {
        tableHTML = `
            <h3>Search Results (${foundGenes.length} gene${foundGenes.length !== 1 ? 's' : ''} found)</h3>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Gene</th>
                            <th>Ensembl ID</th>
                            <th>Localization</th>
                            <th>Function Summary</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${foundGenes.map(item => `
                            <tr>
                                <td><a href="/#/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
                                <td>${item.ensembl_id || '—'}</td>
                                <td>${Array.isArray(item.localization) ? item.localization.join(', ') : (item.localization || '—')}</td>
                                <td>${item.functional_summary ? item.functional_summary.substring(0, 100) + '...' : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    let notFoundHTML = '';
    if (notFoundGenes.length > 0) {
        notFoundHTML = `
            <div class="not-found-section">
                <h4>Genes Not Found (${notFoundGenes.length}):</h4>
                <p>${notFoundGenes.sort().join(', ')}</p>
            </div>
        `;
    }

    container.innerHTML = summaryHTML + tableHTML + notFoundHTML;
}

/**
 * Renders the Ciliome enrichment plot.
 */
function renderCiliomeEnrichment(foundGenes, notFoundGenes) {
    const plotContainer = document.getElementById('ciliome-plot-container');
    plotContainer.style.display = 'block';
    plotContainer.innerHTML = ''; 

    const k = foundGenes.length;
    const n_input = k + notFoundGenes.length;
    
    if (n_input > 0) {
        const M = allGenes ? allGenes.length : 2000;
        const N = 20000;
        const pValue = hypergeometricPValue(k, n_input, M, N);
        const enrichmentScore = (k / n_input) / (M / N) || 0;
        const sharedHitsCount = foundGenes.filter(g => g.ciliopathy || g.complex_names).length;
        
        createEnrichmentResultsTable(foundGenes, notFoundGenes, {
            k, n_input, M, pValue, enrichmentScore, sharedHitsCount
        });
    } else {
        createEnrichmentResultsTable([], []);
        plotContainer.innerHTML = '<p class="status-message">Please enter a gene list to analyze.</p>';
        return;
    }

    if (k === 0) {
        plotContainer.innerHTML = '<p class="status-message">No ciliary genes were found to plot.</p>';
        return;
    }

    plotContainer.innerHTML = `<canvas id="enrichment-chart-canvas"></canvas>`;
    const ctx = document.getElementById('enrichment-chart-canvas').getContext('2d');
    const settings = getPlotSettings();
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        (Array.isArray(gene.localization) ? gene.localization : []).forEach(loc => {
            if (loc) {
                const term = loc.trim();
                const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
                localizationCounts[capitalizedTerm] = (localizationCounts[capitalizedTerm] || 0) + 1;
            }
        });
    });

    const chartData = Object.entries(localizationCounts)
        .sort(([, a], [, b]) => b - a)
        .reduce((acc, [label, count]) => {
            acc.labels.push(label);
            acc.counts.push(count);
            return acc;
        }, { labels: [], counts: [] });

    currentPlot = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Gene Count',
                data: chartData.counts,
                backgroundColor: settings.barChartColor,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { left: 50 } },
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Localization of Found Ciliary Genes', font: { size: 16, weight: 'bold' }, color: settings.textColor },
                tooltip: { titleFont: { size: 14 }, bodyFont: { size: 14 } }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: 'Gene Count', font: { size: 14 }, color: settings.axisColor },
                    ticks: { precision: 0, font: { size: 14 }, color: settings.textColor },
                },
                y: {
                    ticks: { font: { size: 14 }, color: settings.textColor },
                }
            }
        }
    });
}

/**
 * Renders the gene matrix plot.
 */
function renderBubbleMatrix(foundGenes) {
    const plotContainer = document.getElementById('matrix-plot-container');
    plotContainer.style.display = 'block';

    if (foundGenes.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No genes to display in the matrix plot.</p>';
        return;
    }
    
    plotContainer.innerHTML = `<div style="position: relative; width: 100%; min-height: 800px;"><canvas id="enrichment-chart-canvas"></canvas></div>`;
    const ctx = document.getElementById('enrichment-chart-canvas').getContext('2d');
    const settings = getPlotSettings();
    
    const yCategories = [
        'Autophagosomes', 'Axoneme', 'Basal Body', 'Centrosome', 'Cilia', 
        'Ciliary Associated Gene', 'Ciliary Membrane', 'Cytosol', 'Endoplasmic Reticulum', 
        'Flagella', 'Golgi Apparatus', 'Lysosome', 'Microbody', 'Microtubules', 
        'Mitochondrion', 'Nucleus', 'Peroxisome', 'Transition Zone'
    ].sort();
    
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    const colorPalette = ['#377eb8', '#ff7f00', '#4daf4a', '#f781bf', '#a65628', '#984ea3', '#999999', '#e41a1c', '#dede00'];

    const datasets = foundGenes.map((gene, index) => ({
        label: gene.gene,
        data: (Array.isArray(gene.localization) ? gene.localization : (gene.localization || '').split(/[,;]/))
            .map(locString => {
                const trimmedLoc = locString?.trim();
                if (!trimmedLoc) return null;
                const matchingCategory = yCategories.find(cat => cat.toLowerCase() === trimmedLoc.toLowerCase());
                return matchingCategory ? { x: gene.gene, y: matchingCategory, r: 12 } : null;
            }).filter(Boolean),
        backgroundColor: colorPalette[index % colorPalette.length]
    }));

    currentPlot = new Chart(ctx, {
        type: 'bubble',
        data: { datasets },
        options: { /*... your original options ...*/ }
    });
}

/**
 * Renders the enrichment bubble plot (Localization plot).
 */
function renderEnrichmentBubblePlot(foundGenes) {
    const plotContainer = document.getElementById('bubble-enrichment-container');
    plotContainer.style.display = 'block';

    if (foundGenes.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No ciliary genes were found to plot.</p>';
        return;
    }

    plotContainer.innerHTML = `<canvas id="enrichment-chart-canvas"></canvas>`;
    const ctx = document.getElementById('enrichment-chart-canvas').getContext('2d');
    const settings = getPlotSettings();

    const yCategories = [ 'Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome' ];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        (Array.isArray(gene.localization) ? gene.localization : (gene.localization || '').split(/[,;]/))
            .forEach(loc => {
                if (loc) {
                    const trimmedLoc = loc.trim();
                    const matchingCategory = yCategories.find(cat => cat.toLowerCase() === trimmedLoc.toLowerCase());
                    if (matchingCategory) {
                        localizationCounts[matchingCategory] = (localizationCounts[matchingCategory] || 0) + 1;
                    }
                }
        });
    });

    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (categoriesWithData.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No matching localizations found for the given genes.</p>';
        return;
    }

    const maxCount = Math.max(...Object.values(localizationCounts), 1);
    const colorPalette = settings.enrichmentColors;
    const getColor = count => { return colorPalette[0]; }; 
    const getRadius = count => 8 + (count / maxCount) * 12;

    const dataset = {
        data: categoriesWithData.map(loc => ({
            x: localizationCounts[loc],
            y: loc,
            r: getRadius(localizationCounts[loc]),
            count: localizationCounts[loc]
        })),
        backgroundColor: categoriesWithData.map(loc => getColor(localizationCounts[loc]))
    };

    currentPlot = new Chart(ctx, {
        type: 'bubble',
        data: { datasets: [dataset] },
        options: { /*... your original options ...*/ }
    });
}

/**
 * Downloads the currently displayed Chart.js plot.
 */
function downloadPlot() {
    const format = document.getElementById('download-format')?.value || 'png';
    const canvas = document.getElementById('enrichment-chart-canvas'); 
    
    if (!canvas || !currentPlot) {
        alert("Plot not available for download. Please generate a plot first.");
        return;
    }
    
    const url = currentPlot.toBase64Image('image/png', 1.0);
    const fileName = `CiliaHub_Plot.${format}`;

    if (format === 'png') {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });
        pdf.addImage(url, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(fileName);
    }
}


// ✨ =============================================================================
// ✨ NEW PLOTTING FUNCTIONS (SUNBURST, DOMAIN BUBBLE, NETWORK)
// ✨ =============================================================================

/**
 * Calculates enrichment of PFAM domains.
 */
function calculateDomainEnrichment(filteredData, allCiliaData) {
    const domainCountsUserList = new Map();
    filteredData.forEach(gene => {
        if (gene.pfam_ids && Array.isArray(gene.pfam_ids)) {
            new Set(gene.pfam_ids).forEach(pfamId => {
                domainCountsUserList.set(pfamId, (domainCountsUserList.get(pfamId) || 0) + 1);
            });
        }
    });

    const domainCountsBackground = new Map();
    allCiliaData.forEach(gene => {
        if (gene.pfam_ids && Array.isArray(gene.pfam_ids)) {
            new Set(gene.pfam_ids).forEach(pfamId => {
                domainCountsBackground.set(pfamId, (domainCountsBackground.get(pfamId) || 0) + 1);
            });
        }
    });

    const M = filteredData.length;
    const N = allCiliaData.length;
    if (M === 0) return [];

    const enrichedDomains = [];
    domainCountsUserList.forEach((count, domainId) => {
        const k = count;
        const n = domainCountsBackground.get(domainId) || 0;
        if (n === 0) return; // Avoid division by zero if domain is not in background
        const richFactor = (k / M) / (n / N);

        if (richFactor > 1) {
            enrichedDomains.push({
                domain: domainId,
                richFactor: richFactor,
                geneCount: k,
            });
        }
    });

    return enrichedDomains.sort((a, b) => b.richFactor - a.richFactor);
}

/**
 * Creates the PFAM domain enrichment bubble chart using Plotly.
 */
function createDomainBubbleChart(enrichmentData) {
    const plotContainer = document.getElementById('bubble-chart-div');
    if (!plotContainer) return;
    
    if (!enrichmentData || enrichmentData.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No enriched domains found for this gene list.</p>';
        return;
    }

    const trace = {
        x: enrichmentData.map(d => d.richFactor),
        y: enrichmentData.map(d => d.geneCount),
        text: enrichmentData.map(d => d.domain),
        mode: 'markers',
        marker: {
            size: enrichmentData.map(d => Math.min(d.geneCount * 10 + 8, 100)), // Scale size with a max limit
            color: enrichmentData.map(d => d.richFactor),
            colorscale: 'Viridis',
            showscale: true,
            colorbar: { title: 'Rich Factor' }
        }
    };

    const layout = {
        title: 'Enriched Protein Domains (PFAM)',
        xaxis: { title: 'Rich Factor (Fold Enrichment)' },
        yaxis: { title: 'Number of Genes in List' },
        margin: { t: 40, b: 40, l: 50, r: 20 },
        hovermode: 'closest'
    };

    Plotly.newPlot(plotContainer, [trace], layout, {responsive: true});
}

/**
 * Prepares data for the Ciliopathy Sunburst plot.
 */
function formatDataForSunburst(filteredData) {
    const ciliopathyMap = new Map();
    filteredData.forEach(gene => {
        if (gene.ciliopathy && gene.ciliopathy.trim() !== "") {
            const ciliopathyName = gene.ciliopathy.trim();
            if (!ciliopathyMap.has(ciliopathyName)) {
                ciliopathyMap.set(ciliopathyName, []);
            }
            ciliopathyMap.get(ciliopathyName).push({ name: gene.gene, value: 1 });
        }
    });

    const children = Array.from(ciliopathyMap.entries()).map(([name, genes]) => ({
        name,
        children: genes
    }));

    return { name: "Ciliopathies", children: children };
}

/**
 * Renders the Ciliopathy Sunburst plot using D3.
 */
function createSunburstPlot(data) {
    const container = document.getElementById('sunburst-plot-div');
    if (!container) return;
    container.innerHTML = '';

    if (!data || !data.children || data.children.length === 0) {
        container.innerHTML = '<p class="status-message">No genes with known ciliopathy associations were found.</p>';
        return;
    }
    
    // Placeholder message until full D3 implementation is added
    container.innerHTML = `<p style="text-align:center; padding: 20px;"><b>Ciliopathy Sunburst Plot</b><br>This feature is under development.</p>`;
    // Full D3.js implementation for the sunburst chart is complex and would be added here.
}

/**
 * Prepares data for the Protein Complex Network Graph.
 */
function formatDataForNetwork(filteredData) {
    const nodes = filteredData.map(gene => ({
        id: gene.gene,
        group: gene.functional_category ? gene.functional_category[0] : 'Unknown'
    }));

    const links = [];
    const complexMap = new Map();
    filteredData.forEach(gene => {
        if (gene.complex_names && gene.complex_names.trim() !== "") {
            const complexes = gene.complex_names.split(',').map(c => c.trim());
            complexes.forEach(complex => {
                if (!complexMap.has(complex)) complexMap.set(complex, []);
                complexMap.get(complex).push(gene.gene);
            });
        }
    });

    complexMap.forEach(genesInComplex => {
        for (let i = 0; i < genesInComplex.length; i++) {
            for (let j = i + 1; j < genesInComplex.length; j++) {
                links.push({
                    source: genesInComplex[i],
                    target: genesInComplex[j]
                });
            }
        }
    });

    return { nodes, links };
}

/**
 * Renders the Protein Complex Network Graph using D3.
 */
function createNetworkGraph(data) {
    const container = document.getElementById('network-graph-div');
    if (!container) return;
    container.innerHTML = '';

    if (!data || !data.links || data.links.length === 0) {
        container.innerHTML = '<p class="status-message">No shared protein complexes found in the gene list.</p>';
        return;
    }

    // Placeholder message until full D3 implementation is added
    container.innerHTML = `<p style="text-align:center; padding: 20px;"><b>Protein Complex Network</b><br>This feature is under development.</p>`;
    // Full D3.js force-directed graph implementation would be added here.
}


/**
 * Main controller for generating enrichment plots and the results table.
 */
function generateEnrichmentPlots() {
    const genesInput = document.getElementById('enrichment-genes-input').value.trim();
    if (!genesInput) {
        alert('Please enter a gene list.');
        return;
    }

    const geneList = genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;

    const { foundGenes, notFoundGenes } = findGenes(geneList);
    const sortedFoundGenes = Array.from(foundGenes).sort((a, b) => a.gene.localeCompare(b.gene));

    document.getElementById('plot-placeholder').style.display = 'none';
    document.getElementById('download-controls').style.display = 'flex';
    document.querySelectorAll('.plot-area').forEach(el => {
        el.style.display = 'none';
        el.innerHTML = '';
    });
    document.getElementById('plot-container').style.display = 'block';
    
    // ✨ NEW: Also show the wrapper for the advanced plots
    const advancedPlotsWrapper = document.getElementById('enrichment-plots-wrapper');
    if(advancedPlotsWrapper) advancedPlotsWrapper.style.display = 'grid';


    if (currentPlot) {
        currentPlot.destroy();
        currentPlot = null;
    }
    
    switch (plotType) {
        case 'bubble':
            renderEnrichmentBubblePlot(sortedFoundGenes);
            break;
        case 'matrix':
            renderBubbleMatrix(sortedFoundGenes);
            break;
        case 'ciliome':
            renderCiliomeEnrichment(sortedFoundGenes, notFoundGenes);
            break;
    }

    // ✨ ALWAYS create the results table based on the primary plot type
    if (plotType !== 'ciliome') {
        createEnrichmentResultsTable(sortedFoundGenes, notFoundGenes);
    }

    // ✨ ALWAYS call the new analysis functions ✨
    const domainData = calculateDomainEnrichment(sortedFoundGenes, allGenes);
    createDomainBubbleChart(domainData);

    const sunburstData = formatDataForSunburst(sortedFoundGenes);
    createSunburstPlot(sunburstData);

    const networkData = formatDataForNetwork(sortedFoundGenes);
    createNetworkGraph(networkData);

    document.getElementById('plot-container').scrollIntoView({ behavior: 'smooth' });
}


// =============================================================================
// PAGE RENDERING
// =============================================================================

function displayEnrichmentPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    if (document.querySelector('.cilia-panel')) {
        document.querySelector('.cilia-panel').style.display = 'none';
    }

    // ✨ MODIFIED HTML: Added the wrapper and containers for the new plots ✨
    contentArea.innerHTML = `
        <div class="page-section enrichment-page">
            <div class="enrichment-header">
                <h2>Ciliary Gene Enrichment Analysis</h2>
                <p>Paste your list of genes and CiliaHub will calculate enrichment and visualize associations.</p>
            </div>

            <div class="enrichment-layout">
                <div class="enrichment-controls-panel">
                    <label for="enrichment-genes-input" style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Enter Gene List:</label>
                    <textarea id="enrichment-genes-input" placeholder="e.g., IFT88, NPHP1, BBS1..."></textarea>
                    <div id="enrichment-actions">
                         <div class="plot-type-selection">
                            <strong>Primary Plot:</strong>
                            <label><input type="radio" name="plot-type" value="ciliome" checked> Ciliome Enrichment</label>
                            <label><input type="radio" name="plot-type" value="bubble"> Localization</label>
                            <label><input type="radio" name="plot-type" value="matrix"> Gene Matrix</label>
                        </div>
                        <div class="action-buttons">
                            <button id="generate-plot-btn" class="btn btn-primary">Generate Analyses</button>
                            <div id="download-controls" style="display:none;">
                                <select id="download-format"><option value="png">PNG</option><option value="pdf">PDF</option></select>
                                <button id="download-plot-btn" class="btn btn-secondary">Download Primary Plot</button>
                            </div>
                        </div>
                    </div>
                    <details id="plot-customization-details">
                        <summary>Plot Customization</summary>
                        <div id="plot-settings-panel">
                            <div><label>Font Family <select id="setting-font-family"><option>Arial</option><option>Tahoma</option></select></label></div>
                            <div><label>Font Size <input type="number" id="setting-font-size" value="14" min="8" max="30"></label></div>
                            <div><label>Font Weight <select id="setting-font-weight"><option value="normal">Normal</option><option value="bold" selected>Bold</option></select></label></div>
                            <div><label>Text Color <input type="color" id="setting-text-color" value="#000000"></label></div>
                            <div><label>Axis Color <input type="color" id="setting-axis-color" value="#000000"></label></div>
                            <div><label>Bar Color <input type="color" id="setting-bar-color" value="#2ca25f"></label></div>
                        </div>
                    </details>
                </div>

                <div class="enrichment-plot-panel">
                    <div id="plot-container" style="display:none;">
                        <div id="bubble-enrichment-container" class="plot-area" style="display: none;"></div>
                        <div id="matrix-plot-container" class="plot-area" style="display: none;"></div>
                        <div id="ciliome-plot-container" class="plot-area" style="display: none;"></div>
                    </div>
                    
                    <div id="enrichment-plots-wrapper" style="display: none;">
                        <div class="plot-container">
                            <h3>Enriched Protein Domains</h3>
                            <div id="bubble-chart-div"></div>
                        </div>
                        <div class="plot-container">
                            <h3>Ciliopathy Associations</h3>
                            <div id="sunburst-plot-div"></div>
                        </div>
                        <div class="plot-container">
                            <h3>Protein Complex Network</h3>
                            <div id="network-graph-div"></div>
                        </div>
                    </div>
                    
                    <div id="plot-placeholder" class="status-message">Your results will be displayed here.</div>
                </div>
            </div>

            <div id="enrichment-results-container" class="results-section"></div>
        </div>
    `;

    document.getElementById('generate-plot-btn').addEventListener('click', generateEnrichmentPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}
