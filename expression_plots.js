// =============================================================================
// EXPRESSION_PLOTS.JS - Expression Analysis Module for CiliaHub
// =============================================================================
// This file contains all expression-related plotting functions
// Depends on: expressionData and tissueNames from script.js
// =============================================================================

/**
 * Get expression data for a specific gene
 * @param {string} geneName - Gene symbol
 * @returns {Object} Expression values by tissue
 */
function getGeneExpression(geneName) {
    return expressionData[geneName.toUpperCase()] || {};
}

/**
 * Get list of tissue names from expression data
 * @returns {Array} Array of tissue names
 */
function getTissueNames() {
    if (typeof tissueNames !== 'undefined' && tissueNames.length > 0) {
        return tissueNames;
    }
    
    // Fallback: extract from first gene in expressionData
    if (Object.keys(expressionData).length > 0) {
        const firstGene = Object.keys(expressionData)[0];
        return Object.keys(expressionData[firstGene]);
    }
    
    return [];
}

/**
 * Calculate expression statistics for a gene set
 * @param {Array} genes - Array of gene objects
 * @returns {Object} Expression statistics
 */
function calculateExpressionStats(genes) {
    const tissues = getTissueNames();
    const stats = {
        meanExpression: {},
        medianExpression: {},
        maxExpression: {},
        geneCount: {}
    };
    
    tissues.forEach(tissue => {
        const expressionValues = genes.map(gene => {
            const expr = getGeneExpression(gene.gene);
            return expr[tissue] || 0;
        }).filter(val => val > 0);
        
        if (expressionValues.length > 0) {
            stats.meanExpression[tissue] = expressionValues.reduce((a, b) => a + b, 0) / expressionValues.length;
            expressionValues.sort((a, b) => a - b);
            stats.medianExpression[tissue] = expressionValues[Math.floor(expressionValues.length / 2)];
            stats.maxExpression[tissue] = Math.max(...expressionValues);
            stats.geneCount[tissue] = expressionValues.length;
        } else {
            stats.meanExpression[tissue] = 0;
            stats.medianExpression[tissue] = 0;
            stats.maxExpression[tissue] = 0;
            stats.geneCount[tissue] = 0;
        }
    });
    
    return stats;
}

// =============================================================================
// EXPRESSION-BASED PLOTTING FUNCTIONS
// =============================================================================

/**
 * Render expression heatmap for selected genes across tissues
 */
