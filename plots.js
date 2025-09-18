// =============================================================================
// CiliaHub Plotting Engine (plots.js)
// =============================================================================
// This file contains all functions for generating analytical plots on the
// CiliaPlot page, including localization, domain, network, and expression
// analyses. It now also includes functions to display a summary table of the
// queried genes before rendering the plot.
//
// Dependencies:
// - D3.js (for network plot)
// - Chart.js (for most plots)
// - jsPDF (for PDF downloads)
// - Global variables from script.js (allGenes, expressionData, etc.)
// =============================================================================


/**
 * Safely clears the previous plot, handling both Chart.js and D3.js instances.
 * @param {string} [containerId='plot-display-area'] - The ID of the container element to clear.
 */
function clearPreviousPlot(containerId = 'plot-display-area') {
    if (currentPlotInstance) {
        // Check if it's a Chart.js instance
        if (typeof currentPlotInstance.destroy === 'function') {
            currentPlotInstance.destroy();
        }
        // Check if it's a D3.js DOM element (like an SVG)
        else if (currentPlotInstance.nodeType) {
            currentPlotInstance.remove();
        }
    }
    
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = ''; // Ensure the correct container is emptied
    }
    
    currentPlotInstance = null; // Reset the variable
}



/**
 * Robustly extracts a clean array of values from a gene object.
 * @param {Object} gene - The gene object from the database.
 * @param {...string} keys - The possible keys to check for the data.
 * @returns {Array<string>} A clean array of strings.
 */
function getCleanArray(gene, ...keys) {
    let data = null;
    for (const key of keys) {
        if (gene[key] != null) {
            data = gene[key];
            break;
        }
    }
    if (data == null) return [];
    const separatorRegex = /[,;]/;
    const initialArray = Array.isArray(data) ? data : String(data).split(separatorRegex);

    return initialArray
        .filter(Boolean)
        .flatMap(item => String(item).split(separatorRegex))
        .map(item => item.trim())
        .filter(Boolean);
}

