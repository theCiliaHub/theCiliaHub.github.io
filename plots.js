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
        .customization-grid input, .customization-grid select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
        .customization-grid .form-group { margin-bottom: 10px; }
        .customization-grid .full-width { grid-column: 1 / -1; }

        .visualization-panel { position: sticky; top: 20px; }
        .plot-header { display: flex; justify-content: space-between; align-items: center; }
        .download-controls { display: flex; gap: 10px; align-items: center; }
        #download-format { padding: 8px; }
        #download-plot-btn { background-color: #3f51b5; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }

        #plot-display-area { width: 100%; height: 60vh; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #888; margin-top: 10px; overflow: hidden; }
        #plot-display-area > div, #plot-display-area > svg, #plot-display-area > canvas { width: 100% !important; height: 100% !important; }

        .gene-input-table-container table { width: 100%; border-collapse: collapse; background-color: #fff; }
        .gene-input-table-container th, .gene-input-table-container td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .gene-input-table-container th { background-color: #f2f2f2; }
    </style>

    <section class="ciliaplot-page-container">
        <div class="explanation-section">
            <h2>CiliaPlot: Visualize Your Ciliary Gene Sets</h2>
            <p>The CiliaHub database contains an updated list of over <strong>2200 Gold Standard Genes with Ciliary Functions</strong>. With CiliaPlot, users can perform powerful analyses on their own gene lists, such as those from CRISPR/Cas9 screenings. You can visualize the subcellular localization of ciliary genes, identify enriched or depleted protein domains, and perform detailed functional analysis.</p>
            <p>Additionally, we have integrated four seminal genome-wide screens for cilia and Hedgehog pathway functions:
                <ul>
                    <li><a href="https://www.sciencedirect.com/science/article/pii/S016748891630074X" target="_blank">Kim et al. 2016</a></li>
                    <li><a href="https://elifesciences.org/articles/06602#content" target="_blank">Roosing et al. 2015</a></li>
                    <li><a href="https://www.nature.com/articles/s41588-018-0054-7#Abs1" target="_blank">Breslow et al. 2018</a></li>
                    <li><a href="https://www.nature.com/articles/ncb3201#Abs1" target="_blank">Wheway et al. 2015</a></li>
                </ul>
            </p>
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
    foundGenes.forEach(g => {
        if (g.synonym) String(g.synonym).split(/[,;]/).forEach(s => foundGenesSet.add(sanitize(s)));
        if (g.ensembl_id) String(g.ensembl_id).split(/[,;]/).forEach(id => foundGenesSet.add(sanitize(id)));
    });
    originalQueries.forEach((query, index) => {
        const status = foundGenesSet.has(sanitize(query)) ? '✅ Found' : '❌ Not Found';
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
        axisTitleFont: { size: 20, family: 'Arial', color: '#000', weight: 'bold' }
    };
}

// =============================================================================
// DYNAMIC UI & MAIN ORCHESTRATOR
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

function updateCustomizationPanel() {
    const container = document.getElementById('customization-container');
    let html = `<h3>Plot Customization</h3><div class="customization-grid">`;
    html += `<div class="full-width form-group"><label for="custom-title">Plot Title</label><input type="text" id="custom-title" placeholder="Default Title"></div>`;
    html += `<div class="form-group"><label for="custom-title-fontsize">Title Font Size</label><input type="number" id="custom-title-fontsize" value="24"></div>`;
    html += `<div class="form-group"><label for="custom-font-family">Font Family</label><select id="custom-font-family"><option>Arial</option><option>Times New Roman</option></select></div>`;
    html += `<div class="form-group"><label for="custom-show-x">Show X-Axis</label><select id="custom-show-x"><option value="true">Show</option><option value="false">Hide</option></select></div>`;
    html += `<div class="form-group"><label for="custom-show-y">Show Y-Axis</label><select id="custom-show-y"><option value="true">Show</option><option value="false">Hide</option></select></div>`;
    html += `</div>`;
    container.innerHTML = html;
}

/// Utility to wait until a condition is true
function waitFor(conditionFn, timeout = 5000, interval = 50) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            if (conditionFn()) return resolve(true);
            if (Date.now() - start > timeout) return reject(new Error('Timeout waiting for condition'));
            setTimeout(check, interval);
        };
        check();
    });
}

