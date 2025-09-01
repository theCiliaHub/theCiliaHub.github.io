function getPlotSettings() {
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 20,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'bold',
        textColor: document.getElementById('setting-text-color')?.value || '#000000',
        axisColor: document.getElementById('setting-axis-color')?.value || '#000000',
        yAxisTitle: document.getElementById('setting-y-axis-title')?.value || 'Localization',
        // ✅ Requirement: Allow users to modify X Axis Title.
        // Note: Please add a text input to your HTML with id="setting-x-axis-title"
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

// --- Helper functions for Hypergeometric Test (Unchanged) ---
function logGamma(x) {
    let tmp = (x - 0.5) * Math.log(x + 4.5) - (x + 4.5);
    let ser = 1.0 + 76.18009173 / (x + 0) - 86.50532033 / (x + 1) + 24.01409822 / (x + 2) - 1.231739516 / (x + 3) + 0.00120858003 / (x + 4) - 0.00000536382 / (x + 5);
    return tmp + Math.log(ser * Math.sqrt(2 * Math.PI));
}

function logCombination(n, k) {
    if (k < 0 || k > n) return -Infinity;
    return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

function hypergeometricPValue(k, n, M, N) {
    let p = 0;
    for (let i = k; i <= n && i <= M; i++) {
        let logP = logCombination(M, i) + logCombination(N - M, n - i) - logCombination(N, n);
        p += Math.exp(logP);
    }
    return p;
}

async function generateEnrichmentPlots() {
    const statusDiv = document.getElementById('enrichment-status');
    const plotContainer = document.getElementById('plot-container');
    statusDiv.style.display = 'block';
    statusDiv.textContent = 'Processing...';
    plotContainer.style.display = 'none';

    // Ensure database is loaded
    if (!window.geneMapCache || !window.allGenes) {
        const success = await loadAndPrepareDatabase();
        if (!success) {
            statusDiv.textContent = 'Failed to load gene database.';
            return;
        }
    }

    // Get user input genes
    const userInput = document.getElementById('enrichment-genes-input').value;
    if (!userInput.trim()) {
        statusDiv.textContent = 'Please enter at least one gene.';
        return;
    }

    const userGenes = userInput
        .split(',')
        .map(g => sanitize(g))
        .filter(g => g.length > 0);

    // Map to gene objects
    const geneObjects = userGenes
        .map(g => geneMapCache.get(g))
        .filter(g => g);

    if (geneObjects.length === 0) {
        statusDiv.textContent = 'No matching genes found in database.';
        return;
    }

    // Calculate enrichment: simple count of localization occurrences
    const localizationCounts = {};
    const totalGenes = allGenes.length;

    geneObjects.forEach(gene => {
        if (Array.isArray(gene.localization)) {
            gene.localization.forEach(loc => {
                loc = loc.toLowerCase();
                localizationCounts[loc] = (localizationCounts[loc] || 0) + 1;
            });
        } else if (gene.localization) {
            const loc = gene.localization.toLowerCase();
            localizationCounts[loc] = (localizationCounts[loc] || 0) + 1;
        }
    });

    // Prepare data for plotting
    const labels = Object.keys(localizationCounts);
    const values = Object.values(localizationCounts);

    // Get selected plot type
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;

    // Clear previous plots
    document.getElementById('bubble-enrichment-container').style.display = 'none';
    document.getElementById('matrix-plot-container').style.display = 'none';
    document.getElementById('ciliome-plot-container').style.display = 'none';

    // Bubble plot
    if (plotType === 'bubble') {
        const ctx = document.getElementById('enrichment-bubble-plot').getContext('2d');
        if (window.enrichmentBubbleChart) window.enrichmentBubbleChart.destroy();

        const data = labels.map((label, i) => ({
            x: i + 1,
            y: values[i],
            r: Math.max(5, values[i] * 5),
        }));

        window.enrichmentBubbleChart = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Localization Enrichment',
                    data: data,
                    backgroundColor: '#66c2a4',
                }]
            },
            options: {
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${labels[context.dataIndex]}: ${values[context.dataIndex]} genes`;
                            }
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Localization Categories' } },
                    y: { title: { display: true, text: 'Gene Count' } }
                }
            }
        });

        document.getElementById('bubble-enrichment-container').style.display = 'flex';
    }

    // Matrix plot (simple table)
    else if (plotType === 'matrix') {
        const container = document.getElementById('matrix-plot-container');
        container.innerHTML = `<table style="width:100%; border-collapse: collapse;">
            <tr>
                <th style="border:1px solid #ccc; padding:5px;">Localization</th>
                <th style="border:1px solid #ccc; padding:5px;">Gene Count</th>
            </tr>
            ${labels.map((loc, i) => `
                <tr>
                    <td style="border:1px solid #ccc; padding:5px;">${loc}</td>
                    <td style="border:1px solid #ccc; padding:5px;">${values[i]}</td>
                </tr>`).join('')}
        </table>`;
        container.style.display = 'block';
    }

    // Ciliome enrichment summary
    else if (plotType === 'ciliome') {
        const container = document.getElementById('ciliome-plot-container');
        const enrichedGenes = geneObjects.filter(g => g.localization && g.localization.length > 0);
        container.innerHTML = `<p>${enrichedGenes.length} of ${geneObjects.length} genes are known ciliary genes.</p>`;
        container.style.display = 'block';
    }

    plotContainer.style.display = 'block';
    statusDiv.style.display = 'none';
}


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
                padding: {
                    left: 0,
                    right: 10,
                    top: 20,
                    bottom: 20
                }
            },
            plugins: {
                legend: {
                    display: false
                },
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
                        text: settings.xAxisTitle, // ✅ X-axis title is now customizable
                        color: settings.axisColor,
                        font: { // ✅ Axis title size is now customizable
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        }
                    },
                    ticks: {
                        display: false
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'category',
                    labels: categoriesWithData,
                    title: {
                        display: true,
                        text: settings.yAxisTitle,
                        color: settings.axisColor,
                        font: { // ✅ Axis title size is now customizable
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        }
                    },
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: { // ✅ Axis tick size is now customizable
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
            return matchingCategory ? {
                x: gene.gene,
                y: matchingCategory,
                r: 10
            } : null;
        }).filter(Boolean),
        backgroundColor: colorPalette[index % colorPalette.length]
    }));

    const ctx = document.getElementById('enrichment-matrix-plot').getContext('2d');

    window.enrichmentBarChartInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets
        },
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
                        text: settings.xAxisTitle, // ✅ X-axis title is now customizable
                        font: { // ✅ Axis title size is now customizable
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: 'bold'
                        },
                        color: settings.axisColor
                    },
                    ticks: {
                        font: { // ✅ Axis tick size is now customizable
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        },
                        autoSkip: false,
                        maxRotation: 90,
                        minRotation: 45,
                        color: settings.textColor
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'category',
                    labels: yCategories,
                    title: {
                        display: true,
                        text: 'Ciliary Localization',
                        font: { // ✅ Axis title size is now customizable
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: 'bold'
                        },
                        color: settings.axisColor
                    },
                    ticks: {
                        font: { // ✅ Axis tick size is now customizable
                            family: settings.fontFamily,
                            size: settings.fontSize,
                            weight: settings.fontWeight
                        },
                        color: settings.textColor
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderCiliomeEnrichment(foundGenes, notFoundGenes) {
    document.getElementById('ciliome-plot-container').style.display = 'block';

    if (window.ciliomeChartInstance) {
        window.ciliomeChartInstance.destroy();
    }

    const k = foundGenes.length;
    const n_input = k + notFoundGenes.length;
    const M = window.allGenes ? window.allGenes.length : 2000;
    const N = 20000;

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

    // ✅ Requirement: Standardize plot size to match Gene Matrix plot
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
                        text: settings.xAxisTitle, // ✅ X-axis title is now customizable
                        font: { // ✅ Axis title size is now customizable
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
                    ticks: { // ✅ Axis tick size is now customizable
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
    
    const scale = 4;
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;

    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
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
