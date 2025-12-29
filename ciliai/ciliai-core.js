/* ==============================================================
 * CiliAI – Unified Logic Engine (v7.5 – Robust Data Integration)
 * ============================================================== */

// Main CiliAI namespace
window.CiliAI = {
    // Core state
    activeDataset: 'lung',
    ready: false,
    currentPlot: null,
    activeGeneContext: null,
    lastQueryContext: { type: null, data: [], term: null },
    zoomStateByGene: {},
    
    // Data structures
    datasets: {
        lung: { 
            name: 'Human Lung Organoid', 
            umap: null, 
            colorScale: [[0, '#e2e8f0'], [0.1, '#fed7d7'], [1, '#c53030']] 
        },
        kidney: { 
            name: 'Human Kidney', 
            umap: null, 
            expression: null, 
            colorScale: [[0, '#F3F4F6'], [0.2, '#C4B5FD'], [0.5, '#8B5CF6'], [1, '#4C1D95']] 
        }
    },
    
    data: { umap: [] },
    masterData: [],
    
    // Lookup tables
    lookups: {
        geneMap: {},
        umapByGene: {},
        goMap: {},
        pfamByGene: {},
        byCiliopathy: {},
        byClassification: {},
        byModuleOrComplex: {},
        byModules: {},
        byLocalization: {},
        byCompartment: {},
        complexByGene: {}
    },
    
    // Caches
    cellDataCache: {},
    
    // Utility methods
    log: function(msg) { 
        console.log(`[CiliAI] ${msg}`); 
    },
    
    // Core initialization
    init: async function() {
        window.updateStatus('Loading databases...', 'loading');
        window.generateAndInjectSVG();
        
        const loaded = await window.loadCiliAIData();
        if (loaded) {
            window.addChatMessage("CiliAI ready! Try asking about genes, localization, or 'Multi: IFT88, FOXJ1'.", false);
            window.updateStatus(`Ready (${window.CiliAI.masterData.length} genes loaded)`, 'ready');
        } else {
            window.updateStatus('Load failed', 'error');
        }
    }
};

// Global Data Caches
window.rnaTissueExpressionData = {};
window.liPhylogenyCache = null;
window.neversPhylogenyCache = null;

// Constants
const DEFAULT_PHYLO_GENES = ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"];

// Organism panels for phylogeny
const NEVERS_CIL_PANEL = [
    "Homo sapiens", // Index 78
    "Mus musculus", // Index 81
    "Danio rerio", // Index 72
    "Xenopus tropicalis", // Index 73
    "Gallus gallus", // Index 76
    "Caenorhabditis elegans", // Index 86
    "Tetrahymena thermophila (strain SB210)", // Index 30
    "Chlamydomonas reinhardtii", // Index 10
    "Micromonas sp. (strain RCC299 / NOUM17)", // Index 12
    "Trypanosoma cruzi", // Index 5
    "Leishmania major", // Index 7
    "Giardia intestinalis (strain ATCC 50803 / WB clone C6)", // Index 1
    "Trichomonas vaginalis", // Index 0
    "Strongylocentrotus purpuratus", // Index 66
    "Ciona intestinalis", // Index 69
    "Physcomitrella patens subsp. patens", // Index 15
    "Paramecium tetraurelia", // Index 28
    "Volvox carteri", // Index 9
    "Amphimedon queenslandica", // Index 63
    "Monosiga brevicollis" // Index 60
];

const NEVERS_NCIL_PANEL = [
    "Saccharomyces cerevisiae (strain ATCC 204508 / S288c)",
    "Schizosacoscharomyces pombe (strain 972 / ATCC 24843)",
    "Cryptococcus neoformans var. neoformans serotype D (strain JEC21 / ATCC MYA-565)",
    "Ustilago maydis (strain 521 / FGSC 9021)",
    "Candida albicans (strain WO-1)",
    "Arabidopsis thaliana",
    "Brachypodium distachyon",
    "Sorghum bicolor",
    "Vitis vinifera",
    "Cryptosporidium parvum (strain Iowa II)",
    "Entamoeba histolytica",
    "Encephalitozoon cuniculi (strain GB-M1)"
];

// Li et al. 2014 organism panels
const CIL_ORG_FULL = [
    "H.sapiens", "M.musculus", "D.rerio", "X.tropicalis", "G.gallus",
    "C.elegans", "T.thermophila", "C.reinhardtii", "M.sp.RCC299",
    "T.cruzi", "L.major", "G.intestinalis", "T.vaginalis",
    "S.purpuratus", "C.intestinalis", "P.patens", "P.tetraurelia",
    "V.carteri", "A.queenslandica", "M.brevicollis"
];

const NCIL_ORG_FULL = [
    "S.cerevisiae", "S.pombe", "C.neoformans", "U.maydis",
    "C.albicans", "A.thaliana", "B.distachyon", "S.bicolor",
    "V.vinifera", "C.parvum", "E.histolytica", "E.cuniculi"
];

// Global utility functions
window.log = function (msg) { console.log(`[CiliAI] ${msg}`); };

