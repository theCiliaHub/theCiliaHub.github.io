// =============================================================================
// CHART.JS PLUGIN & GLOBAL VARIABLES
// =============================================================================
Chart.register({
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart, args, options) => {
        if (options.enabled === false) {
            return;
        }
        const { ctx } = chart;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = options.color || '#ffffff';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
    }
});

let currentPlotInstance = null;

// =============================================================================
// DATA PARSING HELPER
// =============================================================================
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
// PLOT CUSTOMIZATION & DOWNLOAD
// =============================================================================
function getPlotSettings() {
    const setting = (id, def) => document.getElementById(id)?.value || def;
    return {
        mainTitle: setting('setting-main-title', 'CiliaHub Analysis'),
        xAxisTitle: setting('setting-x-axis-title', 'X-Axis'),
        yAxisTitle: setting('setting-y-axis-title', 'Y-Axis'),
        titleFontSize: parseInt(setting('setting-title-font-size', 18)),
        axisTitleFontSize: parseInt(setting('setting-axis-title-font-size', 14)),
        tickFontSize: parseInt(setting('setting-tick-font-size', 12)),
        fontFamily: setting('setting-font-family', 'Arial'),
        backgroundColor: setting('setting-bg-color', '#ffffff'),
        fontColor: setting('setting-font-color', '#333333'),
        gridColor: setting('setting-grid-color', '#e0e0e0'),
        showGrid: document.getElementById('setting-show-grid')?.checked ?? true,
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
            if (plotType !== 'bubble' && plotType !== 'matrix') {
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
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const img = new Image();
            const svgBlob = new Blob([new XMLSerializer().serializeToString(svgElement)], { type: "image/svg+xml;charset=utf-8" });
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
            const a = document.createElement('a'); a.href = dataUrl; a.download = fileName; a.click();
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
// PLOTTING FUNCTIONS
// =============================================================================

function renderKeyLocalizations(foundGenes, container) {
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    if (!foundGenes.length) { container.innerHTML = '<p class="status-message">No genes found.</p>'; return; }
    const yCategories = ['Cilia','Basal Body','Transition Zone','Axoneme','Ciliary Membrane','Centrosome','Microtubules','Endoplasmic Reticulum','Flagella','Cytosol','Lysosome','Autophagosomes','Ribosome','Nucleus','P-body','Peroxisome'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            const match = yCategories.find(cat => cat.toLowerCase() === loc.toLowerCase());
            if (match) localizationCounts[match] = (localizationCounts[match] || 0) + 1;
        });
    });
    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (!categoriesWithData.length) { container.innerHTML = '<p class="status-message">No genes in primary ciliary localizations.</p>'; return; }
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Gene Count',
                data: categoriesWithData.map(loc => ({ x: localizationCounts[loc], y: loc, r: 8 + localizationCounts[loc] * 2, count: localizationCounts[loc] })),
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(41, 128, 185, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                customCanvasBackgroundColor: { enabled: false },
                legend: { display: false },
                title: { display: true, text: settings.mainTitle, font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: { title: { display: true, text: settings.xAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor }, grid: { display: settings.showGrid, color: settings.gridColor }, border: { display: true, width: 1.5 }, ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor } },
                y: { type: 'category', labels: yCategories, title: { display: true, text: settings.yAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor }, grid: { display: settings.showGrid, color: settings.gridColor }, border: { display: true, width: 1.5 }, ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor } }
            }
        }
    });
}

