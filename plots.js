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
// PLOT CUSTOMIZATION & HIGH-QUALITY DOWNLOAD (YOUR ORIGINAL FUNCTIONS)
// =============================================================================
function getPlotSettings() {
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
    const format = document.getElementById('download-format')?.value || 'png';
    const plotArea = document.getElementById('plot-display-area');
    const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;

    if (!plotArea.firstChild || !plotType || plotArea.querySelector('.status-message')) {
        alert("Please generate a plot first.");
        return;
    }

    const fileName = `CiliaHub_${plotType}_plot.${format}`;
    const scale = 3; // High-resolution scaling
    const width = plotArea.clientWidth;
    const height = plotArea.clientHeight;

    try {
        let dataUrl;
        if (plotArea.querySelector('canvas')) {
            dataUrl = currentPlotInstance.toBase64Image('image/png', 1.0);
        } else if (plotArea.querySelector('.js-plotly-plot')) {
            dataUrl = await Plotly.toImage(currentPlotInstance, { format: 'png', width: width * scale, height: height * scale });
        } else if (plotArea.querySelector('svg')) {
            const svgElement = plotArea.querySelector('svg');
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = getPlotSettings().backgroundColor;
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
// RESULTS TABLE (YOUR ORIGINAL FUNCTION)
// =============================================================================
function createEnrichmentResultsTable(foundGenes, notFoundGenes) {
    const container = document.getElementById('ciliaplot-results-container');
    if (!container) return;
    let tableHTML = '';
    if (foundGenes.length > 0) {
        tableHTML += `<h4>Found Genes (${foundGenes.length})</h4><div class="table-wrapper"><table><thead><tr><th>Gene</th><th>Ensembl ID</th><th>Localization</th><th>Domains</th><th>Complexes</th><th>Ciliopathy</th></tr></thead><tbody>`;
        foundGenes.forEach(g => {
            tableHTML += `<tr>
                <td><a href="#/${g.gene}" onclick="navigateTo(event, '/${g.gene}')">${g.gene}</a></td>
                <td>${g.ensembl_id || ''}</td>
                <td>${(Array.isArray(g.localization) ? g.localization : []).join(', ')}</td>
                <td>${(Array.isArray(g.domain_descriptions) ? g.domain_descriptions : []).join(', ')}</td>
                <td>${(Array.isArray(g.complex_names) ? g.complex_names : []).join(', ')}</td>
                <td>${(Array.isArray(g.ciliopathy) ? g.ciliopathy : []).join(', ')}</td>
            </tr>`;
        });
        tableHTML += `</tbody></table></div>`;
    }
    if (notFoundGenes.length > 0) {
        tableHTML += `<h4 style="margin-top: 1.5rem;">Genes Not Found (${notFoundGenes.length})</h4><p>${notFoundGenes.join(', ')}</p>`;
    }
    container.innerHTML = tableHTML;
}


// =============================================================================
// KEPT ORIGINAL PLOTTING FUNCTIONS
// =============================================================================

function renderKeyLocalizations(foundGenes, container) {
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No ciliary genes found for plotting.</p>';
        return;
    }
    const yCategories = ['Cilia','Basal Body','Transition Zone','Axoneme','Ciliary Membrane','Centrosome','Microtubules','Endoplasmic Reticulum','Flagella','Cytosol','Lysosome','Autophagosomes','Ribosome','Nucleus','P-body','Peroxisome'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        (Array.isArray(gene.localization) ? gene.localization : []).forEach(loc => {
            const match = yCategories.find(cat => cat.toLowerCase() === loc.trim().toLowerCase());
            if (match) localizationCounts[match] = (localizationCounts[match] || 0) + 1;
        });
    });
    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (!categoriesWithData.length) {
        container.innerHTML = '<p class="status-message">No genes found in primary ciliary localizations.</p>';
        return;
    }
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
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
                legend: { display: false },
                title: { display: true, text: 'Key Localizations: Distribution of Your Genes Across Compartments', font: { size: 20 } },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: { title: { display: true, text: 'Gene Count', font: { size: 20 } }, grid: { display: false }, border: { display: true, width: 2 }, ticks: { font: { size: 20 } } },
                y: { type: 'category', labels: yCategories, title: { display: true, text: 'Cellular Compartment', font: { size: 20 } }, grid: { display: false }, border: { display: true, width: 2 }, ticks: { font: { size: 20 } } }
            }
        }
    });
}

