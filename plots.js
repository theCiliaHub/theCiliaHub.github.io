// =============================================================================
// CiliaHub Plotting Engine (plots.js)
// =============================================================================
// This file contains all functions for generating the CiliaPlot page and its
// analytical plots, including localization, domain, network, and expression
// analyses. It integrates with the main CiliaHub data loading and search
// functions.
//
// Dependencies (must be loaded in the main HTML file):
// - D3.js (d3.v7.min.js)
// - Chart.js (chart.js)
// - jsPDF (jspdf.umd.min.js)
// =============================================================================

/**
 * Displays the main CiliaPlot analysis page, fully integrating all plotting and UI logic.
 */
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';

    // This innerHTML section defines the complete UI structure that the plotting functions expect.
    contentArea.innerHTML = `
    <style>
        /* General Page & Layout Styles */
        .ciliaplot-page-container { font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; padding: 20px; }
        .ciliaplot-header { margin-bottom: 20px; }
        .ciliaplot-header h1 { color: #1a237e; margin-bottom: 5px; }
        .ciliaplot-header .info { background-color: #e8eaf6; border-left: 4px solid #3f51b5; padding: 15px; border-radius: 4px; }
        .ciliaplot-container-pro { display: grid; grid-template-columns: 380px 1fr; gap: 20px; align-items: start; }
        
        /* Left Column: Controls */
        .control-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 20px; }
        .control-card h2, .plot-card h3 { margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 10px; font-size: 1.3em; color: #1a237e; }
        .control-card label { display: block; font-weight: bold; margin-bottom: 8px; font-size: 0.9em; color: #555; }
        #ciliaplot-genes-input { width: 100%; min-height: 150px; padding: 10px; border-radius: 5px; border: 1px solid #ccc; font-family: 'Courier New', monospace; resize: vertical; }
        #plot-type-select { width: 100%; padding: 10px; border-radius: 5px; border: 1px solid #ccc; }
        #generate-plot-btn { width: 100%; padding: 12px; font-size: 1.1em; font-weight: bold; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; margin-top: 15px; }
        #generate-plot-btn:hover { background-color: #45a049; }
        
        /* Right Column: Visualization & Results */
        .plot-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 20px; }
        .plot-card-header { display: flex; justify-content: space-between; align-items: center; }
        .download-controls { display: flex; gap: 10px; }
        #download-format { padding: 8px; border-radius: 4px; border: 1px solid #ccc; }
        #download-plot-btn { background-color: #3f51b5; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
        #plot-display-area { width: 100%; min-height: 500px; margin-top: 15px; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .stats-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px; }
        .stat-box { background: #f1f3f5; padding: 10px; border-radius: 5px; text-align: center; }
        .stat-number { font-size: 1.5em; font-weight: bold; color: #1a237e; }
        .stat-label { font-size: 0.9em; color: #555; }
        .tab-container { margin-top: 20px; }
        .tab-buttons { border-bottom: 2px solid #dee2e6; display: flex; }
        .tab-button { background: none; border: none; padding: 10px 15px; cursor: pointer; font-size: 1em; }
        .tab-button.active { border-bottom: 2px solid #3f51b5; font-weight: bold; color: #3f51b5; }
        .tab-pane { display: none; padding: 15px 0; }
        .tab-pane.active { display: block; }
        .table-responsive { overflow-x: auto; }
        .data-summary-table { width: 100%; border-collapse: collapse; }
        .data-summary-table th, .data-summary-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .data-summary-table th { background-color: #f2f2f2; }
        .status-found { color: green; font-weight: bold; }
        .status-not-found { color: red; font-weight: bold; }
        .not-found-genes { margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background-color: #f8f8f8; }
        .not-found-genes h4 { margin-top: 0; }
        .legend { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 10px; font-family: Arial, sans-serif; font-size: 12px; }
        .legend-item { display: flex; align-items: center; gap: 5px; }
        .legend-color { width: 15px; height: 15px; border-radius: 50%; }
    </style>

    <section class="ciliaplot-page-container">
        <header class="ciliaplot-header">
            <h1>CiliaPlot Analysis</h1>
            <p class="info" id="ciliaplot-plot-info">Input genes and select a plot type to generate ciliary function visualizations.</p>
        </header>

        <div class="ciliaplot-container-pro">
            <div class="ciliaplot-controls-section">
                <div class="control-card">
                    <h2>1. Input & Plot Type</h2>
                    <label for="ciliaplot-genes-input">Gene List</label>
                    <textarea id="ciliaplot-genes-input" placeholder="e.g., IFT88, CEP290, BBS1..."></textarea>
                    
                    <label for="plot-type-select">Select Plot Type</label>
                    <select id="plot-type-select">
                        <optgroup label="Localization">
                            <option value="bubble">Key Localizations</option>
                            <option value="matrix">Gene-Localization Matrix</option>
                        </optgroup>
                        <optgroup label="Functional Analysis">
                            <option value="domain_matrix">Gene-Domain Matrix</option>
                            <option value="functional_category">Functional Categories</option>
                            <option value="complex_chord">Complex Interactions (Chord)</option>
                            <option value="network">Protein Complex Network</option>
                        </optgroup>
                        <optgroup label="Expression Analysis">
                            <option value="expression_heatmap">Tissue Expression (Heatmap)</option>
                            <option value="tissue_profile">Tissue Profile (Line)</option>
                            <option value="top_tissues">Top Expressing Tissues (Bar)</option>
                            <option value="expression_violin">Expression Distribution (Violin)</option>
                            <option value="expression_localization">Expression vs Localization</option>
                            <option value="expression_domain_bubble">Expression vs Domains</option>
                        </optgroup>
                        <optgroup label="Proteomics Analysis">
                            <option value="organelle_radar">Organellar Profile (Radar)</option>
                            <option value="organelle_umap">Organellar Projection (UMAP)</option>
                        </optgroup>
                        <optgroup label="Screen Analysis">
                            <option value="screen_analysis">Gene Screen Data</option>
                        </optgroup>
                    </select>
                    <button id="generate-plot-btn">Generate Plot</button>
                </div>
                </div>

            <div class="ciliaplot-visualization-section">
                <div class="plot-card">
                    <div class="plot-card-header">
                        <h3>Visualization</h3>
                        <div class="download-controls">
                            <select id="download-format"><option value="png">PNG</option><option value="pdf">PDF</option></select>
                            <button id="download-plot-btn">Download</button>
                        </div>
                    </div>
                    <div id="plot-display-area"><p class="status-message">Your plot will appear here.</p></div>
                    <div id="ciliaplot-stats-container" class="stats-container"></div>
                    <div id="ciliaplot-legend-container" class="legend"></div>
                </div>
                <div class="tab-container">
                    <div class="tab-buttons">
                        <button class="tab-button active" data-tab="summary-tab">Data Summary</button>
                        <button class="tab-button" data-tab="status-tab">Input Status</button>
                    </div>
                    <div class="tab-content">
                        <div id="summary-tab" class="tab-pane active"><div id="plot-data-table-container"></div></div>
                        <div id="status-tab" class="tab-pane"><div id="ciliaplot-search-results"></div></div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    `;

    // --- INITIALIZE THE PAGE AND ATTACH EVENT LISTENERS ---
    function initializeCiliaPlotPage() {
        document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
        document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
        document.getElementById('plot-type-select').addEventListener('change', (e) => updatePlotInfo(e.target.value));

        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const tabContainer = button.closest('.tab-container');
                tabContainer.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                tabContainer.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                button.classList.add('active');
                document.getElementById(button.dataset.tab).classList.add('active');
            });
        });
        updatePlotInfo(document.getElementById('plot-type-select').value);
    }
    
    initializeCiliaPlotPage();
}

