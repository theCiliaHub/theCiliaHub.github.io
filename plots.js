// Expose necessary functions
window.renderComplexNetwork = function(genes, container, custom) {
    clearAllPlots(container.id);
    
    const { nodes, links } = computeProteinComplexLinks(genes);
    if (!nodes.length || !links.length) {
        container.innerHTML = '<p style="text-align: center; padding: 50px;">No protein complex links found among the provided genes.</p>';
        return;
    }
    
    const containerRect = container.getBoundingClientRect();
    const width = custom.figureWidth || (containerRect.width - 20);
    const height = custom.figureHeight || (containerRect.height - 20);
    const margin = 20;
    
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("border", custom.border ? `1px solid ${custom.borderColor}` : "none");
    
    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .style("font-size", custom.titleFontSize + "px")
        .style("font-family", custom.fontFamily)
        .style("font-weight", "bold")
        .style("fill", custom.fontColor)
        .text(custom.title || "Protein Complex Network");
    
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(80).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(25))
        .force("x", d3.forceX(width / 2).strength(0.1))
        .force("y", d3.forceY(height / 2).strength(0.1));
    
    const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .style("stroke", "#999")
        .style("stroke-opacity", 0.8)
        .style("stroke-width", 2);
    
    const nodeGroup = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .call(d3.drag()
            .on("start", (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event, d) => {
                d.fx = Math.max(25, Math.min(width - 25, event.x));
                d.fy = Math.max(35, Math.min(height - 25, event.y));
            })
            .on("end", (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }));
    
    nodeGroup.append("circle")
        .attr("r", 12)
        .style("fill", "#3498db")
        .style("stroke", "#2980b9")
        .style("stroke-width", 2);
    
    nodeGroup.append("text")
        .text(d => d.id)
        .attr("x", 15)
        .attr("y", 5)
        .style("font-family", custom.fontFamily || "Arial")
        .style("font-size", "11px")
        .style("fill", custom.fontColor || "#333");
    
    simulation.on("tick", () => {
        // Keep nodes within bounds
        nodes.forEach(d => {
            d.x = Math.max(25, Math.min(width - 25, d.x));
            d.y = Math.max(35, Math.min(height - 25, d.y));
        });
        
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        
        nodeGroup
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });
    
    currentPlotInstance = { destroy: () => svg.remove() };
};

window.renderOrganelleUMAP = function(genes, container, custom) {
    clearAllPlots(container.id);
    container.innerHTML = `<canvas style="max-width: 100%; max-height: 100%;"></canvas>`;
    const ctx = container.querySelector('canvas').getContext('2d');
    
    const backgroundDatasets = Object.entries(precomputedUMAP).map(([name, data], i) => ({
        label: name,
        data: data,
        backgroundColor: d3.schemeCategory10[i % 10] + '77',
        pointRadius: 3,
        pointHoverRadius: 5
    }));
    
    const userGeneData = [];
    genes.forEach((gene, i) => {
        const localizations = getCleanArray(gene, 'localization');
        for (const organelle in precomputedUMAP) {
            if (localizations.some(loc => 
                organelle.toLowerCase().includes(loc.toLowerCase()) || 
                loc.toLowerCase().includes(organelle.toLowerCase())
            )) {
                const basePoint = precomputedUMAP[organelle][i % precomputedUMAP[organelle].length];
                userGeneData.push({
                    ...basePoint,
                    gene: gene.gene,
                    organelle: organelle
                });
                return;
            }
        }
    });
    
    if (userGeneData.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 50px;">No genes mapped to the UMAP projection.</p>';
        return;
    }
    
    const userDataset = {
        label: 'Your Genes',
        data: userGeneData,
        backgroundColor: '#e74c3c',
        borderColor: '#c0392b',
        pointRadius: 8,
        pointHoverRadius: 10,
        borderWidth: 2
    };
    
    currentPlotInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [...backgroundDatasets, userDataset]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: custom.title || "Organellar UMAP Projection",
                    font: { 
                        size: custom.titleFontSize || 16,
                        family: custom.fontFamily,
                        color: custom.fontColor
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: { 
                        usePointStyle: true,
                        font: {
                            family: custom.fontFamily,
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Your Genes') {
                                const point = context.parsed;
                                const dataPoint = userGeneData[context.dataIndex];
                                return `${dataPoint.gene} (${dataPoint.organelle})`;
                            }
                            return context.dataset.label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'UMAP 1',
                        font: {
                            family: custom.fontFamily,
                            size: custom.axisTitleFont.size,
                            color: custom.axisTitleFont.color
                        }
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'UMAP 2',
                        font: {
                            family: custom.fontFamily,
                            size: custom.axisTitleFont.size,
                            color: custom.axisTitleFont.color
                        }
                    }
                }
            }
        }
    });
};