/**
 * Displays the main CiliaPlot analysis page with a redesigned layout, new features,
 * and integrated plot rendering functions.
 */
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    // Ensure the content area can take up full width
    contentArea.className = 'content-area content-area-full'; 
    document.querySelector('.cilia-panel').style.display = 'none';

    contentArea.innerHTML = `
    <script src="https://cdn.plot.ly/plotly-2.24.1.min.js" charset="utf-8"></script>

    <style>
        /* General Page Styles */
        .ciliaplot-page-container {
            font-family: Arial, sans-serif;
            color: #333;
            background-color: #f9f9f9;
            padding: 20px;
        }

        h1, h2, h3 {
            color: #1a237e; /* Dark blue for headers */
        }
        
        /* Explanation Section */
        .explanation-section {
            background-color: #e8eaf6;
            border-left: 5px solid #3f51b5;
            padding: 15px 20px;
            margin-bottom: 25px;
            border-radius: 5px;
        }

        .explanation-section h2 { margin-top: 0; font-size: 1.5em; }
        .explanation-section p { line-height: 1.6; }
        .explanation-section a { color: #303f9f; text-decoration: none; font-weight: bold; }
        .explanation-section a:hover { text-decoration: underline; }

        /* Main Layout Grid */
        .ciliaplot-main-layout {
            display: grid;
            grid-template-columns: 250px 1fr 2fr; /* Left | Middle | Right */
            gap: 20px;
            align-items: start;
        }

        /* Card Styling for Sections */
        .control-card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.05);
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .control-card h3 {
            margin-top: 0;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
            font-size: 1.2em;
        }

        /* Left Column: Plot Types */
        .plot-types-panel .plot-type-list { list-style: none; padding: 0; margin: 0; }
        .plot-types-panel .plot-type-list li { margin-bottom: 10px; }
        .plot-types-panel .plot-type-list label {
            display: block; padding: 12px 15px; border-radius: 5px; cursor: pointer;
            transition: background-color 0.3s, color 0.3s; border: 1px solid #ddd;
        }
        .plot-types-panel .plot-type-list input[type="radio"] { display: none; }
        .plot-types-panel .plot-type-list input[type="radio"]:checked + label {
            background-color: #3f51b5; color: white; font-weight: bold; border-color: #3f51b5;
        }
        .plot-types-panel .plot-type-list label:hover { background-color: #e8eaf6; }

        /* Middle Column: Input & Customization */
        .input-customization-panel label {
            display: block; font-weight: bold; margin-bottom: 8px; font-size: 0.9em; color: #555;
        }
        
        #ciliaplot-genes-input {
            width: 100%; min-height: 150px; padding: 10px; border-radius: 5px;
            border: 1px solid #ccc; font-family: 'Courier New', Courier, monospace;
            font-size: 1em; resize: vertical; margin-bottom: 15px;
        }
        
        #generate-plot-btn {
            width: 100%; padding: 12px; font-size: 1.1em; font-weight: bold;
            background-color: #4CAF50; color: white; border: none; border-radius: 5px;
            cursor: pointer; transition: background-color 0.3s;
        }
        #generate-plot-btn:hover { background-color: #45a049; }
        
        .customization-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
        }
        
        .customization-grid .form-group { display: flex; flex-direction: column; }
        .customization-grid input[type="number"], .customization-grid select {
            width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;
        }
        .radio-group label { font-weight: normal; display: inline-block; margin-right: 15px; }

        /* Right Column: Visualization & Table */
        .visualization-panel { position: sticky; top: 20px; }
        
        .plot-header { display: flex; justify-content: space-between; align-items: center; }
        .download-controls button {
            background-color: #3f51b5; color: white; border: none; padding: 8px 12px;
            border-radius: 4px; cursor: pointer;
        }
        .download-controls button:hover { background-color: #303f9f; }
        
        #plot-display-area {
            width: 100%; min-height: 450px; background-color: #fff;
            border: 2px dashed #ccc; border-radius: 8px; display: flex;
            align-items: center; justify-content: center; color: #888;
            font-size: 1.2em; margin-top: 10px;
        }
        
        .gene-input-table-container h3 { margin-bottom: 10px; margin-top: 25px; }
        .gene-input-table-container table {
            width: 100%; border-collapse: collapse; background-color: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .gene-input-table-container th, .gene-input-table-container td {
            border: 1px solid #ddd; padding: 10px; text-align: left;
        }
        .gene-input-table-container th { background-color: #f2f2f2; color: #333; }
        
    </style>

    <section class="ciliaplot-page-container">
        
        <div class="explanation-section">
             <h2>CiliaPlot: Visualize Your Ciliary Gene Sets</h2>
            <p>
                The CiliaHub database contains an updated list of over <strong>2200 Gold Standard Genes with Ciliary Functions</strong>.
                With CiliaPlot, users can perform powerful analyses on their own gene lists, such as those from CRISPR/Cas9 screenings. 
                You can visualize the subcellular localization of ciliary genes, identify enriched or depleted protein domains, and perform detailed functional analysis.
            </p>
        </div>

        <div class="ciliaplot-main-layout">
            
            <aside class="plot-types-panel">
                <div class="control-card">
                    <h3>Plot Types</h3>
                    <ul class="plot-type-list">
                        <li><input type="radio" id="plot-bubble" name="plot_type" value="bubble" checked><label for="plot-bubble">Key Localizations</label></li>
                        <li><input type="radio" id="plot-matrix" name="plot_type" value="matrix"><label for="plot-matrix">Gene-Localization Matrix</label></li>
                        <li><input type="radio" id="plot-domain" name="plot_type" value="domain_matrix"><label for="plot-domain">Gene-Domain Matrix</label></li>
                        <li><input type="radio" id="plot-functional" name="plot_type" value="functional_category"><label for="plot-functional">Functional Categories</label></li>
                        <li><input type="radio" id="plot-heatmap" name="plot_type" value="expression_heatmap"><label for="plot-heatmap">Expression Heatmap</label></li>
                    </ul>
                </div>
            </aside>

            <main class="input-customization-panel">
                <div class="control-card">
                    <h3>1. Gene Input</h3>
                    <textarea id="ciliaplot-genes-input" rows="10" placeholder="e.g., IFT88, CEP290, BBS1, ARL13B"></textarea>
                    <button id="generate-plot-btn">Generate Plot</button>
                </div>
                
                <div class="control-card">
                    <h3>2. Plot Customization</h3>
                    <div class="customization-grid">
                        <div class="form-group">
                            <label for="fig-width">Figure Width</label>
                            <input type="number" id="fig-width" value="6.0" step="0.1">
                        </div>
                        <div class="form-group">
                            <label for="fig-height">Figure Height</label>
                            <input type="number" id="fig-height" value="4.0" step="0.1">
                        </div>
                         <div class="form-group">
                            <label>X-Axis</label>
                             <div class="radio-group">
                                <input type="radio" id="xaxis-show" name="xaxis" value="show" checked><label for="xaxis-show">Show</label>
                                <input type="radio" id="xaxis-hide" name="xaxis" value="hide"><label for="xaxis-hide">Hide</label>
                            </div>
                        </div>
                        <div class="form-group">
                           <label>Y-Ticks</label>
                            <div class="radio-group">
                                <input type="radio" id="yticks-show" name="yticks" value="show" checked><label for="yticks-show">Show</label>
                                <input type="radio" id="yticks-hide" name="yticks" value="hide"><label for="yticks-hide">Hide</label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="font-family">Font Family</label>
                            <select id="font-family">
                                <option value="Arial">Arial</option>
                                <option value="Times New Roman">Times New Roman</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="title-fontsize">Title Font Size</label>
                            <input type="number" id="title-fontsize" value="18" step="1">
                        </div>
                        <div class="form-group">
                            <label for="xaxis-fontsize">X-Axis Font Size</label>
                            <input type="number" id="xaxis-fontsize" value="14" step="1">
                        </div>
                        <div class="form-group">
                            <label for="yaxis-fontsize">Y-Axis Font Size</label>
                            <input type="number" id="yaxis-fontsize" value="14" step="1">
                        </div>
                    </div>
                </div>
            </main>
            
            <aside class="visualization-panel">
                <div class="control-card">
                    <div class="plot-header">
                        <h3>Visualization</h3>
                        <div class="download-controls">
                            <button id="download-plot-btn">Download PNG</button>
                        </div>
                    </div>
                    <div id="plot-display-area" role="region" aria-live="polite">
                        Your plot will appear here
                    </div>
                </div>
                
                <div class="gene-input-table-container">
                    <h3>Gene Input Summary</h3>
                    <div id="gene-table-wrapper">
                        <table>
                            <thead>
                                <tr><th>#</th><th>Gene Symbol</th><th>Status</th></tr>
                            </thead>
                            <tbody id="gene-summary-tbody">
                                <tr><td colspan="3" style="text-align: center;">Enter genes to see summary...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </aside>

        </div>
    </section>
    `;

    // --- JAVASCRIPT LOGIC ---
    // This part should be executed after the innerHTML is loaded.
    
    // Mock Database: Simulates fetching data for genes.
    const MOCK_DB = {
        'IFT88': { localization: { 'Cilium': 0.9, 'Centrosome': 0.6 }, domains: ['TPR'], expression: { 'Kidney': 80, 'Brain': 60 } },
        'CEP290': { localization: { 'Transition Zone': 0.95, 'Centrosome': 0.8 }, domains: ['Coiled-coil', 'Protein Kinase'], expression: { 'Retina': 95, 'Kidney': 70 } },
        'BBS1': { localization: { 'BBSome': 0.9, 'Cilium': 0.5 }, domains: ['WD40'], expression: { 'Brain': 50, 'Fat': 40 } },
        'ARL13B': { localization: { 'Cilium': 0.85, 'Plasma Membrane': 0.4 }, domains: ['GTPase'], expression: { 'Brain': 90, 'Lung': 50 } },
        'NOTFOUND': { localization: {}, domains: [], expression: {} }
    };
    const ALL_LOCALIZATIONS = ['Cilium', 'Centrosome', 'Transition Zone', 'BBSome', 'Plasma Membrane'];
    const ALL_DOMAINS = ['TPR', 'Coiled-coil', 'Protein Kinase', 'WD40', 'GTPase'];
    const ALL_TISSUES = ['Kidney', 'Brain', 'Retina', 'Fat', 'Lung'];

    function getGeneData(geneSymbol) {
        return MOCK_DB[geneSymbol.toUpperCase()] || MOCK_DB['NOTFOUND'];
    }

    // Main plot generation router
    async function generateAnalysisPlots() {
        const plotArea = document.getElementById('plot-display-area');
        plotArea.innerHTML = '<em>Loading...</em>';

        const geneInput = document.getElementById('ciliaplot-genes-input').value;
        const genes = geneInput.split(/[\s,]+/).filter(g => g.length > 0);
        
        updateGeneSummaryTable(genes);

        if (genes.length === 0) {
            plotArea.innerHTML = 'Please enter at least one gene.';
            return;
        }

        const plotType = document.querySelector('input[name="plot_type"]:checked').value;
        const customization = getCustomizationSettings();

        // Clear previous plot
        Plotly.purge(plotArea);

        try {
            switch (plotType) {
                case 'bubble':
                    renderBubblePlot(genes, customization);
                    break;
                case 'matrix':
                    renderMatrixPlot(genes, customization, 'localization');
                    break;
                case 'domain_matrix':
                    renderMatrixPlot(genes, customization, 'domains');
                    break;
                case 'functional_category':
                    renderBarPlot(genes, customization);
                    break;
                case 'expression_heatmap':
                    renderHeatmap(genes, customization);
                    break;
                default:
                    plotArea.innerHTML = 'Selected plot type is not available yet.';
            }
        } catch (error) {
            console.error('Plotting Error:', error);
            plotArea.innerHTML = 'An error occurred while generating the plot.';
        }
    }

    function getCustomizationSettings() {
        return {
            width: parseFloat(document.getElementById('fig-width').value) * 100,
            height: parseFloat(document.getElementById('fig-height').value) * 100,
            font: {
                family: document.getElementById('font-family').value,
                size: 12
            },
            titleFontSize: parseInt(document.getElementById('title-fontsize').value, 10),
            xaxis: {
                visible: document.querySelector('input[name="xaxis"]:checked').value === 'show',
                titlefont: { size: parseInt(document.getElementById('xaxis-fontsize').value, 10) }
            },
            yaxis: {
                showticklabels: document.querySelector('input[name="yticks"]:checked').value === 'show',
                titlefont: { size: parseInt(document.getElementById('yaxis-fontsize').value, 10) }
            }
        };
    }

    function updateGeneSummaryTable(genes) {
        const tbody = document.getElementById('gene-summary-tbody');
        tbody.innerHTML = ''; // Clear existing rows
        if (genes.length === 0) {
             tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Enter genes to see summary...</td></tr>';
             return;
        }
        genes.forEach((gene, index) => {
            const data = getGeneData(gene);
            const status = (data === MOCK_DB['NOTFOUND']) ? 'Not Found' : 'Found';
            const row = `<tr><td>${index + 1}</td><td>${gene}</td><td>${status}</td></tr>`;
            tbody.innerHTML += row;
        });
    }

    // --- Specific Plot Rendering Functions ---

    function renderBubblePlot(genes, custom) {
        const plotData = [];
        genes.forEach(gene => {
            const data = getGeneData(gene);
            const localizations = Object.keys(data.localization);
            const scores = Object.values(data.localization);
            if (localizations.length > 0) {
                plotData.push({
                    x: localizations,
                    y: Array(localizations.length).fill(gene),
                    mode: 'markers',
                    marker: {
                        size: scores.map(s => s * 40), // Scale score to bubble size
                        color: scores,
                        colorscale: 'Viridis',
                        showscale: true
                    },
                    text: scores.map(s => `Score: ${s.toFixed(2)}`),
                    hoverinfo: 'x+y+text',
                    name: gene
                });
            }
        });

        const layout = {
            title: { text: 'Key Ciliary Localizations', font: { size: custom.titleFontSize } },
            xaxis: { title: 'Localization', visible: custom.xaxis.visible, titlefont: custom.xaxis.titlefont },
            yaxis: { title: 'Gene', showticklabels: custom.yaxis.showticklabels, titlefont: custom.yaxis.titlefont },
            width: custom.width, height: custom.height, font: custom.font, showlegend: false
        };
        Plotly.newPlot('plot-display-area', plotData, layout, {responsive: true});
    }
    
    function renderMatrixPlot(genes, custom, dataType = 'localization') {
        const yLabels = genes;
        const xLabels = (dataType === 'localization') ? ALL_LOCALIZATIONS : ALL_DOMAINS;
        const zValues = yLabels.map(gene => {
            const data = getGeneData(gene);
            return xLabels.map(label => {
                if (dataType === 'localization') {
                    return data.localization[label] || 0;
                }
                return data.domains.includes(label) ? 1 : 0;
            });
        });

        const data = [{
            x: xLabels, y: yLabels, z: zValues,
            type: 'heatmap', colorscale: 'Blues', showscale: true
        }];

        const title = (dataType === 'localization') ? 'Gene-Localization Matrix' : 'Gene-Domain Matrix';
        const layout = {
            title: { text: title, font: { size: custom.titleFontSize } },
            xaxis: { visible: custom.xaxis.visible, titlefont: custom.xaxis.titlefont },
            yaxis: { showticklabels: custom.yaxis.showticklabels, titlefont: custom.yaxis.titlefont },
            width: custom.width, height: custom.height, font: custom.font
        };
        Plotly.newPlot('plot-display-area', data, layout, {responsive: true});
    }
    
    function renderBarPlot(genes, custom) {
        const domainCounts = {};
        ALL_DOMAINS.forEach(d => domainCounts[d] = 0);
        
        genes.forEach(gene => {
            const data = getGeneData(gene);
            data.domains.forEach(domain => {
                if(domainCounts.hasOwnProperty(domain)) domainCounts[domain]++;
            });
        });
        
        const data = [{
            x: Object.keys(domainCounts),
            y: Object.values(domainCounts),
            type: 'bar',
            marker: { color: 'darkblue' }
        }];

        const layout = {
            title: { text: 'Functional Domain Counts', font: { size: custom.titleFontSize } },
            xaxis: { title: 'Protein Domain', visible: custom.xaxis.visible, titlefont: custom.xaxis.titlefont },
            yaxis: { title: 'Number of Genes', showticklabels: custom.yaxis.showticklabels, titlefont: custom.yaxis.titlefont },
            width: custom.width, height: custom.height, font: custom.font
        };
        Plotly.newPlot('plot-display-area', data, layout, {responsive: true});
    }

    function renderHeatmap(genes, custom) {
        const zValues = genes.map(gene => {
            const data = getGeneData(gene);
            return ALL_TISSUES.map(tissue => data.expression[tissue] || 0);
        });
        
        const data = [{
            x: ALL_TISSUES, y: genes, z: zValues,
            type: 'heatmap', colorscale: 'Reds'
        }];
        
        const layout = {
            title: { text: 'Tissue Expression Heatmap', font: { size: custom.titleFontSize } },
            xaxis: { title: 'Tissue', visible: custom.xaxis.visible, titlefont: custom.xaxis.titlefont },
            yaxis: { showticklabels: custom.yaxis.showticklabels, titlefont: custom.yaxis.titlefont },
            width: custom.width, height: custom.height, font: custom.font
        };
        Plotly.newPlot('plot-display-area', data, layout, {responsive: true});
    }

    function downloadPlot() {
        const gd = document.getElementById('plot-display-area');
        const plotType = document.querySelector('input[name="plot_type"]:checked').value;
        const filename = `CiliaPlot_${plotType}_${new Date().toISOString().slice(0,10)}`;
        Plotly.downloadImage(gd, {format: 'png', width: 1200, height: 800, filename: filename});
    }
    
    // Attach Event Listeners
    document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}

// To run this function and display the page:
// displayCiliaPlotPage();

// In plots.js 

