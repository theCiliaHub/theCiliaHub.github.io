// =============================================================================
// CiliaHub Plotting Engine (plots.js) - Hybrid Version
// =============================================================================
// This file combines a clean UI design with a mix of plotting libraries.
// It uses Plotly.js for core visualizations and integrates specific Chart.js
// and D3.js plots for advanced analysis.
//
// Dependencies (must be loaded in the main HTML file):
// - Plotly.js
// - D3.js
// - Chart.js
// - jsPDF
// =============================================================================

/**
 * Displays the main CiliaPlot analysis page, fully integrating all plotting and UI logic.
 */
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    document.querySelector('.cilia-panel').style.display = 'none';

    contentArea.innerHTML = `
    <script src="https://cdn.plot.ly/plotly-2.24.1.min.js" charset="utf-8"></script>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

    <style>
        /* General Page Styles */
        .ciliaplot-page-container { font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; padding: 20px; }
        h2, h3 { color: #1a237e; }
        
        /* Explanation Section */
        .explanation-section { background-color: #e8eaf6; border-left: 5px solid #3f51b5; padding: 15px 20px; margin-bottom: 25px; border-radius: 5px; }
        .explanation-section h2 { margin-top: 0; font-size: 1.5em; }

        /* Main Layout Grid */
        .ciliaplot-main-layout { display: grid; grid-template-columns: 280px 1fr 2fr; gap: 20px; align-items: start; }

        /* Card Styling */
        .control-card { background: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 20px; }
        .control-card h3 { margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 10px; font-size: 1.2em; }

        /* Left Column: Plot Types */
        .plot-types-panel .plot-type-list { list-style: none; padding: 0; margin: 0; }
        .plot-types-panel .plot-type-list li { margin-bottom: 10px; }
        .plot-types-panel .plot-type-list label { display: block; padding: 12px 15px; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; border: 1px solid #ddd; }
        .plot-types-panel .plot-type-list input[type="radio"] { display: none; }
        .plot-types-panel .plot-type-list input[type="radio"]:checked + label { background-color: #3f51b5; color: white; font-weight: bold; border-color: #3f51b5; }
        
        /* Middle Column: Input & Customization */
        #ciliaplot-genes-input { width: 100%; min-height: 150px; padding: 10px; border-radius: 5px; border: 1px solid #ccc; font-family: 'Courier New', monospace; resize: vertical; margin-bottom: 15px; }
        #generate-ciliaplot-btn { width: 100%; padding: 12px; font-size: 1.1em; font-weight: bold; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
        
        /* Right Column: Visualization & Table */
        .visualization-panel { position: sticky; top: 20px; }
        .plot-header { display: flex; justify-content: space-between; align-items: center; }
        #download-plot-btn { background-color: #3f51b5; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
        #plot-display-area { width: 100%; min-height: 450px; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #888; margin-top: 10px; }
        .gene-input-table-container table { width: 100%; border-collapse: collapse; background-color: #fff; }
        .gene-input-table-container th, .gene-input-table-container td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .gene-input-table-container th { background-color: #f2f2f2; }
    </style>

    <section class="ciliaplot-page-container">
        <div class="explanation-section">
            <h2>CiliaPlot: Visualize Your Ciliary Gene Sets</h2>
        </div>

        <div class="ciliaplot-main-layout">
            <aside class="plot-types-panel">
                <div class="control-card">
                    <h3>Plot Types</h3>
                    <ul class="plot-type-list">
                        <li style="font-weight:bold; margin-bottom:5px;">Localization & Function</li>
                        <li><input type="radio" id="plot-localization-bubble" name="ciliaplot_type" value="localization_bubble" checked><label for="plot-localization-bubble">Gene Localizations (Plotly)</label></li>
                        <li><input type="radio" id="plot-functional-bar" name="ciliaplot_type" value="functional_bar"><label for="plot-functional-bar">Functional Categories (Plotly)</label></li>
                        <hr>
                        <li style="font-weight:bold; margin-bottom:5px;">Advanced Plots</li>
                        <li><input type="radio" id="plot-key-localizations" name="ciliaplot_type" value="key_localizations"><label for="plot-key-localizations">Key Localizations (Chart.js)</label></li>
                        <li><input type="radio" id="plot-network" name="ciliaplot_type" value="network"><label for="plot-network">Complex Network (D3)</label></li>
                        <li><input type="radio" id="plot-radar" name="ciliaplot_type" value="organelle_radar"><label for="plot-radar">Organelle Radar (Chart.js)</label></li>
                        <li><input type="radio" id="plot-umap" name="ciliaplot_type" value="organelle_umap"><label for="plot-umap">Organelle UMAP (Chart.js)</label></li>
                        <li><input type="radio" id="plot-screen" name="ciliaplot_type" value="screen_analysis"><label for="plot-screen">Screen Analysis (Chart.js)</label></li>
                        <li><input type="radio" id="plot-heatmap" name="ciliaplot_type" value="expression_heatmap"><label for="plot-heatmap">Expression Heatmap (D3)</label></li>
                    </ul>
                </div>
            </aside>

            <main class="input-panel">
                <div class="control-card">
                    <h3>1. Gene Input</h3>
                    <textarea id="ciliaplot-genes-input" rows="10" placeholder="Enter gene symbols, synonyms, or Ensembl IDs..."></textarea>
                    <button id="generate-ciliaplot-btn">Generate Plot</button>
                </div>
            </main>
            
            <aside class="visualization-panel">
                <div class="control-card">
                    <div class="plot-header">
                        <h3>Visualization</h3>
                        <button id="download-plot-btn">Download Plot</button>
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

    // --- INITIALIZE THE PAGE AND ATTACH EVENT LISTENERS ---
    function initializeCiliaPlotPage() {
        document.getElementById('generate-ciliaplot-btn').addEventListener('click', generateAnalysisPlots);
        document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
    }
    
    initializeCiliaPlotPage();
}

// =============================================================================
// HELPER FUNCTIONS (NOW IN GLOBAL SCOPE)
// =============================================================================

/**
 * Robustly extracts a clean array of values from a gene object.
 * This function is essential for many plotting functions.
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
 * A robust function to clear any type of plot from the container.
 */
function clearAllPlots(containerId = 'plot-display-area') {
    if (currentPlotInstance && typeof currentPlotInstance.destroy === 'function') {
        currentPlotInstance.destroy();
        currentPlotInstance = null;
    }
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
    try {
        Plotly.purge(containerId);
    } catch (e) {
        // Ignore errors if no plot exists
    }
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

// =============================================================================
// MAIN PLOTTING ORCHESTRATOR
// =============================================================================

/**
 * Handles data fetching and routes to the correct render function.
 */
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

    // Route to the appropriate rendering function
    switch (plotType) {
        case 'localization_bubble': renderCiliaPlotBubble(foundGenes); break;
        case 'functional_bar': renderCiliaPlotBar(foundGenes); break;
        case 'key_localizations': renderKeyLocalizations(foundGenes, plotContainer); break;
        case 'network': renderComplexNetwork(foundGenes, plotContainer); break;
        case 'organelle_radar': renderOrganelleRadarPlot(foundGenes, plotContainer); break;
        case 'organelle_umap': renderOrganelleUMAP(foundGenes, plotContainer); break;
        case 'screen_analysis': renderGeneScreenAnalysis(foundGenes, plotContainer); break;
        case 'expression_heatmap': renderExpressionHeatmap(foundGenes, plotContainer); break;
        default: plotContainer.innerHTML = 'Selected plot type is not yet implemented.';
    }
}

// =============================================================================
// PLOTLY.JS RENDERING FUNCTIONS
// =============================================================================

function renderCiliaPlotBubble(foundGenes) {
    const plotData = [];
    foundGenes.forEach(gene => {
        const localizations = getCleanArray(gene, 'localization');
        if (localizations.length > 0) {
            plotData.push({
                x: localizations,
                y: Array(localizations.length).fill(gene.gene),
                mode: 'markers', marker: { size: 15, color: '#3f51b5' }, type: 'scatter',
                name: gene.gene, hoverinfo: 'x+y'
            });
        }
    });
    const layout = { title: 'Gene Subcellular Localizations', xaxis: { title: 'Localization' }, yaxis: { title: 'Gene' }, showlegend: false, height: Math.max(450, foundGenes.length * 40) };
    Plotly.newPlot('plot-display-area', plotData, layout, { responsive: true });
}

function renderCiliaPlotBar(foundGenes) {
    const categoryCounts = new Map();
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    const sortedCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
    const labels = sortedCategories.map(entry => entry[0]);
    const values = sortedCategories.map(entry => entry[1]);
    const data = [{ x: values, y: labels, type: 'bar', orientation: 'h', marker: { color: '#4CAF50' } }];
    const layout = { title: 'Functional Category Enrichment', xaxis: { title: 'Number of Genes' }, yaxis: { automargin: true }, height: Math.max(450, labels.length * 30) };
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
}


// =============================================================================
// INTEGRATED CHART.JS & D3.JS FUNCTIONS
// =============================================================================

function renderKeyLocalizations(foundGenes, container) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome', 'Nucleus'];
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
                data: categoriesWithData.map(loc => ({ x: localizationCounts[loc], y: loc, r: 8 + localizationCounts[loc] * 2 })),
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: "Key Ciliary Localizations" }, legend: { display: false } },
            scales: {
                x: { title: { display: true, text: "Gene Count" } },
                y: { type: 'category', labels: yCategories, title: { display: true, text: "Cellular Compartment" } }
            }
        }
    });
}

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
    clearAllPlots(container.id);
    const { nodes, links } = computeProteinComplexLinks(foundGenes);
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found.</p>';
        return;
    }
    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);
    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line").style("stroke", "#999").style("stroke-opacity", 0.6);
    const nodeGroup = svg.append("g").selectAll("g").data(nodes).enter().append("g");
    nodeGroup.append("circle").attr("r", 10).style("fill", "#3498db");
    nodeGroup.append("text").text(d => d.id).attr("x", 15).attr("y", 5);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });
    currentPlotInstance = svg.node();
}

const organelleMarkerProfiles = { "Cilia": [0.1, 0.1, 0.2, 0.8, 0.9, 0.6, 0.2, 0.1], "Basal Body": [0.1, 0.2, 0.7, 0.9, 0.8, 0.3, 0.1, 0.1], "Mitochondrion": [0.8, 0.9, 0.7, 0.2, 0.1, 0.1, 0.2, 0.3], "Nucleus": [0.9, 0.8, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1], "ER": [0.2, 0.4, 0.8, 0.3, 0.2, 0.1, 0.5, 0.7], "Golgi": [0.1, 0.2, 0.5, 0.2, 0.2, 0.2, 0.8, 0.9], "Cytosol": [0.4, 0.5, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3] };
const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];

function renderOrganelleRadarPlot(foundGenes, container) {
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
    
    if (contributingGenes === 0) {
        container.innerHTML = '<p class="status-message">No genes mapped to an organellar profile.</p>';
        return;
    }
    userProfile.forEach((val, i) => userProfile[i] /= contributingGenes);

    const datasets = Object.entries(organelleMarkerProfiles).map(([name, data], i) => ({
        label: name, data: data, borderColor: d3.schemeTableau10[i], hidden: true
    }));
    datasets.push({ label: 'Your Gene Set', data: userProfile, borderColor: '#e74c3c', borderWidth: 3 });

    currentPlotInstance = new Chart(ctx, {
        type: 'radar', data: { labels: fractionLabels, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: "Organellar Profile Comparison" } } }
    });
}

const precomputedUMAP = { "Cilia": Array.from({length: 50}, (_, i) => ({gene: `CILGEN${i}`, x: 8 + Math.random()*2, y: 8 + Math.random()*2})), "Basal Body": Array.from({length: 40}, (_, i) => ({gene: `BBGEN${i}`, x: 6 + Math.random()*2, y: 7 + Math.random()*2})), "Mitochondrion": Array.from({length: 60}, (_, i) => ({gene: `MTGEN${i}`, x: 1 + Math.random()*2, y: 2 + Math.random()*2})), "Nucleus": Array.from({length: 70}, (_, i) => ({gene: `NUCGEN${i}`, x: 9 + Math.random()*1.5, y: 1 + Math.random()*2})) };

function renderOrganelleUMAP(foundGenes, container) {
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

    if (userGeneData.length === 0) {
        container.innerHTML = '<p class="status-message">No genes mapped to the UMAP.</p>';
        return;
    }

    const userDataset = { label: 'Your Genes', data: userGeneData, backgroundColor: '#e74c3c', pointRadius: 8 };

    currentPlotInstance = new Chart(ctx, {
        type: 'scatter', data: { datasets: [...backgroundDatasets, userDataset] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: "UMAP Projection of Organellar Proteomes" } }
        }
    });
}

function renderGeneScreenAnalysis(foundGenes, container) {
    clearAllPlots(container.id);
    container.innerHTML = `<div style="height:500px;"><canvas></canvas></div>`;
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

    if (processedData.length === 0) {
        container.innerHTML = '<p class="status-message">No screen data found for these genes.</p>';
        return;
    }
    
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
            plugins: { title: { display: true, text: 'Gene Screen Analysis' } },
            scales: {
                x: {
                    min: -0.5, max: geneLabels.length - 0.5,
                    ticks: { stepSize: 1, callback: (val) => geneLabels[val] || '' }
                },
                y: { title: { display: true, text: 'Mean % Ciliated' } }
            }
        }
    });
}

function renderExpressionHeatmap(foundGenes, container) {
    clearAllPlots(container.id);
    if (typeof expressionData === 'undefined' || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">Expression data is not available.</p>';
        return;
    }

    const tissues = Object.keys(expressionData[Object.keys(expressionData)[0]]);
    const genesWithExpr = foundGenes.filter(g => expressionData[g.gene.toUpperCase()]);
    if (genesWithExpr.length === 0) {
        container.innerHTML = '<p class="status-message">No expression data for selected genes.</p>';
        return;
    }

    let maxExpr = 0;
    const heatmapData = [];
    genesWithExpr.forEach(gene => {
        const expr = expressionData[gene.gene.toUpperCase()];
        const maxGeneExpr = Math.max(0, ...Object.values(expr));
        maxExpr = Math.max(maxExpr, maxGeneExpr);
        tissues.forEach(tissue => {
            heatmapData.push({ gene: gene.gene, tissue, expression: expr[tissue] || 0 });
        });
    });

    const margin = { top: 50, right: 50, bottom: 150, left: 100 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(container).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().range([0, width]).domain(tissues).padding(0.01);
    svg.append("g").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x))
        .selectAll("text").attr("transform", "translate(-10,0)rotate(-45)").style("text-anchor", "end");

    const y = d3.scaleBand().range([height, 0]).domain(genesWithExpr.map(g => g.gene)).padding(0.01);
    svg.append("g").call(d3.axisLeft(y));

    const myColor = d3.scaleSequential(d3.interpolateViridis).domain([0, maxExpr]);

    svg.selectAll()
        .data(heatmapData, d => `${d.gene}:${d.tissue}`)
        .enter()
        .append("rect")
        .attr("x", d => x(d.tissue))
        .attr("y", d => y(d.gene))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", d => myColor(d.expression));
        
    currentPlotInstance = svg.node();
}

async function downloadPlot() {
    const plotArea = document.getElementById('plot-display-area');
    const canvas = plotArea.querySelector('canvas');
    const svg = plotArea.querySelector('svg');

    if (canvas) {
        const link = document.createElement('a');
        link.download = 'ciliaplot_chart.png';
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    } else if (svg) {
        // Fallback for D3 plots
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = svg.clientWidth;
        canvas.height = svg.clientHeight;
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const link = document.createElement('a');
            link.download = 'ciliaplot_d3.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
    } else {
        alert("No plot available to download.");
    }
}