window.addChatMessage = function (msg, isUser) { 
    const chatWindow = document.getElementById('messages');
    if (chatWindow) {
        const div = document.createElement('div');
        div.className = `ciliai-message ${isUser ? 'user' : 'assistant'}`;
        div.innerHTML = `<div class="message-wrapper"><div class="ciliai-message-content">${msg}</div></div>`;
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
};

function normalizeTerm(term) {
    if (typeof term !== 'string') return '';
    return term.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Ensure array helper
function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
}

// Search State Management
window.SearchState = {
    history: JSON.parse(localStorage.getItem('ciliai_search_history') || '[]'),
    saved: JSON.parse(localStorage.getItem('ciliai_saved_queries') || '[]'),
    
    addToHistory: function(query) {
        if (!query) return;
        this.history = this.history.filter(q => q !== query);
        this.history.unshift(query);
        if (this.history.length > 20) this.history.pop();
        localStorage.setItem('ciliai_search_history', JSON.stringify(this.history));
        this.renderHistory();
    },

    saveQuery: function(query) {
        if (!query || this.saved.includes(query)) return;
        this.saved.push(query);
        localStorage.setItem('ciliai_saved_queries', JSON.stringify(this.saved));
        this.renderSaved();
        alert('Search saved!');
    },

    renderHistory: function() {
        const container = document.getElementById('search-history-list');
        if (!container) return;
        container.innerHTML = this.history.map(q => 
            `<div class="history-item" onclick="window.setSearch('${q}')">🕒 ${q}</div>`
        ).join('');
    },

    renderSaved: function() {
        const container = document.getElementById('search-saved-list');
        if (!container) return;
        container.innerHTML = this.saved.map(q => 
            `<div class="history-item" onclick="window.setSearch('${q}')">⭐ ${q}</div>`
        ).join('');
    }
};

// Set search function
window.setSearch = function(val) {
    const input = document.getElementById('adv-search-input');
    if (input) {
        input.value = val;
        document.getElementById('adv-suggestions').style.display = 'none';
        window.runDashboardSearch();
    }
};

// Boolean search engine
window.executeBooleanSearch = function(queryStr, filters = {}) {
    if (!window.CiliAI.masterData) return [];

    let results = window.CiliAI.masterData;
    const q = queryStr.trim();

    // A. Text Search with Boolean Logic (AND, OR, NOT)
    if (q) {
        // 1. Handle NOT (Exclude)
        const notParts = q.split(/\s+NOT\s+/i);
        const positivePart = notParts[0];
        const negativeParts = notParts.slice(1);

        // Filter out negatives
        if (negativeParts.length > 0) {
            results = results.filter(gene => {
                const str = JSON.stringify(gene).toUpperCase();
                return !negativeParts.some(neg => str.includes(neg.trim().toUpperCase()));
            });
        }

        // 2. Handle OR (Union) within the positive part
        if (positivePart.includes(' OR ')) {
            const orTerms = positivePart.split(/\s+OR\s+/i).map(t => t.trim().toUpperCase());
            results = results.filter(gene => {
                const str = JSON.stringify(gene).toUpperCase();
                return orTerms.some(term => str.includes(term));
            });
        } 
        // 3. Handle AND (Intersection) - Default behavior for spaces if not OR
        else {
            const andTerms = positivePart.split(/\s+(?:AND\s+)?/i).map(t => t.trim().toUpperCase());
            results = results.filter(gene => {
                const str = JSON.stringify(gene).toUpperCase();
                return andTerms.every(term => str.includes(term));
            });
        }
    }

    // B. Apply Dropdown Filters
    
    // Localization
    if (filters.localization && filters.localization !== 'All') {
        results = results.filter(g => (g.Localization || '').includes(filters.localization));
    }

    // Ciliopathy
    if (filters.disease && filters.disease !== 'All') {
        results = results.filter(g => {
            const diseases = g.Ciliopathies || [];
            return JSON.stringify(diseases).includes(filters.disease);
        });
    }

    // C. Apply Expression Range Filter
    if (filters.minExpr > 0) {
        results = results.filter(g => {
            if (!g.expression || !g.expression.scRNA) return false;
            const vals = Object.values(g.expression.scRNA);
            const maxVal = Math.max(...vals, 0);
            return maxVal >= filters.minExpr;
        });
    }

    return results;
};

// Autocomplete setup
window.setupAutocomplete = function(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(suggestionsId);
    if (!input || !box) return;

    input.addEventListener('input', function() {
        const val = this.value.toUpperCase();
        if (val.length < 2) { box.style.display = 'none'; return; }

        // Search gene symbols + synonyms
        const matches = Object.keys(window.CiliAI.lookups.geneMap || {})
            .filter(k => k.startsWith(val))
            .slice(0, 10);

        if (matches.length === 0) { box.style.display = 'none'; return; }

        box.innerHTML = matches.map(gene => 
            `<div class="ac-item" onclick="window.setSearch('${gene}')">${gene}</div>`
        ).join('');
        box.style.display = 'block';
    });

    // Hide when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target !== input && e.target !== box) box.style.display = 'none';
    });
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.loadCiliAIData();
    window.setupEventListeners();
});

// Export to global scope
window.initCiliAI = window.CiliAI.init;
window.normalizeTerm = normalizeTerm;
window.ensureArray = ensureArray;
