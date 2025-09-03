

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
                // Handle synonyms separated by commas or semicolons
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
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 20,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'bold',
        textColor: document.getElementById('setting-text-color')?.value || '#000000',
        axisColor: document.getElementById('setting-axis-color')?.value || '#000000',
        yAxisTitle: document.getElementById('setting-y-axis-title')?.value || 'Localization',
        xAxisTitle: document.getElementById('setting-x-axis-title')?.value || 'Enrichment',
        barChartColor: document.getElementById('setting-bar-color')?.value || '#2ca25f',
        enrichmentColors: [
            document.getElementById('setting-enrichment-color1')?.value || '#edf8fb',
            document.getElementById('setting-enrichment-color2')?.value || '#b2e2e2',
            document.getElementById('setting-enrichment-color3')?.value || '#66c2a4',
            document.getElementById('setting-enrichment-color4')?.value || '#2ca25f',
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
 * Renders the enrichment bubble plot (Localization plot).
 */
function renderEnrichmentBubblePlot(foundGenes) {
    document.getElementById('bubble-enrichment-container').style.display = 'flex';
    if (window.enrichmentDotPlotInstance) window.enrichmentDotPlotInstance.destroy();

    const settings = getPlotSettings();
    // ✨ FIX: Using the complete list of 20 unique localization terms from your database.
    const yCategories = [
        'Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane',
        'Ciliary Pocket', 'Ciliary Tip', 'Flagella', 'Centrosome', 'Cytoskeleton',
        'Cytoplasm', 'Nucleus', 'Endoplasmic Reticulum', 'Mitochondria', 'Ribosome',
        'Golgi', 'Lysosome', 'Peroxisome', 'Plasma Membrane', 'Extracellular Vesicles'
    ];
    const localizationCounts = {};

    foundGenes.forEach(gene => {
        const localizations = Array.isArray(gene.localization) ? gene.localization : (gene.localization || '').split(',');
        localizations.forEach(loc => {
            if (typeof loc !== 'string' || !loc) return;
            const trimmedLoc = loc.trim().toLowerCase();
            if (!trimmedLoc) return;
            
            const matchingCategory = yCategories.find(cat => cat.toLowerCase() === trimmedLoc);
            if (matchingCategory) {
                localizationCounts[matchingCategory] = (localizationCounts[matchingCategory] || 0) + 1;
            }
        });
    });

    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0).sort(); // Sort alphabetically
    if (categoriesWithData.length === 0) {
        document.getElementById('bubble-enrichment-container').innerHTML = '<p class="status-message">No matching localizations found for the given genes.</p>';
        return;
    }

    // Clear placeholder message if data is found
    document.getElementById('bubble-enrichment-container').innerHTML = `
        <div class="plot-wrapper" style="position: relative; height: 600px; flex-grow: 1;"><canvas id="enrichment-bubble-plot"></canvas></div>
        <div id="legend-container" style="flex-shrink: 0; width: 150px; padding-top: 20px; padding-left: 5px;"></div>
    `;

    const maxCount = Math.max(...Object.values(localizationCounts), 1);
    const colorPalette = settings.enrichmentColors;
    const getColor = count => {
        if (count === 0) return '#f0f0f0';
        const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 1;
        const index = Math.min(Math.floor(ratio * (colorPalette.length - 1)), colorPalette.length - 1);
        return colorPalette[index];
    };
    const getRadius = count => 8 + (count / maxCount) * 12;

    const dataset = {
        data: categoriesWithData.map(loc => ({
            x: 0,
            y: loc,
            r: getRadius(localizationCounts[loc]),
            count: localizationCounts[loc]
        })),
        backgroundColor: categoriesWithData.map(loc => getColor(localizationCounts[loc]))
    };

    const legendContainer = document.getElementById('legend-container');
    if (legendContainer) {
        const midCount = Math.ceil(maxCount / 2);
        legendContainer.innerHTML = `
            <div style="font-family: ${settings.fontFamily}; color: ${settings.textColor};">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Gene Count</h4>
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="width: ${getRadius(maxCount)*2}px; height: ${getRadius(maxCount)*2}px; background-color: #ccc; border-radius: 50%; margin-right: 10px;"></div>
                    <span>${maxCount}</span>
                </div>
                ${ midCount > 1 && midCount < maxCount ? `
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="width: ${getRadius(midCount)*2}px; height: ${getRadius(midCount)*2}px; background-color: #ccc; border-radius: 50%; margin-right: 10px;"></div>
                    <span>${midCount}</span>
                </div>` : '' }
                <div style="display: flex; align-items: center; margin-bottom: 25px;">
                    <div style="width: ${getRadius(1)*2}px; height: ${getRadius(1)*2}px; background-color: #ccc; border-radius: 50%; margin-right: 10px;"></div>
                    <span>1</span>
                </div>
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Enrichment</h4>
                <div style="width: 100%; height: 20px; background: linear-gradient(to right, ${colorPalette.join(', ')}); border: 1px solid #ccc;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>Low</span><span>High</span>
                </div>
            </div>`;
    }

    const ctx = document.getElementById('enrichment-bubble-plot').getContext('2d');
    currentPlot = new Chart(ctx, {
        type: 'bubble',
        data: { datasets: [dataset] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: {
                    title: { display: true, text: settings.xAxisTitle, color: settings.axisColor, font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight } },
                    ticks: { display: false },
                    grid: { display: false }
                },
                y: {
                    type: 'category',
                    labels: categoriesWithData,
                    title: { display: true, text: settings.yAxisTitle, color: settings.axisColor, font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight } },
                    grid: { display: false, drawBorder: false },
                    ticks: { font: { size: settings.fontSize, weight: settings.fontWeight, family: settings.fontFamily }, color: settings.textColor }
                }
            }
        }
    });
}

