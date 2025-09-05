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
// =============================================================================
// PLOT CUSTOMIZATION & HIGH-QUALITY DOWNLOAD
// =============================================================================

/**
 * Retrieves user-defined or default plot settings.
 */
function getPlotSettings() {
    const setting = (id, def) => document.getElementById(id)?.value || def;
    return {
        mainTitle: setting('setting-main-title', 'CiliaHub Analysis'),
        xAxisTitle: setting('setting-x-axis-title', 'X-Axis'),
        yAxisTitle: setting('setting-y-axis-title', 'Y-Axis'),
        titleFontSize: parseInt(setting('setting-title-font-size', 20)),   // default 20
        axisTitleFontSize: parseInt(setting('setting-axis-title-font-size', 20)), // default 20
        tickFontSize: parseInt(setting('setting-tick-font-size', 20)),     // default 20
        fontFamily: setting('setting-font-family', 'Arial'),
        backgroundColor: setting('setting-bg-color', '#ffffff'),
        fontColor: setting('setting-font-color', '#333333'),
        gridColor: setting('setting-grid-color', '#e0e0e0'),
        colorScale: setting('setting-color-scale', 'Viridis'),
        showLegend: document.getElementById('setting-show-legend')?.checked ?? true,
        showGrid: document.getElementById('setting-show-grid')?.checked ?? false, // default no grid
        axisLineWidth: parseFloat(setting('setting-axis-line-width', 1.5))
    };
}

/**
 * Downloads the currently displayed plot in PNG or PDF format.
 */