function renderGeneMatrix(foundGenes, container) {
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes to display in the matrix plot.</p>';
        return;
    }
    const yCategories = [...new Set(foundGenes.flatMap(g => g.localization))].filter(Boolean).sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: foundGenes.map((gene, index) => ({
                label: gene.gene,
                data: (Array.isArray(gene.localization) ? gene.localization : []).map(loc => ({ x: gene.gene, y: loc, r: 10 })),
                backgroundColor: d3.schemeCategory10[index % 10]
            }))
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Gene Localization Matrix', font: { size: 20 } },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.y}` } }
            },
            scales: {
                x: { type: 'category', labels: xLabels, title: { display: true, text: 'Genes', font: { size: 20 } }, grid: { display: false }, border: { display: true, width: 2 }, ticks: { font: { size: 20 }, maxRotation: 90, minRotation: 45 } },
                y: { type: 'category', labels: yCategories, title: { display: true, text: 'Ciliary Compartment', font: { size: 20 } }, grid: { display: false }, border: { display: true, width: 2 }, ticks: { font: { size: 20 } } }
            }
        }
    });
}

// =============================================================================
// NEW INTEGRATED PLOTTING FUNCTIONS
// =============================================================================

function calculateDomainEnrichmentFactor(selectedData, database) {
    if (selectedData.length === 0) return { enrichmentData: [] };
    const countDomains = (geneSet) => {
        const domainCounts = new Map();
        let genesWithDomains = 0;
        geneSet.forEach(gene => {
            const domainData = gene.Domain_Descriptions || gene.domain_descriptions;
            if (domainData) {
                genesWithDomains++;
                const domains = Array.isArray(domainData) ? domainData : String(domainData).split(';');
                domains.forEach(domain => {
                    const d = domain.trim();
                    if (d) domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
                });
            }
        });
        return { counts: domainCounts, total: genesWithDomains };
    };
    const { counts: selectedCounts, total: selectedTotal } = countDomains(selectedData);
    const { counts: dbCounts, total: dbTotal } = countDomains(database);
    if (selectedTotal === 0) return { enrichmentData: [] };
    const enrichmentData = Array.from(selectedCounts.entries()).map(([domain, count]) => {
        const selectedFreq = count / selectedTotal;
        const dbFreq = (dbCounts.get(domain) || 0) / dbTotal;
        const factor = dbFreq > 0 ? selectedFreq / dbFreq : Infinity;
        return { domain, factor, count };
    }).sort((a, b) => b.factor - a.factor);
    return { enrichmentData };
}

function renderDomainEnrichmentFactorPlot(foundGenes, allGenes, container) {
    const settings = getPlotSettings();
    const { enrichmentData } = calculateDomainEnrichmentFactor(foundGenes, allGenes);
    if (!enrichmentData || enrichmentData.length === 0) {
        container.innerHTML = '<p class="status-message">No domains found for enrichment factor analysis.</p>';
        return;
    }
    container.innerHTML = '';
    const topData = enrichmentData.slice(0, 20);
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
    svg.append("text").attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.bottom - 10).text(settings.xAxisTitle || "Enrichment Factor").style("font-family", settings.fontFamily).style("font-size", settings.axisTitleFontSize + 'px').style("fill", settings.fontColor);
    currentPlotInstance = svg.node().parentNode;
}

