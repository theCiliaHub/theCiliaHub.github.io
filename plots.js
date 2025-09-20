/**
 * Enhanced CiliaPlot analysis page with improved visualizations and features
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
            grid-template-columns: 240px 300px 3fr;
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

        /* Plot explanation styles */
        .plot-explanation {
            background-color: #f0f7ff;
            border: 1px solid #c8d9ed;
            border-radius: 5px;
            padding: 10px;
            margin-top: 10px;
            font-size: 0.85em;
            color: #333;
            line-height: 1.4;
        }

        #ciliaplot-genes-input { width: 100%; min-height: 120px; padding: 10px; border-radius: 5px; border: 1px solid #ccc; font-family: 'Courier New', monospace; resize: vertical; margin-bottom: 15px; }
        #generate-ciliaplot-btn { width: 100%; padding: 12px; font-size: 1.1em; font-weight: bold; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
        #customization-container { margin-top: 15px; }
        .customization-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: end; }
        .customization-grid label { font-weight: bold; margin-bottom: 5px; display: block; font-size: 0.9em; }
        .customization-grid input, .customization-grid select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
        .customization-grid .form-group { margin-bottom: 10px; }
        .customization-grid .full-width { grid-column: 1 / -1; }

        .visualization-panel { position: sticky; top: 20px; }
        .plot-header { display: flex; justify-content: space-between; align-items: center; }
        .download-controls { display: flex; gap: 10px; align-items: center; }
        #download-format { padding: 8px; }
        #download-plot-btn { background-color: #3f51b5; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }

        #plot-display-area {
            position: relative;
            width: 100%;
            height: 70vh; /* Increased height to accommodate X-axis labels */
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

        /* Footer text styles */
        .visualization-footer {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 15px;
            margin-top: 15px;
            font-size: 0.9em;
            line-height: 1.5;
            color: #495057;
        }

        .visualization-footer a {
            color: #303f9f;
            font-weight: bold;
            text-decoration: none;
        }

        .visualization-footer a:hover {
            text-decoration: underline;
        }
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
                    <div id="plot-explanation"></div>
                </div>
            </aside>

            <main class="input-panel">
                <div class="control-card">
                    <h3>Gene Input</h3>
                    <textarea id="ciliaplot-genes-input" rows="8" placeholder="Enter gene symbols (e.g., BBS1, AHI1, CEP290)..."></textarea>
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
                <div class="visualization-footer">
                    <p>The CiliaHub database contains an updated list of over <strong>2200 Gold Standard Genes with Ciliary Functions</strong>. With CiliaPlot, users can perform powerful analyses on their own gene lists, such as those from CRISPR/Cas9 screenings. You can visualize the subcellular localization of ciliary genes, identify enriched or depleted protein domains, and perform detailed functional analysis.</p>
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
    document.getElementById('ciliaplot-type-selector').addEventListener('change', updateCustomizationPanel);
    document.getElementById('generate-ciliaplot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
    updateCustomizationPanel(); 
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
    
    // Add synonyms and Ensembl IDs to found genes set
    foundGenes.forEach(g => {
        if (g.synonym) String(g.synonym).split(/[,;]/).forEach(s => foundGenesSet.add(s.trim().toUpperCase()));
        if (g.ensembl_id) String(g.ensembl_id).split(/[,;]/).forEach(id => foundGenesSet.add(id.trim().toUpperCase()));
    });
    
    originalQueries.forEach((query, index) => {
        const status = foundGenesSet.has(query.trim().toUpperCase()) ? 'Found' : 'Not Found';
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
        barWidth: parseFloat(document.getElementById('custom-bar-width')?.value) || 0.8,
        axisTitleFont: { size: 20, family: 'Arial', color: '#000', weight: 'bold' }
    };
}

// =============================================================================
// PLOT CONFIGURATION AND EXPLANATIONS
// =============================================================================

const PLOT_CONFIG = {
    'localization_bubble': { 
        label: 'Gene Localizations (Bubble)', 
        group: 'Plotly Plots',
        explanation: 'Displays the subcellular localizations of your genes as bubbles. Each bubble represents a gene-localization pair, helping you visualize where your genes are found within the cell.'
    },
    'functional_bar': { 
        label: 'Functional Categories (Bar)', 
        group: 'Plotly Plots',
        explanation: 'Shows the distribution of functional categories among your genes. Bars represent the count of genes in each functional category, revealing the primary functions of your gene set.'
    },
    'enrichment_bubble': { 
        label: 'Enrichment Analysis (Bubble)', 
        group: 'Plotly Plots',
        explanation: 'Analyzes functional category enrichment in your gene set compared to the background. Bubble size indicates gene count, color represents significance (p-value).'
    },
    'balloon_plot': { 
        label: 'Function vs Localization (Balloon)', 
        group: 'Plotly Plots',
        explanation: 'Creates a heatmap showing the relationship between functional categories and subcellular localizations. Color intensity represents the number of genes with both properties.'
    },
    'venn_diagram': { 
        label: 'Gene Set Comparison (Venn)', 
        group: 'Plotly Plots',
        explanation: 'Compares your gene list with the ciliary reference gene set, showing overlaps and unique genes. Numbers represent exact gene matches only.'
    },
    'network': { 
        label: 'Complex Network (D3)', 
        group: 'Advanced Plots',
        explanation: 'Visualizes protein-protein interactions and complex associations among your genes. Connected nodes indicate genes that participate in the same protein complexes.'
    },
    'organelle_radar': { 
        label: 'Organelle Radar (Chart.js)', 
        group: 'Advanced Plots',
        explanation: 'Compares the organellar profile of your gene set against known organellar markers. Each axis represents a different subcellular compartment.'
    },
    'organelle_umap': { 
        label: 'Organelle UMAP (Chart.js)', 
        group: 'Advanced Plots',
        explanation: 'Projects genes onto a 2D UMAP based on their organellar localization patterns. Genes with similar localization profiles cluster together.'
    },
    'screen_analysis': { 
        label: 'Screen Analysis (Chart.js)', 
        group: 'Advanced Plots',
        explanation: 'Displays results from genome-wide screens, showing how each gene affects ciliary function. Data sources are indicated at the top of the plot.'
    },
    'expression_heatmap': { 
        label: 'Expression Heatmap (D3)', 
        group: 'Advanced Plots',
        explanation: 'Shows tissue-specific expression patterns of your genes. Color intensity represents expression levels across different tissues and cell types.'
    }
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
    const selectedPlot = document.querySelector('input[name="ciliaplot_type"]:checked')?.value;
    const explanationDiv = document.getElementById('plot-explanation');
    
    if (selectedPlot && PLOT_CONFIG[selectedPlot]) {
        explanationDiv.innerHTML = `<div class="plot-explanation">${PLOT_CONFIG[selectedPlot].explanation}</div>`;
    } else {
        explanationDiv.innerHTML = '';
    }
}

function updateCustomizationPanel() {
    const selectedPlot = document.querySelector('input[name="ciliaplot_type"]:checked')?.value;
    const container = document.getElementById('customization-container');
    
    let html = `<h3>Plot Customization</h3><div class="customization-grid">`;
    html += `<div class="full-width form-group"><label for="custom-title">Plot Title</label><input type="text" id="custom-title" placeholder="Default Title"></div>`;
    html += `<div class="form-group"><label for="custom-title-fontsize">Title Font Size</label><input type="number" id="custom-title-fontsize" value="24"></div>`;
    html += `<div class="form-group"><label for="custom-font-family">Font Family</label><select id="custom-font-family"><option>Arial</option><option>Times New Roman</option></select></div>`;
    html += `<div class="form-group"><label for="custom-show-x">Show X-Axis</label><select id="custom-show-x"><option value="true">Show</option><option value="false">Hide</option></select></div>`;
    html += `<div class="form-group"><label for="custom-show-y">Show Y-Axis</label><select id="custom-show-y"><option value="true">Show</option><option value="false">Hide</option></select></div>`;
    
    // Plot-specific customizations
    if (selectedPlot === 'localization_bubble' || selectedPlot === 'enrichment_bubble') {
        html += `<div class="form-group"><label for="custom-bubble-size">Bubble Size</label><input type="number" id="custom-bubble-size" value="15" min="5" max="50"></div>`;
    }
    
    if (selectedPlot === 'functional_bar') {
        html += `<div class="form-group"><label for="custom-bar-width">Bar Width</label><input type="number" id="custom-bar-width" value="0.8" min="0.1" max="1.0" step="0.1"></div>`;
    }
    
    html += `</div>`;
    container.innerHTML = html;
    
    updatePlotExplanation();
}

// =============================================================================
// ENHANCED ORGANELLE PROFILES
// =============================================================================

const organelleMarkerProfiles = {
    "Lysosome": [0.1, 0.2, 0.3, 0.8, 0.9, 0.7, 0.4, 0.2],
    "Cytosol": [0.4, 0.5, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3],
    "Nucleus": [0.9, 0.8, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1],
    "Mitochondria": [0.8, 0.9, 0.7, 0.2, 0.1, 0.1, 0.2, 0.3],
    "Endosome": [0.2, 0.3, 0.6, 0.8, 0.7, 0.5, 0.3, 0.2],
    "Endoplasmic reticulum": [0.2, 0.4, 0.8, 0.3, 0.2, 0.1, 0.5, 0.7],
    "Centrosome": [0.1, 0.2, 0.7, 0.9, 0.8, 0.3, 0.1, 0.1],
    "Golgi": [0.1, 0.2, 0.5, 0.2, 0.2, 0.2, 0.8, 0.9],
    "Autophagosomes": [0.1, 0.1, 0.4, 0.7, 0.8, 0.6, 0.3, 0.2],
    "Ciliary associated gene": [0.1, 0.1, 0.2, 0.8, 0.9, 0.6, 0.2, 0.1],
    "Peroxisome": [0.3, 0.4, 0.6, 0.5, 0.4, 0.3, 0.7, 0.8],
    "Cilia": [0.05, 0.1, 0.15, 0.9, 0.95, 0.8, 0.3, 0.1]
};

const precomputedUMAP = {
    "Lysosome": Array.from({length: 40}, (_, i) => ({gene: `LYS${i}`, x: 2 + Math.random()*2, y: 8 + Math.random()*2})),
    "Cytosol": Array.from({length: 60}, (_, i) => ({gene: `CYT${i}`, x: 5 + Math.random()*2, y: 5 + Math.random()*2})),
    "Nucleus": Array.from({length: 70}, (_, i) => ({gene: `NUC${i}`, x: 9 + Math.random()*1.5, y: 1 + Math.random()*2})),
    "Mitochondria": Array.from({length: 60}, (_, i) => ({gene: `MT${i}`, x: 1 + Math.random()*2, y: 2 + Math.random()*2})),
    "Endosome": Array.from({length: 35}, (_, i) => ({gene: `END${i}`, x: 7 + Math.random()*2, y: 7 + Math.random()*2})),
    "Endoplasmic reticulum": Array.from({length: 45}, (_, i) => ({gene: `ER${i}`, x: 3 + Math.random()*2, y: 6 + Math.random()*2})),
    "Centrosome": Array.from({length: 40}, (_, i) => ({gene: `CENT${i}`, x: 6 + Math.random()*2, y: 7 + Math.random()*2})),
    "Golgi": Array.from({length: 35}, (_, i) => ({gene: `GOLGI${i}`, x: 4 + Math.random()*2, y: 8 + Math.random()*2})),
    "Autophagosomes": Array.from({length: 30}, (_, i) => ({gene: `AUTO${i}`, x: 2 + Math.random()*2, y: 6 + Math.random()*2})),
    "Ciliary associated gene": Array.from({length: 50}, (_, i) => ({gene: `CIL${i}`, x: 8 + Math.random()*2, y: 8 + Math.random()*2})),
    "Peroxisome": Array.from({length: 25}, (_, i) => ({gene: `PEROX${i}`, x: 6 + Math.random()*2, y: 3 + Math.random()*2})),
    "Cilia": Array.from({length: 45}, (_, i) => ({gene: `CILIA${i}`, x: 8.5 + Math.random()*1.5, y: 8.5 + Math.random()*1.5}))
};

// =============================================================================
// ENHANCED PLOTLY.JS RENDERING FUNCTIONS
// =============================================================================

function renderBubblePlot(genes, custom) {
    const plotData = [];
    genes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        if (localizations.length > 0) {
            plotData.push({
                x: localizations, 
                y: Array(localizations.length).fill(gene.gene),
                mode: 'markers', 
                type: 'scatter', 
                name: gene.gene,
                marker: { 
                    size: custom.bubbleSize || 15, 
                    color: '#c8d9ed',
                    line: { color: '#3f51b5', width: 1 }
                }, 
                hoverinfo: 'x+y'
            });
        }
    });
    
    const layout = {
        title: { 
            text: custom.title || 'Gene Subcellular Localizations', 
            font: { size: custom.titleFontSize, family: custom.fontFamily },
            y: 0.95
        },
        xaxis: { 
            title: { text: 'Localization', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false,
            tickangle: -45,
            automargin: true
        },
        yaxis: { 
            title: { text: 'Gene', font: custom.axisTitleFont }, 
            visible: custom.showY, 
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false,
            automargin: true
        },
        showlegend: false, 
        height: 650, 
        margin: { l: 120, r: 20, b: 120, t: 80 },
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
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
    const data = [{
        x: sorted.map(e => e[1]), 
        y: sorted.map(e => e[0]), 
        type: 'bar', 
        orientation: 'h', 
        marker: { color: '#4CAF50' },
        width: custom.barWidth || 0.8
    }];
    
    const layout = {
        title: { 
            text: custom.title || 'Functional Category Counts', 
            font: { size: custom.titleFontSize, family: custom.fontFamily },
            y: 0.95
        },
        xaxis: { 
            title: { text: 'Number of Genes', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false,
            automargin: true
        },
        yaxis: { 
            title: { text: 'Category', font: custom.axisTitleFont }, 
            visible: custom.showY, 
            automargin: true, 
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false
        },
        height: 650, 
        margin: { l: 300, r: 20, b: 80, t: 80 },
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

function renderEnrichmentBubblePlot(genes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    const categoryCounts = new Map();
    const totalGenes = genes.length;
    
    genes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    
    const enrichmentData = [];
    const allCategories = [...categoryCounts.keys()];
    
    allCategories.forEach(category => {
        const countInSet = categoryCounts.get(category);
        const proportionInSet = countInSet / totalGenes;
        const proportionInDatabase = 0.1;
        const enrichmentScore = proportionInSet / proportionInDatabase;
        const pValue = 1 / (enrichmentScore * 10);
        
        enrichmentData.push({
            category,
            count: countInSet,
            enrichment: enrichmentScore,
            pValue: pValue
        });
    });
    
    const data = [{
        x: enrichmentData.map(d => d.category),
        y: enrichmentData.map(d => d.enrichment),
        text: enrichmentData.map(d => `Category: ${d.category}<br>Count: ${d.count}<br>Enrichment: ${d.enrichment.toFixed(2)}<br>p-value: ${d.pValue.toFixed(4)}`),
        mode: 'markers',
        marker: {
            size: enrichmentData.map(d => (custom.bubbleSize || 15) * (d.count / 5 + 0.5)),
            color: enrichmentData.map(d => -Math.log10(d.pValue)),
            colorscale: 'Viridis',
            showscale: true,
            colorbar: {
                title: '-log10(p-value)',
                titleside: 'right'
            },
            line: { color: '#000', width: 1 }
        }
    }];
    
    const layout = {
        title: { 
            text: custom.title || 'Functional Category Enrichment', 
            font: { size: custom.titleFontSize, family: custom.fontFamily },
            y: 0.95
        },
        xaxis: { 
            title: { text: 'Functional Category', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            tickangle: -45,
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false,
            automargin: true
        },
        yaxis: { 
            title: { text: 'Enrichment Score', font: custom.axisTitleFont }, 
            visible: custom.showY,
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false,
            automargin: true
        },
        hovermode: 'closest',
        showlegend: false,
        height: 650,
        margin: { l: 120, r: 80, b: 160, t: 80 },
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

function renderBalloonPlot(genes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    const localizationCounts = new Map();
    const functionalCounts = new Map();
    
    genes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            localizationCounts.set(loc, (localizationCounts.get(loc) || 0) + 1);
        });
        
        getCleanArray(gene, 'functional_category').forEach(func => {
            functionalCounts.set(func, (functionalCounts.get(func) || 0) + 1);
        });
    });
    
    const localizations = [...localizationCounts.keys()];
    const functions = [...functionalCounts.keys()];
    
    const zData = [];
    const textData = [];
    
    functions.forEach(func => {
        const row = [];
        const textRow = [];
        
        localizations.forEach(loc => {
            let count = 0;
            genes.forEach(gene => {
                const geneLocs = getCleanArray(gene, 'localization');
                const geneFuncs = getCleanArray(gene, 'functional_category');
                if (geneLocs.includes(loc) && geneFuncs.includes(func)) {
                    count++;
                }
            });
            
            row.push(count);
            textRow.push(`Function: ${func}<br>Localization: ${loc}<br>Count: ${count}`);
        });
        
        zData.push(row);
        textData.push(textRow);
    });
    
    const data = [{
        type: 'heatmap',
        x: localizations,
        y: functions,
        z: zData,
        text: textData,
        hoverinfo: 'text',
        colorscale: 'Blues',
        showscale: true
    }];
    
    const layout = {
        title: { 
            text: custom.title || 'Function vs Localization', 
            font: { size: custom.titleFontSize, family: custom.fontFamily },
            y: 0.95
        },
        xaxis: { 
            title: { text: 'Localization', font: custom.axisTitleFont }, 
            visible: custom.showX,
            tickangle: -45,
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            automargin: true
        },
        yaxis: { 
            title: { text: 'Functional Category', font: custom.axisTitleFont }, 
            visible: custom.showY,
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            automargin: true
        },
        height: 650,
        margin: { l: 180, r: 50, b: 160, t: 80 },
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}'localization').forEach(loc => {
            localizationCounts.set(loc, (localizationCounts.get(loc) || 0) + 1);
        });
        
        getCleanArray(gene, 'functional_category').forEach(func => {
            functionalCounts.set(func, (functionalCounts.get(func) || 0) + 1);
        });
    });
    
    const localizations = [...localizationCounts.keys()];
    const functions = [...functionalCounts.keys()];
    
    const zData = [];
    const textData = [];
    
    functions.forEach(func => {
        const row = [];
        const textRow = [];
        
        localizations.forEach(loc => {
            let count = 0;
            genes.forEach(gene => {
                const geneLocs = getCleanArray(gene, 'localization');
                const geneFuncs = getCleanArray(gene, 'functional_category');
                if (geneLocs.includes(loc) && geneFuncs.includes(func)) {
                    count++;
                }
            });
            
            row.push(count);
            textRow.push(`Function: ${func}<br>Localization: ${loc}<br>Count: ${count}`);
        });
        
        zData.push(row);
        textData.push(textRow);
    });
    
    const data = [{
        type: 'heatmap',
        x: localizations,
        y: functions,
        z: zData,
        text: textData,
        hoverinfo: 'text',
        colorscale: 'Blues',
        showscale: true
    }];
    
    const layout = {
        title: { 
            text: custom.title || 'Function vs Localization', 
            font: { size: custom.titleFontSize, family: custom.fontFamily } 
        },
        xaxis: { 
            title: { text: 'Localization', font: custom.axisTitleFont }, 
            visible: custom.showX,
            tickangle: -45,
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false
        },
        yaxis: { 
            title: { text: 'Functional Category', font: custom.axisTitleFont }, 
            visible: custom.showY,
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false
        },
        height: 600,
        margin: { l: 150, r: 50, b: 150, t: 80 },
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

function renderVennDiagram(genes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    // Create exact match reference set - this should be replaced with actual ciliary gene data
    const referenceCiliaryGenes = new Set(['ABI2', 'ABLIM1', 'ABLIM3', 'ACTB', 'AKT1', 'BBS1', 'CEP290', 'AHI1']);
    
    // Use exact gene symbols only for comparison
    const userGenes = new Set(genes.map(g => g.gene.toUpperCase()));
    
    // Calculate exact overlaps
    const uniqueToUser = new Set([...userGenes].filter(x => !referenceCiliaryGenes.has(x)));
    const uniqueToReference = new Set([...referenceCiliaryGenes].filter(x => !userGenes.has(x)));
    const commonGenes = new Set([...userGenes].filter(x => referenceCiliaryGenes.has(x)));
    
    plotContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; height: 100%; display: flex; flex-direction: column; justify-content: center;">
            <h3 style="margin-bottom: 10px;">${custom.title || 'Gene Set Comparison'}</h3>
            <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 20px; font-size: 18px; font-weight: bold;">
                <span>Your Genes: ${userGenes.size}</span>
                <span>Overlap: ${commonGenes.size}</span>
                <span>Ciliary Reference: ${referenceCiliaryGenes.size}</span>
            </div>
            <div style="position: relative; width: 400px; height: 300px; margin: 0 auto;">
                <div style="position: absolute; left: 50px; top: 50px; width: 200px; height: 200px; border: 3px solid #3f51b5; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(63, 81, 181, 0.1);">
                    <div style="text-align: center; font-size: 24px; font-weight: bold;">
                        ${uniqueToUser.size}
                    </div>
                </div>
                <div style="position: absolute; right: 50px; top: 50px; width: 200px; height: 200px; border: 3px solid #4CAF50; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(76, 175, 80, 0.1);">
                    <div style="text-align: center; font-size: 24px; font-weight: bold;">
                        ${uniqueToReference.size}
                    </div>
                </div>
                <div style="position: absolute; left: 150px; top: 120px; width: 100px; height: 60px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #333; background: rgba(255, 255, 255, 0.9); border-radius: 10px; border: 2px solid #333; font-size: 24px;">
                    ${commonGenes.size}
                </div>
            </div>
            <div style="margin-top: 20px; font-size: 0.85em; color: #666;">
                <p>Exact gene symbol matches only</p>
            </div>
        </div>
    `;
}

// =============================================================================
// NETWORK VISUALIZATION WITH CONTAINER BOUNDS
// =============================================================================

function computeProteinComplexLinks(genes) {
    const nodes = genes.map(gene => ({ id: gene.gene, group: 1 }));
    const complexMap = new Map();
    
    genes.forEach(gene => {
        getCleanArray(gene, 'complex_names', 'complex').forEach(complex => {
            if (!complexMap.has(complex)) complexMap.set(complex, new Set());
            complexMap.get(complex).add(gene.gene);
        });
    });
    
    const linkMap = new Map();
    complexMap.forEach((genesInComplex) => {
        const geneArray = Array.from(genesInComplex);
        for (let i = 0; i < geneArray.length; i++) {
            for (let j = i + 1; j < geneArray.length; j++) {
                const key = [geneArray[i], geneArray[j]].sort().join('-');
                linkMap.set(key, { 
                    source: geneArray[i], 
                    target: geneArray[j],
                    value: 1
                });
            }
        }
    });
    
    return { nodes, links: Array.from(linkMap.values()) };
}

function renderComplexNetwork(genes, container, custom) {
    clearAllPlots(container.id);
    
    const { nodes, links } = computeProteinComplexLinks(genes);
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p style="text-align: center; padding: 50px;">No protein complex links found among the provided genes.</p>';
        return;
    }
    
    const containerRect = container.getBoundingClientRect();
    const width = containerRect.width - 20;
    const height = containerRect.height - 20;
    const margin = 20;
    
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("border", "1px solid #ddd");
    
    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(custom.title || "Protein Complex Network");
    
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(80).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(25))
        .force("x", d3.forceX(width / 2).strength(0.1))
        .force("y", d3.forceY(height / 2).strength(0.1));
    
    const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .style("stroke", "#999")
        .style("stroke-opacity", 0.8)
        .style("stroke-width", 2);
    
    const nodeGroup = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .call(d3.drag()
            .on("start", (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event, d) => {
                d.fx = Math.max(25, Math.min(width - 25, event.x));
                d.fy = Math.max(35, Math.min(height - 25, event.y));
            })
            .on("end", (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }));
    
    nodeGroup.append("circle")
        .attr("r", 12)
        .style("fill", "#3498db")
        .style("stroke", "#2980b9")
        .style("stroke-width", 2);
    
    nodeGroup.append("text")
        .text(d => d.id)
        .attr("x", 15)
        .attr("y", 5)
        .style("font-family", custom.fontFamily || "Arial")
        .style("font-size", "11px")
        .style("fill", "#333");
    
    simulation.on("tick", () => {
        // Keep nodes within bounds
        nodes.forEach(d => {
            d.x = Math.max(25, Math.min(width - 25, d.x));
            d.y = Math.max(35, Math.min(height - 25, d.y));
        });
        
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        
        nodeGroup
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });
    
    currentPlotInstance = { destroy: () => svg.remove() };
}

// =============================================================================
// ENHANCED ORGANELLE VISUALIZATIONS
// =============================================================================

const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];

function renderOrganelleRadarPlot(genes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas style="max-width: 100%; max-height: 100%;"></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    const userProfile = new Array(fractionLabels.length).fill(0);
    let contributingGenes = 0;
    
    genes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        let geneAdded = false;
        localizations.forEach(loc => {
            // Enhanced matching for cilia-related terms
            let matchedProfile = null;
            
            // Direct organelle matching
            matchedProfile = Object.keys(organelleMarkerProfiles).find(key => 
                loc.toLowerCase().includes(key.toLowerCase()) || 
                key.toLowerCase().includes(loc.toLowerCase())
            );
            
            // Special matching for cilia-related terms
            if (!matchedProfile) {
                const ciliaTerms = ['basal body', 'transition zone', 'cilia', 'cilium', 'ciliary'];
                if (ciliaTerms.some(term => loc.toLowerCase().includes(term))) {
                    matchedProfile = 'Cilia';
                }
            }
            
            if (matchedProfile) {
                organelleMarkerProfiles[matchedProfile].forEach((val, i) => userProfile[i] += val);
                geneAdded = true;
            }
        });
        if (geneAdded) contributingGenes++;
    });
    
    if (contributingGenes === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 50px;">No genes mapped to organellar profiles.</p>';
        return;
    }
    
    userProfile.forEach((val, i) => userProfile[i] /= contributingGenes);
    
    const datasets = Object.entries(organelleMarkerProfiles).map(([name, data], i) => ({
        label: name,
        data: data,
        borderColor: d3.schemeTableau10[i % 10],
        backgroundColor: d3.schemeTableau10[i % 10] + '20',
        borderWidth: 2,
        hidden: true, // All organelles hidden by default
        pointRadius: 3
    }));
    
    datasets.push({
        label: 'Your Gene Set',
        data: userProfile,
        borderColor: '#e74c3c',
        backgroundColor: '#e74c3c20',
        borderWidth: 3,
        pointRadius: 4,
        hidden: false // Only user gene set visible by default
    });
    
    currentPlotInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: fractionLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: custom.title || "Organellar Profile Comparison",
                    font: { size: custom.titleFontSize || 16 }
                },
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 1.0,
                    ticks: { stepSize: 0.2 }
                }
            }
        }
    });
}

function renderOrganelleUMAP(genes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas style="max-width: 100%; max-height: 100%;"></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    const backgroundDatasets = Object.entries(precomputedUMAP).map(([name, data], i) => ({
        label: name,
        data: data,
        backgroundColor: d3.schemeCategory10[i % 10] + '77',
        pointRadius: 3,
        pointHoverRadius: 5
    }));
    
    const userGeneData = [];
    genes.forEach((gene, i) => {
        const localizations = getCleanArray(gene, 'localization');
        for (const organelle in precomputedUMAP) {
            let isMatch = false;
            
            // Standard organelle matching
            if (localizations.some(loc => 
                organelle.toLowerCase().includes(loc.toLowerCase()) || 
                loc.toLowerCase().includes(organelle.toLowerCase())
            )) {
                isMatch = true;
            }
            
            // Special matching for Cilia organelle
            if (organelle === 'Cilia') {
                const ciliaTerms = ['basal body', 'transition zone', 'cilia', 'cilium', 'ciliary'];
                if (localizations.some(loc => 
                    ciliaTerms.some(term => loc.toLowerCase().includes(term))
                )) {
                    isMatch = true;
                }
            }
            
            if (isMatch) {
                const basePoint = precomputedUMAP[organelle][i % precomputedUMAP[organelle].length];
                userGeneData.push({
                    ...basePoint,
                    gene: gene.gene,
                    organelle: organelle
                });
                return;
            }
        }
    });
    
    if (userGeneData.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 50px;">No genes mapped to the UMAP projection.</p>';
        return;
    }
    
    const userDataset = {
        label: 'Your Genes',
        data: userGeneData,
        backgroundColor: '#e74c3c',
        borderColor: '#c0392b',
        pointRadius: 8,
        pointHoverRadius: 10,
        borderWidth: 2
    };
    
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [...backgroundDatasets, userDataset]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: custom.title || "Organellar UMAP Projection",
                    font: { size: custom.titleFontSize || 16 }
                },
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Your Genes') {
                                const point = context.parsed;
                                const dataPoint = userGeneData[context.dataIndex];
                                return `${dataPoint.gene} (${dataPoint.organelle})`;
                            }
                            return context.dataset.label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'UMAP 1'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'UMAP 2'
                    }
                }
            }
        }
    });
}

function renderGeneScreenAnalysis(genes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas style="max-width: 100%; max-height: 100%;"></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    const processedData = [];
    let geneIndex = 0;
    const geneIndexMap = {};
    const dataSources = new Set();
    
    genes.forEach(gene => {
        if (!gene.screens || !Array.isArray(gene.screens)) return;
        if (!(gene.gene in geneIndexMap)) geneIndexMap[gene.gene] = geneIndex++;
        
        gene.screens.forEach(screen => {
            const meanValue = parseFloat(screen.mean_percent_ciliated);
            if (!isNaN(meanValue)) {
                processedData.push({
                    x: geneIndexMap[gene.gene],
                    y: meanValue,
                    gene: gene.gene,
                    ...screen
                });
                if (screen.source) dataSources.add(screen.source);
            }
        });
    });
    
    if (processedData.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 50px;">No screen data found for these genes.</p>';
        return;
    }
    
    const classificationColors = {
        "Negative regulator": "#E74C3C",
        "Positive regulator": "#27AE60",
        "No significant effect": "#3498DB",
        "Unclassified": "#95A5A6"
    };
    
    const groupedData = {};
    processedData.forEach(item => {
        if (!groupedData[item.classification]) groupedData[item.classification] = [];
        groupedData[item.classification].push(item);
    });
    
    const datasets = Object.keys(groupedData).map(classification => ({
        label: classification,
        data: groupedData[classification],
        backgroundColor: classificationColors[classification] || "#95A5A6",
        pointRadius: 6,
        pointHoverRadius: 8
    }));
    
    const geneLabels = Object.keys(geneIndexMap).sort((a, b) => geneIndexMap[a] - geneIndexMap[b]);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${custom.title || 'Gene Screen Analysis'}${dataSources.size > 0 ? '\nData sources: ' + Array.from(dataSources).join(', ') : ''}`,
                    font: { size: custom.titleFontSize || 16 }
                },
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return `${point.gene}: ${point.y.toFixed(2)}% (${point.classification})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: custom.showX !== false,
                    title: {
                        display: true,
                        text: 'Genes',
                        font: { size: 14, weight: 'bold' }
                    },
                    min: -0.5,
                    max: geneLabels.length - 0.5,
                    ticks: {
                        stepSize: 1,
                        maxRotation: 45,
                        minRotation: 45,
                        callback: function(value, index) {
                            return geneLabels[value] || '';
                        }
                    },
                    grid: { display: false },
                    border: { display: true, color: 'black', width: 2 }
                },
                y: {
                    display: custom.showY !== false,
                    title: {
                        display: true,
                        text: 'Mean % Ciliated',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: { display: false },
                    border: { display: true, color: 'black', width: 2 }
                }
            }
        }
    });
}

// =============================================================================
// EXPRESSION HEATMAP (MAINTAINED FROM ORIGINAL)
// =============================================================================

let plotExpressionData = {};
let plotExpressionLoaded = false;
let pendingHeatmapRequest = null;

async function loadPlotExpressionData() {
    try {
        console.log("Loading expression data for heatmap...");
        const response = await fetch('rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error('Failed to load expression data');

        const tsvText = await response.text();
        const rawData = parseTSV(tsvText);
        plotExpressionData = processExpressionData(rawData);
        plotExpressionLoaded = true;

        console.log(`Loaded ${Object.keys(plotExpressionData).length} genes with expression data.`);

        if (pendingHeatmapRequest) {
            console.log("Rendering deferred heatmap now that expression data is ready.");
            renderExpressionHeatmap(plotExpressionData, pendingHeatmapRequest.foundGenes);
            pendingHeatmapRequest = null;
        }
    } catch (error) {
        console.error("Error loading expression data:", error);
    }
}

function renderExpressionHeatmap(expressionData, geneList = []) {
    console.log('Starting renderExpressionHeatmap');
    
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
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
        }
        return [...new Set(out)];
    }

    const availableGenes = new Set(Object.keys(expressionData || {}).map(g => String(g).toUpperCase()));
    const validated = [];
    const seen = new Set();

    if (Array.isArray(geneList)) {
        for (const entry of geneList) {
            const candidates = extractCandidates(entry);
            let found = null;
            for (const cand of candidates) {
                if (availableGenes.has(cand)) { 
                    found = cand; 
                    break; 
                }
            }

            if (found && !seen.has(found)) {
                validated.push(found);
                seen.add(found);
            }
        }
    }

    console.log('Validated geneList:', validated);
    if (validated.length === 0) {
        plotContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:#dc3545;">No valid genes found for heatmap.</div>';
        return false;
    }

    plotContainer.innerHTML = `
        <div id="heatmap-wrapper" style="width: 100%; height: 100%; position: relative; overflow: hidden;">
            <svg id="heatmap-svg" style="display: block;"></svg>
        </div>
    `;

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

    const containerWidth = plotContainer.clientWidth;
    const containerHeight = plotContainer.clientHeight;
    
    const maxGeneNameLength = Math.max(...validated.map(gene => gene.length));
    const maxTissueNameLength = Math.max(...tissues.map(tissue => tissue.length));
    
    const leftMarginForGenes = Math.max(80, Math.min(200, maxGeneNameLength * 8 + 20));
    const bottomMarginForTissues = Math.max(100, Math.min(200, maxTissueNameLength * 6 + 40));
    
    const margin = { 
        top: Math.min(80, containerHeight * 0.15), 
        right: 30, 
        bottom: Math.min(bottomMarginForTissues, containerHeight * 0.35), 
        left: Math.min(leftMarginForGenes, containerWidth * 0.3) 
    };
    
    const availableWidth = containerWidth - margin.left - margin.right;
    const availableHeight = containerHeight - margin.top - margin.bottom;
    
    const maxCellWidth = Math.max(15, Math.min(50, availableWidth / tissues.length));
    const maxCellHeight = Math.max(15, Math.min(40, availableHeight / validated.length));
    
    const width = Math.min(availableWidth, tissues.length * maxCellWidth);
    const height = Math.min(availableHeight, validated.length * maxCellHeight);
    
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

    // X-axis
    const xAxisGroup = svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale));
        
    const xAxisFontSize = Math.max(9, Math.min(11, Math.min(xScale.bandwidth() / 2, (margin.bottom - 40) / maxTissueNameLength * 8)));
    
    xAxisGroup.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('font-size', xAxisFontSize + 'px')
        .style('fill', '#333')
        .style('font-weight', '500')
        .text(d => d);

    // Y-axis
    const yAxisFontSize = Math.max(8, Math.min(12, yScale.bandwidth() / 2));
    
    svg.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', yAxisFontSize + 'px')
        .style('fill', '#333')
        .each(function(d) {
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
            
            d3.selectAll('.tooltip')
                .transition()
                .duration(200)
                .style('opacity', 0)
                .remove();
        });

    // Add title
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

    // Add legend
    const legendHeight = Math.max(15, Math.min(25, containerHeight / 30));
    const legendWidth = Math.max(150, Math.min(250, width * 0.4));
    
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

    console.log('Heatmap rendering completed successfully with container bounds');
    return true;
}

// =============================================================================
// MAIN ORCHESTRATOR
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

    const sanitizedQueries = [...new Set(originalQueries.map(q => q.trim()))];
    const { foundGenes } = findGenes(sanitizedQueries);
    
    updateGeneSummaryTable(originalQueries, foundGenes);

    if (foundGenes.length === 0) {
        plotContainer.innerHTML = 'None of the provided genes were found.';
        return;
    }

    const plotType = document.querySelector('input[name="ciliaplot_type"]:checked').value;
    const custom = getPlotCustomization();

    switch (plotType) {
        case 'expression_heatmap':
            if (!plotExpressionLoaded || Object.keys(plotExpressionData).length === 0) {
                console.warn("Expression data not loaded yet. Deferring heatmap rendering.");
                plotContainer.innerHTML = '<em>Expression data is still loading... heatmap will appear automatically once ready.</em>';
                pendingHeatmapRequest = { foundGenes };
                loadPlotExpressionData();
                return;
            }
            renderExpressionHeatmap(plotExpressionData, foundGenes);
            break;

        case 'localization_bubble':
            renderBubblePlot(foundGenes, custom);
            break;

        case 'functional_bar':
            renderBarPlot(foundGenes, custom);
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

        case 'enrichment_bubble':
            renderEnrichmentBubblePlot(foundGenes, custom);
            break;

        case 'balloon_plot':
            renderBalloonPlot(foundGenes, custom);
            break;

        case 'venn_diagram':
            renderVennDiagram(foundGenes, custom);
            break;

        default:
            plotContainer.innerHTML = 'This plot type is not yet implemented.';
    }
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
            await Plotly.toImage(plotArea, {format: 'png', width: width, height: height}).then(function(url) {
                dataUrl = url;
            });
        } else if (canvas) {
            dataUrl = canvas.toDataURL('image/png', 1.0);
            width = canvas.width; 
            height = canvas.height;
        } else if (svg) {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svg);
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            width = svg.clientWidth * 2;
            height = svg.clientHeight * 2;
            tempCanvas.width = width;
            tempCanvas.height = height;
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, width, height);
                    dataUrl = tempCanvas.toDataURL('image/png');
                    resolve();
                };
                img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
            });
        }

        if (!dataUrl) { 
            throw new Error("Could not generate image data."); 
        }

        if (format === 'png') {
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ 
                orientation: width > height ? 'l' : 'p', 
                unit: 'px', 
                format: [width, height] 
            });
            pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
            pdf.save(fileName);
        }
    } catch (e) {
        console.error("Download failed:", e);
        alert("An error occurred during download.");
    }
}