window.renderScreenSummaryHeatmap = function(genes, custom = {}) {
    clearAllPlots('plot-display-area');
    
    const numberScreens = { 'Kim 2016': 'Kim2016','Wheway 2015': 'Wheway2015','Roosing 2015': 'Roosing2015','Basu 2023': 'Basu2023' };
    const signalingScreens = { 'Breslow 2018': 'Breslow2018' };
    const numberScreenOrder = Object.keys(numberScreens);
    const signalingScreenOrder = Object.keys(signalingScreens);

    const numberCategoryMap = {
        "Decreased cilia numbers": { value: 1, color: '#0571b0' },
        "Increased cilia numbers": { value: 2, color: '#ca0020' },
        "Causes Supernumerary Cilia": { value: 3, color: '#fdae61' },
        "No effect": { value: 4, color: '#fee090' },
        "Not in Screen": { value: 5, color: '#bdbdbd' },
        "Not Reported": { value: 6, color: '#636363' }
    };
    const signalingCategoryMap = {
        "Decreased Signaling (Positive Regulator)": { value: 1, color: '#2166ac' },
        "Increased Signaling (Negative Regulator)": { value: 2, color: '#d73027' },
        "No Significant Effect": { value: 3, color: '#fdae61' },
        "Not in Screen": { value: 4, color: '#bdbdbd' },
        "Not Reported": { value: 5, color: '#636363' }
    };

    const geneLabels = genes.map(g => g.gene);
    const zDataNumber = [], textDataNumber = [], zDataSignaling = [], textDataSignaling = [];

    genes.forEach(gene => {
        const numberRowValues = [], numberRowText = [], signalingRowValues = [], signalingRowText = [];

        numberScreenOrder.forEach(screenName => {
            const screenKey = numberScreens[screenName];
            let resultText = "Not in Screen";
            if (gene.screens_summary) {
                const screenResult = gene.screens_summary.find(s => s.source === screenKey);
                if (screenResult) resultText = screenResult.result;
            }
            const mapping = numberCategoryMap[resultText] || numberCategoryMap["Not in Screen"];
            numberRowValues.push(mapping.value);
            numberRowText.push(resultText);
        });

        signalingScreenOrder.forEach(screenName => {
            const screenKey = signalingScreens[screenName];
            let resultText = "Not in Screen";
            if (gene.screens_summary) {
                const screenResult = gene.screens_summary.find(s => s.source === screenKey);
                if (screenResult) resultText = screenResult.result;
            }
            const mapping = signalingCategoryMap[resultText] || signalingCategoryMap["Not in Screen"];
            signalingRowValues.push(mapping.value);
            signalingRowText.push(resultText);
        });

        zDataNumber.push(numberRowValues);
        textDataNumber.push(numberRowText);
        zDataSignaling.push(signalingRowValues);
        textDataSignaling.push(signalingRowText);
    });

    const trace1 = {
        x: numberScreenOrder, y: geneLabels, z: zDataNumber, customdata: textDataNumber,
        type: 'heatmap',
        colorscale: [
            [0, numberCategoryMap["Decreased cilia numbers"].color],[0.16, numberCategoryMap["Decreased cilia numbers"].color],
            [0.17, numberCategoryMap["Increased cilia numbers"].color],[0.33, numberCategoryMap["Increased cilia numbers"].color],
            [0.34, numberCategoryMap["Causes Supernumerary Cilia"].color],[0.50, numberCategoryMap["Causes Supernumerary Cilia"].color],
            [0.51, numberCategoryMap["No effect"].color],[0.67, numberCategoryMap["No effect"].color],
            [0.68, numberCategoryMap["Not Reported"].color],[0.84, numberCategoryMap["Not Reported"].color],
            [0.85, numberCategoryMap["Not in Screen"].color],[1.0, numberCategoryMap["Not in Screen"].color]
        ],
        showscale: false,
        hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>',
        xgap: 1, ygap: 1
    };

    const trace2 = {
        x: signalingScreenOrder, y: geneLabels, z: zDataSignaling, customdata: textDataSignaling,
        type: 'heatmap',
        colorscale: [
            [0, signalingCategoryMap["Decreased Signaling (Positive Regulator)"].color], [0.25, signalingCategoryMap["Decreased Signaling (Positive Regulator)"].color],
            [0.26, signalingCategoryMap["Increased Signaling (Negative Regulator)"].color], [0.5, signalingCategoryMap["Increased Signaling (Negative Regulator)"].color],
            [0.51, signalingCategoryMap["No Significant Effect"].color], [0.75, signalingCategoryMap["No Significant Effect"].color],
            [0.76, signalingCategoryMap["Not Reported"].color], [0.85, signalingCategoryMap["Not Reported"].color],
            [0.86, signalingCategoryMap["Not in Screen"].color], [1.0, signalingCategoryMap["Not in Screen"].color]
        ],
        showscale: false,
        hovertemplate: '<b>Gene:</b> %{y}<br><b>Screen:</b> %{x}<br><b>Result:</b> %{customdata}<extra></extra>',
        xaxis: 'x2', yaxis: 'y1',
        xgap: 1, ygap: 1
    };

    const data = [trace1, trace2];

    const layout = {
        title: { text: custom.title || 'Summary of Functional Screen Results', font: { size: custom.titleFontSize, family: custom.fontFamily, color: custom.fontColor }},
        grid: { rows: 1, columns: 2, pattern: 'independent' },
        xaxis: { domain: [0, 0.78], tickangle: -45, automargin: true },
        xaxis2: { domain: [0.8, 1.0], tickangle: -45, automargin: true },
        yaxis: { automargin: true, tickfont: { size: 10 } },
        margin: { l: 120, r: 220, b: 150, t: 80 },
        width: custom.figureWidth, height: custom.figureHeight,
        annotations: []
    };

    // Legend logic
    const legend_x_pos = 1.02;
    const legend_spacing = 0.06;
    let current_y_pos = 1.0;

    // Legend 1: Cilia Number
    layout.annotations.push({ xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos + 0.05, xanchor: 'left', text: '<b>Cilia Number/Structure</b>', showarrow: false, font: {size: 13} });
    Object.keys(numberCategoryMap).forEach(key => {
        layout.annotations.push({
            xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos,
            xanchor: 'left', yanchor: 'middle', text: `█ ${key}`,
            font: { color: numberCategoryMap[key].color, size: 12 },
            showarrow: false
        });
        current_y_pos -= legend_spacing;
    });

    // Add a gap between legends
    current_y_pos -= 0.1;

    // Legend 2: Hedgehog Signaling
    layout.annotations.push({ xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos + 0.05, xanchor: 'left', text: '<b>Hedgehog Signaling</b>', showarrow: false, font: {size: 13} });
    Object.keys(signalingCategoryMap).forEach(key => {
        if (key !== "Not in Screen" && key !== "Not Reported") {
            layout.annotations.push({
                xref: 'paper', yref: 'paper', x: legend_x_pos, y: current_y_pos,
                xanchor: 'left', yanchor: 'middle', text: `█ ${key}`,
                font: { color: signalingCategoryMap[key].color, size: 12 },
                showarrow: false
            });
            current_y_pos -= legend_spacing;
        }
    });

    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
};