function parseMultiDimData(geneData) {
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
    geneData.forEach(gene => {
        addNode(gene.gene, 'gene');
        const complexes = gene.complex_names || gene.complex;
        if (complexes) (Array.isArray(complexes) ? complexes : String(complexes).split(';')).forEach(c => c.trim() && links.push({ source: gene.gene, target: addNode(c.trim(), 'complex').id, type: 'gene-complex' }));
        const domains = gene.Domain_Descriptions || gene.domain_descriptions;
        if (domains) (Array.isArray(domains) ? domains : String(domains).split(';')).forEach(d => d.trim() && links.push({ source: gene.gene, target: addNode(d.trim(), 'domain').id, type: 'gene-domain' }));
        const localizations = gene.localization;
        if (localizations) (Array.isArray(localizations) ? localizations : String(localizations).split(';')).forEach(l => l.trim() && links.push({ source: gene.gene, target: addNode(l.trim(), 'localization').id, type: 'gene-localization' }));
    });
    return { nodes, links };
}

function renderMultiDimNetwork(foundGenes, container) {
    const settings = getPlotSettings();
    const { nodes, links } = parseMultiDimData(foundGenes);
    if (nodes.length < 2 || links.length === 0) {
        container.innerHTML = '<p class="status-message">Not enough data to build a network (requires at least 2 connected genes).</p>';
        return;
    }
    container.innerHTML = '';
    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);
    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).style("background-color", settings.backgroundColor);
    const nodeColors = { 'gene': '#2ecc71', 'complex': '#f39c12', 'domain': '#3498db', 'localization': '#8e44ad' };
    const simulation = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(60)).force("charge", d3.forceManyBody().strength(-100)).force("center", d3.forceCenter(width / 2, height / 2));
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").style("stroke", "#aaa").style("stroke-width", 1.5);
    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle").attr("r", d => d.type === 'gene' ? 8 : 5).style("fill", d => nodeColors[d.type] || '#ccc').style("stroke", "#fff").style("stroke-width", 1.5)
        .call(d3.drag()
            .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
            .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));
    node.append("title").text(d => `${d.id} (${d.type})`);
    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });
    currentPlotInstance = svg.node();
}


// =============================================================================
// MAIN CONTROLLER (MODIFIED FOR FINAL PLOT SELECTION)
// =============================================================================
async function generateAnalysisPlots() {
    try {
        await loadAndPrepareDatabase(); // Assumes this exists in your script.js
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
        const { foundGenes, notFoundGenes } = findGenes(sanitizedQueries); // Assumes findGenes exists in your script.js

        createEnrichmentResultsTable(foundGenes, notFoundGenes);
        
        const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;
        const backgroundGeneSet = window.allGenes || [];

        // FINALIZED SWITCH STATEMENT
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
        const plotContainer = document.getElementById('plot-display-area');
        plotContainer.innerHTML = `<p class="status-message error">Error generating plot: ${error.message}</p>`;
    }
}


