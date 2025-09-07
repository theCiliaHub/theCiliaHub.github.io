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



function createEnrichmentResultsTable(foundGenes, notFoundGenes) {
    const container = document.getElementById('enrichment-results-container');
    if (!container) return;

    let tableHTML = '';

    if (foundGenes.length > 0) {
        tableHTML += `
        <h4>Found Genes (${foundGenes.length})</h4>
        <div class="table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>Gene</th>
                    <th>Ensembl ID</th>
                    <th>Localization</th>
                    <th>Domains</th>
                    <th>Complexes</th>
                    <th>Ciliopathy</th>
                </tr>
            </thead>
            <tbody>
        `;

        foundGenes.forEach(g => {
            // Ensure all fields are arrays for safe joining
            const localization = Array.isArray(g.localization)
                ? g.localization
                : g.localization
                ? [g.localization]
                : [];

            const domains = Array.isArray(g.domain_descriptions)
                ? g.domain_descriptions
                : g.domain_descriptions
                ? [g.domain_descriptions]
                : [];

            const complexes = Array.isArray(g.complex_names)
                ? g.complex_names
                : g.complex_names
                ? [g.complex_names]
                : [];

            const ciliopathy = Array.isArray(g.ciliopathy)
                ? g.ciliopathy
                : g.ciliopathy
                ? [g.ciliopathy]
                : [];

            tableHTML += `
                <tr>
                    <td><a href="/#/${g.gene}" onclick="navigateTo(event, '/${g.gene}')">${g.gene}</a></td>
                    <td>${g.ensembl_id || ''}</td>
                    <td>${localization.join(', ')}</td>
                    <td>${domains.join(', ')}</td>
                    <td>${complexes.join(', ')}</td>
                    <td>${ciliopathy.join(', ')}</td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table></div>`;
    }

    if (notFoundGenes.length > 0) {
        tableHTML += `
        <h4 style="margin-top: 1.5rem;">Genes Not Found (${notFoundGenes.length})</h4>
        <p>${notFoundGenes.join(', ')}</p>
        `;
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
// DOMAIN ENRICHMENT (Bar Chart) - FIXED
// =============================================================================
function renderDomainEnrichment(foundGenes, allGenes, container) {
    const stats = calculateDomainEnrichment(foundGenes, allGenes);
    
    if (!stats || !stats.length) {
        container.innerHTML = '<p class="status-message">No domains found for enrichment.</p>';
        return;
    }

    // Sort by count and take top 15 to avoid overcrowding
    const topDomains = stats.sort((a, b) => b.geneCount - a.geneCount).slice(0, 15);
    
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    const settings = getPlotSettings();

    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topDomains.map(d => d.domain),
            datasets: [{ 
                label: 'Gene Count', 
                data: topDomains.map(d => d.geneCount), 
                backgroundColor: 'rgba(89,161,79,0.7)',
                borderColor: 'rgba(89,161,79,1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false }, 
                title: { 
                    display: true, 
                    text: settings.mainTitle,
                    font: { 
                        size: settings.titleFontSize,
                        family: settings.fontFamily
                    }
                },
                tooltip: { 
                    callbacks: { 
                        label: (context) => `${context.dataset.label}: ${context.raw} gene(s)` 
                    } 
                }
            },
            scales: {
                x: { 
                    title: { 
                        display: true, 
                        text: settings.xAxisTitle,
                        font: {
                            size: settings.axisTitleFontSize,
                            family: settings.fontFamily
                        }
                    }, 
                    grid: { display: settings.showGrid, color: settings.gridColor }, 
                    border: { display: true, width: settings.axisLineWidth },
                    ticks: {
                        font: {
                            size: settings.tickFontSize,
                            family: settings.fontFamily
                        }
                    }
                },
                y: { 
                    title: { 
                        display: true, 
                        text: settings.yAxisTitle,
                        font: {
                            size: settings.axisTitleFontSize,
                            family: settings.fontFamily
                        }
                    }, 
                    grid: { display: settings.showGrid, color: settings.gridColor }, 
                    border: { display: true, width: settings.axisLineWidth },
                    ticks: {
                        font: {
                            size: settings.tickFontSize,
                            family: settings.fontFamily
                        }
                    }
                }
            }
        }
    });
}

// Enhanced domain enrichment calculation
function calculateDomainEnrichment(filteredData, allCiliaData) {
    const domainCountsUser = new Map();
    
    // Handle different possible field names for domains
    filteredData.forEach(g => {
        const domains = g.pfam_ids || g.domains || g.domain_descriptions || [];
        domains.forEach(domain => {
            if (typeof domain === 'string') {
                domainCountsUser.set(domain, (domainCountsUser.get(domain) || 0) + 1);
            } else if (domain && domain.id) {
                domainCountsUser.set(domain.id, (domainCountsUser.get(domain.id) || 0) + 1);
            }
        });
    });

    const domainCountsBg = new Map();
    allCiliaData.forEach(g => {
        const domains = g.pfam_ids || g.domains || g.domain_descriptions || [];
        domains.forEach(domain => {
            if (typeof domain === 'string') {
                domainCountsBg.set(domain, (domainCountsBg.get(domain) || 0) + 1);
            } else if (domain && domain.id) {
                domainCountsBg.set(domain.id, (domainCountsBg.get(domain.id) || 0) + 1);
            }
        });
    });

    const M = filteredData.length;
    const N = allCiliaData.length;
    
    if (M === 0) return [];

    return Array.from(domainCountsUser.entries())
        .map(([domainId, k]) => {
            const n = domainCountsBg.get(domainId) || 0;
            const richFactor = n > 0 ? (k / M) / (n / N) : Infinity;
            
            // Try to get descriptive name, fall back to ID
            let domainName = domainId;
            if (typeof domainId === 'string' && pfamIdToName && pfamIdToName[domainId]) {
                domainName = pfamIdToName[domainId];
            }
            
            return {
                domain: domainName,
                richFactor,
                geneCount: k,
                pValue: calculateEnrichmentPValue(k, M, n, N)
            };
        })
        .filter(d => d.richFactor > 1.5 && d.geneCount > 1)
        .sort((a, b) => b.richFactor - a.richFactor);
}

// Helper function for p-value calculation
function calculateEnrichmentPValue(k, M, n, N) {
    // Hypergeometric test p-value
    let pValue = 0;
    for (let i = k; i <= Math.min(n, M); i++) {
        pValue += (combinations(n, i) * combinations(N - n, M - i)) / combinations(N, M);
    }
    return pValue;
}

function combinations(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let result = 1;
    for (let i = 1; i <= k; i++) {
        result = result * (n - k + i) / i;
    }
    return result;
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

// =============================================================================
// CILIOPATHY ASSOCIATIONS (Sunburst) - FIXED
// =============================================================================
function renderCiliopathySunburst(foundGenes, container) {
    const data = computeCiliopathyAssociations(foundGenes);
    
    if (!data || !data.length) {
        container.innerHTML = '<p class="status-message">No ciliopathy associations found.</p>';
        return;
    }

    // Add "Other" category for genes without ciliopathy associations
    const genesWithCiliopathy = new Set();
    data.forEach(item => {
        foundGenes.filter(g => g.ciliopathy && g.ciliopathy.includes(item.name))
            .forEach(g => genesWithCiliopathy.add(g.gene));
    });
    
    const genesWithoutCiliopathy = foundGenes.filter(g => !genesWithCiliopathy.has(g.gene));
    if (genesWithoutCiliopathy.length > 0) {
        data.push({ name: "No Known Association", count: genesWithoutCiliopathy.length });
    }

    container.innerHTML = '';
    const width = container.clientWidth;
    const height = Math.min(width, 600);
    const radius = Math.min(width, height) / 2;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    // Create hierarchy
    const root = d3.hierarchy({ children: data })
        .sum(d => d.count)
        .sort((a, b) => b.value - a.value);

    // Create partition layout
    const partition = d3.partition()
        .size([2 * Math.PI, radius]);

    partition(root);

    // Create arc generator
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

    // Add arcs
    svg.selectAll('path')
        .data(root.descendants())
        .enter()
        .append('path')
        .attr('d', arc)
        .style('fill', d => {
            if (d.depth === 0) return '#ccc';
            const index = d.parent.children.indexOf(d);
            return d3.schemeCategory10[index % 10];
        })
        .style('stroke', '#fff')
        .style('stroke-width', '2px')
        .on('mouseover', function(event, d) {
            d3.select(this).style('opacity', 0.8);
            // Show tooltip
        })
        .on('mouseout', function() {
            d3.select(this).style('opacity', 1);
            // Hide tooltip
        })
        .append('title')
        .text(d => `${d.data.name}: ${d.value} gene(s)`);

    // Add labels for larger segments
    svg.selectAll('text')
        .data(root.descendants().filter(d => d.depth && (d.x1 - d.x0) > 0.05))
        .enter()
        .append('text')
        .attr('transform', d => {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        })
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .text(d => d.data.name)
        .style('font-size', '12px')
        .style('fill', '#fff')
        .style('font-weight', 'bold');

    currentPlotInstance = svg.node();
}

// Enhanced ciliopathy computation
function computeCiliopathyAssociations(foundGenes) {
    const associations = {};

    foundGenes.forEach(gene => {
        let ciliopathies = [];
        
        // Handle different data formats
        if (Array.isArray(gene.ciliopathy)) {
            ciliopathies = gene.ciliopathy;
        } else if (typeof gene.ciliopathy === 'string') {
            ciliopathies = gene.ciliopathy.split(',').map(s => s.trim());
        } else if (gene.ciliopathy_associations) {
            ciliopathies = Array.isArray(gene.ciliopathy_associations) 
                ? gene.ciliopathy_associations 
                : [gene.ciliopathy_associations];
        }

        ciliopathies.forEach(disease => {
            if (disease && disease.trim()) {
                const cleanDisease = disease.trim();
                associations[cleanDisease] = (associations[cleanDisease] || 0) + 1;
            }
        });
    });

    return Object.entries(associations).map(([name, count]) => ({
        name,
        count
    })).sort((a, b) => b.count - a.count);
}

// =============================================================================
// PROTEIN COMPLEX NETWORK - FIXED
// =============================================================================
function renderComplexNetwork(foundGenes, container) {
    const { nodes, links } = computeProteinComplexLinks(foundGenes);
    
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found.</p>';
        return;
    }

    container.innerHTML = '';
    const width = container.clientWidth;
    const height = Math.min(width * 0.8, 600);

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));

    const link = svg.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', d => Math.sqrt(d.value) * 2);

    const node = svg.append('g')
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', 12)
        .attr('fill', '#5690c7')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended)
        );

    node.append('title')
        .text(d => d.id);

    // Add labels
    const label = svg.append('g')
        .attr('class', 'labels')
        .selectAll('text')
        .data(nodes)
        .enter()
        .append('text')
        .text(d => d.id)
        .attr('text-anchor', 'middle')
        .attr('dy', -15)
        .style('font-size', '10px')
        .style('pointer-events', 'none');

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

    currentPlotInstance = svg.node();
}