/**
 * Safely clears the previous plot, handling both Chart.js and D3.js instances.
 */
function clearPreviousPlot(containerId = 'plot-display-area') {
    if (currentPlotInstance) {
        if (typeof currentPlotInstance.destroy === 'function') {
            currentPlotInstance.destroy();
        } else if (currentPlotInstance.nodeType) {
            currentPlotInstance.remove();
        }
    }
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
    currentPlotInstance = null;
}

/**
 * Robustly extracts a clean array of values from a gene object.
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
 * Main plotting orchestrator for the CiliaPlot page.
 */
async function generateAnalysisPlots() {
    console.log("--- CiliaPlot Generation Started ---");
    try {
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
        if (searchResultsContainer) searchResultsContainer.innerHTML = '';
        const tableContainer = document.getElementById('plot-data-table-container');
        if (tableContainer) tableContainer.innerHTML = '';
        plotContainer.innerHTML = '<p class="status-message">Searching genes and generating plot...</p>';

        const sanitizedQueries = [...new Set(genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean).map(q => q.toUpperCase()))];
        const { foundGenes, notFoundGenes } = findGenes(sanitizedQueries);

        renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes);

        if (foundGenes.length === 0) {
            plotContainer.innerHTML = '<p class="status-message error">No valid genes were found to generate a plot.</p>';
            updateStatsAndLegend(document.getElementById('plot-type-select').value, []);
            return;
        }

        const plotType = document.getElementById('plot-type-select').value;
        updatePlotInfo(plotType);
        updateStatsAndLegend(plotType, foundGenes);

        switch (plotType) {
            case 'bubble': renderKeyLocalizations(foundGenes, plotContainer); break;
            case 'matrix': renderGeneMatrix(foundGenes, plotContainer); break;
            case 'domain_matrix': renderDomainMatrixPlot(foundGenes, plotContainer); break;
            case 'functional_category': renderFunctionalBarPlot(foundGenes, plotContainer, 'functional_category', 'Gene Count by Functional Category'); break;
            case 'complex_chord': renderComplexChordPlot(foundGenes, plotContainer); break;
            case 'network': renderComplexNetwork(foundGenes, plotContainer); break;
            case 'expression_heatmap': renderExpressionHeatmap(foundGenes, plotContainer); break;
            case 'tissue_profile': renderTissueExpressionProfile(foundGenes, plotContainer); break;
            case 'top_tissues': renderTopExpressingTissues(foundGenes, plotContainer); break;
            case 'expression_violin': renderExpressionViolinPlot(foundGenes, plotContainer); break;
            case 'expression_localization': renderExpressionLocalizationBubble(foundGenes, plotContainer); break;
            case 'expression_domain_bubble': renderExpressionDomainBubblePlot(foundGenes, plotContainer); break;
            case 'organelle_radar': renderOrganelleRadarPlot(foundGenes, plotContainer); break;
            case 'organelle_umap': renderOrganelleUMAP(foundGenes, plotContainer); break;
            case 'screen_analysis': renderGeneScreenAnalysis(foundGenes, plotContainer); break;
            default: plotContainer.innerHTML = `<p class="status-message">Plot type "${plotType}" is not yet implemented.</p>`; break;
        }
        console.log("--- CiliaPlot Generation Finished ---");

    } catch (error) {
        console.error('FATAL ERROR during plot generation:', error);
        document.getElementById('plot-display-area').innerHTML = `<p class="status-message error">A fatal error occurred: ${error.message}</p>`;
    }
}

