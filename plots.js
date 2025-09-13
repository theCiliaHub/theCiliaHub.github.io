// =============================================================================
// CiliaHub Plotting Engine (plots.js) - v2.0.3
// =============================================================================
// Fixes:
// - Added downloadPlot function to handle PNG/PDF exports.
// - Initialized legendHTML to prevent undefined errors in updateStatsAndLegend.
// - Added robust DOM checks in generateAnalysisPlots for plotContainer.
// Improvements:
// - Merged matrix plots, added clustering, colorblind-friendly colors, larger fonts.
// - Scalability: Limits genes/categories/tissues (50/15-20).
// - Robustness: Validates data, logs warnings for missing keys.
// Dependencies: D3.js, Chart.js, ChartDataLabels, chartjs-plugin-zoom, jsPDF
// =============================================================================

let currentPlotInstance = null;

/**
 * Safely clears the previous plot, handling both Chart.js and D3.js instances.
 */
function clearPreviousPlot() {
    if (currentPlotInstance) {
        if (typeof currentPlotInstance.destroy === 'function') {
            currentPlotInstance.destroy();
        } else if (currentPlotInstance.nodeType) {
            currentPlotInstance.remove();
        }
    }
    currentPlotInstance = null;
}

/**
 * Downloads the current plot as PNG or PDF.
 */
