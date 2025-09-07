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
    const container = document.getElementById('ciliaplot-results-container');
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

function renderDomainEnrichment(foundGenes, allGenes, container) {
    console.log('Rendering domain enrichment...');
    console.log('Found genes:', foundGenes);
    console.log('All genes:', allGenes);
    
    if (!foundGenes || !Array.isArray(foundGenes) || foundGenes.length === 0) {
        container.innerHTML = '<p class="status-message">No genes found for domain enrichment analysis.</p>';
        return;
    }
    
    if (!allGenes || !Array.isArray(allGenes) || allGenes.length === 0) {
        container.innerHTML = '<p class="status-message">No background gene data available for comparison.</p>';
        return;
    }

    try {
        const stats = calculateDomainEnrichment(foundGenes, allGenes);
        
        if (!stats || !stats.length) {
            container.innerHTML = `
                <p class="status-message">
                    No significant domain enrichment found. 
                    This could mean:<br>
                    1. Your genes don't share common domains<br>
                    2. The domains aren't enriched compared to background<br>
                    3. Domain data may not be available for these genes
                </p>
            `;
            return;
        }

        const topDomains = stats.sort((a, b) => b.geneCount - a.geneCount).slice(0, 15);
        
        container.innerHTML = `<canvas></canvas>`;
        const ctx = container.querySelector('canvas').getContext('2d');
        const settings = getPlotSettings();

        currentPlotInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topDomains.map(d => {
                    const maxLength = 30;
                    return d.domain.length > maxLength 
                        ? d.domain.substring(0, maxLength) + '...' 
                        : d.domain;
                }),
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
                        text: settings.mainTitle || 'Protein Domain Enrichment',
                        font: { 
                            size: settings.titleFontSize,
                            family: settings.fontFamily
                        }
                    },
                    tooltip: { 
                        callbacks: { 
                            label: (context) => {
                                const domain = topDomains[context.dataIndex];
                                return [
                                    `Domain: ${domain.domain}`,
                                    `Gene Count: ${context.raw}`,
                                    `Rich Factor: ${domain.richFactor.toFixed(2)}`,
                                    `Background: ${domain.backgroundCount} genes`
                                ];
                            }
                        } 
                    }
                },
                scales: {
                    x: { 
                        title: { 
                            display: true, 
                            text: settings.xAxisTitle || 'Gene Count',
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
                            text: settings.yAxisTitle || 'Protein Domain',
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
    } catch (error) {
        console.error('Error rendering domain enrichment:', error);
        container.innerHTML = `
            <p class="status-message error">
                Error rendering domain enrichment: ${error.message}<br>
                Please check the console for details.
            </p>
        `;
    }
}


function calculateDomainEnrichment(filteredData, allCiliaData) {
    if (!filteredData || !Array.isArray(filteredData)) {
        console.error('Filtered data is not an array:', filteredData);
        return [];
    }
    
    if (!allCiliaData || !Array.isArray(allCiliaData)) {
        console.error('All cilia data is not an array:', allCiliaData);
        return [];
    }

    const domainCountsUser = new Map();
    
    filteredData.forEach(g => {
        if (!g) return;
        const domains = g.pfam_ids || g.domains || g.domain_descriptions || g.pfam_domains || g.protein_domains || [];
        if (Array.isArray(domains)) {
            domains.forEach(domain => {
                if (typeof domain === 'string' && domain.trim()) {
                    const cleanDomain = domain.trim();
                    domainCountsUser.set(cleanDomain, (domainCountsUser.get(cleanDomain) || 0) + 1);
                } else if (domain && domain.id) {
                    domainCountsUser.set(domain.id, (domainCountsUser.get(domain.id) || 0) + 1);
                } else if (domain && typeof domain === 'object') {
                    const domainName = domain.name || domain.description || domain.id;
                    if (domainName) {
                        domainCountsUser.set(domainName, (domainCountsUser.get(domainName) || 0) + 1);
                    }
                }
            });
        }
    });

    const domainCountsBg = new Map();
    allCiliaData.forEach(g => {
        if (!g) return;
        const domains = g.pfam_ids || g.domains || g.domain_descriptions || g.pfam_domains || g.protein_domains || [];
        if (Array.isArray(domains)) {
            domains.forEach(domain => {
                if (typeof domain === 'string' && domain.trim()) {
                    const cleanDomain = domain.trim();
                    domainCountsBg.set(cleanDomain, (domainCountsBg.get(cleanDomain) || 0) + 1);
                } else if (domain && domain.id) {
                    domainCountsBg.set(domain.id, (domainCountsBg.get(domain.id) || 0) + 1);
                } else if (domain && typeof domain === 'object') {
                    const domainName = domain.name || domain.description || domain.id;
                    if (domainName) {
                        domainCountsBg.set(domainName, (domainCountsBg.get(domainName) || 0) + 1);
                    }
                }
            });
        }
    });

    const M = filteredData.length;
    const N = allCiliaData.length;
    
    if (M === 0) {
        console.warn('No filtered data for enrichment calculation');
        return [];
    }

    const enrichmentResults = Array.from(domainCountsUser.entries())
        .map(([domainId, k]) => {
            const n = domainCountsBg.get(domainId) || 0;
            const richFactor = n > 0 ? (k / M) / (n / N) : Infinity;
            
            let domainName = domainId;
            if (typeof domainId === 'string' && pfamIdToName && pfamIdToName[domainId]) {
                domainName = pfamIdToName[domainId];
            }
            
            return {
                domain: domainName,
                richFactor,
                geneCount: k,
                backgroundCount: n,
                pValue: calculateEnrichmentPValue(k, M, n, N)
            };
        })
        .filter(d => d.richFactor > 1.5 && d.geneCount > 1)
        .sort((a, b) => b.richFactor - a.richFactor);

    return enrichmentResults;
}

function calculateEnrichmentPValue(k, M, n, N) {
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

function computeCiliopathyAssociations(foundGenes) {
    const associations = {};
    foundGenes.forEach(gene => {
        if (gene.ciliopathy && Array.isArray(gene.ciliopathy)) {
            gene.ciliopathy.forEach(disease => {
                if (disease) {
                    if (!associations[disease]) {
                        associations[disease] = { name: disease, count: 0 };
                    }
                    associations[disease].count++;
                }
            });
        }
    });
    return Object.values(associations);
}

function computeProteinComplexLinks(foundGenes) {
    const nodes = foundGenes.map(gene => ({ id: gene.gene }));
    const links = [];
    const linkTracker = new Set();
    for (let i = 0; i < foundGenes.length; i++) {
        for (let j = i + 1; j < foundGenes.length; j++) {
            const geneA = foundGenes[i];
            const geneB = foundGenes[j];
            const sharedComplexes = (geneA.complex || []).filter(c => (geneB.complex || []).includes(c));
            if (sharedComplexes.length > 0) {
                const linkKey = [geneA.gene, geneB.gene].sort().join('-');
                if (!linkTracker.has(linkKey)) {
                    links.push({
                        source: geneA.gene,
                        target: geneB.gene,
                        value: sharedComplexes.length
                    });
                    linkTracker.add(linkKey);
                }
            }
        }
    }
    return { nodes, links };
}

function renderCiliopathySunburst(foundGenes, container) {
    const data = computeCiliopathyAssociations(foundGenes);
    
    if (!data || !data.length) {
        container.innerHTML = '<p class="status-message">No ciliopathy associations found.</p>';
        return;
    }
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
    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height).append('g').attr('transform', `translate(${width / 2},${height / 2})`);
    const root = d3.hierarchy({ children: data }).sum(d => d.count).sort((a, b) => b.value - a.value);
    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);
    const arc = d3.arc().startAngle(d => d.x0).endAngle(d => d.x1).innerRadius(d => d.y0).outerRadius(d => d.y1);
    svg.selectAll('path').data(root.descendants()).enter().append('path').attr('d', arc).style('fill', d => {
        if (d.depth === 0) return '#ccc';
        const index = d.parent.children.indexOf(d);
        return d3.schemeCategory10[index % 10];
    }).style('stroke', '#fff').style('stroke-width', '2px').on('mouseover', function(event, d) {
        d3.select(this).style('opacity', 0.8);
    }).on('mouseout', function() {
        d3.select(this).style('opacity', 1);
    }).append('title').text(d => `${d.data.name}: ${d.value} gene(s)`);
    svg.selectAll('text').data(root.descendants().filter(d => d.depth && (d.x1 - d.x0) > 0.05)).enter().append('text').attr('transform', d => {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }).attr('dy', '0.35em').attr('text-anchor', 'middle').text(d => d.data.name).style('font-size', '12px').style('fill', '#fff').style('font-weight', 'bold');
    currentPlotInstance = svg.node();
}