async function generateAnalysisPlots() {
    console.log("--- CiliaPlot Generation Started ---");
    try {
        // Data should already be loaded, but we check the cache just in case.
        if (!geneMapCache || geneMapCache.size === 0) {
            console.error("CRITICAL: geneMapCache is empty. Data did not load on startup.");
            alert("Error: Gene database is not loaded. Please refresh the page.");
            return;
        }

        const plotContainer = document.getElementById('plot-display-area');
        const searchResultsContainer = document.getElementById('ciliaplot-search-results');
        const genesInput = document.getElementById('ciliaplot-genes-input').value.trim();

        if (!genesInput) {
            alert('Please enter a gene list.');
            return;
        }

        clearPreviousPlot();
        // Clear other containers
        if (searchResultsContainer) searchResultsContainer.innerHTML = '';
        const tableContainer = document.getElementById('plot-data-table-container');
        if (tableContainer) tableContainer.innerHTML = '';
        plotContainer.innerHTML = '<p class="status-message">Searching genes and generating plot...</p>';

        const sanitizedQueries = [...new Set(genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean).map(q => q.toUpperCase()))];
        console.log("1. Sanitized Input Queries:", sanitizedQueries);

        const { foundGenes, notFoundGenes } = findGenes(sanitizedQueries);
        console.log("2. Genes Found by findGenes():", foundGenes);
        console.log("   - Genes Not Found:", notFoundGenes);

        renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes);

        if (foundGenes.length === 0) {
            plotContainer.innerHTML = '<p class="status-message error">No valid genes were found to generate a plot.</p>';
            updateStatsAndLegend(document.getElementById('plot-type-select').value, []);
            console.log("--- CiliaPlot Generation Halted: No genes found. ---");
            return;
        }

        const plotType = document.getElementById('plot-type-select').value;
        console.log("3. Selected Plot Type:", plotType);
        
        updatePlotInfo(plotType);
        updateStatsAndLegend(plotType, foundGenes);

        console.log("4. Routing to plot function...");
        
        // Routing for plot generation
        switch (plotType) {
            case 'bubble':
                renderKeyLocalizations(foundGenes, plotContainer);
                break;
            case 'matrix':
                renderGeneMatrix(foundGenes, plotContainer);
                break;
            case 'domain_matrix':
                renderDomainMatrixPlot(foundGenes, plotContainer);
                break;
            case 'functional_category':
                renderFunctionalBarPlot(foundGenes, plotContainer, 'functional_category', 'Gene Count by Functional Category');
                break;
            case 'complex_chord':
                renderComplexChordPlot(foundGenes, plotContainer);
                break;
            case 'network':
                renderComplexNetwork(foundGenes, plotContainer);
                break;
            case 'expression_heatmap':
                renderExpressionHeatmap(foundGenes, plotContainer);
                break;
            case 'tissue_profile':
                renderTissueExpressionProfile(foundGenes, plotContainer);
                break;
            case 'top_tissues':
                renderTopExpressingTissues(foundGenes, plotContainer);
                break;
            case 'expression_violin':
                renderExpressionViolinPlot(foundGenes, plotContainer);
                break;
            case 'expression_localization':
                renderExpressionLocalizationBubble(foundGenes, plotContainer);
                break;
            case 'expression_domain_bubble':
                renderExpressionDomainBubblePlot(foundGenes, plotContainer);
                break;
            case 'organelle_radar':
                renderOrganelleRadarPlot(foundGenes, plotContainer);
                break;
            case 'organelle_umap':
                renderOrganelleUMAP(foundGenes, plotContainer);
                break;
            case 'screen_analysis':
                console.log("   -> Calling renderGeneScreenAnalysis...");
                renderGeneScreenAnalysis(foundGenes, plotContainer);
                break;
            default:
                plotContainer.innerHTML = `<p class="status-message">Plot type "${plotType}" is not yet implemented.</p>`;
                break;
        }
        console.log("--- CiliaPlot Generation Finished ---");

    } catch (error) {
        console.error('FATAL ERROR during plot generation:', error);
        document.getElementById('plot-display-area').innerHTML = `<p class="status-message error">A fatal error occurred: ${error.message}</p>`;
    }
}
/**
 * Updates the informational text box with a description of the current plot.
 * @param {string} plotType - The selected plot type.
 */
function updatePlotInfo(plotType) {
    const infoContainer = document.getElementById('ciliaplot-plot-info');
    if (!infoContainer) return;
    let infoHTML = '';
    switch (plotType) {
        case 'bubble':
            infoHTML = `<strong>Key Localizations:</strong> This bubble plot shows the distribution of your genes across primary ciliary and cellular compartments. The size of each bubble corresponds to the number of genes found in that location.`;
            break;
        case 'matrix':
            infoHTML = `<strong>Gene-Localization Matrix:</strong> This plot shows the specific localization for each gene in your list. A bubble indicates that a gene is associated with a particular ciliary compartment.`;
            break;
        case 'domain_matrix':
            infoHTML = `<strong>Gene-Domain Matrix:</strong> This plot shows which protein domains are present in each gene. This helps identify shared functional components among your selected genes.`;
            break;
        case 'functional_category':
            infoHTML = `<strong>Functional Categories (Bar):</strong> This chart categorizes your genes into broader functional groups by counting the number of genes per category, providing an overview of the biological processes they are involved in.`;
            break;
        case 'complex_chord':
            infoHTML = `<strong>Complex Interactions (Chord):</strong> This diagram visualizes relationships between genes based on shared membership in protein complexes. Each arc represents a gene, and ribbons connecting them indicate co-complex partnership.`;
            break;
        case 'network':
            infoHTML = `<strong>Protein Complex Network:</strong> This network graph visualizes known protein-protein interactions and complex memberships among your selected genes, revealing functional modules.`;
            break;
        case 'expression_heatmap':
            infoHTML = `<strong>Expression Heatmap:</strong> This plot displays the expression level (nTPM) of each selected gene across various human tissues. Darker colors indicate higher expression.`;
            break;
        case 'tissue_profile':
            infoHTML = `<strong>Tissue Expression Profile:</strong> This line chart shows the average expression of your gene set across the top 20 tissues, highlighting potential tissue-specific enrichment.`;
            break;
        case 'expression_violin':
            infoHTML = `<strong>Expression Distribution (Violin):</strong> This plot shows the distribution of expression levels (nTPM) for your gene set across different tissues. The width of the violin shape represents the density of genes at a particular expression level.`;
            break;
        case 'expression_localization':
            infoHTML = `<strong>Expression vs. Localization:</strong> This bubble plot correlates expression breadth (number of expressing tissues) with localization diversity. Bubble size represents the maximum expression level.`;
            break;
        case 'expression_domain_bubble':
            infoHTML = `<strong>Expression vs. Domains (Bubble):</strong> This plot correlates gene expression breadth (number of expressing tissues) with protein complexity (number of domains). The bubble size represents the gene's maximum expression level across all tissues.`;
            break;
        case 'top_tissues':
            infoHTML = `<strong>Top Expressing Tissues:</strong> This bar chart ranks tissues by the average expression level of your gene set, showing where these genes are most active.`;
            break;
        case 'organelle_radar':
            infoHTML = `<strong>Organellar Profile (Radar):</strong> This plot compares the average protein abundance profile of your gene set across simulated cellular fractions against known organellar markers (e.g., ER, Golgi, Cilia). It helps identify which organelle your gene set most closely resembles.`;
            break;
        case 'organelle_umap':
            infoHTML = `<strong>Organellar Projection (UMAP):</strong> This scatter plot shows a 2D representation of the entire organellar proteome, where proteins with similar abundance profiles cluster together. Your input genes are highlighted to show where they fall within these defined organellar clusters.`;
            break;
        case 'screen_analysis':
            infoHTML = `<strong>Gene Screen Data (Bubble):</strong> Bubble plot showing quantitative functional screening data for your selected genes. 
                        <ul>
                        <li>Data sources: Cilia-related RNAi or CRISPR screens from published papers.</li>
                        <li>X-axis: Screen dataset.</li>
                        <li>Y-axis: Mean % ciliated cells (or measured phenotype).</li>
                        <li>Bubble size: Z-score (effect size).</li>
                        <li>Bubble color: Classification (positive/negative regulator).</li>
                        <li>Tooltip: Gene name, dataset, mean phenotype, and paper link.</li>
                        </ul>`;
            break;
        default:
            infoHTML = `Select a plot type to see a description.`;
            break;
    }
    infoContainer.innerHTML = infoHTML;
}

/**
 * Updates the statistics and legend sections based on the plot type.
 * @param {string} plotType - The selected plot type.
 * @param {Array} foundGenes - The array of gene objects being plotted.
 */