function renderExpressionHeatmap(foundGenes, container) {
    if (currentPlotInstance) currentPlotInstance.destroy();
    const settings = getPlotSettings();
    container.innerHTML = '';
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available for selected genes.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    if (tissues.length === 0) {
        container.innerHTML = '<p class="status-message">No tissue data found in expression dataset.</p>';
        return;
    }
    
    // Filter genes that have expression data
    const genesWithExpression = foundGenes.filter(gene => {
        const expr = getGeneExpression(gene.gene);
        return Object.keys(expr).length > 0;
    });
    
    if (genesWithExpression.length === 0) {
        container.innerHTML = '<p class="status-message">None of the selected genes have expression data.</p>';
        return;
    }
    
    // Calculate maximum expression for color scaling
    let maxExpression = 0;
    genesWithExpression.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        const maxGeneExpr = Math.max(...Object.values(expr));
        maxExpression = Math.max(maxExpression, maxGeneExpr);
    });
    
    const width = Math.min(container.clientWidth || 800, 1200);
    const height = Math.max(400, genesWithExpression.length * 25 + 150);
    
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Background
    svg.append('rect')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', settings.backgroundColor);
    
    const margin = {top: 80, right: 40, bottom: 140, left: 120};
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    
    const xScale = d3.scaleBand()
        .domain(tissues)
        .range([0, plotWidth])
        .padding(0.1);
    
    const yScale = d3.scaleBand()
        .domain(genesWithExpression.map(g => g.gene))
        .range([0, plotHeight])
        .padding(0.1);
    
    const colorScale = d3.scaleSequential()
        .interpolator(d3.interpolateViridis)
        .domain([0, maxExpression]);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.titleFontSize}px`)
        .style('font-weight', 'bold')
        .style('fill', settings.fontColor)
        .text('Gene Expression Heatmap Across Tissues');
    
    // Prepare heatmap data
    const heatmapData = [];
    genesWithExpression.forEach(gene => {
        const expr = getGeneExpression(gene.gene);
        tissues.forEach(tissue => {
            const expression = expr[tissue] || 0;
            heatmapData.push({
                gene: gene.gene,
                tissue: tissue,
                expression: expression
            });
        });
    });
    
    // Add heatmap rectangles
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
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('z-index', '1000')
                .style('opacity', 0);
            
            tooltip.html(`<strong>${d.gene}</strong><br/>
                         ${d.tissue}<br/>
                         Expression: ${d.expression.toFixed(2)}`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .transition()
                .duration(200)
                .style('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).attr('stroke-width', 0.5).attr('stroke', 'white');
            d3.selectAll('.expression-tooltip').remove();
        });
    
    // Add X axis
    g.append('g')
        .attr('transform', `translate(0,${plotHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${Math.max(10, settings.tickFontSize - 2)}px`)
        .style('fill', settings.fontColor)
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');
    
    // Add Y axis
    g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.tickFontSize}px`)
        .style('fill', settings.fontColor);
    
    // Add X axis label
    svg.append('text')
        .attr('transform', `translate(${width/2},${height - 20})`)
        .style('text-anchor', 'middle')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.axisTitleFontSize}px`)
        .style('font-weight', 'bold')
        .style('fill', settings.fontColor)
        .text('Tissues');
    
    // Add Y axis label
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 20)
        .attr('x', 0 - (height / 2))
        .style('text-anchor', 'middle')
        .style('font-family', settings.fontFamily)
        .style('font-size', `${settings.axisTitleFontSize}px`)
        .style('font-weight', 'bold')
        .style('fill', settings.fontColor)
        .text('Genes');
    
    // Add color scale legend
    const legendWidth = 20;
    const legendHeight = 200;
    const legendX = width - 60;
    const legendY = margin.top;
    
    const legendScale = d3.scaleLinear()
        .domain([0, maxExpression])
        .range([legendHeight, 0]);
    
    const legendAxis = d3.axisRight(legendScale)
        .ticks(5)
        .tickFormat(d3.format('.1f'));
    
    const defs = svg.append('defs');
    const legendGradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%').attr('y1', '100%')
        .attr('x2', '0%').attr('y2', '0%');
    
    legendGradient.selectAll('stop')
        .data(d3.range(0, 1.1, 0.1))
        .enter().append('stop')
        .attr('offset', d => (d * 100) + '%')
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
        .style('font-family', settings.fontFamily)
        .style('font-size', '10px')
        .style('fill', settings.fontColor);
    
    currentPlotInstance = svg.node();
}

/**
 * Render tissue-specific expression radar chart
 */
function renderTissueExpressionProfile(foundGenes, container) {
    if (currentPlotInstance) currentPlotInstance.destroy();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const stats = calculateExpressionStats(foundGenes);
    
    // Prepare data for radar chart
    const labels = tissues.map(tissue => tissue.length > 15 ? tissue.substring(0, 12) + '...' : tissue);
    const data = tissues.map(tissue => stats.meanExpression[tissue]);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: `Mean Expression (${foundGenes.length} genes)`,
                data: data,
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(52, 152, 219, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Tissue Expression Profile',
                    font: { size: settings.titleFontSize, family: settings.fontFamily },
                    color: settings.fontColor
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: { size: settings.tickFontSize - 2, family: settings.fontFamily },
                        color: settings.fontColor
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const tissueIndex = context.dataIndex;
                            const tissueName = tissues[tissueIndex];
                            const geneCount = stats.geneCount[tissueName];
                            return `${context.dataset.label}: ${context.parsed.r.toFixed(2)} (${geneCount} genes)`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: Math.max(10, settings.tickFontSize - 4), family: settings.fontFamily },
                        color: settings.fontColor,
                        backdropColor: 'rgba(255, 255, 255, 0.8)'
                    },
                    pointLabels: {
                        font: { size: Math.max(11, settings.tickFontSize - 3), family: settings.fontFamily },
                        color: settings.fontColor
                    },
                    grid: {
                        display: settings.showGrid,
                        color: settings.gridColor
                    },
                    angleLines: {
                        display: true,
                        color: settings.gridColor
                    }
                }
            }
        }
    });
}

/**
 * Render expression vs localization bubble plot
 */
function renderExpressionLocalizationBubble(foundGenes, container) {
    if (currentPlotInstance) currentPlotInstance.destroy();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const expressionThreshold = 1.0;
    
    // Calculate bubble data
    const bubbleData = foundGenes.map(gene => {
        const geneExpr = getGeneExpression(gene.gene);
        const expressingTissues = tissues.filter(tissue => (geneExpr[tissue] || 0) > expressionThreshold);
        const maxExpression = Math.max(...Object.values(geneExpr));
        const localizations = getCleanArray(gene, 'localization');
        
        return {
            x: expressingTissues.length, // Expression breadth
            y: localizations.length, // Localization diversity
            r: Math.max(5, Math.min(25, Math.sqrt(maxExpression) * 3)), // Size based on max expression
            gene: gene.gene,
            maxExpression: maxExpression,
            localizations: localizations.join(', ')
        };
    }).filter(d => d.x > 0 || d.y > 0); // Only include genes with some data
    
    if (bubbleData.length === 0) {
        container.innerHTML = '<p class="status-message">No expression or localization data found for selected genes.</p>';
        return;
    }
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Genes',
                data: bubbleData,
                backgroundColor: 'rgba(155, 89, 182, 0.6)',
                borderColor: 'rgba(155, 89, 182, 1)',
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
                    font: { size: settings.titleFontSize, family: settings.fontFamily },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return context[0].raw.gene;
                        },
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `Expressing tissues: ${point.x}`,
                                `Localizations: ${point.y}`,
                                `Max expression: ${point.maxExpression.toFixed(1)}`,
                                `Locations: ${point.localizations || 'None'}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Number of Expressing Tissues (>1.0)',
                        font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        stepSize: 1
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Subcellular Localizations',
                        font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor,
                        stepSize: 1
                    }
                }
            }
        }
    });
}