// =======================
// plots.js
// =======================

// --- Local expression state for plots.js heatmap only ---
let plotExpressionData = {};
let plotExpressionLoaded = false;
let pendingHeatmapRequest = null;

// --- Dedicated expression loader for plots.js ---
async function loadPlotExpressionData() {
    try {
        console.log("plots.js: Loading expression data for heatmap...");
        const response = await fetch('rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error('Failed to load expression data (plots.js)');

        const tsvText = await response.text();
        const rawData = parseTSV(tsvText);
        plotExpressionData = processExpressionData(rawData); // Reuse script.js parser
        plotExpressionLoaded = true;

        console.log(`plots.js: Loaded ${Object.keys(plotExpressionData).length} genes with expression data.`);

        // If user already requested a heatmap earlier, render now
        if (pendingHeatmapRequest) {
            console.log("plots.js: Rendering deferred heatmap now that expression data is ready.");
            renderExpressionHeatmap(plotExpressionData, pendingHeatmapRequest.foundGenes);
            pendingHeatmapRequest = null;
        }
    } catch (error) {
        console.error("plots.js: Error loading expression data:", error);
    }
}

// =============================================================================
// MODIFIED generateAnalysisPlots FUNCTION
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

    const sanitizedQueries = [...new Set(originalQueries.map(sanitize))];
    const { foundGenes } = findGenes(sanitizedQueries);
    
    // Update the MAIN gene summary table (not a duplicate)
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
                console.warn("plots.js: expression data not loaded yet. Deferring heatmap rendering.");
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
// NEW PLOT TYPES
// =============================================================================

// Enrichment Bubble Plot
function renderEnrichmentBubblePlot(foundGenes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    // Calculate enrichment scores for functional categories
    const categoryCounts = new Map();
    const totalGenes = foundGenes.length;
    
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    
    // Calculate enrichment p-values (simplified for demonstration)
    const enrichmentData = [];
    const allCategories = [...categoryCounts.keys()];
    const totalInDatabase = 100; // This would come from your database statistics
    
    allCategories.forEach(category => {
        const countInSet = categoryCounts.get(category);
        const proportionInSet = countInSet / totalGenes;
        const proportionInDatabase = 0.1; // This would come from your database
        
        // Simplified enrichment score
        const enrichmentScore = proportionInSet / proportionInDatabase;
        const pValue = 1 / (enrichmentScore * 10); // Simplified p-value calculation
        
        enrichmentData.push({
            category,
            count: countInSet,
            enrichment: enrichmentScore,
            pValue: pValue
        });
    });
    
    // Create bubble plot
    const data = [{
        x: enrichmentData.map(d => d.category),
        y: enrichmentData.map(d => d.enrichment),
        text: enrichmentData.map(d => `Category: ${d.category}<br>Count: ${d.count}<br>Enrichment: ${d.enrichment.toFixed(2)}<br>p-value: ${d.pValue.toFixed(4)}`),
        mode: 'markers',
        marker: {
            size: enrichmentData.map(d => d.count * 5),
            color: enrichmentData.map(d => -Math.log10(d.pValue)),
            colorscale: 'Viridis',
            showscale: true,
            colorbar: {
                title: '-log10(p-value)',
                titleside: 'right'
            }
        }
    }];
    
    const layout = {
        title: { text: custom.title || 'Functional Category Enrichment', font: { size: custom.titleFontSize, family: custom.fontFamily } },
        xaxis: { 
            title: { text: 'Functional Category', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            tickangle: -45 
        },
        yaxis: { 
            title: { text: 'Enrichment Score', font: custom.axisTitleFont }, 
            visible: custom.showY 
        },
        hovermode: 'closest',
        showlegend: false,
        height: 600,
        margin: { l: 120, r: 50, b: 150, t: 80 }
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

// Balloon Plot
function renderBalloonPlot(foundGenes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    // Count occurrences of each localization and functional category
    const localizationCounts = new Map();
    const functionalCounts = new Map();
    
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            localizationCounts.set(loc, (localizationCounts.get(loc) || 0) + 1);
        });
        
        getCleanArray(gene, 'functional_category').forEach(func => {
            functionalCounts.set(func, (functionalCounts.get(func) || 0) + 1);
        });
    });
    
    // Prepare data for balloon plot
    const localizations = [...localizationCounts.keys()];
    const functions = [...functionalCounts.keys()];
    
    const zData = [];
    const textData = [];
    
    functions.forEach(func => {
        const row = [];
        const textRow = [];
        
        localizations.forEach(loc => {
            // Count genes that have both this function and localization
            let count = 0;
            foundGenes.forEach(gene => {
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
        title: { text: custom.title || 'Function vs Localization', font: { size: custom.titleFontSize, family: custom.fontFamily } },
        xaxis: { 
            title: { text: 'Localization', font: custom.axisTitleFont }, 
            visible: custom.showX,
            tickangle: -45 
        },
        yaxis: { 
            title: { text: 'Functional Category', font: custom.axisTitleFont }, 
            visible: custom.showY 
        },
        height: 600,
        margin: { l: 150, r: 50, b: 150, t: 80 }
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

// Venn Diagram
function renderVennDiagram(foundGenes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    // This would compare the user's gene list with a reference ciliary gene list
    // For demonstration, we'll use a mock reference list
    const referenceCiliaryGenes = new Set(['ABI2', 'ABLIM1', 'ABLIM3', 'ACTB', 'AKT1']); // Example genes
    
    const userGenes = new Set(foundGenes.map(g => g.gene.toUpperCase()));
    
    // Calculate overlaps
    const uniqueToUser = new Set([...userGenes].filter(x => !referenceCiliaryGenes.has(x)));
    const uniqueToReference = new Set([...referenceCiliaryGenes].filter(x => !userGenes.has(x)));
    const commonGenes = new Set([...userGenes].filter(x => referenceCiliaryGenes.has(x)));
    
    // Create data for Venn diagram
    const sets = [
        { sets: ['Your Gene Set'], size: uniqueToUser.size },
        { sets: ['Ciliary Reference Set'], size: uniqueToReference.size },
        { sets: ['Your Gene Set', 'Ciliary Reference Set'], size: commonGenes.size }
    ];
    
    // Create chart
    const chart = {
        type: 'venn',
        sets: sets
    };
    
    const data = [chart];
    
    const layout = {
        title: { text: custom.title || 'Gene Set Comparison', font: { size: custom.titleFontSize, family: custom.fontFamily } },
        height: 500,
        margin: { t: 80, b: 50, l: 50, r: 50 }
    };
    
    // For a real implementation, you would use a Venn diagram library like venn.js
    // This is a simplified version using Plotly's Venn diagram (if available)
    // Alternatively, you could implement with D3.js
    
    plotContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h3>Gene Set Comparison</h3>
            <div style="display: flex; justify-content: center; margin-top: 20px;">
                <div style="margin: 0 20px;">
                    <div style="width: 200px; height: 200px; border: 2px solid #3f51b5; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        Your Genes<br>${userGenes.size}
                    </div>
                </div>
                <div style="margin: 0 20px;">
                    <div style="width: 200px; height: 200px; border: 2px solid #4CAF50; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; left: -100px;">
                        Reference Ciliary Genes<br>${referenceCiliaryGenes.size}
                    </div>
                </div>
            </div>
            <div style="margin-top: 20px;">
                <p>Overlap: ${commonGenes.size} genes</p>
                <p>Unique to your set: ${uniqueToUser.size} genes</p>
                <p>Unique to reference: ${uniqueToReference.size} genes</p>
            </div>
        </div>
    `;
}
// =============================================================================
// MODIFIED FUNCTIONS FOR HEATMAP INTEGRATION
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
        <div id="heatmap-wrapper" style="width: 100%; height: 100%; position: relative; overflow: auto;">
            <svg id="heatmap-svg" style="display: block;"></svg>
        </div>
    `;

    // ---- D3 heatmap rendering (with improved X-axis labels) ----
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

    // Calculate dimensions based on container size
    const containerWidth = plotContainer.clientWidth;
    const containerHeight = plotContainer.clientHeight;
    
    const margin = { top: 80, right: 30, bottom: 150, left: 150 };
    const width = Math.max(600, tissues.length * 40);
    const height = Math.max(400, validated.length * 30);

    const svg = d3.select('#heatmap-svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
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

    // X-axis with proper tissue names
    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('font-size', '12px')
        .style('fill', '#333');

    // Y-axis
    svg.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', '12px')
        .style('fill', '#333');

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
        .style('stroke-width', 1)
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
                .merge(tooltip)
                .html(`Gene: ${d.gene}<br>Tissue: ${d.tissue}<br>Value: ${Number(d.value).toFixed(2)}`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px')
                .transition()
                .duration(200)
                .style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).style('stroke', '#fff').style('stroke-width', 1);
            
            // Hide tooltip
            d3.selectAll('.tooltip')
                .transition()
                .duration(200)
                .style('opacity', 0)
                .remove();
        });

    // Add title
    const custom = getPlotCustomization();
    const title = custom.title || 'Gene Expression Heatmap';
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .style('font-size', custom.titleFontSize + 'px')
        .style('font-family', custom.fontFamily)
        .style('font-weight', 'bold')
        .text(title);

    // Add legend
    const legendHeight = 20;
    const legendWidth = 200;
    const legend = svg.append('g')
        .attr('transform', `translate(${width - legendWidth - 10}, -60)`);
        
    const legendScale = d3.scaleLinear()
        .domain([0, maxNTPM || 100])
        .range([0, legendWidth]);
        
    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
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
        .style('font-size', '10px');
        
    legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', -5)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Expression Level');

    console.log('plots.js: Heatmap rendering completed successfully');
    return true;
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
                marker: { size: 15, color: '#3f51b5' }, hoverinfo: 'x+y'
            });
        }
    });
    const layout = {
        title: { text: custom.title || 'Gene Subcellular Localizations', font: { size: custom.titleFontSize, family: custom.fontFamily } },
        xaxis: { title: { text: 'Localization', font: custom.axisTitleFont }, visible: custom.showX, linecolor: 'black', linewidth: 2, mirror: true, gridcolor: 'white' },
        yaxis: { title: { text: 'Gene', font: custom.axisTitleFont }, visible: custom.showY, linecolor: 'black', linewidth: 2, mirror: true, gridcolor: 'white' },
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
    const data = [{ x: sorted.map(e => e[1]), y: sorted.map(e => e[0]), type: 'bar', orientation: 'h', marker: { color: '#4CAF50' } }];
    const layout = {
        title: { text: custom.title || 'Functional Category Counts', font: { size: custom.titleFontSize, family: custom.fontFamily } },
        xaxis: { title: { text: 'Number of Genes', font: custom.axisTitleFont }, visible: custom.showX, linecolor: 'black', linewidth: 2, mirror: true, gridcolor: 'white' },
        yaxis: { title: { text: 'Category', font: custom.axisTitleFont }, visible: custom.showY, automargin: true, linecolor: 'black', linewidth: 2, mirror: true, gridcolor: 'white' },
        height: 600, margin: { l: 250, r: 20, b: 50, t: 80 },
        plot_bgcolor: 'white', paper_bgcolor: 'white'
    };
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}




// =============================================================================
// INTEGRATED CHART.JS & D3.JS FUNCTIONS
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
        container.innerHTML = '<p class="status-message">No protein complex links found.</p>';
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
    nodeGroup.append("text").text(d => d.id).attr("x", 15).attr("y", 5).style("font-family", custom.fontFamily);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });
    currentPlotInstance = svg.node();
}

