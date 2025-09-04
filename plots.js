// =============================================================================
// CHART.JS & GLOBAL VARIABLES
// =============================================================================
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

let currentPlotInstance = null; // Holds the active Chart.js or Plotly instance

// =============================================================================
// DATA LOADING AND ENHANCED SEARCH
// =============================================================================
/**
 * Sanitizes any string by removing invisible characters, trimming, and uppercasing.
 */
function sanitize(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim().toUpperCase();
}

/**
 * Loads and prepares the gene database, indexing by gene name, synonyms, and Ensembl ID.
 */
async function loadAndPrepareDatabase() {
    if (window.geneDataCache) return true;
    try {
        const resp = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const rawGenes = await resp.json();
        if (!Array.isArray(rawGenes)) throw new Error('Invalid data format');

        window.geneDataCache = rawGenes;
        window.allGenes = rawGenes;
        window.geneMapCache = new Map();

        allGenes.forEach(g => {
            if (!g.gene || typeof g.gene !== 'string') return;
            const nameKey = sanitize(g.gene);
            if (nameKey) geneMapCache.set(nameKey, g);

            // Index by Ensembl ID
            if (g.ensembl_id) {
                const ensemblKey = sanitize(g.ensembl_id);
                if (ensemblKey && !geneMapCache.has(ensemblKey)) geneMapCache.set(ensemblKey, g);
            }

            // Index by synonyms
            if (g.synonym) {
                String(g.synonym).split(/[,;]/).forEach(syn => {
                    const key = sanitize(syn);
                    if (key && !geneMapCache.has(key)) geneMapCache.set(key, g);
                });
            }
        });
        console.log(`Loaded and indexed ${allGenes.length} genes.`);
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
        const result = geneMapCache.get(sanitize(query));
        if (result) {
            foundGenes.add(result);
        } else {
            notFound.push(query);
        }
    });
    return { foundGenes: Array.from(foundGenes), notFoundGenes: notFound };
}

// =============================================================================
// PLOT CUSTOMIZATION & HIGH-QUALITY DOWNLOAD
// =============================================================================
/**
 * Gets all user-defined settings for plots from the customization panel.
 */
function getPlotSettings() {
    const setting = (id, defaultValue) => document.getElementById(id)?.value || defaultValue;
    const numSetting = (id, defaultValue) => parseInt(setting(id, defaultValue), 10);
    const boolSetting = (id, defaultValue) => document.getElementById(id)?.checked || defaultValue;

    return {
        // Titles
        mainTitle: setting('setting-main-title', 'CiliaHub Analysis'),
        xAxisTitle: setting('setting-x-axis-title', 'X-Axis'),
        yAxisTitle: setting('setting-y-axis-title', 'Y-Axis'),
        // Fonts
        titleFontSize: numSetting('setting-title-font-size', 18),
        axisTitleFontSize: numSetting('setting-axis-title-font-size', 14),
        tickFontSize: numSetting('setting-tick-font-size', 12),
        fontFamily: setting('setting-font-family', 'Arial'),
        // Colors
        backgroundColor: setting('setting-bg-color', '#ffffff'),
        fontColor: setting('setting-font-color', '#333333'),
        gridColor: setting('setting-grid-color', '#e0e0e0'),
        colorScale: setting('setting-color-scale', 'Viridis'),
        // Toggles
        showLegend: boolSetting('setting-show-legend', true),
        showGrid: boolSetting('setting-show-grid', true),
    };
}

/**
 * Downloads the currently displayed plot in high quality.
 */
async function downloadPlot() {
    const format = document.getElementById('download-format')?.value || 'png';
    const plotArea = document.getElementById('plot-display-area');
    const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;
    
    if (!currentPlotInstance || !plotType) {
        alert("Please generate a plot first.");
        return;
    }
    
    const fileName = `CiliaHub_${plotType}_${new Date().toISOString().slice(0,10)}.${format}`;
    const scale = 300 / 96; // ~300 DPI
    const width = plotArea.clientWidth * scale;
    const height = plotArea.clientHeight * scale;

    try {
        let dataUrl;
        if (plotArea.querySelector('canvas')) { // Chart.js
            const chart = currentPlotInstance;
            dataUrl = chart.toBase64Image('image/png', 1.0);
        } else { // Plotly
             dataUrl = await Plotly.toImage(currentPlotInstance, { format: 'png', width, height });
        }

        if (format === 'png') {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            a.click();
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [width, height]
            });
            pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
            pdf.save(fileName);
        }
    } catch (e) {
        console.error("Download failed:", e);
        alert("An error occurred while trying to download the plot.");
    }
}