/**
 * Renders an improved and much larger gene matrix plot.
 */
function renderBubbleMatrix(foundGenes) {
    const plotContainer = document.getElementById('matrix-plot-container');
    plotContainer.style.display = 'block';
    if (window.enrichmentBarChartInstance) window.enrichmentBarChartInstance.destroy();

    // This function still displays the detailed results table at the bottom of the page
    createEnrichmentResultsTable(foundGenes, []);

    if (foundGenes.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No genes to display in the matrix plot.</p>';
        return;
    }
    
    // ✨ FIX: Wrapper div makes the plot much taller for better readability
    plotContainer.innerHTML = `<div style="position: relative; width: 100%; min-height: 800px;"><canvas id="enrichment-chart-canvas"></canvas></div>`;
    const ctx = document.getElementById('enrichment-chart-canvas').getContext('2d');
    const settings = getPlotSettings();
    
    // ✨ FIX: Using the complete, sorted list of 18 organelles and locations for the Y-axis
    const yCategories = [
        'Autophagosomes', 'Axoneme', 'Basal Body', 'Centrosome', 'Cilia', 
        'Ciliary Associated Gene', 'Ciliary Membrane', 'Cytosol', 'Endoplasmic Reticulum', 
        'Flagella', 'Golgi Apparatus', 'Lysosome', 'Microtubules', 
        'Mitochondria', 'Nucleus', 'Peroxisome', 'Transition Zone'
    ].sort(); // Sort alphabetically
    
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
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                // ✨ FIX: Legend is removed as requested
                legend: { display: false }, 
                tooltip: { 
                    // ✨ FIX: Font size updated to 20
                    titleFont: { size: 20 },
                    bodyFont: { size: 20 },
                    callbacks: { 
                        label: (context) => `${context.dataset.label} - ${context.raw.y}` 
                    } 
                },
            },
            scales: {
                x: {
                    type: 'category',
                    labels: xLabels,
                    title: { display: true, text: "Gene", font: { size: 20, weight: 'bold' }, color: settings.axisColor },
                    // ✨ FIX: Font size updated to 20 for visibility
                    ticks: { font: { size: 20 }, autoSkip: false, maxRotation: 90, minRotation: 45, color: settings.textColor },
                    grid: { display: false }
                },
                y: {
                    type: 'category',
                    labels: yCategories,
                    title: { display: true, text: 'Ciliary Localization', font: { size: 20, weight: 'bold' }, color: settings.axisColor },
                    // ✨ FIX: Font size updated to 20 for visibility
                    ticks: { font: { size: 20 }, color: settings.textColor },
                    grid: { display: true, color: '#f0f0f0' } // Light gridlines for readability
                }
            }
        }
    });
}

/**
 * Renders the gene matrix plot in the plot panel and a detailed results table below.
 */