// Enhanced complex computation
function computeProteinComplexLinks(foundGenes) {
    const nodes = foundGenes.map(gene => ({ 
        id: gene.gene,
        group: gene.localization ? (Array.isArray(gene.localization) ? gene.localization[0] : gene.localization) : 'unknown'
    }));
    
    const links = [];
    const complexMap = new Map();

    // First, map genes to complexes
    foundGenes.forEach(gene => {
        let complexes = [];
        
        // Handle different complex field names
        if (Array.isArray(gene.complex)) {
            complexes = gene.complex;
        } else if (Array.isArray(gene.complex_names)) {
            complexes = gene.complex_names;
        } else if (typeof gene.complex === 'string') {
            complexes = gene.complex.split(',').map(s => s.trim());
        }

        complexes.forEach(complex => {
            if (!complexMap.has(complex)) {
                complexMap.set(complex, new Set());
            }
            complexMap.get(complex).add(gene.gene);
        });
    });

    // Create links between genes in the same complex
    complexMap.forEach((genes, complex) => {
        const geneArray = Array.from(genes);
        for (let i = 0; i < geneArray.length; i++) {
            for (let j = i + 1; j < geneArray.length; j++) {
                links.push({
                    source: geneArray[i],
                    target: geneArray[j],
                    value: 1, // Each shared complex contributes 1
                    complex: complex
                });
            }
        }
    });

    // Merge duplicate links and increase value
    const mergedLinks = [];
    const linkMap = new Map();
    
    links.forEach(link => {
        const key = [link.source, link.target].sort().join('-');
        if (linkMap.has(key)) {
            linkMap.get(key).value += 1;
        } else {
            const newLink = { ...link };
            linkMap.set(key, newLink);
            mergedLinks.push(newLink);
        }
    });

    return { nodes, links: mergedLinks };
}