function updateStatsAndLegend(plotType, foundGenes) {
    const statsContainer = document.getElementById('ciliaplot-stats-container');
    const legendContainer = document.getElementById('ciliaplot-legend-container');
    if (!statsContainer || !legendContainer) return;

    statsContainer.style.display = 'grid';
    legendContainer.style.display = 'flex';

    let statsHTML = '',
        legendHTML = '';
    statsHTML += `<div class="stat-box"><div class="stat-number">${foundGenes.length}</div><div class="stat-label">Input Genes Found</div></div>`;

    if (plotType === 'network') {
        const { links } = computeProteinComplexLinks(foundGenes);
        const complexSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'complex_names', 'complex')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${complexSet.size}</div><div class="stat-label">Unique Complexes</div></div><div class="stat-box"><div class="stat-number">${links.length}</div><div class="stat-label">Interactions</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: #3498db;"></div><span>Gene</span></div>`;
    } else if (plotType === 'complex_chord') {
        const genesInPlot = new Set();
        foundGenes.forEach(gene => {
            const geneComplexes = getCleanArray(gene, 'complex');
            if (geneComplexes.length > 0) {
                const hasPartner = foundGenes.some(otherGene => {
                    if (otherGene.gene === gene.gene) return false;
                    const otherComplexes = getCleanArray(otherGene, 'complex');
                    return geneComplexes.some(c => otherComplexes.includes(c));
                });
                if (hasPartner) genesInPlot.add(gene.gene);
            }
        });
        const complexSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'complex')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${genesInPlot.size}</div><div class="stat-label">Interacting Genes</div></div><div class="stat-box"><div class="stat-number">${complexSet.size}</div><div class="stat-label">Unique Complexes</div></div>`;
        legendContainer.style.display = 'none';
    } else if (plotType === 'functional_category') {
        const categorySet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'functional_category')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${categorySet.size}</div><div class="stat-label">Unique Categories</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: steelblue; border-radius: 4px;"></div><span>Gene Count</span></div>`;
    } else if (plotType === 'domain_matrix') {
        const domainSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'domain_descriptions')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${domainSet.size}</div><div class="stat-label">Unique Domains</div></div>`;
        legendContainer.style.display = 'none';
    } else if (plotType.includes('expression') || plotType === 'top_tissues' || plotType === 'tissue_profile') {
        const genesWithExpr = foundGenes.filter(g => expressionData[g.gene.toUpperCase()]);
        statsHTML += `<div class="stat-box"><div class="stat-number">${genesWithExpr.length}</div><div class="stat-label">Genes with Expression Data</div></div>`;
        legendContainer.style.display = 'none';
    } else {
        const localizations = new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization'))).size;
        statsHTML += `<div class="stat-box"><div class="stat-number">${localizations}</div><div class="stat-label">Unique Localizations</div></div>`;
        legendContainer.style.display = 'none';
    }
    statsContainer.innerHTML = statsHTML;
    legendContainer.innerHTML = legendHTML;
}

// =============================================================================
// NEW PLOT RENDERER FUNCTIONS
// =============================================================================

/** Renders a violin plot of gene expression distribution. */
function renderExpressionViolinPlot(foundGenes, container) {
    clearPreviousPlot(container.id);
    const settings = getPlotSettings();
    const genesWithExpr = foundGenes.filter(g => expressionData[g.gene.toUpperCase()]);
    if (genesWithExpr.length === 0) {
        container.innerHTML = '<p class="status-message error">No expression data found for the input genes.</p>';
        return;
    }
    const plotData = genesWithExpr.map(g => ({
        gene: g.gene.toUpperCase(),
        ...expressionData[g.gene.toUpperCase()]
    }));
    violinPlot(genesWithExpr, container.id, plotData, settings);
}

/** Renders a bar plot for a given categorical field. */
function renderFunctionalBarPlot(foundGenes, container, categoryField, title) {
    clearPreviousPlot(container.id);
    const settings = getPlotSettings();
    settings.title = title;
    if (foundGenes.length === 0) {
        container.innerHTML = '<p class="status-message error">No genes to plot.</p>';
        return;
    }
    barPlot(foundGenes, container.id, categoryField, settings);
}

/** Renders a chord diagram of protein complex interactions. */
function renderComplexChordPlot(foundGenes, container) {
    clearPreviousPlot(container.id);
    const settings = getPlotSettings();

    const genesWithComplexComponents = foundGenes
        .map(gene => {
            const geneComplexes = getCleanArray(gene, 'complex');
            if (geneComplexes.length === 0) return null;
            let components = new Set([gene.gene]);
            foundGenes.forEach(otherGene => {
                if (otherGene.gene !== gene.gene) {
                    const otherComplexes = getCleanArray(otherGene, 'complex');
                    if (geneComplexes.some(c => otherComplexes.includes(c))) {
                        components.add(otherGene.gene);
                    }
                }
            });
            return { ...gene, complex_components: Array.from(components) };
        })
        .filter(Boolean)
        .filter(g => g.complex_components.length > 1);

    if (genesWithComplexComponents.length < 2) {
        container.innerHTML = '<p class="status-message error">At least two genes sharing a complex are needed to draw interactions.</p>';
        return;
    }
    chordPlot(genesWithComplexComponents, container.id, settings);
}

/** Renders a bubble plot correlating expression breadth, domain count, and max expression. */
function renderExpressionDomainBubblePlot(foundGenes, container) {
    clearPreviousPlot(container.id);
    const settings = getPlotSettings();
    const genesWithExpr = foundGenes.filter(g => expressionData[g.gene.toUpperCase()]);
    if (genesWithExpr.length === 0) {
        container.innerHTML = '<p class="status-message error">No expression data found for the input genes.</p>';
        return;
    }
    const expressionArray = Object.entries(expressionData).map(([gene, tissues]) => ({
        gene, ...tissues
    }));
    expressionDomainBubblePlot(genesWithExpr, container.id, expressionArray, settings);
}

// =============================================================================
// PLOT CUSTOMIZATION & DOWNLOAD
// =============================================================================

function getPlotSettings() {
    const setting = (id, def) => document.getElementById(id)?.value || def;
    return {
        fontFamily: setting('setting-font-family', 'Arial'),
        fontColor: setting('setting-font-color', '#333333'),
        titleFontSize: parseInt(setting('setting-title-font-size', 21)),
        axisTitleFontSize: parseInt(setting('setting-axis-title-font-size', 20)),
        tickFontSize: parseInt(setting('setting-tick-font-size', 20)),
        axisLineWidth: parseFloat(setting('setting-axis-line-width', 2)),
        axisLineColor: setting('setting-axis-line-color', '#333333'),
        backgroundColor: setting('setting-bg-color', '#ffffff'),
        gridColor: setting('setting-grid-color', '#e0e0e0'),
        showGrid: document.getElementById('setting-show-grid')?.checked ?? false,
    };
}

async function downloadPlot() {
    const format = document.getElementById('download-format')?.value || 'png';
    const plotArea = document.getElementById('plot-display-area');
    const plotType = document.getElementById('plot-type-select')?.value;
    if (!plotArea.firstChild || !plotType || plotArea.querySelector('.status-message')) {
        alert("Please generate a plot first.");
        return;
    }
    const fileName = `CiliaHub_${plotType}_plot.${format}`;
    const scale = 3;
    const width = plotArea.clientWidth;
    const height = plotArea.clientHeight;
    try {
        let dataUrl;
        const backgroundColor = getPlotSettings().backgroundColor;
        if (plotArea.querySelector('canvas')) {
            const tempCanvas = document.createElement('canvas');
            const sourceCanvas = plotArea.querySelector('canvas');
            tempCanvas.width = sourceCanvas.width;
            tempCanvas.height = sourceCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');

            if (backgroundColor !== 'transparent') {
                tempCtx.fillStyle = backgroundColor;
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            }
            tempCtx.drawImage(sourceCanvas, 0, 0);
            dataUrl = tempCanvas.toDataURL('image/png');

        } else if (plotArea.querySelector('svg')) {
            const svgElement = plotArea.querySelector('svg');
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            if (backgroundColor !== 'transparent') {
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            const img = new Image();
            const svgBlob = new Blob([new XMLSerializer().serializeToString(svgElement)], {
                type: "image/svg+xml;charset=utf-8"
            });
            const url = URL.createObjectURL(svgBlob);
            await new Promise((resolve, reject) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    dataUrl = canvas.toDataURL('image/png');
                    resolve();
                };
                img.onerror = reject;
                img.src = url;
            });
        }
        if (!dataUrl) throw new Error("Could not generate image data.");
        if (format === 'png') {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            a.click();
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

// =============================================================================
// PLOTTING FUNCTIONS: LOCALIZATION, DOMAIN & NETWORK
// =============================================================================

function renderKeyLocalizations(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }
    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome', 'Microtubules', 'Endoplasmic Reticulum', 'Flagella', 'Cytosol', 'Lysosome', 'Autophagosomes', 'Ribosome', 'Nucleus', 'P-body', 'Peroxisome'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            const match = yCategories.find(cat => cat.toLowerCase() === loc.toLowerCase());
            if (match) localizationCounts[match] = (localizationCounts[match] || 0) + 1;
        });
    });
    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (!categoriesWithData.length) {
        container.innerHTML = '<p class="status-message">No genes in primary ciliary localizations.</p>';
        return;
    }
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Gene Count',
                data: categoriesWithData.map(loc => ({
                    x: localizationCounts[loc],
                    y: loc,
                    r: 8 + localizationCounts[loc] * 2,
                    count: localizationCounts[loc]
                })),
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Key Ciliary Localizations", font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: {
                    title: { display: true, text: "Gene Count", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor }
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: "Cellular Compartment", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor }
                }
            }
        }
    });
}

// NOTE: This matrix plot and the domain matrix plot could be merged into a single,
// customizable component to reduce redundancy, as they share the same structure.
function renderGeneMatrix(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes to display.</p>';
        return;
    }
    const yCategories = [...new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization')))]
        .filter(Boolean)
        .map(loc => loc.charAt(0).toUpperCase() + loc.slice(1))
        .sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    if (yCategories.length === 0) {
        container.innerHTML = '<p class="status-message">Selected genes have no localization data.</p>';
        return;
    }
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: foundGenes.map((gene, index) => ({
                label: gene.gene,
                data: getCleanArray(gene, 'localization').map(loc => ({
                    x: gene.gene,
                    y: loc.charAt(0).toUpperCase() + loc.slice(1),
                    r: 10
                })),
                backgroundColor: d3.schemeTableau10[index % 10]
            }))
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Gene Localization Matrix", font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.y}` } }
            },
            scales: {
                x: {
                    type: 'category', labels: xLabels,
                    title: { display: true, text: "Genes", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, maxRotation: 90, minRotation: 45 }
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: "Ciliary Compartment", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

function renderDomainMatrixPlot(foundGenes, container) {
    clearPreviousPlot();
    // TODO: Enhance this plot by adding domain enrichment statistics (e.g., via a hypergeometric test)
    // to make the output more suitable for publication.
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes to display.</p>';
        return;
    }
    
    const allDomains = [...new Set(foundGenes.flatMap(g => getCleanArray(g, 'domain_descriptions')))];
    if (allDomains.length === 0) {
        container.innerHTML = '<p class="status-message">No domain description data found for the selected genes.</p>';
        return;
    }

    const yLabelMap = new Map(allDomains.map(domain => [
        domain,
        domain.length > 50 ? domain.substring(0, 47) + '...' : domain
    ]));

    const yCategories = [...yLabelMap.values()].sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: foundGenes.map((gene, index) => ({
                label: gene.gene,
                data: getCleanArray(gene, 'domain_descriptions').map(domain => ({
                    x: gene.gene,
                    y: yLabelMap.get(domain),
                    r: 10
                })),
                backgroundColor: d3.schemeCategory10[index % 10]
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Genes vs. Domain Descriptions", font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${[...yLabelMap.entries()].find(([k,v]) => v === c.raw.y)[0]}` } }
            },
            scales: {
                x: {
                    type: 'category', labels: xLabels,
                    title: { display: true, text: "Genes", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, maxRotation: 90, minRotation: 45 }
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: "Domain Description", font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

function renderFunctionalCategoryPlot(foundGenes, container) {
    clearPreviousPlot();
    // TODO: To align with publication standards, replace raw gene counts with
    // statistical enrichment results (e.g., p-values from a GO/KEGG analysis).
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }

    const categoryCounts = new Map();
    foundGenes.forEach(gene => {
        const categories = getCleanArray(gene, 'functional_category');
        categories.forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });

    if (categoryCounts.size === 0) {
        container.innerHTML = '<p class="status-message">No functional category data found for the selected genes.</p>';
        return;
    }

    const sortedData = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
    
    const labels = sortedData.map(item => {
        const label = item[0];
        return label.length > 45 ? label.substring(0, 42) + '...' : label;
    });
    const data = sortedData.map(item => item[1]);

    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gene Count',
                data: data,
                backgroundColor: 'rgba(26, 188, 156, 0.7)',
                borderColor: 'rgba(26, 188, 156, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Functional Category Distribution', font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
              tooltip: { callbacks: { title: (c) => sortedData[c[0].dataIndex][0] } } // Show full title on hover
            },
            scales: {
                x: {
                    title: { display: true, text: 'Number of Genes', font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, stepSize: 1 }
                },
                y: {
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

function computeProteinComplexLinks(foundGenes) {
    const nodes = foundGenes.map(gene => ({ id: gene.gene }));
    const complexMap = new Map();
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'complex_names', 'complex').forEach(complex => {
            if (!complexMap.has(complex)) {
                complexMap.set(complex, new Set());
            }
            complexMap.get(complex).add(gene.gene);
        });
    });
    const linkMap = new Map();
    complexMap.forEach((genes) => {
        const geneArray = Array.from(genes);
        for (let i = 0; i < geneArray.length; i++) {
            for (let j = i + 1; j < geneArray.length; j++) {
                const key = [geneArray[i], geneArray[j]].sort().join('-');
                if (linkMap.has(key)) {
                    linkMap.get(key).value += 1;
                } else {
                    linkMap.set(key, { source: geneArray[i], target: geneArray[j], value: 1 });
                }
            }
        }
    });
    return { nodes, links: Array.from(linkMap.values()) };
}

function renderComplexNetwork(foundGenes, container) {
    clearPreviousPlot();
    // TODO: Add advanced features like network clustering (e.g., Louvain) and an
    // "Export to Cytoscape" option for publication-quality figure generation.
    const settings = getPlotSettings();
    const { nodes, links } = computeProteinComplexLinks(foundGenes);
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found among the selected genes.</p>';
        return;
    }

    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);
    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
    svg.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", settings.backgroundColor);

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line").style("stroke", "#999").style("stroke-opacity", 0.6).style("stroke-width", d => Math.sqrt(d.value) * 2);

    const nodeGroup = svg.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag().on("start", (e, d) => {
        if (!e.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }).on("drag", (e, d) => {
        d.fx = e.x; d.fy = e.y;
    }).on("end", (e, d) => {
        if (!e.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }));

    nodeGroup.append("circle").attr("r", 10).style("fill", "#3498db").style("stroke", "#fff").style("stroke-width", 2);
    
    nodeGroup.append("text")
        .text(d => d.id.length > 12 ? d.id.substring(0, 9) + '...' : d.id)
        .attr("x", 15).attr("y", 5)
        .style("font-family", settings.fontFamily)
        .style("font-size", "12px")
        .style("fill", settings.fontColor);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    currentPlotInstance = svg.node();
}

// =============================================================================
// PLOTTING FUNCTIONS: EXPRESSION ANALYSIS
// =============================================================================

/**
 * Get expression data for a specific gene from the global variable.
 */
function getGeneExpression(geneName) {
    return expressionData[geneName.toUpperCase()] || {};
}

/**
 * Get the master list of tissue names.
 */
function getTissueNames() {
    if (typeof tissueNames !== 'undefined' && tissueNames.length > 0) return tissueNames;
    if (Object.keys(expressionData).length > 0) {
        const firstGene = Object.keys(expressionData)[0];
        return Object.keys(expressionData[firstGene]);
    }
    return [];
}

/**
 * REVISED: Calculate expression statistics, now including standard deviation.
 */
function calculateExpressionStats(genes) {
    const tissues = getTissueNames();
    const stats = { meanExpression: {}, medianExpression: {}, maxExpression: {}, geneCount: {}, stdDevExpression: {} };
    tissues.forEach(tissue => {
        const values = genes.map(gene => {
            const expr = getGeneExpression(gene.gene);
            return expr && expr[tissue] !== undefined && expr[tissue] !== null ? expr[tissue] : 0;
        }).filter(v => v > 0);
        if (values.length > 0) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            stats.meanExpression[tissue] = mean;
            stats.medianExpression[tissue] = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
            stats.maxExpression[tissue] = Math.max(...values);
            stats.geneCount[tissue] = values.length;
            const sumSq = values.reduce((a, b) => a + (b * b), 0);
            stats.stdDevExpression[tissue] = values.length > 1 ? Math.sqrt((sumSq - (mean * mean * values.length)) / (values.length - 1)) : 0;
        } else {
            stats.meanExpression[tissue] = 0;
            stats.medianExpression[tissue] = 0;
            stats.maxExpression[tissue] = 0;
            stats.geneCount[tissue] = 0;
            stats.stdDevExpression[tissue] = 0;
        }
    });
    return stats;
}

// In plots.js, replace the old function with this one

/**
 * Renders an expression heatmap with corrected positioning for the new dashboard layout.
 */
function renderExpressionHeatmap(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();

    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available for selected genes.</p>';
        return;
    }

    const tissues = getTissueNames();
    const genesWithExpression = foundGenes.filter(gene => Object.keys(getGeneExpression(gene.gene)).length > 0);

    if (genesWithExpression.length === 0) {
        container.innerHTML = '<p class="status-message">None of the selected genes have expression data.</p>';
        return;
    }

    // Prepare data and calculate max expression
    let maxExpression = 0;
    const heatmapData = [];
    genesWithExpression.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        const maxGeneExpr = Math.max(0, ...Object.values(expr));
        maxExpression = Math.max(maxExpression, maxGeneExpr);
        tissues.forEach(tissue => {
            heatmapData.push({ gene: gene.gene, tissue: tissue, expression: expr[tissue] || 0 });
        });
    });

    // --- FIX: Revised Sizing and Margins for the new layout ---
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const margin = { top: 60, right: 100, bottom: 150, left: 120 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = d3.select(container).append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3.scaleBand().domain(tissues).range([0, width]).padding(0.05);
    const yScale = d3.scaleBand().domain(genesWithExpression.map(g => g.gene)).range([0, height]).padding(0.05);
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, maxExpression]);

    // Draw heatmap rectangles
    svg.selectAll('.heatmap-rect')
       .data(heatmapData)
       .enter()
       .append('rect')
       .attr('class', 'heatmap-rect')
       .attr('x', d => xScale(d.tissue))
       .attr('y', d => yScale(d.gene))
       .attr('width', xScale.bandwidth())
       .attr('height', yScale.bandwidth())
       .attr('fill', d => colorScale(d.expression || 0));

    // Draw Axes
    // X-Axis
    svg.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'translate(-10,0)rotate(-45)')
        .style('text-anchor', 'end');
    
    // Y-Axis (The missing axis)
    svg.append('g')
       .call(d3.axisLeft(yScale));
       
    // --- FIX: Correctly positioned axis labels ---
    // X-Axis Label
    d3.select(container).select('svg').append('text')
        .attr('text-anchor', 'middle')
        .attr('x', margin.left + width / 2)
        .attr('y', containerHeight - margin.bottom / 2 + 30)
        .text('Tissues')
        .attr('font-weight', 'bold');

    // Y-Axis Label
    d3.select(container).select('svg').append('text')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('y', margin.left / 2 - 20)
        .attr('x', -(margin.top + height / 2))
        .text('Genes')
        .attr('font-weight', 'bold');

    // --- FIX: Robust color legend (the missing bar) ---
    const legendWidth = 20, legendHeight = height / 2;
    const legendX = width + 40; // Position it inside the right margin
    const legendY = height / 4;

    const legend = svg.append('g').attr('transform', `translate(${legendX}, ${legendY})`);
    const defs = legend.append('defs');
    const linearGradient = defs.append('linearGradient').attr('id', 'legend-gradient').attr('gradientTransform', 'rotate(90)');
    linearGradient.selectAll('stop')
        .data(colorScale.ticks().map((t, i, n) => ({ offset: `${100*i/n.length}%`, color: colorScale(t) })))
        .enter().append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);

    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)');

    const legendScale = d3.scaleLinear().domain(colorScale.domain()).range([legendHeight, 0]);
    legend.append('g')
        .attr('transform', `translate(${legendWidth}, 0)`)
        .call(d3.axisRight(legendScale).ticks(5));
    
    currentPlotInstance = d3.select(container).select('svg').node();
}

