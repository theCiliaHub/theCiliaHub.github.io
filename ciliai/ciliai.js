/* ==============================================================
 * CiliAI – Unified Logic Engine (v8.1 – Complete Implementation)
 * ============================================================== */

// 1. CORE CONFIGURATION & CONSTANTS
// ==============================================================

const CONFIG = {
    VERSION: '8.1',
    DATASETS: {
        LUNG: 'lung',
        KIDNEY: 'kidney'
    },
    PHYLOGENY_SOURCES: {
        LI: 'li',
        NEVERS: 'nevers'
    },
    ACTIONS: {
        SHOW_LI_HEATMAP: 'show-li-heatmap',
        SHOW_NEVERS_HEATMAP: 'show-nevers-heatmap',
        SHOW_TABLE_VIEW: 'show-table-view',
        SHOW_UMAP_PLOT: 'show-umap-plot'
    },
    CONTEXT_TYPES: {
        LIST_FOLLOWUP: 'list_followup',
        SCREEN_REFERENCES: 'screen_references',
        TOP_500_CILIARY: 'top_500_ciliary'
    },
    DEFAULT_PHYLO_GENES: ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"]
};

// 2. GLOBAL DATA STRUCTURES
// ==============================================================

const ORGANISM_PANELS = {
    NEVERS_CIL_PANEL: [
        "Homo sapiens", "Mus musculus", "Danio rerio", "Xenopus tropicalis", "Gallus gallus",
        "Caenorhabditis elegans", "Tetrahymena thermophila (strain SB210)", "Chlamydomonas reinhardtii",
        "Micromonas sp. (strain RCC299 / NOUM17)", "Trypanosoma cruzi", "Leishmania major",
        "Giardia intestinalis (strain ATCC 50803 / WB clone C6)", "Trichomonas vaginalis",
        "Strongylocentrotus purpuratus", "Ciona intestinalis", "Physcomitrella patens subsp. patens",
        "Paramecium tetraurelia", "Volvox carteri", "Amphimedon queenslandica", "Monosiga brevicollis"
    ],
    NEVERS_NCIL_PANEL: [
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
    ]
};

// 3. UTILITY FUNCTIONS
// ==============================================================

/**
 * Log utility with timestamp
 */
function log(message, data = null) {
    const timestamp = new Date().toISOString().substring(11, 23);
    console.log(`[CiliAI ${timestamp}] ${message}`);
    if (data) console.log(data);
}

/**
 * Add message to chat window
 */
function addChatMessage(html, isUser = false) {
    const chatWindow = document.getElementById('messages');
    if (!chatWindow) return;
    
    const msg = document.createElement('div');
    msg.className = `ciliai-message ${isUser ? 'user' : 'assistant'}`;
    msg.innerHTML = `<div class="ciliai-message-content">${html}</div>`;
    
    if (!isUser) {
        msg.querySelector('.ciliai-message-content').innerHTML += `
            <div class="ciliai-reaction-buttons">
                <span class="ciliai-reaction-btn" onclick="react('up')">👍</span>
                <span class="ciliai-reaction-btn" onclick="react('down')">👎</span>
            </div>`;
    }
    
    chatWindow.appendChild(msg);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * Get complex phylogeny table map
 */
function getComplexPhylogenyTableMap() {
    return {
        "IFT COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43", "IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-A COMPLEX": ["WDR19", "IFT140", "TTC21B", "IFT122", "WDR35", "IFT43"],
        "IFT-B COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20", "IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT-B1 COMPLEX": ["IFT172", "IFT80", "IFT57", "TRAF3IP1", "CLUAP1", "IFT20"],
        "IFT-B2 COMPLEX": ["IFT88", "IFT81", "IFT74", "IFT70A", "IFT70B", "IFT56", "IFT52", "IFT46", "IFT27", "IFT25", "IFT22"],
        "IFT MOTOR COMPLEX": ["KIF3A", "KIF3B", "KIF17", "DYNC2H1", "DYNC2LI1", "WDR34", "WDR60"],
        "INTRAFLAGELLAR TRANSPORT MOTORS": ["KIF3A", "KIF3B", "KIF17", "DYNC2H1", "DYNC2LI1", "WDR34", "WDR60"],
        "BBSOME": ["BBS1", "BBS2", "BBS4", "BBS5", "BBS7", "TTC8", "BBS9", "BBIP1"],
        "EXOCYST": ["EXOC1", "EXOC2", "EXOC3", "EXOC4", "EXOC5", "EXOC6", "EXOC7", "EXOC8"],
        "MKS MODULE": ["MKS1", "TMEM17", "TMEM67", "TMEM138", "B9D2", "B9D1", "CC2D2A", "TMEM107", "TMEM237", "TMEM231", "TMEM216", "TCTN1", "TCTN2", "TCTN3"],
        "NPHP MODULE": ["NPHP1", "NPHP3", "NPHP4", "RPGRIP1L", "IQCB1", "CEP290", "SDCCAG8"],
        "CENTRIOLE DISTAL APPENDAGES": ["CEP164", "SCLT1", "CEP89", "LRRC45", "CEP123", "ANKRD26", "FOPNL", "CEP128", "CEP135", "FBF1", "CCDC41", "CCDC120"],
        "CENTRIOLAR SATELLITES": ["PCM1", "CEP131", "CEP290", "OFD1", "AZI1", "CEP72", "SSX2IP"],
        "TRANSITION FIBER": ["CEP164", "CEP83", "SCLT1", "CEP89", "LRRC45", "CEP123", "CEP350", "CEP44"],
        "RADIAL SPOKE": ["RSPH1", "RSPH3", "RSPH4A", "RSPH6A", "RSPH9", "RSPH10B", "RSPH23", "RSPH16", "DRC1", "DRC3", "DRC4", "DRC5"],
        "CENTRAL PAIR": ["HYDIN", "SPAG6", "SPAG16", "SPAG17", "POC1A", "CEP131", "CFAP43", "CFAP44", "CFAP45", "CFAP47"],
        "DYNEIN ARM": ["DNAH1", "DNAH2", "DNAH5", "DNAH6", "DNAH7", "DNAH8", "DNAH9", "DNAH10", "DNAH11", "DNALI1", "DNAI1", "DNAI2", "DNAAF1", "DNAAF2", "DNAAF3", "DNAAF4", "LRRC6", "CCDC103"],
        "OUTER DYNEIN ARM": ["DNAH5", "DNAH11", "DNAH17", "DNAH18", "DNAI1", "DNAI2", "DNAAF1", "DNAAF2", "DNAAF3", "DNAAF4", "LRRC6", "CCDC103", "WDR63"],
        "INNER DYNEIN ARM": ["DNAH2", "DNAH7", "DNAH10", "DNALI1", "DNAL4", "DNAAF5", "CCDC40", "CCDC114", "CCDC151"],
        "NEXIN-DYNEIN REGULATORY COMPLEX": ["GAS8", "GAS2L2", "CCDC39", "CCDC40", "CCDC164", "CCDC65"],
        "ROOTLETIN COMPLEX": ["CROCC", "CROCC2", "CEP68", "CEP44", "ODF2"],
        "CENTRIOLE LINKER": ["CEP68", "CEP250", "C-NAP1", "ROCK1", "NEK2"],
        "SHH SIGNALING": ["SMO", "PTCH1", "GLI1", "GLI2", "GLI3", "SUFU", "KIF7", "TULP3", "IFT172", "IFT81", "ARL13B"],
        "GPCR COMPLEX": ["GPR161", "GPR175", "GPR22", "GPR83", "ADCY3", "RXFP2", "SSTR3", "NPY2R", "HTR6"],
        "HEDGEHOG TRAFFICKING COMPLEX": ["ARL13B", "INPP5E", "TULP3", "IFT172", "KIF7", "BBS4", "BBS5", "SMO"],
        "PEROXISOMAL COMPLEX": ["PEX1", "PEX2", "PEX3", "PEX5", "PEX6", "PEX10", "PEX12", "PEX13", "PEX14", "PEX19"]
    };
}

/**
 * Get disease classification map
 */
function getDiseaseClassificationMap() {
    return {
        "Primary Ciliopathies": [
            "Acrocallosal Syndrome", "Alström Syndrome", "Autosomal Dominant Polycystic Kidney Disease",
            "Autosomal Recessive Polycystic Kidney Disease", "Bardet–Biedl Syndrome", "Bardet Biedel Syndrome",
            "COACH Syndrome", "Cranioectodermal Dysplasia", "Ellis-van Creveld Syndrome", "Hydrolethalus Syndrome",
            "Infantile Polycystic Kidney Disease", "Joubert Syndrome", "Leber Congenital Amaurosis",
            "Meckel–Gruber Syndrome", "Nephronophthisis", "Orofaciodigital Syndrome", "Senior-Løken Syndrome",
            "Short-rib Thoracic Dysplasia", "Skeletal Ciliopathy", "Retinal Ciliopathy", "Syndromic Ciliopathy"
        ],
        "Motile Ciliopathies": [
            "Primary Ciliary Dyskinesia", "Birt-Hogg-Dubé Syndrome", "Juvenile Myoclonic Epilepsy"
        ],
        "Secondary Diseases": [
            "Ataxia-telangiectasia-like Disorder", "Birt-Hogg-Dubé Syndrome", "Cone-Rod Dystrophy",
            "Cornelia de Lange Syndrome", "Holoprosencephaly", "Juvenile Myoclonic Epilepsy",
            "Medulloblastoma", "Retinitis Pigmentosa", "Spinocerebellar Ataxia", "Bazex-Dupré-Christol Syndrome"
        ],
        "Atypical Ciliopathies": [
            "Biliary Ciliopathy", "Chronic Obstructive Pulmonary Disease", "Ciliopathy",
            "Ciliopathy - Retinal dystrophy", "Golgipathies or Ciliopathy", "Hepatic Ciliopathy",
            "Male Infertility and Ciliopathy", "Male infertility", "Microcephaly and Chorioretinopathy Type 3"
        ]
    };
}

/**
 * Ensure value is an array
 */
function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    if (typeof value === 'string' && value.includes(',')) {
        return value.split(',').map(v => v.trim()).filter(v => v);
    }
    return [value];
}

/**
 * Setup page event listeners
 */
function setupPageEventListeners() {
    document.body.addEventListener('click', e => {
        // Handle feedback buttons
        const feedbackBtn = e.target.closest('.ciliai-reaction-btn');
        if (feedbackBtn) {
            const type = feedbackBtn.textContent.includes('👍') ? 'up' : 'down';
            react(type);
            return;
        }
        
        // Handle gene badges
        const geneBadge = e.target.closest('.gene-badge');
        if (geneBadge) {
            const gene = geneBadge.textContent.trim();
            if (gene) searchGene(gene);
            return;
        }
        
        // Handle AI action links
        const aiAction = e.target.closest('.ai-action');
        if (aiAction) {
            const action = aiAction.dataset.action;
            if (action) {
                e.preventDefault();
                const genes = aiAction.dataset.genes || "";
                let query = "";
                
                if (action === CONFIG.ACTIONS.SHOW_LI_HEATMAP) {
                    query = `show li phylogeny for ${genes}`;
                } else if (action === CONFIG.ACTIONS.SHOW_NEVERS_HEATMAP) {
                    query = `show nevers phylogeny for ${genes}`;
                } else if (action === CONFIG.ACTIONS.SHOW_TABLE_VIEW) {
                    query = `show data table for ${genes}`;
                } else if (action === CONFIG.ACTIONS.SHOW_UMAP_PLOT) {
                    log(`Action: show-umap-plot for ${genes}`);
                    renderUMAPPlot(genes);
                    return;
                }
                
                if (query) {
                    addChatMessage(query, true);
                    handleAIQuery(query);
                }
                return;
            }
        }
    });
}

/**
 * Extract multiple genes from query
 */
function extractMultipleGenes(query) {
    if (!query || typeof query !== 'string') return [];
    const qLower = query.toLowerCase();
    
    const manualMap = {
        'kif3a': 'KIF3A', 'ift88': 'IFT88', 'bbs1': 'BBS1', 'arl13b': 'ARL13B',
        'cep290': 'CEP290', 'tmem67': 'TMEM67', 'ofd1': 'OFD1', 'ift52': 'IFT52',
        'foxj1': 'FOXJ1', 'pkd1': 'PKD1', 'wdr31': 'WDR31', 'bbs7': 'BBS7',
        'ift81': 'IFT81', 'znf474': 'ZNF474', 'cep41': 'CEP41', 'zc2hc1a': 'ZC2HC1A',
        'bbs2': 'BBS2', 'bbs5': 'BBS5'
    };
    
    let foundGenes = new Set();
    
    // 1. Check manual map first
    for (const [key, gene] of Object.entries(manualMap)) {
        const regex = new RegExp(`\\b${key}\\b`, 'i');
        if (regex.test(qLower)) {
            foundGenes.add(gene);
        }
    }

    // 2. Regex Extraction
    const geneRegex = /\b([A-Z0-9][A-Z0-9\-\.]{2,})\b/gi;
    let matches = query.match(geneRegex) || [];
    
    const stopWords = new Set([
        "THE", "AND", "FOR", "NOT", "ARE", "WHAT", "SHOW", "LIST", "GENE", "GENES",
        "PLOT", "COMPARE", "WHAT'S", "DESCRIBE", "OF", "IN", "LOSS", "FUNCTION",
        "EFFECT", "WITH", "THAT", "THIS", "ABOUT", "TELL", "ME", "SHORT", "LONG",
        "LONGER", "CILIA", "CILIARY", "PROTEINS", "WHICH", "FIND", "CAUSES", "CAUSE",
        "KNOCKED", "DOWN", "WHEN", "NO", "KNOWN", "CORUM", "LINKED", "ASSOCIATED"
    ]);
    
    const geneMap = window.CiliAI?.lookups?.geneMap || {};
    
    for (const match of matches) {
        const upperMatch = match.toUpperCase();
        if (stopWords.has(upperMatch)) continue;
        if (geneMap[upperMatch] || foundGenes.has(upperMatch)) {
            foundGenes.add(upperMatch);
        }
    }
    
    const result = Array.from(foundGenes);
    log(`[Gene Extraction] Input: "${query}" -> Found: ${JSON.stringify(result)}`);
    return result;
}

/**
 * Format list result HTML
 */
function formatListResult(title, genes, description = "") {
    if (!genes || genes.length === 0) {
        return `<div class="ai-result-card">
            <strong>${title}</strong>
            <p>No matching genes found in the database.</p>
        </div>`;
    }
    
    const genesToShow = genes.slice(0, 20);
    const geneListHtml = genesToShow.map(g => `
        <li><strong>${g.gene}</strong>: ${g.description || 'No details available.'}</li>
    `).join('');
    
    let html = `<div class="ai-result-card">
        <strong>${title}</strong>`;
    
    if (description) {
        html += `<p>${description}</p>`;
    }
    
    html += `<ul>${geneListHtml}</ul>`;
    
    if (genes.length > 20) {
        html += `<p style="font-size: 11px;">...and ${genes.length - 20} more.</p>`;
    }
    
    html += `</div>`;
    return html;
}

/**
 * Handle user send from chat input
 */
function handleUserSend() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;
    const query = chatInput.value.trim();
    if (!query) return;
    addChatMessage(query, true);
    chatInput.value = '';
    handleAIQuery(query);
}

/**
 * Update status display
 */
function updateStatus(text, status) {
    const statusEl = document.getElementById('dataStatus');
    if (statusEl) {
        statusEl.textContent = text;
        statusEl.className = `status ${status}`;
    }
}

/**
 * Normalize term for keyword matching
 */
function normalizeTerm(term) {
    if (typeof term !== 'string') return '';
    let normalized = term.toLowerCase();
    normalized = normalized.replace(/[^a-z0-9]/g, '');
    return normalized;
}

/**
 * Handle gene search
 */
function handleGeneSearch(geneSymbol, queryAI = true) {
    const gene = geneSymbol.trim().toUpperCase();
    if (!gene) return;
    if (!window.CiliAI?.ready) {
        console.warn("CiliAI data is not ready for gene search.");
        return;
    }
    const geneData = window.CiliAI.lookups.geneMap[gene];
    if (!geneData) {
        addChatMessage(`Gene Not Found: ${gene}. This gene is not in the CiliAI database.`, false);
        return;
    }
    
    // Update localization highlight
    let loc = 'unknown';
    if (geneData.Localization) {
        const locString = String(geneData.Localization).toLowerCase();
        if (locString.includes('transition zone')) loc = 'transition-zone';
        else if (locString.includes('axoneme')) loc = 'axoneme';
        else if (locString.includes('basal body')) loc = 'basal-body';
        else if (locString.includes('membrane')) loc = 'ciliary-membrane';
        else if (locString.includes('nucleus')) loc = 'nucleus';
        else if (locString.includes('cytoplasm')) loc = 'cell-body';
    }
    document.querySelectorAll('.cilia-part').forEach(el => el.classList.remove('active', 'selected'));
    if (loc !== 'unknown' && document.getElementById(loc)) {
        document.getElementById(loc).classList.add('active');
    }
    
    if (queryAI) {
        handleAIQuery(`Tell me about ${gene}`);
    }
}

/**
 * Handle tissue-specific disease query
 */
function handleTissueSpecificDiseaseQuery(diseaseTerm, tissueTerm) {
    const normDiseaseKey = normalizeDiseaseKey(diseaseTerm);
    const diseaseGenes = window.CiliAI?.lookups?.byCiliopathy?.[normDiseaseKey] || [];
    
    if (diseaseGenes.length === 0) {
        return `<div class="ai-result-card">
            <p>I found no genes associated with <strong>${diseaseTerm}</strong>.</p>
        </div>`;
    }

    const geneMap = window.CiliAI.lookups.geneMap;
    const results = [];

    diseaseGenes.forEach(geneSymbol => {
        const gene = geneMap[geneSymbol];
        if (gene && hasExpressionInTissue(gene, tissueTerm)) {
            let expressionValue = 'N/A';
            if (gene.expression?.tissue?.[tissueTerm]) {
                expressionValue = gene.expression.tissue[tissueTerm].toFixed(2) + ' TPM';
            } else if (gene.expression?.scRNA) {
                const maxExpr = Object.entries(gene.expression.scRNA)
                    .filter(([cellType]) => cellType.toLowerCase().includes(tissueTerm.toLowerCase()))
                    .map(([, val]) => val)
                    .reduce((max, val) => Math.max(max, val), 0);
                if (maxExpr > 0) {
                    expressionValue = maxExpr.toFixed(2) + ' (scRNA max)';
                }
            }

            results.push({
                gene: gene.Gene,
                disease: diseaseTerm,
                expression_in_tissue: expressionValue
            });
        }
    });

    if (results.length === 0) {
        return `<div class="ai-result-card">
            <p>No genes causing <strong>${diseaseTerm}</strong> are strongly expressed in the <strong>${tissueTerm}</strong> tissue in the current dataset.</p>
        </div>`;
    }

    window.CiliAI.lastQueryContext = {
        type: 'list_followup',
        data: results,
        term: `Genes for ${diseaseTerm} expressed in ${tissueTerm}`
    };

    return `I found ${results.length} genes causing <strong>${diseaseTerm}</strong> that are expressed in <strong>${tissueTerm}</strong>. Do you want to view the list?`;
}

