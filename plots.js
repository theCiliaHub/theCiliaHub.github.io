/**
 * CiliaPlot: plots.js
 * * This script manages the entire CiliaPlot page within the CiliaHub application.
 * It handles UI setup, user input, data processing, and the rendering of various
 * interactive plots using Plotly.js, Chart.js, and D3.js.
 * * Assumes the following libraries are loaded globally:
 * - Plotly.js
 * - Chart.js
 * - D3.js
 * - venn.js (for Venn diagrams)
 * - jsPDF (for PDF downloads)
 * * Assumes the following data variables are available globally:
 * - window.ciliaData: An array of all gene objects from the database.
 * - window.geneMapCache: A Map for quick gene lookups, created by the main app script.
 */

// Global variable to hold the current plot instance for cleanup
let currentPlotInstance = null;

// Pre-calculated background data for enrichment analysis
let backgroundTermCounts = {
    functional_category: new Map(),
    domain_descriptions: new Map()
};

/**
 * Main function to display and initialize the CiliaPlot page.
 * This is the entry point called by the main application router.
 */
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    // Ensure styles accommodate a wider, more complex layout
    contentArea.className = 'content-area content-area-full'; 
    if(document.querySelector('.cilia-panel')) {
        document.querySelector('.cilia-panel').style.display = 'none';
    }

    // Inject the HTML structure and CSS for the CiliaPlot page
    contentArea.innerHTML = `
    <style>
        /* General Page Styles */
        .ciliaplot-page-container { font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; padding: 20px; }
        h2, h3 { color: #1a237e; }

        .explanation-section { background-color: #e8eaf6; border-left: 5px solid #3f51b5; padding: 15px 20px; margin-bottom: 25px; border-radius: 5px; }
        .explanation-section h2 { margin-top: 0; font-size: 1.5em; }
        .explanation-section a { color: #303f9f; font-weight: bold; text-decoration: none; }
        .explanation-section a:hover { text-decoration: underline; }

        .ciliaplot-main-layout { display: grid; grid-template-columns: 260px 1.5fr 2fr; gap: 20px; align-items: start; }

        .control-card { background: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 15px; }
        .control-card h3 { margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 10px; font-size: 1.2em; }

        /* Left Panel: Plot Types */
        .plot-types-panel .plot-type-list { list-style: none; padding: 0; margin: 0; }
        .plot-types-panel .plot-type-list li { margin-bottom: 10px; }
        .plot-types-panel .plot-type-list label { display: block; padding: 10px 12px; font-size: 0.9em; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; border: 1px solid #ddd; }
        .plot-types-panel .plot-type-list input[type="radio"] { display: none; }
        .plot-types-panel .plot-type-list input[type="radio"]:checked + label { background-color: #3f51b5; color: white; font-weight: bold; border-color: #3f51b5; }
        .plot-types-panel .plot-type-list .group-header { font-weight: bold; margin-top: 15px; margin-bottom: 8px; font-size: 1em; color: #555; }

        /* Middle Panel: Input & Customization */
        #ciliaplot-genes-input { width: 100%; box-sizing: border-box; min-height: 150px; padding: 10px; border-radius: 5px; border: 1px solid #ccc; font-family: 'Courier New', monospace; resize: vertical; margin-bottom: 15px; }
        #generate-ciliaplot-btn { width: 100%; padding: 12px; font-size: 1.1em; font-weight: bold; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; }
        #generate-ciliaplot-btn:hover { background-color: #45a049; }
        #customization-container { margin-top: 20px; }
        .customization-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: end; }
        .customization-grid label { font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.9em; }
        .customization-grid input, .customization-grid select { width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
        .customization-grid .form-group { margin-bottom: 10px; }
        .customization-grid .full-width { grid-column: 1 / -1; }

        /* Right Panel: Visualization & Summary */
        .visualization-panel { position: sticky; top: 20px; }
        .plot-header { display: flex; justify-content: space-between; align-items: center; }
        .download-controls { display: flex; gap: 10px; align-items: center; }
        #download-format { padding: 8px; border-radius: 4px; border: 1px solid #ccc; }
        #download-plot-btn { background-color: #3f51b5; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }

        #plot-display-area { width: 100%; height: 65vh; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #888; margin-top: 10px; overflow: auto; background-color: #fff; }
        #plot-display-area > div, #plot-display-area > svg, #plot-display-area > canvas { min-width: 100% !important; min-height: 100% !important; width: auto !important; height: auto !important; max-width: none !important; max-height: none !important; }
        
        .gene-input-table-container { max-height: 300px; overflow-y: auto; }
        .gene-input-table-container table { width: 100%; border-collapse: collapse; background-color: #fff; }
        .gene-input-table-container th, .gene-input-table-container td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9em; }
        .gene-input-table-container th { background-color: #f2f2f2; position: sticky; top: 0; }
    </style>

    <section class="ciliaplot-page-container">
        <div class="explanation-section">
            <h2>CiliaPlot: Visualize Your Ciliary Gene Sets</h2>
            <p>The CiliaHub database contains an updated list of over <strong>2200 Gold Standard Genes with Ciliary Functions</strong>. With CiliaPlot, you can perform powerful analyses on your own gene lists. Visualize subcellular localizations, identify enriched functional categories or protein domains, and compare your data against seminal genome-wide screens.</p>
        </div>

        <div class="ciliaplot-main-layout">
            <aside class="plot-types-panel">
                <div class="control-card">
                    <h3>Plot Types</h3>
                    <ul class="plot-type-list" id="ciliaplot-type-selector"></ul>
                </div>
            </aside>

            <main class="input-panel">
                <div class="control-card">
                    <h3>Gene Input & Customization</h3>
                    <textarea id="ciliaplot-genes-input" rows="8" placeholder="Enter gene symbols, one per line or separated by commas/spaces..."></textarea>
                    <button id="generate-ciliaplot-btn">Generate Plot</button>
                    <div id="customization-container"></div>
                </div>
            </main>

            <aside class="visualization-panel">
                <div class="control-card">
                    <div class="plot-header">
                        <h3>Visualization</h3>
                        <div class="download-controls">
                            <select id="download-format"><option value="png">PNG</option><option value="svg">SVG</option><option value="pdf">PDF</option></select>
                            <button id="download-plot-btn">Download</button>
                        </div>
                    </div>
                    <div id="plot-display-area"><p>Your plot will appear here</p></div>
                </div>
                <div class="control-card gene-input-table-container">
                    <h3>Gene Input Summary</h3>
                    <table>
                        <thead><tr><th>#</th><th>Query</th><th>Status</th></tr></thead>
                        <tbody id="ciliaplot-gene-summary-tbody">
                            <tr><td colspan="3" style="text-align: center;">Enter genes to see summary...</td></tr>
                        </tbody>
                    </table>
                </div>
            </aside>
        </div>
    </section>
    `;

    initializeCiliaPlotPage();
}