// =============================================================================
// PAGE RENDERER (MODIFIED TO RENDER THE NEW UI)
// =============================================================================
function displayCiliaPlotPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full'; // Use full width
    if (document.querySelector('.cilia-panel')) {
        document.querySelector('.cilia-panel').style.display = 'none';
    }

    // This function now generates the complete, updated CiliaPlot UI
    contentArea.innerHTML = `
        <div class="page-section ciliaplot-page">
            <div class="ciliaplot-header">
                <h2>CiliaPlot: Gene List Analysis</h2>
                <p>Analyze your gene list with a variety of visualization tools and customization options.</p>
            </div>
            <div class="ciliaplot-container">
                <div class="ciliaplot-left-panel">
                    <div class="control-section">
                        <h3>1. Input Genes</h3>
                        <div class="control-section-content">
                            <textarea id="ciliaplot-genes-input" placeholder="Enter gene symbols, synonyms, or Ensembl IDs..."></textarea>
                            <button id="generate-plot-btn" class="btn btn-primary" style="width: 100%;">Run Analysis</button>
                        </div>
                    </div>
                    <div class="control-section">
                        <h3>2. Select Analysis Type</h3>
                        <div class="control-section-content">
                            <div class="plot-option">
                                <label><input type="radio" name="plot-type" value="bubble" checked> Key Localizations</label>
                                <p class="plot-option-explanation">Distribution of genes across ciliary compartments.</p>
                            </div>
                            <div class="plot-option">
                                <label><input type="radio" name="plot-type" value="matrix"> Gene Matrix</label>
                                <p class="plot-option-explanation">Specific localizations for each gene.</p>
                            </div>
                            <hr style="border-top: 1px solid #eee; margin: 1rem 0;">
                            <div class="plot-option">
                                <label><input type="radio" name="plot-type" value="enrichment_factor"> Domain Enrichment (Factor)</label>
                                <p class="plot-option-explanation"><b>[New]</b> Compares domain frequency vs. background.</p>
                            </div>
                            <div class="plot-option">
                                <label><input type="radio" name="plot-type" value="multi_dim_network"> Multi-Dimensional Network</label>
                                <p class="plot-option-explanation"><b>[New]</b> Shows links to domains, complexes, etc.</p>
                            </div>
                        </div>
                    </div>
                    <div class="control-section">
                        <h3>3. Customize Plot</h3>
                        <details id="plot-customization-details"><summary>Expand Customization Options</summary>
                            <div class="control-section-content"><div id="plot-settings-grid">
                                <div><label>Main Title <input type="text" id="setting-main-title" value="CiliaHub Analysis"></label></div>
                                <div><label>X-Axis Title <input type="text" id="setting-x-axis-title" value="X-Axis"></label></div>
                                <div><label>Y-Axis Title <input type="text" id="setting-y-axis-title" value="Y-Axis"></label></div>
                                <div><label>Font <select id="setting-font-family"><option>Arial</option><option>Verdana</option></select></label></div>
                                <div><label>Title Font Size <input type="number" id="setting-title-font-size" value="18"></label></div>
                                <div><label>Axis Font Size <input type="number" id="setting-axis-title-font-size" value="14"></label></div>
                                <div><label>Tick Font Size <input type="number" id="setting-tick-font-size" value="12"></label></div>
                                <div><label>Background <input type="color" id="setting-bg-color" value="#ffffff"></label></div>
                                <div><label>Font Color <input type="color" id="setting-font-color" value="#333333"></label></div>
                                <div><label>Gridline Color <input type="color" id="setting-grid-color" value="#e0e0e0"></label></div>
                                <div><label>Color Scale <select id="setting-color-scale"><option>Viridis</option><option>Plasma</option></select></label></div>
                                <div><label><input type="checkbox" id="setting-show-legend" checked> Show Legend</label></div>
                                <div><label><input type="checkbox" id="setting-show-grid" checked> Show Gridlines</label></div>
                            </div></div>
                        </details>
                    </div>
                     <div class="control-section">
                        <h3>4. Download</h3>
                        <div class="control-section-content">
                             <select id="download-format" style="width:100%;padding:8px;margin-bottom:10px; border-radius: 5px; border: 1px solid #ccc;"><option value="png">PNG (High Res)</option><option value="pdf">PDF</option></select>
                             <button id="download-plot-btn" class="btn btn-secondary" style="width: 100%;">Download Plot</button>
                        </div>
                    </div>
                </div>
                <div class="ciliaplot-right-panel">
                    <div id="plot-display-area"><p class="status-message">Enter a gene list and click "Run Analysis" to see your results.</p></div>
                    <div id="ciliaplot-results-container" class="results-section" style="margin-top: 2rem;"></div>
                </div>
            </div>
        </div>
    `;
    
    // Re-attach event listeners after regenerating the HTML
    document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}