function renderComplexNetwork(foundGenes, container) {
    const { nodes, links } = computeProteinComplexLinks(foundGenes);
    
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found.</p>';
        return;
    }
    container.innerHTML = '';
    const width = container.clientWidth;
    const height = Math.min(width * 0.8, 600);
    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
    const simulation = d3.forceSimulation(nodes).force('link', d3.forceLink(links).id(d => d.id).distance(100)).force('charge', d3.forceManyBody().strength(-300)).force('center', d3.forceCenter(width / 2, height / 2)).force('collision', d3.forceCollide().radius(30));
    const link = svg.append('g').attr('class', 'links').selectAll('line').data(links).enter().append('line').attr('stroke', '#999').attr('stroke-opacity', 0.6).attr('stroke-width', d => Math.sqrt(d.value) * 2);
    const node = svg.append('g').attr('class', 'nodes').selectAll('circle').data(nodes).enter().append('circle').attr('r', 12).attr('fill', '#5690c7').attr('stroke', '#fff').attr('stroke-width', 2).call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));
    node.append('title').text(d => d.id);
    const label = svg.append('g').attr('class', 'labels').selectAll('text').data(nodes).enter().append('text').text(d => d.id).attr('text-anchor', 'middle').attr('dy', -15).style('font-size', '10px').style('pointer-events', 'none');
    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('cx', d => d.x).attr('cy', d => d.y);
        label.attr('x', d => d.x).attr('y', d => d.y);
    });
    function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }
    currentPlotInstance = svg.node();
}