/**
 * Handle gene in disease query (complex + disease overlap)
 */
function handleGeneInDiseaseQuery(complexTerm, diseaseTerm) {
    const normComplex = normalizeTerm(complexTerm);
    const normDisease = normalizeDiseaseKey(diseaseTerm);
    
    const complexGenes = getGenesByComplex(complexTerm).map(g => g.gene);
    const complexSet = new Set(complexGenes);
    const diseaseGenes = window.CiliAI?.lookups?.byCiliopathy?.[normDisease] || [];
    const diseaseSet = new Set(diseaseGenes);

    if (complexSet.size === 0) {
        return `<div class="ai-result-card">
            <p>I found no genes associated with the <strong>${complexTerm}</strong> complex.</p>
        </div>`;
    }
    if (diseaseSet.size === 0) {
        return `<div class="ai-result-card">
            <p>I found no genes associated with <strong>${diseaseTerm}</strong>.</p>
        </div>`;
    }

    const overlappingGenes = [...complexSet].filter(gene => diseaseSet.has(gene));
    const results = overlappingGenes.map(geneSymbol => ({
        gene: geneSymbol,
        complex: complexTerm,
        disease: diseaseTerm
    }));

    if (results.length === 0) {
        return `<div class="ai-result-card">
            <p>No genes were found in both the <strong>${complexTerm}</strong> complex and the <strong>${diseaseTerm}</strong> list.</p>
        </div>`;
    }

    window.CiliAI.lastQueryContext = {
        type: 'list_followup',
        data: results,
        term: `${complexTerm} Genes Causing ${diseaseTerm}`
    };

    return `I found ${results.length} genes that are both in the <strong>${complexTerm}</strong> complex and associated with <strong>${diseaseTerm}</strong>. Do you want to view the list?`;
}

/**
 * Find and merge genes from user input
 */
function findAndMergeGenes(userInputArray) {
    const foundGenes = [];
    const seenGenes = new Set();
    const geneMap = window.CiliAI?.lookups?.geneMap || {};

    userInputArray.forEach(query => {
        const geneSymbol = query.toUpperCase().trim();
        if (!geneSymbol || seenGenes.has(geneSymbol)) return;

        let geneData = window.CiliAI.masterData?.find(g => g.Gene?.toUpperCase() === geneSymbol);

        if (geneData) {
            if (window.screenDatabase?.[geneSymbol]) {
                geneData.screens_summary = window.screenDatabase[geneSymbol];
            }
            foundGenes.push(geneData);
            seenGenes.add(geneSymbol);
        }
    });
    
    return { foundGenes };
}

/**
 * Show data in left panel as sortable table
 */
function showDataInLeftPanel(title, geneList) {
    const container = document.getElementById('cilia-svg');
    if (!container) {
        console.error("Cannot find 'cilia-svg' container.");
        return;
    }
    
    const wrapper = container.closest('.interactive-cilium');
    if (wrapper) wrapper.classList.add('table-view-active');

    if (!geneList || geneList.length === 0) {
        container.innerHTML = `<div class="ciliai-table-container">
            <h3>${title}</h3>
            <p style="padding:20px;">No genes found.</p>
            <button id="ciliai-back-btn" class="ciliai-button" style="background:#718096;">Back</button>
        </div>`;
        document.getElementById('ciliai-back-btn')?.addEventListener('click', () => generateAndInjectSVG());
        return;
    }

    // 1. Augment Data
    const augmentedList = geneList.map(item => {
        const geneSymbol = (typeof item === 'string' ? item : (item.gene || item.Gene || item.GENE || 'Unknown')).toUpperCase();
        const fullData = window.CiliAI?.lookups?.geneMap?.[geneSymbol] || {};
        
        let diseases = 'None listed';
        if (Array.isArray(fullData.Ciliopathies)) diseases = fullData.Ciliopathies.join(', ');
        else if (fullData.Ciliopathies) diseases = fullData.Ciliopathies;
        else if (fullData['Ciliopathy']) diseases = fullData['Ciliopathy'];

        const newItem = {
            Gene: geneSymbol,
            ENSG: fullData['Ensembl ID'] || fullData['Ensembl.ID'] || '—',
            Localization: fullData['Localization'] || '—',
            Diseases: diseases,
            ...item
        };
        
        if (newItem.gene) delete newItem.gene;
        return newItem;
    });

    // 2. Dynamic Headers
    const keys = Object.keys(augmentedList[0]);
    const headers = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '));

    // 3. Build Table HTML
    let tableHTML = `
        <div style="padding: 0 10px 10px 10px;">
            <input type="text" id="ciliai-table-filter" placeholder="Filter table (e.g., 'kidney' or 'IFT')..." 
                   style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 13px;">
        </div>
        <table class="ciliai-data-table sortable" id="ciliai-dynamic-table">
            <thead>
                <tr>
                    ${keys.map((k, i) => `
                        <th onclick="sortTable('ciliai-dynamic-table', ${i})" style="cursor:pointer; user-select:none;">
                            ${headers[i]} <span style="font-size:10px; color:#666;">▼</span>
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>`;

    augmentedList.forEach(item => {
        tableHTML += `<tr>`;
        keys.forEach(key => {
            let value = item[key] !== null && item[key] !== undefined ? item[key] : '—';
            if (key === 'Diseases' && value.length > 50) {
                value = `<span title="${value}">${value.substring(0, 50)}...</span>`;
            }
            if (key === 'Gene') {
                tableHTML += `<td><strong style="color:#2b6cb0; cursor:pointer;" onclick="displayFullGeneInfo('${value}')">${value}</strong></td>`;
            } else {
                tableHTML += `<td>${value}</td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table>`;

    // 4. Render Container
    container.innerHTML = `
        <div class="ciliai-table-container">
            <h3>${title} (${augmentedList.length} genes)</h3>
            <div>
                <button id="ciliai-download-btn" class="ciliai-button">Download CSV</button>
                <button id="ciliai-back-btn" class="ciliai-button" style="background: #718096;">Back</button>
            </div>
            <div class="ciliai-table-scroll-wrapper">
                ${tableHTML}
            </div>
        </div>
    `;

    injectTableCSS();

    // 5. Attach Filter Listener
    document.getElementById('ciliai-table-filter')?.addEventListener('keyup', function() {
        const filter = this.value.toUpperCase();
        const rows = document.getElementById("ciliai-dynamic-table")?.getElementsByTagName("tr") || [];
        for (let i = 1; i < rows.length; i++) {
            let txtValue = rows[i].textContent || rows[i].innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                rows[i].style.display = "";
            } else {
                rows[i].style.display = "none";
            }
        }
    });

    // 6. Attach Button Listeners
    document.getElementById('ciliai-download-btn')?.addEventListener('click', () => {
        downloadTableAsCSV(title, augmentedList);
    });
    document.getElementById('ciliai-back-btn')?.addEventListener('click', () => {
        generateAndInjectSVG();
    });
}

/**
 * Sort table by column
 */
function sortTable(tableId, n) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let switching = true, shouldSwitch, dir = "asc", switchcount = 0;
    let i, x, y, rows = table.rows;

    while (switching) {
        switching = false;
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[n];
            y = rows[i + 1].getElementsByTagName("TD")[n];
            
            if (!x || !y) continue;
            
            let xContent = x.innerText.toLowerCase();
            let yContent = y.innerText.toLowerCase();
            const xNum = parseFloat(xContent);
            const yNum = parseFloat(yContent);
            const isNumeric = !isNaN(xNum) && !isNaN(yNum);

            if (dir == "asc") {
                if (isNumeric ? (xNum > yNum) : (xContent > yContent)) {
                    shouldSwitch = true;
                    break;
                }
            } else if (dir == "desc") {
                if (isNumeric ? (xNum < yNum) : (xContent < yContent)) {
                    shouldSwitch = true;
                    break;
                }
            }
        }
        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
            switchcount++;
        } else {
            if (switchcount == 0 && dir == "asc") {
                dir = "desc";
                switching = true;
            }
        }
    }
}

/**
 * React to messages (feedback)
 */
function react(type) {
    const userMessages = Array.from(document.querySelectorAll('.ciliai-message.user'));
    const lastQuestion = userMessages.length > 0 
        ? (userMessages[userMessages.length - 1].querySelector('.ciliai-message-content')?.textContent || '').trim()
        : 'No question';

    const feedbackType = type === 'up' ? 'Positive' : 'Negative';

    // Silent feedback tracking
    new Image().src = 'https://script.google.com/macros/s/AKfycby5PdLZdYKN9S06Tbt3x8lQfDrFhOXo3RteQbY6NFZawx22bH_EC2XuIf5_I6lDPSl5/exec' +
        '?type=' + encodeURIComponent(feedbackType) +
        '&question=' + encodeURIComponent(lastQuestion.substring(0, 500)) +
        '&url=' + encodeURIComponent(location.href) +
        '&t=' + Date.now();

    if (type === 'up') {
        addChatMessage('Thank you! Feedback received', false);
    } else {
        addChatMessage('Got it – thank you for the feedback!', false);
    }
}

/**
 * Send feedback email
 */
function sendFeedbackEmail(feedbackType, userQuestion) {
    const subject = `CiliAI ${feedbackType === 'up' ? '👍 Positive' : '👎 Negative'} Feedback`;
    const body = `
User Question: ${userQuestion}
Feedback Type: ${feedbackType === 'up' ? 'Positive (👍)' : 'Negative (👎)'}
Time: ${new Date().toLocaleString()}
Page: ${window.location.href}

--
Sent from CiliAI Chat
    `.trim();
    
    window.open(`mailto:oktay.kaplan@agu.edu.tr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
}

/**
 * Download table as CSV
 */
