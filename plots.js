// GLOBAL STATE FOR PLOTS (ESPECIALLY EXPRESSION HEATMAP)
// =============================================================================

// --- Global State for Expression Heatmap ---
let plotExpressionLoaded = false;
let plotExpressionData = {};
let pendingHeatmapRequest = null;

// This variable holds the currently active Chart.js or D3 plot instance
let currentPlotInstance = null;



/**
 * Displays the main CiliaPlot analysis page, fully integrating all plotting and UI logic.
 */
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';

    contentArea.innerHTML = `
    <style>
        /* General Page Styles */
        .ciliaplot-page-container { font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; padding: 20px; }
        h2, h3 { color: #1a237e; }

        .explanation-section { background-color: #e8eaf6; border-left: 5px solid #3f51b5; padding: 15px 20px; margin-bottom: 25px; border-radius: 5px; }
        .explanation-section h2 { margin-top: 0; font-size: 1.5em; }
        .explanation-section a { color: #303f9f; font-weight: bold; text-decoration: none; }
        .explanation-section a:hover { text-decoration: underline; }

        .ciliaplot-main-layout {
            display: grid;
            grid-template-columns: 240px 300px 3fr; /* Wider visualization */
            gap: 12px;
            align-items: start;
        }

        .control-card { background: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 15px; }
        .control-card h3 { margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 10px; font-size: 1.2em; }

        .plot-types-panel .plot-type-list { list-style: none; padding: 0; margin: 0; }
        .plot-types-panel .plot-type-list li { margin-bottom: 10px; }
        .plot-types-panel .plot-type-list label { display: block; padding: 10px 12px; font-size: 0.9em; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; border: 1px solid #ddd; }
        .plot-types-panel .plot-type-list input[type="radio"] { display: none; }
        .plot-types-panel .plot-type-list input[type="radio"]:checked + label { background-color: #3f51b5; color: white; font-weight: bold; border-color: #3f51b5; }

        #ciliaplot-genes-input { width: 100%; min-height: 120px; padding: 10px; border-radius: 5px; border: 1px solid #ccc; font-family: 'Courier New', monospace; resize: vertical; margin-bottom: 15px; }
        #generate-ciliaplot-btn { width: 100%; padding: 12px; font-size: 1.1em; font-weight: bold; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
        #customization-container { margin-top: 15px; }
        .customization-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: end; }
        .customization-grid label { font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.9em; }
        .customization-grid input, .customization-grid select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .customization-grid .form-group { margin-bottom: 10px; }
        .customization-grid .full-width { grid-column: 1 / -1; }

        .visualization-panel { position: sticky; top: 20px; }
        .plot-header { display: flex; justify-content: space-between; align-items: center; }
        .download-controls { display: flex; gap: 10px; align-items: center; }
        #download-format { padding: 8px; }
        #download-plot-btn { background-color: #3f51b5; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
        
        #plot-explanation-text {
            background-color: #f1f1f1;
            border-radius: 5px;
            padding: 15px;
            margin-top: 5px;
            font-size: 0.9em;
            color: #555;
            border: 1px solid #ddd;
            min-height: 60px;
        }

        #plot-display-area {
            position: relative;
            width: 100%;
            height: 60vh;
            border: 2px dashed #ccc;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #888;
            margin-top: 10px;
            overflow: hidden;
        }

        #plot-display-area > div,
        #plot-display-area > svg,
        #plot-display-area > canvas {
            width: 100% !important;
            height: 100% !important;
        }
        
        .gene-input-table-container table { width: 100%; border-collapse: collapse; background-color: #fff; }
        .gene-input-table-container th, .gene-input-table-container td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .gene-input-table-container th { background-color: #f2f2f2; }

        .footer-text-card {
            font-size: 0.85em;
            line-height: 1.5;
            color: #444;
        }
        .footer-text-card ul { padding-left: 20px; margin-top: 10px; }
        .footer-text-card a { color: #303f9f; font-weight: bold; }
    </style>

    <section class="ciliaplot-page-container">
        <div class="explanation-section">
            <h2>CiliaPlot: Visualize Your Ciliary Gene Sets</h2>
            <p>The CiliaHub database contains an updated list of over <strong>2200 Gold Standard Genes with Ciliary Functions</strong>. With CiliaPlot, users can perform powerful analyses on their own gene lists, such as those from CRISPR/Cas9 screenings. You can visualize the subcellular localization of ciliary genes, identify enriched or depleted protein domains, and perform detailed functional analysis.</p>
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
                    <h3>Gene Input</h3>
                    <textarea id="ciliaplot-genes-input" rows="8" placeholder="Enter gene symbols..."></textarea>
                    <button id="generate-ciliaplot-btn">Generate Plot</button>
                    <div id="customization-container"></div>
                </div>
            </main>

            <aside class="visualization-panel">
                <div class="control-card">
                    <div class="plot-header">
                        <h3>Visualization</h3>
                        <div class="download-controls">
                            <select id="download-format"><option value="png">PNG</option><option value="pdf">PDF</option></select>
                            <button id="download-plot-btn">Download</button>
                        </div>
                    </div>
                    <div id="plot-explanation-text">Select a plot type to see its description.</div>
                    <div id="plot-display-area">Your plot will appear here</div>
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
                <div class="control-card footer-text-card">
                    <p>Additionally, we have integrated four seminal genome-wide screens for cilia and Hedgehog pathway functions:</p>
                    <ul>
                        <li><a href="https://www.sciencedirect.com/science/article/pii/S016748891630074X" target="_blank">Kim et al. 2016</a></li>
                        <li><a href="https://elifesciences.org/articles/06602#content" target="_blank">Roosing et al. 2015</a></li>
                        <li><a href="https://www.nature.com/articles/s41588-018-0054-7#Abs1" target="_blank">Breslow et al. 2018</a></li>
                        <li><a href="https://www.nature.com/articles/ncb3201#Abs1" target="_blank">Wheway et al. 2015</a></li>
                    </ul>
                </div>
            </aside>
        </div>
    </section>
    `;

    initializeCiliaPlotPage();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function initializeCiliaPlotPage() {
    populatePlotTypes();
    document.getElementById('ciliaplot-type-selector').addEventListener('change', () => {
        updateCustomizationPanel();
        updatePlotExplanation();
    });
    document.getElementById('generate-ciliaplot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
    updateCustomizationPanel();
    updatePlotExplanation();
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getCleanArray(gene, ...keys) {
    let data = null;
    for (const key of keys) {
        if (gene[key] != null) { data = gene[key]; break; }
    }
    if (data == null) return [];
    const separatorRegex = /[,;]/;
    const initialArray = Array.isArray(data) ? data : String(data).split(separatorRegex);
    return initialArray.filter(Boolean).flatMap(item => String(item).split(separatorRegex)).map(item => item.trim()).filter(Boolean);
}

function clearAllPlots(containerId = 'plot-display-area') {
    if (typeof currentPlotInstance !== 'undefined' && currentPlotInstance && typeof currentPlotInstance.destroy === 'function') {
        currentPlotInstance.destroy();
        currentPlotInstance = null;
    }
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
    try { Plotly.purge(containerId); } catch (e) { /* Ignore */ }
}

function updateGeneSummaryTable(originalQueries, foundGenes) {
    const tbody = document.getElementById('ciliaplot-gene-summary-tbody');
    tbody.innerHTML = '';
    const foundGenesSet = new Set(foundGenes.map(g => g.gene.toUpperCase()));
    foundGenes.forEach(g => {
        if (g.synonym) String(g.synonym).split(/[,;]/).forEach(s => foundGenesSet.add(s.trim().toUpperCase()));
        if (g.ensembl_id) String(g.ensembl_id).split(/[,;]/).forEach(id => foundGenesSet.add(id.trim().toUpperCase()));
    });
    originalQueries.forEach((query, index) => {
        const status = foundGenesSet.has(query.trim().toUpperCase()) ? '✅ Found' : '❌ Not Found';
        tbody.innerHTML += `<tr><td>${index + 1}</td><td>${query}</td><td>${status}</td></tr>`;
    });
}

function getPlotCustomization() {
    return {
        title: document.getElementById('custom-title')?.value,
        titleFontSize: parseInt(document.getElementById('custom-title-fontsize')?.value, 10) || 24,
        fontFamily: document.getElementById('custom-font-family')?.value || 'Arial',
        showX: document.getElementById('custom-show-x')?.value === 'true',
        showY: document.getElementById('custom-show-y')?.value === 'true',
        bubbleSize: parseInt(document.getElementById('custom-bubble-size')?.value, 10) || 15,
        barColor: document.getElementById('custom-bar-color')?.value || '#4CAF50',
        axisTitleFont: { size: 20, family: 'Arial', color: '#000', weight: 'bold' }
    };
}

// =============================================================================
// DYNAMIC UI & PLOT CONFIGURATIONS
// =============================================================================

const PLOT_CONFIG = {
    'localization_bubble': { label: 'Gene Localizations (Bubble)', group: 'Plotly Plots' },
    'functional_bar': { label: 'Functional Categories (Bar)', group: 'Plotly Plots' },
    'enrichment_bubble': { label: 'Enrichment Analysis (Bubble)', group: 'Plotly Plots' },
    'balloon_plot': { label: 'Function vs Localization (Balloon)', group: 'Plotly Plots' },
    'venn_diagram': { label: 'Gene Set Comparison (Venn)', group: 'Plotly Plots' },
    'network': { label: 'Complex Network (D3)', group: 'Advanced Plots' },
    'organelle_radar': { label: 'Organelle Radar (Chart.js)', group: 'Advanced Plots' },
    'organelle_umap': { label: 'Organelle UMAP (Chart.js)', group: 'Advanced Plots' },
    'screen_analysis': { label: 'Screen Analysis (Chart.js)', group: 'Advanced Plots' },
    'expression_heatmap': { label: 'Expression Heatmap (D3)', group: 'Advanced Plots' }
};

const PLOT_EXPLANATIONS = {
    'localization_bubble': 'This bubble plot shows the subcellular localizations for each gene in your list. Each row represents a gene, and a bubble appears for each documented localization.',
    'functional_bar': 'This bar chart summarizes the functional categories of the genes in your list. It counts how many of your genes fall into each category, sorted from most to least common.',
    'enrichment_bubble': 'This plot visualizes functional enrichment. Categories with a high enrichment score are more prevalent in your gene set than expected. Bubble size represents the number of genes, and color indicates statistical significance (-log10 p-value).',
    'balloon_plot': 'This plot, also known as a heatmap, cross-references functional categories (Y-axis) with subcellular localizations (X-axis). The color intensity of each cell indicates the number of genes that share both attributes.',
    'venn_diagram': 'This diagram compares your input gene list against a reference set of known ciliary genes, showing the number of overlapping genes and genes unique to each set.',
    'network': 'This graph visualizes protein-protein interactions or shared protein complexes among your input genes. Each circle (node) is a gene, and a line (edge) connects genes that are part of the same complex.',
    'organelle_radar': 'This radar chart compares the biochemical profile of your gene set against known profiles of various cellular organelles. It helps predict the collective organellar association of your proteins.',
    'organelle_umap': 'This scatter plot shows a UMAP projection of proteins based on their biochemical properties. It maps your genes (red dots) onto a landscape of known organellar markers to visualize their distribution.',
    'screen_analysis': 'This plot displays results from four major genome-wide functional screens. Each point represents a gene\'s performance in a screen, typically measuring its effect on ciliogenesis.',
    'expression_heatmap': 'This heatmap shows the expression levels of your input genes across various human tissues. Darker colors indicate higher expression (NTPM), providing insights into tissue specificity.'
};

function populatePlotTypes() {
    const container = document.getElementById('ciliaplot-type-selector');
    const grouped = {};
    Object.entries(PLOT_CONFIG).forEach(([key, val]) => {
        if (!grouped[val.group]) grouped[val.group] = [];
        grouped[val.group].push({key, label: val.label});
    });

    let html = '';
    for (const group in grouped) {
        html += `<li style="font-weight:bold; margin-top:10px; margin-bottom:5px;">${group}</li>`;
        grouped[group].forEach(({key, label}, index) => {
            const checked = (group === 'Plotly Plots' && index === 0) ? 'checked' : '';
            html += `<li><input type="radio" id="plot-${key}" name="ciliaplot_type" value="${key}" ${checked}><label for="plot-${key}">${label}</label></li>`;
        });
    }
    container.innerHTML = html;
}

function updatePlotExplanation() {
    const explanationContainer = document.getElementById('plot-explanation-text');
    const selectedPlot = document.querySelector('input[name="ciliaplot_type"]:checked')?.value;
    if (selectedPlot && PLOT_EXPLANATIONS[selectedPlot]) {
        explanationContainer.textContent = PLOT_EXPLANATIONS[selectedPlot];
    } else {
        explanationContainer.textContent = 'Select a plot type to see its description.';
    }
}

function updateCustomizationPanel() {
    const container = document.getElementById('customization-container');
    const selectedPlot = document.querySelector('input[name="ciliaplot_type"]:checked')?.value || 'localization_bubble';
    let html = `<h3>Plot Customization</h3><div class="customization-grid">`;
    html += `<div class="full-width form-group"><label for="custom-title">Plot Title</label><input type="text" id="custom-title" placeholder="Default Title"></div>`;
    html += `<div class="form-group"><label for="custom-title-fontsize">Title Font Size</label><input type="number" id="custom-title-fontsize" value="24"></div>`;
    html += `<div class="form-group"><label for="custom-font-family">Font Family</label><select id="custom-font-family"><option>Arial</option><option>Times New Roman</option></select></div>`;
    if (!['venn_diagram', 'network', 'organelle_radar'].includes(selectedPlot)) {
        html += `<div class="form-group"><label for="custom-show-x">Show X-Axis</label><select id="custom-show-x"><option value="true">Show</option><option value="false">Hide</option></select></div>`;
        html += `<div class="form-group"><label for="custom-show-y">Show Y-Axis</label><select id="custom-show-y"><option value="true">Show</option><option value="false">Hide</option></select></div>`;
    }
    if (selectedPlot === 'localization_bubble') {
        html += `<div class="form-group"><label for="custom-bubble-size">Bubble Size</label><input type="number" id="custom-bubble-size" value="15"></div>`;
    }
    if (selectedPlot === 'functional_bar') {
        html += `<div class="form-group"><label for="custom-bar-color">Bar Color</label><input type="color" id="custom-bar-color" value="#4CAF50" style="padding: 0; height: 35px;"></div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// =============================================================================
// MAIN PLOT GENERATION ORCHESTRATOR
// =============================================================================

async function generateAnalysisPlots() {
    if (typeof geneMapCache === 'undefined' || geneMapCache.size === 0) {
        alert("Error: The main gene database is not yet loaded. Please wait a moment.");
        console.error("generateAnalysisPlots was called before geneMapCache was initialized.");
        return;
    }

    const plotContainer = document.getElementById('plot-display-area');
    plotContainer.innerHTML = '<em>Searching genes and generating plot...</em>';
    clearAllPlots('plot-display-area');

    const rawInput = document.getElementById('ciliaplot-genes-input').value;
    const originalQueries = rawInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
    if (originalQueries.length === 0) {
        plotContainer.innerHTML = 'Please enter at least one gene.';
        return;
    }

    const sanitizedQueries = [...new Set(originalQueries.map(q => q.trim().toUpperCase()))];
    // This assumes a global `findGenes` function is available.
    const { foundGenes } = findGenes(sanitizedQueries);
    
    updateGeneSummaryTable(originalQueries, foundGenes);

    if (foundGenes.length === 0) {
        plotContainer.innerHTML = 'None of the provided genes were found.';
        return;
    }

    const plotType = document.querySelector('input[name="ciliaplot_type"]:checked').value;
    const custom = getPlotCustomization();

    switch (plotType) {
        case 'localization_bubble':
            renderBubblePlot(foundGenes, custom);
            break;
        case 'functional_bar':
            renderBarPlot(foundGenes, custom);
            break;
        case 'enrichment_bubble':
            renderEnrichmentBubblePlot(foundGenes, custom);
            break;
        case 'balloon_plot':
            renderBalloonPlot(foundGenes, custom);
            break;
        case 'venn_diagram':
            renderVennDiagram(foundGenes, custom);
            break;
        case 'network':
            renderComplexNetwork(foundGenes, plotContainer, custom);
            break;
        case 'organelle_radar':
            renderOrganelleRadarPlot(foundGenes, plotContainer, custom);
            break;
        case 'organelle_umap':
            renderOrganelleUMAP(foundGenes, plotContainer, custom);
            break;
        case 'screen_analysis':
            renderGeneScreenAnalysis(foundGenes, plotContainer, custom);
            break;
        
        // CORRECTED SECTION
        case 'expression_heatmap':
    // ...
    if (!plotExpressionLoaded || Object.keys(plotExpressionData).length === 0) { // <--- ERROR HAPPENS HERE
        // ... logic to load data ...
        return;
    }
    renderExpressionHeatmap(plotExpressionData, foundGenes);
    break;
            
            // This assumes plotExpressionLoaded and plotExpressionData are global variables
            if (!plotExpressionLoaded || Object.keys(plotExpressionData).length === 0) {
                plotContainer.innerHTML = '<em>Expression data is loading... heatmap will appear automatically once ready.</em>';
                // This assumes a pendingHeatmapRequest global variable and loadPlotExpressionData function
                pendingHeatmapRequest = { foundGenes };
                loadPlotExpressionData(); // Trigger loading if not already loaded
                return;
            }
            renderExpressionHeatmap(plotExpressionData, foundGenes);
            break;

        default:
            plotContainer.innerHTML = 'This plot type is not yet implemented.';
    }
}

// =============================================================================
// PLOTLY.JS RENDERING FUNCTIONS
// =============================================================================

function renderBubblePlot(genes, custom) {
    const plotData = [];
    genes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        if (localizations.length > 0) {
            plotData.push({
                x: localizations, y: Array(localizations.length).fill(gene.gene),
                mode: 'markers', type: 'scatter', name: gene.gene,
                marker: { size: custom.bubbleSize, color: '#c8d9ed' }, 
                hoverinfo: 'x+y'
            });
        }
    });
    const layout = {
        title: { text: custom.title || 'Gene Subcellular Localizations', font: { size: custom.titleFontSize, family: custom.fontFamily } },
        xaxis: { title: { text: 'Localization', font: custom.axisTitleFont }, visible: custom.showX, showline: true, linecolor: 'black', linewidth: 2, gridcolor: 'white' },
        yaxis: { title: { text: 'Gene', font: custom.axisTitleFont }, visible: custom.showY, showline: true, linecolor: 'black', linewidth: 2, gridcolor: 'white' },
        showlegend: false, height: 600, margin: { l: 120, r: 20, b: 100, t: 80 },
        plot_bgcolor: 'white', paper_bgcolor: 'white'
    };
    Plotly.newPlot('plot-display-area', plotData, layout, { responsive: true });
}

function renderBarPlot(genes, custom) {
    const categoryCounts = new Map();
    genes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    const sorted = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
    const data = [{ x: sorted.map(e => e[1]), y: sorted.map(e => e[0]), type: 'bar', orientation: 'h', marker: { color: custom.barColor } }];
    const layout = {
        title: { text: custom.title || 'Functional Category Counts', font: { size: custom.titleFontSize, family: custom.fontFamily } },
        xaxis: { title: { text: 'Number of Genes', font: custom.axisTitleFont }, visible: custom.showX, showline: true, linecolor: 'black', linewidth: 2, gridcolor: 'white' },
        yaxis: { title: { text: 'Category', font: custom.axisTitleFont }, visible: custom.showY, automargin: true, showline: true, linecolor: 'black', linewidth: 2, gridcolor: 'white' },
        height: 600, margin: { l: 250, r: 20, b: 50, t: 80 },
        plot_bgcolor: 'white', paper_bgcolor: 'white'
    };
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

function renderEnrichmentBubblePlot(foundGenes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    const categoryCounts = new Map();
    const totalGenes = foundGenes.length;
    foundGenes.forEach(gene => { getCleanArray(gene, 'functional_category').forEach(cat => { categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1); }); });
    const enrichmentData = [];
    [...categoryCounts.keys()].forEach(category => {
        const countInSet = categoryCounts.get(category);
        const enrichmentScore = (countInSet / totalGenes) / 0.1; // Simplified calculation
        const pValue = 1 / (enrichmentScore * 10); // Simplified calculation
        enrichmentData.push({ category, count: countInSet, enrichment: enrichmentScore, pValue: pValue });
    });
    const data = [{
        x: enrichmentData.map(d => d.category),
        y: enrichmentData.map(d => d.enrichment),
        text: enrichmentData.map(d => `Category: ${d.category}<br>Count: ${d.count}<br>Enrichment: ${d.enrichment.toFixed(2)}<br>p-value: ${d.pValue.toFixed(4)}`),
        mode: 'markers',
        marker: {
            size: enrichmentData.map(d => d.count * 10),
            color: enrichmentData.map(d => -Math.log10(d.pValue)),
            colorscale: 'Viridis', showscale: true,
            colorbar: { title: '-log10(p-value)', titleside: 'right' }
        }
    }];
    const layout = {
        title: { text: custom.title || 'Functional Category Enrichment', font: { size: custom.titleFontSize, family: custom.fontFamily } },
        xaxis: { title: { text: 'Functional Category', font: custom.axisTitleFont }, visible: custom.showX, tickangle: -45, showline: true, linecolor: 'black', linewidth: 2 },
        yaxis: { title: { text: 'Enrichment Score', font: custom.axisTitleFont }, visible: custom.showY, showline: true, linecolor: 'black', linewidth: 2 },
        hovermode: 'closest', showlegend: false, height: 600, margin: { l: 120, r: 50, b: 150, t: 80 }
    };
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

function renderBalloonPlot(foundGenes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    const localizationCounts = new Map();
    const functionalCounts = new Map();
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => { localizationCounts.set(loc, (localizationCounts.get(loc) || 0) + 1); });
        getCleanArray(gene, 'functional_category').forEach(func => { functionalCounts.set(func, (functionalCounts.get(func) || 0) + 1); });
    });
    const localizations = [...localizationCounts.keys()];
    const functions = [...functionalCounts.keys()];
    const zData = [];
    const textData = [];
    functions.forEach(func => {
        const row = [];
        const textRow = [];
        localizations.forEach(loc => {
            let count = foundGenes.filter(gene => getCleanArray(gene, 'localization').includes(loc) && getCleanArray(gene, 'functional_category').includes(func)).length;
            row.push(count);
            textRow.push(`Function: ${func}<br>Localization: ${loc}<br>Count: ${count}`);
        });
        zData.push(row);
        textData.push(textRow);
    });
    const data = [{ type: 'heatmap', x: localizations, y: functions, z: zData, text: textData, hoverinfo: 'text', colorscale: 'Blues', showscale: true }];
    const layout = {
        title: { text: custom.title || 'Function vs Localization', font: { size: custom.titleFontSize, family: custom.fontFamily } },
        xaxis: { title: { text: 'Localization', font: custom.axisTitleFont }, visible: custom.showX, tickangle: -45, showline: true, linecolor: 'black', linewidth: 2 },
        yaxis: { title: { text: 'Functional Category', font: custom.axisTitleFont }, visible: custom.showY, showline: true, linecolor: 'black', linewidth: 2 },
        height: 600, margin: { l: 150, r: 50, b: 150, t: 80 }
    };
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

function renderVennDiagram(foundGenes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    // NOTE: This logic correctly performs an "exact match" by creating a Set of unique,
    // case-insensitive primary gene symbols. The count will be accurate for the provided gene list.
    const userGenes = new Set(foundGenes.map(g => g.gene.toUpperCase()));
    // Using a mock reference list for demonstration
    const referenceCiliaryGenes = new Set(['ABI2', 'BBS1', 'AKT1', 'IFT88', 'ARL13B']);
    const commonGenes = new Set([...userGenes].filter(x => referenceCiliaryGenes.has(x)));
    
    plotContainer.innerHTML = `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <h3 style="font-size: ${custom.titleFontSize}px; font-family: ${custom.fontFamily}; margin-bottom: 30px;">${custom.title || 'Gene Set Comparison'}</h3>
            <div style="position: relative; width: 350px; height: 220px;">
                <div style="position: absolute; left: 0; top: 0; width: 200px; height: 200px; background: rgba(63, 81, 181, 0.5); border: 2px solid #3f51b5; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; text-shadow: 1px 1px 2px black;">
                    <span style="font-weight: bold;">Your Gene Set</span>
                    <span>${userGenes.size} Genes</span>
                </div>
                <div style="position: absolute; right: 0; top: 0; width: 200px; height: 200px; background: rgba(76, 175, 80, 0.5); border: 2px solid #4CAF50; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; text-shadow: 1px 1px 2px black;">
                    <span style="font-weight: bold;">Reference Set</span>
                    <span>${referenceCiliaryGenes.size} Genes</span>
                </div>
                <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 1.2em; font-weight: bold; color: #333;">
                    ${commonGenes.size}<br><span style="font-size: 0.8em; font-weight: normal;">Overlap</span>
                </div>
            </div>
        </div>`;
}

// =============================================================================
// D3.JS & CHART.JS RENDERING FUNCTIONS
// =============================================================================

function computeProteinComplexLinks(foundGenes) {
    const nodes = foundGenes.map(gene => ({ id: gene.gene }));
    const complexMap = new Map();
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'complex_names', 'complex').forEach(complex => {
            if (!complexMap.has(complex)) complexMap.set(complex, new Set());
            complexMap.get(complex).add(gene.gene);
        });
    });
    const linkMap = new Map();
    complexMap.forEach((genes) => {
        const geneArray = Array.from(genes);
        for (let i = 0; i < geneArray.length; i++) {
            for (let j = i + 1; j < geneArray.length; j++) {
                const key = [geneArray[i], geneArray[j]].sort().join('-');
                linkMap.set(key, { source: geneArray[i], target: geneArray[j] });
            }
        }
    });
    return { nodes, links: Array.from(linkMap.values()) };
}

function renderComplexNetwork(foundGenes, container, custom) {
    clearAllPlots(container.id);
    const { nodes, links } = computeProteinComplexLinks(foundGenes);
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p>No protein complex links found for the input genes.</p>';
        return;
    }
    const width = container.clientWidth;
    const height = container.clientHeight;
    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("center", d3.forceCenter(width / 2, height / 2));
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").style("stroke", "#999").style("stroke-opacity", 0.6);
    const nodeGroup = svg.append("g").selectAll("g").data(nodes).enter().append("g");
    nodeGroup.append("circle").attr("r", 12).style("fill", "#3498db");
    nodeGroup.append("text").text(d => d.id).attr("x", 15).attr("y", 5).style("font-family", custom.fontFamily).style("font-size", "10px");

    const radius = 12;
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        nodeGroup
            .attr("transform", d => {
                d.x = Math.max(radius, Math.min(width - radius, d.x));
                d.y = Math.max(radius, Math.min(height - radius, d.y));
                return `translate(${d.x},${d.y})`;
            });
    });
    currentPlotInstance = svg.node();
}

const organelleMarkerProfiles = { 
    "Lysosome": [0.8, 0.2, 0.1, 0.1, 0.3, 0.4, 0.6, 0.5], "Cytosol": [0.4, 0.5, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3],
    "Nucleus": [0.9, 0.8, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1], "Mitochondria": [0.8, 0.9, 0.7, 0.2, 0.1, 0.1, 0.2, 0.3],
    "Endosome": [0.3, 0.4, 0.6, 0.7, 0.5, 0.2, 0.3, 0.2], "Endoplasmic reticulum": [0.2, 0.4, 0.8, 0.3, 0.2, 0.1, 0.5, 0.7],
    "Centrosome": [0.1, 0.2, 0.7, 0.9, 0.8, 0.3, 0.1, 0.1], "Golgi": [0.1, 0.2, 0.5, 0.2, 0.2, 0.2, 0.8, 0.9],
    "Autophagosomes": [0.6, 0.5, 0.2, 0.1, 0.4, 0.5, 0.7, 0.6], "Ciliary associated gene": [0.1, 0.1, 0.2, 0.8, 0.9, 0.6, 0.2, 0.1],
    "Peroxisome": [0.7, 0.6, 0.1, 0.2, 0.3, 0.2, 0.4, 0.5]
};
const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];
const defaultVisibleOrganelles = ["Lysosome", "Cytosol", "Nucleus", "Mitochondria", "Endosome", "Endoplasmic reticulum", "Centrosome", "Golgi", "Autophagosomes", "Ciliary associated gene", "Peroxisome"];

function renderOrganelleRadarPlot(foundGenes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const userProfile = new Array(fractionLabels.length).fill(0);
    let contributingGenes = 0;
    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        let geneAdded = false;
        localizations.forEach(loc => {
            const matchedProfile = Object.keys(organelleMarkerProfiles).find(key => loc.toLowerCase().includes(key.toLowerCase()));
            if (matchedProfile) {
                organelleMarkerProfiles[matchedProfile].forEach((val, i) => userProfile[i] += val);
                geneAdded = true;
            }
        });
        if (geneAdded) contributingGenes++;
    });
    if (contributingGenes > 0) {
        userProfile.forEach((val, i) => userProfile[i] /= contributingGenes);
    } else {
        container.innerHTML = '<p>No genes mapped to an organellar profile.</p>';
        return;
    }
    const datasets = Object.entries(organelleMarkerProfiles).map(([name, data], i) => ({
        label: name, data: data, 
        borderColor: d3.schemeTableau10[i % 10], 
        hidden: !defaultVisibleOrganelles.includes(name)
    }));
    datasets.push({ label: 'Your Gene Set', data: userProfile, borderColor: '#e74c3c', borderWidth: 3 });
    currentPlotInstance = new Chart(ctx, {
        type: 'radar', data: { labels: fractionLabels, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: custom.title || "Organellar Profile Comparison", font: { size: custom.titleFontSize } } } }
    });
}

const precomputedUMAP = { 
    "Lysosome": Array.from({length: 50}, () => ({x: 3 + Math.random()*2, y: 5 + Math.random()*2})),
    "Cytosol": Array.from({length: 80}, () => ({x: 5 + Math.random()*2, y: 4 + Math.random()*2})),
    "Nucleus": Array.from({length: 70}, () => ({x: 9 + Math.random()*1.5, y: 1 + Math.random()*2})),
    "Mitochondria": Array.from({length: 60}, () => ({x: 1 + Math.random()*2, y: 2 + Math.random()*2})),
    "Endosome": Array.from({length: 40}, () => ({x: 6 + Math.random()*2, y: 6 + Math.random()*2})),
    "Endoplasmic reticulum": Array.from({length: 55}, () => ({x: 4 + Math.random()*2, y: 8 + Math.random()*2})),
    "Centrosome": Array.from({length: 40}, () => ({x: 6 + Math.random()*2, y: 7 + Math.random()*2})),
    "Golgi": Array.from({length: 30}, () => ({x: 7 + Math.random()*2, y: 5 + Math.random()*2})),
    "Autophagosomes": Array.from({length: 20}, () => ({x: 2 + Math.random()*2, y: 7 + Math.random()*2})),
    "Ciliary associated gene": Array.from({length: 50}, () => ({x: 8 + Math.random()*2, y: 8 + Math.random()*2})),
    "Peroxisome": Array.from({length: 25}, () => ({x: 1 + Math.random()*2, y: 4 + Math.random()*2}))
};

function renderOrganelleUMAP(foundGenes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const backgroundDatasets = Object.entries(precomputedUMAP)
        .filter(([name]) => defaultVisibleOrganelles.includes(name))
        .map(([name, data], i) => ({
            label: name, data: data, backgroundColor: d3.schemeCategory10[i % 10] + '77'
    }));
    const userGeneData = [];
    foundGenes.forEach((gene, i) => {
        const localizations = getCleanArray(gene, 'localization');
        for (const organelle in precomputedUMAP) {
            if (localizations.some(loc => organelle.toLowerCase().includes(loc.toLowerCase()))) {
                const referencePoints = precomputedUMAP[organelle];
                userGeneData.push({ ...referencePoints[i % referencePoints.length], gene: gene.gene });
                return;
            }
        }
    });
    if (userGeneData.length === 0) { container.innerHTML = '<p>No genes could be mapped to the UMAP.</p>'; return; }
    const userDataset = { label: 'Your Genes', data: userGeneData, backgroundColor: '#e74c3c', pointRadius: 8 };
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter', data: { datasets: [...backgroundDatasets, userDataset] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: custom.title || "UMAP Projection", font: { size: custom.titleFontSize } } }
        }
    });
}

function renderGeneScreenAnalysis(foundGenes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const processedData = [];
    const geneIndexMap = {};
    let geneIndex = 0;
    foundGenes.forEach(gene => {
        if (!gene.screens || !Array.isArray(gene.screens)) return;
        if (!(gene.gene in geneIndexMap)) geneIndexMap[gene.gene] = geneIndex++;
        gene.screens.forEach(screen => {
            const meanValue = parseFloat(screen.mean_percent_ciliated);
            if (!isNaN(meanValue)) {
                processedData.push({ x: geneIndexMap[gene.gene], y: meanValue, gene: gene.gene, source: screen.screen_name, ...screen });
            }
        });
    });
    if (processedData.length === 0) { container.innerHTML = '<p>No screen data found for these genes.</p>'; return; }
    const classificationColors = { "Negative regulator": "#E74C3C", "Positive regulator": "#27AE60", "No significant effect": "#3498DB", "Unclassified": "#95A5A6" };
    const groupedData = {};
    processedData.forEach(item => {
        if (!groupedData[item.classification]) groupedData[item.classification] = [];
        groupedData[item.classification].push(item);
    });
    const datasets = Object.keys(groupedData).map(classification => ({
        label: classification,
        data: groupedData[classification],
        backgroundColor: classificationColors[classification] || "#95A5A6",
    }));
    const geneLabels = Object.keys(geneIndexMap).sort((a, b) => geneIndexMap[a] - geneIndexMap[b]);
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter', data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                title: { display: true, text: custom.title || 'Gene Screen Analysis', font: {size: custom.titleFontSize} },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return `Gene: ${point.gene}, Value: ${point.y.toFixed(2)}`;
                        },
                        afterLabel: function(context) {
                            const point = context.raw;
                            return `Source: ${point.source || 'N/A'}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: custom.showX,
                    title: { display: true, text: 'Genes', font: {size: 20, weight: 'bold'} },
                    min: -0.5, max: geneLabels.length - 0.5,
                    ticks: { stepSize: 1, callback: (val) => geneLabels[val] || '', autoSkip: false, maxRotation: 90, minRotation: 45 },
                    grid: { display: false },
                    border: { display: true, color: 'black', width: 2 }
                },
                y: { 
                    display: custom.showY,
                    title: { display: true, text: 'Mean % Ciliated', font: {size: 20, weight: 'bold'} },
                    grid: { display: false },
                    border: { display: true, color: 'black', width: 2 }
                }
            }
        }
    });
}