// =============================================================================
// MAIN CONTROLLER & PAGE RENDERER
// =============================================================================
async function generateAnalysisPlots() {
    try {
        await loadAndPrepareDatabase();
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
        const originalQueries = genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
        const sanitizedQueries = [...new Set(originalQueries.map(sanitize))];
        const { foundGenes } = findGenes(sanitizedQueries);
        const foundGeneSymbols = new Set(foundGenes.map(g => g.gene.toUpperCase()));
        const notFoundOriginalQueries = originalQueries.filter(q => {
            const result = geneMapCache.get(sanitize(q));
            return !result || !foundGeneSymbols.has(result.gene.toUpperCase());
        });
        createEnrichmentResultsTable(foundGenes, notFoundOriginalQueries);
        const plotType = document.querySelector('input[name="plot-type"]:checked')?.value;
        const backgroundGeneSet = window.allGenes || [];
        switch (plotType) {
            case 'bubble':
                renderKeyLocalizations(foundGenes, plotContainer);
                break;
            case 'matrix':
                renderGeneMatrix(foundGenes, plotContainer);
                break;
            case 'domain':
                if (backgroundGeneSet.length === 0) {
                    plotContainer.innerHTML = '<p class="status-message error">Background gene database not loaded. Cannot perform Domain Enrichment analysis.</p>';
                    return;
                }
                renderDomainEnrichment(foundGenes, backgroundGeneSet, plotContainer);
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
    } catch (error) {
        console.error('Error generating plots:', error);
        const plotContainer = document.getElementById('plot-display-area');
        plotContainer.innerHTML = `<p class="status-message error">Error generating plot: ${error.message}</p>`;
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