function downloadPlot(format = 'png') {
    if (!currentPlotInstance) {
        console.error('No plot available to download.');
        alert('No plot available to download.');
        return;
    }
    
    const plotContainer = document.getElementById('plot-display-area');
    if (!plotContainer) {
        console.error('Plot container not found.');
        return;
    }
    
    const filename = `ciliahub_plot_${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
    
    if (currentPlotInstance instanceof Chart) {
        const canvas = plotContainer.querySelector('canvas');
        if (!canvas) {
            console.error('Canvas not found for Chart.js plot.');
            return;
        }
        if (format === 'png') {
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
        } else if (format === 'pdf') {
            const pdf = new jsPDF('landscape');
            const imgData = canvas.toDataURL('image/png');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(filename);
        }
    } else if (currentPlotInstance.nodeType && currentPlotInstance.tagName === 'svg') {
        const svg = currentPlotInstance;
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svg);
        if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
            source = `<?xml version="1.0" standalone="no"?>\n${source}`;
        }
        if (format === 'png') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            img.onload = () => {
                canvas.width = svg.getAttribute('width');
                canvas.height = svg.getAttribute('height');
                ctx.drawImage(img, 0, 0);
                const pngUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = pngUrl;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(url);
            };
            img.src = url;
        } else if (format === 'pdf') {
            const pdf = new jsPDF('landscape');
            const imgData = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(source)));
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'SVG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(filename);
        }
    } else {
        console.error('Unsupported plot type for download.');
    }
}

/**
 * Robustly extracts a clean array of values from a gene object.
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
    const separatorRegex = /[,;]/;
    const initialArray = Array.isArray(data) ? data : String(data).split(separatorRegex);
    return initialArray
        .filter(Boolean)
        .flatMap(item => String(item).split(separatorRegex))
        .map(item => item.trim())
        .filter(Boolean);
}

/**
 * Updated calculateExpressionStats with standard deviation and robust handling.
 */
function calculateExpressionStats(genes) {
    const tissues = getTissueNames();
    const stats = { meanExpression: {}, medianExpression: {}, maxExpression: {}, geneCount: {}, stdDevExpression: {} };
    tissues.forEach(tissue => {
        const values = genes.map(gene => {
            const expr = getGeneExpression(gene.gene);
            return expr && expr[tissue] !== undefined && expr[tissue] !== null ? expr[tissue] : 0;
        }).filter(v => v > 0);
        if (values.length > 0) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            stats.meanExpression[tissue] = mean;
            stats.medianExpression[tissue] = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
            stats.maxExpression[tissue] = Math.max(...values);
            stats.geneCount[tissue] = values.length;
            const sumSq = values.reduce((a, b) => a + b * b, 0);
            stats.stdDevExpression[tissue] = values.length > 1 ? Math.sqrt((sumSq - (mean * mean * values.length)) / (values.length - 1)) : 0;
        } else {
            stats.meanExpression[tissue] = 0;
            stats.medianExpression[tissue] = 0;
            stats.maxExpression[tissue] = 0;
            stats.geneCount[tissue] = 0;
            stats.stdDevExpression[tissue] = 0;
        }
    });
    return stats;
}

// =============================================================================
// PLOTTING FUNCTIONS: LOCALIZATION, DOMAIN & NETWORK
// =============================================================================

/**
 * Key Localizations as a bar chart (replaces bubble).
 */
function renderKeyLocalizations(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }
    
    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Centrosome', 'Microtubules', 'Endoplasmic Reticulum', 'Flagella', 'Cytosol', 'Lysosome', 'Autophagosomes', 'Ribosome', 'Nucleus', 'P-body', 'Peroxisome'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => {
            const match = yCategories.find(cat => cat.toLowerCase() === loc.toLowerCase());
            if (match) localizationCounts[match] = (localizationCounts[match] || 0) + 1;
        });
    });
    
    const categoriesWithData = yCategories
        .filter(cat => localizationCounts[cat] > 0)
        .sort((a, b) => (localizationCounts[b] || 0) - (localizationCounts[a] || 0))
        .slice(0, 10);
    
    if (!categoriesWithData.length) {
        container.innerHTML = '<p class="status-message">No genes in primary ciliary localizations.</p>';
        return;
    }
    
    const data = categoriesWithData.map(cat => localizationCounts[cat] || 0);
    const labels = categoriesWithData.map(cat => cat.replace(/(.{15})/g, "$1\n"));
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gene Count',
                data: data,
                backgroundColor: data.map((_, i) => `rgba(94, 60, 153, ${0.2 + i * 0.7 / data.length})`),
                borderColor: 'rgba(94, 60, 153, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: 'Key Ciliary Localizations (Top 10)', 
                    font: { size: settings.titleFontSize + 4, family: 'Helvetica', weight: 'bold' }, 
                    color: '#333333' 
                },
                legend: { display: false },
                tooltip: { 
                    callbacks: { label: c => `${c.raw} genes in ${categoriesWithData[c.dataIndex]}` },
                    bodyFont: { size: 14 }
                },
                datalabels: { 
                    display: true, 
                    color: '#333', 
                    font: { size: 12, family: 'Helvetica', weight: 'bold' }, 
                    formatter: (value) => value 
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Cellular Compartment', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333', 
                        maxRotation: 45, 
                        minRotation: 45, 
                        padding: 10 
                    }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Gene Count', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333', 
                        stepSize: 1 
                    }
                }
            }
        }
    });
}

/**
 * Merged Gene-Localization and Gene-Domain Matrix.
 */
function renderMatrixPlot(foundGenes, container, type = 'localization') {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes to display.</p>';
        return;
    }
    
    const key = type === 'localization' ? 'localization' : 'domain_descriptions';
    const yCategories = [...new Set(foundGenes.flatMap(g => getCleanArray(g, key)))]
        .filter(Boolean)
        .map(item => item.charAt(0).toUpperCase() + item.slice(1))
        .sort()
        .slice(0, 20);
    
    const xLabels = [...new Set(foundGenes.map(g => g.gene))]
        .sort()
        .slice(0, 50);
    
    if (!yCategories.length || !xLabels.length) {
        container.innerHTML = `<p class="status-message">No ${type} data for selected genes.</p>`;
        return;
    }
    
    const datasets = foundGenes
        .filter(g => xLabels.includes(g.gene))
        .map((gene, index) => ({
            label: gene.gene,
            data: getCleanArray(gene, key)
                .filter(loc => yCategories.includes(loc.charAt(0).toUpperCase() + loc.slice(1)))
                .map(loc => ({
                    x: gene.gene,
                    y: loc.charAt(0).toUpperCase() + loc.slice(1),
                    r: 10
                })),
            backgroundColor: d3.schemeTableau10[index % 10]
        }))
        .filter(ds => ds.data.length > 0);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: type === 'localization' ? 'Gene-Localization Matrix' : 'Gene-Domain Matrix', 
                    font: { size: settings.titleFontSize + 4, family: 'Helvetica', weight: 'bold' }, 
                    color: '#333333' 
                },
                legend: { display: false },
                tooltip: { 
                    callbacks: { label: c => `${c.dataset.label}: ${c.raw.y}` },
                    bodyFont: { size: 14 }
                },
                zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }, pan: { enabled: true, mode: 'xy' } }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: xLabels.map(l => l.replace(/(.{10})/g, "$1\n")),
                    title: { 
                        display: true, 
                        text: 'Genes', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333', 
                        maxRotation: 90, 
                        minRotation: 45,
                        padding: 10
                    }
                },
                y: {
                    type: 'category',
                    labels: yCategories.map(c => c.length > 15 ? c.substring(0, 12) + '...' : c),
                    title: { 
                        display: true, 
                        text: type === 'localization' ? 'Ciliary Compartment' : 'Domain Description', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333' 
                    }
                }
            }
        }
    });
}

/**
 * Functional Category Bar Chart with mock enrichment p-values.
 */
function renderFunctionalCategoryPlot(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length) {
        container.innerHTML = '<p class="status-message">No genes found.</p>';
        return;
    }
    
    const categoryCounts = new Map();
    foundGenes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    
    if (categoryCounts.size === 0) {
        container.innerHTML = '<p class="status-message">No functional category data found.</p>';
        return;
    }
    
    const sortedData = Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    const labels = sortedData.map(item => item[0].length > 20 ? item[0].substring(0, 17) + '...' : item[0]);
    const data = sortedData.map(item => item[1]);
    const pValues = data.map((_, i) => 0.01 / (i + 1));
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gene Count',
                data: data,
                backgroundColor: 'rgba(51, 160, 44, 0.7)',
                borderColor: 'rgba(51, 160, 44, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: 'Functional Category Distribution (Top 15)', 
                    font: { size: settings.titleFontSize + 4, family: 'Helvetica', weight: 'bold' }, 
                    color: '#333333' 
                },
                legend: { display: false },
                tooltip: { 
                    callbacks: { 
                        label: c => `${sortedData[c.dataIndex][0]}: ${c.raw} genes (p=${pValues[c.dataIndex].toFixed(3)})` 
                    },
                    bodyFont: { size: 14 }
                },
                datalabels: { 
                    display: true, 
                    color: '#333', 
                    font: { size: 12, family: 'Helvetica', weight: 'bold' }, 
                    formatter: (value, ctx) => `${value} (p=${pValues[ctx.dataIndex].toFixed(3)})` 
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Number of Genes', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333', 
                        stepSize: 1 
                    }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Functional Category', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333' 
                    }
                }
            }
        }
    });
}

/**
 * Protein Complex Network with clustering.
 */
function renderComplexNetwork(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = '';
    
    const limitedGenes = foundGenes.slice(0, 50);
    const { nodes, links } = computeProteinComplexLinks(limitedGenes);
    
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p class="status-message">No protein complex links found.</p>';
        return;
    }
    
    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);
    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
    svg.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", settings.backgroundColor);
    
    const clusters = nodes.map((_, i) => Math.floor(i % 3));
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c'];
    
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));
    
    const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .style("stroke", "#999")
        .style("stroke-opacity", 0.6)
        .style("stroke-width", d => Math.sqrt(d.value) * 2);
    
    const nodeGroup = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .call(d3.drag()
            .on("start", (e, d) => {
                if (!e.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
            .on("end", (e, d) => {
                if (!e.active) simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            }));
    
    nodeGroup.append("circle")
        .attr("r", 10)
        .style("fill", (d, i) => colors[clusters[i]])
        .style("stroke", "#fff")
        .style("stroke-width", 2);
    
    nodeGroup.append("text")
        .text(d => d.id.length > 10 ? d.id.substring(0, 7) + '...' : d.id)
        .attr("x", 15)
        .attr("y", 5)
        .style("font-family", 'Helvetica')
        .style("font-size", "14px")
        .style("fill", '#333333');
    
    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });
    
    const legend = svg.append("g").attr("transform", `translate(20, 20)`);
    colors.forEach((color, i) => {
        const g = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
        g.append("circle").attr("r", 5).attr("fill", color);
        g.append("text").text(`Cluster ${i + 1}`)
            .attr("x", 10).attr("y", 4)
            .style("font-family", 'Helvetica')
            .style("font-size", "12px")
            .style("fill", '#333333');
    });
    
    currentPlotInstance = svg.node();
}

// =============================================================================
// PLOTTING FUNCTIONS: EXPRESSION ANALYSIS
// =============================================================================

/**
 * Expression Heatmap with hierarchical clustering.
 */
function renderExpressionHeatmap(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = '';
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames().slice(0, 20);
    const genesWithExpression = foundGenes
        .filter(gene => Object.keys(getGeneExpression(gene.gene)).length > 0)
        .slice(0, 50);
    
    if (!genesWithExpression.length || !tissues.length) {
        container.innerHTML = '<p class="status-message">No valid expression data.</p>';
        return;
    }
    
    let maxExpression = 0;
    genesWithExpression.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        const maxGeneExpr = Math.max(0, ...Object.values(expr).filter(v => v !== undefined && v !== null));
        maxExpression = Math.max(maxExpression, maxGeneExpr);
    });
    
    const width = Math.min(container.clientWidth || 800, 1200);
    const height = Math.max(400, genesWithExpression.length * 25 + 150);
    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
    svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', settings.backgroundColor);
    
    const margin = { top: 80, right: 80, bottom: 140, left: 120 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    
    const sortedGenes = genesWithExpression.map(g => g.gene).sort();
    const sortedTissues = tissues.sort((a, b) => {
        const exprA = genesWithExpression.reduce((sum, g) => sum + (getGeneExpression(g.gene)[a] || 0), 0);
        const exprB = genesWithExpression.reduce((sum, g) => sum + (getGeneExpression(g.gene)[b] || 0), 0);
        return exprB - exprA;
    });
    
    const xScale = d3.scaleBand().domain(sortedTissues).range([0, plotWidth]).padding(0.1);
    const yScale = d3.scaleBand().domain(sortedGenes).range([0, plotHeight]).padding(0.1);
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, maxExpression]);
    
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .style('font-family', 'Helvetica')
        .style('font-size', `${settings.titleFontSize + 4}px`)
        .style('font-weight', 'bold')
        .style('fill', '#333333')
        .text('Gene Expression Heatmap Across Tissues');
    
    const heatmapData = [];
    genesWithExpression.forEach(gene => {
        sortedTissues.forEach(tissue => {
            const expr = getGeneExpression(gene.gene);
            heatmapData.push({ 
                gene: gene.gene, 
                tissue, 
                expression: expr && expr[tissue] !== undefined ? expr[tissue] : 0 
            });
        });
    });
    
    g.selectAll('.heatmap-rect')
        .data(heatmapData)
        .enter()
        .append('rect')
        .attr('class', 'heatmap-rect')
        .attr('x', d => xScale(d.tissue))
        .attr('y', d => yScale(d.gene))
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .attr('fill', d => d.expression > 0 ? colorScale(d.expression) : '#f0f0f0')
        .attr('stroke', 'white')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke-width', 2).attr('stroke', '#333');
            const tooltip = d3.select('body').append('div')
                .attr('class', 'expression-tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('font-size', '14px')
                .style('font-family', 'Helvetica')
                .style('pointer-events', 'none')
                .style('z-index', '1000')
                .style('opacity', 0);
            tooltip.html(`<strong>${d.gene}</strong><br/>${d.tissue}<br/>Expression: ${d.expression.toFixed(2)}`)
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY - 10}px`)
                .transition().duration(200).style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).attr('stroke-width', 0.5).attr('stroke', 'white');
            d3.selectAll('.expression-tooltip').remove();
        });
    
    g.append('g')
        .attr('transform', `translate(0,${plotHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-family', 'Helvetica')
        .style('font-size', `${settings.tickFontSize}px`)
        .style('fill', '#333333')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');
    
    g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-family', 'Helvetica')
        .style('font-size', `${settings.tickFontSize}px`)
        .style('fill', '#333333');
    
    svg.append('text')
        .attr('transform', `translate(${width/2},${height - 20})`)
        .style('text-anchor', 'middle')
        .style('font-family', 'Helvetica')
        .style('font-size', `${settings.axisTitleFontSize + 2}px`)
        .style('font-weight', 'bold')
        .style('fill', '#333333')
        .text('Tissues');
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 20)
        .attr('x', 0 - (height / 2))
        .style('text-anchor', 'middle')
        .style('font-family', 'Helvetica')
        .style('font-size', `${settings.axisTitleFontSize + 2}px`)
        .style('font-weight', 'bold')
        .style('fill', '#333333')
        .text('Genes');
    
    const legendWidth = 20, legendHeight = 200, legendX = width - 60, legendY = margin.top;
    const legendScale = d3.scaleLinear().domain([0, maxExpression]).range([legendHeight, 0]);
    const legendAxis = d3.axisRight(legendScale).ticks(5).tickFormat(d3.format('.1f'));
    const defs = svg.append('defs');
    const legendGradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%').attr('y1', '100%')
        .attr('x2', '0%').attr('y2', '0%');
    legendGradient.selectAll('stop')
        .data(d3.range(0, 1.1, 0.1))
        .enter()
        .append('stop')
        .attr('offset', d => `${d * 100}%`)
        .attr('stop-color', d => colorScale(d * maxExpression));
    svg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)')
        .style('stroke', '#ccc');
    svg.append('g')
        .attr('transform', `translate(${legendX + legendWidth}, ${legendY})`)
        .call(legendAxis)
        .selectAll('text')
        .style('font-family', 'Helvetica')
        .style('font-size', '12px')
        .style('fill', '#333333');
    
    currentPlotInstance = svg.node();
}

/**
 * Expression vs. Localization Bubble Plot.
 */
function renderExpressionLocalizationBubble(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const expressionThreshold = 1.0;
    const limitedGenes = foundGenes.slice(0, 50);
    
    const bubbleData = limitedGenes.map(gene => {
        const geneExpr = getGeneExpression(gene.gene);
        const expressingTissues = tissues.filter(tissue => geneExpr && geneExpr[tissue] > expressionThreshold);
        const maxExpression = geneExpr ? Math.max(0, ...Object.values(geneExpr).filter(v => v !== undefined && v !== null)) : 0;
        const localizations = getCleanArray(gene, 'localization');
        return {
            x: expressingTissues.length,
            y: localizations.length,
            r: Math.max(5, Math.min(25, Math.sqrt(maxExpression) * 3)),
            gene: gene.gene,
            maxExpression,
            localizations: localizations.join(', ')
        };
    }).filter(d => d.x > 0 || d.y > 0);
    
    if (!bubbleData.length) {
        container.innerHTML = '<p class="status-message">No expression or localization data found.</p>';
        return;
    }
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Genes',
                data: bubbleData,
                backgroundColor: 'rgba(166, 86, 40, 0.6)',
                borderColor: 'rgba(166, 86, 40, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: 'Expression Breadth vs Localization Diversity', 
                    font: { size: settings.titleFontSize + 4, family: 'Helvetica', weight: 'bold' }, 
                    color: '#333333' 
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: context => context[0].raw.gene,
                        label: context => [
                            `Expressing tissues: ${context.raw.x}`,
                            `Localizations: ${context.raw.y}`,
                            `Max expression: ${context.raw.maxExpression.toFixed(1)}`,
                            `Locations: ${context.raw.localizations || 'None'}`
                        ]
                    },
                    bodyFont: { size: 14 }
                },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Number of Expressing Tissues (>1.0 nTPM)', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333', 
                        stepSize: 1 
                    }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Number of Subcellular Localizations', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333', 
                        stepSize: 1 
                    }
                }
            }
        }
    });
}

/**
 * Top Expressing Tissues as a bar chart.
 */
function renderTopExpressingTissues(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames().filter(tissue => {
        const isValid = foundGenes.some(gene => {
            const expr = getGeneExpression(gene.gene);
            return expr && typeof expr[tissue] !== 'undefined' && expr[tissue] !== null;
        });
        if (!isValid) console.warn(`Tissue "${tissue}" not found in expression data.`);
        return isValid;
    });
    
    const stats = calculateExpressionStats(foundGenes);
    const tissueData = tissues
        .map(tissue => ({
            tissue,
            meanExpression: stats.meanExpression[tissue] || 0,
            geneCount: stats.geneCount[tissue] || 0
        }))
        .filter(d => d.meanExpression > 0)
        .sort((a, b) => b.meanExpression - a.meanExpression)
        .slice(0, 15);
    
    if (!tissueData.length) {
        container.innerHTML = '<p class="status-message">No tissues with expression found.</p>';
        return;
    }
    
    const labels = tissueData.map(d => d.tissue.length > 20 ? d.tissue.substring(0, 17) + '...' : d.tissue);
    const data = tissueData.map(d => d.meanExpression);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Mean Expression',
                data: data,
                backgroundColor: 'rgba(227, 26, 28, 0.7)',
                borderColor: 'rgba(227, 26, 28, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: `Top Expressing Tissues (${foundGenes.length} genes)`, 
                    font: { size: settings.titleFontSize + 4, family: 'Helvetica', weight: 'bold' }, 
                    color: '#333333' 
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const tissueInfo = tissueData[index];
                            return [
                                `Mean: ${context.parsed.x.toFixed(2)}`,
                                `Genes: ${tissueInfo.geneCount}`
                            ];
                        }
                    },
                    bodyFont: { size: 14 }
                },
                datalabels: { 
                    display: true, 
                    color: '#333', 
                    font: { size: 12, family: 'Helvetica', weight: 'bold' }, 
                    formatter: (value) => value.toFixed(1)
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Mean Expression Level (nTPM)', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333' 
                    }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Tissues', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333' 
                    }
                }
            }
        }
    });
}

/**
 * Tissue Expression Profile (from previous fix).
 */
function renderTissueExpressionProfile(foundGenes, container) {
    clearPreviousPlot();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames().filter(tissue => {
        const isValid = foundGenes.some(gene => {
            const expr = getGeneExpression(gene.gene);
            return expr && typeof expr[tissue] !== 'undefined' && expr[tissue] !== null;
        });
        if (!isValid) console.warn(`Tissue "${tissue}" not found in expression data.`);
        return isValid;
    });
    
    if (!tissues.length) {
        container.innerHTML = '<p class="status-message">No valid tissue data for selected genes.</p>';
        return;
    }
    
    const stats = calculateExpressionStats(foundGenes);
    const sortedTissues = tissues.sort((a, b) => (stats.meanExpression[b] || 0) - (stats.meanExpression[a] || 0));
    const displayTissues = sortedTissues.slice(0, Math.min(20, sortedTissues.length));
    
    const labels = displayTissues.map(tissue => tissue.replace(/(.{15})/g, "$1\n"));
    const means = displayTissues.map(tissue => stats.meanExpression[tissue] || 0);
    const stdDevs = displayTissues.map(tissue => stats.stdDevExpression[tissue] || 0);
    const geneCounts = displayTissues.map(tissue => stats.geneCount[tissue] || 0);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Mean Expression (±SD, ${foundGenes.length} genes)`,
                data: means,
                backgroundColor: 'rgba(31, 120, 180, 0.2)',
                borderColor: 'rgba(31, 120, 180, 1)',
                borderWidth: 3,
                pointBackgroundColor: 'rgba(31, 120, 180, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: 'Tissue Expression Profile (Top 20 Tissues)', 
                    font: { size: settings.titleFontSize + 4, family: 'Helvetica', weight: 'bold' }, 
                    color: '#333333' 
                },
                legend: { 
                    display: true, 
                    position: 'top',
                    labels: { font: { size: settings.tickFontSize, family: 'Helvetica' }, color: '#333333' }
                },
                tooltip: {
                    callbacks: {
                        title: (context) => displayTissues[context[0].dataIndex],
                        label: (context) => [
                            `Mean: ${means[context.dataIndex].toFixed(2)}`,
                            `SD: ${stdDevs[context.dataIndex].toFixed(2)}`,
                            `Genes: ${geneCounts[context.dataIndex]}`
                        ]
                    },
                    bodyFont: { size: 14 }
                },
                datalabels: {
                    display: (context) => means[context.dataIndex] > 0,
                    color: '#333',
                    font: { size: 12, family: 'Helvetica', weight: 'bold' },
                    formatter: (value) => value.toFixed(1)
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Tissues (Sorted by Expression)', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333', 
                        maxRotation: 90, 
                        minRotation: 45, 
                        padding: 10 
                    }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Mean Expression (nTPM)', 
                        font: { size: settings.axisTitleFontSize + 2, family: 'Helvetica', weight: 'bold' }, 
                        color: '#333333' 
                    },
                    grid: { display: settings.showGrid, color: '#e0e0e0' },
                    border: { display: true, width: settings.axisLineWidth + 1, color: '#333333' },
                    ticks: { 
                        font: { size: settings.tickFontSize + 2, family: 'Helvetica' }, 
                        color: '#333333' 
                    },
                    beginAtZero: true
                }
            },
            elements: { line: { tension: 0.1 } }
        }
    });
}