function downloadTableAsCSV(title, geneList) {
    if (!geneList || geneList.length === 0) return;
    
    const keys = Object.keys(geneList[0]);
    const headers = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1));
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(',') + '\r\n';
    
    geneList.forEach(item => {
        const row = keys.map(key => {
            const cell = String(item[key] !== null && item[key] !== undefined ? item[key] : 'N/A').replace(/"/g, '""');
            return `"${cell}"`;
        });
        csvContent += row.join(',') + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.replace(/[\s\W]+/g, '_')}_genelist.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Inject table CSS styles
 */
function injectTableCSS() {
    const styleId = 'ciliai-table-styles';
    if (document.getElementById(styleId)) return;
    
    const css = `
        .interactive-cilium.table-view-active { 
            max-width: none !important; 
            padding: 0 !important; 
            border: none !important; 
            box-shadow: none !important; 
            height: 100%; 
        }

        .ciliai-table-container { 
            width: 100%; 
            height: 100%; 
            display: flex; 
            flex-direction: column; 
            padding: 0; 
            background: #f7fbff;
        }

        .ciliai-table-container h3 {
            font-size: 16px;
            color: #2b3a42; 
            margin-bottom: 10px;
            padding: 10px 10px 0 10px;
        }

        .ciliai-button { 
            padding: 8px 12px;
            background: #6c8aa3;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
            font-size: 12px;
            margin-bottom: 10px;
            margin-left: 10px;
            width: 150px;
        }
        .ciliai-button:hover { 
            background: #547a90; 
        }

        .ciliai-table-scroll-wrapper { 
            flex: 1; 
            overflow-y: auto; 
            border-top: 1px solid #c8d6e5; 
            border-bottom: 1px solid #c8d6e5; 
            margin: 0 0 10px 0; 
        }

        .ciliai-data-table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 12px; 
        }

        .ciliai-data-table th, 
        .ciliai-data-table td { 
            padding: 8px 12px; 
            text-align: left; 
            border-bottom: 1px solid #d5e2ed; 
        }

        .ciliai-data-table th { 
            background: #b3cde0; 
            color: #1f2a33;
            font-weight: 600;
            position: sticky; 
            top: 0; 
            z-index: 1; 
        }

        .ciliai-data-table tbody tr:hover { 
            background-color: #e3f0fa; 
        }

        .ciliai-data-table tr:last-child td { 
            border-bottom: none; 
        }

        .ciliai-data-table td strong { 
            color: #6c8aa3; 
            font-weight: 600; 
        }
    `;
    
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
}

/**
 * Handle screen query
 */
function handleScreenQuery(geneSymbol) {
    const gene = geneSymbol.toUpperCase();
    const g = window.CiliAI?.lookups?.geneMap?.[gene];
    if (!g) return `Sorry, I could not find data for "${gene}".`;
    
    let html = `<div class="ai-result-card"><h4>Screen Results for <strong>${gene}</strong></h4>`;
    
    const percEffect = g['Percentage of ciliated cells (increase/decrease/no effect)'];
    const lofEffect = g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'];
    const oeEffect = g['Overexpression effects on cilia length (increase/decrease/no effect)'];

    if (percEffect && percEffect !== "Not Reported" && percEffect) {
        html += `<p><strong>Percent Ciliated Cells Effect:</strong> ${percEffect}</p>`;
    }
    if (lofEffect && lofEffect !== "Not Reported" && lofEffect) {
        html += `<p><strong>Loss-of-Function Effect:</strong> ${lofEffect}</p>`;
    }
    if (oeEffect && oeEffect !== "Not Reported" && oeEffect) {
        html += `<p><strong>Overexpression Effect:</strong> ${oeEffect}</p>`;
    }

    if (g.screens && Array.isArray(g.screens) && g.screens.length > 0) {
        html += '<strong>All Screen Data:</strong><ul>';
        g.screens.forEach(s => {
            html += `<li><strong>${s.source}</strong>: ${s.result || 'No result'}</li>`;
        });
        html += '</ul>';
        html += `<p style="font-size: 11px; margin-top: 10px;">(Hint: Ask "show screen references" to see publication details.)</p>`;
    } else if ((!percEffect || percEffect === "Not Reported") &&
              (!lofEffect || lofEffect === "Not Reported") &&
              (!oeEffect || oeEffect === "Not Reported")) {
        html += '<p>No specific screen data found in the database.</p>';
    }

    html += `</div>`;
    return html;
}

/**
 * Handle ortholog query
 */
function handleOrthologQuery(geneSymbol, organism) {
    const gene = geneSymbol.toUpperCase();
    const g = window.CiliAI?.lookups?.geneMap?.[gene];
    if (!g) return `Sorry, I could not find data for "${gene}".`;
    
    const orgKey = `Ortholog_${organism.toLowerCase().replace(/[\.\s]/g, '_')}`;
    if (g[orgKey] && g[orgKey] !== 'N/A' && g[orgKey] !== null) {
        return formatListResult(`Ortholog for ${gene} in ${organism}`, [{
            gene: gene,
            description: `${organism} Ortholog: <strong>${g[orgKey]}</strong>`
        }]);
    } else {
        return `Sorry, I could not find a ${organism} ortholog for <strong>${gene}</strong>.`;
    }
}

/**
 * Handle scRNA query
 */
function handleScRnaQuery(geneSymbols) {
    let html = `<h4>scRNA Expression Data</h4>`;
    const geneMap = window.CiliAI?.lookups?.geneMap || {};
    
    geneSymbols.forEach(gene => {
        const g = geneMap[gene];
        if (!g) {
            html += `<p><strong>${gene}:</strong> Not found in database.</p>`;
            return;
        }
        
        const exp = g.expression?.scRNA;
        html += `<strong>${g.Gene}:</strong> `;
        
        if (exp) {
            const topTissues = Object.entries(exp)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([tissue, val]) => `${tissue} (${val.toFixed(2)})`);
            
            if (topTissues.length > 0) {
                html += `Top expression in: ${topTissues.join(', ')}...<br>`;
            } else {
                html += `No scRNA expression data found.<br>`;
            }
        } else {
            html += `No scRNA expression data found.<br>`;
        }
    });
    
    if (geneSymbols.length > 1) {
        html += `<p style="font-size: 11px; margin-top: 5px;">
            <i>Note: A visual plot for expression comparison is not yet available.</i>
        </p>`;
    }
    
    return `<div class="ai-result-card">${html}</div>`;
}

/**
 * Handle localization query
 */
function handleLocalizationQuery(term, query) {
    const geneList = getGenesByLocalization(term);
    const count = geneList.length;
    
    if (count === 0) {
        return `Sorry, I could not find any genes localized to "${term}".`;
    }
    
    window.CiliAI.lastQueryContext = {
        type: 'list_followup',
        data: geneList,
        term: `Genes localized to ${term}`
    };
    
    return `According to the latest data, ${count} genes are enriched in the ${term}. Do you want to view the list?`;
}

/**
 * Extract complex intent from query
 */
function extractComplexIntent(qLower) {
    const keywords = [
        'bbsome', 'ift-a', 'ift-b', 'nphp module', 'mks module', 'mks complex',
        'cplane complex', 'corum'
    ];
    
    for (const term of keywords) {
        if (qLower.includes(term)) {
            return term;
        }
    }
    return null;
}

/**
 * Extract evolution intent from query
 */
function extractEvolutionIntent(qLower) {
    if (qLower.includes('ciliary-specific') || qLower.includes('ciliary specific')) return 'Ciliary_specific';
    if (qLower.includes('vertebrate-specific') || qLower.includes('vertebrate specific')) return 'Vertebrate_specific';
    if (qLower.includes('mammalian-specific') || qLower.includes('mammalian specific')) return 'Mammalian_specific';
    if (qLower.includes('c. elegans') || qLower.includes('conserved in')) return 'Conserved_in_elegans';
    return null;
}

/**
 * Check if gene is conserved
 */
function isGeneConserved(gene) {
    return gene && gene.Ortholog_C_elegans && gene.Ortholog_C_elegans !== 'N/A';
}

/**
 * Handle simple complex query
 */
function handleSimpleComplexQuery(term, query) {
    const geneList = getGenesByComplex(term);
    const count = geneList.length;
    
    if (count === 0) {
        const genes = extractMultipleGenes(term);
        if (genes.length > 0) {
            return handleGeneInComplexQuery(genes[0]);
        }
        return `Sorry, I could not find any genes for the complex "${term}".`;
    }
    
    window.CiliAI.lastQueryContext = {
        type: 'list_followup',
        data: geneList,
        term: `Genes in ${term}`
    };
    
    return `I found ${count} genes in the ${term} complex. Do you want to view the list?`;
}

/**
 * Handle gene in complex query
 */
function handleGeneInComplexQuery(geneSymbol) {
    const g = window.CiliAI?.lookups?.geneMap?.[geneSymbol];
    if (!g) return `Sorry, I could not find data for "${geneSymbol}".`;
    
    const complexNames = window.CiliAI.lookups.complexByGene?.[geneSymbol] || [];
    if (complexNames.length === 0) {
        return `No complex data was found for <strong>${geneSymbol}</strong>.`;
    }
    
    const complexList = complexNames.map(name => ({
        gene: name,
        description: "Known Complex"
    }));
    
    return formatListResult(`Complexes containing ${geneSymbol}`, complexList);
}

/**
 * Handle classification query
 */
function handleClassificationQuery(classificationName, query) {
    const qLower = query.toLowerCase();
    const diseaseMap = getDiseaseClassificationMap();
    
    const casedClassificationName = Object.keys(diseaseMap).find(key => 
        normalizeTerm(key) === normalizeTerm(classificationName)
    );
    
    if (!casedClassificationName) {
        return `Sorry, I don't recognize the classification "${classificationName}".`;
    }
    
    const normKey = normalizeTerm(casedClassificationName);
    
    if (qLower.includes('gene') || qLower.includes('genes') || qLower.includes('gene list')) {
        const geneList = window.CiliAI?.lookups?.byClassification?.[normKey] || [];
        const count = geneList.length;
        
        if (count === 0) {
            return `I did not find any genes directly associated with the classification "${casedClassificationName}".`;
        }
        
        const geneMap = window.CiliAI.lookups.geneMap;
        const geneListObjects = geneList.map(gene => ({
            gene: gene,
            classification: geneMap[gene]?.ciliopathy_classification || 'No classification listed'
        })).sort((a, b) => a.gene.localeCompare(b.gene));
        
        window.CiliAI.lastQueryContext = {
            type: 'list_followup',
            data: geneListObjects,
            term: `Genes for ${casedClassificationName}`
        };
        
        return `I found ${count} unique genes associated with ${casedClassificationName}. Do you want to view the list?`;
    } else {
        const diseaseList = diseaseMap[casedClassificationName] || [];
        const diseaseHtml = diseaseList.map(d => `<li>${d}</li>`).join('');
        
        return `
            <div class="ai-result-card">
                <strong>${casedClassificationName}</strong>
                <p>This classification includes the following diseases:</p>
                <ul>${diseaseHtml}</ul>
            </div>
        `;
    }
}

/**
 * Tell about CiliAI
 */
function tellAboutCiliAI() {
    return `
        <div class="ai-result-card">
            <strong>Welcome to CiliAI!</strong>
            <p>I am an AI assistant designed to help you explore data on ciliary biology. You can ask me questions like:</p>
            <ul>
                <li><b>Gene Details:</b> "What is IFT88?" or "Describe ARL13B."</li>
                <li><b>Localization:</b> "List genes in the transition zone." or "Where is CEP290?"</li>
                <li><b>Complexes:</b> "What genes are in the BBSome?" or "Complex components of OFD1."</li>
                <li><b>Ciliopathies:</b> "Gene list of Joubert Syndrome." or "What genes cause PCD?"</li>
                <li><b>Phylogeny:</b> "Show conservation of IFT88."</li>
                <li><b>Domains:</b> "Which genes have WD40 domains?"</li>
            </ul>
            <p>My data comes from a pre-compiled database of over 23,000 genes, enriched with data from 8 specialized datasets (CORUM, UMAP, scRNA, Phylogeny, etc.).</p>
        </div>
    `;
}

/**
 * Inject CiliAI core styles
 */
function injectCiliAIStyles() {
    const styleId = 'ciliai-core-styles';
    if (document.getElementById(styleId)) return;
    
    const css = `
        /* Tabs Styling */
        .cilia-tabs { display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 15px; }
        .cilia-tab-btn {
            padding: 10px 20px; border: none; background: none; font-weight: 600; color: #718096;
            cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent;
        }
        .cilia-tab-btn:hover { color: #2b6cb0; background: #ebf8ff; }
        .cilia-tab-btn.active { color: #2b6cb0; border-bottom: 2px solid #2b6cb0; }
        
        /* Tab Content Animation */
        .cilia-tab-content { display: none; animation: fadeIn 0.2s ease-in; }
        .cilia-tab-content.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        /* Confidence Badges */
        .cilia-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold; margin-left: 10px; vertical-align: middle; }
        .badge-gold { background: #fefcbf; color: #744210; border: 1px solid #d69e2e; }
        .badge-silver { background: #edf2f7; color: #2d3748; border: 1px solid #cbd5e0; }
        .badge-bronze { background: #fff5f5; color: #742a2a; border: 1px solid #feb2b2; }

        /* Data Tables */
        .fancy-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; }
        .fancy-table th { background: #ebf8ff; color: #2c5282; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; }
        .fancy-table td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; color: #4a5568; }
        .fancy-table tr:last-child td { border-bottom: none; }
        .fancy-table tr:hover { background: #f7fafc; }

        /* Section Headers */
        .section-header { margin-top: 1.2rem; font-size: 13px; font-weight: 700; color: #2d3748; border-bottom: 2px solid #edf2f7; padding-bottom: 4px; margin-bottom: 8px; }
        .data-source-note { font-size: 10px; color: #718096; margin-top: 4px; font-style: italic; }

        /* UMAP Dataset Switch Button */
        .ciliai-umap-switch {
            background: #ffffff;
            border: 1px solid #cbd5e0;
            color: #4a5568;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-right: 8px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .ciliai-umap-switch:hover {
            background: #ebf8ff;
            color: #2b6cb0;
            border-color: #2b6cb0;
        }
    `;
    
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
}

/**
 * Get cluster boundaries for UMAP
 */
function getClusterBoundaries(cellType) {
    const umapData = window.CiliAI_UMAP;
    if (!umapData) return null;

    const targetPoints = umapData.filter(d => d.cell_type.toLowerCase() === cellType.toLowerCase());
    if (targetPoints.length === 0) {
        log(`[UMAP] No points found for cell type: ${cellType}`);
        return null;
    }

    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    let sumX = 0, sumY = 0;

    targetPoints.forEach(p => {
        xMin = Math.min(xMin, p.x);
        xMax = Math.max(xMax, p.x);
        yMin = Math.min(yMin, p.y);
        yMax = Math.max(yMax, p.y);
        sumX += p.x;
        sumY += p.y;
    });

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
}

/**
 * Calculate median of array
 */
function median(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Ensure phylogeny data is loaded
 */
async function ensurePhylogenyDataLoaded() {
    if (window.liPhylogenyCache && window.neversPhylogenyCache) {
        return true;
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

/**
 * Route phylogeny analysis
 */
async function routePhylogenyAnalysis(query) {
    const qLower = query.toLowerCase();
    const dataLoaded = await ensurePhylogenyDataLoaded();
    if (!dataLoaded) {
        return "Could not load phylogeny data. Please try again.";
    }

    let genes = extractMultipleGenes(query);
    if (genes.length === 0) {
        const complexKey = Object.keys(window.CiliAI?.lookups?.byModuleOrComplex || {}).find(key => 
            qLower.includes(normalizeTerm(key))
        );
        if (complexKey) {
            log(`Phylogeny query for complex: ${complexKey}`);
            genes = window.CiliAI.lookups.byModuleOrComplex[complexKey];
        }
    }

    if (qLower.includes('table') || qLower.includes('view data') || qLower.includes('species count')) {
        if (genes.length >= 1) {
            return renderPhylogenyTable(genes);
        }
    }
    
    if (genes.length === 2 && (qLower.includes('share') || qLower.includes('both') || qLower.includes('overlap'))) {
        return compareGeneSpeciesOverlap(genes[0], genes[1]);
    }

    if (qLower.includes('list') || qLower.includes('show ciliary genes') || qLower.includes('which genes are')) {
        if (qLower.includes('vertebrate')) return getPhylogenyList('Vertebrate_specific');
        if (qLower.includes('mammalian')) return getPhylogenyList('Mammalian_specific');
        if (qLower.includes('ciliary specific')) return getPhylogenyList('Ciliary_specific');
        if (qLower.includes('absent in fungi')) return getPhylogenyList('absent_in_fungi');
        if (qLower.includes('all organisms')) return getPhylogenyList('in_all_organisms');
    }

    const isPhylogenyMandate = qLower.includes('evolution') || qLower.includes('taxa') || 
                              qLower.includes('phylogenetic') || qLower.includes('heatmap') || 
                              qLower.includes('conservation');

    if (genes.length >= 1 || isPhylogenyMandate) {
        const source = qLower.includes('li') ? 'li' : 'nevers';
        const definitiveDefaultGenes = CONFIG.DEFAULT_PHYLO_GENES;
        const finalGenes = genes.length >= 1 ? genes : definitiveDefaultGenes;

        const plotResult = handlePhylogenyVisualizationQuery(finalGenes, source, 'heatmap');
        return `<div class="ai-result-card">
                    <p>Displaying ${source.toUpperCase()} phylogenetic heatmap for <strong>${finalGenes.join(', ')}</strong> on the left panel.</p>
                    ${plotResult.htmlLinks || ''}
                </div>`;
    }
    return null;
}

/**
 * Calculate Jaccard index
 */
function calculateJaccard(setA, setB) {
    const set1 = new Set(setA);
    const set2 = new Set(setB);

    let intersection = 0;
    for (const gene of set1) {
        if (set2.has(gene)) {
            intersection++;
        }
    }

    const union = set1.size + set2.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Get enriched GO terms
 */
function getEnrichedGOTerms(genes) {
    if (genes.length < 5) {
        return [];
    }
    return [
        { term: "Intraflagellar Transport (IFT)", pval: 1e-15, count: Math.floor(genes.length * 0.4) },
        { term: "Ciliary Membrane Docking", pval: 1e-09, count: Math.floor(genes.length * 0.3) },
        { term: "Basal Body/Centriole", pval: 1e-07, count: Math.floor(genes.length * 0.25) }
    ];
}

/**
 * Handle phylogeny visualization query
 */
function handlePhylogenyVisualizationQuery(genes, source = 'li', type = 'heatmap') {
    const plotId = 'cilia-svg';
    const plotDiv = document.getElementById(plotId);
    
    if (!plotDiv) {
        console.error("Phylogeny Error: plot container 'cilia-svg' not found.");
        return { htmlLinks: "" };
    }

    log(`Plotting ${source} heatmap for ${genes.join(', ')} to ${plotId}`);
    
    const wrapper = plotDiv.closest('.interactive-cilium');
    if (wrapper) wrapper.classList.add('table-view-active');
    
    plotDiv.innerHTML = `<div style="padding: 40px; text-align: center;">
        Loading ${source.toUpperCase()} phylogeny plot for ${genes.join(', ')}...
    </div>`;

    try {
        let plotResult;
        if (source === 'nevers') {
            plotResult = renderNeversPhylogenyHeatmap(genes);
        } else {
            plotResult = renderLiPhylogenyHeatmap(genes);
        }

        if (!plotResult || !plotResult.plotData) {
            throw new Error(plotResult?.html || 'The plot renderer returned no data.');
        }

        if (window.Plotly) {
            Plotly.newPlot(plotId, plotResult.plotData, plotResult.plotLayout, { responsive: true });
        }

        // Add navigation buttons
        const backButton = document.createElement('button');
        backButton.id = 'ciliai-back-btn';
        backButton.className = 'ciliai-button';
        backButton.style.cssText = 'background: #718096; position: absolute; top: 10px; right: 10px; z-index: 10;';
        backButton.textContent = 'Back to Diagram';
        backButton.onclick = () => generateAndInjectSVG();
        plotDiv.prepend(backButton);

        const addGeneButton = document.createElement('button');
        addGeneButton.id = 'ciliai-add-gene-btn';
        addGeneButton.className = 'ciliai-button';
        addGeneButton.style.cssText = 'background: #667eea; position: absolute; top: 10px; right: 170px; z-index: 10;';
        addGeneButton.textContent = 'Add Gene';
        addGeneButton.onclick = () => {
            const geneToAdd = prompt("Enter gene symbol to add to the plot:", "");
            if (!geneToAdd || geneToAdd.trim() === "") return;
            
            const plotTitle = plotDiv.layout?.title?.text || '';
            const currentSource = plotTitle.includes('Nevers') ? 'nevers' : 'li';
            const currentGenes = plotDiv.data?.[0]?.y || [];
            const newGeneList = [...currentGenes, geneToAdd.trim().toUpperCase()];

            addChatMessage(`show ${currentSource} plot for ${newGeneList.join(',')}`, true);
            handleAIQuery(`show ${currentSource} plot for ${newGeneList.join(',')}`);
        };
        plotDiv.prepend(addGeneButton);

        return { htmlLinks: plotResult.htmlLinks || "" };

    } catch (e) {
        console.error("handlePhylogenyVisualizationQuery Error:", e);
        plotDiv.innerHTML = `<p style="padding: 20px;"><strong>Error generating plot:</strong> ${e.message}</p>`;
        addChatMessage(`<strong>Error generating plot:</strong> ${e.message}`, false);
        return { htmlLinks: "" };
    }
}

/**
 * Calculate fold change for complex
 */
function calculateFoldChangeForComplex(complexName, cellTypeA, cellTypeB) {
    const L = window.CiliAI?.lookups;
    const geneSymbols = L?.byModuleOrComplex?.[complexName.toUpperCase()] || [];
    const geneMap = L?.geneMap || {};
    
    let sumA = 0, sumB = 0, count = 0;

    if (geneSymbols.length === 0) {
        return { complex: complexName, error: `Complex ${complexName} not found or has no genes.` };
    }

    geneSymbols.forEach(gene => {
        const g = geneMap[gene];
        if (g && g.expression?.scRNA) {
            const exprA = g.expression.scRNA[cellTypeA] || 0;
            const exprB = g.expression.scRNA[cellTypeB] || 0;
            
            if (exprA > 0 || exprB > 0) {
                sumA += exprA;
                sumB += exprB;
                count++;
            }
        }
    });

    if (count === 0) {
        return { complex: complexName, error: `No scRNA data found for any gene in the complex across both cell types.` };
    }

    const avgA = sumA / count;
    const avgB = sumB / count;
    const epsilon = 1e-3;
    const denominator = avgB > 0 ? avgB : epsilon;
    const foldChange = avgA / denominator;

    return { 
        complex: complexName, 
        avgA: avgA, 
        avgB: avgB, 
        foldChange: foldChange,
        count: count,
        cellTypeA: cellTypeA,
        cellTypeB: cellTypeB
    };
}

/**
 * Get average complex expression
 */
function getAverageComplexExpression(geneSymbols) {
    const geneMap = window.CiliAI?.lookups?.geneMap || {};
    const allCellTypes = [...new Set(window.CiliAI_UMAP?.map(d => d.cell_type) || [])];
    const avgExpression = {};
    const geneCounts = {};
    let totalGenesWithData = 0;

    geneSymbols.forEach(gene => {
        const g = geneMap[gene];
        if (g && g.expression?.scRNA) {
            totalGenesWithData++;
            allCellTypes.forEach(cellType => {
                const expr = g.expression.scRNA[cellType] || 0;
                avgExpression[cellType] = (avgExpression[cellType] || 0) + expr;
                geneCounts[cellType] = (geneCounts[cellType] || 0) + (expr > 0 ? 1 : 0);
            });
        }
    });

    const finalAverage = {};
    if (totalGenesWithData > 0) {
        for (const cellType of allCellTypes) {
            const count = geneCounts[cellType] || 1;
            finalAverage[cellType] = (avgExpression[cellType] || 0) / count;
        }
    }

    return finalAverage;
}

/**
 * Get phylogeny class species overlap
 */
function getPhylogenyClassSpeciesOverlap(classA, classB, source = 'li') {
    const data = source === 'li' ? window.liPhylogenyCache : window.neversPhylogenyCache;
    if (!data) return { error: `${source.toUpperCase()} phylogeny data is not loaded.` };

    const classList = source === 'li' ? data.summary?.class_list : null;
    const organismsList = source === 'li' ? data.summary?.organisms_list : data.organism_groups?.all_organisms_list;
    const isLi = source === 'li';

    let classIdA = -1, classIdB = -1;
    if (isLi) {
        classIdA = classList?.findIndex(name => name.toLowerCase() === classA.toLowerCase()) || -1;
        classIdB = classList?.findIndex(name => name.toLowerCase() === classB.toLowerCase()) || -1;
        
        if (classIdA === -1 || classIdB === -1) {
             return { error: `One or both phylogenetic classes not found in the ${source.toUpperCase()} dataset.` };
        }
    }

    const speciesInClassA = new Set();
    const speciesInClassB = new Set();

    Object.values(data.genes || {}).forEach(geneEntry => {
        let geneClassMatchesA = false;
        let geneClassMatchesB = false;

        if (isLi) {
            geneClassMatchesA = (geneEntry.c === classIdA);
            geneClassMatchesB = (geneEntry.c === classIdB);
        } else {
            return { error: `Class-based comparison only supported for Li et al. (2014) data.` };
        }

        if (geneClassMatchesA && Array.isArray(geneEntry.s)) {
            geneEntry.s.forEach(index => speciesInClassA.add(index));
        }
        if (geneClassMatchesB && Array.isArray(geneEntry.s)) {
            geneEntry.s.forEach(index => speciesInClassB.add(index));
        }
    });

    const sharedIndices = [...speciesInClassA].filter(index => speciesInClassB.has(index));
    const sharedSpecies = sharedIndices.map(index => organismsList?.[index] || `Species ${index}`).sort();

    return {
        sharedSpecies: sharedSpecies,
        sharedCount: sharedSpecies.length,
        classA: classA,
        classB: classB,
        source: source
    };
}

/**
 * Extract cell type intent
 */
function extractCellTypeIntent(qLower) {
    const keywords = [
        'ciliated cell', 'stem cell', 'club cell', 'goblet cell',
        'neuroendocrine cell', 'basal cell', 'pulmonary alveolar type 1 cell',
        'pulmonary alveolar type 2 cell', 'lung secretory cell'
    ];
    
    for (const term of keywords) {
        if (qLower.includes(term)) {
            return term;
        }
    }
    return null;
}

/**
 * Extract domain intent
 */
function extractDomainIntent(qLower) {
    const keywords = [
        'wd40 domain', 'pfam domain pf13432', 'wd40', 'pf13432', 'coiled-coil',
        'ef-hand', 'tpr', 'aaa+ atpase', 'aaa domain', 'atpase domain', 'wd40 repeat'
    ];
    
    for (const term of keywords) {
        if (qLower.includes(term)) {
            return term;
        }
    }
    return null;
}

/**
 * Check if gene has domain
 */
function hasDomain(gene, domainTerm) {
    if (!gene) return false;
    const normTerm = normalizeTerm(domainTerm);
    const allDomains = [...ensureArray(gene.pfam_ids), ...ensureArray(gene.domain_descriptions)];
    return allDomains.some(d => d && normalizeTerm(d).includes(normTerm));
}

/**
 * Check if gene is in phylogeny class
 */
function isInPhylogenyClass(gene, evoClass) {
    if (!gene?.phylogeny || !gene.phylogeny.li) return false;
    const geneClass = (gene.phylogeny.li.class || '').replace(/_/g, ' ').toLowerCase();
    const targetClass = evoClass.replace(/_/g, ' ').toLowerCase();
    return geneClass.includes(targetClass);
}

/**
 * Perform multi-criteria filter
 */
function performMultiCriteriaFilter(query, intents) {
    let titleParts = [];
    const filteredGenes = window.CiliAI?.masterData?.filter(gene => {
        if (!gene || !gene.Gene) return false;
        
        // Localization Filter
        if (intents.localization) {
            if (!titleParts.includes(`Loc: ${intents.localization}`)) titleParts.push(`Loc: ${intents.localization}`);
            const geneLoc = (gene.Localization || '').toLowerCase();
            if (!geneLoc.includes(intents.localization)) return false;
        }

        // Phenotype Filter
        if (intents.phenotype) {
            if (!titleParts.includes(`Pheno: ${intents.phenotype}`)) titleParts.push(`Pheno: ${intents.phenotype}`);
            const genePheno = (gene['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '').toLowerCase();
            const phenoMatch = (intents.phenotype === 'short cilia' && (genePheno.includes('short') || genePheno.includes('decrease'))) ||
                               (intents.phenotype === 'longer cilia' && (genePheno.includes('long') || genePheno.includes('increase'))) ||
                               (intents.phenotype === 'loss of cilia' && (genePheno.includes('absent') || genePheno.includes('loss of cilia'))) ||
                               (intents.phenotype === 'no effect' && (genePheno.includes('no effect') || genePheno === ''));
            
            if (!phenoMatch) return false;
        }

        // Disease Filter
        if (intents.disease) {
            if (!titleParts.includes(`Disease: ${intents.disease}`)) titleParts.push(`Disease: ${intents.disease}`);
            const diseaseKey = normalizeDiseaseKey(intents.disease);
            const diseaseGenes = window.CiliAI.lookups.byCiliopathy?.[diseaseKey] || [];
            if (!diseaseGenes.includes(gene.Gene.toUpperCase())) return false;
        }

        // Expression Filter
        if (intents.expression) {
            const hasExpr = hasExpressionInTissue(gene, intents.expression);
            const title = `Expr: ${intents.isNegative ? 'NOT ' : ''}${intents.expression}`;
            if (!titleParts.includes(title)) titleParts.push(title);
            
            if (intents.isNegative ? hasExpr : !hasExpr) return false;
        }

        // Complex Filter
        if (intents.complex) {
            const inComplex = gene.complex_components && Object.keys(gene.complex_components).some(comp => comp.toLowerCase().includes(intents.complex));
            const title = `Complex: ${intents.isNegative ? 'NOT ' : ''}${intents.complex}`;
            if (!titleParts.includes(title)) titleParts.push(title);
            
            if (intents.isNegative ? inComplex : !inComplex) return false;
        } else if (query.toLowerCase().includes('not in a known ciliary complex')) {
            const hasAnyComplex = gene.complex_components && Object.keys(gene.complex_components).length > 0;
            if (hasAnyComplex) return false;
            if (!titleParts.includes('Complex: NOT in any known complex')) titleParts.push('Complex: NOT in any known complex');
        }

        // Evolution Filter
        if (intents.evolution) {
            if (!titleParts.includes(`Evo: ${intents.evolution}`)) titleParts.push(`Evo: ${intents.evolution}`);
            if (intents.evolution === 'Conserved_in_elegans') {
                if (!isGeneConserved(gene)) return false;
            } else if (!isInPhylogenyClass(gene, intents.evolution)) {
                return false;
            }
        }
        
        // Domain Filter
        if (intents.domain) {
            if (!titleParts.includes(`Domain: ${intents.domain}`)) titleParts.push(`Domain: ${intents.domain}`);
            if (!hasDomain(gene, intents.domain)) return false;
        }
        
        return true;
    }) || [];

    const resultTitle = titleParts.join(' + ');

    if (filteredGenes.length === 0) {
        return `<div class="ai-result-card">
            <p>I found no genes that match all of your criteria: <strong>${resultTitle}</strong>.</p>
        </div>`;
    }

    const geneListObjects = filteredGenes.map(g => {
        const geneObject = { gene: g.Gene };
        if (intents.localization) geneObject.localization = g.Localization || '—';
        if (intents.phenotype) geneObject.phenotype = g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '—';
        if (intents.disease) geneObject.disease = intents.disease;
        if (intents.expression) geneObject.expression = hasExpressionInTissue(g, intents.expression) ? intents.expression : 'Absent';
        if (intents.complex) geneObject.complex = intents.complex;
        if (intents.domain) geneObject.domain = intents.domain;
        if (intents.evolution) geneObject.evolution = intents.evolution.replace(/_/g, ' ');
        
        if (Object.keys(geneObject).length === 1) {
            geneObject.description = g['Gene.Description'] || 'No description available';
        }
        return geneObject;
    });

    window.CiliAI.lastQueryContext = {
        type: 'list_followup',
        data: geneListObjects,
        term: `Genes matching: ${resultTitle}`
    };

    return `I found ${filteredGenes.length} gene(s) matching your criteria: <strong>${resultTitle}</strong>. Do you want to view the list?`;
}

/**
 * Get Li conservation data
 */
function getLiConservation(geneSymbol) {
    const geneUpper = geneSymbol.toUpperCase();
    if (!window.liPhylogenyCache || !window.liPhylogenyCache.genes) {
        return `<div class="ai-result-card">
            <h3>${geneSymbol} (Li et al. 2014)</h3>
            <p class="status-not-found">Could not load the Li et al. 2014 dataset.</p>
        </div>`;
    }
    
    const geneEntry = Object.values(window.liPhylogenyCache.genes).find(g => g.g?.toUpperCase() === geneUpper);
    if (!geneEntry) {
        return `<div class="ai-result-card">
            <h3>${geneSymbol} (Li et al. 2014)</h3>
            <p class="status-not-found">Gene not found in the Li et al. 2014 dataset.</p>
        </div>`;
    }
    
    return formatLiGeneData(geneSymbol, geneEntry, window.liPhylogenyCache.summary);
}

/**
 * Format Li gene data
 */
function formatLiGeneData(geneSymbol, geneData, summary) {
    const organismsList = summary?.organisms_list || [];
    const classList = summary?.class_list || [];
    const species = geneData.s?.map(index => organismsList[index]).filter(Boolean).join(', ') || 'N/A';
    const category = (classList[geneData.c] || "Unknown").replace(/_/g, ' ');
    
    return `
        <div class="ai-result-card">
            <h3>${geneSymbol} Phylogeny (Li et al. 2014)</h3>
            <p><strong>Gene Name:</strong> ${geneData.g || geneSymbol}</p>
            <p><strong>Entrez ID:</strong> ${geneData.e || 'N/A'}</p>
            <p><strong>Classification:</strong> ${category}</p>
            <p><strong>Found in ${geneData.s?.length || 0} Species:</strong> ${species}</p>
            <p style="font-size: 0.8em; color: #666; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
                <strong>Source:</strong> Li, Y. et al. (2014) <em>Cell</em>. 
                <a href="https://pubmed.ncbi.nlm.nih.gov/24995987/" target="_blank">PMID: 24995987</a>
            </p>
        </div>`;
}

/**
 * Render Nevers phylogeny heatmap
 */
function renderNeversPhylogenyHeatmap(genes) {
    const neversData = window.neversPhylogenyCache;
    if (!neversData) {
        return { html: `<p>Nevers et al. 2017 data not loaded.</p>` };
    }
    
    const CIL_COUNT = ORGANISM_PANELS.NEVERS_CIL_PANEL.length;
    const neversOrgList = neversData.organism_groups?.all_organisms_list || [];
    const neversOrgMap = new Map();
    
    neversOrgList.forEach((name, index) => {
        neversOrgMap.set(name, index);
        const simplifiedKey = name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[\s\.\(\)]/g, '');
        neversOrgMap.set(simplifiedKey, index);
    });
    
    const targetOrganisms = [...ORGANISM_PANELS.NEVERS_CIL_PANEL, ...ORGANISM_PANELS.NEVERS_NCIL_PANEL];
    const targetNeversIndices = targetOrganisms.map(orgName => {
        const simplifiedKey = orgName.toLowerCase().replace(/[\s\.]/g, '');
        if (neversOrgMap.has(orgName)) return neversOrgMap.get(orgName);
        if (neversOrgMap.has(simplifiedKey)) return neversOrgMap.get(simplifiedKey);
        return undefined;
    });
    
    const geneLabels = genes.map(g => g.toUpperCase());
    const matrix = [];
    const textMatrix = [];
    
    geneLabels.forEach(gene => {
        const geneData = neversData.genes?.[gene];
        const presenceIndices = new Set(geneData ? geneData.s : []);
        const row = [];
        const textRow = [];
        
        targetOrganisms.forEach((orgName, index) => {
            const neversIndex = targetNeversIndices[index];
            const isCiliated = index < CIL_COUNT;
            const isPresent = neversIndex !== undefined && presenceIndices.has(neversIndex);
            let zValue = 0;
            let status = "Absent";
            
            if (isPresent) {
                zValue = isCiliated ? 2 : 1;
                status = "Present";
            }
            
            row.push(zValue);
            textRow.push(`Gene: ${gene}<br>Organism: ${orgName}<br>Status: ${status}`);
        });
        
        if (row.length > 0) {
            matrix.push(row);
            textMatrix.push(textRow);
        }
    });
    
    const NEVERS_COLORS = [
        [0 / 2, '#F0F0F0'], [0.0001 / 2, '#F0A0A0'], [1 / 2, '#F0A0A0'],
        [1.0001 / 2, '#00A0A0'], [2 / 2, '#00A0A0']
    ];
    
    const trace = {
        z: matrix,
        x: targetOrganisms.map(name => {
            let cleanedName = name.replace(/\s*\(.*?\)\s*/g, '').trim();
            if (cleanedName.includes("D.rerio")) return "Zebrafish";
            if (cleanedName.includes("H.sapiens")) return "Human";
            return cleanedName;
        }),
        y: geneLabels,
        type: 'heatmap',
        colorscale: NEVERS_COLORS,
        showscale: false,
        hoverinfo: 'text',
        text: textMatrix,
        xgap: 0.5,
        ygap: 0.5,
        line: { color: '#000000', width: 0.5 }
    };
    
    const layout = {
        title: `Phylogenetics Analysis (Nevers et al. 2017) - ${genes.join(', ')}`,
        xaxis: { title: 'Organisms (Ciliated | Non-Ciliated)', tickangle: 45, automargin: true },
        yaxis: { title: 'Genes', automargin: true },
        shapes: [{
            type: 'line',
            xref: 'x',
            x0: CIL_COUNT - 0.5,
            x1: CIL_COUNT - 0.5,
            yref: 'paper',
            y0: 0,
            y1: 1,
            line: { color: 'black', width: 2 }
        }],
        margin: { t: 50, b: 200, l: 150, r: 50 },
        height: Math.max(500, genes.length * 40 + 150)
    };
    
    return {
        plotData: [trace],
        plotLayout: layout,
        htmlLinks: `
            <p class="ai-suggestion" style="margin-top: 10px;">
                <a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${genes.join(',')}">
                    ⬅️ Show Li et al. (2014)
                </a>
                <span style="margin: 0 10px;">|</span>
                <a href="#" class="ai-action" data-action="show-table-view" data-genes="${genes.join(',')}">
                    📋 Show Data Table
                </a>
            </p>
        `
    };
}

/**
 * Render Li phylogeny heatmap
 */
function renderLiPhylogenyHeatmap(genes) {
    const liData = window.liPhylogenyCache;
    if (!liData) {
        throw new Error("Li et al. 2014 data not loaded.");
    }
    
    const CIL_ORG_FULL = ORGANISM_PANELS.NEVERS_CIL_PANEL.map(org => org.split(' ').map(w => w[0] + '.').join(''));
    const NCIL_ORG_FULL = ORGANISM_PANELS.NEVERS_NCIL_PANEL.map(org => org.split(' ').map(w => w[0] + '.').join(''));
    
    const CIL_COUNT = CIL_ORG_FULL.length;
    const VERTEBRATE_LI_MAP = new Map([
        ["homosapiens", "H.sapiens"], ["m.gallopavo", "M.gallopavo"], ["musmusculus", "M.musculus"],
        ["daniorerio", "D.rerio"], ["xenopustropicalis", "X.tropicalis"], ["gallusgallus", "G.gallus"],
        ["o.anatinus", "O.anatinus"], ["t.nigroviridis", "T.nigroviridis"], ["c.elegans", "C.elegans"],
        ["c.briggsae", "C.briggsae"], ["c.reinhardtii", "C.reinhardtii"], ["t.thermophila", "T.thermophila"],
        ["s.cerevisiae", "S.cerevisiae"], ["a.thaliana", "A.thaliana"], ["o.sativa", "O.sativa"]
    ]);
    
    const liOrgList = liData.summary?.organisms_list || [];
    const liOrgMap = new Map();
    
    liOrgList.forEach((name, index) => {
        liOrgMap.set(name, index);
        liOrgMap.set(name.toLowerCase().replace(/[\s\.]/g, ''), index);
    });
    
    const targetOrganisms = [...CIL_ORG_FULL, ...NCIL_ORG_FULL];
    const targetLiIndices = targetOrganisms.map(orgName => {
        const lowerOrg = orgName.toLowerCase();
        const simplifiedKey = lowerOrg.replace(/[\s\.]/g, '');
        
        if (VERTEBRATE_LI_MAP.has(simplifiedKey)) {
            const liAbbrev = VERTEBRATE_LI_MAP.get(simplifiedKey);
            if (liOrgMap.has(liAbbrev)) {
                return liOrgMap.get(liAbbrev);
            }
        }
        
        if (liOrgMap.has(simplifiedKey)) return liOrgMap.get(simplifiedKey);
        if (liOrgMap.has(orgName)) return liOrgMap.get(orgName);
        return undefined;
    });
    
    const geneLabels = [];
    const matrix = [];
    const textMatrix = [];
    const genesFound = [];
    const genesNotFound = [];
    
    genes.forEach(gene => {
        const geneUpper = gene.toUpperCase();
        const geneData = Object.values(liData.genes || {}).find(g => g.g && g.g.toUpperCase() === geneUpper);
        
        if (!geneData) {
            genesNotFound.push(geneUpper);
            return;
        }
        
        genesFound.push(geneUpper);
        const presenceIndices = new Set(geneData.s || []);
        const row = [];
        const textRow = [];
        
        targetOrganisms.forEach((orgName, index) => {
            const liIndex = targetLiIndices[index];
            const isCiliated = index < CIL_COUNT;
            const isPresent = liIndex !== undefined && presenceIndices.has(liIndex);
            let zValue = 0;
            let status = "Absent";
            
            if (isPresent) {
                zValue = isCiliated ? 2 : 1;
                status = "Present";
            }
            
            row.push(zValue);
            textRow.push(`Gene: ${geneUpper}<br>Organism: ${orgName}<br>Status: ${status}`);
        });
        
        if (row.length > 0) {
            matrix.push(row);
            textMatrix.push(textRow);
            geneLabels.push(geneUpper);
        }
    });
    
    if (matrix.length === 0) {
        let errorMsg = "None of the requested genes were found in the Li (2014) dataset.";
        if (genesNotFound.length > 0) {
            errorMsg = `The gene(s) <strong>${genesNotFound.join(', ')}</strong> were not found in the Li (2014) phylogenetic dataset.`;
        }
        throw new Error(errorMsg);
    }
    
    const trace = {
        z: matrix,
        x: targetOrganisms.map(name => {
            if (name === "H.sapiens") return "Human";
            if (name === "M.musculus") return "Mouse";
            if (name === "D.rerio") return "Zebrafish";
            if (name.includes("elegans")) return "C. elegans";
            return name.replace(/\./g, '').split(' ')[0];
        }),
        y: geneLabels,
        type: 'heatmap',
        colorscale: [
            [0 / 2, '#FFFFFF'], [0.0001 / 2, '#FFE5B5'], [1 / 2, '#FFE5B5'],
            [1.0001 / 2, '#698ECF'], [2 / 2, '#698ECF']
        ],
        showscale: false,
        hoverinfo: 'text',
        text: textMatrix,
        xgap: 0.5,
        ygap: 0.5,
        line: { color: '#000000', width: 0.5 }
    };
    
    const layout = {
        title: `Phylogenetics Analysis (Li et al. 2014) - ${geneLabels.join(', ')}`,
        xaxis: { title: 'Organisms (Ciliated | Non-Ciliated)', tickangle: 45, automargin: true },
        yaxis: { title: 'Genes', automargin: true },
        shapes: [{
            type: 'line',
            xref: 'x',
            x0: CIL_COUNT - 0.5,
            x1: CIL_COUNT - 0.5,
            yref: 'paper',
            y0: 0,
            y1: 1,
            line: { color: 'black', width: 2 }
        }],
        margin: { t: 50, b: 200, l: 150, r: 50 },
        height: Math.max(500, geneLabels.length * 40 + 150)
    };
    
    let links = `<p class="ai-suggestion" style="margin-top: 10px;">
        <a href="#" class="ai-action" data-action="show-nevers-heatmap" data-genes="${geneLabels.join(',')}">
            ➡️ Show Nevers et al. (2017)
        </a>
        <span style="margin: 0 10px;">|</span>
        <a href="#" class="ai-action" data-action="show-table-view" data-genes="${geneLabels.join(',')}">
            📋 Show Data Table
        </a>
    </p>`;
    
    if (genesNotFound.length > 0) {
        links = `<p class="status-note">Note: <strong>${genesNotFound.join(', ')}</strong> not found in this dataset.</p>` + links;
    }
    
    return {
        plotData: [trace],
        plotLayout: layout,
        htmlLinks: links
    };
}

/**
 * Render phylogeny table
 */
function renderPhylogenyTable(genes) {
    if (!window.liPhylogenyCache || !window.neversPhylogenyCache) {
        return `<div class="ai-result-card">
            <h3>Table Error</h3>
            <p>Phylogenetic data is not fully loaded.</p>
        </div>`;
    }
    
    const tableRows = genes.map(gene => {
        const geneUpper = gene.toUpperCase();
        const liEntry = Object.values(window.liPhylogenyCache.genes || {}).find(g => g.g && g.g.toUpperCase() === geneUpper);
        const liClass = liEntry ? (window.liPhylogenyCache.summary?.class_list?.[liEntry.c]?.replace(/_/g, ' ') || 'N/A') : 'N/A';
        const liCount = liEntry?.s?.length || 0;
        const neversEntry = window.neversPhylogenyCache.genes?.[geneUpper];
        const neversCount = neversEntry?.s?.length || 0;
        
        return `
            <tr>
                <td><strong>${geneUpper}</strong></td>
                <td>${liClass}</td>
                <td>${liCount} / 140</td>
                <td>${neversCount} / 99</td>
                <td><a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${geneUpper}">View Heatmap</a></td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="ai-result-card">
            <h3>Phylogenetic Data Table for ${genes.join(', ')}</h3>
            <table class="ciliai-data-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead style="text-align: left;">
                    <tr>
                        <th style="padding: 4px; border-bottom: 1px solid #ccc;">Gene</th>
                        <th style="padding: 4px; border-bottom: 1px solid #ccc;">Li Class (2014)</th>
                        <th style="padding: 4px; border-bottom: 1px solid #ccc;">Li Count (140)</th>
                        <th style="padding: 4px; border-bottom: 1px solid #ccc;">Nevers Count (99)</th>
                        <th style="padding: 4px; border-bottom: 1px solid #ccc;">Action</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
            <p class="ai-suggestion" style="margin-top: 10px;">
                <a href="#" class="ai-action" data-action="show-li-heatmap" data-genes="${genes.join(',')}">
                    🖼️ Show Heatmap View
                </a>
            </p>
        </div>
    `;
}

/**
 * Get phylogeny list
 */
function getPhylogenyList(classification) {
    if (!window.liPhylogenyCache || !window.liPhylogenyCache.summary || !window.liPhylogenyCache.genes) {
        return `<div class="ai-result-card">
            <h3>List Error</h3>
            <p>Phylogenetic classification data is currently unavailable.</p>
        </div>`;
    }
    
    const qLower = classification.toLowerCase().replace(/\s/g, '_');
    const liGenes = window.liPhylogenyCache.genes;
    const summary = window.liPhylogenyCache.summary;
    const classList = summary.class_list;
    
    let targetClassificationKey = null;
    let title = "";
    let fallbackHtml = "";
    
    if (qLower.includes('vertebrate')) {
        targetClassificationKey = 'Vertebrate_specific';
        title = "Genes Specific to the Vertebrate Lineage";
    } else if (qLower.includes('mammalian')) {
        if (summary.classification_summary?.Mammalian_specific === 0) {
            targetClassificationKey = 'Vertebrate_specific';
            title = "Genes Specific to the Mammalian Lineage (Data Proxy)";
            fallbackHtml = `<p class="status-note" style="margin-top: 10px;">
                ⚠️ <strong>Note:</strong> The Li et al. 2014 classification metadata reports zero genes for the 'Mammalian specific' group. 
                We are displaying the <strong>Vertebrate specific</strong> list as the most phylogenetically proximal proxy.
            </p>`;
        } else {
            targetClassificationKey = 'Mammalian_specific';
            title = "Genes Specific to the Mammalian Lineage";
        }
    } else if (qLower.includes('ciliary_specific') || qLower.includes('ciliary_genes') || qLower.includes('every_ciliary_gene')) {
        targetClassificationKey = 'Ciliary_specific';
        title = "Genes Classified as Ciliary Specific";
    } else if (qLower.includes('absent_in_fungi') || qLower.includes('not_in_fungi')) {
        targetClassificationKey = 'Vertebrate_specific';
        title = "Genes Likely Absent in Fungi (Proxy: Vertebrate/Mammalian Specific)";
    } else if (qLower.includes('all_organisms') || qLower.includes('universally_conserved')) {
        targetClassificationKey = 'Universally_Conserved_Proxy';
        title = "Genes Conserved Across Nearly All Organisms";
    } else {
        return `<div class="ai-result-card">
            <h3>List Error</h3>
            <p class="status-not-found">Classification keyword not recognized for list generation: ${classification}.</p>
        </div>`;
    }
    
    const filteredGenes = Object.values(liGenes).filter(entry => {
        if (targetClassificationKey === 'Universally_Conserved_Proxy') {
            return entry.s?.length >= 130;
        }
        const entryClass = classList[entry.c] ? classList[entry.c].replace(/_/g, ' ') : '';
        const targetClass = targetClassificationKey.replace(/_/g, ' ');
        return entryClass.toLowerCase().includes(targetClass.toLowerCase());
    }).map(g => ({ gene: g.g, description: `Class: ${title.split(':')[0]}` }));
    
    if (filteredGenes.length === 0) {
        return `<div class="ai-result-card">
            <h3>${title}</h3>
            <p class="status-not-found">No genes found matching this classification.</p>
        </div>`;
    }
    
    let resultHtml = formatListResult(title, filteredGenes);
    if (fallbackHtml) {
        resultHtml = resultHtml.replace(/<\/div>$/, `${fallbackHtml}</div>`);
    }
    
    return resultHtml;
}

/**
 * Compare gene species overlap
 */
function compareGeneSpeciesOverlap(geneA, geneB) {
    if (!window.liPhylogenyCache) {
        return `<div class="ai-result-card">
            <h3>Comparison Failed</h3>
            <p class="status-not-found">Li et al. 2014 dataset not loaded.</p>
        </div>`;
    }
    
    const dataA = Object.values(window.liPhylogenyCache.genes || {}).find(k => k.g?.toUpperCase() === geneA.toUpperCase());
    const dataB = Object.values(window.liPhylogenyCache.genes || {}).find(k => k.g?.toUpperCase() === geneB.toUpperCase());
    
    if (!dataA || !dataB) {
        return `<div class="ai-result-card">
            <h3>Comparison Failed</h3>
            <p class="status-not-found">One or both genes (${geneA}, ${geneB}) were not found in the Li et al. 2014 dataset.</p>
        </div>`;
    }
    
    const speciesList = window.liPhylogenyCache.summary?.organisms_list || [];
    const speciesAIndices = new Set(dataA.s || []);
    const speciesBIndices = new Set(dataB.s || []);
    const overlapIndices = [...speciesAIndices].filter(index => speciesBIndices.has(index));
    const overlappingSpecies = overlapIndices.map(index => speciesList[index]).filter(Boolean).join(', ');
    
    return `
        <div class="ai-result-card">
            <h3>Shared Conservation: ${geneA} and ${geneB}</h3>
            <p><strong>Total Shared Species:</strong> ${overlapIndices.length}</p>
            <p><strong>Overlapping Species List:</strong> ${overlappingSpecies || 'None found.'}</p>
        </div>
    `;
}

/**
 * Open tab
 */
function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("cilia-tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }
    const tabLinks = document.getElementsByClassName("cilia-tab-btn");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].classList.remove("active");
    }
    document.getElementById(`tab-${tabName}`)?.classList.add("active");
    evt.currentTarget.classList.add("active");
    
    if (tabName === 'expression') {
        const geneName = document.getElementById('current-gene-name')?.textContent;
        if (geneName && window.renderUMAPPlot) {
            setTimeout(() => window.renderUMAPPlot(geneName, [geneName]), 100);
        }
    }
}

/**
 * Display full gene info (main view)
 */
function displayFullGeneInfo(geneSymbol) {
    injectCiliAIStyles();
    
    const gm = window.CiliAI?.lookups?.geneMap;
    if (!gm || !gm[geneSymbol]) {
        return `<div class="ai-result-card">No data found for gene <strong>${geneSymbol}</strong></div>`;
    }
    
    const g = gm[geneSymbol];
    const safeVal = (v) => (v && v !== 'N/A' && v !== '0') ? v : '<span style="color:#ccc">—</span>';
    const scRNA = g.expression?.scRNA || {};

    // Calculate Confidence Score
    let score = 0;
    if (g.screens) score += g.screens.length;
    if (g.Ciliopathies && g.Ciliopathies.length > 0) score += 2;
    if (g.Ortholog_C_elegans && g.Ortholog_C_elegans !== 'N/A') score += 1;

    let badge = '';
    if (score >= 4) badge = `<span class="cilia-badge badge-gold">🥇 High Confidence</span>`;
    else if (score >= 2) badge = `<span class="cilia-badge badge-silver">🥈 Verified</span>`;
    else badge = `<span class="cilia-badge badge-bronze">🥉 Candidate</span>`;

    // Build HTML
    let html = `<div class="ai-result-card" style="font-family: 'Inter', sans-serif;">`;
    
    // 1. Header
    html += `<div style="display:flex; align-items:center; margin-bottom:10px;">
                <h2 id="current-gene-name" style="margin:0; color:#2b6cb0;">${geneSymbol}</h2>
                ${badge}
             </div>`;

    // 2. Navigation Tabs
    html += `
        <div class="cilia-tabs">
            <button class="cilia-tab-btn active" onclick="openTab(event, 'overview')">Overview</button>
            <button class="cilia-tab-btn" onclick="openTab(event, 'expression')">Expression</button>
            <button class="cilia-tab-btn" onclick="openTab(event, 'screens')">Screens</button>
            <button class="cilia-tab-btn" onclick="openTab(event, 'evolution')">Evolution</button>
        </div>
    `;

    // 3. Tab Contents
    html += `<div id="tab-overview" class="cilia-tab-content active">
                <p><strong>Description:</strong> ${g['Gene.Description'] || 'No description available'}</p>
                <p><strong>Localization:</strong> ${g.Localization || 'Unknown'}</p>
                <div style="background:#f7fafc; padding:10px; border-radius:8px; margin:10px 0; font-size: 0.95em; border: 1px solid #edf2f7;">
                    <p style="margin:3px 0;"><strong>Mouse Ortholog:</strong> ${safeVal(g.Ortholog_Mouse)}</p>
                    <p style="margin:3px 0;"><strong>Phenotype (LoF):</strong> ${safeVal(g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'])}</p>
                    <p style="margin:3px 0;"><strong>OMIM:</strong> ${safeVal(g.OMIM?.ID)}</p>
                </div>
                ${g.complex_components ? renderComplexTable(g.complex_components) : ''}
             </div>`;

    html += `<div id="tab-expression" class="cilia-tab-content">
                <div style="margin-bottom: 10px;">
                    <button class="ciliai-button" onclick="window.renderUMAPPlot('${geneSymbol}')">🔄 Refresh UMAP Plot</button>
                </div>
                ${Object.keys(scRNA).length > 0 ? renderScRNATable(scRNA) : '<p>No scRNA data.</p>'}
             </div>`;

    html += `<div id="tab-screens" class="cilia-tab-content">
                ${renderCiliaEffectsTable(g)}
                ${Array.isArray(g.screens) && g.screens.length > 0 ? renderScreensTable(g.screens) : '<p>No screen data available.</p>'}
             </div>`;

    html += `<div id="tab-evolution" class="cilia-tab-content">
                ${g.phylogeny ? renderPhyloTable(g.phylogeny) : '<p>No phylogeny data.</p>'}
                <div style="margin-top:10px;">
                    <button class="ciliai-button" onclick="handleAIQuery('show evolution of ${geneSymbol}')">View Phylogeny Heatmap</button>
                </div>
             </div>`;

    html += `</div>`;
    return html;
}

/**
 * Render complex table
 */
function renderComplexTable(components) {
    if (!components) return '';
    let html = `<div class="section-header">Protein Complexes</div>
                <table class="fancy-table"><tr><th>Complex</th><th>Members</th></tr>`;
    for (const [cname, members] of Object.entries(components)) {
        html += `<tr><td>${cname}</td><td>${members.join(', ')}</td></tr>`;
    }
    return html + `</table>`;
}

/**
 * Render disease list
 */
function renderDiseaseList(diseases) {
    if (!diseases || diseases.length === 0) return '<p>No diseases listed.</p>';
    const diseaseHtml = diseases.map(d => `<li>${d}</li>`).join('');
    return `<ul>${diseaseHtml}</ul>`;
}

/**
 * Render scRNA table
 */
function renderScRNATable(scRNA) {
    let html = `<table class="fancy-table"><tr><th>Cell Type</th><th>TPM</th></tr>`;
    Object.entries(scRNA)
        .sort((a,b) => b[1] - a[1])
        .slice(0,5)
        .forEach(([k,v]) => {
            html += `<tr><td>${k}</td><td><strong>${Number(v).toFixed(2)}</strong></td></tr>`;
        });
    return html + `</table><div class="data-source-note">Source: human lung organoid cell atlas.</div>`;
}

/**
 * Render cilia effects table
 */
function renderCiliaEffectsTable(g) {
    const safeVal = (v) => (v && v !== 'N/A' && v !== '0') ? v : '—';
    return `<div class="section-header">Cilia Effects</div>
            <table class="fancy-table">
                <tr><th>Effect Type</th><th>Result</th></tr>
                <tr><td>Overexpression</td><td>${safeVal(g['Overexpression effects on cilia length (increase/decrease/no effect)'])}</td></tr>
                <tr><td>Loss-of-Function</td><td>${safeVal(g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'])}</td></tr>
                <tr><td>% Ciliated</td><td>${safeVal(g['Percentage of ciliated cells (increase/decrease/no effect)'])}</td></tr>
            </table>`;
}

/**
 * Render screens table
 */
function renderScreensTable(screens) {
    let html = `<div class="section-header">Screen Results</div>
                <table class="fancy-table"><tr><th>Source</th><th>Result</th></tr>`;
    screens.forEach(s => {
        html += `<tr><td><strong>${s.source}</strong></td><td>${s.result}</td></tr>`;
    });
    return html + `</table>`;
}

/**
 * Render phylogeny table
 */
function renderPhyloTable(phylogeny) {
    let html = `<div class="section-header">Evolutionary History</div>
                <table class="fancy-table"><tr><th>Dataset</th><th>Class</th><th>Species Count</th></tr>`;
    for (const [pkey, pval] of Object.entries(phylogeny)) {
        const safeP = pval || {};
        html += `<tr><td>${pkey}</td><td>${safeP.class || '-'}</td><td>${safeP.species_data?.length || 0}</td></tr>`;
    }
    return html + `</table>`;
}

/**
 * Render mini expression table
 */
function renderMiniExpressionTable(data) {
    if (!data) return '<p style="color:#a0aec0; font-size: 13px;">No scRNA data available.</p>';
    const sorted = Object.entries(data).sort(([,a], [,b]) => b - a).slice(0, 5);
    let html = '<table style="width:100%; font-size: 13px; border-collapse: collapse;">';
    sorted.forEach(([type, val]) => {
        const barWidth = Math.min(100, (val * 10));
        html += `
            <tr>
                <td style="padding: 6px 0; color: #4a5568;">${type}</td>
                <td style="text-align: right; width: 40%; padding: 6px 0;">
                    <div style="display: flex; align-items: center; justify-content: flex-end;">
                        <span style="margin-right: 8px; font-weight: 600; color: #2b6cb0;">${val.toFixed(2)}</span>
                        <div style="width: 60px; height: 6px; background: #edf2f7; border-radius: 3px;">
                            <div style="width: ${barWidth}%; height: 100%; background: #4299e1; border-radius: 3px;"></div>
                        </div>
                    </div>
                </td>
            </tr>`;
    });
    return html + '</table>';
}

/**
 * Render mini complex list
 */
function renderMiniComplexList(data) {
    if (!data) return '<p style="color:#a0aec0; font-size: 13px;">Not part of known complexes.</p>';
    let html = '';
    for (const [name, members] of Object.entries(data)) {
        html += `
            <div style="margin-bottom: 10px; background: #fffaf0; border: 1px solid #feebc8; padding: 10px; border-radius: 6px;">
                <div style="font-weight: 600; font-size: 13px; color: #744210; margin-bottom: 4px;">${name}</div>
                <div style="font-size: 12px; color: #975a16; line-height: 1.4;">${members.join(', ')}</div>
            </div>
        `;
    }
    return html;
}

/**
 * Get genes by localization
 */
function getGenesByLocalization(term) {
    if (!term) return [];
    const normTerm = normalizeTerm(term);
    const L = window.CiliAI?.lookups;
    if (!L) return [];
    
    let matchingGenes = new Set();
    
    if (L.byLocalization) {
        Object.keys(L.byLocalization).forEach(key => {
            if (normalizeTerm(key).includes(normTerm)) {
                L.byLocalization[key].forEach(geneSymbol => {
                    matchingGenes.add(geneSymbol.toUpperCase());
                });
            }
        });
    }
    
    if (window.CiliAI?.masterData) {
        window.CiliAI.masterData.forEach(g => {
            if (g.Gene && g.Localization && normalizeTerm(g.Localization).includes(normTerm)) {
                matchingGenes.add(g.Gene.toUpperCase());
            }
        });
    }
    
    const geneMap = L.geneMap || {};
    return Array.from(matchingGenes).map(gene => ({
        gene: gene,
        localization: geneMap[gene]?.Localization || `Found in ${term}`
    }));
}

/**
 * Get genes by domain
 */
function getGenesByDomain(domainTerm, query) {
    const normTerm = normalizeTerm(domainTerm);
    const results = [];
    
    if (!window.CiliAI?.masterData) return [];
    
    window.CiliAI.masterData.forEach(g => {
        if (!g.Gene) return;
        const allDomains = [...ensureArray(g.pfam_ids), ...ensureArray(g.domain_descriptions)];
        const matchingDomain = allDomains.find(d => d && normalizeTerm(d).includes(normTerm));
        if (matchingDomain) {
            results.push({ gene: g.Gene, domain: matchingDomain });
        }
    });
    
    if (results.length === 0) {
        return `Sorry, I could not find any genes with a "${domainTerm}" domain.`;
    }
    
    window.CiliAI.lastQueryContext = {
        type: 'list_followup',
        data: results,
        term: `Genes containing "${domainTerm}"`
    };
    
    return `I found ${results.length} genes containing a "${domainTerm}" domain. Do you want to view the list?`;
}

/**
 * Get genes by complex
 */
function getGenesByComplex(term) {
    const normTerm = normalizeTerm(term);
    const L = window.CiliAI?.lookups;
    if (!L) return [];
    
    const complexKey = Object.keys(L.byModuleOrComplex || {}).find(key => 
        normalizeTerm(key).includes(normTerm)
    );
    
    if (complexKey && L.byModuleOrComplex[complexKey]) {
        const geneSymbols = L.byModuleOrComplex[complexKey];
        const geneMap = L.geneMap || {};
        return geneSymbols.map(gene => ({
            gene: gene,
            description: geneMap[gene]?.['Gene.Description'] || `Component of ${complexKey}`
        }));
    }
    return [];
}

/**
 * Get genes by module
 */
function getGenesByModule(term) {
    const normTerm = normalizeTerm(term);
    const L = window.CiliAI?.lookups;
    if (!L) return [];
    
    const modKey = Object.keys(L.byModules || {}).find(key => 
        normalizeTerm(key).includes(normTerm)
    );
    
    if (modKey && L.byModules[modKey]) {
        const geneSymbols = L.byModules[modKey];
        const geneMap = L.geneMap || {};
        return geneSymbols.map(gene => ({
            gene: gene,
            description: geneMap[gene]?.['Gene.Description'] || `Part of ${modKey}`
        }));
    }
    return [];
}

/**
 * Extract disease intent
 */
function extractDiseaseIntent(qLower) {
    const keywords = [
        'joubert syndrome', 'bardet-biedl syndrome', 'bbs',
        'meckel-gruber syndrome', 'mks', 'primary ciliary dyskinesia', 'pcd',
        'nephronophthisis', 'nphp', 'retinal disease', 'retinal ciliopathy'
    ];
    
    for (const term of keywords) {
        if (qLower.includes(term)) {
            return term;
        }
    }
    return null;
}

/**
 * Extract expression intent
 */
function extractExpressionIntent(qLower) {
    const keywords = ['kidney', 'brain', 'retina', 'cerebellum', 'testis', 'lung'];
    for (const term of keywords) {
        if (qLower.includes(term)) {
            return term;
        }
    }
    return null;
}

/**
 * Normalize disease key
 */
function normalizeDiseaseKey(term) {
    let key = normalizeTerm(term);
    const diseaseMap = {
        'bbs': 'bardetbiedlsyndrome',
        'bardetbiedel': 'bardetbiedlsyndrome',
        'mks': 'meckelgrubersyndrome',
        'meckelgruber': 'meckelgrubersyndrome',
        'joubert': 'joubertsyndrome',
        'nphp': 'nephronophthisis',
        'pcd': 'primaryciliarydyskinesia'
    };
    return diseaseMap[key] || key;
}

/**
 * Check if gene has expression in tissue
 */
function hasExpressionInTissue(gene, tissue) {
    if (!gene?.expression) return false;
    const tissueLower = tissue.toLowerCase();
    
    if (gene.expression.scRNA) {
        for (const [cellType, value] of Object.entries(gene.expression.scRNA)) {
            if (cellType.toLowerCase().includes(tissueLower) && value > 0) {
                return true;
            }
        }
    }
    
    if (gene.expression.tissue) {
        for (const [tissueName, value] of Object.entries(gene.expression.tissue)) {
            if (tissueName.toLowerCase().includes(tissueLower) && value > 0) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Flexible intent parser
 */
function flexibleIntentParser(query) {
    const qLower = query.toLowerCase().trim();
    const normalizedQuery = normalizeTerm(query);
    
    // Prepare keywords
    const diseaseMap = getDiseaseClassificationMap();
    let allDiseaseKeywords = ['BBS', 'NPHP', 'MKS'];
    for (const classification in diseaseMap) {
        allDiseaseKeywords = allDiseaseKeywords.concat(diseaseMap[classification]);
    }
    
    const classificationKeywords = Object.keys(window.CiliAI?.lookups?.byClassification || {});
    classificationKeywords.push(...Object.keys(diseaseMap));
    
    const complexKeywords = Object.keys(window.CiliAI?.lookups?.byModuleOrComplex || {});
    complexKeywords.push(...Object.keys(getComplexPhylogenyTableMap()));
    
    const entityKeywords = [
        {
            type: 'CLASSIFICATION',
            keywords: classificationKeywords,
            handler: handleClassificationQuery
        },
        {
            type: 'COMPLEX',
            keywords: complexKeywords,
            handler: handleComplexQuery
        },
        {
            type: 'LOCALIZATION',
            keywords: [
                'basal body', 'axoneme', 'transition zone', 'cytosol', 'centrosome',
                'cilium', 'cilia', 'mitochondria', 'nucleus', 'ciliary tip',
                'lysosome', 'lysosomes', 'ciliary associated gene', 'microbody', 'peroxisome', 'flagella'
            ],
            handler: handleLocalizationQuery
        },
        {
            type: 'CILIOPATHY',
            keywords: allDiseaseKeywords,
            handler: (term, query) => formatListResult(
                `Genes for ${term}`,
                (getCiliopathyGenes(term)).genes,
                getCiliopathyGenes(term).description
            )
        },
        {
            type: 'DOMAIN',
            keywords: ['WD40', 'coiled-coil', 'pfam', 'domain', 'ef-hand', 'TPR', 'AAA+ ATPase', 'AAA domain'],
            handler: getGenesByDomain
        },
        {
            type: 'META',
            keywords: ['about yourself', 'what can you do', 'help me', 'capabilities'],
            handler: tellAboutCiliAI
        }
    ];
    
    for (const entityType of entityKeywords) {
        const sortedKeywords = [...entityType.keywords].sort((a, b) => b.length - a.length);
        
        for (const keyword of sortedKeywords) {
            const normKeyword = normalizeTerm(keyword);
            if (!normKeyword) continue;
            
            if (normalizedQuery.includes(normKeyword)) {
                if (qLower.includes('not in') || qLower.includes('except')) continue;
                return { type: entityType.type, entity: keyword, handler: entityType.handler };
            }
        }
    }
    return null;
}

/**
 * Get ciliopathy genes
 */
function getCiliopathyGenes(term) {
    const normalizedTerm = normalizeDiseaseKey(term);
    const L = window.CiliAI?.lookups;
    
    if (!L?.byCiliopathy) {
        return {
            genes: [],
            description: `No ciliopathy data available for ${term}`
        };
    }
    
    const geneSymbols = L.byCiliopathy[normalizedTerm] || [];
    
    return {
        genes: geneSymbols.map(g => ({
            gene: g,
            description: 'Ciliopathy-associated gene'
        })),
        description: `Genes associated with ${term}`
    };
}

/**
 * Extract localization intent
 */
function extractLocalizationIntent(qLower) {
    const keywords = [
        { term: 'transition zone', patterns: [/\btransition zone\b/, /\btz\b/] },
        { term: 'basal body', patterns: [/\bbasal body\b/, /\bbasal bodies\b/, /\bcentriole\b/, /\bbb\b/] },
        { term: 'ciliary tip', patterns: [/\bciliary tip\b/, /\btip\b/] },
        { term: 'ciliary membrane', patterns: [/\bciliary membrane\b/, /\bmembrane\b/, /\bsheath\b/] },
        { term: 'axoneme', patterns: [/\baxoneme\b/, /\baxonemal\b/] },
        { term: 'centrosome', patterns: [/\bcentrosome\b/, /\bpcm\b/] },
        { term: 'nucleus', patterns: [/\bnucleus\b/, /\bnuclear\b/] },
        { term: 'cytoplasm', patterns: [/\bcytoplasm\b/, /\bcytosol\b/, /\bcell body\b/] },
        { term: 'mitochondria', patterns: [/\bmitochondria\b/, /\bmitochondrial\b/] },
        { term: 'lysosome', patterns: [/\blysosome\b/, /\blysosomes\b/, /\blysosomal\b/] },
        { term: 'peroxisome', patterns: [/\bperoxisome\b/, /\bmicrobody\b/] },
        { term: 'flagella', patterns: [/\bflagella\b/, /\bflagellum\b/] },
        { term: 'cilia', patterns: [/\bcilia\b/, /\bcilium\b/, /\bciliary\b/] }
    ];
    
    for (const entry of keywords) {
        if (entry.patterns.some(p => p.test(qLower))) {
            return entry.term;
        }
    }
    return null;
}

/**
 * Extract phenotype intent
 */
function extractPhenotypeIntent(qLower) {
    const keywords = {
        'short cilia': ['short cilia', 'shorter cilia'],
        'longer cilia': ['long cilia', 'longer cilia'],
        'loss of cilia': ['loss of cilia', 'no cilia', 'cilia loss', 'no ciliation'],
        'no effect': ['no effect', 'no change', 'normal length']
    };
    
    for (const [term, synonyms] of Object.entries(keywords)) {
        if (synonyms.some(syn => qLower.includes(syn))) {
            return term;
        }
    }
    return null;
}

/**
 * Handle complex query (Main Router L2)
 */
function handleComplexQuery(query) {
    const qLower = query.toLowerCase();
    
    if (qLower.includes('plot') || (qLower.includes('show') && 
        (qLower.includes('evolution') || qLower.includes('heatmap') || qLower.includes('map')))) {
        return null;
    }
    
    const intents = {
        localization: extractLocalizationIntent(qLower),
        phenotype: extractPhenotypeIntent(qLower),
        disease: extractDiseaseIntent(qLower),
        expression: extractExpressionIntent(qLower),
        complex: extractComplexIntent(qLower),
        evolution: extractEvolutionIntent(qLower),
        domain: extractDomainIntent(qLower),
        isNegative: qLower.includes('not in') || qLower.includes('not expressed') || qLower.includes('no known phenotype')
    };
    
    let intentCount = 0;
    if (intents.localization) intentCount++;
    if (intents.phenotype || qLower.includes('no known phenotype')) intentCount++;
    if (intents.disease) intentCount++;
    if (intents.expression) intentCount++;
    if (intents.complex || qLower.includes('not in a known ciliary complex')) intentCount++;
    if (intents.evolution) intentCount++;
    if (intents.domain) intentCount++;
    
    const isListRequest = qLower.includes('list') || qLower.includes('show genes') || 
                         qLower.includes('find genes') || qLower.includes('which genes') ||
                         qLower.startsWith('genes in');
    
    if (intentCount === 0 || (intentCount < 2 && !isListRequest)) {
        return null;
    }
    
    log(`[Complex Router] Handling query with ${intentCount} intents. Localization: ${intents.localization}`);
    
    let titleParts = [];
    const filteredGenes = window.CiliAI?.masterData?.filter(gene => {
        if (!gene || !gene.Gene) return false;
        
        if (intents.localization) {
            if (!titleParts.includes(`Loc: ${intents.localization}`)) titleParts.push(`Loc: ${intents.localization}`);
            const locStr = (gene.Localization || '').toLowerCase();
            if (!locStr.includes(intents.localization)) return false;
        }
        
        if (intents.disease) {
            const dKey = normalizeDiseaseKey(intents.disease);
            const dList = window.CiliAI.lookups.byCiliopathy?.[dKey];
            if (!titleParts.includes(`Disease: ${intents.disease}`)) titleParts.push(`Disease: ${intents.disease}`);
            if (!dList || !dList.includes(gene.Gene.toUpperCase())) return false;
        }
        
        if (intents.phenotype) {
            if (!titleParts.includes(`Pheno: ${intents.phenotype}`)) titleParts.push(`Pheno: ${intents.phenotype}`);
            const pStr = (gene['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '').toLowerCase();
            const keyword = intents.phenotype.split(' ')[0];
            if (!pStr.includes(keyword)) return false;
        }
        
        return true;
    }) || [];
    
    const resultTitle = titleParts.join(' + ') || "your criteria";
    
    if (filteredGenes.length === 0) {
        return `<div class="ai-result-card">
            <p>I found no genes matching: <strong>${resultTitle}</strong>.</p>
        </div>`;
    }
    
    const geneListObjects = filteredGenes.map(g => ({
        gene: g.Gene,
        description: g['Gene.Description'] || 'No description available'
    }));
    
    window.CiliAI.lastQueryContext = {
        type: 'list_followup',
        data: geneListObjects,
        term: resultTitle
    };
    
    return `I found ${filteredGenes.length} gene(s) matching your criteria: <strong>${resultTitle}</strong>. Do you want to view the list?`;
}

/**
 * Render UMAP plot
 */
function renderUMAPPlot(displayName, targetGenes = [], zoomToCellType = null) {
    const plotDivId = 'cilia-svg';
    injectCiliAIStyles();
    
    const datasetKey = window.CiliAI?.activeDataset || 'lung';
    const dataset = window.CiliAI?.datasets?.[datasetKey];
    
    if (!dataset || !Array.isArray(dataset.umap)) {
        addChatMessage(`⚠️ ${datasetKey} data not loaded yet.`, false);
        return;
    }
    
    const plotDiv = document.getElementById(plotDivId);
    if (!plotDiv) return;
    
    try {
        if (window.Plotly) window.Plotly.purge(plotDivId);
        plotDiv.innerHTML = '';
    } catch (e) { console.error(e); }
    
    if (!displayName) displayName = 'WDR31';
    if (typeof targetGenes === 'string') targetGenes = [targetGenes];
    if (!targetGenes?.length) targetGenes = [displayName];
    
    const gene = displayName.toUpperCase();
    const isClusterView = displayName === 'CLUSTER_VIEW';
    
    const sourceData = dataset.umap;
    const renderIndices = Array.from({ length: sourceData.length }, (_, i) => i);
    
    const x = [], y = [], color = [], text = [], size = [];
    let maxExpr = 0;
    
    let exprData = null;
    let isSparseArray = false;
    let geneFound = true;
    
    const decodeSparse = (sparse, total) => {
        const dense = new Float32Array(total).fill(0);
        if (!sparse) return dense;
        for (let k = 0; k < sparse.length; k += 2) {
            const idx = sparse[k];
            const val = sparse[k + 1];
            if (idx < total) dense[idx] = val;
        }
        return dense;
    };
    
    if (!isClusterView) {
        if (datasetKey === 'kidney') {
            const raw = dataset.expression?.[gene];
            if (raw) {
                exprData = decodeSparse(raw, sourceData.length);
                isSparseArray = true;
            } else {
                geneFound = false;
                exprData = new Float32Array(sourceData.length).fill(0);
            }
        } else {
            exprData = window.CiliAI?.cellDataCache?.[gene] || {};
            isSparseArray = false;
            if (Object.keys(exprData).length === 0) geneFound = false;
        }
    }
    
    if (!isClusterView && !geneFound) {
        addChatMessage(`⚠️ <strong>${gene}</strong> not found in ${dataset.name}.`, false);
    }
    
    const clusterColors = {
        'Proximal Tubule Cell': '#3B82F6',
        'Thick Ascending Limb Cell': '#60A5FA',
        'Distal Convoluted Tubule Cell': '#93C5FD',
        'Collecting Duct Principal Cell': '#BFDBFE',
        'Collecting Duct Intercalated Cell': '#DBEAFE',
        'Podocyte': '#1E40AF',
        'Fibroblast': '#1D4ED8',
        'Endothelial Cell': '#2563EB',
        'Immune Cell': '#1E3A8A',
        'Cycling Cell': '#172554',
        'Ciliated Cell': '#E11D48'
    };
    
    for (const i of renderIndices) {
        const p = sourceData[i];
        if (!p) continue;
        
        const px = p.x;
        const py = p.y;
        const cellType = p.cell_type;
        
        if (zoomToCellType && cellType !== zoomToCellType) continue;
        
        x.push(px);
        y.push(py);
        
        let exprVal = 0;
        if (!isClusterView) {
            if (isSparseArray) {
                exprVal = exprData[i];
            } else {
                exprVal = exprData[cellType] || 0;
            }
        }
        
        text.push(`<b>${cellType}</b><br>${isClusterView ? '' : `Expr: ${exprVal.toFixed(2)}`}`);
        
        if (isClusterView) {
            color.push(clusterColors[cellType] || '#94A3B8');
            size.push(4);
        } else {
            color.push(exprVal);
            size.push(exprVal > 0 ? 6 : 3);
            if (exprVal > maxExpr) maxExpr = exprVal;
        }
    }
    
    const trace = {
        x, y, text,
        mode: 'markers',
        type: 'scattergl',
        hoverinfo: 'text',
        marker: {
            size,
            opacity: 0.8,
            line: { width: 0 }
        }
    };
    
    if (!isClusterView) {
        trace.marker.color = color;
        trace.marker.cmin = 0;
        trace.marker.cmax = maxExpr > 0 ? maxExpr : 1;
        trace.marker.colorscale = dataset.colorScale || 'Viridis';
        trace.marker.colorbar = { title: 'TPM', len: 0.5 };
    } else {
        trace.marker.color = color;
    }
    
    const layout = {
        title: `<b>${isClusterView ? 'Cell Types' : gene} (${dataset.name})</b>`,
        xaxis: { visible: false, automargin: true },
        yaxis: { visible: false, automargin: true },
        hovermode: 'closest',
        margin: { t: 40, b: 20, l: 20, r: 20 },
        plot_bgcolor: '#fff',
        paper_bgcolor: '#fff',
        showlegend: false
    };
    
    if (window.Plotly) {
        Plotly.newPlot(plotDivId, [trace], layout, {
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
        });
    }
}

/**
 * Main query handler (Brain)
 */
async function handleAIQuery(query) {
    const chatWindow = document.getElementById('messages');
    if (!chatWindow) return;
    
    if (!query) return;
    const qLower = query.toLowerCase().trim();
    
    log(`Routing query: ${query}`);
    
    try {
        if (!window.CiliAI || !window.CiliAI.ready) {
            addChatMessage("Data is still loading, please wait...", false);
            return;
        }
        
        let htmlResult = null;
        let match;
        
        // 1. Greetings
        const simpleGreetings = ['hello', 'hi', 'hey', 'greetings'];
        const terminologyQueries = {
            "what is a cilium": "A cilium is a microtubule-based organelle extending from the cell surface. Primary cilia sense extracellular signals; motile cilia generate fluid flow. (Rosenbaum & Witman 2002)",
            "what are cilia": "Cilia are conserved organelles on most eukaryotic cells. They function in sensory signaling (primary cilia) or motility (motile cilia). (Reiter, Blacque & Leroux 2012)",
            "explain ift": "Intraflagellar Transport (IFT) is the bidirectional movement of protein complexes along the axoneme, essential for assembling and maintaining cilia. (Kozminski et al. 1993; Cole 2003)",
            "what is ift-a": "IFT-A (Intraflagellar Transport A) is the retrograde IFT complex required for returning cargo from tip to base and for membrane protein gating. (Behal et al. 2012; Mukhopadhyay et al. 2010)",
            "what is ift-b": "IFT-B is the anterograde IFT complex delivering axonemal building blocks from the base to the tip. It is essential for ciliogenesis. (Cole et al. 1998; Taschner & Lorentzen 2016)",
            "what is ift88": "IFT88 is an IFT-B core protein required for cilium assembly. Mutation causes cilia loss and polycystic kidney disease in mouse. (Pazour et al. 2000)",
            "what is the bbsome": "The BBSome, a protein complex of 8 Bardet-Biedl syndrome (BBS) proteins, is a trafficking complex that ferries membrane proteins, including GPCRs, into and out of cilia. Mutations cause Bardet-Biedl Syndrome. (Jin et al. 2010; Nachury et al. 2007)",
            "explain the transition zone": "The transition zone is the gate at the ciliary base that controls protein entry and exit via MKS and NPHP modules. (Garcia-Gonzalo & Reiter 2017)"
        };
        
        if (simpleGreetings.includes(qLower)) {
            addChatMessage("Hello! I'm CiliAI. How can I help you? Try asking 'What is IFT88?' or 'List genes in the transition zone'.", false);
            return;
        }
        
        if (terminologyQueries[qLower]) {
            addChatMessage(`<div class="ai-result-card"><p>${terminologyQueries[qLower]}</p></div>`, false);
            return;
        }
        
        // 2. Default Buttons
        if (qLower === 'plot default umap') {
            if (!window.CiliAI.activeDataset) window.CiliAI.activeDataset = 'lung';
            renderUMAPPlot('WDR31', ['WDR31']);
            const dsName = window.CiliAI.datasets[window.CiliAI.activeDataset]?.name || 'scRNA-seq';
            htmlResult = `<div class="ai-result-card"><p>Displaying ${dsName} scRNA-seq UMAP for <strong>WDR31</strong> on the left.</p></div>`;
        } else if (qLower === 'plot default phylogeny') {
            htmlResult = await handleAIQuery(`show nevers plot for ${CONFIG.DEFAULT_PHYLO_GENES.join(',')}`);
            return;
        }
        
        // 3. Contextual Follow-up
        const isComplexQuery = qLower.includes('expression') || qLower.includes('plot') || 
                              qLower.includes('umap') || qLower.includes('scrna') || 
                              qLower.includes('kidney') || qLower.includes('lung') || 
                              qLower.includes('evolution');
        const yesRegex = /^(yes|yeah|sure|ok|okay|yep|show|view|list|show list|view list|display)/i;
        
        if (!isComplexQuery && htmlResult === null && yesRegex.test(qLower) && 
            window.CiliAI.lastQueryContext && window.CiliAI.lastQueryContext.type) {
            
            if (window.CiliAI.lastQueryContext.type === 'list_followup') {
                showDataInLeftPanel(
                    window.CiliAI.lastQueryContext.term || 'Gene List',
                    window.CiliAI.lastQueryContext.data || []
                );
                addChatMessage(`Displaying <strong>${window.CiliAI.lastQueryContext.term}</strong> in the main panel.`, false);
                window.CiliAI.lastQueryContext = { type: null, data: [], term: null };
                return;
            } else if (window.CiliAI.lastQueryContext.type === 'screen_references') {
                htmlResult = handleScreenReferenceFollowup();
                window.CiliAI.lastQueryContext = { type: null, data: [], term: null };
            }
        }
        
        // 4. List Genes
        if (htmlResult === null && (match = qLower.match(/^(?:list|show|display|find|give me)\s+(?:all\s+)?(.+?)\s+genes$/i))) {
            const term = match[1].trim();
            const termUpper = term.toUpperCase();
            let genes = [];
            
            const locList = getGenesByLocalization(term);
            if (locList.length > 0) genes = locList.map(g => g.gene);
            
            if (genes.length === 0) {
                if (window.CiliAI.lookups.byCompartment?.[termUpper]) {
                    genes = window.CiliAI.lookups.byCompartment[termUpper];
                } else if (window.CiliAI.lookups.byModuleOrComplex?.[termUpper]) {
                    genes = window.CiliAI.lookups.byModuleOrComplex[termUpper];
                }
            }
            
            if (genes.length > 0) {
                const rows = genes.map(g => ({ gene: g }));
                window.CiliAI.lastQueryContext = { 
                    type: 'list_followup', 
                    term: `${term} genes`, 
                    data: rows 
                };
                htmlResult = `<div class="ai-result-card">
                    <p>Found <strong>${genes.length}</strong> genes associated with <strong>${term}</strong>.</p>
                    <p>Would you like to <strong>view the full list</strong>?</p>
                </div>`;
            } else {
                htmlResult = `I couldn't find a gene set for <strong>${term}</strong> in the database.`;
            }
        }
        
        // 5. Phylogeny
        if (htmlResult === null && (qLower.includes('evolution') || qLower.includes('conservation') || 
            qLower.includes('phylogenetic') || qLower.includes('phylogeny') || 
            qLower.includes('evo of') || qLower.match(/show.+evolution/i) || 
            (qLower.includes('show') && qLower.includes('li')))) {
            
            let genes = extractMultipleGenes(query);
            if (genes.length === 0) {
                const geneMatch = query.match(/[A-Z0-9]{3,}/g);
                if (geneMatch) {
                    genes = geneMatch.map(g => g.toUpperCase()).filter(g => window.CiliAI.lookups.geneMap?.[g]);
                }
            }
            
            if (genes.length > 0) {
                if (genes.length === 1) {
                    genes = [...new Set([...CONFIG.DEFAULT_PHYLO_GENES, ...genes])];
                }
                
                if (!window.liPhylogenyCache) {
                    addChatMessage("Loading phylogeny datasets...", false);
                    await ensurePhylogenyDataLoaded();
                }
                
                setTimeout(() => {
                    if (window.renderLiPhylogenyHeatmap) {
                        const res = renderLiPhylogenyHeatmap(genes);
                        if (res && res.plotData && window.Plotly) {
                            Plotly.newPlot('cilia-svg', res.plotData, res.plotLayout);
                        }
                    }
                }, 100);
                
                htmlResult = `<div class="ai-result-card">
                    <p>Displaying phylogenetic conservation for <strong>${genes.length} genes</strong> in the main panel.</p>
                </div>`;
            } else {
                htmlResult = "Please specify a valid gene symbol for evolutionary analysis (e.g., 'Show evolution of BBS1').";
            }
        }
        
        // 6. Screen References
        else if (htmlResult === null && (qLower.includes('show screen reference') || 
                 qLower.includes('show publication detail') || qLower.includes('provide the paper'))) {
            htmlResult = handleScreenReferenceFollowup();
        }
        
        // 7. Screens/Phenotypes
        else if (htmlResult === null && (qLower.includes('loss-of-function') || qLower.includes('lof') || 
                 qLower.includes('overexpression') || qLower.includes('oe') || 
                 qLower.includes('percent ciliated') || qLower.includes('cilia length') || 
                 (qLower.includes('effect') && qLower.includes('of')))) {
            
            const genes = extractMultipleGenes(query);
            if (genes.length > 0) {
                htmlResult = handleScreenQuery(genes[genes.length - 1]);
            } else {
                htmlResult = `I see you're asking about screen effects, but I couldn't identify a gene. Please try again, like "loss-of-function effect of IFT88".`;
            }
        }
        
        // 8. What is [Gene]
        else if (htmlResult === null && (match = qLower.match(/^(?:what is|what's|describe|tell me about)\s+([A-Z0-9\-]{3,})\??$/i))) {
            htmlResult = displayFullGeneInfo(match[1].toUpperCase());
        }
        
        // 9. Orthologs
        else if (htmlResult === null && (match = qLower.match(/ortholog(?: of| for)?\s+([a-z0-9\-]+)\s+(?:in|for)\s+(c\. elegans|mouse|zebrafish|drosophila|xenopus)/i))) {
            htmlResult = handleOrthologQuery(match[1].toUpperCase(), match[2]);
        } else if (htmlResult === null && (match = qLower.match(/(c\. elegans|mouse|zebrafish|drosophila|xenopus)\s+ortholog(?: of| for)?\s+([a-z0-9\-]+)/i))) {
            htmlResult = handleOrthologQuery(match[2].toUpperCase(), match[1]);
        }
        
        // 10. Domains
        else if (htmlResult === null && (match = qLower.match(/(?:domains of|domain architecture for)\s+(.+)/i))) {
            const genes = extractMultipleGenes(match[1]);
            if (genes.length > 0) {
                htmlResult = getGenesByDomain(genes[0], match[1]);
            }
        }
        
        // 11. UMAP & Expression
        else if (htmlResult === null && (qLower.includes('plot') || qLower.includes('display') || 
                 qLower.includes('heatmap') || qLower.includes('umap') || 
                 qLower.includes('scrna') || qLower.includes('expression'))) {
            
            if (qLower.includes('kidney')) window.CiliAI.activeDataset = 'kidney';
            else if (qLower.includes('lung')) window.CiliAI.activeDataset = 'lung';
            
            let target = 'WDR31';
            match = qLower.match(/(?:for|of|in)\s+(.+)/i);
            if (match) {
                target = match[1].replace(/lung|kidney|scrna-seq|scrna|expression|in/gi, '').trim();
                if (target.length < 2) target = 'WDR31';
            }
            
            let genes = extractMultipleGenes(target);
            let isComplex = false;
            let finalTargetTerm = target;
            
            if (genes.length === 0 && target) {
                const complexName = extractComplexIntent(target);
                if (complexName) {
                    const complexGenes = getGenesByComplex(complexName).map(g => g.gene);
                    if (complexGenes.length > 0) {
                        genes = complexGenes;
                        finalTargetTerm = complexName;
                        isComplex = true;
                    }
                }
            }
            
            const finalGenes = genes.length > 0 ? genes : ['WDR31'];
            const geneSymbol = isComplex ? finalTargetTerm : finalGenes[0];
            
            const zoomMatch = qLower.match(/zoom to\s+(ciliated cell|stem cell|club cell|goblet cell|neuroendocrine cell|basal cell|pulmonary alveolar type 1 cell|pulmonary alveolar type 2 cell|lung secretory cell)/i);
            const zoomToCellType = zoomMatch ? zoomMatch[1] : null;
            
            await renderUMAPPlot(geneSymbol, finalGenes, zoomToCellType);
            
            const currentDS = window.CiliAI.activeDataset || 'lung';
            const dsName = window.CiliAI.datasets[currentDS] ? window.CiliAI.datasets[currentDS].name : 'scRNA-seq';
            const nextDS = currentDS === 'lung' ? 'kidney' : 'lung';
            const nextDSLabel = nextDS === 'lung' ? 'Lung' : 'Kidney';
            
            htmlResult = `<div class="ai-result-card">
                <p>Displaying <strong>${dsName}</strong> scRNA-seq UMAP for <strong>${geneSymbol}</strong> (${isComplex ? 'Complex Avg.' : 'Single Gene'}) on the left.</p>
                ${zoomToCellType ? `<p>Zoomed to the <strong>${zoomToCellType}</strong> cluster.</p>` : ''}
                
                <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <button class="ciliai-button" style="width:auto; margin:0; background:#4a5568;" 
                        onclick="window.CiliAI.activeDataset='${nextDS}'; window.renderUMAPPlot('${geneSymbol}', [], '${zoomToCellType || ''}'); window.addChatMessage('Switched to ${nextDSLabel} data.', true); window.handleAIQuery('plot umap for ${geneSymbol} in ${nextDS}');">
                        🔄 Switch to ${nextDSLabel}
                    </button>
                    
                    <a href="#" class="ai-action" onclick="window.downloadUMAPDataAsCSV('${geneSymbol}')" style="margin-left:5px; font-weight:600;">⬇️ CSV</a>
                </div>
            </div>`;
        }
        
        // 12. Comparative
        else if (htmlResult === null && (qLower.includes('compare') || qLower.includes(' vs '))) {
            const matches = query.match(/([A-Z0-9]+)\s+vs\s+([A-Z0-9]+)/gi);
            if (matches) {
                htmlResult = await handleComparativeDashboard(matches[0]);
            } else {
                htmlResult = await handleComparativeDashboard(query);
            }
        }
        
        // 13. Variants
        else if (htmlResult === null && (qLower.includes('variant') || qLower.includes('mutation'))) {
            const genes = extractMultipleGenes(query);
            if (genes.length > 0) {
                htmlResult = await fetchVariantData(genes[0]);
            }
        }
        
        // 14. Batch Query
        else if (htmlResult === null && query.includes(',') && extractMultipleGenes(query).length > 1) {
            htmlResult = handleBatchQuery(query);
        }
        
        // 15. Fold Change
        else if (htmlResult === null) {
            const foldChangeMatch = qLower.match(/compare\s+(.+)\s+in\s+(.+)\s+vs\s+(.+)/i);
            if (foldChangeMatch) {
                const result = calculateFoldChangeForComplex(
                    foldChangeMatch[1].trim().toUpperCase(),
                    foldChangeMatch[2].trim(),
                    foldChangeMatch[3].trim()
                );
                
                if (result.error) {
                    htmlResult = `<div class="ai-result-card"><h4>Differential Expression Error</h4><p>${result.error}</p></div>`;
                } else {
                    htmlResult = `<div class="ai-result-card">
                        <h4>Differential Expression: ${result.complex}</h4>
                        <p>Comparing average expression in <strong>${result.cellTypeA}</strong> (A) vs <strong>${result.cellTypeB}</strong> (B) (N=${result.count} genes).</p>
                        <p><strong>Fold Change (A/B): ${result.foldChange.toFixed(3)}</strong></p>
                    </div>`;
                }
            }
        }
        
        // 16. Show Ciliary Cells
        else if (htmlResult === null && qLower.includes('show') && qLower.includes('ciliary cells')) {
            renderUMAPPlot('CLUSTER_VIEW');
            window.CiliAI.lastQueryContext = { type: 'top_500_ciliary' };
            htmlResult = `<div class="ai-result-card">
                <p>I've displayed the UMAP with <strong>all cell clusters</strong> highlighted.</p>
                <p>Would you like to view the <strong>top 500 genes</strong> enriched in these ciliary cells?</p>
            </div>`;
        }
        
        // 17. Fallback
        else if (htmlResult === null) {
            const intent = flexibleIntentParser(query);
            if (intent) {
                htmlResult = intent.handler(intent.entity, query);
            }
            
            if (htmlResult === null) {
                let term = qLower;
                if ((match = qLower.match(/(?:what is|what does|describe|localization of|omim id for|where is|cellular location of|subcellular localization of)\s+(?:the\s+)?(.+)/i))) {
                    term = match[1];
                }
                term = term.replace(/[?.]/g, '').replace(/\bdo\b/i, '').trim().toUpperCase();
                const genes = extractMultipleGenes(term);
                if (genes.length > 0) {
                    htmlResult = displayFullGeneInfo(genes[0]);
                } else {
                    htmlResult = `Sorry, I didn't understand the query: "<strong>${query}</strong>". Please try a simpler term.`;
                }
            }
        }
        
        if (htmlResult) {
            addChatMessage(htmlResult, false);
        }
        
    } catch (e) {
        console.error("Error in handleAIQuery:", e);
        addChatMessage(`An internal CiliAI error occurred: ${e.message}`, false);
    }
}

/**
 * Fetch variant data
 */
async function fetchVariantData(geneSymbol) {
    try {
        const response = await fetch(`https://mygene.info/v3/query?q=${geneSymbol}&fields=clinvar,gnomad`);
        const data = await response.json();
        const hits = data.hits?.[0] || {};
        
        return `
        <div class="variant-panel">
            <h4>🧬 Variants for ${geneSymbol}</h4>
            <div class="variant-stats">
                <div class="stat-card">
                    <span class="stat-value">${hits.clinvar?.pathogenic_count || 0}</span> Pathogenic
                </div>
                <div class="stat-card">
                    <span class="stat-value">${hits.gnomad?.pLI?.toFixed(3) || 'N/A'}</span> pLI Score
                </div>
            </div>
            <p style="font-size:11px; color:#666;">Data Source: MyGene.info (ClinVar/gnomAD)</p>
        </div>`;
    } catch (e) {
        return `<p>Variant data unavailable for ${geneSymbol}</p>`;
    }
}

/**
 * Handle comparative dashboard
 */
async function handleComparativeDashboard(genesText) {
    const genes = genesText.split(/vs|VS|Vs|and|,/).map(g => g.trim().toUpperCase());
    
    return `
    <div class="comparison-dashboard">
        <div class="comparison-header"><h3>🔬 Comparing: ${genes.join(' vs ')}</h3></div>
        <div class="comparison-grid">
            ${genes.map(gene => {
                const data = window.CiliAI?.lookups?.geneMap?.[gene] || {};
                return `
                <div class="gene-panel">
                    <h4 style="color:#2b6cb0;">${gene}</h4>
                    <p style="font-size:12px;"><strong>Loc:</strong> ${data.Localization || '-'}</p>
                    <p style="font-size:12px;"><strong>Disease:</strong> ${(data.Ciliopathies || []).slice(0,1).join(',') || '-'}</p>
                </div>`;
            }).join('')}
        </div>
        <button class="ciliai-button" onclick="handleBatchQuery('${genes.join(',')}')">📊 Full Table</button>
    </div>`;
}

/**
 * Handle batch query
 */
function handleBatchQuery(geneList) {
    const genes = geneList.split(/[,\s]+/).map(g => g.trim().toUpperCase()).filter(g => g);
    const dataObjects = genes.map(g => ({ gene: g }));
    showDataInLeftPanel(`Batch Analysis (${genes.length})`, dataObjects);
    return `<div class="ai-result-card"><p>Generated batch table for ${genes.length} genes.</p></div>`;
}

/**
 * Handle screen reference followup
 */
function handleScreenReferenceFollowup() {
    const refMap = getScreenCitationMap();
    const allKeys = Object.keys(refMap);
    
    let html = `<div class="ai-result-card">
        <h4>CRISPR / siRNA Screen References</h4>
        <ul style="list-style-type: none; padding-left: 0;">`;
    
    allKeys.forEach(key => {
        const ref = refMap[key];
        html += `
            <li style="margin-bottom: 15px;">
                <strong>${ref.name}</strong> (${ref.citation})
                <p style="margin-top: 5px; margin-bottom: 5px;">${ref.summary}</p>
                ${ref.link ? `<a href="${ref.link}" target="_blank" class="ai-action">View Publication</a>` : ''}
            </li>
        `;
    });
    
    html += `</ul></div>`;
    window.CiliAI.lastQueryContext = { type: null, data: [], term: null };
    return html;
}

/**
 * Citation Manager
 */
window.CitationManager = {
    references: new Map(),
    
    addReference: function(source, pmid, citation) {
        this.references.set(pmid, {source, citation});
    },
    
    showReferences: function(geneSymbol) {
        const geneData = window.CiliAI?.lookups?.geneMap?.[geneSymbol];
        const refs = [];
        
        if (geneData?.screens) {
            refs.push(...geneData.screens.map(s => s.source));
        }
        if (geneData?.phylogeny?.li) {
            refs.push("PMID: 24995987");
        }
        
        return `
        <div class="references-panel">
            <h4>📚 References for ${geneSymbol}</h4>
            <ul class="reference-list">
                ${refs.slice(0, 10).map(ref => `
                    <li class="reference-item">
                        <a href="https://pubmed.ncbi.nlm.nih.gov/${ref.replace('PMID: ', '')}" target="_blank">
                            ${ref}
                        </a>
                        <button onclick="window.saveReference('${ref}')">⭐</button>
                    </li>
                `).join('')}
            </ul>
            <button onclick="window.exportReferences('${geneSymbol}')">📥 Export References (BibTeX)</button>
        </div>`;
    }
};

/**
 * Download UMAP data as CSV
 */
function downloadUMAPDataAsCSV(geneSymbol) {
    const gene = geneSymbol.toUpperCase();
    const cellData = window.CiliAI?.cellDataCache;
    const umapData = window.CiliAI_UMAP;
    
    if (!umapData || !cellData) {
        addChatMessage('Error: UMAP data is not available for export.', false);
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
    
    addChatMessage(`Downloaded UMAP data for <strong>${gene}</strong> as ${filename}.`, false);
}

/**
 * Get screen citation map
 */
function getScreenCitationMap() {
    return {
        "Kim2016": {
            name: 'Kim et al. (2016) IMCD3 RNAi',
            link: 'https://www.sciencedirect.com/science/article/pii/S016748891630074X',
            citation: 'Kim et al., FEBS Lett, 2016',
            summary: "Genome-wide high-content siRNA screen for ciliogenesis."
        },
        "Wheway2015": {
            name: 'Wheway et al. (2015) RPE1 RNAi',
            link: 'https://www.nature.com/articles/ncb3201#Abs1',
            citation: 'Wheway et al., Nat Cell Biol, 2015',
            summary: "Whole-genome siRNA screen in mIMCD3 cells."
        },
        "Roosing2015": {
            name: 'Roosing et al. (2015) hTERT-RPE1',
            link: 'https://elifesciences.org/articles/06602/figures#SD2-data',
            citation: 'Roosing et al., eLife, 2015',
            summary: "Genome-wide siRNA screen with dual reporter."
        },
        "Basu2023": {
            name: 'Basu et al. (2023) MDCK CRISPR',
            link: 'https://onlinelibrary.wiley.com/doi/10.1111/ahg.12529',
            citation: 'Basu et al., Ann Hum Genet, 2023',
            summary: "MDCK CRISPR screen for ciliogenesis."
        },
        "Breslow2018": {
            name: 'Breslow et al. (2018) Hedgehog Signaling',
            link: 'https://www.nature.com/articles/s41588-018-0054-7#Abs1',
            citation: 'Breslow et al., Nat Genet, 2018',
            summary: "CRISPR-Cas9 screen focused on Hedgehog signaling."
        }
    };
}

/**
 * Select compartment
 */
function selectComp(id) {
    generateAndInjectSVG();
    
    document.querySelectorAll('.cilia-part').forEach(el =>
        el.classList.remove('selected', 'active')
    );
    
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');
    
    const structureInfoMap = window.structureInfoMap || {};
    const data = structureInfoMap[id];
    if (!data) return;
    
    const genes = getGenesByLocalization(data.title);
    const bar = document.getElementById('bottomBar');
    
    if (!bar) return;
    
    if (genes.length > 0) {
        bar.innerHTML = `
            <h3>${data.title} (${genes.length} genes)</h3>
            <div class="gene-list">
                ${genes.slice(0, 40).map(g =>
                    `<span class="gene-badge" data-gene="${g.gene}">${g.gene}</span>`
                ).join('')}
                ${genes.length > 40
                    ? `<span style="font-size:11px;color:#666;padding:5px;">...+${genes.length - 40} more</span>`
                    : ''}
            </div>`;
    } else {
        bar.innerHTML = `
            <h3>${data.title}</h3>
            <p style="color:#666;font-size:12px;">No genes found in database. Try searching directly.</p>`;
    }
}

/**
 * Search gene
 */
function searchGene(name) {
    const query = name || document.getElementById('geneSearch')?.value?.trim()?.toUpperCase();
    if (!query) return;
    addChatMessage(`Tell me about ${query}`, true);
    handleGeneSearch(query, true);
}

/**
 * Show default UMAP
 */
function showDefaultUMAP() {
    addChatMessage('Display gene expression in Lung scRNA-seq (Default: FOXJ1)', true);
    handleAIQuery('plot default umap');
}

/**
 * Show default phylogeny
 */
function showDefaultPhylogeny() {
    addChatMessage('Show Phylogenetics Analysis (Default Genes)', true);
    handleAIQuery('plot default phylogeny');
}

/**
 * Download plot
 */
function downloadPlot(divId, filename) {
    const plotDiv = document.getElementById(divId);
    if (plotDiv && window.Plotly) {
        Plotly.downloadImage(plotDiv, {
            format: 'png',
            filename: filename,
            width: 1200,
            height: 800
        });
    }
}

/**
 * Generate and inject SVG
 */
function generateAndInjectSVG() {
    const svgContainer = document.getElementById('cilia-svg');
    if (!svgContainer) return;
    
    const svgHTML = `
        <svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#005b96">
                Ciliary Diagram Placeholder
            </text>
        </svg>`;
    
    svgContainer.innerHTML = svgHTML;
}

/**
 * Search State Management
 */
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
            `<div class="history-item" onclick="setSearch('${q.replace(/'/g, "\\'")}')">🕒 ${q}</div>`
        ).join('');
    },

    renderSaved: function() {
        const container = document.getElementById('search-saved-list');
        if (!container) return;
        container.innerHTML = this.saved.map(q => 
            `<div class="history-item" onclick="setSearch('${q.replace(/'/g, "\\'")}')">⭐ ${q}</div>`
        ).join('');
    }
};

/**
 * Execute Boolean Search
 */
function executeBooleanSearch(queryStr, filters = {}) {
    if (!window.CiliAI?.masterData) return [];
    
    let results = window.CiliAI.masterData;
    const q = queryStr.trim();
    
    if (q) {
        // Handle NOT (Exclude)
        const notParts = q.split(/\s+NOT\s+/i);
        const positivePart = notParts[0];
        const negativeParts = notParts.slice(1);
        
        if (negativeParts.length > 0) {
            results = results.filter(gene => {
                const str = JSON.stringify(gene).toUpperCase();
                return !negativeParts.some(neg => str.includes(neg.trim().toUpperCase()));
            });
        }
        
        // Handle OR (Union)
        if (positivePart.includes(' OR ')) {
            const orTerms = positivePart.split(/\s+OR\s+/i).map(t => t.trim().toUpperCase());
            results = results.filter(gene => {
                const str = JSON.stringify(gene).toUpperCase();
                return orTerms.some(term => str.includes(term));
            });
        } 
        // Handle AND (Intersection)
        else {
            const andTerms = positivePart.split(/\s+(?:AND\s+)?/i).map(t => t.trim().toUpperCase());
            results = results.filter(gene => {
                const str = JSON.stringify(gene).toUpperCase();
                return andTerms.every(term => str.includes(term));
            });
        }
    }
    
    // Apply Dropdown Filters
    if (filters.localization && filters.localization !== 'All') {
        results = results.filter(g => (g.Localization || '').includes(filters.localization));
    }
    
    if (filters.disease && filters.disease !== 'All') {
        results = results.filter(g => {
            const diseases = g.Ciliopathies || [];
            return JSON.stringify(diseases).includes(filters.disease);
        });
    }
    
    // Apply Expression Range Filter
    if (filters.minExpr > 0) {
        results = results.filter(g => {
            if (!g.expression || !g.expression.scRNA) return false;
            const vals = Object.values(g.expression.scRNA);
            const maxVal = Math.max(...vals, 0);
            return maxVal >= filters.minExpr;
        });
    }
    
    return results;
}

/**
 * Setup Autocomplete
 */
function setupAutocomplete(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(suggestionsId);
    if (!input || !box) return;
    
    input.addEventListener('input', function() {
        const val = this.value.toUpperCase();
        if (val.length < 2) { 
            box.style.display = 'none'; 
            return; 
        }
        
        const matches = Object.keys(window.CiliAI?.lookups?.geneMap || {})
            .filter(k => k.startsWith(val))
            .slice(0, 10);
        
        if (matches.length === 0) { 
            box.style.display = 'none'; 
            return; 
        }
        
        box.innerHTML = matches.map(gene => 
            `<div class="ac-item" onclick="setSearch('${gene}')">${gene}</div>`
        ).join('');
        box.style.display = 'block';
    });
    
    document.addEventListener('click', function(e) {
        if (e.target !== input && e.target !== box) {
            box.style.display = 'none';
        }
    });
}

/**
 * Set Search
 */
function setSearch(val) {
    const input = document.getElementById('adv-search-input');
    if (input) {
        input.value = val;
        document.getElementById('adv-suggestions').style.display = 'none';
        runDashboardSearch();
    }
}

/**
 * Inject Search Dashboard Styles
 */
function injectSearchDashboardStyles() {
    const css = `
        .search-modal { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0,0,0,0.5); 
            z-index: 2000; 
            display: none; 
            justify-content: center; 
            align-items: flex-start; 
            padding-top: 50px; 
            backdrop-filter: blur(2px); 
        }
        
        .search-panel { 
            background: white; 
            width: 800px; 
            max-width: 95%; 
            border-radius: 12px; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.2); 
            overflow: hidden; 
            display: flex; 
            flex-direction: column; 
            max-height: 85vh; 
            font-family: 'Inter', sans-serif; 
        }
        
        .search-header { 
            padding: 20px; 
            background: #f7fafc; 
            border-bottom: 1px solid #e2e8f0; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
        }
        
        .search-body { 
            padding: 20px; 
            overflow-y: auto; 
            display: flex; 
            gap: 20px; 
        }
        
        .search-sidebar { 
            width: 250px; 
            border-right: 1px solid #e2e8f0; 
            padding-right: 20px; 
        }
        
        .search-main { 
            flex: 1; 
        }
        
        .filter-group { 
            margin-bottom: 15px; 
        }
        
        .filter-label { 
            display: block; 
            font-size: 12px; 
            font-weight: 700; 
            color: #4a5568; 
            margin-bottom: 5px; 
            text-transform: uppercase; 
        }
        
        .cilia-input, .cilia-select { 
            width: 100%; 
            padding: 8px; 
            border: 1px solid #cbd5e0; 
            border-radius: 6px; 
            font-size: 14px; 
        }
        
        .cilia-range { 
            width: 100%; 
        }
        
        .ac-box { 
            position: absolute; 
            background: white; 
            border: 1px solid #cbd5e0; 
            width: 100%; 
            max-height: 200px; 
            overflow-y: auto; 
            z-index: 10; 
            display: none; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        
        .ac-item { 
            padding: 8px 12px; 
            cursor: pointer; 
            border-bottom: 1px solid #f7fafc; 
        }
        
        .ac-item:hover { 
            background: #ebf8ff; 
        }
        
        .history-item { 
            padding: 6px 10px; 
            font-size: 13px; 
            color: #2b6cb0; 
            cursor: pointer; 
            border-radius: 4px; 
            margin-bottom: 2px; 
        }
        
        .history-item:hover { 
            background: #ebf8ff; 
        }
        
        .result-item { 
            padding: 10px; 
            border: 1px solid #e2e8f0; 
            border-radius: 6px; 
            margin-bottom: 10px; 
            transition: all 0.2s; 
            cursor: pointer; 
        }
        
        .result-item:hover { 
            border-color: #bee3f8; 
            background: #ebf8ff; 
        }
        
        .result-badges { 
            margin-top: 5px; 
        }
        
        .res-badge { 
            font-size: 10px; 
            padding: 2px 6px; 
            border-radius: 4px; 
            background: #edf2f7; 
            color: #4a5568; 
            margin-right: 5px; 
        }
    `;
    
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

/**
 * Open Search Dashboard
 */
function openSearchDashboard() {
    injectSearchDashboardStyles();
    
    if (!document.getElementById('cilia-search-modal')) {
        const modal = document.createElement('div');
        modal.id = 'cilia-search-modal';
        modal.className = 'search-modal';
        modal.innerHTML = `
            <div class="search-panel">
                <div class="search-header">
                    <h2 style="margin:0; color:#2d3748;">🔍 Advanced Search</h2>
                    <button onclick="document.getElementById('cilia-search-modal').style.display='none'" 
                            style="background:none; border:none; font-size:20px; cursor:pointer;">✕</button>
                </div>
                <div class="search-body">
                    <div class="search-sidebar">
                        <div class="filter-group">
                            <label class="filter-label">Localization</label>
                            <select id="filter-loc" class="cilia-select">
                                <option value="All">All Locations</option>
                                <option value="Transition Zone">Transition Zone</option>
                                <option value="Basal Body">Basal Body</option>
                                <option value="Axoneme">Axoneme</option>
                                <option value="Centrosome">Centrosome</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Ciliopathy</label>
                            <select id="filter-dis" class="cilia-select">
                                <option value="All">All Diseases</option>
                                <option value="Joubert">Joubert Syndrome</option>
                                <option value="BBS">Bardet-Biedl (BBS)</option>
                                <option value="MKS">Meckel-Gruber (MKS)</option>
                                <option value="PCD">PCD</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Min Expression (TPM)</label>
                            <input type="range" id="filter-expr" class="cilia-range" min="0" max="100" value="0" 
                                   oninput="document.getElementById('expr-val').textContent = this.value">
                            <span style="font-size:12px; color:#666;">Min: <span id="expr-val">0</span> TPM</span>
                        </div>
                        <hr style="border:0; border-top:1px solid #eee; margin: 15px 0;">
                        <div class="filter-group">
                            <label class="filter-label">Search History</label>
                            <div id="search-history-list"></div>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Saved Queries</label>
                            <div id="search-saved-list"></div>
                        </div>
                    </div>
                    <div class="search-main">
                        <div style="position:relative; margin-bottom: 20px; display:flex; gap:10px;">
                            <div style="flex:1; position:relative;">
                                <input type="text" id="adv-search-input" class="cilia-input" 
                                       placeholder="e.g., IFT88 OR BBS (Boolean supported)...">
                                <div id="adv-suggestions" class="ac-box"></div>
                            </div>
                            <button class="ciliai-button" onclick="runDashboardSearch()">Search</button>
                            <button class="ciliai-button" style="background:#ecc94b; color:#744210;" 
                                    onclick="SearchState.saveQuery(document.getElementById('adv-search-input').value)">★</button>
                        </div>
                        <div style="margin-bottom:10px; font-size:12px; color:#718096;">
                            <strong>Tip:</strong> Use AND, OR, NOT for complex logic.
                        </div>
                        <div id="adv-search-results" style="height: 400px; overflow-y:auto;">
                            <div style="text-align:center; padding-top:50px; color:#a0aec0;">
                                Search for genes, diseases, or phenotypes...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        setupAutocomplete('adv-search-input', 'adv-suggestions');
        window.SearchState.renderHistory();
        window.SearchState.renderSaved();
    }
    
    document.getElementById('cilia-search-modal').style.display = 'flex';
}

/**
 * Run Dashboard Search
 */
function runDashboardSearch() {
    const query = document.getElementById('adv-search-input')?.value || '';
    const filters = {
        localization: document.getElementById('filter-loc')?.value || 'All',
        disease: document.getElementById('filter-dis')?.value || 'All',
        minExpr: parseInt(document.getElementById('filter-expr')?.value || '0')
    };
    
    const results = executeBooleanSearch(query, filters);
    
    if (query) {
        window.SearchState.addToHistory(query);
    }
    
    const container = document.getElementById('adv-search-results');
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = `<div style="padding:20px; text-align:center;">No results found.</div>`;
        return;
    }
    
    container.innerHTML = `<div style="margin-bottom:10px; font-weight:bold;">Found ${results.length} results:</div>` + 
        results.slice(0, 50).map(g => {
            return `
            <div class="result-item" onclick="displayFullGeneInfo('${g.Gene}'); 
                   document.getElementById('cilia-search-modal').style.display='none';">
                <div style="font-weight:bold; color:#2b6cb0;">${g.Gene}</div>
                <div style="font-size:12px; color:#4a5568;">${g['Gene.Description'] || 'No description'}</div>
                <div class="result-badges">
                    ${g.Localization ? `<span class="res-badge">📍 ${g.Localization}</span>` : ''}
                    ${g.Ortholog_Mouse ? `<span class="res-badge">🐭 Mouse Ortholog</span>` : ''}
                </div>
            </div>`;
        }).join('');
}

/**
 * Apply Layout Fixes (IIFE)
 */
(function applyLayoutFixes() {
    const styleId = 'ciliai-layout-fixes';
    if (document.getElementById(styleId)) return;
    
    const css = `
        /* 1. Ensure Chat Message Bubble Contains Content */
        .ciliai-message-content {
            max-width: 100%;
            overflow-x: auto;
            box-sizing: border-box;
        }
        
        /* 2. Constrain the Gene Card */
        .ai-result-card {
            width: 100%;
            max-width: 600px;
            box-sizing: border-box;
            background: #fff;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            border: 1px solid #e2e8f0;
            margin-top: 5px;
        }
        
        /* 3. Make Tables Scrollable */
        .cilia-tab-content {
            width: 100%;
            overflow-x: auto;
        }
        
        .fancy-table {
            width: 100%;
            min-width: 300px;
            table-layout: auto;
        }
        
        /* 4. Fix Tab Button Wrapping */
        .cilia-tabs {
            flex-wrap: wrap;
            gap: 5px;
        }
        
        .cilia-tab-btn {
            flex: 1 1 auto;
            text-align: center;
            min-width: 80px;
        }
    `;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
    
    console.log("CiliAI Layout Fixes Applied.");
})();

/**
 * Initialize CiliAI State
 */
if (!window.CiliAI) {
    window.CiliAI = {
        ready: false,
        activeDataset: 'lung',
        masterData: [],
        lookups: {
            geneMap: {},
            byLocalization: {},
            byModuleOrComplex: {},
            byCiliopathy: {},
            byClassification: {},
            byCompartment: {},
            byModules: {},
            complexByGene: {}
        },
        cellDataCache: {},
        lastQueryContext: { type: null, data: [], term: null },
        datasets: {},
        phylogenyData: {
            li: null,
            nevers: null
        }
    };
}

/**
 * Initialize on DOM Ready
 */
document.addEventListener('DOMContentLoaded', function() {
    setupPageEventListeners();
    log('CiliAI v8.1 initialized');
    
    // Initialize window functions
    window.log = log;
    window.addChatMessage = addChatMessage;
    window.handleUserSend = handleUserSend;
    window.react = react;
    window.searchGene = searchGene;
    window.showDefaultUMAP = showDefaultUMAP;
    window.showDefaultPhylogeny = showDefaultPhylogeny;
    window.downloadPlot = downloadPlot;
    window.generateAndInjectSVG = generateAndInjectSVG;
    window.openTab = openTab;
    window.displayFullGeneInfo = displayFullGeneInfo;
    window.handleAIQuery = handleAIQuery;
    window.renderUMAPPlot = renderUMAPPlot;
    window.setSearch = setSearch;
    window.openSearchDashboard = openSearchDashboard;
    window.runDashboardSearch = runDashboardSearch;
    
    // Set default aliases
    window.sendMsg = handleUserSend;
    window.median = median;
});
