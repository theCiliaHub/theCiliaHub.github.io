// Chart.js Background Plugin
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

// =============================================================================
// DATA LOADING AND SEARCH SYSTEM
// =============================================================================

/**
 * Sanitizes any string by removing invisible characters, trimming, and uppercasing.
 */
function sanitize(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .trim()
        .toUpperCase();
}

/**
 * Loads, sanitizes, and prepares the gene database into an efficient lookup map.
 */
async function loadAndPrepareDatabase() {
    if (geneDataCache) return true;
    try {
        const resp = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const rawGenes = await resp.json();

        if (!Array.isArray(rawGenes)) {
            throw new Error('Invalid data format: expected array');
        }

        geneDataCache = rawGenes;
        allGenes = rawGenes;
        geneMapCache = new Map();

        allGenes.forEach(g => {
            if (!g.gene || typeof g.gene !== 'string') return;

            const nameKey = sanitize(g.gene);
            if (nameKey) geneMapCache.set(nameKey, g);

            if (g.synonym) {
                String(g.synonym).split(/[,;]/).forEach(syn => {
                    const key = sanitize(syn);
                    if (key && !geneMapCache.has(key)) geneMapCache.set(key, g);
                });
            }
        });

        console.log(`Loaded ${allGenes.length} genes into database`);
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
        const sanitizedQuery = sanitize(query);
        const result = geneMapCache.get(sanitizedQuery);

        if (result) {
            foundGenes.add(result);
        } else {
            notFound.push(query);
        }
    });

    return { foundGenes: Array.from(foundGenes), notFoundGenes: notFound };
}

// =============================================================================
// ORIGINAL PLOTTING FUNCTIONS (PRIMARY ANALYSIS)
// =============================================================================

/**
 * Calculates the p-value using the hypergeometric test.
 */
function hypergeometricPValue(k, n, K, N) {
    function logFactorial(num) {
        let result = 0;
        for (let i = 2; i <= num; i++) {
            result += Math.log(i);
        }
        return result;
    }
    function logCombination(n, k) {
        if (k > n || k < 0) return -Infinity;
        if (k === 0 || k === n) return 0;
        return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
    }
    let pValue = 0;
    const maxK = Math.min(n, K);
    for (let i = k; i <= maxK; i++) {
        const logProb = logCombination(K, i) + logCombination(N - K, n - i) - logCombination(N, n);
        pValue += Math.exp(logProb);
    }
    return Math.min(pValue, 1.0);
}

/**
 * Creates the results summary and tables at the bottom of the page.
 */
