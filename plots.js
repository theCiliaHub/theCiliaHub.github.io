// --- Main Plotting Control and Settings ---

function getPlotSettings() {
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 20,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'bold',
        textColor: document.getElementById('setting-text-color')?.value || '#000000',
        axisColor: document.getElementById('setting-axis-color')?.value || '#000000',
        yAxisTitle: document.getElementById('setting-y-axis-title')?.value || 'Localization',
        xAxisTitle: document.getElementById('setting-x-axis-title')?.value || 'Enrichment',
        barChartColor: document.getElementById('setting-bar-color')?.value || '#2ca25f',
        enrichmentColors: [
            document.getElementById('setting-enrichment-color1')?.value || '#edf8fb',
            document.getElementById('setting-enrichment-color2')?.value || '#b2e2e2',
            document.getElementById('setting-enrichment-color3')?.value || '#66c2a4',
            document.getElementById('setting-enrichment-color4')?.value || '#2ca25f',
            document.getElementById('setting-enrichment-color5')?.value || '#006d2c'
        ]
    };
}

let currentPlot = null;

function generateEnrichmentPlots() {
    const genesInput = document.getElementById('enrichment-genes-input').value.trim();
    if (!genesInput) {
        alert('Please enter or upload a gene list.');
        return;
    }

    const geneList = genesInput.split(/[\n,]+/).map(g => g.trim()).filter(Boolean);

    const plotType = document.querySelector('input[name="plot-type"]:checked').value;

    const settings = {
        fontFamily: document.getElementById('setting-font-family').value,
        fontSize: Number(document.getElementById('setting-font-size').value),
        fontWeight: document.getElementById('setting-font-weight').value,
        textColor: document.getElementById('setting-text-color').value,
        axisColor: document.getElementById('setting-axis-color').value,
        yAxisTitle: document.getElementById('setting-y-axis-title').value,
        colors: [
            document.getElementById('setting-enrichment-color1').value,
            document.getElementById('setting-enrichment-color2').value,
            document.getElementById('setting-enrichment-color3').value,
            document.getElementById('setting-enrichment-color4').value,
            document.getElementById('setting-enrichment-color5').value,
        ]
    };

    // Hide all plot containers
    document.getElementById('bubble-enrichment-container').style.display = 'none';
    document.getElementById('matrix-plot-container').style.display = 'none';
    document.getElementById('ciliome-plot-container').style.display = 'none';
    document.getElementById('plot-container').style.display = 'block';
    document.getElementById('download-plot-btn').style.display = 'inline-block';

    // Destroy previous plot if exists
    if (currentPlot) {
        currentPlot.destroy();
        currentPlot = null;
    }

    if (plotType === 'bubble') {
        document.getElementById('bubble-enrichment-container').style.display = 'flex';

        const ctx = document.getElementById('enrichment-bubble-plot').getContext('2d');

        // Example: Map gene count to enrichment score
        const labels = geneList;
        const data = geneList.map((g, i) => ({
            x: i + 1,
            y: Math.random() * 5 + 1, // placeholder enrichment score
            r: Math.random() * 15 + 5  // bubble radius
        }));

        currentPlot = new Chart(ctx, {
            type: 'bubble',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gene Enrichment',
                    data: data,
                    backgroundColor: settings.colors[4]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: {
                        label: function(context) {
                            return `${labels[context.dataIndex]}: Score ${context.raw.y.toFixed(2)}`;
                        }
                    }}
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Gene Index',
                            color: settings.axisColor,
                            font: {
                                family: settings.fontFamily,
                                size: settings.fontSize,
                                weight: settings.fontWeight
                            }
                        },
                        ticks: { color: settings.textColor, font: { family: settings.fontFamily, size: settings.fontSize } }
                    },
                    y: {
                        title: {
                            display: true,
                            text: settings.yAxisTitle,
                            color: settings.axisColor,
                            font: {
                                family: settings.fontFamily,
                                size: settings.fontSize,
                                weight: settings.fontWeight
                            }
                        },
                        ticks: { color: settings.textColor, font: { family: settings.fontFamily, size: settings.fontSize } }
                    }
                }
            }
        });

        // Update legend dynamically
        const legendContainer = document.getElementById('legend-container');
        legendContainer.innerHTML = geneList.map((g, i) => `
            <div style="display:flex; align-items:center; gap:5px; margin-bottom:2px;">
                <span style="width:15px; height:15px; background:${settings.colors[i % settings.colors.length]}; display:inline-block;"></span>
                <span>${g}</span>
            </div>
        `).join('');

    } else if (plotType === 'matrix') {
        document.getElementById('matrix-plot-container').style.display = 'block';
        const ctx = document.getElementById('enrichment-matrix-plot').getContext('2d');

        // Example matrix data
        const matrixData = geneList.map(g => geneList.map(() => Math.random()));
        currentPlot = new Chart(ctx, {
            type: 'matrix',
            data: {
                datasets: [{
                    label: 'Gene Co-occurrence',
                    data: matrixData.flatMap((row, i) => row.map((v, j) => ({x:j, y:i, v: v}))),
                    backgroundColor: function(ctx) {
                        const val = ctx.dataset.data[ctx.dataIndex].v;
                        return settings.colors[Math.floor(val * settings.colors.length)] || settings.colors[0];
                    },
                    width: ({chart}) => chart.chartArea.width / geneList.length - 1,
                    height: ({chart}) => chart.chartArea.height / geneList.length - 1
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: settings.textColor, font: { family: settings.fontFamily, size: settings.fontSize } } },
                    y: { ticks: { color: settings.textColor, font: { family: settings.fontFamily, size: settings.fontSize } } }
                }
            }
        });
    } else if (plotType === 'ciliome') {
        document.getElementById('ciliome-plot-container').style.display = 'block';
        const container = document.getElementById('ciliome-plot-container');
        container.innerHTML = `
            <h3>Ciliome Enrichment</h3>
            <p>Detected ${geneList.length} ciliary genes out of ~2000 in the ciliome.</p>
            <div style="width: 80%; height: 400px; margin: auto; background: linear-gradient(90deg, ${settings.colors.join(',')}); border-radius: 10px;"></div>
        `;
    }

    // Scroll to plot container
    document.getElementById('plot-container').scrollIntoView({ behavior: 'smooth' });
}