window.renderCiliopathyPlot = function(genes, custom) {
    const plotData = [];
    genes.forEach(gene => {
        const ciliopathies = getCleanArray(gene, 'ciliopathy');
        if (ciliopathies.length > 0) {
            plotData.push({
                x: ciliopathies, 
                y: Array(ciliopathies.length).fill(gene.gene),
                mode: 'markers', 
                type: 'scatter', 
                name: gene.gene,
                marker: { 
                    size: custom.bubbleSize || 15, 
                    color: '#ffd9d9',
                    line: { color: '#d62728', width: 1 }
                }, 
                hoverinfo: 'x+y'
            });
        }
    });
    
    const layout = {
        title: { 
            text: custom.title || 'Gene vs Ciliopathy Associations', 
            font: { size: custom.titleFontSize, family: custom.fontFamily, color: custom.fontColor } 
        },
        xaxis: { 
            title: { text: 'Ciliopathy', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false,
            tickfont: { size: custom.columnFontSize, family: custom.fontFamily, color: custom.fontColor }
        },
        yaxis: { 
            title: { text: 'Gene', font: custom.axisTitleFont }, 
            visible: custom.showY, 
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false,
            tickfont: { size: custom.rowFontSize, family: custom.fontFamily, color: custom.fontColor }
        },
        showlegend: false, 
        width: custom.figureWidth,
        height: custom.figureHeight,
        margin: { l: 120, r: 20, b: 100, t: 80 },
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
    };
    
    Plotly.newPlot('plot-display-area', plotData, layout, { responsive: true });
};

window.renderMultiCategoryPlot = function(genes, custom = {}) {
    clearAllPlots('plot-display-area');

    // Helper: capitalize first letter of words
    const capitalize = (s) => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : '';

    // Helper: safely extract array from gene object
    const getCleanArray = (gene, key) => {
        if (!key || !gene[key]) return [];
        return Array.isArray(gene[key]) ? gene[key] : [gene[key]];
    };

    const softColors = {
        localization: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd'],
        ciliopathy:   ['#fbb4ae','#b3cde3','#ccebc5','#decbe4','#fed9a6','#ffffcc','#e5d8bd','#fddaec','#f2f2f2'],
        screens:      ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9'],
        default:      ['#AEC6CF','#77DD77','#FDFD96','#FFB347','#FF6961','#CBAACB','#FFDAC1']
    };

    const categories = {
        'Subcellular Localization': { 
            key: 'localization', 
            data: new Set(), 
            color: softColors.localization,
            description: 'Gene localization within the cell'
        },
        'Complex Names': { 
            key: 'complex_names', 
            data: new Set(), 
            color: [softColors.default[1]],
            description: 'Protein complexes the gene is associated with'
        },
        'Protein Domains': { 
            key: 'domain_descriptions', 
            data: new Set(), 
            color: [softColors.default[2]],
            description: 'Functional protein domains'
        },
        'Ciliopathy': { 
            key: 'ciliopathy', 
            data: new Set(), 
            color: softColors.ciliopathy,
            description: 'Association with ciliopathy disorders'
        },
        'Ciliogenesis Screen': { 
            key: 'screens', 
            data: new Set(), 
            color: softColors.screens,
            description: 'Results from ciliogenesis functional screens'
        }
    };

    const plotPoints = [];
    
    // Create unique gene identifiers to handle duplicates
    const geneTracker = new Map();
    const processedGenes = [];
    
    genes.forEach((gene, index) => {
        const geneName = gene.gene;
        let uniqueGeneName = geneName;
        
        // If we've seen this gene name before, make it unique
        if (geneTracker.has(geneName)) {
            const count = geneTracker.get(geneName) + 1;
            geneTracker.set(geneName, count);
            uniqueGeneName = `${geneName}_${count}`;
        } else {
            geneTracker.set(geneName, 1);
        }
        
        processedGenes.push({...gene, uniqueGeneName, originalGeneName: geneName});
    });
    
    // Get all unique gene names for Y-axis
    const allFoundGenes = processedGenes.map(g => g.uniqueGeneName).sort();

    // 1. Process genes → populate categories & points
    processedGenes.forEach(gene => {
        const uniqueGeneName = gene.uniqueGeneName;
        const originalGeneName = gene.originalGeneName;
        
        // Process Subcellular Localization with multiple colors for genes with multiple localizations
        const localizations = getCleanArray(gene, categories['Subcellular Localization'].key);
        localizations.forEach((loc, locIndex) => {
            categories['Subcellular Localization'].data.add(loc);
            plotPoints.push({ 
                gene: uniqueGeneName, 
                originalGene: originalGeneName,
                category: 'Subcellular Localization', 
                item: loc,
                colorIndex: locIndex % softColors.localization.length
            });
        });

        // Process other categories normally
        ['Complex Names','Protein Domains','Ciliopathy'].forEach(catName => {
            getCleanArray(gene, categories[catName].key).forEach(item => {
                categories[catName].data.add(item);
                plotPoints.push({ 
                    gene: uniqueGeneName, 
                    originalGene: originalGeneName,
                    category: catName, 
                    item 
                });
            });
        });

        // Process Ciliogenesis Screen with different screen types
        if (gene.screens && gene.screens.length > 0) {
            gene.screens.forEach(screen => {
                const screenType = screen.type || 'Unknown Screen';
                categories['Ciliogenesis Screen'].data.add(screenType);
                plotPoints.push({ 
                    gene: uniqueGeneName, 
                    originalGene: originalGeneName,
                    category: 'Ciliogenesis Screen', 
                    item: screenType,
                    screenData: screen // Store full screen data for hover
                });
            });
        }
    });

    if (plotPoints.length === 0) return;

    // 2. Build X-axis mapping
    let xOffset = 0;
    const itemToXPos = new Map();
    const sectionTicks = [];
    const sectionLines = [];
    const pointSpacing = 1.5;
    const sectionPadding = 25;

    Object.keys(categories).forEach(catName => {
        const items = Array.from(categories[catName].data).sort();
        if (items.length > 0) {
            const sectionWidth = Math.max((items.length - 1) * pointSpacing, 1);
            sectionTicks.push({ pos: xOffset + sectionWidth / 2, name: catName });
            items.forEach((item, idx) => {
                itemToXPos.set(`${catName}-${item}`, xOffset + (idx * pointSpacing));
            });
            xOffset += sectionWidth + sectionPadding;
            sectionLines.push({ x: xOffset - sectionPadding / 2, color: categories[catName].color[0] });
        }
    });

    // 3. Build traces
    const dataTraces = [];
    const createTrace = (config) => dataTraces.push(config);

    Object.keys(categories).forEach(catName => {
        const config = categories[catName];
        const items = Array.from(config.data).sort();

        if (items.length > 0) {
            // Add section header trace
            createTrace({ 
                name: `--- ${catName} ---`, 
                type: 'scatter', 
                mode: 'markers', 
                showlegend: false, 
                marker: { size: 0, color: 'rgba(0,0,0,0)' } 
            });
        }

        if (catName === 'Subcellular Localization') {
            // Special handling for localization: each localization gets its own color
            items.forEach((item, idx) => {
                const pointsForItem = plotPoints.filter(p => p.item === item && p.category === catName);
                createTrace({
                    x: pointsForItem.map(p => itemToXPos.get(`${p.category}-${p.item}`)),
                    y: pointsForItem.map(p => p.gene),
                    text: pointsForItem.map(p => `<b>Gene:</b> ${p.originalGene}<br><b>Localization:</b> ${p.item}`),
                    hoverinfo: 'text',
                    type: 'scatter',
                    mode: 'markers',
                    name: capitalize(item),
                    marker: { 
                        size: custom.bubbleSize || 7, 
                        color: config.color[idx % config.color.length] 
                    }
                });
            });
        } else if (catName === 'Ciliogenesis Screen') {
            // Special handling for screens: each screen type gets its own color
            items.forEach((item, idx) => {
                const pointsForItem = plotPoints.filter(p => p.item === item && p.category === catName);
                createTrace({
                    x: pointsForItem.map(p => itemToXPos.get(`${p.category}-${p.item}`)),
                    y: pointsForItem.map(p => p.gene),
                    text: pointsForItem.map(p => {
                        const screenInfo = p.screenData ? 
                            `<br><b>Score:</b> ${p.screenData.score || 'N/A'}<br><b>P-value:</b> ${p.screenData.pvalue || 'N/A'}` : 
                            '';
                        return `<b>Gene:</b> ${p.originalGene}<br><b>Screen Type:</b> ${p.item}${screenInfo}`;
                    }),
                    hoverinfo: 'text',
                    type: 'scatter',
                    mode: 'markers',
                    name: capitalize(item),
                    marker: { 
                        size: custom.bubbleSize || 7, 
                        color: config.color[idx % config.color.length] 
                    }
                });
            });
        } else if (catName === 'Ciliopathy') {
            // Ciliopathy with multiple colors
            items.forEach((item, idx) => {
                const pointsForItem = plotPoints.filter(p => p.item === item && p.category === catName);
                createTrace({
                    x: pointsForItem.map(p => itemToXPos.get(`${p.category}-${p.item}`)),
                    y: pointsForItem.map(p => p.gene),
                    text: pointsForItem.map(p => `<b>Gene:</b> ${p.originalGene}<br><b>Ciliopathy:</b> ${p.item}`),
                    hoverinfo: 'text',
                    type: 'scatter',
                    mode: 'markers',
                    name: capitalize(item),
                    marker: { 
                        size: custom.bubbleSize || 7, 
                        color: config.color[idx % config.color.length] 
                    }
                });
            });
        } else {
            // Other categories (Complex Names, Protein Domains) - single color per category
            const pointsForCat = plotPoints.filter(p => p.category === catName);
            if (pointsForCat.length > 0) {
                createTrace({
                    x: pointsForCat.map(p => itemToXPos.get(`${p.category}-${p.item}`)),
                    y: pointsForCat.map(p => p.gene),
                    text: pointsForCat.map(p => `<b>Gene:</b> ${p.originalGene}<br><b>${catName}:</b> ${p.item}`),
                    hoverinfo: 'text',
                    type: 'scatter',
                    mode: 'markers',
                    name: catName,
                    marker: { 
                        size: custom.bubbleSize || 7, 
                        color: config.color[0] 
                    }
                });
            }
        }
    });

    // 4. Create legend annotations with color meanings
    const annotations = [];
    let annotationY = -0.25;
    const annotationSpacing = 0.03;

    // Add color meaning explanations for key categories
    Object.keys(categories).forEach(catName => {
        const config = categories[catName];
        const items = Array.from(config.data).sort();
        
        if (items.length > 0 && (catName === 'Subcellular Localization' || catName === 'Ciliogenesis Screen' || catName === 'Ciliopathy')) {
            annotations.push({
                text: `<b>${catName} Colors:</b>`,
                showarrow: false,
                xref: 'paper', yref: 'paper',
                x: 0.02, y: annotationY,
                font: { color: 'black', size: 10, weight: 'bold' },
                xanchor: 'left'
            });
            
            annotationY -= annotationSpacing;
            
            items.forEach((item, idx) => {
                const color = config.color[idx % config.color.length];
                annotations.push({
                    text: `● ${capitalize(item)}`,
                    showarrow: false,
                    xref: 'paper', yref: 'paper',
                    x: 0.02, y: annotationY,
                    font: { color: color, size: 9, weight: 'bold' },
                    xanchor: 'left'
                });
                annotationY -= annotationSpacing;
            });
            
            annotationY -= annotationSpacing * 0.5; // Extra spacing between categories
        }
    });

    // 5. Layout with custom tick labels to show original gene names
    const customTickLabels = allFoundGenes.map(uniqueName => {
        const gene = processedGenes.find(g => g.uniqueGeneName === uniqueName);
        return gene ? gene.originalGeneName : uniqueName;
    });

    const layout = {
        title: { text: custom.title || 'Gene Feature Overview', font: { size: custom.titleFontSize || 18, ...custom.axisTitleFont } },
        xaxis: {
            title: { text: 'Feature Categories', font: { ...custom.axisTitleFont, weight: 'bold' } },
            tickvals: sectionTicks.map(t => t.pos),
            ticktext: sectionTicks.map(t => `<b>${t.name}</b>`),
            showticklabels: true,
            showgrid: false,
            zeroline: false
        },
        yaxis: {
            title: { text: 'Gene', font: { ...custom.axisTitleFont, weight: 'bold' } },
            tickfont: { weight: 'bold', size: 12 },
            categoryorder: 'array',
            categoryarray: allFoundGenes.reverse(),
            tickvals: allFoundGenes,
            ticktext: customTickLabels.reverse(),
            showgrid: false,
            showline: true,
            linewidth: 2,
            linecolor: 'black',
            tickmode: 'array',
            automargin: true
        },
        margin: { l: 150, r: 20, b: 200, t: 80 },
        legend: { 
            orientation: 'h', 
            y: -0.15, 
            x: 0.5, 
            xanchor: 'center',
            font: { size: 10 }
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        shapes: sectionLines.map(line => ({
            type: 'line', xref: 'x', yref: 'paper',
            x0: line.x, y0: 0, x1: line.x, y1: 1,
            line: { color: line.color, width: 1, dash: 'dot' }
        })),
        annotations: annotations
    };

    Plotly.newPlot('plot-display-area', dataTraces, layout, { responsive: true });
};

window.renderEnrichmentBubblePlot = function(genes, custom) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');
    
    const categoryCounts = new Map();
    const totalGenes = genes.length;
    
    genes.forEach(gene => {
        getCleanArray(gene, 'functional_category').forEach(cat => {
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
    });
    
    const enrichmentData = [];
    const allCategories = [...categoryCounts.keys()];
    
    allCategories.forEach(category => {
        const countInSet = categoryCounts.get(category);
        const proportionInSet = countInSet / totalGenes;
        const proportionInDatabase = 0.1;
        const enrichmentScore = proportionInSet / proportionInDatabase;
        const pValue = 1 / (enrichmentScore * 10);
        
        enrichmentData.push({
            category,
            count: countInSet,
            enrichment: enrichmentScore,
            pValue: pValue
        });
    });
    
    const data = [{
        x: enrichmentData.map(d => d.category),
        y: enrichmentData.map(d => d.enrichment),
        text: enrichmentData.map(d => `Category: ${d.category}<br>Count: ${d.count}<br>Enrichment: ${d.enrichment.toFixed(2)}<br>p-value: ${d.pValue.toFixed(4)}`),
        mode: 'markers',
        marker: {
            size: enrichmentData.map(d => (custom.bubbleSize || 15) * (d.count / 5 + 0.5)),
            color: enrichmentData.map(d => -Math.log10(d.pValue)),
            colorscale: 'Viridis',
            showscale: true,
            colorbar: {
                title: '-log10(p-value)',
                titleside: 'right'
            },
            line: { color: '#000', width: 1 }
        }
    }];
    
    const layout = {
        title: { 
            text: custom.title || 'Functional Category Enrichment', 
            font: { size: custom.titleFontSize, family: custom.fontFamily, color: custom.fontColor } 
        },
        xaxis: { 
            title: { text: 'Functional Category', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            tickangle: -45,
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false,
            tickfont: { size: custom.columnFontSize, family: custom.fontFamily, color: custom.fontColor }
        },
        yaxis: { 
            title: { text: 'Enrichment Score', font: custom.axisTitleFont }, 
            visible: custom.showY,
            linecolor: '#000', 
            linewidth: 2, 
            mirror: true,
            showgrid: false,
            zeroline: false,
            tickfont: { size: custom.rowFontSize, family: custom.fontFamily, color: custom.fontColor }
        },
        hovermode: 'closest',
        showlegend: false,
        width: custom.figureWidth,
        height: custom.figureHeight,
        margin: { l: 120, r: 50, b: 150, t: 80 },
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
};

window.renderBalloonPlot = function(genes, custom) {
    const localizationCounts = new Map();
    const functionalCounts = new Map();
    genes.forEach(gene => {
        getCleanArray(gene, 'localization').forEach(loc => localizationCounts.set(loc, (localizationCounts.get(loc) || 0) + 1));
        getCleanArray(gene, 'functional_category').forEach(func => functionalCounts.set(func, (functionalCounts.get(func) || 0) + 1));
    });
    const localizations = [...localizationCounts.keys()];
    const functions = [...functionalCounts.keys()];
    const zData = functions.map(func => {
        return localizations.map(loc => {
            return genes.filter(gene => {
                const geneLocs = getCleanArray(gene, 'localization');
                const geneFuncs = getCleanArray(gene, 'functional_category');
                return geneLocs.includes(loc) && geneFuncs.includes(func);
            }).length;
        });
    });
    
    const data = [{ 
        type: 'heatmap', 
        x: localizations, 
        y: functions, 
        z: zData, 
        colorscale: 'Blues', 
        showscale: true 
    }];
    
    const layout = { 
        title: { 
            text: custom.title || 'Function vs Localization', 
            font: { size: custom.titleFontSize, family: custom.fontFamily, color: custom.fontColor },
            y: 0.95 
        }, 
        xaxis: { 
            title: { text: 'Localization', font: custom.axisTitleFont }, 
            visible: custom.showX, 
            tickangle: -45, 
            automargin: true,
            tickfont: { size: custom.columnFontSize, family: custom.fontFamily, color: custom.fontColor }
        }, 
        yaxis: { 
            title: { text: 'Functional Category', font: custom.axisTitleFont }, 
            visible: custom.showY, 
            automargin: true,
            tickfont: { size: custom.rowFontSize, family: custom.fontFamily, color: custom.fontColor }
        }, 
        width: custom.figureWidth,
        height: custom.figureHeight,
        margin: { l: 200, r: 50, b: 180, t: 80 }, 
        plot_bgcolor: 'white', 
        paper_bgcolor: 'white'
    };
    
    Plotly.newPlot('plot-display-area', data, layout, { responsive: true });
};

window.renderVennDiagram = async function(genes, custom = {}) {
    const plotContainer = document.getElementById('plot-display-area');
    clearAllPlots('plot-display-area');

    // Build reference set from the loaded database
    const referenceCiliaryGenes = new Set();
    if (window.CiliAI && window.CiliAI.lookups && window.CiliAI.lookups.geneMap) {
        Object.keys(window.CiliAI.lookups.geneMap).forEach(gene => {
            referenceCiliaryGenes.add(gene.toUpperCase());
        });
    }

    // Build user gene set
    const userGenes = new Set(genes.map(g => g.gene.toUpperCase()));

    // Calculate overlaps
    const commonGenes = new Set([...userGenes].filter(x => referenceCiliaryGenes.has(x)));
    const uniqueToUser = new Set([...userGenes].filter(x => !referenceCiliaryGenes.has(x)));
    const uniqueToReference = new Set([...referenceCiliaryGenes].filter(x => !userGenes.has(x)));

    // Helper for formatting big numbers
    const fmt = n => n.toLocaleString();

    // Get customization values with defaults
    const vennCustom = {
        label1: {
            text: document.getElementById('venn-label-1')?.value || 'Gene Input',
            color: document.getElementById('venn-label-color-1')?.value || '#000000'
        },
        label2: {
            text: document.getElementById('venn-label-2')?.value || 'Gold Standard Ciliary Genes',
            color: document.getElementById('venn-label-color-2')?.value || '#000000'
        },
        circle1: {
            color: document.getElementById('venn-circle-color-1')?.value || '#3f51b5'
        },
        circle2: {
            color: document.getElementById('venn-circle-color-2')?.value || '#4CAF50'
        },
        numberColor: document.getElementById('venn-number-color')?.value || '#333333'
    };

    // Render Venn diagram
    plotContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; display: flex; flex-direction: column; justify-content: center; font-family: ${custom.fontFamily || 'Arial'};">
            <h3 style="margin-bottom: 20px; font-size: ${custom.titleFontSize || 24}px; color: ${custom.fontColor || '#000'};">${custom.title || 'Gene Set Comparison'}</h3>

            <div style="position: relative; width: 450px; height: 300px; margin: 20px auto 0 auto;">
                <div style="position: absolute; left: 50px; top: 20px; width: 200px; text-align: center; font-weight: bold; color: ${vennCustom.label1.color};">
                    ${vennCustom.label1.text}
                </div>
                <div style="position: absolute; right: 50px; top: 20px; width: 200px; text-align: center; font-weight: bold; color: ${vennCustom.label2.color};">
                    ${vennCustom.label2.text}
                </div>

                <div style="position: absolute; left: 50px; top: 50px; width: 200px; height: 200px; border: 3px solid ${vennCustom.circle1.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${vennCustom.circle1.color}20;">
                    <div style="font-size: 24px; font-weight: bold; color: ${vennCustom.numberColor};">${fmt(uniqueToUser.size)}</div>
                </div>

                <div style="position: absolute; right: 50px; top: 50px; width: 200px; height: 200px; border: 3px solid ${vennCustom.circle2.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${vennCustom.circle2.color}20;">
                    <div style="font-size: 24px; font-weight: bold; color: ${vennCustom.numberColor};">${fmt(uniqueToReference.size)}</div>
                </div>

                <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px; color: ${vennCustom.numberColor};">
                    ${fmt(commonGenes.size)}
                </div>
            </div>

            <div style="margin-top: 20px; font-size: 0.85em; color: #666;">
                Exact gene symbol matches only
            </div>
        </div>`;
};

/* plots.js 
   Advanced CiliaPlot Visualization Module
   Integrated with CiliAI Core (v5.4)
*/

(function () {
    'use strict';

    window.CiliPlot = window.CiliPlot || {};

    // =============================================================================
    // 1. DATA BRIDGE (Connects CiliAI Data to Plot Logic)
    // =============================================================================

    // Maps CiliAI Master Data (Capitalized) to Plotly format (lowercase)
    function normalizeGeneData(geneObj) {
        if (!geneObj) return null;
        return {
            gene: geneObj.Gene,
            synonym: geneObj.Synonym || geneObj.Synonyms,
            localization: geneObj.Localization,
            functional_category: geneObj['Functional.category'] || geneObj.functional_category,
            ciliopathy: geneObj.Ciliopathies ? geneObj.Ciliopathies.map(c => c.name) : [],
            complex_names: geneObj.complex_components ? Object.keys(geneObj.complex_components) : [],
            domain_descriptions: geneObj.domain_descriptions,
            screens_summary: geneObj.screens || []
        };
    }

    function findAndMergeGenes(userInputArray) {
        const foundGenes = [];
        const seenGenes = new Set();
        const geneMap = window.CiliAI.lookups.geneMap;

        if (!geneMap) {
            console.error("CiliAI data not ready.");
            return { foundGenes: [] };
        }

        userInputArray.forEach(query => {
            const symbol = query.toUpperCase().trim();
            if (!symbol || seenGenes.has(symbol)) return;

            if (geneMap[symbol]) {
                // Convert the master data format to the plot-friendly format
                const normData = normalizeGeneData(geneMap[symbol]);
                foundGenes.push(normData);
                seenGenes.add(symbol);
            }
        });
        return { foundGenes };
    }

    // =============================================================================
    // 2. UI GENERATION (Injected into CiliAI Panels)
    // =============================================================================

    /**
     * Renders the Input Controls into the Left Panel
     */
    window.CiliPlot.renderInterface = function () {
        const leftPanel = document.getElementById('left-panel');
        const rightPanel = document.getElementById('right-panel');
        if (!leftPanel || !rightPanel) return;

        // --- 1. Left Panel: Inputs & Controls ---
        leftPanel.innerHTML = `
            <div class="card">
                <h3>📊 CiliaPlot Controls</h3>
                <div style="margin-bottom: 15px;">
                    <label style="font-weight:bold; font-size:12px;">1. Select Plot Type</label>
                    <select id="ciliaplot-type-selector" style="width:100%; padding:8px; margin-top:5px; border:1px solid #ddd; border-radius:4px;">
                        <option value="localization_bubble">📌 Gene Localizations (Bubble)</option>
                        <option value="functional_bar">🧩 Functional Categories</option>
                        <option value="enrichment_bubble">🔬 Enrichment Analysis</option>
                        <option value="balloon_plot">⚙️ Function vs Localization</option>
                        <option value="venn_diagram">🔁 Gene Set Comparison</option>
                        <option value="network">🕸 Complex Network</option>
                        <option value="organelle_radar">📡 Organelle Radar</option>
                        <option value="organelle_umap">🧭 Organelle UMAP</option>
                        <option value="expression_heatmap">🌡 Expression Heatmap</option>
                        <option value="multi_category_manhattan">🧬 Gene Feature Overview</option>
                        <option value="screen_summary_heatmap">🗂 Screen Summary</option>
                        <option value="ciliopathy_associations">⚕️ Genes vs Ciliopathies</option>
                    </select>
                    <div id="plot-explanation" style="font-size:11px; color:#666; margin-top:5px; font-style:italic;">
                        Displays subcellular localizations as bubbles.
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="font-weight:bold; font-size:12px;">2. Input Genes</label>
                    <textarea id="ciliaplot-genes-input" style="width:100%; height:150px; padding:8px; border:1px solid #ddd; border-radius:4px; font-family:monospace;" placeholder="Paste gene symbols (e.g. IFT88, BBS1, CEP290)..."></textarea>
                </div>

                <button id="generate-ciliaplot-btn" class="action-btn primary" style="width:100%;">Generate Plot</button>
                
                <div id="customization-container" style="margin-top:20px; border-top:1px solid #eee; padding-top:10px;">
                    </div>
            </div>
        `;

        // --- 2. Right Panel: Plot Area ---
        // Note: We keep the header/footer structure from ciliai_ui.js but clear the content
        rightPanel.innerHTML = `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 id="plot-title">Visualization</h3>
                    <div style="display:flex; gap:5px;">
                        <select id="download-format" style="padding:4px;"><option value="png">PNG</option><option value="svg">SVG</option></select>
                        <button id="download-plot-btn" class="action-btn">Download</button>
                    </div>
                </div>
                <div id="plot-display-area" style="width:100%; min-height:600px; background:white; border:1px dashed #ccc; display:flex; align-items:center; justify-content:center; color:#999;">
                    Select a plot type and enter genes to generate visualization.
                </div>
                <div id="gene-summary-footer" style="margin-top:15px; font-size:12px; color:#666;"></div>
            </div>
        `;

        // --- 3. Attach Events ---
        document.getElementById('generate-ciliaplot-btn').addEventListener('click', generateAnalysisPlots);
        document.getElementById('download-plot-btn').addEventListener('click', downloadPlot);
        document.getElementById('ciliaplot-type-selector').addEventListener('change', (e) => {
            updatePlotExplanation(e.target.value);
            updateCustomizationPanel(e.target.value);
        });

        // Initialize customization
        updateCustomizationPanel('localization_bubble');
    };

    // =============================================================================
    // 3. PLOT LOGIC
    // =============================================================================

    async function generateAnalysisPlots() {
        if (!window.CiliAI || !window.CiliAI.ready) {
            alert("Please wait for CiliAI database to finish loading.");
            return;
        }

        const plotContainer = document.getElementById('plot-display-area');
        plotContainer.innerHTML = '<div class="loading-spinner"></div> Generating plot...';
        
        const rawInput = document.getElementById('ciliaplot-genes-input').value;
        const originalQueries = rawInput.split(/[\s,;\n\r\t]+/).filter(Boolean);
        
        if (originalQueries.length === 0) {
            plotContainer.innerHTML = 'Please enter at least one gene symbol.';
            return;
        }

        // Use the new Bridge function
        const { foundGenes } = findAndMergeGenes(originalQueries);
        
        // Update Summary Footer
        const footer = document.getElementById('gene-summary-footer');
        footer.innerHTML = `Found <strong>${foundGenes.length}</strong> genes out of <strong>${originalQueries.length}</strong> queries.`;

        if (foundGenes.length === 0) {
            plotContainer.innerHTML = 'None of the provided genes were found in the CiliaHub database.';
            return;
        }

        const plotType = document.getElementById('ciliaplot-type-selector').value;
        const custom = getPlotCustomization();

        // Dispatch to specific renderers
        try {
            switch (plotType) {
                case 'localization_bubble': renderBubblePlot(foundGenes, custom); break;
                case 'functional_bar': renderBarPlot(foundGenes, custom); break;
                case 'enrichment_bubble': window.renderEnrichmentBubblePlot(foundGenes, custom); break;
                case 'balloon_plot': window.renderBalloonPlot(foundGenes, custom); break;
                case 'venn_diagram': window.renderVennDiagram(foundGenes, custom); break;
                case 'network': window.renderComplexNetwork(foundGenes, plotContainer, custom); break;
                case 'organelle_radar': renderOrganelleRadarPlot(foundGenes, plotContainer, custom); break;
                case 'organelle_umap': window.renderOrganelleUMAP(foundGenes, plotContainer, custom); break;
                case 'expression_heatmap': renderExpressionHeatmap(foundGenes); break;
                case 'multi_category_manhattan': window.renderMultiCategoryPlot(foundGenes, custom); break;
                case 'screen_summary_heatmap': window.renderScreenSummaryHeatmap(foundGenes, custom); break;
                case 'ciliopathy_associations': window.renderCiliopathyPlot(foundGenes, custom); break;
                default: plotContainer.innerHTML = 'Plot type not implemented yet.';
            }
        } catch (e) {
            console.error("Plot Error:", e);
            plotContainer.innerHTML = `Error generating plot: ${e.message}`;
        }
    }

    // =============================================================================
    // 4. HELPERS & PLOT RENDERERS (Condensed/Adapted from your code)
    // =============================================================================

    function getCleanArray(gene, ...keys) {
        let data = null;
        for (const key of keys) { if (gene[key] != null) { data = gene[key]; break; } }
        if (data == null) return [];
        return Array.isArray(data) ? data : [data];
    }

    function updatePlotExplanation(type) {
        const explanations = {
            'localization_bubble': 'Displays subcellular localizations as bubbles.',
            'functional_bar': 'Shows distribution of functional categories.',
            'network': 'Visualizes protein-protein/complex interactions.',
            'organelle_radar': 'Compares organellar profiles against known markers.',
            'organelle_umap': 'Projects genes onto 2D UMAP based on localization patterns.',
            'expression_heatmap': 'Shows tissue-specific expression patterns.',
            'multi_category_manhattan': 'Comprehensive gene associations across major categories.',
            'screen_summary_heatmap': 'Visualizes results from functional genomics screens.',
            'ciliopathy_associations': 'Displays gene-ciliopathy associations.',
            'enrichment_bubble': 'Analyzes functional category enrichment.',
            'balloon_plot': 'Shows function vs localization relationships.',
            'venn_diagram': 'Compares gene sets with ciliary reference genes.'
        };
        document.getElementById('plot-explanation').textContent = explanations[type] || '';
    }

    function updateCustomizationPanel(type) {
        const container = document.getElementById('customization-container');
        let html = `<label style="font-size:11px; font-weight:bold;">Title</label><input id="custom-title" type="text" style="width:100%; margin-bottom:5px;">`;
        // Add more dynamic inputs based on 'type' if desired
        container.innerHTML = html;
    }

    function getPlotCustomization() {
        return {
            title: document.getElementById('custom-title')?.value || '',
            titleFontSize: 18,
            fontFamily: 'Arial',
            fontColor: '#000',
            figureWidth: null, // Let Plotly auto-size
            figureHeight: 600,
            bubbleSize: 15,
            axisTitleFont: { size: 16, family: 'Arial', color: '#000', weight: 'bold' }
        };
    }

    // --- PLOTLY WRAPPERS (Simplified for integration) ---

    function renderBubblePlot(genes, custom) {
        const plotData = [];
        genes.forEach(gene => {
            const locs = getCleanArray(gene, 'localization');
            if (locs.length) {
                plotData.push({
                    x: locs,
                    y: Array(locs.length).fill(gene.gene),
                    mode: 'markers',
                    type: 'scatter',
                    marker: { size: custom.bubbleSize, color: '#667eea' },
                    name: gene.gene
                });
            }
        });
        const layout = { 
            title: custom.title || 'Gene Localization', 
            xaxis: {title:'Localization'}, yaxis: {title:'Gene', automargin:true},
            margin: {l:150}
        };
        Plotly.newPlot('plot-display-area', plotData, layout, {responsive: true});
    }

    function renderBarPlot(genes, custom) {
        const counts = {};
        genes.forEach(g => {
            getCleanArray(g, 'functional_category').forEach(cat => counts[cat] = (counts[cat]||0)+1);
        });
        const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
        const data = [{
            x: sorted.map(e=>e[1]), y: sorted.map(e=>e[0]),
            type: 'bar', orientation: 'h', marker: {color: '#4CAF50'}
        }];
        const layout = { 
            title: custom.title || 'Functional Categories',
            yaxis: {automargin:true}, margin: {l:200}
        };
        Plotly.newPlot('plot-display-area', data, layout, {responsive: true});
    }

    // --- Placeholder for Complex D3/ChartJS plots (Network/Radar) ---
    const organelleMarkerProfiles = {
        "Lysosome": [0.1, 0.2, 0.3, 0.8, 0.9, 0.7, 0.4, 0.2],
        "Cytosol": [0.4, 0.5, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3],
        "Nucleus": [0.9, 0.8, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1],
        "Mitochondria": [0.8, 0.9, 0.7, 0.2, 0.1, 0.1, 0.2, 0.3],
        "Endosome": [0.2, 0.3, 0.6, 0.8, 0.7, 0.5, 0.3, 0.2],
        "Endoplasmic reticulum": [0.2, 0.4, 0.8, 0.3, 0.2, 0.1, 0.5, 0.7],
        "Centrosome": [0.1, 0.2, 0.7, 0.9, 0.8, 0.3, 0.1, 0.1],
        "Golgi": [0.1, 0.2, 0.5, 0.2, 0.2, 0.2, 0.8, 0.9],
        "Autophagosomes": [0.1, 0.1, 0.4, 0.7, 0.8, 0.6, 0.3, 0.2],
        "Cilia": [0.9, 0.9, 0.8, 0.7, 0.5, 0.3, 0.3, 0.2],
        "Transition zone": [0.8, 0.8, 0.9, 0.7, 0.4, 0.2, 0.2, 0.1],
        "Basal body": [0.85, 0.85, 0.8, 0.6, 0.3, 0.2, 0.1, 0.1],
        "Ciliary associated gene": [0.1, 0.1, 0.2, 0.8, 0.9, 0.6, 0.2, 0.1],
        "Peroxisome": [0.3, 0.4, 0.6, 0.5, 0.4, 0.3, 0.7, 0.8]
    };

    const precomputedUMAP = {
        "Lysosome": Array.from({length: 40}, (_, i) => ({gene: `LYS${i}`, x: 2 + Math.random()*2, y: 8 + Math.random()*2})),
        "Cytosol": Array.from({length: 60}, (_, i) => ({gene: `CYT${i}`, x: 5 + Math.random()*2, y: 5 + Math.random()*2})),
        "Nucleus": Array.from({length: 70}, (_, i) => ({gene: `NUC${i}`, x: 9 + Math.random()*1.5, y: 1 + Math.random()*2})),
        "Mitochondria": Array.from({length: 60}, (_, i) => ({gene: `MT${i}`, x: 1 + Math.random()*2, y: 2 + Math.random()*2})),
        "Endosome": Array.from({length: 35}, (_, i) => ({gene: `END${i}`, x: 7 + Math.random()*2, y: 7 + Math.random()*2})),
        "Endoplasmic reticulum": Array.from({length: 45}, (_, i) => ({gene: `ER${i}`, x: 3 + Math.random()*2, y: 6 + Math.random()*2})),
        "Centrosome": Array.from({length: 40}, (_, i) => ({gene: `CENT${i}`, x: 6 + Math.random()*2, y: 7 + Math.random()*2})),
        "Golgi": Array.from({length: 35}, (_, i) => ({gene: `GOLGI${i}`, x: 4 + Math.random()*2, y: 8 + Math.random()*2})),
        "Autophagosomes": Array.from({length: 30}, (_, i) => ({gene: `AUTO${i}`, x: 2 + Math.random()*2, y: 6 + Math.random()*2})),
        "Cilia": Array.from({length: 50}, (_, i) => ({gene: `CILIA${i}`, x: 8 + Math.random()*1.5, y: 9 + Math.random()*1.5})),
        "Transition zone": Array.from({length: 30}, (_, i) => ({gene: `TZ${i}`, x: 8 + Math.random()*1.5, y: 7 + Math.random()*1.5})),
        "Basal body": Array.from({length: 30}, (_, i) => ({gene: `BB${i}`, x: 7 + Math.random()*1.5, y: 6 + Math.random()*1.5})),
        "Ciliary associated gene": Array.from({length: 50}, (_, i) => ({gene: `CIL${i}`, x: 8 + Math.random()*2, y: 8 + Math.random()*2})),
        "Peroxisome": Array.from({length: 25}, (_, i) => ({gene: `PEROX${i}`, x: 6 + Math.random()*2, y: 3 + Math.random()*2}))
    };

    const fractionLabels = ['Fr 1', 'Fr 2', 'Fr 3', 'Fr 4', 'Fr 5', 'Fr 6', 'Fr 7', 'Fr 8'];

    function renderOrganelleRadarPlot(genes, container, custom) {
        clearAllPlots(container.id);
        container.innerHTML = `<canvas style="max-width: 100%; max-height: 100%;"></canvas>`;
        const ctx = container.querySelector('canvas').getContext('2d');
        
        const userProfile = new Array(fractionLabels.length).fill(0);
        let contributingGenes = 0;
        
        genes.forEach(gene => {
            const localizations = getCleanArray(gene, 'localization');
            let geneAdded = false;
            localizations.forEach(loc => {
                const matchedProfile = Object.keys(organelleMarkerProfiles).find(key => 
                    loc.toLowerCase().includes(key.toLowerCase()) || 
                    key.toLowerCase().includes(loc.toLowerCase())
                );
                if (matchedProfile) {
                    organelleMarkerProfiles[matchedProfile].forEach((val, i) => userProfile[i] += val);
                    geneAdded = true;
                }
            });
            if (geneAdded) contributingGenes++;
        });
        
        if (contributingGenes === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 50px;">No genes mapped to organellar profiles.</p>';
            return;
        }
        
        userProfile.forEach((val, i) => userProfile[i] /= contributingGenes);
        
        const datasets = Object.entries(organelleMarkerProfiles).map(([name, data], i) => {
        const isCiliary = ["Cilia", "Transition zone", "Basal body"].includes(name);
        return {
            label: name,
            data: data,
            borderColor: isCiliary ? "#1abc9c" : d3.schemeTableau10[i % 10],
            backgroundColor: isCiliary ? "#1abc9c20" : d3.schemeTableau10[i % 10] + '20',
            borderWidth: isCiliary ? 3 : 2,
            hidden: false,
            pointRadius: 3
        };
    });

        
        datasets.push({
            label: 'Your Gene Set',
            data: userProfile,
            borderColor: '#e74c3c',
            backgroundColor: '#e74c3c20',
            borderWidth: 3,
            pointRadius: 4,
            hidden: false
        });
        
        currentPlotInstance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: fractionLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: custom.title || "Organellar Profile Comparison",
                        font: { 
                            size: custom.titleFontSize || 16,
                            family: custom.fontFamily,
                            color: custom.fontColor
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: { 
                            usePointStyle: true,
                            font: {
                                family: custom.fontFamily,
                                size: 12
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 1.0,
                        ticks: { stepSize: 0.2 }
                    }
                }
            }
        });
    }

    function computeProteinComplexLinks(genes) {
        const nodes = genes.map(gene => ({ id: gene.gene, group: 1 }));
        const complexMap = new Map();
        
        genes.forEach(gene => {
            getCleanArray(gene, 'complex_names', 'complex').forEach(complex => {
                if (!complexMap.has(complex)) complexMap.set(complex, new Set());
                complexMap.get(complex).add(gene.gene);
            });
        });
        
        const linkMap = new Map();
        complexMap.forEach((genesInComplex) => {
            const geneArray = Array.from(genesInComplex);
            for (let i = 0; i < geneArray.length; i++) {
                for (let j = i + 1; j < geneArray.length; j++) {
                    const key = [geneArray[i], geneArray[j]].sort().join('-');
                    linkMap.set(key, { 
                        source: geneArray[i], 
                        target: geneArray[j],
                        value: 1
                    });
                }
            }
        });
        
        return { nodes, links: Array.from(linkMap.values()) };
    }

    // --- Expression Heatmap ---
    function renderExpressionHeatmap(genes) {
         // Reuse logic from ciliai.js or implement simplified heatmap
         // Since we have cellDataCache in CiliAI core:
         const z = [];
         const y = [];
         const x = []; // Cell types
         
         // Gather all unique cell types first
         const allCellTypes = new Set();
         genes.forEach(g => {
             const cache = window.CiliAI.cellDataCache[g.gene.toUpperCase()];
             if(cache) Object.keys(cache).forEach(k => allCellTypes.add(k));
         });
         const cells = Array.from(allCellTypes).sort();
         
         genes.forEach(g => {
             const cache = window.CiliAI.cellDataCache[g.gene.toUpperCase()];
             if(cache) {
                 y.push(g.gene);
                 const row = cells.map(c => cache[c] || 0);
                 z.push(row);
             }
         });

         if(z.length === 0) {
             document.getElementById('plot-display-area').innerHTML = "No expression data available for these genes.";
             return;
         }

         const data = [{
             z: z, x: cells, y: y, type: 'heatmap', colorscale: 'Viridis'
         }];
         const layout = { title: 'scRNA Expression', xaxis:{tickangle:45, automargin:true}, margin:{b:100} };
         Plotly.newPlot('plot-display-area', data, layout, {responsive: true});
    }

    let currentPlotInstance = null;

    function clearAllPlots(containerId = 'plot-display-area') {
        if (typeof currentPlotInstance !== 'undefined' && currentPlotInstance && typeof currentPlotInstance.destroy === 'function') {
            currentPlotInstance.destroy();
            currentPlotInstance = null;
        }
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = '';
        try { Plotly.purge(containerId); } catch (e) { /* Ignore */ }
    }

    // --- Download Helper ---
    async function downloadPlot() {
        const plotDiv = document.getElementById('plot-display-area');
        const format = document.getElementById('download-format').value;
        if(plotDiv.data) {
            Plotly.downloadImage(plotDiv, {format: format, height: 800, width: 1200, filename: 'ciliaplot'});
        } else {
            // Handle Canvas/SVG download if using ChartJS/D3
            alert("Download supported for Plotly charts.");
        }
    }

})();