// =============================================================================
// PLOTTING FUNCTIONS (Each generates a specific plot)
// =============================================================================

/**
 * Renders the enrichment bubble plot (Original "Bubble Plot").
 */
function renderEnrichmentBubblePlot(foundGenes, container) {
    if (foundGenes.length === 0) {
        container.innerHTML = '<p class="status-message">No ciliary genes were found to plot.</p>';
        return;
    }

    const settings = getPlotSettings();
    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        (Array.isArray(gene.localization) ? gene.localization : []).forEach(loc => {
            const matchingCategory = yCategories.find(cat => cat.toLowerCase() === loc.trim().toLowerCase());
            if (matchingCategory) {
                localizationCounts[matchingCategory] = (localizationCounts[matchingCategory] || 0) + 1;
            }
        });
    });
    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (categoriesWithData.length === 0) {
        container.innerHTML = '<p class="status-message">No genes found in the primary ciliary localizations.</p>';
        return;
    }

    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Gene Count',
                data: categoriesWithData.map(loc => ({
                    x: localizationCounts[loc],
                    y: loc,
                    r: 10 + localizationCounts[loc] * 2,
                    count: localizationCounts[loc]
                })),
                backgroundColor: 'rgba(54, 162, 235, 0.6)'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: settings.showLegend, labels: { color: settings.fontColor, font: { family: settings.fontFamily } } },
                title: { display: true, text: settings.mainTitle, color: settings.fontColor, font: { size: settings.titleFontSize, family: settings.fontFamily } },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: {
                    title: { display: true, text: settings.xAxisTitle, color: settings.fontColor, font: { size: settings.axisTitleFontSize, family: settings.fontFamily } },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    ticks: { color: settings.fontColor, font: { size: settings.tickFontSize, family: settings.fontFamily }, precision: 0 }
                },
                y: {
                    title: { display: true, text: settings.yAxisTitle, color: settings.fontColor, font: { size: settings.axisTitleFontSize, family: settings.fontFamily } },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    ticks: { color: settings.fontColor, font: { size: settings.tickFontSize, family: settings.fontFamily } }
                }
            }
        }
    });
}

/**
 * Renders the gene matrix plot (Original "Matrix Plot").
 */