const organelleMarkerProfiles = { "Cilia": [0.1, 0.1, 0.2, 0.8, 0.9, 0.6, 0.2, 0.1], "Basal Body": [0.1, 0.2, 0.7, 0.9, 0.8, 0.3, 0.1, 0.1], "Mitochondrion": [0.8, 0.9, 0.7, 0.2, 0.1, 0.1, 0.2, 0.3], "Nucleus": [0.9, 0.8, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1], "ER": [0.2, 0.4, 0.8, 0.3, 0.2, 0.1, 0.5, 0.7], "Golgi": [0.1, 0.2, 0.5, 0.2, 0.2, 0.2, 0.8, 0.9], "Cytosol": [0.4, 0.5, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3] };
const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];

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
    
    if (contributingGenes === 0) { container.innerHTML = '<p>No genes mapped to an organellar profile.</p>'; return; }
    userProfile.forEach((val, i) => userProfile[i] /= contributingGenes);

    const datasets = Object.entries(organelleMarkerProfiles).map(([name, data], i) => ({
        label: name, data: data, borderColor: d3.schemeTableau10[i], hidden: true
    }));
    datasets.push({ label: 'Your Gene Set', data: userProfile, borderColor: '#e74c3c', borderWidth: 3 });

    currentPlotInstance = new Chart(ctx, {
        type: 'radar', data: { labels: fractionLabels, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: custom.title || "Organellar Profile Comparison", font: { size: custom.titleFontSize } } } }
    });
}