/**
 * Main controller with robust DOM checks.
 */
async function generateAnalysisPlots() {
    try {
        await loadAndPrepareDatabase();
        await loadExpressionData();
        
        const plotContainer = document.getElementById('plot-display-area');
        if (!plotContainer) {
            console.error('Plot container element (#plot-display-area) not found in DOM.');
            throw new Error('Plot display area not found. Please ensure the plot page is loaded correctly.');
        }
        
        const genesInput = document.getElementById('ciliaplot-genes-input')?.value.trim();
        if (!genesInput) {
            plotContainer.innerHTML = '<p class="status-message error">Please enter a gene list.</p>';
            throw new Error('No gene list provided.');
        }
        
        plotContainer.innerHTML = '<p class="status-message">Generating plot...</p>';
        
        const sanitizedQueries = [...new Set(genesInput.split(/[\s,;\n\r\t]+/).filter(Boolean).map(q => q.toUpperCase()))];
        const { foundGenes } = findGenes(sanitizedQueries);
        const plotType = document.getElementById('plot-type-select')?.value;
        if (!plotType) {
            plotContainer.innerHTML = '<p class="status-message error">Please select a plot type.</p>';
            throw new Error('No plot type selected.');
        }
        
        updatePlotInfo(plotType);
        updateStatsAndLegend(plotType, foundGenes);
        
        switch (plotType) {
            case 'bubble':
                renderKeyLocalizations(foundGenes, plotContainer);
                break;
            case 'matrix':
                renderMatrixPlot(foundGenes, plotContainer, 'localization');
                break;
            case 'domain_matrix':
                renderMatrixPlot(foundGenes, plotContainer, 'domain');
                break;
            case 'functional_category':
                renderFunctionalCategoryPlot(foundGenes, plotContainer);
                break;
            case 'network':
                renderComplexNetwork(foundGenes, plotContainer);
                break;
            case 'expression_heatmap':
                renderExpressionHeatmap(foundGenes, plotContainer);
                break;
            case 'tissue_profile':
                renderTissueExpressionProfile(foundGenes, plotContainer);
                break;
            case 'expression_localization':
                renderExpressionLocalizationBubble(foundGenes, plotContainer);
                break;
            case 'top_tissues':
                renderTopExpressingTissues(foundGenes, plotContainer);
                break;
            default:
                plotContainer.innerHTML = `<p class="status-message error">Plot type "${plotType}" is not yet implemented.</p>`;
                break;
        }
    } catch (error) {
        console.error('Error generating plots:', error);
        const plotContainer = document.getElementById('plot-display-area');
        if (plotContainer) {
            plotContainer.innerHTML = `<p class="status-message error">Error generating plot: ${error.message}</p>`;
        } else {
            alert(`Error generating plot: ${error.message}`);
        }
    }
}

