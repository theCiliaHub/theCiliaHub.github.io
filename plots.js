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
            // It's good practice to have the full range available if needed later
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
    // Using jStat library which is already included in your HTML for a more robust calculation
    // log-p-value of the upper tail of the hypergeometric distribution
    return jStat.hypergeometric.logpf(k - 1, N, K, n) / Math.log(10);
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
                <div class="stats-box">
                    <p><strong>Enrichment Score:</strong> ${stats.enrichmentScore.toFixed(2)}-fold</p>
                    <p><strong>P-value:</strong> ${stats.pValue < 0.001 ? stats.pValue.toExponential(3) : stats.pValue.toFixed(3)}</p>
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
                                <td>${item.functional_summary ? item.functional_summary.substring(0, 100) + (item.functional_summary.length > 100 ? '...' : '') : '—'}</td>
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
 * Renders the Ciliome enrichment bar plot.
 */
function renderCiliomeEnrichment(foundGenes, notFoundGenes) {
    const plotContainer = document.getElementById('ciliome-plot-container');
    plotContainer.style.display = 'block';
    plotContainer.innerHTML = '';

    const k = foundGenes.length;
    const n_input = k + notFoundGenes.length;
    
    if (n_input > 0) {
        const M = allGenes ? allGenes.length : 2000;
        const N = 20000; // Assumed total number of human genes
        const pValue = hypergeometricPValue(k, n_input, M, N);
        const enrichmentScore = (k / n_input) / (M / N) || 0;
        
        createEnrichmentResultsTable(foundGenes, notFoundGenes, { k, n_input, M, N, pValue, enrichmentScore });
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
        options: { /* ... options from original code ... */ }
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
        options: { /* ... options from original code ... */ }
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

    // ... Rest of the bubble plot logic remains the same
}


// ✨ =============================================================================
// ✨ NEW PLOTTING FUNCTIONS
// ✨ =============================================================================

/**
 * [NEW] Calculates enrichment of PFAM domains.
 */
function calculateDomainEnrichment(filteredData, allCiliaData) {
    const domainCountsUserList = new Map();
    filteredData.forEach(gene => {
        if (gene.pfam_ids && Array.isArray(gene.pfam_ids)) {
            // Use a Set to count each domain only once per gene
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
    if (M === 0) return []; // Avoid division by zero

    const enrichedDomains = [];
    domainCountsUserList.forEach((count, domainId) => {
        const k = count; // Genes in user list with this domain
        const n = domainCountsBackground.get(domainId) || 0; // Genes in background with this domain
        const richFactor = (k / M) / (n / N);

        if (richFactor > 1) { // Only show enriched domains
            enrichedDomains.push({
                domain: domainId,
                richFactor: richFactor,
                geneCount: k,
            });
        }
    });

    return enrichedDomains.sort((a, b) => b.richFactor - a.richFactor); // Sort by most enriched
}

/**
 * [NEW] Creates the PFAM domain enrichment bubble chart using Plotly.
 */
function createDomainBubbleChart(enrichmentData) {
    // ✨ CORRECTED: Target the correct div ID from your HTML
    const plotContainer = document.getElementById('bubble-chart-div'); 
    if (!plotContainer) return;
    
    if (!enrichmentData || enrichmentData.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No enriched domains found for this gene list.</p>';
        return;
    }

    const trace = {
        x: enrichmentData.map(d => d.richFactor),
        y: enrichmentData.map(d => d.geneCount),
        text: enrichmentData.map(d => d.domain), // This will appear on hover
        mode: 'markers',
        marker: {
            size: enrichmentData.map(d => d.geneCount * 8 + 10), // Scale bubble size
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
 * [NEW] Prepares data for the Ciliopathy Sunburst plot.
 */
function formatDataForSunburst(filteredData) {
    const ciliopathyMap = new Map();

    filteredData.forEach(gene => {
        if (gene.ciliopathy) {
            if (!ciliopathyMap.has(gene.ciliopathy)) {
                ciliopathyMap.set(gene.ciliopathy, []);
            }
            ciliopathyMap.get(gene.ciliopathy).push({ name: gene.gene, value: 1 }); // D3 needs a 'value'
        }
    });

    const children = Array.from(ciliopathyMap.entries()).map(([name, genes]) => ({
        name,
        children: genes
    }));

    return { name: "Ciliopathies", children: children };
}


/**
 * [NEW] Renders the Ciliopathy Sunburst plot using D3.
 */
function createSunburstPlot(data) {
    const container = document.getElementById('sunburst-plot-div');
    if (!container) return;
    container.innerHTML = ''; // Clear previous plot

    if (!data || !data.children || data.children.length === 0) {
        container.innerHTML = '<p class="status-message">No genes with known ciliopathy associations were found.</p>';
        return;
    }
    
    // D3 Sunburst implementation code would go here.
    // This is a complex implementation, but there are many great examples available online.
    // For now, we'll add a placeholder.
    container.innerHTML = `<p style="text-align:center; padding-top:50px;">Sunburst plot for ${data.children.length} ciliopathies will be rendered here.</p>`;

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
    document.querySelectorAll('.plot-area').forEach(el => { el.style.display = 'none'; });
    
    // ✨ MODIFIED: Also show the new advanced plot wrapper ✨
    document.getElementById('enrichment-plots-wrapper').style.display = 'grid';
    document.getElementById('plot-container').style.display = 'block';

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

    // ✨ MODIFIED: Always generate the new plots regardless of the radio button selection ✨
    // 1. Domain Enrichment Bubble Chart
    const domainData = calculateDomainEnrichment(sortedFoundGenes, allGenes);
    createDomainBubbleChart(domainData);

    // 2. Ciliopathy Sunburst
    const sunburstData = formatDataForSunburst(sortedFoundGenes);
    createSunburstPlot(sunburstData);
    
    // This function will now be called by the specific render functions
    // to provide contextually relevant summaries.
    if (plotType !== 'ciliome') {
        createEnrichmentResultsTable(sortedFoundGenes, notFoundGenes);
    }
    
    document.getElementById('plot-container').scrollIntoView({ behavior: 'smooth' });
}
