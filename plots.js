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

// =============================================================================
// GENERATE ANALYSIS PLOTS
// =============================================================================
async function generateAnalysisPlots() {
    const geneInput = document.getElementById('analysis-genes-input').value;
    if (!geneInput.trim()) {
        alert('Please enter a list of gene names.');
        return;
    }

    const queries = geneInput.split(/[\s,;]+/).filter(Boolean);
    const loaded = await loadAndPrepareDatabase();
    if (!loaded) {
        alert('Gene database failed to load. Using default gene set.');
    }

    const { foundGenes, notFoundGenes } = findGenes(queries);
    console.log('Found genes:', foundGenes, 'Not found:', notFoundGenes);

    createEnrichmentResultsTable(foundGenes, notFoundGenes);

    // Show plot wrapper
    const plotsWrapper = document.getElementById('enrichment-plots-wrapper');
    plotsWrapper.style.display = 'block';

    // -----------------------------
    // Key Localizations (Bubble Plot)
    // -----------------------------
    const keyLocCanvas = document.getElementById('analysis-bubble-plot');
    keyLocCanvas.style.display = 'block';
    renderKeyLocalizations(foundGenes, keyLocCanvas);

    // -----------------------------
    // Gene Matrix
    // -----------------------------
    const matrixCanvas = document.getElementById('analysis-matrix-plot');
    matrixCanvas.style.display = 'block';
    renderGeneMatrix(foundGenes, matrixCanvas);

    // -----------------------------
    // Domain Enrichment (Bubble)
    // -----------------------------
    const domainDiv = document.getElementById('bubble-chart-div');
    domainDiv.style.display = 'block';
    renderDomainEnrichment(foundGenes, domainDiv);

    // -----------------------------
    // Ciliopathy Associations (Sunburst)
    // -----------------------------
    const ciliopathyDiv = document.getElementById('sunburst-plot-div');
    ciliopathyDiv.style.display = 'block';
    renderCiliopathySunburst(foundGenes, ciliopathyDiv);

    // -----------------------------
    // Protein Complex Network
    // -----------------------------
    const networkDiv = document.getElementById('network-graph-div');
    networkDiv.style.display = 'block';
    renderComplexNetwork(foundGenes, networkDiv);
}


// =============================================================================
// PLOTTING FUNCTIONS
// =============================================================================