/**
 * REPLACED: Renders a tissue expression profile as a line chart instead of a radar chart.
 * This version is better for comparing across many categories and is more conventional
 * for scientific publications.
 */
function renderTissueExpressionProfile(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const validTissues = tissues.filter(tissue => {
        const isValid = foundGenes.some(gene => {
            const expr = getGeneExpression(gene.gene);
            return expr && typeof expr[tissue] !== 'undefined' && expr[tissue] !== null;
        });
        if (!isValid) console.warn(`Tissue "${tissue}" not found in expression data for any gene.`);
        return isValid;
    });
    
    if (!validTissues.length) {
        container.innerHTML = '<p class="status-message">No valid tissue data for selected genes.</p>';
        return;
    }
    
    const stats = calculateExpressionStats(foundGenes);
    
    // Sort by mean expression, limit to top 20 for readability
    const sortedTissues = validTissues.sort((a, b) => (stats.meanExpression[b] || 0) - (stats.meanExpression[a] || 0));
    const displayTissues = sortedTissues.slice(0, Math.min(20, sortedTissues.length));
    
    const labels = displayTissues.map(tissue => tissue.replace(/(.{15})/g, "$1\n"));
    const means = displayTissues.map(tissue => stats.meanExpression[tissue] || 0);
    const stdDevs = displayTissues.map(tissue => stats.stdDevExpression[tissue] || 0);
    const geneCounts = displayTissues.map(tissue => stats.geneCount[tissue] || 0);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Mean Expression (±SD, ${foundGenes.length} genes)`,
                data: means,
                backgroundColor: 'rgba(31, 120, 180, 0.2)', // Colorblind-friendly blue
                borderColor: 'rgba(31, 120, 180, 1)',
                borderWidth: 3,
                pointBackgroundColor: 'rgba(31, 120, 180, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: 'Tissue Expression Profile (Top 20 Tissues)', 
                    font: { size: settings.titleFontSize + 4, family: 'Helvetica', weight: 'bold' },
                    color: '#333333'
                },
                legend: { 
                    display: true, position: 'top',
                    labels: { font: { size: settings.tickFontSize, family: 'Helvetica' }, color: '#333333' }
                },
                tooltip: {
                    callbacks: {
                        title: (context) => displayTissues[context[0].dataIndex],
                        label: (context) => [
                            `Mean: ${means[context.dataIndex].toFixed(2)}`,
                            `SD: ${stdDevs[context.dataIndex].toFixed(2)}`,
                            `Genes: ${geneCounts[context.dataIndex]}`
                        ]
                    },
                    bodyFont: { size: 14 }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, text: 'Tissues (Sorted by Expression)', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' },
                        color: '#333333'
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' },
                        color: '#333333', maxRotation: 90, minRotation: 45, padding: 10
                    }
                },
                y: {
                    title: { 
                        display: true, text: 'Mean Expression (nTPM)', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' },
                        color: '#333333'
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' },
                        color: '#333333'
                    },
                    beginAtZero: true
                }
            },
            elements: { line: { tension: 0.1 } }
        }
    });
}

/**
 * IMPROVED: Renders a bubble plot with conditional gene labels.
 */
function renderExpressionLocalizationBubble(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const expressionThreshold = 1.0;
    
    const bubbleData = foundGenes.map(gene => {
        const geneExpr = getGeneExpression(gene.gene);
        const expressingTissues = tissues.filter(tissue => (geneExpr[tissue] || 0) > expressionThreshold);
        const maxExpression = Math.max(0, ...Object.values(geneExpr));
        const localizations = getCleanArray(gene, 'localization');
        
        return {
            x: expressingTissues.length,
            y: localizations.length,
            r: Math.max(5, Math.min(25, Math.sqrt(maxExpression) * 3)),
            gene: gene.gene,
            maxExpression: maxExpression,
            localizations: localizations.join(', ')
        };
    }).filter(d => d.x > 0 || d.y > 0);
    
    if (bubbleData.length === 0) {
        container.innerHTML = '<p class="status-message">No expression or localization data found for selected genes.</p>';
        return;
    }
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Genes',
                data: bubbleData,
                backgroundColor: 'rgba(155, 89, 182, 0.6)',
                borderColor: 'rgba(155, 89, 182, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Expression Breadth vs Localization Diversity', font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: context => context[0].raw.gene,
                        label: context => [
                            `Expressing tissues: ${context.raw.x}`,
                            `Localizations: ${context.raw.y}`,
                            `Max expression: ${context.raw.maxExpression.toFixed(1)}`,
                            `Locations: ${context.raw.localizations || 'None'}`
                        ]
                    }
                },
                // NEW: Configuration for the datalabels plugin
                datalabels: {
                    // Only display labels if 15 or fewer genes are plotted
                    display: context => context.chart.data.datasets[0].data.length <= 15 ? 'auto' : false,
                    color: '#2c3e50',
                    anchor: 'end',
                    align: 'top',
                    offset: 4,
                    font: {
                        size: 12,
                        weight: 'bold',
                        family: settings.fontFamily
                    },
                    formatter: (value, context) => {
                        // Use the gene name for the label
                        return value.gene;
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Number of Expressing Tissues (>1.0 nTPM)', font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, stepSize: 1 }
                },
                y: {
                    title: { display: true, text: 'Number of Subcellular Localizations', font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, stepSize: 1 }
                }
            }
        }
    });
}
// In plots.js, use these three functions for all CiliaPlot tables

/**
 * Renders a plot-specific data table (e.g., for Expression vs. Localization).
 * This function uses your specified CSS classes.
 */
function renderGeneDataTable(foundGenes, container) {
    if (!container || !foundGenes.length) {
        if (container) container.innerHTML = ''; // Clear if no data
        return;
    }

    // Uses the .table-title class from your CSS
    let tableHTML = `<h3 class="table-title">Gene Data Summary</h3>`;
    
    // Uses the .table-responsive and .data-summary-table classes
    tableHTML += `
        <div class="table-responsive">
            <table class="data-summary-table">
                <thead>
                    <tr>
                        <th>Gene</th>
                        <th>ENSG ID</th>
                        <th>Localizations</th>
                        <th>Max Expression (nTPM)</th>
                    </tr>
                </thead>
                <tbody>`;

    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization').join(', ') || 'N/A';
        const geneExpr = getGeneExpression(gene.gene);
        const maxExpression = Math.max(0, ...Object.values(geneExpr));
        tableHTML += `
            <tr>
                <td><strong>${gene.gene}</strong></td>
                <td>${gene.ensembl_id || 'N/A'}</td>
                <td>${localizations}</td>
                <td>${maxExpression.toFixed(2)}</td>
            </tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
}