// PFAM ID to Name mapping (example - replace with your actual data)
const pfamIdToName = {
    'PF00001': '7 transmembrane receptor',
    'PF00002': '7 transmembrane receptor (rhodopsin family)',
    'PF00004': 'ATPase family associated with various cellular activities (AAA)',
    'PF00005': 'ABC transporter',
    'PF00008': 'EGF-like domain',
    'PF00009': 'Elongation factor Tu GTP binding domain',
    'PF00010': 'Helix-loop-helix DNA-binding domain',
    'PF00011': 'Hsp20/alpha crystallin family',
    'PF00012': 'HSP70 protein',
    'PF00013': 'KH domain',
    'PF00014': 'Kunitz/Bovine pancreatic trypsin inhibitor domain',
    'PF00015': 'WD domain, G-beta repeat',
    'PF00016': 'EGF-like domain',
    'PF00017': 'SH2 domain',
    'PF00018': 'SH3 domain',
    'PF00023': 'Ankyrin repeat',
    'PF00024': 'PAN domain',
    'PF00025': 'ADP-ribosylation factor family',
    'PF00026': 'Eukaryotic aspartyl protease',
    'PF00027': 'Cyclin, N-terminal domain',
    'PF00028': 'Cadherin domain',
    'PF00029': 'Concanavalin A-like lectin/glucanase',
    'PF00030': 'Pou domain - N-terminal to homeobox domain',
    'PF00031': 'Cystine-knot domain',
    'PF00032': 'Cytochrome c family',
    'PF00033': 'Cytochrome b N-terminal domain',
    'PF00034': 'Cytochrome c oxidase subunit I',
    'PF00035': 'Cytochrome c oxidase subunit II',
    'PF00036': 'EF-hand',
    'PF00037': 'Ferritin-like domain',
    'PF00038': 'Zinc finger, C2H2 type',
    'PF00039': 'Fibronectin type I domain',
    'PF00040': 'Fibronectin type II domain',
    'PF00041': 'Fibronectin type III domain',
    'PF00042': 'Globin',
    'PF00043': 'Glutathione S-transferase, C-terminal domain',
    'PF00044': 'Glyceraldehyde 3-phosphate dehydrogenase, NAD binding domain',
    'PF00045': 'Glyceraldehyde 3-phosphate dehydrogenase, C-terminal domain',
    'PF00046': 'Homeobox domain',
    'PF00047': 'Immunoglobulin domain',
    'PF00048': 'Immunoglobulin I-set domain',
    'PF00049': 'Immunoglobulin V-set domain',
    'PF00050': 'Kringle domain',
    'PF00051': 'Kringle domain',
    'PF00052': 'Laminin EGF-like domain',
    'PF00053': 'Laminin G domain',
    'PF00054': 'Laminin IV domain',
    'PF00055': 'Laminin B (Domain IV)',
    'PF00056': 'Lactate/malate dehydrogenase, NAD binding domain',
    'PF00057': 'Lactate/malate dehydrogenase, alpha/beta C-terminal domain',
    'PF00058': 'Low-density lipoprotein receptor domain class A',
    'PF00059': 'Lectin C-type domain',
    'PF00060': 'Ligand-gated ion channel',
    'PF00061': 'Lipocalin',
    'PF00062': 'Lysosome-associated membrane glycoprotein (LAMP) family',
    'PF00063': 'Myosin head (motor domain)',
    'PF00064': 'Myosin tail',
    'PF00065': 'Coagulation factor 5/8 C-terminal domain',
    'PF00066': 'LNR domain',
    'PF00067': 'Cytochrome P450',
    'PF00068': 'C2 domain',
    'PF00069': 'Protein kinase domain',
    'PF00070': 'Pyruvate kinase, barrel domain',
    'PF00071': 'Ras family',
    'PF00072': 'Response regulator receiver domain',
    'PF00073': 'Rich family',
    'PF00074': 'RNA-directed RNA polymerase',
    'PF00075': 'RNase H',
    'PF00076': 'RNA recognition motif. (a.k.a. RRM, RBD, or RNP domain)',
    'PF00077': 'Retrovirus capsid protein',
    'PF00078': 'Reverse transcriptase (RNA-dependent DNA polymerase)',
    'PF00079': 'Serine protease',
    'PF00080': 'Subtilase family',
    'PF00081': 'Ubiquitin family',
    'PF00082': 'Ubiquitin-conjugating enzyme',
    'PF00083': 'Zinc finger, RING-type',
    'PF00084': 'Sushi domain (SCR repeat)',
    'PF00085': 'Thioredoxin',
    'PF00086': 'Zinc finger, C3HC4 type (RING finger)',
    'PF00087': 'Zinc finger, C2H2 type',
    'PF00088': 'Zinc finger, C2H2 type',
    'PF00089': 'Trypsin',
    'PF00090': 'Tubulin/FtsZ family, GTPase domain',
    'PF00091': 'Tubulin C-terminal domain',
    'PF00092': 'Vascular endothelial growth factor receptor (VEGFR)',
    'PF00093': 'VWC domain',
    'PF00094': 'von Willebrand factor type A domain',
    'PF00095': 'von Willebrand factor type C domain',
    'PF00096': 'Zinc finger, C2H2 type',
    'PF00097': 'Zinc finger, C3HC4 type (RING finger)',
    'PF00098': 'Zinc knuckle',
    'PF00099': 'Zinc finger, C2H2 type',
    'PF00100': 'Zinc finger, C2H2 type'
    // Add more mappings as needed
};


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