// ------------------------
// Bubble Plot Function (Using Chart.js)
// ------------------------
function renderEnrichmentBubblePlot(foundGenes) {
    document.getElementById('bubble-enrichment-container').style.display = 'flex';

    if (window.enrichmentDotPlotInstance) window.enrichmentDotPlotInstance.destroy();

    const settings = getPlotSettings();
    const yCategories = ['Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Lysosome', 'Peroxisome', 'Plasma Membrane', 'Cytoplasm', 'Nucleus', 'Endoplasmic Reticulum', 'Mitochondria', 'Ribosome', 'Golgi'];
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        (gene.localization || '').split(',').forEach(loc => {
            const matchingCategory = yCategories.find(cat => cat.toLowerCase() === loc.trim().toLowerCase());
            if (matchingCategory) {
                localizationCounts[matchingCategory] = (localizationCounts[matchingCategory] || 0) + 1;
            }
        });
    });

    const categoriesWithData = yCategories.filter(cat => localizationCounts[cat] > 0);
    if (categoriesWithData.length === 0) {
        document.getElementById('bubble-enrichment-container').innerHTML = '<p class="status-message">No localizations found for the given genes in the selected categories.</p>';
        return;
    }

    const maxCount = Math.max(...Object.values(localizationCounts), 1);
    const colorPalette = settings.enrichmentColors;
    const getColor = count => {
        if (count === 0) return '#f0f0f0';
        const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 1;
        const index = Math.min(Math.floor(ratio * (colorPalette.length - 1)), colorPalette.length - 1);
        return colorPalette[index];
    };
    const getRadius = count => 8 + (count / maxCount) * 12;

    const dataset = {
        data: categoriesWithData.map(loc => ({
            x: 0,
            y: loc,
            r: getRadius(localizationCounts[loc]),
            count: localizationCounts[loc]
        })),
        backgroundColor: categoriesWithData.map(loc => getColor(localizationCounts[loc]))
    };

    const legendContainer = document.getElementById('legend-container');
    if (legendContainer) {
        const midCount = Math.ceil(maxCount / 2);
        const sizeLegendHTML = `
            <div style="font-family: ${settings.fontFamily}; color: ${settings.textColor};">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Gene Count</h4>
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="width: ${getRadius(maxCount)*2}px; height: ${getRadius(maxCount)*2}px; background-color: #ccc; border-radius: 50%; margin-right: 10px;"></div>
                    <span>${maxCount}</span>
                </div>
                ${ midCount > 1 && midCount < maxCount ? `
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="width: ${getRadius(midCount)*2}px; height: ${getRadius(midCount)*2}px; background-color: #ccc; border-radius: 50%; margin-right: 10px;"></div>
                    <span>${midCount}</span>
                </div>` : '' }
                <div style="display: flex; align-items: center; margin-bottom: 25px;">
                    <div style="width: ${getRadius(1)*2}px; height: ${getRadius(1)*2}px; background-color: #ccc; border-radius: 50%; margin-right: 10px;"></div>
                    <span>1</span>
                </div>
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Enrichment</h4>
                <div style="width: 100%; height: 20px; background: linear-gradient(to right, ${colorPalette.join(', ')}); border: 1px solid #ccc;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>Low</span><span>High</span>
                </div>
            </div>`;
        legendContainer.innerHTML = sizeLegendHTML;
    }

    const ctx = document.getElementById('enrichment-bubble-plot').getContext('2d');

    window.enrichmentDotPlotInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [dataset]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { left: 0, right: 10, top: 20, bottom: 20 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: c => `${c.raw.y}: ${c.raw.count} gene(s)`
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: settings.xAxisTitle,
                        color: settings.axisColor,
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        }
                    },
                    ticks: { display: false },
                    grid: { display: false }
                },
                y: {
                    type: 'category',
                    labels: categoriesWithData,
                    title: {
                        display: true,
                        text: settings.yAxisTitle,
                        color: settings.axisColor,
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        }
                    },
                    grid: { display: false, drawBorder: false },
                    ticks: {
                        font: {
                            size: settings.fontSize,
                            weight: settings.fontWeight,
                            family: settings.fontFamily
                        },
                        color: settings.textColor,
                        padding: 2
                    },
                    offset: false,
                    position: 'left'
                }
            }
        }
    });
}