function renderBubbleMatrix(foundGenes, container) {
    if (foundGenes.length === 0) {
        container.innerHTML = '<p class="status-message">No genes to display in the matrix plot.</p>';
        return;
    }
    
    const settings = getPlotSettings();
    const yCategories = [...new Set(foundGenes.flatMap(g => g.localization))].filter(Boolean).sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();

    if (yCategories.length === 0) {
        container.innerHTML = '<p class="status-message">The found genes have no specified localizations to plot.</p>';
        return;
    }
    
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: foundGenes.map((gene, index) => ({
                label: gene.gene,
                data: (Array.isArray(gene.localization) ? gene.localization : []).map(loc => ({
                    x: gene.gene,
                    y: loc,
                    r: 8
                })),
                backgroundColor: d3.schemeCategory10[index % 10]
            }))
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: settings.showLegend, labels: { color: settings.fontColor, font: { family: settings.fontFamily } } },
                title: { display: true, text: settings.mainTitle, color: settings.fontColor, font: { size: settings.titleFontSize, family: settings.fontFamily } },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.y}` } }
            },
            scales: {
                x: {
                    type: 'category', labels: xLabels,
                    title: { display: true, text: settings.xAxisTitle, color: settings.fontColor, font: { size: settings.axisTitleFontSize, family: settings.fontFamily } },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    ticks: { color: settings.fontColor, font: { size: settings.tickFontSize, family: settings.fontFamily }, maxRotation: 90, minRotation: 45 },
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: settings.yAxisTitle, color: settings.fontColor, font: { size: settings.axisTitleFontSize, family: settings.fontFamily } },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    ticks: { color: settings.fontColor, font: { size: settings.tickFontSize, family: settings.fontFamily } }
                }
            }
        }
    });
}

/**
 * Renders the Domain Enrichment bubble chart using Plotly.
 */
function renderDomainEnrichment(foundGenes, container) {
    const enrichmentData = calculateDomainEnrichment(foundGenes, allGenes);
    if (enrichmentData.length === 0) {
        container.innerHTML = '<p class="status-message">No significantly enriched protein domains found.</p>';
        return;
    }
    
    const settings = getPlotSettings();
    const data = [{
        x: enrichmentData.map(d => d.richFactor),
        y: enrichmentData.map(d => d.geneCount),
        text: enrichmentData.map(d => `PFAM ID: ${d.domain}<br>Gene Count: ${d.geneCount}`),
        hoverinfo: 'text',
        mode: 'markers',
        marker: {
            size: enrichmentData.map(d => Math.min(d.geneCount * 10 + 8, 100)),
            color: enrichmentData.map(d => d.richFactor),
            colorscale: settings.colorScale,
            showscale: true,
            colorbar: { title: { text: 'Rich Factor', font: { family: settings.fontFamily } }, tickfont: { family: settings.fontFamily } }
        }
    }];

    const layout = {
        title: { text: settings.mainTitle, font: { size: settings.titleFontSize, family: settings.fontFamily, color: settings.fontColor } },
        xaxis: { title: { text: settings.xAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily, color: settings.fontColor } }, showgrid: settings.showGrid, gridcolor: settings.gridColor, tickfont: { family: settings.fontFamily } },
        yaxis: { title: { text: settings.yAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily, color: settings.fontColor } }, showgrid: settings.showGrid, gridcolor: settings.gridColor, tickfont: { family: settings.fontFamily } },
        paper_bgcolor: settings.backgroundColor,
        plot_bgcolor: settings.backgroundColor,
        showlegend: settings.showLegend,
        margin: { t: 40, b: 40, l: 50, r: 20 },
        hovermode: 'closest'
    };
    
    currentPlotInstance = plotContainer;
    Plotly.newPlot(container, data, layout, { responsive: true });
}

/**
 * Renders the Ciliopathy Associations sunburst chart using D3.
 */
function renderCiliopathySunburst(foundGenes, container) {
    container.innerHTML = '';
    const ciliopathyMap = new Map();
    foundGenes.forEach(gene => {
        if (gene.ciliopathy && gene.ciliopathy.trim() !== "") {
            const name = gene.ciliopathy.trim();
            if (!ciliopathyMap.has(name)) ciliopathyMap.set(name, []);
            ciliopathyMap.get(name).push({ name: gene.gene, value: 1 });
        }
    });

    const data = { name: "Ciliopathies", children: Array.from(ciliopathyMap.entries()).map(([name, genes]) => ({ name, children: genes })) };

    if (!data.children || data.children.length === 0) {
        container.innerHTML = '<p class="status-message">No genes with known ciliopathy associations were found.</p>';
        return;
    }
    
    const width = container.clientWidth;
    const height = container.clientHeight < 400 ? 400 : container.clientHeight;
    const radius = Math.min(width, height) / 2.2;
    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));
    const root = d3.partition().size([2 * Math.PI, radius])(d3.hierarchy(data).sum(d => d.value));
    
    const svg = d3.select(container).append("svg").attr("viewBox", [-width / 2, -height / 2, width, height]);
    svg.selectAll("path").data(root.descendants().filter(d => d.depth)).join("path")
        .attr("d", d3.arc().startAngle(d=>d.x0).endAngle(d=>d.x1).innerRadius(d=>d.y0).outerRadius(d=>d.y1))
        .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
        .append("title").text(d => `${d.ancestors().map(d => d.data.name).reverse().join(" → ")}`);
    currentPlotInstance = container.querySelector('svg');
}

/**
 * Renders the Protein Complex Network graph using D3.
 */
function renderComplexNetwork(foundGenes, container) {
    container.innerHTML = '';
    const nodes = [], nodeSet = new Set(), links = [], complexMap = new Map();
    foundGenes.forEach(gene => {
        if (gene.complex_names && gene.complex_names.trim() !== "") {
            gene.complex_names.split(',').map(c => c.trim()).forEach(complex => {
                if (!complexMap.has(complex)) complexMap.set(complex, []);
                complexMap.get(complex).push(gene.gene);
            });
        }
    });

    complexMap.forEach(genes => {
        if (genes.length > 1) {
            genes.forEach(name => { if (!nodeSet.has(name)) { nodes.push({ id: name }); nodeSet.add(name); } });
            for (let i = 0; i < genes.length; i++) for (let j = i + 1; j < genes.length; j++) links.push({ source: genes[i], target: genes[j] });
        }
    });
    
    if (links.length === 0) {
        container.innerHTML = '<p class="status-message">No shared protein complexes found in the gene list to form a network.</p>';
        return;
    }
    
    const width = container.clientWidth;
    const height = container.clientHeight < 400 ? 400 : container.clientHeight;
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(60))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const svg = d3.select(container).append("svg").attr("viewBox", [0, 0, width, height]);
    const link = svg.append("g").attr("stroke", "#999").attr("stroke-opacity", 0.6).selectAll("line").data(links).join("line");
    const node = svg.append("g").attr("stroke", "#fff").attr("stroke-width", 1.5).selectAll("circle").data(nodes).join("circle")
        .attr("r", 8).attr("fill", "#377eb8").call(d3.drag().on("start", (e,d)=>{if(!e.active)simulation.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y;}).on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y;}).on("end",(e,d)=>{if(!e.active)simulation.alphaTarget(0);d.fx=null;d.fy=null;}));
    node.append("title").text(d => d.id);
    simulation.on("tick", () => { link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y); node.attr("cx",d=>d.x).attr("cy",d=>d.y); });
    currentPlotInstance = container.querySelector('svg');
}

/**
 * Helper function for domain enrichment calculation
 */
function calculateDomainEnrichment(filteredData, allCiliaData) {
    const domainCountsUserList = new Map();
    filteredData.forEach(gene => {
        if (gene.pfam_ids && Array.isArray(gene.pfam_ids)) {
            new Set(gene.pfam_ids).forEach(pfamId => {
                domainCountsUserList.set(pfamId, (domainCountsUserList.get(pfamId) || 0) + 1);
            });
        }
    });

    const domainCountsBackground = new Map();
    allCiliaData.forEach(gene => {
        if (gene.pfam_ids && Array.isArray(gene.pfam_ids)) {
            new Set(gene.pfam_ids).forEach(pfamId => {
                domainCountsBackground.set(pfamId, (domainCountsBackground.get(pfamId) || 0) + 1);
            });
        }
    });
    const M = filteredData.length;
    const N = allCiliaData.length;
    if (M === 0) return [];
    const enrichedDomains = [];
    domainCountsUserList.forEach((count, domainId) => {
        const k = count;
        const n = domainCountsBackground.get(domainId) || 0;
        if (n === 0) return;
        const richFactor = (k / M) / (n / N);
        if (richFactor > 1.5 && k > 1) {
            enrichedDomains.push({ domain: domainId, richFactor, geneCount: k });
        }
    });
    return enrichedDomains.sort((a, b) => b.richFactor - a.richFactor);
}


// =============================================================================
// MAIN CONTROLLER & PAGE RENDERER
// =============================================================================

/**
 * Main controller for generating the selected enrichment plot.
 */
async function generateAnalysisPlots() {
    await loadAndPrepareDatabase();
    const plotContainer = document.getElementById('plot-display-area');
    const resultsContainer = document.getElementById('enrichment-results-container');
    const genesInput = document.getElementById('enrichment-genes-input').value.trim();

    if (!genesInput) {
        alert('Please enter a gene list.');
        return;
    }
    
    // Clear previous results
    plotContainer.innerHTML = '<div class="status-message">Generating plot...</div>';
    resultsContainer.innerHTML = '';
    currentPlotInstance = null;

    const geneList = genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
    const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;
    const { foundGenes, notFoundGenes } = findGenes(geneList);
    const sortedFoundGenes = Array.from(foundGenes).sort((a, b) => a.gene.localeCompare(b.gene));

    // Create the results table first
    createEnrichmentResultsTable(sortedFoundGenes, notFoundGenes);
    
    switch (plotType) {
        case 'bubble':
            renderEnrichmentBubblePlot(sortedFoundGenes, plotContainer);
            break;
        case 'matrix':
            renderBubbleMatrix(sortedFoundGenes, plotContainer);
            break;
        case 'domain':
            renderDomainEnrichment(sortedFoundGenes, plotContainer);
            break;
        case 'ciliopathy':
            renderCiliopathySunburst(sortedFoundGenes, plotContainer);
            break;
        case 'network':
            renderComplexNetwork(sortedFoundGenes, plotContainer);
            break;
        default:
             plotContainer.innerHTML = '<p class="status-message">Please select a plot type.</p>';
    }
}

/**
 * Renders the complete HTML structure for the enrichment page.
 */
function displayEnrichmentPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full'; // Ensure full width
    if (document.querySelector('.cilia-panel')) {
        document.querySelector('.cilia-panel').style.display = 'none';
    }

    contentArea.innerHTML = `
        <div class="page-section enrichment-page">
            <div class="enrichment-header">
                <h2>Ciliary Gene Enrichment Analysis</h2>
                <p>Analyze your gene list with a variety of visualization tools and customization options.</p>
            </div>
            <div class="enrichment-container">
                <div class="enrichment-left-panel">
                    <!-- Input Section -->
                    <div class="control-section">
                        <h3>1. Input Genes</h3>
                        <div class="control-section-content">
                            <textarea id="enrichment-genes-input" placeholder="Enter gene symbols, synonyms, or Ensembl IDs, one per line..."></textarea>
                            <button id="generate-plot-btn" class="btn btn-primary" style="width: 100%;">Run Analysis</button>
                        </div>
                    </div>
                    <!-- Plot Selection Section -->
                    <div class="control-section">
                        <h3>2. Select Analysis Type</h3>
                        <div class="control-section-content">
                            <div class="plot-option">
                                <label><input type="radio" name="plot-type" value="bubble" checked> Key Localizations</label>
                                <p class="plot-option-explanation">A bubble plot showing the distribution of your genes across six primary ciliary compartments.</p>
                            </div>
                            <div class="plot-option">
                                <label><input type="radio" name="plot-type" value="matrix"> Gene Matrix</label>
                                <p class="plot-option-explanation">A matrix showing the specific localization for each gene in your list across all possible ciliary compartments.</p>
                            </div>
                            <div class="plot-option">
                                <label><input type="radio" name="plot-type" value="domain"> Domain Enrichment</label>
                                <p class="plot-option-explanation">A bubble chart of protein domains (PFAM) that are statistically over-represented in your gene list.</p>
                            </div>
                            <div class="plot-option">
                                <label><input type="radio" name="plot-type" value="ciliopathy"> Ciliopathy Associations</label>
                                <p class="plot-option-explanation">A sunburst chart visualizing the relationship between your genes and known ciliopathy disorders.</p>
                            </div>
                             <div class="plot-option">
                                <label><input type="radio" name="plot-type" value="network"> Protein Complex Network</label>
                                <p class="plot-option-explanation">A network graph showing connections between your genes that are part of the same protein complexes.</p>
                            </div>
                        </div>
                    </div>
                     <!-- Customization Section -->
                    <div class="control-section">
                        <h3>3. Customize Plot</h3>
                        <details>
                            <summary style="padding: 15px; cursor: pointer; font-weight: bold;">Expand Customization Options</summary>
                            <div class="control-section-content">
                                <div id="plot-settings-grid">
                                    <div><label>Main Title <input type="text" id="setting-main-title" value="CiliaHub Analysis"></label></div>
                                    <div><label>X-Axis Title <input type="text" id="setting-x-axis-title" value="Enrichment Score"></label></div>
                                    <div><label>Y-Axis Title <input type="text" id="setting-y-axis-title" value="Category"></label></div>
                                    <div><label>Font Family <select id="setting-font-family"><option>Arial</option><option>Verdana</option><option>Times New Roman</option></select></label></div>
                                    <div><label>Title Font Size <input type="number" id="setting-title-font-size" value="18"></label></div>
                                    <div><label>Axis Title Font Size <input type="number" id="setting-axis-title-font-size" value="14"></label></div>
                                    <div><label>Tick Font Size <input type="number" id="setting-tick-font-size" value="12"></label></div>
                                    <div><label>Background Color <input type="color" id="setting-bg-color" value="#ffffff"></label></div>
                                    <div><label>Font Color <input type="color" id="setting-font-color" value="#333333"></label></div>
                                    <div><label>Gridline Color <input type="color" id="setting-grid-color" value="#e0e0e0"></label></div>
                                    <div><label>Color Scale (Plotly) <select id="setting-color-scale"><option>Viridis</option><option>Plasma</option><option>Blues</option><option>Greens</option></select></label></div>
                                    <div><label><input type="checkbox" id="setting-show-legend" checked> Show Legend</label></div>
                                    <div><label><input type="checkbox" id="setting-show-grid" checked> Show Gridlines</label></div>
                                </div>
                            </div>
                        </details>
                    </div>
                     <!-- Download Section -->
                     <div class="control-section">
                        <h3>4. Download</h3>
                        <div class="control-section-content">
                             <select id="download-format" style="width: 100%; margin-bottom: 10px;"><option value="png">PNG (300 DPI)</option><option value="pdf">PDF (300 DPI)</option></select>
                             <button id="download-plot-btn" class="btn btn-secondary" style="width: 100%;">Download Plot</button>
                        </div>
                    </div>
                </div>
                <div class="enrichment-right-panel">
                    <div id="plot-display-area">
                        <div class="status-message">Enter a gene list and click "Run Analysis" to see your results.</div>
                    </div>
                    <div id="enrichment-results-container" class="results-section"></div>
                </div>
            </div>
        </div>
    `;
    
    // Attach event listeners
    document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}