function renderFoundNotFoundTable(queries, foundGenes, container) {
    if (!container) return;

    const foundSet = new Set(foundGenes.map(g => g.gene.toUpperCase()));

    // Add a download button to the HTML
    let tableHTML = `
        <div class="table-header-controls">
            <h3 class="table-title">Input Genes Status</h3>
            <button id="download-status-csv-btn" class="btn btn-secondary">Download CSV</button>
        </div>`;
    
    tableHTML += `
        <div class="table-responsive">
            <table class="data-summary-table">
                <thead>
                    <tr>
                        <th>Input Gene</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>`;

    queries.forEach(query => {
        const isFound = foundSet.has(query);
        const statusText = isFound ? 'Found' : 'Not Found';
        const statusClass = isFound ? 'status-found' : 'status-not-found';
        tableHTML += `
            <tr>
                <td>${query}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
            </tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;

    // --- Add event listener for the new download button ---
    const downloadBtn = document.getElementById('download-status-csv-btn');
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            // 1. Create CSV content
            let csvContent = "data:text/csv;charset=utf-8,Input Gene,Status\n";
            queries.forEach(query => {
                const status = foundSet.has(query) ? 'Found' : 'Not Found';
                csvContent += `${query},${status}\n`;
            });

            // 2. Trigger download
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "gene_status_report.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    }
}

/**
 * Renders the main gene query summary table at the bottom of the page.
 * This function also uses your specified CSS classes.
 */
function renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes) {
    const resultDiv = document.getElementById('ciliaplot-search-results');
    if (!resultDiv) return;

    if (foundGenes.length === 0 && notFoundGenes.length === 0) {
        resultDiv.innerHTML = '';
        return;
    }
    
    // Uses the .table-title class
    let html = `<h3 class="table-title">Gene Query Summary</h3>`;

    if (foundGenes.length > 0) {
        // Uses the .table-responsive and .data-summary-table classes
        html += `
            <div class="table-responsive">
                <table class="data-summary-table">
                    <thead>
                        <tr>
                            <th>Gene</th>
                            <th>Ensembl ID</th>
                            <th>Localization Summary</th>
                        </tr>
                    </thead>
                    <tbody>`;
        foundGenes.forEach(item => {
            const localizationText = getCleanArray(item, 'localization').join(', ') || 'N/A';
            html += `
                <tr>
                    <td><a href="/#/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
                    <td>${item.ensembl_id || 'N/A'}</td>
                    <td>${localizationText}</td>
                </tr>`;
        });
        html += '</tbody></table></div>';
    }

    if (notFoundGenes && notFoundGenes.length > 0) {
        // Uses the .not-found-genes class
        html += `
            <div class="not-found-genes">
                <h4>Genes Not Found (${notFoundGenes.length}):</h4>
                <p>${notFoundGenes.join(', ')}</p>
            </div>`;
    }

    resultDiv.innerHTML = html;
}

/**
 * Renders a bar chart of the top expressing tissues.
 */
function renderTopExpressingTissues(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const stats = calculateExpressionStats(foundGenes);
    
    const tissueData = tissues.map(tissue => ({
        tissue: tissue,
        meanExpression: stats.meanExpression[tissue],
        geneCount: stats.geneCount[tissue]
    })).filter(d => d.meanExpression > 0)
      .sort((a, b) => b.meanExpression - a.meanExpression)
      .slice(0, 20); 
    
    if (tissueData.length === 0) {
        container.innerHTML = '<p class="status-message">No tissues with expression found for selected genes.</p>';
        return;
    }
    
    const labels = tissueData.map(d => d.tissue.length > 20 ? d.tissue.substring(0, 17) + '...' : d.tissue);
    const data = tissueData.map(d => d.meanExpression);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Mean Expression',
                data: data,
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: `Top Expressing Tissues (${foundGenes.length} genes)`, font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const tissueInfo = tissueData[index];
                            return `Mean Expression: ${context.parsed.x.toFixed(2)} (${tissueInfo.geneCount} genes)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Mean Expression Level (nTPM)', font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                },
                y: {
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: Math.max(10, settings.tickFontSize - 2), family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}




// =============================================================================
// SIMULATED PROTEOMICS DATA FOR ADVANCED PLOTS
// =============================================================================

// This data simulates quantitative profiles for known organellar markers.
// Each array represents normalized abundance across 8 fictional cellular fractions.
const organelleMarkerProfiles = {
    "Cilia":         [0.1, 0.1, 0.2, 0.8, 0.9, 0.6, 0.2, 0.1],
    "Basal Body":    [0.1, 0.2, 0.7, 0.9, 0.8, 0.3, 0.1, 0.1],
    "Mitochondrion": [0.8, 0.9, 0.7, 0.2, 0.1, 0.1, 0.2, 0.3],
    "Nucleus":       [0.9, 0.8, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1],
    "ER":            [0.2, 0.4, 0.8, 0.3, 0.2, 0.1, 0.5, 0.7],
    "Golgi":         [0.1, 0.2, 0.5, 0.2, 0.2, 0.2, 0.8, 0.9],
    "Cytosol":       [0.4, 0.5, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3]
};
const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];

// This data simulates pre-computed UMAP coordinates for a set of proteins.
// This would typically be calculated from the high-dimensional proteomics data.
const precomputedUMAP = {
    // Each key is an organelle, containing an array of {gene, x, y} points
    "Cilia": Array.from({length: 50}, (_, i) => ({gene: `CILGEN${i}`, x: 8 + Math.random()*2, y: 8 + Math.random()*2})),
    "Basal Body": Array.from({length: 40}, (_, i) => ({gene: `BBGEN${i}`, x: 6 + Math.random()*2, y: 7 + Math.random()*2})),
    "Mitochondrion": Array.from({length: 60}, (_, i) => ({gene: `MTGEN${i}`, x: 1 + Math.random()*2, y: 2 + Math.random()*2})),
    "Nucleus": Array.from({length: 70}, (_, i) => ({gene: `NUCGEN${i}`, x: 9 + Math.random()*1.5, y: 1 + Math.random()*2})),
    "ER": Array.from({length: 50}, (_, i) => ({gene: `ERGEN${i}`, x: 2 + Math.random()*2, y: 8 + Math.random()*2})),
    "Golgi": Array.from({length: 40}, (_, i) => ({gene: `GOLGEN${i}`, x: 1 + Math.random()*2, y: 6 + Math.random()*2})),
    "Cytosol": Array.from({length: 80}, (_, i) => ({gene: `CYTGEN${i}`, x: 5 + Math.random()*3, y: 4 + Math.random()*3})),
};

// =============================================================================
// NEW PLOTTING FUNCTIONS: RADAR and UMAP
// =============================================================================

/**
 * Renders a Radar plot comparing the user's gene set profile to known organellar markers.
 */
function renderOrganelleRadarPlot(foundGenes, container) {
    clearPreviousPlot();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();

    // Calculate the average profile for the user's gene set based on localization
    const userProfile = new Array(fractionLabels.length).fill(0);
    let contributingGenes = 0;
    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        let geneAdded = false;
        localizations.forEach(loc => {
            const matchedProfile = Object.keys(organelleMarkerProfiles).find(key => loc.toLowerCase().includes(key.toLowerCase()));
            if (matchedProfile) {
                const profile = organelleMarkerProfiles[matchedProfile];
                profile.forEach((val, i) => userProfile[i] += val);
                geneAdded = true;
            }
        });
        if (geneAdded) contributingGenes++;
    });
    
    if (contributingGenes > 0) {
        userProfile.forEach((val, i) => userProfile[i] /= contributingGenes);
    } else {
        container.innerHTML = '<p class="status-message">None of the input genes could be mapped to a known organellar profile.</p>';
        return;
    }

    const datasets = Object.entries(organelleMarkerProfiles).map(([name, data], index) => ({
        label: name,
        data: data,
        borderColor: d3.schemeTableau10[index],
        backgroundColor: d3.schemeTableau10[index] + '33', // Add transparency
        pointBackgroundColor: d3.schemeTableau10[index],
        hidden: true, // Hide markers by default for clarity
    }));

    // Add the user's gene set as a prominent, visible dataset
    datasets.push({
        label: 'Your Gene Set',
        data: userProfile,
        borderColor: '#e74c3c',
        backgroundColor: '#e74c3c55',
        pointBackgroundColor: '#c0392b',
        borderWidth: 3,
    });

    currentPlotInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: fractionLabels,
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Organellar Profile Comparison", font: { size: settings.titleFontSize } },
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                r: {
                    angleLines: { display: true },
                    suggestedMin: 0,
                    suggestedMax: 1,
                    pointLabels: { font: { size: 14 } },
                    grid: { color: settings.gridColor },
                }
            },
            elements: {
                line: { tension: 0.1 }
            }
        }
    });
}