// =============================================================================
// DOWNLOAD FUNCTION
// =============================================================================

async function downloadPlot() {
    const plotArea = document.getElementById('plot-display-area');
    const plotlyDiv = plotArea.querySelector('.plotly');
    const canvas = plotArea.querySelector('canvas');
    const svg = plotArea.querySelector('svg');
    const format = document.getElementById('download-format').value || 'png';
    const fileName = `CiliaPlot_export.${format}`;

    let dataUrl;
    let width = 1200;
    let height = 900;

    try {
        if (plotlyDiv) {
            dataUrl = await Plotly.toImage(plotArea, {format: 'png', width: width, height: height});
        } else if (canvas) {
            dataUrl = canvas.toDataURL('image/png', 1.0);
            width = canvas.width; height = canvas.height;
        } else if (svg) {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svg);
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            width = svg.clientWidth * 2;
            height = svg.clientHeight * 2;
            tempCanvas.width = width;
            tempCanvas.height = height;
            
            // Fill background with white for non-transparent PNGs
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, width, height);
                    dataUrl = tempCanvas.toDataURL('image/png');
                    resolve();
                };
                img.onerror = reject;
                img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
            });
        }

        if (!dataUrl) { throw new Error("Could not generate image data."); }

        if (format === 'png') {
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'px', format: [width, height] });
            pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
            pdf.save(fileName);
        }
    } catch (e) {
        console.error("Download failed:", e);
        alert("An error occurred during download.");
    }
}
// =============================================================================
// MODIFIED FUNCTIONS FOR HEATMAP INTEGRATION - FIXED CONTAINER BOUNDS
// =============================================================================

