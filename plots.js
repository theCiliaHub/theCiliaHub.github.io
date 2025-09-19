// =============================================================================
// CiliaHub Plotting Engine (plots.js) - Final Complete Version
// =============================================================================
// This file contains all functions for generating the CiliaPlot page and its
// analytical plots. It integrates a clean UI design with a hybrid plotting
// engine using Plotly.js, Chart.js, and D3.js.
//
// Dependencies (must be loaded in the main HTML file):
// - Plotly.js, D3.js, Chart.js, jsPDF
// =============================================================================

/**
 * Displays the main CiliaPlot analysis page, fully integrating all plotting and UI logic.
 */
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';

    contentArea.innerHTML = `
    <style>
        .ciliaplot-page-container { font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; padding: 20px; }
        h2, h3 { color: #1a237e; }
        
        .explanation-section { background-color: #e8eaf6; border-left: 5px solid #3f51b5; padding: 15px 20px; margin-bottom: 25px; border-radius: 5px; }
        .explanation-section h2 { margin-top: 0; font-size: 1.5em; }

        .ciliaplot-main-layout {
            display: grid;
            grid-template-columns: 250px 350px 2fr; /* Col 1 (Types), Col 2 (Input/Customize), Col 3 (Plot) */
            gap: 20px;
            align-items: start;
        }

        .control-card { background: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 20px; }
        .control-card h3 { margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 10px; font-size: 1.2em; }

        .plot-types-panel .plot-type-list { list-style: none; padding: 0; margin: 0; }
        .plot-types-panel .plot-type-list li { margin-bottom: 10px; }
        .plot-types-panel .plot-type-list label { display: block; padding: 12px 15px; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; border: 1px solid #ddd; }
        .plot-types-panel .plot-type-list input[type="radio"] { display: none; }
        .plot-types-panel .plot-type-list input[type="radio"]:checked + label { background-color: #3f51b5; color: white; font-weight: bold; border-color: #3f51b5; }
        
        #ciliaplot-genes-input { width: 100%; min-height: 150px; padding: 10px; border-radius: 5px; border: 1px solid #ccc; font-family: 'Courier New', monospace; resize: vertical; margin-bottom: 15px; }
        #generate-ciliaplot-btn { width: 100%; padding: 12px; font-size: 1.1em; font-weight: bold; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
        .customization-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: end; }
        .customization-grid label { font-weight: bold; margin-bottom: 5px; display: block; }
        .customization-grid input, .customization-grid select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
        
        .visualization-panel { position: sticky; top: 20px; }
        .plot-header { display: flex; justify-content: space-between; align-items: center; }
        .download-controls { display: flex; gap: 10px; align-items: center; }
        #download-format { padding: 8px; }
        #download-plot-btn { background-color: #3f51b5; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
        
        #plot-display-area { width: 100%; height: 550px; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #888; margin-top: 10px; overflow: hidden; }
        
        .gene-input-table-container table { width: 100%; border-collapse: collapse; background-color: #fff; }
        .gene-input-table-container th, .gene-input-table-container td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .gene-input-table-container th { background-color: #f2f2f2; }
    </style>

    <section class="ciliaplot-page-container">
        <div class="explanation-section">
            <h2>CiliaPlot: Visualize Your Ciliary Gene Sets</h2>
            <p>Analyze your gene list by visualizing ciliary localizations, functional categories, and more. This tool offers a variety of publication-quality plots using Plotly, Chart.js, and D3.js.</p>
        </div>

        <div class="ciliaplot-main-layout">
            <aside class="plot-types-panel">
                <div class="control-card">
                    <h3>Plot Types</h3>
                    <ul class="plot-type-list">
                        <li style="font-weight:bold; margin-bottom:5px;">Plotly Plots</li>
                        <li><input type="radio" id="plot-localization-bubble" name="ciliaplot_type" value="localization_bubble" checked><label for="plot-localization-bubble">Gene Localizations (Bubble)</label></li>
                        <li><input type="radio" id="plot-localization-matrix" name="ciliaplot_type" value="localization_matrix"><label for="plot-localization-matrix">Gene-Localization Matrix</label></li>
                        <li><input type="radio" id="plot-domain-matrix" name="ciliaplot_type" value="domain_matrix"><label for="plot-domain-matrix">Gene-Domain Matrix</label></li>
                        <li><input type="radio" id="plot-functional-bar" name="ciliaplot_type" value="functional_bar"><label for="plot-functional-bar">Functional Categories (Bar)</label></li>
                        <li><input type="radio" id="plot-plotly-heatmap" name="ciliaplot_type" value="plotly_heatmap"><label for="plot-plotly-heatmap">Expression Heatmap</label></li>
                        <hr>
                        <li style="font-weight:bold; margin-bottom:5px;">Advanced Plots</li>
                        <li><input type="radio" id="plot-network" name="ciliaplot_type" value="network"><label for="plot-network">Complex Network (D3)</label></li>
                        <li><input type="radio" id="plot-radar" name="ciliaplot_type" value="organelle_radar"><label for="plot-radar">Organelle Radar (Chart.js)</label></li>
                        <li><input type="radio" id="plot-umap" name="ciliaplot_type" value="organelle_umap"><label for="plot-umap">Organelle UMAP (Chart.js)</label></li>
                        <li><input type="radio" id="plot-screen" name="ciliaplot_type" value="screen_analysis"><label for="plot-screen">Screen Analysis (Chart.js)</label></li>
                    </ul>
                </div>
            </aside>

            <main class="input-panel">
                <div class="control-card">
                    <h3>1. Gene Input</h3>
                    <textarea id="ciliaplot-genes-input" rows="10" placeholder="Enter gene symbols, synonyms, or Ensembl IDs..."></textarea>
                </div>
                <div class="control-card">
                    <h3>2. Plot Customization</h3>
                    <div class="customization-grid">
                        <div><label for="plot-title-fontsize">Title Font Size</label><input type="number" id="plot-title-fontsize" value="24" step="1"></div>
                        <div><label for="plot-font-family">Font Family</label><select id="plot-font-family"><option>Arial</option><option>Times New Roman</option><option>Verdana</option></select></div>
                    </div>
                    <button id="generate-ciliaplot-btn">Generate Plot</button>
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

    function initializeCiliaPlotPage() {
        document.getElementById('generate-ciliaplot-btn').addEventListener('click', generateAnalysisPlots);
        document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
    }
    
    initializeCiliaPlotPage();
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Robustly extracts a clean array of values from a gene object.
 */
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

/**
 * A robust function to clear any type of plot from the container.
 */
function clearAllPlots(containerId = 'plot-display-area') {
    if (typeof currentPlotInstance !== 'undefined' && currentPlotInstance && typeof currentPlotInstance.destroy === 'function') {
        currentPlotInstance.destroy();
        currentPlotInstance = null;
    }
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
    try { Plotly.purge(containerId); } catch (e) { /* Ignore */ }
}

/**
 * Updates the summary table with found/not-found status.
 */
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

/**
 * Gathers plot customization settings from the UI.
 */
function getPlotCustomization() {
    return {
        titleFontSize: parseInt(document.getElementById('plot-title-fontsize').value, 10) || 24,
        font: { family: document.getElementById('plot-font-family').value || 'Arial' },
        axisTitleFont: { family: 'Arial', size: 20, color: '#333' }
    };
}

// =============================================================================
// MAIN PLOTTING ORCHESTRATOR
// =============================================================================

async function generateAnalysisPlots() {
    const plotContainer = document.getElementById('plot-display-area');
    plotContainer.innerHTML = '<em>Searching genes and generating plot...</em>';
    clearAllPlots('plot-display-area');

    const rawInput = document.getElementById('ciliaplot-genes-input').value;
    const originalQueries = rawInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
    const sanitizedQueries = [...new Set(originalQueries.map(sanitize))];

    if (sanitizedQueries.length === 0) {
        plotContainer.innerHTML = 'Please enter at least one gene identifier.';
        return;
    }

    const { foundGenes } = findGenes(sanitizedQueries);
    updateGeneSummaryTable(originalQueries, foundGenes);

    if (foundGenes.length === 0) {
        plotContainer.innerHTML = 'None of the provided genes were found in the database.';
        return;
    }

    const plotType = document.querySelector('input[name="ciliaplot_type"]:checked').value;
    const custom = getPlotCustomization();

    switch (plotType) {
        case 'localization_bubble': renderBubblePlot(foundGenes, custom); break;
        case 'localization_matrix': renderMatrixPlot(foundGenes, custom, 'localization'); break;
        case 'domain_matrix': renderMatrixPlot(foundGenes, custom, 'domain'); break;
        case 'functional_bar': renderBarPlot(foundGenes, custom); break;
        case 'plotly_heatmap': renderHeatmap(foundGenes, custom); break;
        case 'network': renderComplexNetwork(foundGenes, plotContainer, custom); break;
        case 'organelle_radar': renderOrganelleRadarPlot(foundGenes, plotContainer, custom); break;
        case 'organelle_umap': renderOrganelleUMAP(foundGenes, plotContainer, custom); break;
        case 'screen_analysis': renderGeneScreenAnalysis(foundGenes, plotContainer, custom); break;
        default: plotContainer.innerHTML = 'Selected plot type is not yet implemented.';
    }
}

// =============================================================================
// PLOTLY.JS RENDERING FUNCTIONS (ADAPTED FOR REAL DATA)
// =============================================================================

function renderBubblePlot(genes, custom) {
    const plotData = [];
    genes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        if (localizations.length > 0) {
            plotData.push({
                x: localizations, y: Array(localizations.length).fill(gene.gene),
                mode: 'markers', type: 'scatter', name: gene.gene,
                marker: { size: 15, color: '#3f51b5' },
                hoverinfo: 'x+y'
            });
        }
    });
    const layout = {
        title: { text: 'Gene Subcellular Localizations', font: { size: custom.titleFontSize, family: custom.font.family } },
        xaxis: { title: { text: 'Localization', font: custom.axisTitleFont } },
        yaxis: { title: { text: 'Gene', font: custom.axisTitleFont } },
        showlegend: false, height: 550, margin: { l: 120, r: 20, b: 100, t: 80 }
    };
    Plotly.newPlot('plot-display-area', plotData, layout, { responsive: true });
}

function renderMatrixPlot(genes, custom, dataType = 'localization') {
    const yLabels = genes.map(g => g.gene);
    const allValues = [...new Set(genes.flatMap(g => getCleanArray(g, dataType === 'localization' ? 'localization' : 'domain_descriptions')))];
    
    const zValues = yLabels.map(geneName => {
        const gene = genes.find(g => g.gene === geneName);
        const geneValues = new Set(getCleanArray(gene, dataType === 'localization' ? 'localization' : 'domain_descriptions'));
        return allValues.map(val => geneValues.has(val) ? 1 : 0);
    });

    const data = [{ x: allValues, y: yLabels, z: zValues, type: 'heatmap', colorscale: 'Blues', showscale: false }];
    const title = (dataType === 'localization') ? 'Gene-Localization Matrix' : 'Gene-Domain Matrix';
    const layout = {
        title: { text: title, font: { size: custom.titleFontSize, family: custom.font.family } },
        xaxis: { title: { text: dataType === 'localization' ? 'Localization' : 'Domain', font: custom.axisTitleFont }, tickangle: -45 },
        yaxis: { title: { text: 'Gene', font: custom.axisTitleFont } },
        height: 550, margin: { l: 120, r: 20, b: 150, t: 80 }
    };
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
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
        title: { text: 'Functional Category Counts', font: { size: custom.titleFontSize, family: custom.font.family } },
        xaxis: { title: { text: 'Number of Genes', font: custom.axisTitleFont } },
        yaxis: { title: { text: 'Category', font: custom.axisTitleFont }, automargin: true },
        height: 550, margin: { l: 250, r: 20, b: 50, t: 80 }
    };
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}

function renderHeatmap(genes, custom) {
    const genesWithExpr = genes.filter(g => typeof expressionData !== 'undefined' && expressionData[g.gene.toUpperCase()]);
    if (genesWithExpr.length === 0) {
        document.getElementById('plot-display-area').innerHTML = '<p>No expression data for these genes.</p>';
        return;
    }
    const tissues = Object.keys(expressionData[Object.keys(expressionData)[0]]);
    const yLabels = genesWithExpr.map(g => g.gene);
    const zValues = yLabels.map(geneName => {
        const expr = expressionData[geneName.toUpperCase()] || {};
        return tissues.map(tissue => expr[tissue] || 0);
    });
    const data = [{ x: tissues, y: yLabels, z: zValues, type: 'heatmap', colorscale: 'Reds' }];
    const layout = {
        title: { text: 'Tissue Expression Heatmap', font: { size: custom.titleFontSize, family: custom.font.family } },
        xaxis: { title: { text: 'Tissue', font: custom.axisTitleFont }, tickangle: -45 },
        yaxis: { title: { text: 'Gene', font: custom.axisTitleFont } },
        height: 550, margin: { l: 120, r: 20, b: 150, t: 80 }
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
    nodeGroup.append("text").text(d => d.id).attr("x", 15).attr("y", 5).style("font-family", custom.font.family);

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
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: "Organellar Profile Comparison", font: { size: custom.titleFontSize } } } }
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
            plugins: { title: { display: true, text: "UMAP Projection of Organellar Proteomes", font: { size: custom.titleFontSize } } }
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
            plugins: { title: { display: true, text: 'Gene Screen Analysis', font: {size: custom.titleFontSize} } },
            scales: {
                x: {
                    title: { display: true, text: 'Genes', font: {size: 20, weight: 'bold'} },
                    min: -0.5, max: geneLabels.length - 0.5,
                    ticks: { stepSize: 1, callback: (val) => geneLabels[val] || '' }
                },
                y: { title: { display: true, text: 'Mean % Ciliated', font: {size: 20, weight: 'bold'} } }
            }
        }
    });
}

async function downloadPlot() {
    const plotArea = document.getElementById('plot-display-area');
    const plotlyDiv = plotArea.querySelector('.plotly');
    const canvas = plotArea.querySelector('canvas');
    const svg = plotArea.querySelector('svg');
    const format = document.getElementById('download-format').value || 'png';
    const fileName = `CiliaPlot_export.${format}`;

    let dataUrl;
    let width = 1200; // High resolution default
    let height = 800;

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
            width = svg.clientWidth * 2; // upscale for better quality
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