function renderBubbleMatrix(foundGenes) {
    const plotContainer = document.getElementById('matrix-plot-container');
    plotContainer.style.display = 'block';
    if (window.enrichmentBarChartInstance) window.enrichmentBarChartInstance.destroy();

    // 1. Display the detailed results table at the bottom of the page
    createEnrichmentResultsTable(foundGenes, []);

    // 2. Render only the plot in the plot panel
    if (foundGenes.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No genes to display in the matrix plot.</p>';
        return;
    }
    
    plotContainer.innerHTML = `<canvas id="enrichment-chart-canvas"></canvas>`;
    const ctx = document.getElementById('enrichment-chart-canvas').getContext('2d');
    const settings = getPlotSettings();
    const yCategories = ['Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Cilia', 'Golgi'];
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    const colorPalette = ['#377eb8', '#ff7f00', '#4daf4a', '#f781bf', '#a65628', '#984ea3', '#999999', '#e41a1c', '#dede00'];

    const datasets = foundGenes.map((gene, index) => ({
        label: gene.gene,
        data: (Array.isArray(gene.localization) ? gene.localization : (gene.localization || '').split(','))
            .map(locString => {
                const trimmedLoc = locString?.trim().toLowerCase();
                if (!trimmedLoc) return null;
                const matchingCategory = yCategories.find(cat => cat.toLowerCase() === trimmedLoc);
                return matchingCategory ? { x: gene.gene, y: matchingCategory, r: 10 } : null;
            }).filter(Boolean),
        backgroundColor: colorPalette[index % colorPalette.length]
    }));

    currentPlot = new Chart(ctx, {
        type: 'bubble',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'right', labels: { font: { family: settings.fontFamily, size: settings.fontSize }, color: settings.textColor } },
                tooltip: { callbacks: { label: (context) => `${context.dataset.label} - ${context.raw.y}` } },
            },
            scales: {
                x: {
                    type: 'category',
                    labels: xLabels,
                    title: { display: true, text: "Gene", font: { family: settings.fontFamily, size: settings.fontSize, weight: 'bold' }, color: settings.axisColor },
                    ticks: { font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }, autoSkip: false, maxRotation: 90, minRotation: 45, color: settings.textColor },
                    grid: { display: false }
                },
                y: {
                    type: 'category',
                    labels: yCategories,
                    title: { display: true, text: 'Ciliary Localization', font: { family: settings.fontFamily, size: settings.fontSize, weight: 'bold' }, color: settings.axisColor },
                    ticks: { font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }, color: settings.textColor },
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Renders the Ciliome enrichment summary/table in the results area
 * and the localization bar chart in the plot panel.
 */
function renderCiliomeEnrichment(foundGenes, notFoundGenes) {
    const plotContainer = document.getElementById('ciliome-plot-container');
    const resultsContainer = document.getElementById('enrichment-results-container');
    
    // Ensure containers are visible and cleared for new results
    plotContainer.style.display = 'block';
    plotContainer.innerHTML = ''; 
    resultsContainer.innerHTML = '';

    const k = foundGenes.length;
    const n_input = k + notFoundGenes.length;

    // --- 1. Render Text and Table Results ---
    // This part runs first and displays the summary and detailed gene table.
    if (n_input > 0) {
        const M = allGenes ? allGenes.length : 2000;
        const N = 20000;
        const pValue = hypergeometricPValue(k, n_input, M, N);
        const enrichmentScore = (k / n_input) / (M / N) || 0;
        const sharedHitsCount = foundGenes.filter(g => g.ciliopathy || g.complex_names).length;
        
        // Use the central function to generate the tidy results table at the bottom
        createEnrichmentResultsTable(foundGenes, notFoundGenes, {
            k, n_input, M, pValue, enrichmentScore, sharedHitsCount
        });
    } else {
        resultsContainer.innerHTML = '<p class="status-message">Please enter a gene list to analyze.</p>';
        plotContainer.innerHTML = ''; // Keep plot area empty
        return;
    }

    // --- 2. Render the Plot ---
    // This part now runs independently to generate the chart.
    if (k === 0) {
        plotContainer.innerHTML = '<p class="status-message">No ciliary genes were found to plot.</p>';
        return;
    }

    // Add the canvas to the plot container
    plotContainer.innerHTML = `<canvas id="enrichment-chart-canvas"></canvas>`;
    const ctx = document.getElementById('enrichment-chart-canvas').getContext('2d');
    const settings = getPlotSettings();

    // Process data for the bar chart
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

    // Create the new chart instance
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
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Localization of Found Ciliary Genes', font: { family: settings.fontFamily, size: 16, weight: settings.fontWeight }, color: settings.textColor }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: 'Gene Count', font: { family: settings.fontFamily, size: 14 }, color: settings.axisColor },
                    ticks: { precision: 0, color: settings.textColor },
                },
                y: {
                    ticks: { font: { family: settings.fontFamily }, color: settings.textColor },
                }
            }
        }
    });
}
/**
 * Handles downloading the current plot as a PNG or PDF.
 */
