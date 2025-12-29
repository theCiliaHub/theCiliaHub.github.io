/* ==============================================================
 * CiliAI Visualization Module - Plotly, SVG Rendering
 * ============================================================== */

// UMAP Plot Rendering
window.renderUMAPPlot = async function(displayName, targetGenes = [], zoomToCellType = null) {
    if (typeof window.switchView === 'function') window.switchView('plot');
    
    const container = document.getElementById('plotly-container');
    if (!container) return;

    const dataset = window.CiliAI.datasets[window.CiliAI.activeDataset] || window.CiliAI.datasets.lung;
    const gene = displayName.toUpperCase();
    
    const x = [], y = [], color = [], text = [], customdata = [];
    const sourceData = dataset.umap || [];
    
    let exprData = dataset.expression ? dataset.expression[gene] : window.CiliAI.cellDataCache[gene];
    
    sourceData.forEach((p, i) => {
        x.push(p.x); y.push(p.y);
        let val = 0;
        if (exprData) {
            if (Array.isArray(exprData)) { // Sparse index format
                const valIdx = exprData.indexOf(i);
                if (valIdx !== -1) val = exprData[valIdx + 1];
            } else { // Dictionary format
                val = exprData[p.cell_type] || 0;
            }
        }
        color.push(val);
        text.push(`<b>${p.cell_type}</b><br>Expr: ${val.toFixed(2)}`);
        customdata.push({ localization: 'Cilium' });
    });

    const trace = {
        x, y, text, customdata,
        mode: 'markers', type: 'scattergl',
        marker: { size: 6, color, colorscale: dataset.colorScale, showscale: true }
    };

    const layout = {
        title: `${gene} Expression (${dataset.name})`,
        xaxis: { visible: false }, yaxis: { visible: false },
        margin: { t: 40, b: 20, l: 20, r: 20 },
        hovermode: 'closest'
    };

    // Add cell type annotations if zoomToCellType is specified
    if (zoomToCellType) {
        const bounds = window.getClusterBoundaries(zoomToCellType);
        if (bounds) {
            layout.xaxis = { range: [bounds.xMin, bounds.xMax], visible: true };
            layout.yaxis = { range: [bounds.yMin, bounds.yMax], visible: true };
            
            // Add annotation for the cell type
            layout.annotations = [{
                x: bounds.center.x,
                y: bounds.center.y,
                text: zoomToCellType,
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowwidth: 2,
                arrowcolor: '#2b6cb0',
                ax: 0,
                ay: -30,
                bgcolor: 'white',
                bordercolor: '#2b6cb0',
                borderwidth: 1,
                borderpad: 4,
                font: { size: 12, color: '#2b6cb0' }
            }];
        }
    }

    // ✅ FIXED: Using .then() to ensure gd is ready before calling .on()
    Plotly.newPlot(container, [trace], layout, { responsive: true }).then(gd => {
        if (!gd || typeof gd.on !== 'function') {
            console.error("Plotly instance not ready for events.");
            return;
        }
        window.CiliAI.currentPlot = gd;
        gd.on('plotly_click', d => {
            const loc = d.points[0].customdata?.localization;
            if (loc && window.highlightCiliumLocation) {
                window.switchView('diagram');
                window.highlightCiliumLocation(loc, gene);
            }
        });
    });
};

