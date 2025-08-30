// =============================================================================
// plots.js - All functions for the Analysis Page visualizations
// =============================================================================

function getPlotSettings() {
    return {
        fontFamily: document.getElementById('setting-font-family')?.value || 'Arial',
        fontSize: parseInt(document.getElementById('setting-font-size')?.value, 10) || 12,
        fontWeight: document.getElementById('setting-font-weight')?.value || 'bold',
    };
}

function generateAnalysisPlots() {
    ['bubble-enrichment-container', 'matrix-plot-container', 'upset-plot-container'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    document.getElementById('download-plot-btn').style.display = 'none';
    const statusDiv = document.getElementById('analysis-status');
    if (statusDiv) statusDiv.style.display = 'none';

    const input = document.getElementById('analysis-genes-input').value || '';
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
    if (window.analysisDotPlotInstance) window.analysisDotPlotInstance.destroy();
    
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
    const colorPalette = ['#edf8fb', '#b2e2e2', '#66c2a4', '#2ca25f', '#006d2c'];
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
            <div style="font-family: ${settings.fontFamily};">
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
    
    const ctx = document.getElementById('analysis-bubble-plot').getContext('2d');
    window.analysisDotPlotInstance = new Chart(ctx, {
        type: 'bubble', data: { datasets: [dataset] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.raw.y}: ${c.raw.count} gene(s)` } }
            },
            scales: {
                x: { display: false },
                y: {
                    type: 'category', labels: categoriesWithData,
                    grid: { display: false, drawBorder: false },
                    ticks: { font: { size: settings.fontSize, weight: settings.fontWeight, family: settings.fontFamily } }
                }
            }
        }
    });
}

function renderBubbleMatrix(foundGenes) {
    document.getElementById('matrix-plot-container').style.display = 'block';
    if (window.analysisBarChartInstance) window.analysisBarChartInstance.destroy();

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

    const ctx = document.getElementById('analysis-matrix-plot').getContext('2d');
    window.analysisBarChartInstance = new Chart(ctx, {
        type: 'bubble', data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'right', labels: { font: { family: settings.fontFamily, size: settings.fontSize } } },
                tooltip: { callbacks: { label: (context) => `${context.dataset.label} - ${context.raw.y}` } },
            },
            scales: {
                x: {
                    type: 'category', labels: xLabels,
                    title: { display: true, text: 'Genes', font: { family: settings.fontFamily, size: 16, weight: 'bold' } },
                    ticks: { font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight }, autoSkip: false, maxRotation: 90, minRotation: 45 },
                },
                y: {
                    type: 'category', labels: yCategories,
                    title: { display: true, text: 'Ciliary Localization', font: { family: settings.fontFamily, size: 16, weight: 'bold' } },
                    ticks: { font: { family: settings.fontFamily, size: settings.fontSize, weight: settings.fontWeight } },
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
                sets.push({ name: gene.gene, sets: localizations });
                localizations.forEach(loc => uniqueLocalizations.add(loc));
            }
        }
    });

    if (sets.length === 0) return;

    const setDefinitions = Array.from(uniqueLocalizations).map(name => ({ name, elems: [] }));
    sets.forEach(elem => { setDefinitions.forEach(set => { if (elem.sets.includes(set.name)) set.elems.push(elem.name); }); });

    if (typeof UpsetJS !== 'undefined') {
        const upset = UpsetJS.fromExpression(setDefinitions);
        UpsetJS.render(wrapper, upset);
    } else {
        wrapper.innerHTML = '<p class="error-message">Upset.js library is not loaded. Please check index.html.</p>';
    }
}

function downloadPlot() {
    const selectedPlot = document.querySelector('input[name="plot-type"]:checked').value;
    let canvas, fileName, chartInstance;

    if (selectedPlot === 'bubble') {
        chartInstance = window.analysisDotPlotInstance;
        fileName = 'CiliaHub_Enrichment_Plot.png';
        
        // Temporarily create a larger canvas to draw both the chart and the legend
        const mainCanvas = chartInstance.canvas;
        const legendContainer = document.getElementById('legend-container');
        const legendWidth = 150;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = mainCanvas.width + legendWidth + 20; // Add padding
        tempCanvas.height = mainCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(mainCanvas, 0, 0);

        // This is a simplified approach; a library like html2canvas would be more robust for drawing HTML
        // For now, we will just download the plot itself as requested.
        const a = document.createElement('a');
        a.href = mainCanvas.toDataURL('image/png', 1.0);
        a.download = fileName;
        a.click();
        
    } else if (selectedPlot === 'matrix') {
        chartInstance = window.analysisBarChartInstance;
        fileName = 'CiliaHub_Matrix_Plot.png';
        const a = document.createElement('a');
        chartInstance.options.plugins.customCanvasBackgroundColor = { color: 'white' };
        chartInstance.update('none');
        a.href = chartInstance.toBase64Image('image/png', 1.0);
        delete chartInstance.options.plugins.customCanvasBackgroundColor;
        chartInstance.update('none');
        a.download = fileName;
        a.click();

    } else if (selectedPlot === 'upset') {
        const svgElement = document.querySelector('#upset-plot-wrapper svg');
        if (!svgElement) { alert("Could not find the Upset plot to download."); return; }
        
        const svgClone = svgElement.cloneNode(true);
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgClone);
        if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        const blob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'CiliaHub_Upset_Plot.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