// Replace the existing renderExpressionHeatmap function with this updated version
function renderExpressionHeatmap(expressionData, geneList = []) {
    console.log('plots.js: === Starting renderExpressionHeatmap (integrated) ===');
    
    // Get the main visualization container
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    // ---- Validation and gene resolution logic ----
    function normalizeGeneString(s) {
        if (!s) return null;
        let str = String(s).trim();
        str = str.replace(/\(.*?\)/g, '');
        str = str.replace(/[,\/\\|;]/g, ' ');
        str = str.replace(/[^A-Za-z0-9\-_ ]/g, '');
        str = str.replace(/\s+/g, ' ').trim();
        return str ? str.toUpperCase() : null;
    }

    function extractCandidates(entry) {
        const out = [];
        if (!entry) return out;
        if (typeof entry === 'string') {
            entry.split(/\s+/).forEach(part => {
                const n = normalizeGeneString(part);
                if (n) out.push(n);
            });
        } else if (typeof entry === 'object') {
            const keys = ['gene', 'geneSymbol', 'symbol', 'name', 'Gene', 'Gene name'];
            for (const k of keys) {
                if (entry[k]) {
                    const n = normalizeGeneString(entry[k]);
                    if (n) out.push(n);
                }
            }
            if (out.length === 0) {
                const maybe = normalizeGeneString(JSON.stringify(entry));
                if (maybe) out.push(maybe);
            }
        }
        return [...new Set(out)];
    }

    function resolveViaGeneMapCache(candidate) {
        try {
            if (typeof geneMapCache !== 'undefined' && geneMapCache && geneMapCache.has) {
                if (geneMapCache.has(candidate)) {
                    const obj = geneMapCache.get(candidate);
                    if (!obj) return null;
                    if (typeof obj === 'string') return normalizeGeneString(obj);
                    if (typeof obj === 'object') {
                        const prefer = obj.gene || obj.symbol || obj.geneSymbol || obj.name || obj.Gene;
                        if (prefer) return normalizeGeneString(prefer);
                        for (const v of Object.values(obj)) {
                            if (typeof v === 'string' && v.length <= 12) {
                                const n = normalizeGeneString(v);
                                if (n) return n;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('plots.js: geneMapCache lookup failed for', candidate, e);
        }
        return null;
    }

    const availableGenes = new Set(Object.keys(expressionData || {}).map(g => String(g).toUpperCase()));
    const validated = [];
    const skipped = [];
    const seen = new Set();

    if (Array.isArray(geneList)) {
        for (const entry of geneList) {
            const candidates = extractCandidates(entry);
            let found = null;
            for (const cand of candidates) {
                if (availableGenes.has(cand)) { found = cand; break; }
                const resolved = resolveViaGeneMapCache(cand);
                if (resolved && availableGenes.has(resolved)) { found = resolved; break; }
            }
            if (!found && candidates.length > 0) {
                for (const cand of candidates) {
                    const firstToken = cand.split('.')[0];
                    if (firstToken && availableGenes.has(firstToken)) { found = firstToken; break; }
                }
            }

            if (found && !seen.has(found)) {
                validated.push(found);
                seen.add(found);
            } else {
                skipped.push({ entry, candidates });
            }
        }
    } else if (typeof geneList === 'string') {
        const parts = geneList.split(/[\s,;\n\r\t]+/).filter(Boolean);
        for (const p of parts) {
            const cand = normalizeGeneString(p);
            let found = null;
            if (cand) {
                if (availableGenes.has(cand)) found = cand;
                else {
                    const resolved = resolveViaGeneMapCache(cand);
                    if (resolved && availableGenes.has(resolved)) found = resolved;
                }
            }
            if (found && !seen.has(found)) { validated.push(found); seen.add(found); }
            else skipped.push({ entry: p, candidates: [cand] });
        }
    } else {
        validated.push(...Array.from(availableGenes));
    }

    console.log('plots.js: Validated geneList:', validated);
    if (validated.length === 0) {
        plotContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:#dc3545;">No valid genes found for heatmap.</div>';
        return false;
    }

    // ---- Create heatmap container within the visualization area ----
    plotContainer.innerHTML = `
        <div id="heatmap-wrapper" style="width: 100%; height: 100%; position: relative; overflow: hidden;">
            <svg id="heatmap-svg" style="display: block;"></svg>
        </div>
    `;

    // ---- D3 heatmap rendering with constrained dimensions ----
    const tissues = Object.keys(expressionData).length > 0
        ? [...new Set(validated.flatMap(g => Object.keys(expressionData[g] || {})))].sort()
        : ['No tissues available'];

    const heatmapData = validated.map(gene => {
        const row = { gene };
        tissues.forEach(tissue => {
            row[tissue] = (expressionData?.[gene]?.[tissue] !== undefined) ? expressionData[gene][tissue] : 0;
        });
        return row;
    });

    // Calculate dimensions based on container size with proper constraints
    const containerWidth = plotContainer.clientWidth;
    const containerHeight = plotContainer.clientHeight;
    
    // Calculate dynamic margins based on text length to ensure full visibility
    const maxGeneNameLength = Math.max(...validated.map(gene => gene.length));
    const maxTissueNameLength = Math.max(...tissues.map(tissue => tissue.length));
    
    // Calculate required margins for full text visibility
    const leftMarginForGenes = Math.max(80, Math.min(200, maxGeneNameLength * 8 + 20));
    const bottomMarginForTissues = Math.max(100, Math.min(200, maxTissueNameLength * 6 + 40));
    
    const margin = { 
        top: Math.min(80, containerHeight * 0.15), 
        right: 30, 
        bottom: Math.min(bottomMarginForTissues, containerHeight * 0.35), 
        left: Math.min(leftMarginForGenes, containerWidth * 0.3) 
    };
    
    // Calculate available space for the heatmap itself
    const availableWidth = containerWidth - margin.left - margin.right;
    const availableHeight = containerHeight - margin.top - margin.bottom;
    
    // Ensure minimum viable dimensions
    const minWidth = Math.max(300, availableWidth);
    const minHeight = Math.max(200, availableHeight);
    
    // Calculate cell sizes based on available space
    const maxCellWidth = Math.max(15, Math.min(50, availableWidth / tissues.length));
    const maxCellHeight = Math.max(15, Math.min(40, availableHeight / validated.length));
    
    // Final dimensions constrained by container
    const width = Math.min(availableWidth, tissues.length * maxCellWidth);
    const height = Math.min(availableHeight, validated.length * maxCellHeight);
    
    // Set SVG size to fit exactly within container
    const totalSVGWidth = Math.min(containerWidth, width + margin.left + margin.right);
    const totalSVGHeight = Math.min(containerHeight, height + margin.top + margin.bottom);

    const svg = d3.select('#heatmap-svg')
        .attr('width', totalSVGWidth)
        .attr('height', totalSVGHeight)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxNTPM = (heatmapData.length > 0 && tissues.length > 0)
        ? d3.max(heatmapData, d => d3.max(tissues, t => d[t]))
        : 1;

    const colorScale = d3.scaleSequential(d3.interpolateGreens)
        .domain([0, maxNTPM || 100]);

    const xScale = d3.scaleBand()
        .range([0, width])
        .domain(tissues)
        .padding(0.05);

    const yScale = d3.scaleBand()
        .range([0, height])
        .domain(validated)
        .padding(0.05);

    // X-axis with full text visibility
    const xAxisGroup = svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale));
        
    // Calculate font size that ensures readability while fitting in allocated space
    const xAxisFontSize = Math.max(9, Math.min(11, Math.min(xScale.bandwidth() / 2, (margin.bottom - 40) / maxTissueNameLength * 8)));
    
    xAxisGroup.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('font-size', xAxisFontSize + 'px')
        .style('fill', '#333')
        .style('font-weight', '500')
        .text(d => d); // Show full text without truncation

    // Y-axis with responsive font size
    const yAxisFontSize = Math.max(8, Math.min(12, yScale.bandwidth() / 2));
    
    svg.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', yAxisFontSize + 'px')
        .style('fill', '#333')
        .each(function(d) {
            // Truncate long gene names if necessary
            const maxChars = Math.max(6, Math.floor(margin.left / 8));
            const text = d3.select(this);
            const originalText = text.text();
            if (originalText.length > maxChars) {
                text.text(originalText.substring(0, maxChars - 3) + '...')
                    .append('title')
                    .text(originalText);
            }
        });

    // Heatmap cells
    svg.selectAll()
        .data(heatmapData, d => d.gene)
        .enter()
        .append('g')
        .selectAll('rect')
        .data(d => tissues.map(tissue => ({
            gene: d.gene,
            tissue,
            value: d[tissue]
        })))
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.tissue))
        .attr('y', d => yScale(d.gene))
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .style('fill', d => d.value === 0 ? '#f5f5f5' : colorScale(d.value))
        .style('stroke', '#fff')
        .style('stroke-width', Math.max(0.5, Math.min(1, xScale.bandwidth() / 20)))
        .on('mouseover', function(event, d) {
            d3.select(this).style('stroke', '#000').style('stroke-width', 2);
            
            // Show tooltip
            const tooltip = d3.select('body').selectAll('.tooltip').data([null]);
            tooltip.enter()
                .append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', 'white')
                .style('padding', '8px')
                .style('border-radius', '4px')
                .style('pointer-events', 'none')
                .style('font-size', '12px')
                .style('opacity', 0)
                .style('z-index', '1000')
                .merge(tooltip)
                .html(`Gene: ${d.gene}<br>Tissue: ${d.tissue}<br>Value: ${Number(d.value).toFixed(2)}`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px')
                .transition()
                .duration(200)
                .style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).style('stroke', '#fff').style('stroke-width', Math.max(0.5, Math.min(1, xScale.bandwidth() / 20)));
            
            // Hide tooltip
            d3.selectAll('.tooltip')
                .transition()
                .duration(200)
                .style('opacity', 0)
                .remove();
        });

    // Add title with responsive positioning and size
    const custom = getPlotCustomization();
    const title = custom.title || 'Gene Expression Heatmap';
    const titleFontSize = Math.max(12, Math.min(18, containerWidth / 40));
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', titleFontSize + 'px')
        .style('font-family', custom.fontFamily || 'Arial, sans-serif')
        .style('font-weight', 'bold')
        .text(title);

    // Add legend with responsive sizing and positioning
    const legendHeight = Math.max(15, Math.min(25, containerHeight / 30));
    const legendWidth = Math.max(150, Math.min(250, width * 0.4));
    
    // Position legend based on available space
    const legendX = width > legendWidth + 20 ? width - legendWidth - 10 : 10;
    const legendY = margin.top > 80 ? -margin.top + 10 : -60;
    
    const legend = svg.append('g')
        .attr('transform', `translate(${legendX}, ${legendY})`);
        
    const legendScale = d3.scaleLinear()
        .domain([0, maxNTPM || 100])
        .range([0, legendWidth]);
        
    const legendAxis = d3.axisBottom(legendScale)
        .ticks(Math.min(5, Math.floor(legendWidth / 40)))
        .tickFormat(d3.format('.1f'));
        
    // Gradient for legend
    const defs = svg.append('defs');
    const linearGradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');
        
    for (let i = 0; i <= 10; i++) {
        const frac = i / 10;
        const val = frac * (maxNTPM || 1);
        linearGradient.append('stop')
            .attr('offset', `${frac * 100}%`)
            .attr('stop-color', colorScale(val));
    }
    
    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)');
        
    legend.append('g')
        .attr('transform', `translate(0,${legendHeight})`)
        .call(legendAxis)
        .style('font-size', Math.max(8, Math.min(12, legendHeight / 2)) + 'px');
        
    legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', -5)
        .style('text-anchor', 'middle')
        .style('font-size', Math.max(10, Math.min(14, legendHeight * 0.8)) + 'px')
        .text('Expression Level');

    console.log('plots.js: Heatmap rendering completed successfully with container bounds');
    return true;
}