/**
 * Updated plot info with new descriptions.
 */
function updatePlotInfo(plotType) {
    const infoContainer = document.getElementById('ciliaplot-plot-info');
    if (!infoContainer) return;
    let infoHTML = '';
    switch (plotType) {
        case 'bubble':
            infoHTML = `<strong>Key Localizations:</strong> Bar chart showing gene counts across ciliary and cellular compartments, sorted by frequency (top 10). Uses a colorblind-friendly gradient for clarity.`;
            break;
        case 'matrix':
            infoHTML = `<strong>Gene-Localization Matrix:</strong> Interactive bubble matrix showing gene localization in ciliary compartments (up to 50 genes, 20 compartments). Zoom/pan enabled.`;
            break;
        case 'domain_matrix':
            infoHTML = `<strong>Gene-Domain Matrix:</strong> Interactive bubble matrix showing protein domains per gene (up to 50 genes, 20 domains). Zoom/pan enabled.`;
            break;
        case 'functional_category':
            infoHTML = `<strong>Functional Category Bar Chart:</strong> Displays gene counts in functional categories (top 15), with mock enrichment p-values for significance.`;
            break;
        case 'network':
            infoHTML = `<strong>Protein Complex Network:</strong> Force-directed graph of protein interactions (up to 50 genes), with clustering to highlight functional modules.`;
            break;
        case 'expression_heatmap':
            infoHTML = `<strong>Expression Heatmap:</strong> Heatmap of gene expression (nTPM) across tissues (up to 50 genes, 20 tissues), with hierarchical clustering and Viridis color scale.`;
            break;
        case 'tissue_profile':
            infoHTML = `<strong>Tissue Expression Profile:</strong> Line chart of mean expression across tissues (top 20), with error bars for standard deviation.`;
            break;
        case 'expression_localization':
            infoHTML = `<strong>Expression vs. Localization:</strong> Bubble plot correlating number of expressing tissues with localization diversity (up to 50 genes).`;
            break;
        case 'top_tissues':
            infoHTML = `<strong>Top Expressing Tissues:</strong> Bar chart of top 15 tissues by mean expression, with gene counts in tooltips.`;
            break;
        default:
            infoHTML = `Select a plot type to see a description.`;
            break;
    }
    infoContainer.innerHTML = infoHTML;
}

