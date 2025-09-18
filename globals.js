// globals.js
// =============================================================================
// GLOBAL VARIABLES
// =============================================================================
let allGenes = [
    { gene: 'IFT88', localization: 'Axoneme;Basal Body', screens: [{ dataset: 'Screen1', mean_percent_ciliated: 75.5, z_score: -1.2, classification: 'Positive', paper_link: 'https://example.com/paper1' }], synonym: 'TTC10;TG737', description: 'Intraflagellar transport protein 88.', functional_summary: 'Involved in ciliary assembly.', reference: '12345678', ensembl_id: 'ENSG00000032742', omim_id: '600577', string_link: 'https://string-db.org/network/9606.ENSP00000323580', protein_atlas_link: 'https://www.proteinatlas.org/ENSG00000032742-IFT88', functional_category: 'Transport;Structural', ciliopathy: 'NPHP;JBTS', domain_descriptions: 'TPR_1;TPR_2', complex_names: 'IFT-B complex' },
    { gene: 'ACE2', localization: 'Ciliary Membrane', screens: [], synonym: '', description: 'Angiotensin-converting enzyme 2.', functional_summary: 'Receptor for SARS-CoV-2.', reference: '', ensembl_id: '', omim_id: '', string_link: '', protein_atlas_link: '', functional_category: 'Receptor', ciliopathy: '', domain_descriptions: '', complex_names: '' },
    { gene: 'CEP290', localization: 'Transition Zone', screens: [], synonym: '', description: 'Centrosomal protein 290.', functional_summary: 'Ciliary gatekeeper.', reference: '', ensembl_id: '', omim_id: '', string_link: '', protein_atlas_link: '', functional_category: 'Structural', ciliopathy: 'JBTS', domain_descriptions: '', complex_names: '' },
    { gene: 'BBS1', localization: 'Basal Body', screens: [], synonym: '', description: 'Bardet-Biedl syndrome 1 protein.', functional_summary: 'Ciliary transport.', reference: '', ensembl_id: '', omim_id: '', string_link: '', protein_atlas_link: '', functional_category: 'Transport', ciliopathy: 'BBS', domain_descriptions: '', complex_names: 'BBSome' }
];
let currentData = [];
let searchResults = [];
const geneLocalizationData = {};
let currentPlotInstance = null;

const allPartIds = [
    "cell-body", "nucleus", "basal-body",
    "transition-zone", "axoneme", "ciliary-membrane"
];
const defaultGenesNames = [
    "ACE2", "ADAMTS20", "ADAMTS9", "IFT88",
    "CEP290", "WDR31", "ARL13B", "BBS1"
];

let geneDataCache = null;
let geneMapCache = new Map(allGenes.map(g => [g.gene.toLowerCase(), g]));

async function loadAndPrepareDatabase() {
    // Mock implementation (replace with actual DB loading if needed)
    if (!geneMapCache) {
        geneMapCache = new Map(allGenes.map(g => [g.gene.toLowerCase(), g]));
    }
    return Promise.resolve();
}

function sanitize(str) {
    return str ? str.toString().trim().toLowerCase() : '';
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================
function initGlobalEventListeners() {
    window.addEventListener('scroll', handleStickySearch);
    document.querySelectorAll('.cilia-part').forEach(part => {
        part.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                part.classList.toggle('highlighted');
            }
        });
    });

    const ciliaSvg = document.querySelector('.interactive-cilium svg');
    if (ciliaSvg) {
        Panzoom(ciliaSvg, {
            maxZoom: 3,
            minZoom: 0.5,
            contain: 'outside'
        });
        ciliaSvg.parentElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            const panzoom = Panzoom(ciliaSvg);
            panzoom.zoom(panzoom.getScale() * (e.deltaY > 0 ? 0.9 : 1.1));
        });
    }
}

window.addEventListener("load", handleRouteChange);
window.addEventListener("hashchange", handleRouteChange);
document.addEventListener('DOMContentLoaded', initGlobalEventListeners);
