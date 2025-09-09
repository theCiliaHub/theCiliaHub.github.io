// =============================================================================
// CHART.JS PLUGIN & GLOBAL VARIABLES
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

let currentPlotInstance = null; // Holds the active Chart.js, Plotly, or D3 instance

// =============================================================================
// DATA PARSING HELPER
// =============================================================================
/**
 * Robustly extracts a clean array of values from a gene object,
 * handling multiple possible keys, data types, and nested separators.
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

    const initialArray = Array.isArray(data) ? data : String(data).split(';');

    return initialArray
        .filter(Boolean)
        .flatMap(item => String(item).split(';'))
        .map(item => item.trim())
        .filter(Boolean);
}

// =============================================================================
// PLOT CUSTOMIZATION & DOWNLOAD (YOUR ORIGINAL FUNCTIONS)
// =============================================================================
function getPlotSettings() {
    // This is your original function
    const setting = (id, def) => document.getElementById(id)?.value || def;
    return {
        mainTitle: setting('setting-main-title', 'CiliaHub Analysis'),
        xAxisTitle: setting('setting-x-axis-title', 'X-Axis'),
        yAxisTitle: setting('setting-y-axis-title', 'Y-Axis'),
        titleFontSize: parseInt(setting('setting-title-font-size', 20)),
        axisTitleFontSize: parseInt(setting('setting-axis-title-font-size', 20)),
        tickFontSize: parseInt(setting('setting-tick-font-size', 20)),
        fontFamily: setting('setting-font-family', 'Arial'),
        backgroundColor: setting('setting-bg-color', '#ffffff'),
        fontColor: setting('setting-font-color', '#333333'),
        gridColor: setting('setting-grid-color', '#e0e0e0'),
        colorScale: setting('setting-color-scale', 'Viridis'),
        showLegend: document.getElementById('setting-show-legend')?.checked ?? true,
        showGrid: document.getElementById('setting-show-grid')?.checked ?? false,
        axisLineWidth: parseFloat(setting('setting-axis-line-width', 1.5))
    };
}

async function downloadPlot() {
    // This is your original function
    const format = document.getElementById('download-format')?.value || 'png';
    const plotArea = document.getElementById('plot-display-area');
    const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;

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
        const backgroundColor = getPlotSettings().backgroundColor; // Use background from settings

        if (plotArea.querySelector('canvas')) {
             // For Chart.js, we need to re-render on a temporary canvas to apply background
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width * scale;
            tempCanvas.height = height * scale;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.fillStyle = backgroundColor;
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(plotArea.querySelector('canvas'), 0, 0, tempCanvas.width, tempCanvas.height);
            dataUrl = tempCanvas.toDataURL('image/png');

        } else if (plotArea.querySelector('.js-plotly-plot')) {
            dataUrl = await Plotly.toImage(currentPlotInstance, { format: 'png', width: width * scale, height: height * scale });
        } else if (plotArea.querySelector('svg')) {
            const svgElement = plotArea.querySelector('svg');
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const img = new Image();
            const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
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

        if (!dataUrl) throw new Error("Could not generate image data URL.");

        if (format === 'png') {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            a.click();
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
// PLOTTING FUNCTIONS (ORIGINAL + NEW)
// =============================================================================

function renderKeyLocalizations(foundGenes, container) {
    // This is your original function, kept as is.
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No ciliary genes found for plotting.</p>';
        return;
    }
    const yCategories = ['Cilia','Basal Body','Transition Zone','Axoneme','Ciliary Membrane','Centrosome','Microtubules','Endoplasmic Reticulum','Flagella','Cytosol','Lysosome','Autophagosomes','Ribosome','Nucleus','P-body','Peroxisome'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            const match = yCategories.find(cat => cat.toLowerCase() === loc.toLowerCase());
            if (match) localizationCounts[match] = (localizationCounts[match] || 0) + 1;
        });
    });
    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (!categoriesWithData.length) {
        container.innerHTML = '<p class="status-message">No genes found in primary ciliary localizations.</p>';
        return;
    }
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Gene Count',
                data: categoriesWithData.map(loc => ({ x: localizationCounts[loc], y: loc, r: 8 + localizationCounts[loc] * 2, count: localizationCounts[loc] })),
                backgroundColor: 'rgba(44, 90, 160, 0.7)'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                customCanvasBackgroundColor: { color: settings.backgroundColor },
                legend: { display: false },
                title: { display: true, text: settings.mainTitle, font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: { title: { display: true, text: settings.xAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor }, grid: { display: settings.showGrid, color: settings.gridColor }, border: { display: true, width: settings.axisLineWidth, color: settings.fontColor }, ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor } },
                y: { type: 'category', labels: yCategories, title: { display: true, text: settings.yAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor }, grid: { display: settings.showGrid, color: settings.gridColor }, border: { display: true, width: settings.axisLineWidth, color: settings.fontColor }, ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor } }
            }
        }
    });
}

function renderGeneMatrix(foundGenes, container) {
    // This is your original function, kept as is.
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');

    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes to display in the matrix plot.</p>';
        return;
    }

    const yCategories = [...new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization')))].filter(Boolean).sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();

    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: foundGenes.map((gene, index) => ({
                label: gene.gene,
                data: getCleanArray(gene, 'localization').map(loc => ({ x: gene.gene, y: loc, r: 10 })),
                backgroundColor: d3.schemeTableau10[index % 10]
            }))
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                customCanvasBackgroundColor: { color: settings.backgroundColor },
                legend: { display: false },
                title: { display: true, text: settings.mainTitle, font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.y}` } }
            },
            scales: {
                x: { type: 'category', labels: xLabels, title: { display: true, text: settings.xAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor }, grid: { display: settings.showGrid, color: settings.gridColor }, border: { display: true, width: settings.axisLineWidth, color: settings.fontColor }, ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, maxRotation: 90, minRotation: 45 } },
                y: { type: 'category', labels: yCategories, title: { display: true, text: settings.yAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor }, grid: { display: settings.showGrid, color: settings.gridColor }, border: { display: true, width: settings.axisLineWidth, color: settings.fontColor }, ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor } }
            }
        }
    });
}

function renderDomainEnrichmentFactorPlot(foundGenes, allGenes, container) {
    // This is the new plot
    const settings = getPlotSettings();
    
    const countDomains = (geneSet) => {
        const domainCounts = new Map();
        let genesWithDomains = new Set();
        geneSet.forEach(gene => {
            const domains = getCleanArray(gene, 'Domain_Descriptions', 'domain_descriptions', 'pfam_ids', 'PFAM_IDs');
            if (domains.length > 0) {
                genesWithDomains.add(gene.gene);
                domains.forEach(d => domainCounts.set(d, (domainCounts.get(d) || 0) + 1));
            }
        });
        return { counts: domainCounts, total: genesWithDomains.size };
    };

    const { counts: selectedCounts, total: selectedTotal } = countDomains(foundGenes);
    const { counts: dbCounts, total: dbTotal } = countDomains(allGenes);
    
    if (selectedTotal === 0) {
        container.innerHTML = '<p class="status-message">No domains found in selected genes.</p>';
        return;
    }

    const enrichmentData = Array.from(selectedCounts.entries()).map(([domain, count]) => {
        const factor = ((count / selectedTotal) / ((dbCounts.get(domain) || 0) / dbTotal)) || 0;
        return { domain, factor, count };
    }).sort((a, b) => b.factor - a.factor);
    
    if (!enrichmentData.length) {
        container.innerHTML = '<p class="status-message">No domain enrichment found.</p>';
        return;
    }
    
    container.innerHTML = ''; // Clear previous content
    const topData = enrichmentData.slice(0, 20); // Show top 20
    
    const margin = { top: 30, right: 30, bottom: 60, left: 250 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = topData.length * 28;
    
    const svg = d3.select(container).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background-color", settings.backgroundColor)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
    const x = d3.scaleLinear().domain([0, d3.max(topData, d => d.factor) * 1.1]).range([0, width]);
    const y = d3.scaleBand().domain(topData.map(d => d.domain)).range([0, height]).padding(0.2);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x)).selectAll("text").style("font-family", settings.fontFamily).style("font-size", settings.tickFontSize + 'px').style("fill", settings.fontColor);
    svg.append("g").call(d3.axisLeft(y)).selectAll("text").style("font-family", settings.fontFamily).style("font-size", settings.tickFontSize + 'px').style("fill", settings.fontColor);
    svg.selectAll(".bar").data(topData).enter().append("rect").attr("x", x(0)).attr("y", d => y(d.domain)).attr("width", d => x(d.factor)).attr("height", y.bandwidth()).attr("fill", "#3498db");
    
    // Add titles using settings
    svg.append("text").attr("text-anchor", "middle").attr("x", width / 2).attr("y", -10).text(settings.mainTitle).style("font-family", settings.fontFamily).style("font-size", settings.titleFontSize + 'px').style("fill", settings.fontColor);
    svg.append("text").attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.bottom - 15).text(settings.xAxisTitle).style("font-family", settings.fontFamily).style("font-size", settings.axisTitleFontSize + 'px').style("fill", settings.fontColor);

    currentPlotInstance = svg.node().parentNode; // For download
}

function renderMultiDimNetwork(foundGenes, container) {
    // This is the new plot
    const settings = getPlotSettings();
    
    const nodes = [], links = [], nodeMap = new Map();
    const addNode = (id, type) => {
        if (!nodeMap.has(id)) {
            const node = { id, type, count: 0 };
            nodeMap.set(id, node);
            nodes.push(node);
        }
        nodeMap.get(id).count++;
        return nodeMap.get(id);
    };

    foundGenes.forEach(gene => {
        addNode(gene.gene, 'gene');
        getCleanArray(gene, 'complex_names', 'complex').forEach(c => links.push({ source: gene.gene, target: addNode(c, 'complex').id }));
        getCleanArray(gene, 'Domain_Descriptions', 'domain_descriptions', 'pfam_ids', 'PFAM_IDs').forEach(d => links.push({ source: gene.gene, target: addNode(d, 'domain').id }));
        getCleanArray(gene, 'localization').forEach(l => links.push({ source: gene.gene, target: addNode(l, 'localization').id }));
    });

    if (nodes.length < 2 || links.length === 0) {
        container.innerHTML = '<p class="status-message">Not enough data to build a network.</p>';
        return;
    }
    
    container.innerHTML = '';
    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);
    
    const svg = d3.select(container).append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background-color", settings.backgroundColor);
        
    const nodeColors = { 'gene': '#2ecc71', 'complex': '#f39c12', 'domain': '#3498db', 'localization': '#8e44ad' };
    
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(60))
        .force("charge", d3.forceManyBody().strength(-100))
        .force("center", d3.forceCenter(width / 2, height / 2));
        
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").style("stroke", "#aaa").style("stroke-width", 1.5);
    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle").attr("r", d => d.type === 'gene' ? 8 : 5).style("fill", d => nodeColors[d.type] || '#ccc').style("stroke", "#fff").style("stroke-width", 1.5)
        .call(d3.drag().on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }).on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; }).on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));
        
    node.append("title").text(d => `${d.id} (${d.type})`);
    
    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });
    
    currentPlotInstance = svg.node(); // For download
}

// =============================================================================
// MAIN CONTROLLER
// =============================================================================
async function generateAnalysisPlots() {
    try {
        await loadAndPrepareDatabase();
        const plotContainer = document.getElementById('plot-display-area');
        const resultsContainer = document.getElementById('ciliaplot-results-container');
        const genesInput = document.getElementById('ciliaplot-genes-input').value.trim();

        if (!genesInput) {
            alert('Please enter a gene list.');
            return;
        }

        plotContainer.innerHTML = '<p class="status-message">Generating plot...</p>';
        if (resultsContainer) resultsContainer.innerHTML = '';
        currentPlotInstance = null;

        const originalQueries = genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
        const sanitizedQueries = [...new Set(originalQueries.map(q => q.toUpperCase()))];
        const { foundGenes, notFoundGenes } = findGenes(sanitizedQueries);

        const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;
        const backgroundGeneSet = window.allGenes || [];

        // UPDATE STATS & LEGEND BASED ON PLOT TYPE
        updateStatsAndLegend(plotType, foundGenes, backgroundGeneSet);
        
        // This switch statement calls the correct rendering function
        switch (plotType) {
            case 'bubble':
                renderKeyLocalizations(foundGenes, plotContainer);
                break;
            case 'matrix':
                renderGeneMatrix(foundGenes, plotContainer);
                break;
            case 'enrichment_factor':
                renderDomainEnrichmentFactorPlot(foundGenes, backgroundGeneSet, plotContainer);
                break;
            case 'multi_dim_network':
                renderMultiDimNetwork(foundGenes, plotContainer);
                break;
            default:
                plotContainer.innerHTML = '<p class="status-message">Please select a valid plot type.</p>';
                break;
        }
    } catch (error) {
        console.error('Error generating plots:', error);
        document.getElementById('plot-display-area').innerHTML = `<p class="status-message error">Error generating plot: ${error.message}</p>`;
    }
}

// =============================================================================
// NEW: DYNAMIC STATS AND LEGEND RENDERER
// =============================================================================
function updateStatsAndLegend(plotType, foundGenes, allGenes) {
    const statsContainer = document.getElementById('ciliaplot-stats-container');
    const legendContainer = document.getElementById('ciliaplot-legend-container');
    if (!statsContainer || !legendContainer) return;

    let statsHTML = '';
    let legendHTML = '';

    statsHTML += `<div class="stat-box"><div class="stat-number">${foundGenes.length}</div><div class="stat-label">Input Genes Found</div></div>`;

    if (plotType === 'multi_dim_network') {
        const { nodes } = parseMultiDimData(foundGenes);
        const complexes = nodes.filter(n => n.type === 'complex').length;
        const domains = nodes.filter(n => n.type === 'domain').length;
        const localizations = nodes.filter(n => n.type === 'localization').length;
        statsHTML += `
            <div class="stat-box"><div class="stat-number">${complexes}</div><div class="stat-label">Complexes</div></div>
            <div class="stat-box"><div class="stat-number">${domains}</div><div class="stat-label">Domains</div></div>
            <div class="stat-box"><div class="stat-number">${localizations}</div><div class="stat-label">Localizations</div></div>`;
        legendHTML = `
            <div class="legend-item"><div class="legend-color" style="background-color: #2ecc71;"></div><span>Gene</span></div>
            <div class="legend-item"><div class="legend-color" style="background-color: #f39c12;"></div><span>Complex</span></div>
            <div class="legend-item"><div class="legend-color" style="background-color: #3498db;"></div><span>Domain</span></div>
            <div class="legend-item"><div class="legend-color" style="background-color: #8e44ad;"></div><span>Localization</span></div>`;
    } else if (plotType === 'enrichment_factor') {
        const { enrichmentData } = calculateDomainEnrichmentFactor(foundGenes, allGenes);
        const enrichedCount = enrichmentData.filter(d => d.factor > 1.5).length; // Example threshold
        statsHTML += `
            <div class="stat-box"><div class="stat-number">${enrichmentData.length}</div><div class="stat-label">Unique Domains</div></div>
            <div class="stat-box"><div class="stat-number">${enrichedCount}</div><div class="stat-label">Enriched (>1.5)</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: #3498db;"></div><span>Enrichment Factor</span></div>`;
    }

    statsContainer.innerHTML = statsHTML;
    legendContainer.innerHTML = legendHTML;
}

// =============================================================================
// PAGE RENDERER (MODIFIED TO RENDER THE NEW UI DESIGN)
// =============================================================================
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    if (document.querySelector('.cilia-panel')) {
        document.querySelector('.cilia-panel').style.display = 'none';
    }

    contentArea.innerHTML = `
    <div class="page-section ciliaplot-page">
        <div class="ciliaplot-header">
            <h1>CiliaPlot Gene Set Analysis</h1>
            <div class="info">
                <strong>Analyze Your Genes:</strong> Enter a gene list to generate visualizations. Use the controls to select an analysis type and customize the appearance. Download publication-ready plots in PNG or PDF format.
            </div>
        </div>

        <div class="ciliaplot-container-new">
            <div class="ciliaplot-left-panel-new">
                <div class="control-section">
                    <h3>1. Input Genes</h3>
                    <div class="control-section-content">
                        <textarea id="ciliaplot-genes-input" placeholder="Enter one gene per line..."></textarea>
                    </div>
                </div>
                <div class="control-section">
                    <h3>2. Select Analysis</h3>
                    <div class="control-section-content">
                        <div class="plot-option"><label><input type="radio" name="plot-type" value="bubble" checked> Key Localizations</label></div>
                        <div class="plot-option"><label><input type="radio" name="plot-type" value="matrix"> Gene Matrix</label></div>
                        <div class="plot-option"><label><input type="radio" name="plot-type" value="enrichment_factor"> Domain Enrichment</label></div>
                        <div class="plot-option"><label><input type="radio" name="plot-type" value="multi_dim_network"> Gene Network</label></div>
                    </div>
                </div>
                <div class="control-section">
                     <h3>3. Customize Plot</h3>
                     <details id="plot-customization-details"><summary>Expand Options</summary>
                         <div class="control-section-content" id="plot-settings-grid">
                            <div><label>Main Title <input type="text" id="setting-main-title" value="CiliaHub Analysis"></label></div>
                            <div><label>X-Axis Title <input type="text" id="setting-x-axis-title" value="X-Axis"></label></div>
                            <div><label>Y-Axis Title <input type="text" id="setting-y-axis-title" value="Y-Axis"></label></div>
                            <div><label>Font <select id="setting-font-family"><option>Arial</option><option>Verdana</option><option>Times New Roman</option></select></label></div>
                            <div><label>Title Font Size <input type="number" id="setting-title-font-size" value="18" step="1"></label></div>
                            <div><label>Axis Font Size <input type="number" id="setting-axis-title-font-size" value="14" step="1"></label></div>
                            <div><label>Tick Font Size <input type="number" id="setting-tick-font-size" value="12" step="1"></label></div>
                            <div><label>Background <input type="color" id="setting-bg-color" value="#ffffff"></label></div>
                            <div><label>Font Color <input type="color" id="setting-font-color" value="#333333"></label></div>
                            <div><label>Gridline Color <input type="color" id="setting-grid-color" value="#e0e0e0"></label></div>
                            <div><label><input type="checkbox" id="setting-show-grid" checked> Show Gridlines</label></div>
                         </div>
                     </details>
                </div>
                <div class="control-section">
                    <h3>4. Generate & Download</h3>
                    <div class="control-section-content">
                        <button id="generate-plot-btn" class="btn btn-primary" style="width: 100%; margin-bottom: 10px;">Run Analysis</button>
                        <select id="download-format" style="width:100%;padding:8px;margin-bottom:10px;"><option value="png">PNG</option><option value="pdf">PDF</option></select>
                        <button id="download-plot-btn" class="btn btn-secondary" style="width: 100%;">Download Plot</button>
                    </div>
                </div>
            </div>

            <div class="ciliaplot-right-panel-new">
                <div id="ciliaplot-stats-container" class="stats-container">
                    </div>
                <div id="plot-display-area" class="plot-container-new">
                    <p class="status-message">Enter a gene list and click "Run Analysis" to see your results.</p>
                </div>
                <div id="ciliaplot-legend-container" class="legend">
                    </div>
                 <div id="ciliaplot-results-container" class="results-section" style="margin-top: 2rem;">
                    </div>
            </div>
        </div>
    </div>`;

    document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
    
    // Add event listener to re-run analysis when plot type changes
    document.querySelectorAll('input[name="plot-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const plotArea = document.getElementById('plot-display-area');
            // Only re-run if a plot is already displayed
            if (plotArea && !plotArea.querySelector('.status-message')) {
                generateAnalysisPlots();
            }
        });
    });
}