/**
 * Renders a UMAP scatter plot showing organelle clusters and highlighting the user's genes.
 */
function renderOrganelleUMAP(foundGenes, container) {
    clearPreviousPlot();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();

    const backgroundDatasets = Object.entries(precomputedUMAP).map(([name, data], index) => ({
        label: name,
        data: data,
        backgroundColor: d3.schemeCategory10[index] + '77', // Semi-transparent background points
        pointRadius: 4,
    }));
    
    // Find the coordinates for the user's genes from our simulated data
    const userGeneData = [];
    let mappedCount = 0;
    foundGenes.forEach(gene => {
        let found = false;
        for (const organelle in precomputedUMAP) {
            // In a real scenario, you'd look up the gene name directly.
            // Here, we simulate by assigning the first available point from the matching organelle.
            const localizations = getCleanArray(gene, 'localization');
            if (localizations.some(loc => organelle.toLowerCase().includes(loc.toLowerCase()))) {
                const availablePoint = precomputedUMAP[organelle][mappedCount % precomputedUMAP[organelle].length];
                if (availablePoint) {
                    userGeneData.push({ ...availablePoint, gene: gene.gene }); // Use real gene name
                    mappedCount++;
                    found = true;
                    break; 
                }
            }
        }
    });
    
    if (userGeneData.length === 0) {
        container.innerHTML = '<p class="status-message">None of the input genes could be mapped to the UMAP projection.</p>';
        return;
    }

    const userDataset = {
        label: 'Your Genes',
        data: userGeneData,
        backgroundColor: '#e74c3c',
        pointRadius: 8,
        borderColor: '#ffffff',
        borderWidth: 2,
    };

    currentPlotInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [...backgroundDatasets, userDataset],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "UMAP Projection of Organellar Proteomes", font: { size: settings.titleFontSize } },
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                           // context.raw has the {x, y, gene} object
                           return context.raw.gene ? `Gene: ${context.raw.gene}` : `${context.dataset.label}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'UMAP 1' },
                    grid: { display: false },
                    ticks: { display: false },
                },
                y: {
                    title: { display: true, text: 'UMAP 2' },
                    grid: { display: false },
                    ticks: { display: false },
                }
            }
        }
    });
}



// New Plot Functions (updated to use settings)
function violinPlot(data, containerId, expressionData, settings = {}) {
    const margin = { top: 20, right: 30, bottom: 120, left: 60 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background", settings.backgroundColor || "#ffffff")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tissues = Object.keys(expressionData[0]).filter(k => k !== "gene");
    const maxExpression = d3.max(expressionData, d => d3.max(tissues, t => +d[t] || 0));

    const xScale = d3.scaleBand()
        .domain(tissues)
        .range([0, width])
        .padding(0.05);

    const yScale = d3.scaleLinear()
        .domain([0, maxExpression * 1.1]) // Add padding to y-axis
        .range([height, 0]);

    // Build a color scale
    const myColor = d3.scaleSequential()
        .interpolator(d3.interpolateInferno)
        .domain([0, tissues.length]);
    
    // Build and display the Y axis
    svg.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.tickFontSize || 12}px`)
        .style("fill", settings.fontColor || "#333333");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 10)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.axisTitleFontSize || 14}px`)
        .style("fill", settings.fontColor || "#333333")
        .text("nTPM Expression");

    // Build and display the X axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("transform", "rotate(-65)")
        .style("text-anchor", "end")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.tickFontSize || 12}px`)
        .style("fill", settings.fontColor || "#333333");

    // Compute the density for each group
    const kde = kernelDensityEstimator(kernelEpanechnikov(7), yScale.ticks(40));
    const violinData = tissues.map((tissue, i) => {
        const values = expressionData.map(d => +d[tissue] || 0).filter(v => !isNaN(v));
        const density = kde(values);
        return { tissue, density, color: myColor(i) };
    });

    const xNum = d3.scaleLinear()
        .range([0, xScale.bandwidth()])
        .domain([-1, 1]);

    svg.selectAll(".violin")
        .data(violinData)
        .enter()
        .append("g")
        .attr("transform", d => `translate(${xScale(d.tissue)}, 0)`)
        .append("path")
            .datum(d => d.density)
            .style("stroke", "none")
            .style("fill", d => violinData.find(v => v.density === d).color)
            .attr("d", d3.area()
                .x0(d => xNum(-d[1]))
                .x1(d => xNum(d[1]))
                .y(d => yScale(d[0]))
                .curve(d3.curveCatmullRom)
            );
}


function barPlot(data, containerId, categoryField, settings = {}) {
    const margin = { top: 40, right: 30, bottom: 150, left: 60 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background", settings.backgroundColor || "#ffffff")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const categoryCounts = new Map();
    const getCats = d => {
        let val = d[categoryField];
        if (Array.isArray(val)) return val.map(c => c.trim());
        if (typeof val === 'string') return val.split(/[;,]/).map(c => c.trim()).filter(c => c);
        return [];
    };

    data.forEach(d => {
        const cats = getCats(d);
        cats.forEach(c => {
            categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
        });
    });

    const sortedData = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
    const categories = sortedData.map(d => d[0]);
    const counts = sortedData.map(d => d[1]);

    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, width])
        .padding(0.2);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(counts)])
        .range([height, 0]);

    svg.selectAll(".bar")
        .data(sortedData)
        .enter()
        .append("rect")
        .attr("x", d => xScale(d[0]))
        .attr("y", d => yScale(d[1]))
        .attr("width", xScale.bandwidth())
        .attr("height", d => height - yScale(d[1]))
        .attr("fill", "steelblue");

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("transform", "rotate(-65)")
        .style("text-anchor", "end")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.tickFontSize || 12}px`)
        .style("fill", settings.fontColor || "#333333");

    svg.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.tickFontSize || 12}px`)
        .style("fill", settings.fontColor || "#333333");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.axisTitleFontSize || 14}px`)
        .style("fill", settings.fontColor || "#333333")
        .text("Number of Genes");
        
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 0 - (margin.top / 2) + 10)
        .attr("text-anchor", "middle")
        .style("font-size", `${settings.titleFontSize || 16}px`)
        .style("font-family", settings.fontFamily || "Arial")
        .style("fill", settings.fontColor || "#333333")
        .text(settings.title || "Gene Counts by Category");
}

function chordPlot(data, containerId, settings = {}) {
    const width = 700;
    const height = 700;
    const outerRadius = Math.min(width, height) * 0.5 - 100;
    const innerRadius = outerRadius - 20;

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", settings.backgroundColor || "#ffffff")
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    const complexData = data.filter(d => d.complex_components && d.complex_components.length > 1);
    const genes = [...new Set(complexData.flatMap(d => d.complex_components))];
    const matrix = Array(genes.length).fill().map(() => Array(genes.length).fill(0));

    // Create a map to avoid redundant pairings
    const pairs = new Set();
    complexData.forEach(d => {
        const components = d.complex_components.sort();
        for (let i = 0; i < components.length; i++) {
            for (let j = i + 1; j < components.length; j++) {
                const pairKey = `${components[i]}|${components[j]}`;
                if (!pairs.has(pairKey)) {
                    const idx1 = genes.indexOf(components[i]);
                    const idx2 = genes.indexOf(components[j]);
                    if (idx1 >= 0 && idx2 >= 0) {
                        matrix[idx1][idx2]++;
                        matrix[idx2][idx1]++;
                    }
                    pairs.add(pairKey);
                }
            }
        }
    });

    const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending);

    const chords = chord(matrix);
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const group = svg.append("g")
        .selectAll("g")
        .data(chords.groups)
        .enter()
        .append("g");

    group.append("path")
        .attr("d", d3.arc().innerRadius(innerRadius).outerRadius(outerRadius))
        .style("fill", (d, i) => color(i))
        .style("stroke", "black");

    group.append("text")
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", ".35em")
        .attr("transform", d => `
            rotate(${(d.angle * 180 / Math.PI - 90)})
            translate(${outerRadius + 10})
            ${d.angle > Math.PI ? "rotate(180)" : ""}
        `)
        .style("text-anchor", d => d.angle > Math.PI ? "end" : null)
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.tickFontSize - 4 || 10}px`)
        .style("fill", settings.fontColor || "#333333")
        .text(d => genes[d.index]);

    svg.append("g")
        .attr("class", "chords")
        .selectAll("path")
        .data(chords)
        .enter()
        .append("path")
        .attr("d", d3.ribbon().radius(innerRadius))
        .style("fill", d => color(d.source.index))
        .style("opacity", 0.7);
}