function renderGeneMatrix(foundGenes, container) {
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    if (!foundGenes.length) { container.innerHTML = '<p class="status-message">No genes to display.</p>'; return; }
    const yCategories = [...new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization')))].filter(Boolean).sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    if (yCategories.length === 0) { container.innerHTML = '<p class="status-message">Selected genes have no localization data.</p>'; return; }
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
                customCanvasBackgroundColor: { enabled: false },
                legend: { display: false },
                title: { display: true, text: settings.mainTitle, font: { size: settings.titleFontSize, family: settings.fontFamily }, color: settings.fontColor },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.y}` } }
            },
            scales: {
                x: { type: 'category', labels: xLabels, title: { display: true, text: settings.xAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor }, grid: { display: settings.showGrid, color: settings.gridColor }, border: { display: true, width: 1.5 }, ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor, maxRotation: 90, minRotation: 45 } },
                y: { type: 'category', labels: yCategories, title: { display: true, text: settings.yAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily }, color: settings.fontColor }, grid: { display: settings.showGrid, color: settings.gridColor }, border: { display: true, width: 1.5 }, ticks: { font: { size: settings.tickFontSize, family: settings.fontFamily }, color: settings.fontColor } }
            }
        }
    });
}

function calculateDomainEnrichmentFactor(selectedData, database) {
    if (selectedData.length === 0) return { enrichmentData: [] };
    const countDomains = (geneSet) => {
        const domainCounts = new Map();
        let genesWithDomains = new Set();
        geneSet.forEach(gene => {
            const domains = getCleanArray(gene, 'Domain_Descriptions', 'domain_descriptions');
            if (domains.length > 0) {
                genesWithDomains.add(gene.gene);
                domains.forEach(d => domainCounts.set(d, (domainCounts.get(d) || 0) + 1));
            }
        });
        return { counts: domainCounts, total: genesWithDomains.size };
    };
    const { counts: selectedCounts, total: selectedTotal } = countDomains(selectedData);
    const { counts: dbCounts, total: dbTotal } = countDomains(database);
    if (selectedTotal === 0) return { enrichmentData: [] };
    const enrichmentData = Array.from(selectedCounts.entries())
        .map(([domain, count]) => ({ domain, factor: ((count / selectedTotal) / ((dbCounts.get(domain) || 0) / dbTotal)) || 0 }))
        .sort((a, b) => b.factor - a.factor)
        .filter(d => d.factor > 0);
    return { enrichmentData };
}

function renderDomainEnrichmentFactorPlot(foundGenes, allGenes, container) {
    const settings = getPlotSettings();
    const { enrichmentData } = calculateDomainEnrichmentFactor(foundGenes, allGenes);
    if (!enrichmentData || enrichmentData.length === 0) { container.innerHTML = '<p class="status-message">No domain enrichment found.</p>'; return; }
    
    container.innerHTML = '';
    const topData = enrichmentData.slice(0, 20);
    const margin = { top: 30, right: 30, bottom: 60, left: 250 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = topData.length * 28;
    
    const svg = d3.select(container).append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0, d3.max(topData, d => d.factor) * 1.1]).range([0, width]);
    const y = d3.scaleBand().domain(topData.map(d => d.domain)).range([0, height]).padding(0.2);
    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x)).selectAll("text").style("font-family", settings.fontFamily).style("font-size", settings.tickFontSize + 'px').style("fill", settings.fontColor);
    svg.append("g").call(d3.axisLeft(y)).selectAll("text").style("font-family", settings.fontFamily).style("font-size", settings.tickFontSize + 'px').style("fill", settings.fontColor);
    svg.selectAll(".bar").data(topData).enter().append("rect").attr("x", x(0)).attr("y", d => y(d.domain)).attr("width", d => x(d.factor)).attr("height", y.bandwidth()).attr("fill", "#3498db");
    
    svg.append("text").attr("text-anchor", "middle").attr("x", width / 2).attr("y", -10).text(settings.mainTitle).style("font-family", settings.fontFamily).style("font-size", settings.titleFontSize + 'px').style("fill", settings.fontColor);
    svg.append("text").attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.bottom - 15).text(settings.xAxisTitle).style("font-family", settings.fontFamily).style("font-size", settings.axisTitleFontSize + 'px').style("fill", settings.fontColor);

    currentPlotInstance = svg.node().parentNode;
}

function renderMultiDimNetwork(foundGenes, container) {
    const settings = getPlotSettings();
    
    // **FIXED (5):** This helper function was missing its return statement.
    const addNode = (nodes, nodeMap, id, type) => {
        if (!nodeMap.has(id)) {
            const newNode = { id, type };
            nodeMap.set(id, newNode);
            nodes.push(newNode);
        }
        return nodeMap.get(id); // Return the node object
    };

    const nodes = [], links = [], nodeMap = new Map();
    foundGenes.forEach(gene => {
        addNode(nodes, nodeMap, gene.gene, 'gene');
        getCleanArray(gene, 'complex_names', 'complex').forEach(c => links.push({ source: gene.gene, target: addNode(nodes, nodeMap, c, 'complex').id }));
        getCleanArray(gene, 'Domain_Descriptions', 'domain_descriptions').forEach(d => links.push({ source: gene.gene, target: addNode(nodes, nodeMap, d, 'domain').id }));
        getCleanArray(gene, 'localization').forEach(l => links.push({ source: gene.gene, target: addNode(nodes, nodeMap, l, 'localization').id }));
    });

    if (nodes.length < 2 || links.length === 0) { container.innerHTML = '<p class="status-message">Not enough data to build a network.</p>'; return; }
    
    container.innerHTML = '';
    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);
    
    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
    const nodeColors = { 'gene': '#27ae60', 'complex': '#f39c12', 'domain': '#3498db', 'localization': '#8e44ad' };
    
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-150))
        .force("center", d3.forceCenter(width / 2, height / 2));
        
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").style("stroke", "#aaa");
    
    const nodeGroup = svg.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }).on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; }).on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    nodeGroup.append("circle").attr("r", d => d.type === 'gene' ? 8 : 6).style("fill", d => nodeColors[d.type] || '#ccc').style("stroke", "#fff").style("stroke-width", 1.5);
    
    nodeGroup.append("text")
        .text(d => d.id)
        .attr('x', 12)
        .attr('y', 4)
        .style("font-size", "11px")
        .style("font-family", settings.fontFamily)
        .style("fill", settings.fontColor)
        .style("pointer-events", "none");

    nodeGroup.append("title").text(d => `${d.id} (${d.type})`);
    
    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });
    
    currentPlotInstance = svg.node();
}

// =============================================================================
// MAIN CONTROLLER & UI
// =============================================================================
async function generateAnalysisPlots() {
    try {
        await loadAndPrepareDatabase();
        const plotContainer = document.getElementById('plot-display-area');
        const genesInput = document.getElementById('ciliaplot-genes-input').value.trim();
        if (!genesInput) { alert('Please enter a gene list.'); return; }
        plotContainer.innerHTML = '<p class="status-message">Generating plot...</p>';
        currentPlotInstance = null;
        const originalQueries = genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
        const sanitizedQueries = [...new Set(originalQueries.map(q => q.toUpperCase()))];
        const { foundGenes } = findGenes(sanitizedQueries);
        const plotType = document.getElementById('plot-type-select').value;
        const backgroundGeneSet = window.allGenes || [];
        updatePlotInfo(plotType);
        updateStatsAndLegend(plotType, foundGenes, backgroundGeneSet);
        switch (plotType) {
            case 'bubble': renderKeyLocalizations(foundGenes, plotContainer); break;
            case 'matrix': renderGeneMatrix(foundGenes, plotContainer); break;
            case 'enrichment_factor': renderDomainEnrichmentFactorPlot(foundGenes, backgroundGeneSet, plotContainer); break;
            case 'multi_dim_network': renderMultiDimNetwork(foundGenes, plotContainer); break;
            default: plotContainer.innerHTML = '<p class="status-message">Please select a valid plot type.</p>'; break;
        }
    } catch (error) {
        console.error('Error generating plots:', error);
        document.getElementById('plot-display-area').innerHTML = `<p class="status-message error">Error generating plot: ${error.message}</p>`;
    }
}

function updatePlotInfo(plotType) {
    const infoContainer = document.getElementById('ciliaplot-plot-info');
    if (!infoContainer) return;
    let infoHTML = '';
    switch(plotType) {
        case 'bubble': infoHTML = `<strong>Key Localizations:</strong> This bubble plot shows the distribution of your genes across primary ciliary and cellular compartments. The size of each bubble corresponds to the number of genes found in that location.`; break;
        case 'matrix': infoHTML = `<strong>Gene Matrix:</strong> This plot shows the specific localization for each gene in your list. A bubble indicates that a gene is associated with a particular ciliary compartment.`; break;
        case 'enrichment_factor': infoHTML = `<strong>Domain Enrichment Analysis:</strong> This plot shows which protein domains are overrepresented (enriched) in your selected genes compared to all genes in the CiliaHub database.<br><b>Enrichment Factor = </b>(Domain frequency in your genes) / (Domain frequency in database).`; break;
        case 'multi_dim_network': infoHTML = `<strong>Interactive Gene Network:</strong> This visualization shows relationships between genes (green) and their associated protein complexes (orange), domains (blue), and cellular localizations (purple).`; break;
    }
    infoContainer.innerHTML = infoHTML;
}

function updateStatsAndLegend(plotType, foundGenes, allGenes) {
    const statsContainer = document.getElementById('ciliaplot-stats-container');
    const legendContainer = document.getElementById('ciliaplot-legend-container');
    if (!statsContainer || !legendContainer) return;
    let statsHTML = '', legendHTML = '';
    statsHTML += `<div class="stat-box"><div class="stat-number">${foundGenes.length}</div><div class="stat-label">Input Genes Found</div></div>`;
    if (plotType === 'multi_dim_network') {
        const nodes = [], nodeMap = new Map();
        const addNode = (id, type) => { if (!nodeMap.has(id)) { nodeMap.set(id, { id, type }); nodes.push(nodeMap.get(id)); }};
        foundGenes.forEach(gene => {
            addNode(gene.gene, 'gene');
            getCleanArray(gene, 'complex_names', 'complex').forEach(c => addNode(c, 'complex'));
            getCleanArray(gene, 'Domain_Descriptions', 'domain_descriptions').forEach(d => addNode(d, 'domain'));
            getCleanArray(gene, 'localization').forEach(l => addNode(l, 'localization'));
        });
        statsHTML += `<div class="stat-box"><div class="stat-number">${nodes.filter(n=>n.type==='complex').length}</div><div class="stat-label">Complexes</div></div><div class="stat-box"><div class="stat-number">${nodes.filter(n=>n.type==='domain').length}</div><div class="stat-label">Domains</div></div><div class="stat-box"><div class="stat-number">${nodes.filter(n=>n.type==='localization').length}</div><div class="stat-label">Localizations</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: #27ae60;"></div><span>Gene</span></div><div class="legend-item"><div class="legend-color" style="background-color: #f39c12;"></div><span>Complex</span></div><div class="legend-item"><div class="legend-color" style="background-color: #3498db;"></div><span>Domain</span></div><div class="legend-item"><div class="legend-color" style="background-color: #8e44ad;"></div><span>Localization</span></div>`;
    } else if (plotType === 'enrichment_factor') {
        const { enrichmentData } = calculateDomainEnrichmentFactor(foundGenes, allGenes);
        const enrichedCount = enrichmentData.filter(d => d.factor > 1.5).length;
        statsHTML += `<div class="stat-box"><div class="stat-number">${enrichmentData.length}</div><div class="stat-label">Unique Domains</div></div><div class="stat-box"><div class="stat-number">${enrichedCount}</div><div class="stat-label">Enriched (>1.5)</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: #3498db; border-radius: 4px;"></div><span>Enrichment Factor</span></div>`;
    } else {
        const localizations = new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization'))).size;
        statsHTML += `<div class="stat-box"><div class="stat-number">${localizations}</div><div class="stat-label">Unique Localizations</div></div>`;
        legendHTML = '';
    }
    statsContainer.innerHTML = statsHTML;
    legendContainer.innerHTML = legendHTML;
}