/**
 * Render top expressing tissues bar chart
 */
function renderTopExpressingTissues(foundGenes, container) {
    if (currentPlotInstance) currentPlotInstance.destroy();
    const settings = getPlotSettings();
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    if (!foundGenes.length || Object.keys(expressionData).length === 0) {
        container.innerHTML = '<p class="status-message">No expression data available.</p>';
        return;
    }
    
    const tissues = getTissueNames();
    const stats = calculateExpressionStats(foundGenes);
    
    // Sort tissues by mean expression
    const tissueData = tissues.map(tissue => ({
        tissue: tissue,
        meanExpression: stats.meanExpression[tissue],
        geneCount: stats.geneCount[tissue]
    })).filter(d => d.meanExpression > 0)
      .sort((a, b) => b.meanExpression - a.meanExpression)
      .slice(0, 20); // Top 20 tissues
    
    if (tissueData.length === 0) {
        container.innerHTML = '<p class="status-message">No tissues with expression found for selected genes.</p>';
        return;
    }
    
    // Prepare data
    const labels = tissueData.map(d => d.tissue.length > 20 ? d.tissue.substring(0, 17) + '...' : d.tissue);
    const data = tissueData.map(d => d.meanExpression);
    
    currentPlotInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Mean Expression',
                data: data,
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: 'rgba(46, 204, 113, 1)',
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
                    font: { size: settings.titleFontSize, family: settings.fontFamily },
                    color: settings.fontColor
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const tissueInfo = tissueData[index];
                            return `Mean Expression: ${context.parsed.x.toFixed(2)} (${tissueInfo.geneCount} genes)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Mean Expression Level',
                        font: { size: settings.axisTitleFontSize, family: settings.fontFamily, weight: 'bold' },
                        color: settings.fontColor
                    },
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: settings.tickFontSize, family: settings.fontFamily },
                        color: settings.fontColor
                    }
                },
                y: {
                    grid: { display: settings.showGrid, color: settings.gridColor },
                    border: { display: true, width: settings.axisLineWidth, color: settings.axisLineColor },
                    ticks: {
                        font: { size: Math.max(10, settings.tickFontSize - 2), family: settings.fontFamily },
                        color: settings.fontColor
                    }
                }
            }
        }
    });
}
