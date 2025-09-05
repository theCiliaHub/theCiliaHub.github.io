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
// PLOT CUSTOMIZATION & HIGH-QUALITY DOWNLOAD
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
        colorScale: setting('setting-color-scale', 'Viridis'),
        showLegend: document.getElementById('setting-show-legend')?.checked,
        showGrid: document.getElementById('setting-show-grid')?.checked,
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
    const scale = 3; // Render at 3x resolution for ~300 DPI
    const width = plotArea.clientWidth;
    const height = plotArea.clientHeight;

    try {
        let dataUrl;
        if (plotArea.querySelector('canvas')) { // Chart.js
            dataUrl = currentPlotInstance.toBase64Image('image/png', 1.0);
        } else if (plotArea.querySelector('.js-plotly-plot')) { // Plotly
             dataUrl = await Plotly.toImage(currentPlotInstance, { format: 'png', width: width * scale, height: height * scale });
        } else if (plotArea.querySelector('svg')) { // D3
            const svgElement = plotArea.querySelector('svg');
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = getPlotSettings().backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const img = new Image();
            const svgBlob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
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

        if (!dataUrl) { throw new Error("Could not generate image data URL."); }

        if (format === 'png') {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            a.click();
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'px', format: [width * scale, height * scale] });
            pdf.addImage(dataUrl, 'PNG', 0, 0, width * scale, height * scale);
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
function createEnrichmentResultsTable(foundGenes, notFoundGenes) {
    const container = document.getElementById('enrichment-results-container');
    if (!container) return;
    let tableHTML = '';
    if (foundGenes.length > 0) {
        tableHTML += `<h4>Found Genes (${foundGenes.length})</h4><div class="table-wrapper"><table><thead><tr><th>Gene</th><th>Ensembl ID</th><th>Localization</th></tr></thead><tbody>`;
        foundGenes.forEach(g => {
            tableHTML += `<tr><td><a href="/#/${g.gene}" onclick="navigateTo(event, '/${g.gene}')">${g.gene}</a></td><td>${g.ensembl_id || ''}</td><td>${(g.localization || []).join(', ')}</td></tr>`;
        });
        tableHTML += `</tbody></table></div>`;
    }
    if (notFoundGenes.length > 0) {
        tableHTML += `<h4 style="margin-top: 1.5rem;">Genes Not Found (${notFoundGenes.length})</h4><p>${notFoundGenes.join(', ')}</p>`;
    }
    container.innerHTML = tableHTML;
}

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
                backgroundColor: 'rgba(44, 90, 160, 0.7)'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                customCanvasBackgroundColor: { color: settings.backgroundColor },
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
                customCanvasBackgroundColor: { color: settings.backgroundColor },
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
            colorbar: { title: 'Rich Factor' }
        }
    }];

    const layout = {
        title: { text: settings.mainTitle, font: { size: settings.titleFontSize, family: settings.fontFamily, color: settings.fontColor } },
        xaxis: { title: { text: settings.xAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily, color: settings.fontColor } }, showgrid: settings.showGrid, gridcolor: settings.gridColor, tickfont: { family: settings.fontFamily, color: settings.fontColor } },
        yaxis: { title: { text: settings.yAxisTitle, font: { size: settings.axisTitleFontSize, family: settings.fontFamily, color: settings.fontColor } }, showgrid: settings.showGrid, gridcolor: settings.gridColor, tickfont: { family: settings.fontFamily, color: settings.fontColor } },
        paper_bgcolor: settings.backgroundColor,
        plot_bgcolor: settings.backgroundColor,
        showlegend: settings.showLegend,
        margin: { t: 40, b: 40, l: 50, r: 20 },
    };
    
    currentPlotInstance = container;
    Plotly.newPlot(container, data, layout, { responsive: true });
}

// ========== 1. CILIAPATHY SUNBURST ==========
/**
 * Renders a D3 sunburst chart for the given genes.
 */