function createEnrichmentResultsTable(foundGenes, notFoundGenes) {
    const container = document.getElementById('enrichment-results-container');
    if (!container) return;
    let tableHTML = '';
    if (foundGenes.length > 0) {
        tableHTML += `<h4>Found Genes (${foundGenes.length})</h4><div class="table-wrapper"><table><thead><tr><th>Gene</th><th>Ensembl ID</th><th>Localization</th><th>Domains</th><th>Complexes</th><th>Ciliopathy</th></tr></thead><tbody>`;
        foundGenes.forEach(g => {
            tableHTML += `<tr>
                <td><a href="/#/${g.gene}" onclick="navigateTo(event, '/${g.gene}')">${g.gene}</a></td>
                <td>${g.ensembl_id || ''}</td>
                <td>${(g.localization || []).join(', ')}</td>
                <td>${(g.domain_descriptions || []).join(', ')}</td>
                <td>${(g.complex_names || []).join(', ')}</td>
                <td>${g.ciliopathy || ''}</td>
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
// PLOTTING FUNCTIONS FOR CILIAHUB ENRICHMENT
// =============================================================================

// =============================================================================
// KEY LOCALIZATIONS (Bubble Plot)
// =============================================================================
function renderKeyLocalizations(foundGenes, container) {
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No ciliary genes found for plotting.</p>';
        return;
    }

    const settings = getPlotSettings();
    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome'];
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
                data: categoriesWithData.map(loc => ({
                    x: localizationCounts[loc],
                    y: loc,
                    r: 8 + localizationCounts[loc] * 2,
                    count: localizationCounts[loc]
                })),
                backgroundColor: 'rgba(44, 90, 160, 0.7)'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Key Localizations: Distribution of Your Genes Across Primary Ciliary Compartments', font: { size: 20 } },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Gene Count', font: { size: 20 } }, 
                    grid: { display: false }, 
                    border: { display: true, width: 2 }, 
                    ticks: { font: { size: 20 } } 
                },
                y: { 
                    title: { display: true, text: 'Ciliary Compartment', font: { size: 20 } }, 
                    grid: { display: false }, 
                    border: { display: true, width: 2 }, 
                    ticks: { font: { size: 20 } } 
                }
            }
        }
    });
}

// =============================================================================
// GENE MATRIX (Bubble Matrix)
// =============================================================================
function renderGeneMatrix(foundGenes, container) {
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes to display in the matrix plot.</p>';
        return;
    }

    const settings = getPlotSettings();
    const yCategories = [...new Set(foundGenes.flatMap(g => g.localization))].filter(Boolean).sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();

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
                    r: 10
                })),
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
                x: { 
                    type: 'category', labels: xLabels,
                    title: { display: true, text: 'Genes', font: { size: 20 } },
                    grid: { display: false }, 
                    border: { display: true, width: 2 },
                    ticks: { font: { size: 20 }, maxRotation: 90, minRotation: 45 }
                },
                y: { 
                    type: 'category', labels: yCategories,
                    title: { display: true, text: 'Ciliary Compartment', font: { size: 20 } },
                    grid: { display: false }, 
                    border: { display: true, width: 2 },
                    ticks: { font: { size: 20 } }
                }
            }
        }
    });
}

// =============================================================================
// DOMAIN ENRICHMENT (Bar Chart)
// =============================================================================
function renderDomainEnrichment(foundGenes, container) {
    const stats = computeDomainEnrichment(foundGenes); // statistical calculation preserved
    if (!stats.length) {
        container.innerHTML = '<p class="status-message">No domains found for enrichment.</p>';
        return;
    }

    const domains = stats.map(d => ({ description: d.description, count: d.count, pValue: d.pValue }));
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');

    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: domains.map(d => d.description),
            datasets: [{ 
                label: 'Gene Count', 
                data: domains.map(d => d.count), 
                backgroundColor: 'rgba(89,161,79,0.7)'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { display: false }, 
                title: { display: true, text: 'Protein Domain Enrichment', font: { size: 20 } },
                tooltip: { callbacks: { label: c => `${c.label}: ${c.raw} gene(s)` } }
            },
            scales: {
                x: { title: { display: true, text: 'Gene Count', font: { size: 20 } }, grid: { display: false }, border: { display: true, width: 2 } },
                y: { title: { display: true, text: 'Domain', font: { size: 20 } }, grid: { display: false }, border: { display: true, width: 2 } }
            }
        }
    });
}

// =============================================================================
// CILIOPATHY ASSOCIATIONS (Sunburst)
// =============================================================================
function renderCiliopathySunburst(foundGenes, container) {
    const stats = computeCiliopathyAssociations(foundGenes); // statistical calculation preserved
    if (!stats || !stats.length) {
        container.innerHTML = '<p class="status-message">No ciliopathy associations found.</p>';
        return;
    }

    container.innerHTML = '';
    const width = container.clientWidth;
    const height = 500;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select(container).append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width/2},${height/2})`);

    const partition = d3.partition()
        .size([2 * Math.PI, radius]);

    const root = d3.hierarchy({ name: 'Ciliopathies', children: stats })
        .sum(d => d.count);

    partition(root);

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

    svg.selectAll('path')
        .data(root.descendants())
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => d.children ? d3.interpolateCool(d.depth / 3) : '#69b3a2')
        .attr('stroke', '#fff')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('fill', 'orange');
        })
        .on('mouseout', function(event, d) {
            d3.select(this).attr('fill', d.children ? d3.interpolateCool(d.depth / 3) : '#69b3a2');
        });
}

// =============================================================================
// PROTEIN COMPLEX NETWORK (Force-Directed Graph)
// =============================================================================
function renderComplexNetwork(foundGenes, container) {
    const stats = computeProteinComplexLinks(foundGenes); // statistical calculation preserved
    if (!stats || !stats.nodes || !stats.links) {
        container.innerHTML = '<p class="status-message">No protein complex data found.</p>';
        return;
    }

    container.innerHTML = '';
    const width = container.clientWidth;
    const height = 500;

    const svg = d3.select(container).append('svg')
        .attr('width', width)
        .attr('height', height);

    const simulation = d3.forceSimulation(stats.nodes)
        .force('link', d3.forceLink(stats.links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
        .selectAll('line')
        .data(stats.links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-width', d => Math.sqrt(d.value || 1));

    const node = svg.append('g')
        .selectAll('circle')
        .data(stats.nodes)
        .enter()
        .append('circle')
        .attr('r', 12)
        .attr('fill', '#1f77b4')
        .call(drag(simulation));

    const label = svg.append('g')
        .selectAll('text')
        .data(stats.nodes)
        .enter()
        .append('text')
        .text(d => d.id)
        .attr('font-size', 14)
        .attr('dx', 15)
        .attr('dy', 4);

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);

        label
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });

    function drag(sim) {
        return d3.drag()
            .on('start', event => {
                if (!event.active) sim.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            })
            .on('drag', event => {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            })
            .on('end', event => {
                if (!event.active) sim.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            });
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
