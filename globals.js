// ======== Globals ========
let geneDataCache = null;
let geneMapCache = null;
let allGenes = [];
let geneLocalizationData = {};
let currentData = [];

// Utility to sanitize strings for map keys
function sanitize(str) {
    return str ? str.toLowerCase().trim() : '';
}

// ======== Database Loader ========
async function loadAndPrepareDatabase() {
    if (geneDataCache) return true;
    try {
        const resp = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const rawGenes = await resp.json();

        if (!Array.isArray(rawGenes)) throw new Error('Invalid data format: expected array');

        geneDataCache = rawGenes;
        allGenes = rawGenes;
        geneMapCache = new Map();

        allGenes.forEach(g => {
            if (!g.gene || typeof g.gene !== 'string') {
                console.warn('Skipping entry with invalid gene name:', g);
                return;
            }

            // 1. Index by the primary gene name
            const nameKey = sanitize(g.gene);
            if (nameKey) geneMapCache.set(nameKey, g);

            // 2. Index by all synonyms (handles comma or semicolon separators)
            if (g.synonym) {
                String(g.synonym).split(/[,;]/).forEach(syn => {
                    const key = sanitize(syn);
                    if (key && !geneMapCache.has(key)) geneMapCache.set(key, g);
                });
            }

            // 3. Index by all Ensembl IDs (handles comma or semicolon separators)
            if (g.ensembl_id) {
                String(g.ensembl_id).split(/[,;]/).forEach(id => {
                    const key = sanitize(id);
                    if (key) geneMapCache.set(key, g);
                });
            }

            // 4. Prepare localization data for SVG mapping
            if (g.localization) {
                const validCiliaryLocalizations = [
                    'transition zone', 'cilia', 'basal body', 'axoneme', 'ciliary membrane',
                    'centrosome', 'autophagosomes', 'endoplasmic reticulum', 'flagella',
                    'golgi apparatus', 'lysosome', 'microbody', 'microtubules',
                    'mitochondrion', 'nucleus', 'peroxisome'
                ];
                let sanitizedLocalization = Array.isArray(g.localization) 
                    ? g.localization.map(loc => loc ? loc.trim().toLowerCase() : '').filter(loc => loc && validCiliaryLocalizations.includes(loc))
                    : (g.localization ? g.localization.split(/[,;]/).map(loc => loc ? loc.trim().toLowerCase() : '').filter(loc => loc && validCiliaryLocalizations.includes(loc)) : []);
                
                // Debug logging for ACTN2
                if (g.gene === 'ACTN2') {
                    console.log('ACTN2 Raw localization from JSON:', g.localization);
                    console.log('ACTN2 Sanitized localization before mapping:', sanitizedLocalization);
                }

                geneLocalizationData[g.gene] = mapLocalizationToSVG(sanitizedLocalization);

                // Additional debug for mapped output
                if (g.gene === 'ACTN2') {
                    console.log('ACTN2 Mapped localization from mapLocalizationToSVG:', geneLocalizationData[g.gene]);
                }
            }
        });

        console.log(`Loaded ${allGenes.length} genes into database`);
        return true;
    } catch (e) {
        console.error('Data load error:', e);
        allGenes = getDefaultGenes();
        currentData = allGenes;
        geneMapCache = new Map();
        allGenes.forEach(g => { if(g.gene) geneMapCache.set(sanitize(g.gene), g); });
        return false;
    }
}

// Placeholder for mapping localizations to SVG (replace with real implementation)
function mapLocalizationToSVG(locations) {
    return locations.map(loc => loc.toUpperCase());
}

// Fallback default genes
function getDefaultGenes() {
    return [];
}

// ======== Page Display Functions ========
function hideAllPages() {
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.style.display = 'none');
}

function displayHomePage() { hideAllPages(); document.querySelector('#home-page')?.style.display='block'; console.log('Home page'); }
function displayBatchQueryTool() { hideAllPages(); document.querySelector('#batch-query-page')?.style.display='block'; console.log('Batch query page'); }
function displayCiliaPlotPage() { hideAllPages(); document.querySelector('#ciliaplot-page')?.style.display='block'; console.log('Cilia Plot page'); }
function displayComparePage() { hideAllPages(); document.querySelector('#compare-page')?.style.display='block'; console.log('Compare page'); }
function displayExpressionPage() { hideAllPages(); document.querySelector('#expression-page')?.style.display='block'; console.log('Expression page'); }
function displayDownloadPage() { hideAllPages(); document.querySelector('#download-page')?.style.display='block'; console.log('Download page'); }
function displayContactPage() { hideAllPages(); document.querySelector('#contact-page')?.style.display='block'; console.log('Contact page'); }
function displayIndividualGenePage(gene) { hideAllPages(); document.querySelector('#gene-page')?.style.display='block'; console.log('Gene page:', gene.gene); }
function displayNotFoundPage() { hideAllPages(); document.querySelector('#notfound-page')?.style.display='block'; console.log('Not Found page'); }

// ======== Routing ========
async function handleRouteChange() {
    let path = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    if (!path || path === '/' || path === '/index.html') path = '/';

    try { await loadAndPrepareDatabase(); } catch (err) { console.error("Database loading failed:", err); }

    let gene = null;
    if (geneMapCache) {
        const geneName = sanitize(path.split('/').pop().replace('.html', ''));
        gene = geneMapCache.get(geneName);
    }

    updateActiveNav(path);

    // Hide all pages
    const pages = ['#home-page','#batch-query-page','#ciliaplot-page','#compare-page','#expression-page','#download-page','#contact-page','#gene-page','#notfound-page'];
    pages.forEach(id => { const el=document.querySelector(id); if(el) el.style.display='none'; });

    switch (path) {
        case '/': displayHomePage(); break;
        case '/batch-query': displayBatchQueryTool(); break;
        case '/ciliaplot':
        case '/analysis': displayCiliaPlotPage(); break;
        case '/compare': displayComparePage(); break;
        case '/expression': displayExpressionPage(); break;
        case '/download': displayDownloadPage(); break;
        case '/contact': displayContactPage(); break;
        default: gene ? displayIndividualGenePage(gene) : displayNotFoundPage(); break;
    }
    console.log("Routing completed. Path:", path, "Gene:", gene ? gene.gene : "N/A");
}

// Placeholder for nav update
function updateActiveNav(path) {
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`nav a[href="#${path}"]`);
    if (activeLink) activeLink.classList.add('active');
}

// Listen to hash changes
window.addEventListener('hashchange', handleRouteChange);
window.addEventListener('load', handleRouteChange);