// ------------------------
// Gene Matrix Plot Function (Using Chart.js)
// ------------------------
function renderBubbleMatrix(foundGenes) {
    document.getElementById('matrix-plot-container').style.display = 'block';

    if (window.enrichmentBarChartInstance) window.enrichmentBarChartInstance.destroy();

    const settings = getPlotSettings();
    const yCategories = ['Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Cilia', 'Golgi'];
    const xLabels = [...new Set(foundGenes.map(g => g.gene))].sort();
    const colorPalette = ['#377eb8', '#ff7f00', '#4daf4a', '#f781bf', '#a65628', '#984ea3', '#999999', '#e41a1c', '#dede00'];

    const datasets = foundGenes.map((gene, index) => ({
        label: gene.gene,
        data: (gene.localization || '').split(',').map(locString => {
            const matchingCategory = yCategories.find(cat => cat.toLowerCase() === locString.trim().toLowerCase());
            return matchingCategory ? { x: gene.gene, y: matchingCategory, r: 10 } : null;
        }).filter(Boolean),
        backgroundColor: colorPalette[index % colorPalette.length]
    }));

    const ctx = document.getElementById('enrichment-matrix-plot').getContext('2d');

    window.enrichmentBarChartInstance = new Chart(ctx, {
        type: 'bubble',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize
                        },
                        color: settings.textColor
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label} - ${context.raw.y}`
                    }
                },
            },
            scales: {
                x: {
                    type: 'category',
                    labels: xLabels,
                    title: {
                        display: true,
                        text: settings.xAxisTitle,
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: 'bold'
                        },
                        color: settings.axisColor
                    },
                    ticks: {
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        },
                        autoSkip: false,
                        maxRotation: 90,
                        minRotation: 45,
                        color: settings.textColor
                    },
                    grid: { display: false }
                },
                y: {
                    type: 'category',
                    labels: yCategories,
                    title: {
                        display: true,
                        text: 'Ciliary Localization',
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: 'bold'
                        },
                        color: settings.axisColor
                    },
                    ticks: {
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        },
                        color: settings.textColor
                    },
                    grid: { display: false }
                }
            }
        }
    });
}


// ------------------------
// Ciliome Enrichment Plot Function (Using Chart.js)
// ------------------------
function renderCiliomeEnrichment(foundGenes, notFoundGenes) {
    document.getElementById('ciliome-plot-container').style.display = 'block';

    if (window.ciliomeChartInstance) {
        window.ciliomeChartInstance.destroy();
    }

    const k = foundGenes.length;
    const n_input = k + notFoundGenes.length;
    const M = window.allGenes ? window.allGenes.length : 2000; // Total ciliary genes in database
    const N = 20000; // Total genes in background genome

    if (n_input === 0) {
        document.getElementById('ciliome-plot-container').innerHTML = '<p class="status-message">Please enter a gene list to analyze.</p>';
        return;
    }

    const pValue = hypergeometricPValue(k, n_input, M, N);
    const enrichmentScore = n_input > 0 && M > 0 ? (k / n_input) / (M / N) : 0;

    const summaryHTML = `
        <div id="ciliome-results-summary" style="margin-bottom: 2rem; font-size: 1.1rem; max-width: 600px; margin-left: auto; margin-right: auto;">
            <h3>Enrichment Analysis Results</h3>
            <p>From your list of <strong>${n_input}</strong> unique gene(s), <strong>${k}</strong> were found in the CiliaHub database of <strong>${M}</strong> ciliary genes.</p>
            <p>The expected number of ciliary genes from a random list of this size (from a background of ${N} total genes) would be approximately <strong>${((M / N) * n_input).toFixed(2)}</strong>.</p>
            <div style="font-size: 1.2rem; margin-top: 1rem; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
                <p><strong>Enrichment Score:</strong> ${enrichmentScore.toFixed(2)}-fold</p>
                <p><strong>P-value (Hypergeometric Test):</strong> ${pValue.toExponential(3)}</p>
            </div>
        </div>
    `;

    const localizationCounts = {};
    foundGenes.forEach(gene => {
        if (gene.localization) {
            gene.localization.split(',').forEach(loc => {
                const term = loc.trim();
                if (term) {
                    localizationCounts[term] = (localizationCounts[term] || 0) + 1;
                }
            });
        }
    });

    const chartData = { labels: [], counts: [] };
    Object.entries(localizationCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([label, count]) => {
            chartData.labels.push(label);
            chartData.counts.push(count);
        });

    const barChartHTML = `
        <div style="position: relative; width: 100%; max-width: 700px; height: 600px; margin: auto;">
            <canvas id="ciliome-bar-chart"></canvas>
        </div>
    `;

    const container = document.getElementById('ciliome-plot-container');
    container.innerHTML = summaryHTML + (k > 0 ? barChartHTML : '<p>No ciliary genes were found in your list to plot localizations.</p>');

    if (k === 0) return;

    const settings = getPlotSettings();
    const ctx = document.getElementById('ciliome-bar-chart').getContext('2d');
    window.ciliomeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Gene Count',
                data: chartData.counts,
                backgroundColor: settings.barChartColor,
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
                    text: 'Localization of Found Ciliary Genes',
                    font: {
                        family: settings.fontFamily,
                        size: settings.fontSize,
                        weight: settings.fontWeight
                    },
                    color: settings.textColor
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: settings.xAxisTitle,
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        },
                        color: settings.axisColor
                    },
                    ticks: {
                        stepSize: 1,
                        color: settings.textColor
                    },
                    grid: {
                        display: false,
                        drawBorder: true,
                        borderColor: settings.axisColor
                    }
                },
                y: {
                    ticks: {
                        font: {
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        },
                        color: settings.textColor
                    },
                    grid: {
                        display: false,
                        drawBorder: true,
                        borderColor: settings.axisColor
                    }
                }
            }
        }
    });
}

// --- Download Functionality ---

function downloadPlot() {
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    const format = document.getElementById('download-format')?.value || 'png';
    let canvas = null;
    let fileName = 'CiliaHub_Plot';

    if (selectedPlot === 'bubble') {
        canvas = document.getElementById('enrichment-bubble-plot');
        fileName = 'CiliaHub_Localization_Plot';
    } else if (selectedPlot === 'matrix') {
        canvas = document.getElementById('enrichment-matrix-plot');
        fileName = 'CiliaHub_Gene_Matrix_Plot';
    } else if (selectedPlot === 'ciliome') {
        canvas = document.getElementById('ciliome-bar-chart');
        fileName = 'CiliaHub_Ciliome_Enrichment';
    }

    if (!canvas) {
        console.error("Could not find the canvas element to download.");
        return;
    }
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Increase resolution for better quality download
    const scale = 4;
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;

    // Fill background with white
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the original canvas onto the high-res temporary canvas
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

    if (format === 'png') {
        const a = document.createElement('a');
        a.href = tempCanvas.toDataURL('image/png');
        a.download = `${fileName}.png`;
        a.click();
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: tempCanvas.width > tempCanvas.height ? 'l' : 'p',
            unit: 'px',
            format: [tempCanvas.width, tempCanvas.height]
        });
        pdf.addImage(tempCanvas.toDataURL('image/png'), 'PNG', 0, 0, tempCanvas.width, tempCanvas.height);
        pdf.save(`${fileName}.pdf`);
    }
}
