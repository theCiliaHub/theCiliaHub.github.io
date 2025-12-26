/* ==============================================================
 * CiliAI Data Module - Data Loading, Caching, Parsing
 * ============================================================== */

// TSV Parser
function parseTsvData(tsvText) {
    const data = {};
    const lines = tsvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length <= 1) return data;
    
    const headers = lines[0].split('\t').map(h => h.trim());
    const gIdx = headers.indexOf('Gene name');
    const tIdx = headers.indexOf('Tissue');
    const nIdx = headers.indexOf('nTPM');
    
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        const gene = cols[gIdx];
        const tissue = cols[tIdx];
        const val = parseFloat(cols[nIdx]);
        if (gene && tissue && !isNaN(val)) {
            if (!data[gene]) data[gene] = {};
            data[gene][tissue] = val;
        }
    }
    return data;
}

// Main data loading function
window.loadCiliAIData = async function() {
    const base = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/';
    window.updateStatus('Syncing Databases...', 'loading');
    
    try {
        const [main, look, rna, kStr, kE1, kE2] = await Promise.all([
            fetch(base + 'ciliAI_master_database.json').then(r => r.json()),
            fetch(base + 'ciliAI_lookups.json').then(r => r.json()),
            fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/rna_tissue_consensus.tsv').then(r => r.text()),
            fetch(base + 'kidney_structure.json').then(r => r.json()),
            fetch(base + 'kidney_expression_part1.json').then(r => r.json()),
            fetch(base + 'kidney_expression_part2.json').then(r => r.json())
        ]);

        window.CiliAI.masterData = main.masterData || [];
        window.CiliAI.lookups = look.lookups || {};
        window.CiliAI.datasets.lung.umap = main.umapData || [];
        window.rnaTissueExpressionData = parseTsvData(rna);

        window.CiliAI.datasets.kidney = {
            name: "Human Kidney",
            umap: kStr.umap,
            expression: { ...kE1, ...kE2 },
            colorScale: [[0, '#e2e8f0'], [0.1, '#bee3f8'], [1, '#2b6cb0']]
        };

        const validDiseases = new Set();
        const validGenes = new Set();
        const primaryClasses = ['Primary Ciliopathies', 'Motile Ciliopathies', 'Atypical Ciliopathies'];

        window.CiliAI.masterData.forEach(g => {
            const sym = g.Gene.toUpperCase();
            window.CiliAI.lookups.geneMap[sym] = g;
            if(g.expression?.scRNA) window.CiliAI.cellDataCache[sym] = g.expression.scRNA;

            if (primaryClasses.includes(g.ciliopathy_classification)) {
                validGenes.add(sym);
                const ds = Array.isArray(g.Ciliopathy) ? g.Ciliopathy : [g.Ciliopathy];
                ds.forEach(d => { if(d && d !== 'N/A' && d !== 'Not specified') validDiseases.add(d); });
            }
        });

        // Update Dashboard Statistics
        const genesEl = document.getElementById('stat-genes');
        const disEl = document.getElementById('stat-ciliopathys');
        const symEl = document.getElementById('stat-ciliopathy-genes');

        if(genesEl) genesEl.textContent = window.CiliAI.masterData.length.toLocaleString();
        if(disEl) disEl.textContent = validDiseases.size.toLocaleString();
        if(symEl) symEl.textContent = validGenes.size.toLocaleString();

        window.CiliAI.ready = true;
        window.updateStatus('CONNECTED', 'ready');
        return true;
    } catch (e) {
        console.error("Critical Load Error", e);
        window.updateStatus('OFFLINE', 'error');
        return false;
    }
};

// Gene extraction
window.extractMultipleGenes = function(query) {
    if (!query || typeof query !== 'string') return [];
    const qLower = query.toLowerCase();

    // Manual overrides for common genes
    const manualMap = {
        'kif3a': 'KIF3A', 'ift88': 'IFT88', 'bbs1': 'BBS1', 'arl13b': 'ARL13B',
        'cep290': 'CEP290', 'tmem67': 'TMEM67', 'ofd1': 'OFD1', 'foxj1': 'FOXJ1',
        'tctn1': 'TCTN1', 'mks1': 'MKS1', 'rpgrip1l': 'RPGRIP1L', 'ttc21b': 'TTC21B',
        'aaas': 'AAAS'
    };

    const found = new Set();

    // Manual match first
    for (const [key, gene] of Object.entries(manualMap)) {
        if (qLower.includes(key)) found.add(gene);
    }

    // Regex extraction with improved stopword filter
    const geneRegex = /\b([A-Z0-9][A-Z0-9\-\.]{2,})\b/gi;
    const matches = query.match(geneRegex) || [];
    
    const stopWords = new Set([
        "THE", "AND", "FOR", "NOT", "ARE", "WHAT", "SHOW", "LIST", "GENE", "GENES",
        "PLOT", "COMPARE", "WHAT'S", "DESCRIBE", "OF", "IN", "LOSS", "FUNCTION",
        "EFFECT", "WITH", "THAT", "THIS", "ABOUT", "TELL", "ME", "SHORT", "LONG",
        "LONGER", "CILIA", "CILIARY", "PROTEINS", "WHICH", "FIND", "CAUSES", "CAUSE",
        "KNOCKED", "DOWN", "WHEN", "NO", "KNOWN", "CORUM", "LINKED", "ASSOCIATED",
        "MULTI", "QUESTION", "QUERY", "ANSWER", "PLEASE", "THANKS", "VS", "VERSUS"
    ]);

    const geneMap = window.CiliAI.lookups.geneMap || {};

    matches.forEach(match => {
        const upper = match.toUpperCase();
        if (stopWords.has(upper)) return;
        if (geneMap[upper] || found.has(upper)) found.add(upper);
    });

    const result = Array.from(found);
    if(window.log) window.log(`[Gene Extraction] "${query}" → ${JSON.stringify(result)}`);
    return result;
};