// #############################################################################
// INITIALIZATION & UI SETUP
// #############################################################################

/**
 * All available plot configurations.
 */
const PLOT_CONFIG = {
    'venn_diagram': { label: 'Venn Diagram (vs CiliaHub)', group: 'Gene Set Analysis' },
    'enrichment_bubble': { label: 'Enrichment Bubble Plot', group: 'Gene Set Analysis' },
    'functional_bar': { label: 'Functional Categories (Bar)', group: 'Descriptive Plots' },
    'localization_bubble': { label: 'Localization (Dot Plot)', group: 'Descriptive Plots' },
    'balloon_plot': { label: 'Gene-Function Balloon Plot', group: 'Descriptive Plots' },
    'screen_analysis': { label: 'Screen Analysis (Scatter)', group: 'Screening Data' },
    'network': { label: 'Protein Complex Network', group: 'Advanced Visualizations' },
    // Add other plots here if needed
};

/**
 * Sets up event listeners and populates the UI on page load.
 */
function initializeCiliaPlotPage() {
    if (typeof ciliaData === 'undefined' || ciliaData.length === 0) {
        console.error("CiliaPlot Error: Global `ciliaData` is not available.");
        alert("Error: Core database not loaded. CiliaPlot cannot function.");
        return;
    }
    // Pre-calculate background term counts for enrichment analysis
    precomputeBackgroundCounts(ciliaData);
    
    populatePlotTypes();
    document.getElementById('ciliaplot-type-selector').addEventListener('change', updateCustomizationPanel);
    document.getElementById('generate-ciliaplot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
    
    // Initial population of the customization panel
    updateCustomizationPanel(); 
}

/**
 * Populates the plot type selection list from the PLOT_CONFIG object.
 */
function populatePlotTypes() {
    const container = document.getElementById('ciliaplot-type-selector');
    const grouped = {};
    Object.entries(PLOT_CONFIG).forEach(([key, val]) => {
        if (!grouped[val.group]) grouped[val.group] = [];
        grouped[val.group].push({ key, label: val.label });
    });

    let html = '';
    for (const group in grouped) {
        html += `<li class="group-header">${group}</li>`;
        grouped[group].forEach(({ key, label }, index) => {
            const checked = (group === 'Gene Set Analysis' && index === 0) ? 'checked' : '';
            html += `<li><input type="radio" id="plot-${key}" name="ciliaplot_type" value="${key}" ${checked}><label for="plot-${key}">${label}</label></li>`;
        });
    }
    container.innerHTML = html;
}

/**
 * Dynamically updates the customization panel based on the selected plot type.
 */
function updateCustomizationPanel() {
    const container = document.getElementById('customization-container');
    const plotType = document.querySelector('input[name="ciliaplot_type"]:checked')?.value;
    
    let customOptions = '';
    if (plotType === 'enrichment_bubble') {
        customOptions = `
            <div class="full-width form-group">
                <label for="custom-enrichment-term">Enrichment Term</label>
                <select id="custom-enrichment-term">
                    <option value="functional_category">Functional Category</option>
                    <option value="domain_descriptions">PFAM Domains</option>
                </select>
            </div>
            <div class="form-group">
                <label for="custom-pvalue-cutoff">P-value Cutoff</label>
                <input type="number" id="custom-pvalue-cutoff" value="0.05" step="0.01">
            </div>
        `;
    }

    container.innerHTML = `
        <h3>Plot Customization</h3>
        <div class="customization-grid">
            <div class="full-width form-group">
                <label for="custom-title">Plot Title</label>
                <input type="text" id="custom-title" placeholder="Default Title">
            </div>
            ${customOptions}
        </div>
    `;
}


// #############################################################################
// DATA PROCESSING & HELPER FUNCTIONS
// #############################################################################

/**
 * Pre-calculates the frequency of each term in the entire dataset.
 * This is crucial for performing enrichment analysis later.
 */
function precomputeBackgroundCounts(allGenes) {
    Object.keys(backgroundTermCounts).forEach(termType => {
        const termMap = backgroundTermCounts[termType];
        allGenes.forEach(gene => {
            getCleanArray(gene, termType).forEach(term => {
                termMap.set(term, (termMap.get(term) || 0) + 1);
            });
        });
    });
    console.log("Background term counts pre-computed.", backgroundTermCounts);
}

/**
 * A robust function to extract and clean array-like data from gene objects.
 * Handles strings, arrays, and null values.
 * @param {object} gene - The gene data object.
 * @param {string} key - The property to extract from the gene object.
 * @returns {string[]} A cleaned array of strings.
 */
function getCleanArray(gene, key) {
    const data = gene[key];
    if (data == null) return [];
    
    // Clean up strings like 'c("PF07815", "PF00018")'
    const cleanedString = String(data).replace(/c\s*\(\s*|\s*\)\s*|"/g, '');
    
    const separatorRegex = /[,;]/;
    const initialArray = Array.isArray(data) ? data : cleanedString.split(separatorRegex);
    
    return initialArray
        .filter(Boolean)
        .flatMap(item => String(item).split(separatorRegex))
        .map(item => item.trim())
        .filter(Boolean);
}

/**
 * Clears the plot display area, properly destroying any existing plot instances.
 */
function clearAllPlots() {
    const container = document.getElementById('plot-display-area');
    if (!container) return;

    if (currentPlotInstance && typeof currentPlotInstance.destroy === 'function') {
        currentPlotInstance.destroy(); // For Chart.js instances
    }
    currentPlotInstance = null;
    
    try {
        Plotly.purge(container); // For Plotly.js instances
    } catch (e) { /* Ignore if Plotly is not used */ }
    
    container.innerHTML = ''; // Clears D3, Venn, and any other content
}

/**
 * Updates the gene summary table with found/not found status.
 */
function updateGeneSummaryTable(originalQueries, foundGenes) {
    const tbody = document.getElementById('ciliaplot-gene-summary-tbody');
    tbody.innerHTML = '';
    const foundGenesSet = new Set(foundGenes.map(g => g.gene.toUpperCase()));
    
    originalQueries.forEach((query, index) => {
        const status = foundGenesSet.has(query.toUpperCase()) ? '✅ Found' : '❌ Not Found';
        const row = `<tr><td>${index + 1}</td><td>${query}</td><td>${status}</td></tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

/**
 * Simple hypergeometric p-value calculation.
 * log-gamma function is used for better numerical stability.
 * @returns {number} The p-value.
 */
function hypergeometricTest(k, n, K, N) {
    function logGamma(x) {
        let tmp = (x - 0.5) * Math.log(x + 4.5) - (x + 4.5);
        let ser = 1.0 + 76.18009173 / (x + 0) - 86.50532033 / (x + 1) + 24.01409822 / (x + 2) - 1.231739516 / (x + 3) + 0.00120858003 / (x + 4) - 0.00000536382 / (x + 5);
        return tmp + Math.log(2.50662827465 * ser);
    }
    function logCombination(n, k) {
        if (k < 0 || k > n) return -Infinity;
        return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
    }
    let p = 0;
    for (let i = k; i <= n && i <= K; i++) {
        const logProb = logCombination(K, i) + logCombination(N - K, n - i) - logCombination(N, n);
        p += Math.exp(logProb);
    }
    return p;
}


// #############################################################################
// MAIN PLOT GENERATION ORCHESTRATOR
// #############################################################################

/**
 * Main orchestrator function called when the "Generate Plot" button is clicked.
 */
function generateAnalysisPlots() {
    if (typeof geneMapCache === 'undefined' || geneMapCache.size === 0) {
        alert("Error: The main gene database is not yet loaded. Please wait.");
        return;
    }

    const plotContainer = document.getElementById('plot-display-area');
    plotContainer.innerHTML = '<em><p>Processing genes and generating plot...</p></em>';
    clearAllPlots();

    const rawInput = document.getElementById('ciliaplot-genes-input').value;
    const originalQueries = [...new Set(rawInput.split(/[\s,;\n\r\t]+/).filter(Boolean))];
    if (originalQueries.length === 0) {
        plotContainer.innerHTML = '<p>Please enter at least one gene.</p>';
        return;
    }

    // Find genes using the pre-built cache from the main app
    const { foundGenes } = findGenes(originalQueries.map(q => q.toUpperCase()));
    updateGeneSummaryTable(originalQueries, foundGenes);

    if (foundGenes.length === 0) {
        plotContainer.innerHTML = '<p>None of the provided genes were found in the CiliaHub database.</p>';
        return;
    }

    const plotType = document.querySelector('input[name="ciliaplot_type"]:checked').value;
    
    // Call the appropriate rendering function based on selection
    switch (plotType) {
        case 'venn_diagram':
            renderVennDiagram(foundGenes, plotContainer);
            break;
        case 'enrichment_bubble':
            renderEnrichmentBubblePlot(foundGenes, plotContainer);
            break;
        case 'localization_bubble':
            renderLocalizationDotPlot(foundGenes, plotContainer);
            break;
        case 'functional_bar':
            renderFunctionalBarPlot(foundGenes, plotContainer);
            break;
        case 'balloon_plot':
            renderBalloonPlot(foundGenes, plotContainer);
            break;
        case 'network':
            renderComplexNetwork(foundGenes, plotContainer);
            break;
        case 'screen_analysis':
            renderGeneScreenAnalysis(foundGenes, plotContainer);
            break;
        default:
            plotContainer.innerHTML = `<p>Plot type "${plotType}" is not yet implemented.</p>`;
    }
}


// #############################################################################
// PLOT RENDERING FUNCTIONS
// #############################################################################

// -----------------------------------------------------------------------------
// NEW PLOT: Venn Diagram
// -----------------------------------------------------------------------------
function renderVennDiagram(userGenes, container) {
    // Assuming `ciliaData` holds all genes, and we define a "ciliary gene" simply as being in the database.
    const userGeneSet = new Set(userGenes.map(g => g.gene));
    const ciliaryGeneSet = new Set(ciliaData.map(g => g.gene));

    const sets = [
        { sets: ['Your List'], size: userGeneSet.size },
        { sets: ['CiliaHub Gold Standard'], size: ciliaryGeneSet.size },
        { sets: ['Your List', 'CiliaHub Gold Standard'], size: [...userGeneSet].filter(g => ciliaryGeneSet.has(g)).length }
    ];

    container.innerHTML = '';
    const chart = venn.VennDiagram().width(container.clientWidth).height(container.clientHeight);
    
    const div = d3.select(container).datum(sets).call(chart);
    div.selectAll("text").style("fill", "white").style("font-weight", "bold");
    div.selectAll(".venn-circle path").style("fill-opacity", 0.7);
    
    // Add a title using D3
    const title = d3.select(container).select('svg').insert('text', ':first-child')
        .attr('x', container.clientWidth / 2)
        .attr('y', 40)
        .attr('text-anchor', 'middle')
        .style('font-size', '24px')
        .style('font-family', 'Arial')
        .text(document.getElementById('custom-title').value || 'Gene List Overlap with CiliaHub');
}

// -----------------------------------------------------------------------------
// NEW PLOT: Enrichment Bubble Plot
// -----------------------------------------------------------------------------
function renderEnrichmentBubblePlot(userGenes, container) {
    const termType = document.getElementById('custom-enrichment-term').value;
    const pValueCutoff = parseFloat(document.getElementById('custom-pvalue-cutoff').value);
    const N = ciliaData.length; // Total genes in background
    const n = userGenes.length; // Total genes in user list
    const backgroundCounts = backgroundTermCounts[termType];

    const userTermCounts = new Map();
    userGenes.forEach(gene => {
        getCleanArray(gene, termType).forEach(term => {
            userTermCounts.set(term, (userTermCounts.get(term) || 0) + 1);
        });
    });

    const results = [];
    for (const [term, k] of userTermCounts.entries()) {
        const K = backgroundCounts.get(term) || 0;
        if (K > 0) {
            const pValue = hypergeometricTest(k, n, K, N);
            if (pValue <= pValueCutoff) {
                const enrichment = (k / n) / (K / N);
                results.push({ term, pValue, enrichment, count: k });
            }
        }
    }

    if (results.length === 0) {
        container.innerHTML = `<p>No significant enrichment found for the given criteria.</p>`;
        return;
    }
    
    results.sort((a, b) => a.pValue - b.pValue); // Sort by p-value

    const plotData = [{
        x: results.map(r => r.enrichment),
        y: results.map(r => r.term),
        text: results.map(r => `Count: ${r.count}<br>p-value: ${r.pValue.toExponential(2)}`),
        mode: 'markers',
        marker: {
            size: results.map(r => Math.max(5, r.count * 3)),
            color: results.map(r => -Math.log10(r.pValue)),
            colorscale: 'Viridis',
            showscale: true,
            colorbar: { title: '-log10(p-value)' }
        }
    }];

    const layout = {
        title: document.getElementById('custom-title').value || `Enrichment Analysis: ${termType.replace('_', ' ')}`,
        xaxis: { title: 'Enrichment Score' },
        yaxis: { title: 'Term', automargin: true },
        height: Math.max(600, results.length * 30),
        margin: { l: 300 }
    };

    Plotly.newPlot(container, plotData, layout, { responsive: true });
}

// -----------------------------------------------------------------------------
// NEW PLOT: Balloon Plot
// -----------------------------------------------------------------------------
function renderBalloonPlot(userGenes, container) {
    const geneNames = userGenes.map(g => g.gene);
    const allCategories = [...new Set(userGenes.flatMap(g => getCleanArray(g, 'functional_category')))];

    if (allCategories.length === 0) {
        container.innerHTML = `<p>No functional categories found for the input genes.</p>`;
        return;
    }

    const x = [];
    const y = [];
    userGenes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            x.push(cat);
            y.push(gene.gene);
        });
    });

    const plotData = [{
        x: x,
        y: y,
        mode: 'markers',
        marker: {
            color: '#3f51b5',
            size: 15,
            symbol: 'circle'
        },
        type: 'scatter'
    }];
    
    const layout = {
        title: document.getElementById('custom-title').value || 'Gene to Functional Category Mapping',
        xaxis: { 
            title: 'Functional Category', 
            tickangle: -45, 
            automargin: true,
            categoryorder: 'array',
            categoryarray: allCategories
        },
        yaxis: { 
            title: 'Gene', 
            automargin: true,
            categoryorder: 'array',
            categoryarray: geneNames.reverse() // Display top to bottom
        },
        height: Math.max(600, geneNames.length * 25),
        margin: { b: 200, l: 150 }
    };
    
    Plotly.newPlot(container, plotData, layout, { responsive: true });
}

// -----------------------------------------------------------------------------
// EXISTING PLOT: Localization Dot Plot (Renamed from Bubble)
// -----------------------------------------------------------------------------
function renderLocalizationDotPlot(genes, container) {
    const plotData = [];
    genes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            plotData.push({ x: loc, y: gene.gene });
        });
    });
    
    if(plotData.length === 0) {
        container.innerHTML = `<p>No localization data found for these genes.</p>`;
        return;
    }
    
    const data = [{
        x: plotData.map(d => d.x),
        y: plotData.map(d => d.y),
        mode: 'markers',
        type: 'scatter',
        marker: { size: 12, color: '#3f51b5' },
    }];

    const layout = {
        title: document.getElementById('custom-title').value || 'Gene Subcellular Localizations',
        xaxis: { title: 'Localization', automargin: true },
        yaxis: { title: 'Gene', automargin: true },
        height: Math.max(600, new Set(plotData.map(d => d.y)).size * 30),
        margin: { l: 150, b: 100 }
    };
    Plotly.newPlot(container, data, layout, { responsive: true });
}

// -----------------------------------------------------------------------------
// EXISTING PLOT: Functional Bar Plot
// -----------------------------------------------------------------------------
function renderFunctionalBarPlot(genes, container) {
    const categoryCounts = new Map();
    genes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });

    if (categoryCounts.size === 0) {
        container.innerHTML = `<p>No functional categories found for these genes.</p>`;
        return;
    }
    
    const sorted = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
    const data = [{ 
        x: sorted.map(e => e[1]), 
        y: sorted.map(e => e[0]), 
        type: 'bar', 
        orientation: 'h', 
        marker: { color: '#4CAF50' } 
    }];
    
    const layout = {
        title: document.getElementById('custom-title').value || 'Functional Category Counts',
        xaxis: { title: 'Number of Genes' },
        yaxis: { automargin: true },
        height: Math.max(600, sorted.length * 30),
        margin: { l: 250 }
    };
    Plotly.newPlot(container, data, layout, { responsive: true });
}

// -----------------------------------------------------------------------------
// EXISTING PLOT: Protein Complex Network
// -----------------------------------------------------------------------------
function renderComplexNetwork(foundGenes, container) {
    const nodes = [];
    const nodeSet = new Set();
    const links = [];
    const linkSet = new Set();

    foundGenes.forEach(gene => {
        const components = getCleanArray(gene, 'complex_components');
        if (components.length > 1) {
            components.forEach(c => {
                if (!nodeSet.has(c)) {
                    nodes.push({ id: c, isInput: foundGenes.some(g => g.gene === c) });
                    nodeSet.add(c);
                }
            });

            for (let i = 0; i < components.length; i++) {
                for (let j = i + 1; j < components.length; j++) {
                    const key = [components[i], components[j]].sort().join('-');
                    if (!linkSet.has(key)) {
                        links.push({ source: components[i], target: components[j] });
                        linkSet.add(key);
                    }
                }
            }
        }
    });

    if (nodes.length === 0 || links.length === 0) {
        container.innerHTML = `<p>No protein complex data found for these genes.</p>`;
        return;
    }

    container.innerHTML = '';
    const width = container.clientWidth;
    const height = container.clientHeight;
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`);

    svg.append("g").append("text")
        .attr("x", width / 2).attr("y", 30)
        .attr("text-anchor", "middle").style("font-size", "20px")
        .text(document.getElementById('custom-title').value || 'Protein Complex Network');

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").attr("stroke", "#999").attr("stroke-opacity", 0.6)
        .selectAll("line").data(links).join("line");

    const node = svg.append("g").selectAll("g").data(nodes).join("g")
        .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    node.append("circle")
        .attr("r", d => d.isInput ? 10 : 6)
        .attr("fill", d => d.isInput ? "#e74c3c" : "#3498db");

    node.append("text").text(d => d.id).attr("x", 12).attr("y", 4).style("font-size", "12px");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }
}

// -----------------------------------------------------------------------------
// EXISTING PLOT: Screen Analysis Scatter Plot
// -----------------------------------------------------------------------------
function renderGeneScreenAnalysis(foundGenes, container) {
    const datasets = {};
    const classificationColors = {
        "Negative regulator": "#E74C3C",
        "Positive regulator": "#2ECC71",
        "No significant effect": "#3498DB",
        "Unclassified": "#95A5A6"
    };

    foundGenes.forEach(gene => {
        if (gene.screens && Array.isArray(gene.screens)) {
            gene.screens.forEach(screen => {
                const z = parseFloat(screen.z_score);
                if (!isNaN(z)) {
                    const datasetName = screen.dataset;
                    if (!datasets[datasetName]) {
                        datasets[datasetName] = {};
                    }
                    const classification = screen.classification || "Unclassified";
                    if (!datasets[datasetName][classification]) {
                        datasets[datasetName][classification] = [];
                    }
                    datasets[datasetName][classification].push({ x: gene.gene, y: z, paper: screen.paper_link });
                }
            });
        }
    });

    if (Object.keys(datasets).length === 0) {
        container.innerHTML = `<p>No quantitative screen data found for these genes.</p>`;
        return;
    }

    const plotData = [];
    for (const datasetName in datasets) {
        for (const classification in datasets[datasetName]) {
            const points = datasets[datasetName][classification];
            plotData.push({
                x: points.map(p => p.x),
                y: points.map(p => p.y),
                mode: 'markers',
                type: 'scatter',
                name: `${datasetName} - ${classification}`,
                marker: { size: 12, color: classificationColors[classification] },
                text: points.map(p => `Z-score: ${p.y.toFixed(2)}<br>Source: ${datasetName}`)
            });
        }
    }
    
    const layout = {
        title: document.getElementById('custom-title').value || 'Genome-Wide Screen Analysis',
        xaxis: { type: 'category', title: 'Gene', automargin: true },
        yaxis: { title: 'Z-score', zeroline: true, zerolinewidth: 2, zerolinecolor: '#999' },
        showlegend: true,
        height: 600
    };

    Plotly.newPlot(container, plotData, layout, { responsive: true });
}


// #############################################################################
// DOWNLOAD FUNCTIONALITY
// #############################################################################

/**
 * Handles the downloading of the currently displayed plot.
 */
async function downloadPlot() {
    const plotArea = document.getElementById('plot-display-area');
    const plotlyDiv = plotArea.querySelector('.js-plotly-plot');
    const canvas = plotArea.querySelector('canvas');
    const svg = plotArea.querySelector('svg');
    const format = document.getElementById('download-format').value || 'png';
    const fileName = `CiliaPlot_export_${new Date().toISOString().slice(0,10)}.${format}`;

    try {
        if (plotlyDiv) {
            await Plotly.downloadImage(plotArea, { format: format, width: 1200, height: 800, filename: fileName });
        } else if (canvas) {
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            if (format === 'png') {
                triggerDownload(dataUrl, fileName);
            } else if (format === 'pdf') {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] });
                pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(fileName);
            }
        } else if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);
            if (format === 'svg') {
                triggerDownload(url, fileName);
            } else { // PNG or PDF from SVG
                const img = new Image();
                img.onload = () => {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = svg.clientWidth * 2;
                    tempCanvas.height = svg.clientHeight * 2;
                    const ctx = tempCanvas.getContext('2d');
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
                    const pngUrl = tempCanvas.toDataURL('image/png');
                    if (format === 'png') {
                        triggerDownload(pngUrl, fileName);
                    } else if (format === 'pdf') {
                         const { jsPDF } = window.jspdf;
                         const pdf = new jsPDF({ orientation: tempCanvas.width > tempCanvas.height ? 'l' : 'p', unit: 'px', format: [tempCanvas.width, tempCanvas.height] });
                         pdf.addImage(pngUrl, 'PNG', 0, 0, tempCanvas.width, tempCanvas.height);
                         pdf.save(fileName);
                    }
                    URL.revokeObjectURL(url);
                };
                img.src = url;
            }
        } else {
            throw new Error("No plot found to download.");
        }
    } catch (e) {
        console.error("Download failed:", e);
        alert(`An error occurred during download: ${e.message}`);
    }
}

function triggerDownload(href, fileName) {
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