const precomputedUMAP = { "Cilia": Array.from({length: 50}, (_, i) => ({gene: `CILGEN${i}`, x: 8 + Math.random()*2, y: 8 + Math.random()*2})), "Basal Body": Array.from({length: 40}, (_, i) => ({gene: `BBGEN${i}`, x: 6 + Math.random()*2, y: 7 + Math.random()*2})), "Mitochondrion": Array.from({length: 60}, (_, i) => ({gene: `MTGEN${i}`, x: 1 + Math.random()*2, y: 2 + Math.random()*2})), "Nucleus": Array.from({length: 70}, (_, i) => ({gene: `NUCGEN${i}`, x: 9 + Math.random()*1.5, y: 1 + Math.random()*2})) };

function renderOrganelleUMAP(foundGenes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    const backgroundDatasets = Object.entries(precomputedUMAP).map(([name, data], i) => ({
        label: name, data: data, backgroundColor: d3.schemeCategory10[i] + '77'
    }));
    
    const userGeneData = [];
    foundGenes.forEach((gene, i) => {
        const localizations = getCleanArray(gene, 'localization');
        for (const organelle in precomputedUMAP) {
            if (localizations.some(loc => organelle.toLowerCase().includes(loc.toLowerCase()))) {
                userGeneData.push({ ...precomputedUMAP[organelle][i % precomputedUMAP[organelle].length], gene: gene.gene });
                return;
            }
        }
    });

    if (userGeneData.length === 0) { container.innerHTML = '<p>No genes mapped to the UMAP.</p>'; return; }
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
    let geneIndex = 0;
    const geneIndexMap = {};
    
    foundGenes.forEach(gene => {
        if (!gene.screens || !Array.isArray(gene.screens)) return;
        if (!(gene.gene in geneIndexMap)) geneIndexMap[gene.gene] = geneIndex++;
        
        gene.screens.forEach(screen => {
            const meanValue = parseFloat(screen.mean_percent_ciliated);
            if (!isNaN(meanValue)) {
                processedData.push({ x: geneIndexMap[gene.gene], y: meanValue, gene: gene.gene, ...screen });
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
            plugins: { title: { display: true, text: custom.title || 'Gene Screen Analysis', font: {size: custom.titleFontSize} } },
            scales: {
                x: {
                    display: custom.showX,
                    title: { display: true, text: 'Genes', font: {size: 20, weight: 'bold'} },
                    min: -0.5, max: geneLabels.length - 0.5,
                    ticks: { stepSize: 1, callback: (val) => geneLabels[val] || '' },
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
            await Plotly.toImage(plotArea, {format: 'png', width: width, height: height}).then(function(url) {
                dataUrl = url;
            });
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