// Helper: Get scRNA expression map for a gene
function getScRNAExpression(geneSymbol) {
    const gene = window.CiliAI.lookups.geneMap[geneSymbol.toUpperCase()];
    return gene?.expression?.scRNA || {};
}

// Helper: List cell types with expression > 0
function getExpressedCellTypes(exprMap) {
    return Object.entries(exprMap)
        .filter(([_, tpm]) => tpm > 0)
        .map(([cellType]) => cellType)
        .sort();
}

// Helper: Is gene restricted to ciliary cells?
function isCiliaRestricted(exprMap) {
    const expressed = getExpressedCellTypes(exprMap);
    if (expressed.length === 0) return false;
    return expressed.every(ct => ct.toLowerCase().includes('ciliated'));
}

// Helper: Is gene specific to multiciliated cells?
function isSpecificToMulticiliated(exprMap) {
    const expressed = getExpressedCellTypes(exprMap);
    return expressed.length === 1 && expressed[0].toLowerCase().includes('multiciliated');
}

// Cell-Type Specific Expression Helpers
function getTPMInCellType(geneSymbol, cellType) {
    const gene = window.CiliAI.lookups.geneMap[geneSymbol.toUpperCase()];
    if (!gene?.expression?.scRNA) return 0;
    return gene.expression.scRNA[cellType] || 0;
}

function isExpressedInCellType(geneSymbol, cellType) {
    return getTPMInCellType(geneSymbol, cellType) > 0;
}

// NEW: Cell-Type Specific Intent Parser
function extractCellTypeQuestion(qLower) {
    const cellTypes = {
        'basal cell': 'basal cell',
        'ciliated cell': 'ciliated cell',
        'multiciliated cell': 'multiciliated cell',
        'club cell': 'club cell',
        'goblet cell': 'goblet cell',
        'neuroendocrine cell': 'neuroendocrine cell',
        'alveolar type 1 cell': 'pulmonary alveolar type 1 cell',
        'alveolar type 2 cell': 'pulmonary alveolar type 2 cell'
    };

    for (const [keyword, type] of Object.entries(cellTypes)) {
        if (qLower.includes(keyword)) return type;
    }
    return null;
}

// Variant data fetching
window.fetchVariantData = async function(geneSymbol) {
    try {
        const response = await fetch(`https://mygene.info/v3/query?q=${geneSymbol}&fields=clinvar,gnomad`);
        const data = await response.json();
        const hits = data.hits?.[0] || {};
        
        return `
        <div class="variant-panel">
            <h4>🧬 Variants for ${geneSymbol}</h4>
            <div class="variant-stats">
                <div class="stat-card"><span class="stat-value">${hits.clinvar?.pathogenic_count || 0}</span> Pathogenic</div>
                <div class="stat-card"><span class="stat-value">${hits.gnomad?.pLI?.toFixed(3) || 'N/A'}</span> pLI Score</div>
            </div>
            <p style="font-size:11px; color:#666;">Data Source: MyGene.info (ClinVar/gnomAD)</p>
        </div>`;
    } catch (e) {
        return `<p>Variant data unavailable for ${geneSymbol}</p>`;
    }
};

// Phylogeny data loading
async function ensurePhylogenyDataLoaded() {
    if (window.liPhylogenyCache && window.neversPhylogenyCache) {
        return true; // Already loaded
    }
    
    addChatMessage("Loading large phylogeny datasets... this may take a moment.", false);
    log("Lazy-loading phylogeny data...");

    try {
        const baseUrl = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/';
        const [liRes, neversRes] = await Promise.all([
            fetch(baseUrl + 'li_et_al_2014_matrix_optimized.json'),
            fetch(baseUrl + 'nevers_et_al_2017_matrix_optimized.json')
        ]);
        
        if (!liRes.ok || !neversRes.ok) {
            throw new Error(`Failed to fetch phylogeny files: ${liRes.status}, ${neversRes.status}`);
        }
        
        window.liPhylogenyCache = await liRes.json();
        window.neversPhylogenyCache = await neversRes.json();
        
        log("Phylogeny data successfully lazy-loaded.");
        return true;

    } catch (e) {
        console.error("Failed to lazy-load phylogeny data:", e);
        addChatMessage(`Error: Could not load phylogeny data. ${e.message}`, false);
        return false;
    }
}

// Export to global scope
window.parseTsvData = parseTsvData;
window.getScRNAExpression = getScRNAExpression;
window.getExpressedCellTypes = getExpressedCellTypes;
window.isCiliaRestricted = isCiliaRestricted;
window.isSpecificToMulticiliated = isSpecificToMulticiliated;
window.getTPMInCellType = getTPMInCellType;
window.isExpressedInCellType = isExpressedInCellType;
window.extractCellTypeQuestion = extractCellTypeQuestion;
window.ensurePhylogenyDataLoaded = ensurePhylogenyDataLoaded;
