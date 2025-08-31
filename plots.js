function getPlotSettings() {
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 20,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'bold',
        textColor: document.getElementById('setting-text-color')?.value || '#000000',
        axisColor: document.getElementById('setting-axis-color')?.value || '#000000',
        yAxisTitle: document.getElementById('setting-y-axis-title')?.value || 'Localization',
        enrichmentColors: [
            document.getElementById('setting-enrichment-color1')?.value || '#edf8fb',
            document.getElementById('setting-enrichment-color2')?.value || '#b2e2e2',
            document.getElementById('setting-enrichment-color3')?.value || '#66c2a4',
            document.getElementById('setting-enrichment-color4')?.value || '#2ca25f',
            document.getElementById('setting-enrichment-color5')?.value || '#006d2c'
        ]
    };
}

// RENAMED FUNCTION: generateAnalysisPlots() → generateEnrichmentPlots()
function generateEnrichmentPlots() {
    ['bubble-enrichment-container', 'matrix-plot-container', 'upset-plot-container'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    document.getElementById('download-plot-btn').style.display = 'none';
    
    // UPDATED ID: analysis-status → enrichment-status
    const statusDiv = document.getElementById('enrichment-status');
    if (statusDiv) statusDiv.style.display = 'none';

    // UPDATED ID: analysis-genes-input → enrichment-genes-input
    const input = document.getElementById('enrichment-genes-input').value || '';
    const geneNames = input.split(/[\s,;\n]+/).map(sanitize).filter(Boolean);
    if (geneNames.length === 0) return;

    const { foundGenes, notFoundGenes } = findGenes(geneNames);
    if (foundGenes.length === 0) {
        if(statusDiv) {
            statusDiv.innerHTML = `<span class="error-message">None of the entered genes were found. Not found: ${notFoundGenes.join(', ')}</span>`;
            statusDiv.style.display = 'block';
        }
        return;
    }
    
    document.getElementById('plot-container').style.display = 'block';
    
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    if (selectedPlot === 'bubble') {
        renderEnrichmentBubblePlot(foundGenes);
    } else if (selectedPlot === 'matrix') {
        renderBubbleMatrix(foundGenes);
    } else if (selectedPlot === 'upset') {
        renderUpsetPlot(foundGenes);
    }
    
    document.getElementById('download-plot-btn').style.display = 'inline-block';
}

function renderEnrichmentBubblePlot(foundGenes) {
    document.getElementById('bubble-enrichment-container').style.display = 'flex';
    
    // UPDATED VARIABLE NAME: analysisDotPlotInstance → enrichmentDotPlotInstance
    if (window.enrichmentDotPlotInstance) window.enrichmentDotPlotInstance.destroy();
    
    const settings = getPlotSettings();
    const yCategories = [ 'Cilia', 'Basal Body', 'Transition Zone', 'Axoneme', 'Ciliary Membrane', 'Lysosome', 'Peroxisome', 'Plasma Membrane', 'Cytoplasm', 'Nucleus', 'Endoplasmic Reticulum', 'Mitochondria', 'Ribosome', 'Golgi' ];
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
    if (categoriesWithData.length === 0) { return; }

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
        data: categoriesWithData.map(loc => ({ x: 0, y: loc, r: getRadius(localizationCounts[loc]), count: localizationCounts[loc] })),
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
    
    // UPDATED CANVAS ID: analysis-bubble-plot → enrichment-bubble-plot
    const ctx = document.getElementById('enrichment-bubble-plot').getContext('2d');
    
    // UPDATED VARIABLE NAME: analysisDotPlotInstance → enrichmentDotPlotInstance
    window.enrichmentDotPlotInstance = new Chart(ctx, {
        type: 'bubble', 
        data: { datasets: [dataset] },
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
                        text: 'Enrichment',
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
                    grid: { 
                        display: false, 
                        drawBorder: false 
                    },
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

function renderBubbleMatrix(foundGenes) {
    document.getElementById('matrix-plot-container').style.display = 'block';
    
    // UPDATED VARIABLE NAME: analysisBarChartInstance → enrichmentBarChartInstance
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

    // UPDATED CANVAS ID: analysis-matrix-plot → enrichment-matrix-plot
    const ctx = document.getElementById('enrichment-matrix-plot').getContext('2d');
    
    // UPDATED VARIABLE NAME: analysisBarChartInstance → enrichmentBarChartInstance
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
                        text: 'Genes', 
                        font: { 
                            family: settings.fontFamily, 
                            size: 16, 
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
                        font: { 
                            family: settings.fontFamily, 
                            size: 16, 
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
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderUpsetPlot(foundGenes) {
    document.getElementById('upset-plot-container').style.display = 'block';
    const wrapper = document.getElementById('upset-plot-wrapper');
    wrapper.innerHTML = '';
    
    const sets = [];
    const uniqueLocalizations = new Set();
    foundGenes.forEach(gene => {
        if (gene.localization) {
            const localizations = gene.localization.split(',').map(l => l.trim()).filter(l => l);
            if (localizations.length > 0) {
                sets.push({ name: gene.gene, elems: localizations });
                localizations.forEach(loc => uniqueLocalizations.add(loc));
            }
        }
    });

    if (sets.length === 0) {
        wrapper.innerHTML = '<p class="error-message">No valid localization data found for the provided genes.</p>';
        return;
    }

    const setDefinitions = Array.from(uniqueLocalizations).map(name => ({ name, elems: [] }));
    sets.forEach(elem => {
        setDefinitions.forEach(set => {
            if (elem.elems.includes(set.name)) set.elems.push(elem.name);
        });
    });

    try {
        window.UpSetJS.render(wrapper, {
            sets: setDefinitions,
            combinations: window.UpSetJS.generateIntersections(setDefinitions),
            width: 800,
            height: 400
        });
    } catch (error) {
        console.error('Error rendering Upset plot:', error);
        wrapper.innerHTML = '<p class="error-message">Failed to render Upset plot. Please try again or check console for details.</p>';
    }
}

function downloadPlot() {
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    const format = document.getElementById('download-format')?.value || 'png';
    let fileName;

    if (selectedPlot === 'bubble') {
        fileName = 'CiliaHub_Enrichment_Plot';
        const container = document.getElementById('bubble-enrichment-container');
        html2canvas(container, { backgroundColor: 'white', scale: 2 }).then(canvas => {
            if (format === 'png') {
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = `${fileName}.png`;
                a.click();
            } else if (format === 'pdf') {
                const pdf = new jspdf.jsPDF({
                    orientation: canvas.width > canvas.height ? 'l' : 'p',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`${fileName}.pdf`);
            }
        }).catch(error => {
            console.error('Error downloading plot:', error);
            alert('Failed to download the plot.');
        });
        
    } else if (selectedPlot === 'matrix') {
        // UPDATED VARIABLE NAME: analysisBarChartInstance → enrichmentBarChartInstance
        const chartInstance = window.enrichmentBarChartInstance;
        fileName = 'CiliaHub_Matrix_Plot';
        const canvas = chartInstance.canvas;
        if (format === 'png') {
            const a = document.createElement('a');
            a.href = chartInstance.toBase64Image('image/png', 1.0);
            a.download = `${fileName}.png`;
            a.click();
        } else if (format === 'pdf') {
            html2canvas(canvas, { backgroundColor: 'white', scale: 2 }).then(imgCanvas => {
                const pdf = new jspdf.jsPDF({
                    orientation: imgCanvas.width > imgCanvas.height ? 'l' : 'p',
                    unit: 'px',
                    format: [imgCanvas.width, imgCanvas.height]
                });
                pdf.addImage(imgCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgCanvas.width, imgCanvas.height);
                pdf.save(`${fileName}.pdf`);
            });
        }

    } else if (selectedPlot === 'upset') {
        const svgElement = document.querySelector('#upset-plot-wrapper svg');
        if (!svgElement) { 
            alert("Could not find the Upset plot to download."); 
            return; 
        }
        fileName = 'CiliaHub_Upset_Plot';
        const svgClone = svgElement.cloneNode(true);
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgClone);
        if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        if (format === 'svg') {
            const blob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (format === 'pdf') {
            html2canvas(svgElement, { backgroundColor: 'white', scale: 2 }).then(canvas => {
                const pdf = new jspdf.jsPDF({
                    orientation: canvas.width > canvas.height ? 'l' : 'p',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`${fileName}.pdf`);
            });
        }
    }
}