function renderCiliopathySunburst(foundGenes, container) {
  // Clear container
  d3.select(container).selectAll("*").remove();

  // Group genes by ciliopathy
  const ciliopathyGroups = d3.group(foundGenes, d => d.ciliopathy || "No known ciliopathy");
  const root = {
    name: "Ciliopathy Genes",
    children: Array.from(ciliopathyGroups, ([ciliopathy, genes]) => ({
      name: ciliopathy,
      children: genes.map(g => ({ name: g.gene }))
    }))
  };

  const width = 500;
  const radius = width / 2;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", width)
    .append("g")
    .attr("transform", `translate(${radius},${radius})`);

  const partition = d3.partition().size([2 * Math.PI, radius]);
  const rootNode = d3.hierarchy(root).sum(d => d.children ? d.children.length : 1);
  partition(rootNode);

  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .innerRadius(d => d.y0)
    .outerRadius(d => d.y1);

  svg.selectAll("path")
    .data(rootNode.descendants())
    .join("path")
    .attr("d", arc)
    .attr("fill", d => d.depth === 0 ? "#ccc" : d3.schemeCategory10[d.depth % 10])
    .attr("stroke", "#fff")
    .on("mouseover", (event, d) => {
      const name = d.data.name;
      const count = d.value;
      d3.select(container).append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "4px 8px")
        .style("pointer-events", "none")
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`)
        .text(`${name}: ${count} gene${count > 1 ? "s" : ""}`);
    })
    .on("mouseout", () => {
      d3.select(container).selectAll(".tooltip").remove();
    })
    .on("click", (event, d) => {
      if (!d.children) {
        console.log(`Filter table for gene: ${d.data.name}`);
        // Optionally call your table filter function here
      }
    });
}

// ========== 2. COMPLEX NETWORK ==========
/**
 * Renders a D3 network chart for the given genes.
 */
function renderComplexNetwork(foundGenes, container)
  // Clear container
  d3.select(container).selectAll("*").remove();

  // Build nodes + edges
  const nodes = foundGenes.map(g => ({
    id: g.gene,
    ciliopathy: g.ciliopathy,
    complex: g.complex_names
  }));

  const edges = [];
  for (let i = 0; i < foundGenes.length; i++) {
    for (let j = i + 1; j < foundGenes.length; j++) {
      if (foundGenes[i].complex_names && foundGenes[j].complex_names &&
          foundGenes[i].complex_names === foundGenes[j].complex_names) {
        edges.push({ source: foundGenes[i].gene, target: foundGenes[j].gene });
      }
    }
  }

  const width = 600;
  const height = 400;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id).distance(80))
    .force("charge", d3.forceManyBody().strength(-250))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // Draw edges
  const link = svg.append("g")
    .attr("stroke", "#aaa")
    .attr("stroke-width", 1.5)
    .selectAll("line")
    .data(edges)
    .join("line");

  // Draw nodes
  const node = svg.append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", 6)
    .attr("fill", d => d.ciliopathy ? "#ff6666" : "#69b3a2")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  node.append("title").text(d => `${d.id}${d.complex ? " (" + d.complex + ")" : ""}`);

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);
  });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

function calculateDomainEnrichment(filteredData, allCiliaData) {
    const domainCountsUser = new Map();
    filteredData.forEach(g => (g.pfam_ids || []).forEach(id => domainCountsUser.set(id, (domainCountsUser.get(id) || 0) + 1)));
    const domainCountsBg = new Map();
    allCiliaData.forEach(g => (g.pfam_ids || []).forEach(id => domainCountsBg.set(id, (domainCountsBg.get(id) || 0) + 1)));
    const M = filteredData.length, N = allCiliaData.length;
    if (M === 0) return [];
    return Array.from(domainCountsUser.entries()).map(([id, k]) => {
        const n = domainCountsBg.get(id) || 0;
        const richFactor = n > 0 ? (k / M) / (n / N) : Infinity;
        return { domain: id, richFactor, geneCount: k };
    }).filter(d => d.richFactor > 1.5 && d.geneCount > 1).sort((a, b) => b.richFactor - a.richFactor);
}

// =============================================================================
// MAIN CONTROLLER & PAGE RENDERER
// =============================================================================
async function generateAnalysisPlots() {
    await loadAndPrepareDatabase(); // This is in script.js
    
    const plotContainer = document.getElementById('plot-display-area');
    const resultsContainer = document.getElementById('enrichment-results-container');
    const genesInput = document.getElementById('enrichment-genes-input').value.trim();

    if (!genesInput) {
        alert('Please enter a gene list.');
        return;
    }
    
    plotContainer.innerHTML = '<p class="status-message">Generating plot...</p>';
    if (resultsContainer) resultsContainer.innerHTML = '';
    currentPlotInstance = null;

    const geneList = genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
    const { foundGenes, notFoundGenes } = findGenes(geneList); // This is in script.js
    
    createEnrichmentResultsTable(foundGenes, notFoundGenes);
    
    const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;
    switch (plotType) {
        case 'bubble': renderEnrichmentBubblePlot(foundGenes, plotContainer); break;
        case 'matrix': renderBubbleMatrix(foundGenes, plotContainer); break;
        case 'domain': renderDomainEnrichment(foundGenes, plotContainer); break;
        case 'ciliopathy': renderCiliopathySunburst(foundGenes, plotContainer); break;
        case 'network': renderComplexNetwork(foundGenes, plotContainer); break;
    }
}

function displayEnrichmentPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.className = 'content-area content-area-full';
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
                    <div class="control-section">
                        <h3>1. Input Genes</h3>
                        <div class="control-section-content">
                            <textarea id="enrichment-genes-input" placeholder="Enter gene symbols, synonyms, or Ensembl IDs..."></textarea>
                            <button id="generate-plot-btn" class="btn btn-primary" style="width: 100%;">Run Analysis</button>
                        </div>
                    </div>
                    <div class="control-section">
                        <h3>2. Select Analysis Type</h3>
                        <div class="control-section-content">
                            <div class="plot-option"><label><input type="radio" name="plot-type" value="bubble" checked> Key Localizations</label><p class="plot-option-explanation">Distribution of your genes across primary ciliary compartments.</p></div>
                            <div class="plot-option"><label><input type="radio" name="plot-type" value="matrix"> Gene Matrix</label><p class="plot-option-explanation">Specific localizations for each gene across all compartments.</p></div>
                            <div class="plot-option"><label><input type="radio" name="plot-type" value="domain"> Domain Enrichment</label><p class="plot-option-explanation">Statistically over-represented protein domains (PFAM).</p></div>
                            <div class="plot-option"><label><input type="radio" name="plot-type" value="ciliopathy"> Ciliopathy Associations</label><p class="plot-option-explanation">Links between your genes and known ciliopathy disorders.</p></div>
                            <div class="plot-option"><label><input type="radio" name="plot-type" value="network"> Protein Complex Network</label><p class="plot-option-explanation">Connections between genes in the same protein complexes.</p></div>
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
                <div class="enrichment-right-panel">
                    <div id="plot-display-area"><p class="status-message">Enter a gene list and click "Run Analysis" to see your results.</p></div>
                    <div id="enrichment-results-container" class="results-section" style="margin-top: 2rem;"></div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('generate-plot-btn').addEventListener('click', generateAnalysisPlots);
    document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
}