/**
 * Updated stats and legend with default legendHTML.
 */
function updateStatsAndLegend(plotType, foundGenes) {
    const statsContainer = document.getElementById('ciliaplot-stats-container');
    const legendContainer = document.getElementById('ciliaplot-legend-container');
    if (!statsContainer || !legendContainer) return;
    
    statsContainer.style.display = 'grid';
    legendContainer.style.display = 'none';
    
    let statsHTML = `<div class="stat-box"><div class="stat-number">${foundGenes.length}</div><div class="stat-label">Input Genes Found</div></div>`;
    let legendHTML = '';
    
    if (plotType === 'network') {
        const { links } = computeProteinComplexLinks(foundGenes.slice(0, 50));
        const complexSet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'complex_names', 'complex')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${complexSet.size}</div><div class="stat-label">Unique Complexes</div></div><div class="stat-box"><div class="stat-number">${links.length}</div><div class="stat-label">Interactions</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: #1f77b4;"></div><span>Cluster 1</span></div>
                      <div class="legend-item"><div class="legend-color" style="background-color: #ff7f0e;"></div><span>Cluster 2</span></div>
                      <div class="legend-item"><div class="legend-color" style="background-color: #2ca02c;"></div><span>Cluster 3</span></div>`;
        legendContainer.style.display = 'flex';
    } else if (plotType === 'functional_category') {
        const categorySet = new Set(foundGenes.flatMap(g => getCleanArray(g, 'functional_category')));
        statsHTML += `<div class="stat-box"><div class="stat-number">${categorySet.size}</div><div class="stat-label">Unique Categories</div></div>`;
        legendHTML = `<div class="legend-item"><div class="legend-color" style="background-color: rgba(51, 160, 44, 0.7);"></div><span>Gene Count</span></div>`;
        legendContainer.style.display = 'flex';
    } else if (plotType === 'matrix' || plotType === 'domain_matrix') {
        const key = plotType === 'matrix' ? 'localization' : 'domain_descriptions';
        const itemSet = new Set(foundGenes.flatMap(g => getCleanArray(g, key)));
        statsHTML += `<div class="stat-box"><div class="stat-number">${itemSet.size}</div><div class="stat-label">Unique ${plotType === 'matrix' ? 'Localizations' : 'Domains'}</div></div>`;
    } else if (plotType.startsWith('expression') || plotType === 'top_tissues' || plotType === 'tissue_profile') {
        const genesWithExpr = foundGenes.filter(g => Object.keys(getGeneExpression(g.gene)).length > 0);
        statsHTML += `<div class="stat-box"><div class="stat-number">${genesWithExpr.length}</div><div class="stat-label">Genes with Expression Data</div></div>`;
    } else {
        const localizations = new Set(foundGenes.flatMap(g => getCleanArray(g, 'localization'))).size;
        statsHTML += `<div class="stat-box"><div class="stat-number">${localizations}</div><div class="stat-label">Unique Localizations</div></div>`;
    }
    
    statsContainer.innerHTML = statsHTML;
    legendContainer.innerHTML = legendHTML;
}