function expressionDomainBubblePlot(data, containerId, expressionData, settings = {}) {
    const margin = { top: 40, right: 150, bottom: 60, left: 60 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background", settings.backgroundColor || "#ffffff")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const plotData = data.map(d => {
        const tissues = expressionData.find(e => e.gene === d.gene.toUpperCase()) || {};
        const tissueKeys = Object.keys(tissues).filter(k => k !== 'gene');
        const tissueCount = tissueKeys.filter(t => +tissues[t] > 1).length; // Count tissues with nTPM > 1
        const maxExpression = d3.max(tissueKeys.map(t => +tissues[t] || 0));
        const domainCount = d.domain_descriptions ? getCleanArray(d, 'domain_descriptions').length : 0;
        return { gene: d.gene, tissueCount, maxExpression, domainCount };
    }).filter(d => d.maxExpression > 0);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(plotData, d => d.tissueCount)])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(plotData, d => d.domainCount)])
        .range([height, 0]);

    const sizeScale = d3.scaleSqrt()
        .domain([1, d3.max(plotData, d => d.maxExpression)])
        .range([4, 40]);
    
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
      .domain(d3.extent(plotData, d => d.maxExpression));

    svg.selectAll("circle")
        .data(plotData)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.tissueCount))
        .attr("cy", d => yScale(d.domainCount))
        .attr("r", d => sizeScale(d.maxExpression))
        .style("fill", d => colorScale(d.maxExpression))
        .attr("opacity", 0.7)
        .append("title")
        .text(d => `${d.gene}\nExpressed Tissues: ${d.tissueCount}\nDomains: ${d.domainCount}\nMax Expression (nTPM): ${d.maxExpression.toFixed(2)}`);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.tickFontSize || 12}px`)
        .style("fill", settings.fontColor || "#333333");

    svg.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.tickFontSize || 12}px`)
        .style("fill", settings.fontColor || "#333333");

    // Axis Titles
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .style("text-anchor", "middle")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.axisTitleFontSize || 14}px`)
        .style("fill", settings.fontColor || "#333333")
        .text("Number of Tissues Expressed (nTPM > 1)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-family", settings.fontFamily || "Arial")
        .style("font-size", `${settings.axisTitleFontSize || 14}px`)
        .style("fill", settings.fontColor || "#333333")
        .text("Number of Protein Domains");
    
    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", `${settings.titleFontSize || 16}px`)
        .style("font-family", settings.fontFamily || "Arial")
        .style("fill", settings.fontColor || "#333333")
        .text("Expression Breadth vs. Domain Complexity");
}


// Helper functions for violin plot
function kernelDensityEstimator(kernel, X) {
    return function(V) {
        return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
    };
}

function kernelEpanechnikov(k) {
    return function(v) {
        return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
    };
}

/**
 * Generates a stable screen analysis plot for selected genes.
 */
function renderGeneScreenAnalysis(foundGenes, container) {
    clearPreviousPlot(container.id); // Reset previous plot instance
    
    // Create a wrapper div with fixed dimensions
    container.innerHTML = `
        <div class="chart-wrapper" style="position: relative; width: 100%; height: 500px; margin-bottom: 20px;">
            <canvas></canvas>
        </div>
    `;
    
    const canvas = container.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }
    
    // Step 1: Extract and validate screen data
    const processedData = [];
    let geneIndex = 0;
    const geneIndexMap = {};
    
    foundGenes.forEach(gene => {
        // Assign each gene a fixed x-position
        if (!(gene.gene in geneIndexMap)) {
            geneIndexMap[gene.gene] = geneIndex++;
        }
        
        // Handle cases where screens is undefined, null, empty object, or not an array
        if (!gene.screens || !Array.isArray(gene.screens) || gene.screens.length === 0) {
            console.warn(`Gene ${gene.gene} has no screen data or invalid screens format:`, gene.screens);
            return; // Skip genes with no data instead of adding empty points
        }
        
        // Process each screen for this gene
        gene.screens.forEach(screen => {
            const meanValue = parseFloat(screen.mean_percent_ciliated);
            const zValue = parseFloat(screen.z_score);
            
            // Only add if we have valid numeric data
            if (!isNaN(meanValue)) {
                processedData.push({
                    gene: gene.gene,
                    x: geneIndexMap[gene.gene], // Fixed x position
                    y: meanValue,
                    dataset: screen.dataset || "Unknown",
                    z_score: (!isNaN(zValue)) ? zValue : 0,
                    classification: screen.classification || "Unclassified",
                    paper: screen.paper_link || "#"
                });
            }
        });
    });
    
    if (!processedData.length) {
        container.innerHTML = '<p class="status-message">No valid screen data available for analysis.</p>';
        return;
    }
    
    // Step 2: Create datasets grouped by classification
    const classificationColors = {
        "Negative regulator": "#E74C3C",
        "Positive regulator": "#27AE60",
        "No significant effect": "#3498DB",
        "Unclassified": "#95A5A6"
    };
    
    // Group data by classification
    const groupedData = {};
    processedData.forEach(item => {
        const classification = item.classification;
        if (!groupedData[classification]) {
            groupedData[classification] = [];
        }
        groupedData[classification].push(item);
    });
    
    // Create datasets for Chart.js
    const datasets = Object.keys(groupedData).map(classification => {
        const items = groupedData[classification];
        
        return {
            label: classification,
            data: items,
            backgroundColor: classificationColors[classification] || "#95A5A6",
            borderColor: classificationColors[classification] || "#95A5A6",
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
        };
    });
    
    // Step 3: Create gene labels for x-axis
    const geneLabels = Object.keys(geneIndexMap).sort((a, b) => geneIndexMap[a] - geneIndexMap[b]);
    
    // Step 4: Render the chart as a scatter plot for stability
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // This allows the chart to fill the container
            animation: false,
            layout: {
                padding: { left: 10, right: 10, top: 10, bottom: 10 }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Gene Screen Analysis - Functional Classification',
                    font: { size: 16, weight: 'bold' },
                    padding: { top: 5, bottom: 15 }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 12,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    callbacks: {
                        title: (context) => `Gene: ${context[0].raw.gene}`,
                        label: (context) => {
                            const data = context.raw;
                            return [
                                `Dataset: ${data.dataset}`,
                                `Mean % Ciliated: ${data.y.toFixed(2)}`,
                                `Z-Score: ${data.z_score.toFixed(2)}`,
                                `Classification: ${data.classification}`
                            ];
                        },
                        afterLabel: (context) => {
                            const data = context.raw;
                            return data.paper !== "#" ? "Click to view paper" : "";
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: -0.5,
                    max: geneLabels.length - 0.5,
                    title: {
                        display: true,
                        text: 'Genes',
                        font: { size: 13, weight: 'bold' }
                    },
                    ticks: {
                        stepSize: 1,
                        callback: (value, index) => geneLabels[Math.round(value)] || '',
                        maxRotation: 90,           
                        minRotation: 45,
                        font: { size: 9 }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(200, 200, 200, 0.3)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Mean % Ciliated',
                        font: { size: 13, weight: 'bold' }
                    },
                    ticks: {
                        font: { size: 10 }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(200, 200, 200, 0.3)'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const element = elements[0];
                    const dataPoint = currentPlotInstance.data.datasets[element.datasetIndex].data[element.index];
                    if (dataPoint.paper && dataPoint.paper !== "#") {
                        window.open(dataPoint.paper, '_blank');
                    }
                }
            }
        }
    });
    
    // Add summary statistics
    const summary = document.createElement('div');
    summary.className = 'screen-analysis-summary';
    summary.style.cssText = `
        margin-top: 15px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #3498db;
        position: relative;
    `;
    
    const totalGenes = geneLabels.length;
    const negativeRegulators = [...new Set(processedData.filter(d => d.classification === "Negative regulator").map(d => d.gene))];
    const positiveRegulators = [...new Set(processedData.filter(d => d.classification === "Positive regulator").map(d => d.gene))];
    // FIX: Renamed the 'datasets' variable to 'datasetNames' to avoid conflict
    const datasetNames = [...new Set(processedData.map(d => d.dataset))];
    
    summary.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #2c3e50;">Analysis Summary</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
            <div><strong>Total Genes:</strong> ${totalGenes}</div>
            <div><strong>Datasets:</strong> ${datasetNames.join(', ')}</div>
            <div><strong>Total Data Points:</strong> ${processedData.length}</div>
            <div><strong>Negative Regulators:</strong> <span style="color: #E74C3C;">${negativeRegulators.length} genes</span></div>
        </div>
        ${negativeRegulators.length > 0 ? `
            <div style="margin-top: 10px; padding: 8px; background: #ffebee; border-radius: 4px;">
                <strong style="color: #E74C3C;">Negative Regulators:</strong> ${negativeRegulators.join(', ')}
            </div>` : ''}
        ${positiveRegulators.length > 0 ? `
            <div style="margin-top: 8px; padding: 8px; background: #e8f5e8; border-radius: 4px;">
                <strong style="color: #27AE60;">Positive Regulators:</strong> ${positiveRegulators.join(', ')}
            </div>` : ''}
    `;
    
    container.appendChild(summary);
}