/**
 * Updates the informational text box with a description of the current plot.
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
            infoHTML = `<strong>Gene Screen Data (Bubble):</strong> Bubble plot showing quantitative functional screening data for your selected genes from published cilia-related RNAi or CRISPR screens.`;
            break;
        default:
            infoHTML = `Select a plot type to see a description.`;
            break;
    }
    infoContainer.innerHTML = infoHTML;
}

/**
 * Updates the statistics and legend sections based on the plot type.
 */
function updateStatsAndLegend(plotType, foundGenes) {
    const statsContainer = document.getElementById('ciliaplot-stats-container');
    const legendContainer = document.getElementById('ciliaplot-legend-container');
    if (!statsContainer || !legendContainer) return;

    statsContainer.style.display = 'grid';
    legendContainer.style.display = 'flex';

    let statsHTML = '', legendHTML = '';
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
        const genesWithExpr = foundGenes.filter(g => typeof expressionData !== 'undefined' && expressionData[g.gene.toUpperCase()]);
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


/**
 * Retrieves plot customization settings from the UI.
 */
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


/**
 * Handles downloading the currently displayed plot.
 */
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

/**
 * Renders the gene query summary table in the "Input Status" tab.
 */
function renderCiliaPlotSearchResultsTable(foundGenes, notFoundGenes) {
    const resultDiv = document.getElementById('ciliaplot-search-results');
    if (!resultDiv) return;

    if (foundGenes.length === 0 && notFoundGenes.length === 0) {
        resultDiv.innerHTML = '';
        return;
    }
    
    let html = `<h3 class="table-title">Gene Query Summary</h3>`;

    if (foundGenes.length > 0) {
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
        html += `
            <div class="not-found-genes">
                <h4>Genes Not Found (${notFoundGenes.length}):</h4>
                <p>${notFoundGenes.join(', ')}</p>
            </div>`;
    }

    resultDiv.innerHTML = html;
}


// =============================================================================
// PLOTTING RENDERER FUNCTIONS
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
                    title: { display: true, text: "Gene Count", font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: "Cellular Compartment", font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

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
                    title: { display: true, text: "Genes", font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, maxRotation: 90, minRotation: 45 }
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: "Ciliary Compartment", font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

function renderDomainMatrixPlot(foundGenes, container) {
    clearPreviousPlot();
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
                    title: { display: true, text: "Genes", font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, maxRotation: 90, minRotation: 45 }
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: "Domain Description", font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                    ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

function renderFunctionalBarPlot(foundGenes, container, categoryField, title) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }

    const categoryCounts = new Map();
    foundGenes.forEach(gene => {
        const categories = getCleanArray(gene, categoryField);
        categories.forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });

    if (categoryCounts.size === 0) {
        container.innerHTML = `<p class="status-message">No data found for the category '${categoryField}'.</p>`;
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
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false },
                tooltip: { callbacks: { title: (c) => sortedData[c[0].dataIndex][0] } }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Number of Genes', font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                },
                y: {
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

function getGeneExpression(geneName) {
    return (typeof expressionData !== 'undefined' && expressionData[geneName.toUpperCase()]) ? expressionData[geneName.toUpperCase()] : {};
}

function getTissueNames() {
    if (typeof tissueNames !== 'undefined' && tissueNames.length > 0) return tissueNames;
    if (typeof expressionData !== 'undefined' && Object.keys(expressionData).length > 0) {
        const firstGene = Object.keys(expressionData)[0];
        return Object.keys(expressionData[firstGene]);
    }
    return [];
}

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
        } else {
            stats.meanExpression[tissue] = 0;
        }
    });
    return stats;
}