// Domain Viewer
window.showDomainViewer = function(gene) {
    document.getElementById('cilia-svg').style.display = 'none';
    document.getElementById('plotly-container').style.display = 'none';
    const domainContainer = document.getElementById('domain-viewer');
    domainContainer.style.display = 'flex';
    domainContainer.innerHTML = '';
    document.getElementById('current-viz-title').textContent = `Pfam Domains: ${gene}`;
    const pfamLookup = window.CiliAI.lookups.pfamByGene || {};
    let pfam = pfamLookup[gene.toUpperCase()] || [];
    
    if (!pfam.length) {
        const geneData = window.CiliAI.lookups.geneMap[gene.toUpperCase()];
        if (geneData && (geneData.PFAM_IDs || geneData.Domain_Descriptions)) {
            const desc = geneData.Domain_Descriptions || geneData.PFAM_IDs || "";
            const parts = desc.split(/[;,]/).filter(s => s.trim().length > 0);
            if (parts.length > 0) {
                const domains = parts.map((part, i) => ({
                    id: `DOM_${i+1}`,
                    name: part.trim(),
                    start: (i * 200) + 50,
                    end: (i * 200) + 150
                }));
                window.CiliAI.lookups.pfamByGene[gene.toUpperCase()] = domains;
                window.showDomainViewer(gene);
                return;
            }
        }
        domainContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No Pfam domain data available for this gene.</div>';
        return;
    }
    
    const seqLength = Math.max(...pfam.map(d => d.end), 1000);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${seqLength + 100} 150`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '50');
    line.setAttribute('y1', '75');
    line.setAttribute('x2', seqLength + 50);
    line.setAttribute('y2', '75');
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '4');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
    
    pfam.forEach((domain, index) => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const width = domain.end - domain.start + 1;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', domain.start + 50);
        rect.setAttribute('y', '55');
        rect.setAttribute('width', width);
        rect.setAttribute('height', '40');
        rect.setAttribute('rx', '8');
        rect.setAttribute('fill', `hsl(${index * 50 + 200}, 80%, 60%)`);
        rect.setAttribute('stroke', '#fff');
        rect.setAttribute('stroke-width', '2');
        rect.classList.add('domain-rect');
        
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${domain.name || domain.id} (${domain.start}-${domain.end})`;
        rect.appendChild(title);
        group.appendChild(rect);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', domain.start + 50 + width / 2);
        text.setAttribute('y', '45');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#333');
        text.textContent = domain.name || domain.id;
        group.appendChild(text);
        
        svg.appendChild(group);
    });
    
    domainContainer.appendChild(svg);
};