function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
    if (document.querySelector('.cilia-panel')) {
        document.querySelector('.cilia-panel').style.display = 'none';
    }
    contentArea.innerHTML = `
    <div class="page-section ciliaplot-page">
        <div class="ciliaplot-header"><h1>CiliaPlot Gene Set Analysis</h1></div>
        <div class="ciliaplot-container-new">
            <div class="ciliaplot-left-panel-new">
                <div class="control-section">
                    <h3>1. Input & Analyse</h3>
                    <div class="control-section-content">
                        <textarea id="ciliaplot-genes-input" placeholder="Enter one gene per line..."></textarea>
                        <label for="plot-type-select" style="font-weight:bold; margin-top: 1rem; margin-bottom: 0.5rem;">Select Analysis Type</label>
                        <select id="plot-type-select" style="width:100%;padding:8px;margin-bottom:1rem;">
                            <option value="bubble">Key Localizations</option>
                            <option value="matrix">Gene Matrix</option>
                            <option value="enrichment_factor">Domain Enrichment</option>
                            <option value="multi_dim_network">Gene Network</option>
                        </select>
                        <button id="generate-plot-btn" class="btn btn-primary" style="width: 100%;">Run Analysis</button>
                    </div>
                </div>
                <div class="control-section">
                     <h3>2. Customize Plot</h3>
                     <details id="plot-customization-details"><summary>Expand Options</summary>
                         <div class="control-section-content" id="plot-settings-grid">
                            <div><label>Main Title <input type="text" id="setting-main-title" value="CiliaHub Analysis"></label></div>
                            <div><label>X-Axis Title <input type="text" id="setting-x-axis-title" value="X-Axis"></label></div>
                            <div><label>Y-Axis Title <input type="text" id="setting-y-axis-title" value="Y-Axis"></label></div>
                            <div><label>Font <select id="setting-font-family"><option>Arial</option><option>Verdana</option></select></label></div>
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
                    <h3>3. Download</h3>
                    <div class="control-section-content">
                        <select id="download-format" style="width:100%;padding:8px;margin-bottom:10px;"><option value="png">PNG</option><option value="pdf">PDF</option></select>
                        <button id="download-plot-btn" class="btn btn-secondary" style="width: 100%;">Download Plot</button>
                    </div>
                </div>
            </div>
            <div class="ciliaplot-right-panel-new">
                <div id="ciliaplot-plot-info" class="info">Select an analysis type and click "Run Analysis" to begin.</div>
                <div id="ciliaplot-stats-container" class="stats-container"></div>
                <div id="plot-display-area" class="plot-container-new"><p class="status-message">Your plot will appear here.</p></div>
                <div id="ciliaplot-legend-container" class="legend"></div>
            </div>
        </div>
    </div>`;
    
    document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
    
    document.getElementById('plot-type-select').addEventListener('change', () => {
        const plotArea = document.getElementById('plot-display-area');
        if (plotArea && !plotArea.querySelector('.status-message')) {
            generateAnalysisPlots();
        } else {
            updatePlotInfo(document.getElementById('plot-type-select').value);
        }
    });
    updatePlotInfo(document.getElementById('plot-type-select').value);
}