function downloadPlot() {
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    const format = document.getElementById('download-format')?.value || 'png';
    let canvas = null;
    let fileName = 'CiliaHub_Plot';

    if (selectedPlot === 'bubble') {
        canvas = document.getElementById('enrichment-bubble-plot');
        fileName = 'CiliaHub_Localization_Plot';
    } else if (selectedPlot === 'matrix') {
        canvas = document.getElementById('enrichment-matrix-plot');
        fileName = 'CiliaHub_Gene_Matrix_Plot';
    } else if (selectedPlot === 'ciliome') {
        canvas = document.getElementById('ciliome-bar-chart');
        fileName = 'CiliaHub_Ciliome_Enrichment';
    }

    if (!canvas || !currentPlot) {
        console.error("Canvas or plot instance not found.");
        alert("Plot not available for download. Please generate a plot first.");
        return;
    }
    
    // Use the Chart.js API to render a high-quality image
    const url = currentPlot.toBase64Image('image/png', 1.0);
    
    if (format === 'png') {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.png`;
        a.click();
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });
        pdf.addImage(url, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${fileName}.pdf`);
    }
}



/**
 * Main controller for generating enrichment plots and the status table.
 */
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

    // --- Plot generation logic (remains the same) ---
    document.getElementById('plot-placeholder').style.display = 'none';
    document.getElementById('download-controls').style.display = 'flex';
    document.querySelectorAll('.plot-area').forEach(el => el.style.display = 'none');
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

    // ✨ MODIFIED: Call the new, more detailed table function ✨
    createEnrichmentResultsTable(sortedFoundGenes, notFoundGenes);

    // Scroll down to the generated plot
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

    contentArea.innerHTML = `
        <div class="page-section enrichment-page">
            <div class="enrichment-header">
                <h2>Ciliary Gene Enrichment Analysis</h2>
                <p>Paste your list of genes and CiliaHub will calculate how enriched your list is for known ciliary genes.</p>
            </div>

            <div class="enrichment-layout">
                <div class="enrichment-controls-panel">
                    <label for="enrichment-genes-input" style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Enter Gene List:</label>
                    <textarea id="enrichment-genes-input" placeholder="e.g., IFT88, ACEH, ENSG00000198707..."></textarea>
                    <div id="enrichment-actions">
                         <div class="plot-type-selection">
                            <strong>Plot Type:</strong>
                            <label><input type="radio" name="plot-type" value="bubble" checked> Localization</label>
                            <label><input type="radio" name="plot-type" value="matrix"> Gene Matrix</label>
                            <label><input type="radio" name="plot-type" value="ciliome"> Ciliome Enrichment</label>
                        </div>
                        <div class="action-buttons">
                            <button id="generate-plot-btn" class="btn btn-primary">Generate Plot</button>
                            <div id="download-controls" style="display:none;">
                                <select id="download-format"><option value="png">PNG</option><option value="pdf">PDF</option></select>
                                <button id="download-plot-btn" class="btn btn-secondary">Download</button>
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
                            <div><label>Y-Axis Title <input type="text" id="setting-y-axis-title" value="Localization"></label></div>
                            <div><label>X-Axis Title <input type="text" id="setting-x-axis-title" value="Enrichment"></label></div>
                            <div><label>Bar Color <input type="color" id="setting-bar-color" value="#2ca25f"></label></div>
                            <div><label>Enrichment Color 1 (Low) <input type="color" id="setting-enrichment-color1" value="#edf8fb"></label></div>
                            <div><label>Enrichment Color 5 (High) <input type="color" id="setting-enrichment-color5" value="#006d2c"></label></div>
                        </div>
                    </details>
                </div>

                <div class="enrichment-plot-panel">
                    <div id="plot-container" style="display:none;">
                        <div id="bubble-enrichment-container" class="plot-area" style="display: none;"></div>
                        <div id="matrix-plot-container" class="plot-area" style="display: none;"></div>
                        <div id="ciliome-plot-container" class="plot-area" style="display: none;"></div>
                    </div>
                    <div id="plot-placeholder" class="status-message"></div>
                </div>
            </div>

            <div id="enrichment-results-container" class="results-section"></div>
        </div>
    `;

    document.getElementById('generate-plot-btn').addEventListener('click', generateEnrichmentPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}

/**
 * Creates the results summary and tables at the bottom of the page.
 * This is now the central function for displaying all textual/tabular results.
 */
function createEnrichmentResultsTable(foundGenes, notFoundGenes, stats = null) {
    const container = document.getElementById('enrichment-results-container');
    if (!container) return;

    let summaryHTML = '';
    // If stats are provided (for Ciliome Enrichment), create the summary box
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

    // Create the detailed table for found genes
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
                                <td><a href="/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
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

    // Create the section for not-found genes
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