// Generate and inject SVG diagram
window.generateAndInjectSVG = function() {
    const container = document.getElementById('cilia-svg');
    if (!container) return;

    document.getElementById('current-viz-title').textContent = "Diagram: Spatial Intelligence";

    container.innerHTML = `
        <svg id="cilia-diagram" viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%;">
            <defs>
                <linearGradient id="cytosolGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#F8FAFC;" />
                    <stop offset="100%" style="stop-color:#F1F5F9;" />
                </linearGradient>
                <radialGradient id="nucleusGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style="stop-color:#E2E8F0;" />
                    <stop offset="100%" style="stop-color:#CBD5E1;" />
                </radialGradient>
                <linearGradient id="pcm1Gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#5b21b6;" />
                    <stop offset="100%" style="stop-color:#4c1d95;" />
                </linearGradient>
                <linearGradient id="tmem17Gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#475569;" />
                    <stop offset="100%" style="stop-color:#334155;" />
                </linearGradient>
                <linearGradient id="arl13bGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#0891b2;" />
                    <stop offset="100%" style="stop-color:#0e7490;" />
                </linearGradient>
                <linearGradient id="tubulinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#2563eb;" />
                    <stop offset="100%" style="stop-color:#1d4ed8;" />
                </linearGradient>
                <linearGradient id="heatmapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#00ff00" stop-opacity="0.2" />
                    <stop offset="50%" stop-color="#ffff00" stop-opacity="0.5" />
                    <stop offset="100%" stop-color="#ff0000" stop-opacity="0.8" />
                </linearGradient>
            </defs>

            <g id="viewport-group" transform="translate(0, 0)">
                <!-- Cell Body -->
                <path id="cell-body" class="cilia-part" tabindex="0" fill="url(#cytosolGradient)" stroke="#E2E8F0" stroke-width="2"
                      d="M 40,350 C -30,270 10,170 140,170 C 270,170 310,270 240,350 Z">
                    <title>Cell Body / Cytosol – Main cytoplasmic compartment</title>
                </path>

                <!-- Nucleus -->
                <circle id="nucleus" class="cilia-part" tabindex="0" fill="url(#nucleusGradient)" stroke="#CBD5E1" stroke-width="2"
                        cx="140" cy="290" r="35">
                    <title>Nucleus – Contains genomic DNA</title>
                </circle>

                <!-- Basal Body -->
                <rect id="basal-body" class="cilia-part" tabindex="0" fill="url(#pcm1Gradient)" stroke="#5b21b6" stroke-width="1.5"
                      x="130" y="165" width="20" height="15" rx="2">
                    <title>Basal Body – Anchors cilium; example: PCM1</title>
                </rect>

                <!-- Transition Zone -->
                <path id="transition-zone" class="cilia-part" tabindex="0" fill="url(#tmem17Gradient)" stroke="#475569" stroke-width="1.5"
                      d="M 132,165 L 128,150 L 152,150 L 148,165 Z">
                    <title>Transition Zone – Ciliary gate; example: TMEM17, CEP290</title>
                </path>

                <!-- Ciliary Membrane -->
                <path id="ciliary-membrane" class="cilia-part" tabindex="0" fill="none" stroke="url(#arl13bGradient)" stroke-width="2.5" stroke-dasharray="4,4"
                      d="M 128,150 L 135,30 L 145,30 L 152,150 Z">
                    <title>Ciliary Membrane – Lipid barrier; example: ARL13B</title>
                </path>

                <!-- Axoneme -->
                <path id="axoneme" class="cilia-part" tabindex="0" fill="none" stroke="url(#tubulinGradient)" stroke-width="2.5"
                      d="M 135,150 L 138,35 L 142,35 L 145,150 Z">
                    <title>Axoneme – Microtubule core; example: β-tubulin, IFT proteins</title>
                </path>

                <!-- Animated Protein Labels with Pulsing Dots -->
                <g class="cilia-labels" style="pointer-events: none; opacity: 0; transition: opacity 0.4s ease;">
                    <text x="140" y="188" text-anchor="middle" font-size="12" font-weight="700" fill="#5b21b6">PCM1</text>
                    <text x="140" y="158" text-anchor="middle" font-size="12" font-weight="700" fill="#475569">TMEM17</text>
                    <text x="140" y="85" text-anchor="middle" font-size="12" font-weight="700" fill="#0891b2">ARL13B</text>
                    <text x="140" y="45" text-anchor="middle" font-size="12" font-weight="700" fill="#2563eb">β-tubulin</text>
                </g>

                <!-- Pulsing Dots -->
                <circle cx="140" cy="172.5" r="4" fill="#5b21b6" opacity="0.7">
                    <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.7;0.4;0.7" dur="2s" repeatCount="indefinite"/>
                </circle>
                <circle cx="140" cy="157.5" r="4" fill="#475569" opacity="0.7">
                    <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" begin="0.3s"/>
                </circle>
                <circle cx="140" cy="90" r="4" fill="#0891b2" opacity="0.7">
                    <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" begin="0.6s"/>
                </circle>
                <circle cx="140" cy="42.5" r="4" fill="#2563eb" opacity="0.7">
                    <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" begin="0.9s"/>
                </circle>
            </g>

            <!-- Legend (initially hidden) -->
            <g id="overlay-legend" style="display:none; font-size:11px;">
                <rect x="10" y="10" width="180" height="80" fill="white" stroke="#ccc" rx="8" opacity="0.9"/>
                <text x="20" y="25" font-weight="bold">Overlay Legend</text>
                <g transform="translate(20,40)">
                    <rect width="15" height="15" fill="#ff0000"/>
                    <text x="20" y="12">Gene 1</text>
                </g>
                <g transform="translate(20,60)">
                    <rect width="15" height="15" fill="#00ff00"/>
                    <text x="20" y="12">Gene 2</text>
                </g>
            </g>
        </svg>
    `;

    // Hover to show labels
    container.onmouseenter = () => {
        const labels = container.querySelector('.cilia-labels');
        if (labels) labels.style.opacity = '1';
    };
    
    container.onmouseleave = () => {
        const labels = container.querySelector('.cilia-labels');
        if (labels) labels.style.opacity = '0';
    };

    // Click handlers
    container.querySelectorAll('.cilia-part').forEach(part => {
        part.style.cursor = 'pointer';
        part.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('active-highlight'));
            part.classList.add('active-highlight');
            if (window.SpatialManager) window.SpatialManager.zoomTo(part);
        });
    });

    // Background click to reset
    container.addEventListener('click', (e) => {
        if (e.target === container || e.target.tagName === 'svg') {
            if (window.SpatialManager) window.SpatialManager.resetZoom();
        }
    });
};

