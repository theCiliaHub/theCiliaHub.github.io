// =============================================================================
// GLOBAL VARIABLES & CONFIGURATION
// =============================================================================

// Data Management
let allGenes = [];
let geneDataCache = null;
let geneMapCache = null;

// Plotting
let currentPlot = null;

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
 * Renders the gene matrix plot.
 */
function renderBubbleMatrix(foundGenes) {
    document.getElementById('matrix-plot-container').style.display = 'block';
    if (window.enrichmentBarChartInstance) window.enrichmentBarChartInstance.destroy();

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

    const ctx = document.getElementById('enrichment-matrix-plot').getContext('2d');
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
 * Renders the Ciliome enrichment bar chart and statistics.
 */
function renderCiliomeEnrichment(foundGenes, notFoundGenes) {
    document.getElementById('ciliome-plot-container').style.display = 'block';
    if (window.ciliomeChartInstance) window.ciliomeChartInstance.destroy();

    const k = foundGenes.length;
    const n_input = k + notFoundGenes.length;
    const M = allGenes ? allGenes.length : 2000; // Total ciliary genes in database
    const N = 20000; // Total genes in background genome

    if (n_input === 0) {
        document.getElementById('ciliome-plot-container').innerHTML = '<p class="status-message">Please enter a gene list to analyze.</p>';
        return;
    }

    const pValue = hypergeometricPValue(k, n_input, M, N);
    const enrichmentScore = n_input > 0 && M > 0 ? (k / n_input) / (M / N) : 0;

    const summaryHTML = `
        <div id="ciliome-results-summary" style="margin-bottom: 2rem; font-size: 1.1rem; max-width: 600px; margin-left: auto; margin-right: auto; text-align: center;">
            <h3>Enrichment Analysis Results</h3>
            <p>From your list of <strong>${n_input}</strong> unique gene(s), <strong>${k}</strong> were found in the CiliaHub database of <strong>${M}</strong> ciliary genes.</p>
            <p>The expected number of ciliary genes would be approximately <strong>${((M / N) * n_input).toFixed(2)}</strong>.</p>
            <div style="font-size: 1.2rem; margin-top: 1rem; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
                <p><strong>Enrichment Score:</strong> ${enrichmentScore.toFixed(2)}-fold</p>
                <p><strong>P-value (Hypergeometric Test):</strong> ${pValue.toExponential(3)}</p>
            </div>
        </div>
    `;

    const localizationCounts = {};
    foundGenes.forEach(gene => {
        const localizations = Array.isArray(gene.localization) ? gene.localization : (gene.localization || '').split(',');
        localizations.forEach(loc => {
            if (typeof loc !== 'string' || !loc) return;
            const term = loc.trim();
            if (term) {
                 const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
                 localizationCounts[capitalizedTerm] = (localizationCounts[capitalizedTerm] || 0) + 1;
            }
        });
    });

    const chartData = { labels: [], counts: [] };
    Object.entries(localizationCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([label, count]) => {
            chartData.labels.push(label);
            chartData.counts.push(count);
        });

    const barChartHTML = `<div style="position: relative; width: 100%; max-width: 700px; height: 600px; margin: auto;"><canvas id="ciliome-bar-chart"></canvas></div>`;
    const container = document.getElementById('ciliome-plot-container');
    container.innerHTML = summaryHTML + (k > 0 ? barChartHTML : '<p class="status-message">No ciliary genes were found in your list to plot.</p>');

    if (k === 0) return;

    const settings = getPlotSettings();
    const ctx = document.getElementById('ciliome-bar-chart').getContext('2d');
    currentPlot = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Gene Count',
                data: chartData.counts,
                backgroundColor: settings.barChartColor,
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Localization of Found Ciliary Genes', font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }, color: settings.textColor }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: 'Gene Count', font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }, color: settings.axisColor },
                    ticks: { stepSize: 1, color: settings.textColor },
                    grid: { display: false }
                },
                y: {
                    ticks: { font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }, color: settings.textColor },
                    grid: { display: false }
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
 * Main controller for generating enrichment plots.
 */
function generateEnrichmentPlots() {
    const genesInput = document.getElementById('enrichment-genes-input').value.trim();
    if (!genesInput) {
        alert('Please enter a gene list.');
        return;
    }

    const geneList = genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;

    // ✨ FIX: Using the efficient, correct search function.
    const { foundGenes, notFoundGenes } = findGenes(geneList);

    // Hide all plot containers
    document.getElementById('bubble-enrichment-container').style.display = 'none';
    document.getElementById('matrix-plot-container').style.display = 'none';
    document.getElementById('ciliome-plot-container').style.display = 'none';

    document.getElementById('plot-container').style.display = 'block';
    document.getElementById('download-plot-btn').style.display = 'inline-block';

    if (currentPlot) {
        currentPlot.destroy();
        currentPlot = null;
    }

    switch (plotType) {
        case 'bubble':
            renderEnrichmentBubblePlot(Array.from(foundGenes));
            break;
        case 'matrix':
             renderBubbleMatrix(Array.from(foundGenes));
            break;
        case 'ciliome':
            renderCiliomeEnrichment(Array.from(foundGenes), notFoundGenes);
            break;
    }
    document.getElementById('plot-container').scrollIntoView({ behavior: 'smooth' });
}

// =============================================================================
// PAGE RENDERING
// =============================================================================

/**
 * Renders the HTML and sets up event listeners for the Enrichment page.
 */
function displayEnrichmentPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    if (document.querySelector('.cilia-panel')) {
        document.querySelector('.cilia-panel').style.display = 'none';
    }

    contentArea.innerHTML = `
        <div class="page-section">
            <h2>Ciliary Gene Enrichment Analysis</h2>
            <p>Paste your list of genes and CiliaHub will calculate how enriched your list is for known ciliary genes.</p>
            <textarea id="enrichment-genes-input" placeholder="e.g., TMEM17, IFT88, WDR31..." style="width: 100%; min-height: 150px; padding: 1rem; border: 2px solid #e1ecf4; border-radius: 10px; font-size: 1rem; margin-top: 1rem; resize: vertical;"></textarea>
            
            <div id="enrichment-controls" style="margin-top: 1rem; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div>
                    <strong>Plot Type:</strong>
                    <input type="radio" id="plot-bubble" name="plot-type" value="bubble" checked>
                    <label for="plot-bubble" style="margin-right: 10px;">Localization</label>
                    <input type="radio" id="plot-matrix" name="plot-type" value="matrix">
                    <label for="plot-matrix" style="margin-right: 10px;">Gene Matrix</label>
                    <input type="radio" id="plot-ciliome" name="plot-type" value="ciliome">
                    <label for="plot-ciliome" style="margin-right: 10px;">Ciliome Enrichment</label>
                </div>
                <button id="generate-plot-btn" class="btn btn-primary">Generate Plot</button>
                <select id="download-format">
                    <option value="png">PNG</option>
                    <option value="pdf">PDF</option>
                </select>
                <button id="download-plot-btn" class="btn btn-secondary" style="display:none;">Download Plot</button>
            </div>
            
            <div style="margin-top: 20px; border: 1px solid #e1ecf4; border-radius: 5px; padding: 10px;">
                <h3 style="font-weight: bold; margin-bottom: 10px;">Plot Customization</h3>
                <p style="font-size: 0.9rem; color: #555;">Click "Generate Plot" after making changes to apply them.</p>
                <div id="plot-settings-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 10px;">
                    <div><label>Font Family <select id="setting-font-family"><option>Arial</option><option>Tahoma</option></select></label></div>
                    <div><label>Font Size <input type="number" id="setting-font-size" value="14" min="8" max="30"></label></div>
                    <div><label>Font Weight <select id="setting-font-weight"><option value="normal">Normal</option><option value="bold" selected>Bold</option></select></label></div>
                    <div><label>Text Color <input type="color" id="setting-text-color" value="#000000"></label></div>
                    <div><label>Axis Color <input type="color" id="setting-axis-color" value="#000000"></label></div>
                    <div><label>Y-Axis Title <input type="text" id="setting-y-axis-title" value="Localization"></label></div>
                    <div><label>X-Axis Title <input type="text" id="setting-x-axis-title" value="Enrichment"></label></div>
                    <div><label>Bar Color <input type="color" id="setting-bar-color" value="#2ca25f"></label></div>
                    <div><label>Enrichment Color 1 (Low) <input type="color" id="setting-enrichment-color1" value="#edf8fb"></label></div>
                    <div><label>Enrichment Color 2 <input type="color" id="setting-enrichment-color2" value="#b2e2e2" disabled></label></div>
                    <div><label>Enrichment Color 3 <input type="color" id="setting-enrichment-color3" value="#66c2a4" disabled></label></div>
                    <div><label>Enrichment Color 4 <input type="color" id="setting-enrichment-color4" value="#2ca25f" disabled></label></div>
                    <div><label>Enrichment Color 5 (High) <input type="color" id="setting-enrichment-color5" value="#006d2c"></label></div>
                </div>
            </div>

            <div id="plot-container" style="display:none; margin-top: 2rem;">
                <div id="bubble-enrichment-container" style="display: none; align-items: flex-start; gap: 0px;">
                     <div class="plot-wrapper" style="position: relative; height: 600px; flex-grow: 1;"><canvas id="enrichment-bubble-plot"></canvas></div>
                     <div id="legend-container" style="flex-shrink: 0; width: 150px; padding-top: 20px; padding-left: 5px;"></div>
                </div>
                <div id="matrix-plot-container" style="display: none;">
                     <div class="plot-wrapper" style="position: relative; height: 600px;"><canvas id="enrichment-matrix-plot"></canvas></div>
                </div>
                <div id="ciliome-plot-container" style="display: none; padding: 20px; text-align: center;"></div>
            </div>
        </div>
    `;

    document.getElementById('generate-plot-btn').addEventListener('click', generateEnrichmentPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}


// =============================================================================
// MAIN APP ROUTER AND INITIALIZATION
// =============================================================================

/**
 * Handles routing and calls the appropriate display function based on the URL hash.
 */
async function handleRouteChange() {
    await loadAndPrepareDatabase();
    const path = window.location.hash.replace('#', '').toLowerCase() || '/';
    
    // Simple router
    if (path === '/enrichment') {
        displayEnrichmentPage();
    } else {
        // You can add other pages here, for now, it defaults to the enrichment page if the hash is empty or unknown
        displayEnrichmentPage();
        // For a multi-page app, you would have a more extensive router:
        // if (path === '/') displayHomePage();
        // else if (path === '/batch-query') displayBatchQueryPage();
        // etc.
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', handleRouteChange);
window.addEventListener('hashchange', handleRouteChange);