function renderExpressionHeatmap(foundGenes, container) {
    clearPreviousPlot();
    if (!foundGenes.length || typeof expressionData === 'undefined' || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available for selected genes.</p>';
        return;
    }

    const tissues = getTissueNames();
    const genesWithExpression = foundGenes.filter(gene => Object.keys(getGeneExpression(gene.gene)).length > 0);

    if (genesWithExpression.length === 0) {
        container.innerHTML = '<p class="status-message">None of the selected genes have expression data.</p>';
        return;
    }

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

    const margin = { top: 60, right: 100, bottom: 150, left: 120 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    const svg = d3.select(container).append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${container.clientWidth} ${container.clientHeight}`)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const xScale = d3.scaleBand().domain(tissues).range([0, width]).padding(0.05);
    const yScale = d3.scaleBand().domain(genesWithExpression.map(g => g.gene)).range([0, height]).padding(0.05);
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, maxExpression]);

    svg.selectAll('.heatmap-rect')
       .data(heatmapData)
       .enter()
       .append('rect')
       .attr('x', d => xScale(d.tissue))
       .attr('y', d => yScale(d.gene))
       .attr('width', xScale.bandwidth())
       .attr('height', yScale.bandwidth())
       .attr('fill', d => colorScale(d.expression || 0));

    svg.append('g').attr('transform', `translate(0, ${height})`).call(d3.axisBottom(xScale)).selectAll('text').attr('transform', 'translate(-10,0)rotate(-45)').style('text-anchor', 'end');
    svg.append('g').call(d3.axisLeft(yScale));

    currentPlotInstance = d3.select(container).select('svg').node();
}

function renderTopExpressingTissues(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || typeof expressionData === 'undefined' || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const stats = calculateExpressionStats(foundGenes);
    
    const tissueData = tissues.map(tissue => ({
        tissue: tissue,
        meanExpression: stats.meanExpression[tissue]
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
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: `Top Expressing Tissues (${foundGenes.length} genes)`, font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                legend: { display: false }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Mean Expression Level (nTPM)', font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor }
                }
            }
        }
    });
}

// Simulated Proteomics Data
const organelleMarkerProfiles = { "Cilia": [0.1, 0.1, 0.2, 0.8, 0.9, 0.6, 0.2, 0.1], "Basal Body": [0.1, 0.2, 0.7, 0.9, 0.8, 0.3, 0.1, 0.1], "Mitochondrion": [0.8, 0.9, 0.7, 0.2, 0.1, 0.1, 0.2, 0.3], "Nucleus": [0.9, 0.8, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1], "ER": [0.2, 0.4, 0.8, 0.3, 0.2, 0.1, 0.5, 0.7], "Golgi": [0.1, 0.2, 0.5, 0.2, 0.2, 0.2, 0.8, 0.9], "Cytosol": [0.4, 0.5, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3] };
const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];
const precomputedUMAP = { "Cilia": Array.from({length: 50}, (_, i) => ({gene: `CILGEN${i}`, x: 8 + Math.random()*2, y: 8 + Math.random()*2})), "Basal Body": Array.from({length: 40}, (_, i) => ({gene: `BBGEN${i}`, x: 6 + Math.random()*2, y: 7 + Math.random()*2})), "Mitochondrion": Array.from({length: 60}, (_, i) => ({gene: `MTGEN${i}`, x: 1 + Math.random()*2, y: 2 + Math.random()*2})), "Nucleus": Array.from({length: 70}, (_, i) => ({gene: `NUCGEN${i}`, x: 9 + Math.random()*1.5, y: 1 + Math.random()*2})), "ER": Array.from({length: 50}, (_, i) => ({gene: `ERGEN${i}`, x: 2 + Math.random()*2, y: 8 + Math.random()*2})), "Golgi": Array.from({length: 40}, (_, i) => ({gene: `GOLGEN${i}`, x: 1 + Math.random()*2, y: 6 + Math.random()*2})), "Cytosol": Array.from({length: 80}, (_, i) => ({gene: `CYTGEN${i}`, x: 5 + Math.random()*3, y: 4 + Math.random()*3})) };

function renderOrganelleRadarPlot(foundGenes, container) {
    clearPreviousPlot();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();

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
        backgroundColor: d3.schemeTableau10[index] + '33',
        hidden: true,
    }));

    datasets.push({
        label: 'Your Gene Set',
        data: userProfile,
        borderColor: '#e74c3c',
        backgroundColor: '#e74c3c55',
        borderWidth: 3,
    });

    currentPlotInstance = new Chart(ctx, {
        type: 'radar',
        data: { labels: fractionLabels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "Organellar Profile Comparison", font: { size: settings.titleFontSize } },
                legend: { position: 'top' },
            },
            scales: { r: { suggestedMin: 0, suggestedMax: 1 } }
        }
    });
}

function renderOrganelleUMAP(foundGenes, container) {
    clearPreviousPlot();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();

    const backgroundDatasets = Object.entries(precomputedUMAP).map(([name, data], index) => ({
        label: name,
        data: data,
        backgroundColor: d3.schemeCategory10[index] + '77',
        pointRadius: 4,
    }));
    
    const userGeneData = [];
    let mappedCount = 0;
    foundGenes.forEach(gene => {
        for (const organelle in precomputedUMAP) {
            const localizations = getCleanArray(gene, 'localization');
            if (localizations.some(loc => organelle.toLowerCase().includes(loc.toLowerCase()))) {
                const availablePoint = precomputedUMAP[organelle][mappedCount % precomputedUMAP[organelle].length];
                if (availablePoint) {
                    userGeneData.push({ ...availablePoint, gene: gene.gene });
                    mappedCount++;
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
        data: { datasets: [...backgroundDatasets, userDataset] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: "UMAP Projection of Organellar Proteomes", font: { size: settings.titleFontSize } },
                legend: { position: 'right' },
                tooltip: { callbacks: { label: (context) => context.raw.gene ? `Gene: ${context.raw.gene}` : `${context.dataset.label}` } }
            },
            scales: {
                x: { title: { display: true, text: 'UMAP 1' }, grid: { display: false }, ticks: { display: false } },
                y: { title: { display: true, text: 'UMAP 2' }, grid: { display: false }, ticks: { display: false } }
            }
        }
    });
}

function renderGeneScreenAnalysis(foundGenes, container) {
    clearPreviousPlot(container.id);
    container.innerHTML = `<div style="position: relative; width: 100%; height: 500px;"><canvas></canvas></div>`;
    const canvas = container.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }
    
    const processedData = [];
    let geneIndex = 0;
    const geneIndexMap = {};
    
    foundGenes.forEach(gene => {
        if (!(gene.gene in geneIndexMap)) {
            geneIndexMap[gene.gene] = geneIndex++;
        }
        if (!gene.screens || !Array.isArray(gene.screens) || gene.screens.length === 0) {
            return;
        }
        gene.screens.forEach(screen => {
            const meanValue = parseFloat(screen.mean_percent_ciliated);
            const zValue = parseFloat(screen.z_score);
            if (!isNaN(meanValue)) {
                processedData.push({
                    gene: gene.gene,
                    x: geneIndexMap[gene.gene],
                    y: meanValue,
                    dataset: screen.dataset || "Unknown",
                    z_score: !isNaN(zValue) ? zValue : 0,
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
    
    const classificationColors = { "Negative regulator": "#E74C3C", "Positive regulator": "#27AE60", "No significant effect": "#3498DB", "Unclassified": "#95A5A6" };
    const groupedData = {};
    processedData.forEach(item => {
        if (!groupedData[item.classification]) {
            groupedData[item.classification] = [];
        }
        groupedData[item.classification].push(item);
    });
    
    const datasets = Object.keys(groupedData).map(classification => ({
        label: classification,
        data: groupedData[classification],
        backgroundColor: classificationColors[classification] || "#95A5A6",
    }));
    
    const geneLabels = Object.keys(geneIndexMap).sort((a, b) => geneIndexMap[a] - geneIndexMap[b]);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Gene Screen Analysis - Functional Classification', font: { size: 16 } },
                legend: { position: 'top' },
                tooltip: { callbacks: {
                    title: (context) => `Gene: ${context[0].raw.gene}`,
                    label: (context) => [
                        `Dataset: ${context.raw.dataset}`,
                        `Mean % Ciliated: ${context.raw.y.toFixed(2)}`,
                        `Z-Score: ${context.raw.z_score.toFixed(2)}`
                    ]
                }}
            },
            scales: {
                x: {
                    type: 'linear',
                    min: -0.5,
                    max: geneLabels.length - 0.5,
                    title: { display: true, text: 'Genes' },
                    ticks: {
                        stepSize: 1,
                        callback: (value, index) => geneLabels[Math.round(value)] || '',
                        maxRotation: 90,
                        minRotation: 45
                    }
                },
                y: { title: { display: true, text: 'Mean % Ciliated' } }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const dataPoint = currentPlotInstance.data.datasets[elements[0].datasetIndex].data[elements[0].index];
                    if (dataPoint.paper && dataPoint.paper !== "#") {
                        window.open(dataPoint.paper, '_blank');
                    }
                }
            }
        }
    });
}