// View management functions
window.resetViews = function() {
    // Hide all alternative views
    document.getElementById('plotly-container').style.display = 'none';
    document.getElementById('domain-viewer').style.display = 'none';

    // Always re-inject the full interactive SVG to ensure it's present and clean
    window.generateAndInjectSVG();

    // Ensure cilia-svg is visible
    const ciliaSvg = document.getElementById('cilia-svg');
    if (ciliaSvg) {
        ciliaSvg.style.display = 'flex';
        // Remove any table mode class
        ciliaSvg.classList.remove('table-view-active');
    }

    // Update title
    document.getElementById('current-viz-title').textContent = "Diagram: Spatial Intelligence";

    // Clear any overlays (heatmaps, multi-gene)
    if (window.SpatialManager && typeof window.SpatialManager.clearOverlays === 'function') {
        window.SpatialManager.clearOverlays();
    }

    // Reset zoom/state
    if (window.SpatialManager && typeof window.SpatialManager.resetZoom === 'function') {
        window.SpatialManager.resetZoom();
    }
};

window.showDiagram = function() {
    document.getElementById('plotly-container').style.display = 'none';
    document.getElementById('domain-viewer').style.display = 'none';
    document.getElementById('cilia-svg').style.display = 'flex';
    document.getElementById('current-viz-title').textContent = "Diagram: Spatial Intelligence";
    if (window.CiliAI) window.CiliAI.currentPlot = null;
};