function createEnrichmentResultsTable(foundGenes, notFoundGenes, stats = null) {
    const container = document.getElementById('enrichment-results-container');
    if (!container) return;

    let summaryHTML = '';
    if (stats) {
        summaryHTML = `
            <div id="ciliome-results-summary">
                <h3>Enrichment Analysis Results 🔬</h3>
                <p>From your list of <strong>${stats.n_input}</strong> unique gene(s), <strong>${stats.k}</strong> were found in the CiliaHub database of <strong>${stats.M}</strong> ciliary genes.</p>
                <div class="stats-box">
                    <p><strong>Enrichment Score:</strong> ${stats.enrichmentScore.toFixed(2)}-fold</p>
                    <p><strong>P-value:</strong> ${stats.pValue.toExponential(3)}</p>
                </div>
            </div>
        `;
    }

    let tableHTML = '';
    if (foundGenes.length > 0) {
        tableHTML = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Gene</th>
                            <th>Ensembl ID</th>
                            <th>Localization</th>
                            <th>Function Summary</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${foundGenes.map(item => `
                            <tr>
                                <td><a href="/#/${item.gene}" onclick="navigateTo(event, '/${item.gene}')">${item.gene}</a></td>
                                <td>${item.ensembl_id || '—'}</td>
                                <td>${Array.isArray(item.localization) ? item.localization.join(', ') : (item.localization || '—')}</td>
                                <td>${item.functional_summary ? item.functional_summary.substring(0, 100) + '...' : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    let notFoundHTML = '';
    if (notFoundGenes.length > 0) {
        notFoundHTML = `
            <div class="not-found-section">
                <h4>Genes Not Found (${notFoundGenes.length}):</h4>
                <p>${notFoundGenes.sort().join(', ')}</p>
            </div>
        `;
    }

    container.innerHTML = summaryHTML + tableHTML + notFoundHTML;
}

/**
 * Renders the Ciliome enrichment plot.
 */
function renderCiliomeEnrichment(foundGenes, notFoundGenes, containerId) {
    const plotContainer = document.getElementById(containerId);
    if (!plotContainer) return;
    plotContainer.innerHTML = ''; 

    const k = foundGenes.length;
    const n_input = k + notFoundGenes.length;
    
    // Always create the stats and table for the Ciliome plot
    const M = allGenes ? allGenes.length : 2000;
    const N = 20000;
    const pValue = hypergeometricPValue(k, n_input, M, N);
    const enrichmentScore = (k / n_input) / (M / N) || 0;
    createEnrichmentResultsTable(foundGenes, notFoundGenes, { k, n_input, M, pValue, enrichmentScore });

    if (k === 0) {
        plotContainer.innerHTML = '<p class="status-message">No ciliary genes were found in your list to plot.</p>';
        return;
    }

    plotContainer.innerHTML = `<canvas id="primary-chart-canvas"></canvas>`;
    const ctx = document.getElementById('primary-chart-canvas').getContext('2d');
    
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        (Array.isArray(gene.localization) ? gene.localization : []).forEach(loc => {
            if (loc) {
                const term = loc.trim();
                const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
                localizationCounts[capitalizedTerm] = (localizationCounts[capitalizedTerm] || 0) + 1;
            }
        });
    });

    const chartData = Object.entries(localizationCounts).sort(([, a], [, b]) => b - a);

    currentPlot = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(d => d[0]),
            datasets: [{
                label: 'Gene Count',
                data: chartData.map(d => d[1]),
                backgroundColor: '#2ca25f',
            }]
        },
        options: { /* ... Your original options ... */ }
    });
}

/**
 * Renders the gene matrix plot.
 */
function renderBubbleMatrix(foundGenes, containerId) {
    const plotContainer = document.getElementById(containerId);
    if (!plotContainer) return;
    
    if (foundGenes.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No genes to display in the matrix plot.</p>';
        return;
    }
    
    plotContainer.innerHTML = `<canvas id="primary-chart-canvas"></canvas>`;
    const ctx = document.getElementById('primary-chart-canvas').getContext('2d');
    
    const yCategories = [...new Set(allGenes.flatMap(g => g.localization))].filter(Boolean).sort();
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    const colorPalette = ['#377eb8', '#ff7f00', '#4daf4a', '#f781bf', '#a65628', '#984ea3', '#999999', '#e41a1c', '#dede00'];

    const datasets = foundGenes.map((gene, index) => ({
        label: gene.gene,
        data: (Array.isArray(gene.localization) ? gene.localization : []).map(loc => ({
            x: gene.gene,
            y: loc,
            r: 10
        })).filter(d => yCategories.includes(d.y)),
        backgroundColor: colorPalette[index % colorPalette.length]
    }));

    currentPlot = new Chart(ctx, {
        type: 'bubble',
        data: { labels: xLabels, datasets },
        options: { /* ... Your original options ... */ }
    });
}

/**
 * Renders the enrichment bubble plot (Localization plot).
 */
function renderEnrichmentBubblePlot(foundGenes, containerId) {
    const plotContainer = document.getElementById(containerId);
    if (!plotContainer) return;

    if (foundGenes.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No ciliary genes were found to plot.</p>';
        return;
    }

    plotContainer.innerHTML = `<canvas id="primary-chart-canvas"></canvas>`;
    const ctx = document.getElementById('primary-chart-canvas').getContext('2d');

    const yCategories = [ 'Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome' ];
    const localizationCounts = {};
    yCategories.forEach(cat => localizationCounts[cat] = 0); // Initialize all
    foundGenes.forEach(gene => {
        (Array.isArray(gene.localization) ? gene.localization : []).forEach(loc => {
            if (loc && yCategories.includes(loc.trim())) {
                localizationCounts[loc.trim()]++;
            }
        });
    });

    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (categoriesWithData.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No genes found in the primary ciliary localizations.</p>';
        return;
    }

    const dataset = {
        data: categoriesWithData.map(loc => ({
            x: localizationCounts[loc],
            y: loc,
            r: 10 + localizationCounts[loc] * 2,
            count: localizationCounts[loc]
        })),
        backgroundColor: '#377eb8'
    };

    currentPlot = new Chart(ctx, {
        type: 'bubble',
        data: { datasets: [dataset] },
        options: { /* ... Your original options ... */ }
    });
}

// =============================================================================
// NEW ADVANCED PLOTTING FUNCTIONS
// =============================================================================

/**
 * Calculates enrichment of PFAM domains.
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

        if (richFactor > 1.5 && k > 1) { // Add stricter filter for relevance
            enrichedDomains.push({ domain: domainId, richFactor: richFactor, geneCount: k });
        }
    });

    return enrichedDomains.sort((a, b) => b.richFactor - a.richFactor);
}

/**
 * Creates the PFAM domain enrichment bubble chart using Plotly.
 */
function createDomainBubbleChart(enrichmentData) {
    const plotContainer = document.getElementById('bubble-chart-div');
    if (!plotContainer) return;
    
    if (!enrichmentData || enrichmentData.length === 0) {
        plotContainer.innerHTML = '<p class="status-message">No significantly enriched domains found for this gene list.</p>';
        return;
    }

    const trace = {
        x: enrichmentData.map(d => d.richFactor),
        y: enrichmentData.map(d => d.geneCount),
        text: enrichmentData.map(d => d.domain),
        mode: 'markers',
        marker: {
            size: enrichmentData.map(d => Math.min(d.geneCount * 10 + 8, 100)),
            color: enrichmentData.map(d => d.richFactor),
            colorscale: 'Viridis',
            showscale: true,
            colorbar: { title: 'Rich Factor' }
        }
    };

    const layout = {
        margin: { t: 5, b: 40, l: 50, r: 20 },
        hovermode: 'closest'
    };

    Plotly.newPlot(plotContainer, [trace], layout, {responsive: true});
}

/**
 * Prepares data and renders the Ciliopathy Sunburst plot using D3.
 */
function createSunburstPlot(filteredData) {
    const container = document.getElementById('sunburst-plot-div');
    if (!container) return;
    container.innerHTML = '';

    const ciliopathyMap = new Map();
    filteredData.forEach(gene => {
        if (gene.ciliopathy && gene.ciliopathy.trim() !== "") {
            const ciliopathyName = gene.ciliopathy.trim();
            if (!ciliopathyMap.has(ciliopathyName)) ciliopathyMap.set(ciliopathyName, []);
            ciliopathyMap.get(ciliopathyName).push({ name: gene.gene, value: 1 });
        }
    });

    const children = Array.from(ciliopathyMap.entries()).map(([name, genes]) => ({ name, children: genes }));
    const data = { name: "Ciliopathies", children: children };

    if (!data.children || data.children.length === 0) {
        container.innerHTML = '<p class="status-message">No genes with known ciliopathy associations were found.</p>';
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2.2;
    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));

    const hierarchy = d3.hierarchy(data).sum(d => d.value).sort((a, b) => b.value - a.value);
    const partition = d3.partition().size([2 * Math.PI, radius]);
    const root = partition(hierarchy);
    
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

    const svg = d3.select(container).append("svg")
        .attr("viewBox", [-width / 2, -height / 2, width, height]);

    svg.selectAll("path")
        .data(root.descendants().filter(d => d.depth))
        .join("path")
        .attr("d", arc)
        .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
        .attr("fill-opacity", 0.7)
        .append("title").text(d => `${d.ancestors().map(d => d.data.name).reverse().join(" → ")}`);
}

/**
 * Prepares data and renders the Protein Complex Network Graph using D3.
 */
function createNetworkGraph(filteredData) {
    const container = document.getElementById('network-graph-div');
    if (!container) return;
    container.innerHTML = '';

    const nodes = [];
    const nodeSet = new Set();
    const links = [];
    const complexMap = new Map();

    filteredData.forEach(gene => {
        if (gene.complex_names && gene.complex_names.trim() !== "") {
            const complexes = gene.complex_names.split(',').map(c => c.trim());
            complexes.forEach(complex => {
                if (!complexMap.has(complex)) complexMap.set(complex, []);
                complexMap.get(complex).push(gene.gene);
            });
        }
    });

    complexMap.forEach(genesInComplex => {
        if (genesInComplex.length > 1) {
            genesInComplex.forEach(geneName => {
                if (!nodeSet.has(geneName)) {
                    nodes.push({ id: geneName });
                    nodeSet.add(geneName);
                }
            });
            for (let i = 0; i < genesInComplex.length; i++) {
                for (let j = i + 1; j < genesInComplex.length; j++) {
                    links.push({ source: genesInComplex[i], target: genesInComplex[j] });
                }
            }
        }
    });
    
    if (links.length === 0) {
        container.innerHTML = '<p class="status-message">No shared protein complexes found in the gene list.</p>';
        return;
    }
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(50))
        .force("charge", d3.forceManyBody().strength(-150))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const svg = d3.select(container).append("svg").attr("viewBox", [0, 0, width, height]);

    const link = svg.append("g").attr("stroke", "#999").attr("stroke-opacity", 0.6)
        .selectAll("line").data(links).join("line");

    const node = svg.append("g").attr("stroke", "#fff").attr("stroke-width", 1.5)
        .selectAll("circle").data(nodes).join("circle")
        .attr("r", 8).attr("fill", "#377eb8").call(drag(simulation));

    node.append("title").text(d => d.id);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });

    function drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }
}

// =============================================================================
// MAIN CONTROLLER AND PAGE RENDERER
// =============================================================================

/**
 * Main controller to generate all analyses.
 */
function generateEnrichmentPlots() {
    const genesInput = document.getElementById('enrichment-genes-input').value.trim();
    if (!genesInput && document.getElementById('results-area').classList.contains('hidden')) {
        alert('Please enter a gene list.');
        return;
    }
    
    document.getElementById('results-area').classList.remove('hidden');

    const geneList = genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;
    const { foundGenes, notFoundGenes } = findGenes(geneList);
    const sortedFoundGenes = Array.from(foundGenes).sort((a, b) => a.gene.localeCompare(b.gene));

    if (currentPlot) {
        currentPlot.destroy();
        currentPlot = null;
    }
    document.getElementById('primary-plot-container').innerHTML = '';

    // Render the selected PRIMARY PLOT
    switch (plotType) {
        case 'bubble':
            renderEnrichmentBubblePlot(sortedFoundGenes, 'primary-plot-container');
            break;
        case 'matrix':
            renderBubbleMatrix(sortedFoundGenes, 'primary-plot-container');
            break;
        case 'ciliome':
            renderCiliomeEnrichment(sortedFoundGenes, notFoundGenes, 'primary-plot-container');
            break;
    }

    // Render ALL ADVANCED PLOTS
    const domainData = calculateDomainEnrichment(sortedFoundGenes, allGenes);
    createDomainBubbleChart(domainData);
    createSunburstPlot(sortedFoundGenes);
    createNetworkGraph(sortedFoundGenes);

    // Render the data table (Ciliome plot handles its own table creation)
    if (plotType !== 'ciliome') {
        createEnrichmentResultsTable(sortedFoundGenes, notFoundGenes);
    }
    
    document.getElementById('results-area').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Renders the HTML structure for the enrichment page.
 */
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
                <p>Paste your list of genes and CiliaHub will calculate enrichment and visualize functional associations.</p>
            </div>

            <div class="enrichment-controls-panel">
                <label for="enrichment-genes-input">Enter Gene List:</label>
                <textarea id="enrichment-genes-input" placeholder="e.g., IFT88, NPHP1, BBS1..."></textarea>
                <div class="action-buttons">
                    <button id="generate-plot-btn" class="btn btn-primary">Run Analysis</button>
                </div>
            </div>

            <div id="results-area" class="hidden">
                <div class="results-section-container">
                    <h3>Primary Analysis</h3>
                    <div class="plot-type-selection">
                        <label><input type="radio" name="plot-type" value="ciliome" checked> Ciliome Enrichment</label>
                        <label><input type="radio" name="plot-type" value="bubble"> Key Localizations</label>
                        <label><input type="radio" name="plot-type" value="matrix"> Gene Matrix</label>
                    </div>
                    <div id="primary-plot-container" class="plot-area-large"></div>
                </div>

                <div class="results-section-container">
                    <h3>Advanced Analyses</h3>
                    <div id="advanced-plots-wrapper">
                        <div class="plot-container">
                            <h4>Enriched Protein Domains (PFAM)</h4>
                            <div id="bubble-chart-div" class="plot-content"></div>
                            <div class="plot-explanation">
                                <p><strong>What it shows:</strong> This bubble chart highlights protein domains that are statistically over-represented in your gene list compared to the entire CiliaHub database. Each bubble is a single PFAM domain.</p>
                                <ul>
                                    <li><strong>X-Axis (Rich Factor):</strong> How many times more frequent the domain is in your list than expected. A value of 2 means it's twice as frequent.</li>
                                    <li><strong>Y-Axis (Gene Count):</strong> The number of genes in your list that contain this domain.</li>
                                    <li><strong>Bubble Size & Color:</strong> Represent the gene count and enrichment factor, respectively.</li>
                                </ul>
                            </div>
                        </div>
                        <div class="plot-container">
                            <h4>Ciliopathy Associations</h4>
                            <div id="sunburst-plot-div" class="plot-content"></div>
                            <div class="plot-explanation">
                                <p><strong>What it shows:</strong> This chart visualizes the connection between your genes and known ciliopathies. The inner ring shows the disease, and the outer ring shows the specific genes from your list associated with it.</p>
                            </div>
                        </div>
                        <div class="plot-container">
                            <h4>Protein Complex Network</h4>
                            <div id="network-graph-div" class="plot-content"></div>
                             <div class="plot-explanation">
                                <p><strong>What it shows:</strong> This network illustrates how genes in your list are connected by shared membership in protein complexes. A line between two genes (nodes) indicates they work together in a known complex, revealing functional modules.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="results-section-container">
                    <h3>Gene Details</h3>
                    <div id="enrichment-results-container"></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('generate-plot-btn').addEventListener('click', generateEnrichmentPlots);
    document.querySelectorAll('input[name="plot-type"]').forEach(radio => {
        radio.addEventListener('change', generateEnrichmentPlots);
    });
}