async function downloadPlot() {
    const format = document.getElementById('download-format')?.value || 'png';
    const plotArea = document.getElementById('plot-display-area');
    const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;

    if (!plotArea.firstChild || !plotType || plotArea.querySelector('.status-message')) {
        alert("Please generate a plot first.");
        return;
    }

    const fileName = `CiliaHub_${plotType}_plot.${format}`;
    const scale = 3; // 3x resolution
    const width = plotArea.clientWidth;
    const height = plotArea.clientHeight;

    try {
        let dataUrl;

        // Chart.js plots
        if (plotArea.querySelector('canvas')) {
            dataUrl = currentPlotInstance.toBase64Image('image/png', 1.0);
        }
        // Plotly plots
        else if (plotArea.querySelector('.js-plotly-plot')) {
            dataUrl = await Plotly.toImage(currentPlotInstance, {
                format: 'png',
                width: width * scale,
                height: height * scale
            });
        }
        // D3 SVG plots
        else if (plotArea.querySelector('svg')) {
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

        // Save as PNG
        if (format === 'png') {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            a.click();
        }
        // Save as PDF
        else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: width > height ? 'l' : 'p',
                unit: 'px',
                format: [width * scale, height * scale]
            });
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
// =============================================================================
// KEY LOCALIZATIONS (Bubble Plot)
// =============================================================================
function renderKeyLocalizations(foundGenes, container) {
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No ciliary genes found for plotting.</p>';
        return;
    }

    const settings = getPlotSettings();
    const yCategories = [
        'Cilia',
        'Basal Body',
        'Transition Zone',
        'Axoneme',
        'Ciliary Membrane',
        'Centrosome',
        'Microtubules',
        'Endoplasmic Reticulum',
        'Flagella',
        'Cytosol',
        'Lysosome',
        'Autophagosomes',
        'Ribosome',
        'Nucleus',
        'P-body',
        'Peroxisome'
    ];

    // Count genes per localization
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
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Key Localizations: Distribution of Your Genes Across Compartments', font: { size: 20 } },
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
                    type: 'category',
                    labels: yCategories,
                    title: { display: true, text: 'Cellular Compartment', font: { size: 20 } }, 
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
function renderDomainEnrichment(foundGenes, allGenes, container) {
    // Correctly calls calculateDomainEnrichment with the background gene set
    const stats = calculateDomainEnrichment(foundGenes, allGenes); 
    
    if (!stats || !stats.length) {
        container.innerHTML = '<p class="status-message">No domains found for enrichment.</p>';
        return;
    }

    // Note: The original calculateDomainEnrichment function returns 'geneCount'. The chart expects 'count'.
    // We will map it here to ensure compatibility.
    const domains = stats.map(d => ({ description: d.domain, count: d.geneCount }));
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
            responsive: true,
            maintainAspectRatio: false,
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
/**
 * Computes the associations between the found genes and known ciliopathies.
 * @param {Array<Object>} foundGenes - The array of gene objects found in the database.
 * @returns {Array<Object>} An array of objects for the sunburst plot, e.g., [{name: "Bardet-Biedl", count: 5}].
 */
function computeCiliopathyAssociations(foundGenes) {
    const associations = {};

    // Loop through the user's genes and count occurrences for each ciliopathy
    foundGenes.forEach(gene => {
        // Assumes gene.ciliopathy is an array of disease names, e.g., ["Bardet-Biedl syndrome", "Joubert syndrome"]
        if (gene.ciliopathy && Array.isArray(gene.ciliopathy)) {
            gene.ciliopathy.forEach(disease => {
                if (disease) { // Ensure the disease name is not null or empty
                    if (!associations[disease]) {
                        associations[disease] = { name: disease, count: 0 };
                    }
                    associations[disease].count++;
                }
            });
        }
    });

    // Convert the aggregated object into an array suitable for D3
    return Object.values(associations);
}

/**
 * Computes the network of protein complex interactions from a list of genes.
 * @param {Array<Object>} foundGenes - The array of gene objects found in the database.
 * @returns {Object} An object containing 'nodes' and 'links' arrays for the D3 force-directed graph.
 */
function computeProteinComplexLinks(foundGenes) {
    const nodes = foundGenes.map(gene => ({ id: gene.gene }));
    const links = [];
    const linkTracker = new Set(); // Prevents duplicate links (e.g., A->B and B->A)

    // Create links based on shared protein complexes
    for (let i = 0; i < foundGenes.length; i++) {
        for (let j = i + 1; j < foundGenes.length; j++) {
            const geneA = foundGenes[i];
            const geneB = foundGenes[j];

            // Assumes gene.complex is an array of complex IDs, e.g., ["BBSome", "IFT-B"]
            const sharedComplexes = (geneA.complex || []).filter(c => (geneB.complex || []).includes(c));

            if (sharedComplexes.length > 0) {
                const linkKey = [geneA.gene, geneB.gene].sort().join('-');
                if (!linkTracker.has(linkKey)) {
                    links.push({
                        source: geneA.gene,
                        target: geneB.gene,
                        value: sharedComplexes.length // The more shared complexes, the stronger the link
                    });
                    linkTracker.add(linkKey);
                }
            }
        }
    }

    return { nodes, links };
}

function renderCiliopathySunburst(foundGenes, container) {
    const data = computeCiliopathyAssociations(foundGenes); // uses your existing compute function
    if (!data.length) {
        container.innerHTML = '<p class="status-message">No ciliopathy associations found.</p>';
        return;
    }

    // Convert data to D3 hierarchy for sunburst
    const root = d3.hierarchy({ name: "Ciliopathies", children: data })
        .sum(d => d.count);

    const width = container.clientWidth;
    const radius = Math.min(width, 400) / 2;

    container.innerHTML = '';
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', radius * 2)
        .append('g')
        .attr('transform', `translate(${width / 2},${radius})`);

    const partition = d3.partition()
        .size([2 * Math.PI, radius]);

    partition(root);

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

    svg.selectAll('path')
        .data(root.descendants().filter(d => d.depth))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => d3.interpolateViridis(d.value / d.parent.value))
        .attr('stroke', '#fff')
        .append('title')
        .text(d => `${d.data.name}: ${d.value} gene(s)`);

    currentPlotInstance = svg.node();
}


function renderComplexNetwork(foundGenes, container) {
    const { nodes, links } = computeProteinComplexLinks(foundGenes);
    if (!nodes.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found.</p>';
        return;
    }

    const width = container.clientWidth;
    const height = 400;
    container.innerHTML = '';

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(80))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-width', d => Math.sqrt(d.value));

    const node = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', 10)
        .attr('fill', '#5690c7')
        .call(d3.drag()
            .on('start', d => { if (!d3.event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on('drag', d => { d.fx = d3.event.x; d.fy = d3.event.y; })
            .on('end', d => { if (!d3.event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
        );

    node.append('title').text(d => d.id);

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    });

    currentPlotInstance = svg.node();
}


/**
 * Calculate domain enrichment and return descriptive domain names.
 * @param {Array<Object>} filteredData - Found genes
 * @param {Array<Object>} allCiliaData - Background gene set
 * @returns {Array<Object>} - [{domain: "Name", richFactor: 2.5, geneCount: 3}]
 */
function calculateDomainEnrichment(filteredData, allCiliaData) {
    const domainCountsUser = new Map();
    filteredData.forEach(g =>
        (g.pfam_ids || []).forEach(id =>
            domainCountsUser.set(id, (domainCountsUser.get(id) || 0) + 1)
        )
    );

    const domainCountsBg = new Map();
    allCiliaData.forEach(g =>
        (g.pfam_ids || []).forEach(id =>
            domainCountsBg.set(id, (domainCountsBg.get(id) || 0) + 1)
        )
    );

    const M = filteredData.length,
        N = allCiliaData.length;
    if (M === 0) return [];

    return Array.from(domainCountsUser.entries())
        .map(([id, k]) => {
            const n = domainCountsBg.get(id) || 0;
            const richFactor = n > 0 ? (k / M) / (n / N) : Infinity;
            return {
                domain: pfamIdToName[id] || id, // use descriptive name if available
                richFactor,
                geneCount: k
            };
        })
        .filter(d => d.richFactor > 1.5 && d.geneCount > 1)
        .sort((a, b) => b.richFactor - a.richFactor);
}


// =============================================================================
// MAIN CONTROLLER & PAGE RENDERER
// =============================================================================
async function generateAnalysisPlots() {
    // 1. CORRECT: Load the database and store the returned object in a constant.
    const database = await loadAndPrepareDatabase(); // This is in script.js
    
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
    
    // 2. CORRECT: Pass the loaded 'database' to findGenes so it has data to search through.
    const { foundGenes, notFoundGenes } = findGenes(geneList, database); // This is in script.js
    
    createEnrichmentResultsTable(foundGenes, notFoundGenes);
    
    const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;
    switch (plotType) {
        case 'bubble': 
            renderKeyLocalizations(foundGenes, plotContainer); 
            break;
        case 'matrix': 
            renderGeneMatrix(foundGenes, plotContainer); 
            break;
        case 'domain': 
            // This now works correctly because 'database' is defined.
            renderDomainEnrichment(foundGenes, database.genes, plotContainer); 
            break;
        case 'ciliopathy': 
            renderCiliopathySunburst(foundGenes, plotContainer); 
            break;
        case 'network': 
            renderComplexNetwork(foundGenes, plotContainer); 
            break;
        default:
            plotContainer.innerHTML = '<p class="status-message">Please select a valid plot type.</p>';
            break;
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