window.showPlot = function(plotData, title = "Gene Expression UMAP") {
    document.getElementById('cilia-svg').style.display = 'none';
    document.getElementById('domain-viewer').style.display = 'none';
    const plotContainer = document.getElementById('plotly-container');
    plotContainer.style.display = 'block';
    document.getElementById('current-viz-title').textContent = title;
    plotContainer.innerHTML = '';
    const vizCard = document.querySelector('.viz-card');
    const vizHeader = document.querySelector('.viz-header');
    const availableHeight = (vizCard && vizHeader) ? (vizCard.clientHeight - vizHeader.clientHeight - 40) : 500;
    const availableWidth = vizCard ? (vizCard.clientWidth - 40) : 600;
    const layout = {
        ...plotData.layout,
        autosize: true,
        width: availableWidth,
        height: availableHeight,
        margin: { l: 60, r: 30, b: 60, t: 50, pad: 10 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        xaxis: { ...plotData.layout?.xaxis, automargin: true, tickfont: { size: 10 } },
        yaxis: { ...plotData.layout?.yaxis, automargin: true, tickfont: { size: 10 } },
        font: { size: 11 },
        showlegend: true,
        legend: { x: 1.02, y: 1, xanchor: 'left', yanchor: 'top', bgcolor: 'rgba(255,255,255,0.8)', bordercolor: '#e1e8ed', borderwidth: 1, font: { size: 10 } }
    };
    
    Plotly.newPlot('plotly-container', plotData.data, layout, {
        responsive: true, displayModeBar: true, displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toggleSpikelines'],
        scrollZoom: false
    }).then(gd => {
        if (window.CiliAI) window.CiliAI.currentPlot = gd;
        gd.on('plotly_click', e => {
            const loc = e.points?.[0]?.customdata?.localization;
            if (!loc) return;
            window.showDiagram();
            if (window.SpatialManager) SpatialManager.highlight(loc, window.CiliAI?.activeGeneContext);
        });
    });
    
    window.addEventListener('resize', () => {
        const container = document.getElementById('plotly-container');
        if (window.CiliAI?.currentPlot && container && container.offsetParent !== null) {
            setTimeout(() => Plotly.Plots.resize(window.CiliAI.currentPlot), 50);
        }
    });
};

// Cluster boundary calculation
window.getClusterBoundaries = function(cellType) {
    const umapData = window.CiliAI_UMAP;
    if (!umapData) return null;

    const targetPoints = umapData.filter(d => d.cell_type.toLowerCase() === cellType.toLowerCase());

    if (targetPoints.length === 0) {
        window.log(`[UMAP] No points found for cell type: ${cellType}`);
        return null;
    }

    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    let sumX = 0;
    let sumY = 0;

    targetPoints.forEach(p => {
        xMin = Math.min(xMin, p.x);
        xMax = Math.max(xMax, p.x);
        yMin = Math.min(yMin, p.y);
        yMax = Math.max(yMax, p.y);
        sumX += p.x;
        sumY += p.y;
    });

    // Add a small buffer to the bounds for better visualization padding
    const buffer = 0.5;

    return {
        xMin: xMin - buffer,
        xMax: xMax + buffer,
        yMin: yMin - buffer,
        yMax: yMax + buffer,
        center: {
            x: sumX / targetPoints.length,
            y: sumY / targetPoints.length
        }
    };
};

// Median function
window.median = function (arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Download visualization
window.downloadCurrentVisualization = function() {
    if (window.CiliAI?.currentPlot) {
        Plotly.downloadImage(window.CiliAI.currentPlot, { format: 'png', filename: 'ciliai-umap-plot', width: 1200, height: 800, scale: 2 });
    } else if (document.getElementById('domain-viewer').style.display !== 'none') {
        const svgElement = document.getElementById('domain-viewer').querySelector('svg');
        if (svgElement) {
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgData], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ciliai-domain.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } else {
        const svgElement = document.getElementById('cilia-diagram');
        if (svgElement) {
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgData], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ciliai-diagram.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
};

// Download plot helper
window.downloadPlot = function (divId, filename) {
    const plotDiv = document.getElementById(divId);
    if (plotDiv && window.Plotly) {
        Plotly.downloadImage(plotDiv, {
            format: 'png',
            filename: filename,
            width: 1200,
            height: 800
        });
    }
};

// Dataset switching for UMAP
window.switchDatasetAndPlot = function(dataset, geneSymbol, geneListStr, zoom) {
    // Robustly handle gene list (array vs string)
    let geneList = geneListStr;
    if (typeof geneListStr === 'string') {
        geneList = geneListStr.split(',').filter(g => g);
    } else if (!Array.isArray(geneListStr)) {
        geneList = [geneSymbol];
    }

    window.CiliAI.activeDataset = dataset;
    window.renderUMAPPlot(geneSymbol, geneList, zoom || null);
    
    const label = dataset.charAt(0).toUpperCase() + dataset.slice(1);
    window.addChatMessage(`Switched to <strong>${label}</strong> dataset.`, false);
};

// UMAP data download
function downloadUMAPDataAsCSV(geneSymbol) {
    const gene = geneSymbol.toUpperCase();
    const cellData = window.CiliAI.cellDataCache;
    const umapData = window.CiliAI_UMAP;
    
    if (!umapData || !cellData) {
        window.addChatMessage('Error: UMAP data is not available for export.', false);
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Gene,UMAP_1,UMAP_2,Cell_Type,Expression_TPM\r\n`;

    const geneExpressionData = cellData[gene] || {};

    umapData.forEach(point => {
        const expr = geneExpressionData[point.cell_type] || 0;
        const row = [
            `"${gene}"`,
            point.x.toFixed(4),
            point.y.toFixed(4),
            `"${point.cell_type}"`,
            expr.toFixed(4)
        ].join(',');
        csvContent += row + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const filename = `${gene}_UMAP_Data.csv`;
    
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.addChatMessage(`Downloaded UMAP data for <strong>${gene}</strong> as ${filename}.`, false);
}

// Export to global scope
window.downloadUMAPDataAsCSV = downloadUMAPDataAsCSV;
