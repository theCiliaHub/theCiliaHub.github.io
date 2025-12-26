/* ==============================================================
 * CiliAI Queries Module - AI Query Handling
 * ============================================================== */

// Full Gene Info Display
window.displayFullGeneInfo = function(symbol) {
    const symUpper = symbol.toUpperCase();
    const g = window.CiliAI.lookups.geneMap[symUpper];
    if (!g) {
        window.addChatMessage(`<div class="ai-result-card">No record found for <strong>${symbol}</strong>.</div>`, false);
        return;
    }

    // 1. Resolve Lung Expression (Dictionary format)
    const lungExpr = window.CiliAI.cellDataCache[symUpper] || {};

    // 2. Resolve Kidney Expression (Sparse Array Mapping: Index to Name)
    const kidneySparse = (window.CiliAI.datasets.kidney?.expression || {})[symUpper] || [];
    const kidneyUmap = window.CiliAI.datasets.kidney?.umap || [];
    const kidneyExprMap = {};
    for (let i = 0; i < kidneySparse.length; i += 2) {
        const idx = kidneySparse[i];
        const val = kidneySparse[i+1];
        if (kidneyUmap[idx]) {
            const cellType = kidneyUmap[idx].cell_type;
            if(!kidneyExprMap[cellType] || val > kidneyExprMap[cellType]) kidneyExprMap[cellType] = val;
        }
    }

    // 3. Resolve Tissue Expression (RNA Consensus Dictionary)
    const tissueExpr = (window.rnaTissueExpressionData || {})[symUpper] || {};

    const formatTable = (dataMap) => {
        const entries = Object.entries(dataMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
        if (!entries.length) return '<tr><td colspan="2" style="text-align:center; padding:10px; color:#999;">No expression data found.</td></tr>';
        return entries.map(([k, v]) => `<tr><td>${k}</td><td>${Number(v).toFixed(2)}</td></tr>`).join('');
    };

    const cardId = `card-${Date.now()}`;
    const html = `
        <div class="ai-result-card" id="${cardId}">
            <h3 style="color:#005b96; margin-bottom:8px;">${symUpper} Multi-OMICS</h3>
            <p style="font-size:12px; margin-bottom:12px;"><strong>Loc:</strong> ${g.Localization || 'Unknown'}</p>
            
            <div class="detail-tabs" style="display:flex; border-bottom:1px solid #eee; margin-bottom:10px;">
                <div class="detail-tab active" style="padding:5px 10px; font-size:11px; cursor:pointer; font-weight:700;" data-target="lung">Lung</div>
                <div class="detail-tab" style="padding:5px 10px; font-size:11px; cursor:pointer; font-weight:700;" data-target="kidney">Kidney</div>
                <div class="detail-tab" style="padding:5px 10px; font-size:11px; cursor:pointer; font-weight:700;" data-target="tissue">Tissue</div>
            </div>

            <div class="detail-container">
                <div id="${cardId}-lung" class="detail-content active" style="display:block;">
                    <table class="expr-table" style="width:100%; font-size:12px;">${formatTable(lungExpr)}</table>
                </div>
                <div id="${cardId}-kidney" class="detail-content" style="display:none;">
                    <table class="expr-table" style="width:100%; font-size:12px;">${formatTable(kidneyExprMap)}</table>
                </div>
                <div id="${cardId}-tissue" class="detail-content" style="display:none;">
                    <table class="expr-table" style="width:100%; font-size:12px;">${formatTable(tissueExpr)}</table>
                </div>
            </div>
            
            <div style="margin-top:10px; display:flex; gap:5px;">
                <button class="gene-badge" style="border:none;" onclick="window.handleAIQuery('Show phylogeny of ${symUpper}')">🌍 Phylogeny</button>
                <button class="gene-badge" style="border:none;" onclick="window.handleAIQuery('Domains for ${symUpper}')">🧬 Domains</button>
            </div>
        </div>
    `;
    window.addChatMessage(html, false);

    setTimeout(() => {
        const card = document.getElementById(cardId);
        if(!card) return;
        const tabs = card.querySelectorAll('.detail-tab');
        const contents = card.querySelectorAll('.detail-content');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => { t.style.borderBottom = "none"; t.style.opacity = "0.6"; });
                contents.forEach(c => c.style.display = "none");
                tab.style.borderBottom = "2px solid #005b96";
                tab.style.opacity = "1";
                document.getElementById(`${cardId}-${tab.dataset.target}`).style.display = "block";
            };
        });
    }, 100);
};


// Gene Search
window.handleGeneSearch = function(geneSymbol, queryAI = true) {
    const gene = geneSymbol.trim().toUpperCase();
    if (!gene) return;
    if (!window.CiliAI.ready) {
        console.warn("CiliAI data is not ready for gene search.");
        return;
    }
    
    const geneData = window.CiliAI.lookups.geneMap[gene];
    if (!geneData) {
        addChatMessage(`Gene Not Found: ${gene}. This gene is not in the CiliAI database.`, false);
        return;
    }
    
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
};

// Screen Query Handler
/**
 * (UPDATED) Handles screen queries and adds a hint for references.
 * **FIXED:** Removed the internal follow-up context to prevent it from hijacking 'yes' for gene lists.
 */
function handleScreenQuery(geneSymbol) {
    // --- Data Retrieval (DO NOT REMOVE) ---
    const gene = geneSymbol.toUpperCase();
    const g = window.CiliAI.lookups.geneMap[gene];
    if (!g) return `Sorry, I could not find data for "${gene}".`;
    
    let html = `<div class="ai-result-card"><h4>Screen Results for <strong>${gene}</strong></h4>`;
    
    // Use the exact column names from your CSV
    const percEffect = g['Percentage of ciliated cells (increase/decrease/no effect)'];
    const lofEffect = g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'];
    const oeEffect = g['Overexpression effects on cilia length (increase/decrease/no effect)'];
    // --- END Data Retrieval ---

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
            // FoundScreenKeys is no longer needed here, as there is no follow-up logic.
            html += `<li><strong>${s.source}</strong>: ${s.result || 'No result'}</li>`;
        });
        html += '</ul>';

        // Add a non-interactive hint instead of a context-setting question
        html += `<p style="font-size: 11px; margin-top: 10px;">(Hint: Ask "show screen references" to see publication details.)</p>`;
        
        // *** CRITICAL REMOVAL: The lastQueryContext object for 'screen_references' is removed. ***
        // This prevents the context from being active when the user types 'yes' for a gene list.

    } else if (
        (!percEffect || percEffect === "Not Reported") &&
        (!lofEffect || lofEffect === "Not Reported") &&
        (!oeEffect || oeEffect === "Not Reported")
    ) {
        html += '<p>No specific screen data found in the database.</p>';
    }

    html += `</div>`; // Close ai-result-card
    return html;
}

    function handleOrthologQuery(geneSymbol, organism) {
        const gene = geneSymbol.toUpperCase();
        const g = window.CiliAI.lookups.geneMap[gene];
        if (!g) return `Sorry, I could not find data for "${gene}".`;
        const orgKey = `Ortholog_${organism.toLowerCase().replace(/[\.\s]/g, '_')}`; // Match CSV column
        if (g[orgKey] && g[orgKey] !== 'N/A' && g[orgKey] !== null) {
            return formatListResult(`Ortholog for ${gene} in ${organism}`, [{
                gene: gene,
                description: `${organism} Ortholog: <strong>${g[orgKey]}</strong>`
            }]);
        } else {
            return `Sorry, I could not find a ${organism} ortholog for <strong>${gene}</strong>.`;
        }
    }
    
    function handleScRnaQuery(geneSymbols) {
        let html = `<h4>scRNA Expression Data</h4>`;
        const geneMap = window.CiliAI.lookups.geneMap;
        geneSymbols.forEach(gene => {
            const g = geneMap[gene];
            if (!g) {
                html += `<p><strong>${gene}:</strong> Not found in database.</p>`;
                return;
            }
            const exp = g.expression?.scRNA;
            html += `<strong>${g.Gene}:</strong> `; // Use 'Gene'
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
            html += `<p style="font-size: 11px; margin-top: 5px;"><i>Note: A visual plot for expression comparison is not yet available.</i></p>`;
        }
        return `<div class="ai-result-card">${html}</div>`;
    }

    // --- 4D. Conversational Query Handlers ---

    function handleLocalizationQuery(term, query) {
        const geneList = getGenesByLocalization(term); 
        const count = geneList.length;
        if (count === 0) {
            return `Sorry, I could not find any genes localized to "${term}".`;
        }
        // (MODIFIED) Removed 'descriptionHeader'
        lastQueryContext = {
            type: 'list_followup',
            data: geneList, 
            term: `Genes localized to ${term}`
        };
        return `According to the latest data, ${count} genes are enriched in the ${term}. Do you want to view the list?`;
    }


    /**
     * (NEW) Extracts complex/module keywords from a query.
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


// Helper function to extract evolutionary concepts
function extractEvolutionIntent(qLower) {
    if (qLower.includes('ciliary-specific') || qLower.includes('ciliary specific')) return 'Ciliary_specific';
    if (qLower.includes('vertebrate-specific') || qLower.includes('vertebrate specific')) return 'Vertebrate_specific';
    if (qLower.includes('mammalian-specific') || qLower.includes('mammalian specific')) return 'Mammalian_specific';
    if (qLower.includes('c. elegans') || qLower.includes('conserved in')) return 'Conserved_in_elegans';
    return null;
}


    /**
     * (NEW) Helper to check if a gene is conserved (basic check).
     */
    function isGeneConserved(gene) {
        // A simple proxy for "conserved in ciliated organisms"
        return gene && gene.Ortholog_C_elegans;
    }

    
   function handleSimpleComplexQuery(term, query) {
        const geneList = getGenesByComplex(term);
        const count = geneList.length;
        if (count === 0) {
            // Fallback: check if the user meant "complexes for gene..."
            const genes = extractMultipleGenes(term);
            if (genes.length > 0) {
                return handleGeneInComplexQuery(genes[0]);
            }
            return `Sorry, I could not find any genes for the complex "${term}".`;
        }
        lastQueryContext = {
            type: 'list_followup', 
            data: geneList, 
            term: `Genes in ${term}`,
            descriptionHeader: 'Description'
        };
        return `I found ${count} genes in the ${term} complex. Do you want to view the list?`;
    }
    
    function handleGeneInComplexQuery(geneSymbol) {
        const g = window.CiliAI.lookups.geneMap[geneSymbol];
        if (!g) return `Sorry, I could not find data for "${geneSymbol}".`;
        const complexNames = window.CiliAI.lookups.complexByGene[geneSymbol] || [];
        if (complexNames.length === 0) {
            return `No complex data was found for <strong>${geneSymbol}</strong>.`;
        }
        const complexList = complexNames.map(name => ({
            gene: name,
            description: "Known Complex"
        }));
        return formatListResult(`Complexes containing ${geneSymbol}`, complexList);
    }
    
    function handleClassificationQuery(classificationName, query) {
        const qLower = query.toLowerCase();
        
        // Find the cased name, e.g., "Primary Ciliopathies"
        const casedClassificationName = Object.keys(getDiseaseClassificationMap()).find(key => normalizeTerm(key) === normalizeTerm(classificationName));
        if (!casedClassificationName) {
            return `Sorry, I don't recognize the classification "${classificationName}".`;
        }
        
        const normKey = normalizeTerm(casedClassificationName);
        
        if (qLower.includes('gene') || qLower.includes('genes') || qLower.includes('gene list')) {
            const geneList = window.CiliAI.lookups.byClassification[normKey] || [];
            const count = geneList.length;

            if (count === 0) {
                return `I did not find any genes directly associated with the classification "${casedClassificationName}".`;
            }
            
            const geneMap = window.CiliAI.lookups.geneMap;
            // (MODIFIED) Use 'classification' as the key
            const geneListObjects = geneList.map(gene => ({
                gene: gene,
                classification: geneMap[gene]?.ciliopathy_classification || 'No classification listed'
            })).sort((a, b) => a.gene.localeCompare(b.gene)); 

            // (MODIFIED) Removed 'descriptionHeader'
            lastQueryContext = {
                type: 'list_followup',
                data: geneListObjects,
                term: `Genes for ${casedClassificationName}`
            };
            return `I found ${count} unique genes associated with ${casedClassificationName}. Do you want to view the list?`;
        
        } else {
            // User just wants to list the diseases in the classification
            const diseaseMap = getDiseaseClassificationMap();
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


// Tell about CiliAI
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

// Format list result
function formatListResult(title, genes, description = "") {
    let geneListHtml = '';
    if (genes && genes.length > 0) {
        const genesToShow = genes.slice(0, 20);
        geneListHtml = genesToShow.map(g =>
            `<li><strong>${g.gene}</strong>: ${g.description || 'No details available.'}</li>`
        ).join('');
        geneListHtml = `<ul>${geneListHtml}</ul>`;
        if (genes.length > 20) {
            geneListHtml += `<p style="font-size: 11px;">...and ${genes.length - 20} more.</p>`;
        }
    } else {
        geneListHtml = "<p>No matching genes found in the database.</p>";
    }
    
    const descriptionHtml = description ? `<p>${description}</p>` : '';
    return `
        <div class="ai-result-card">
            <strong>${title}</strong>
            ${descriptionHtml}
            ${geneListHtml}
        </div>
    `;
}

// Reaction handler
window.react = function(type) {
    const userMessages = Array.from(document.querySelectorAll('.ciliai-message.user'));
    const lastQuestion = userMessages.length > 0 
        ? (userMessages[userMessages.length - 1].querySelector('.ciliai-message-content')?.textContent || '').trim()
        : 'No question';

    const feedbackType = type === 'up' ? 'Positive' : 'Negative';

    // Silent feedback tracking
    new Image().src = 'https://script.google.com/macros/s/AKfycby5PdLZdYKN9S06Tbt3x8lQfDrFhOXo3RteQbY6NFZawx22bH_EC2XuIf5_I6lDPSl5/exec' +
        '?type='     + encodeURIComponent(feedbackType) +
        '&question=' + encodeURIComponent(lastQuestion.substring(0, 500)) +
        '&url='      + encodeURIComponent(location.href) +
        '&t='        + Date.now();

    if (type === 'up') {
        addChatMessage('Thank you! Feedback received', false);
    } else {
        addChatMessage('Got it – thank you for the feedback!', false);
    }
};

// Send feedback email
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
    
    // Open user's email client with pre-filled message
    window.open(`mailto:oktay.kaplan@agu.edu.tr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
}

// Main AI Query Handler
window.handleAIQuery = async function (query) {
    const chatWindow = document.getElementById('messages');
    if (!chatWindow) return;
    if (!query) return;
    const qLower = query.toLowerCase().trim();
    
    // === 1. HIGHEST PRIORITY: Cell-type specific questions (your existing fix) ===
    if (qLower.includes('cilia-restricted') ||
        qLower.includes('cilia restricted') ||
        qLower.includes('ciliary-restricted') ||
        qLower.includes('specific to') ||
        (qLower.includes('express') && qLower.includes('cell')) ||
        qLower.includes('active in') ||
        (qLower.includes('tpm') && qLower.includes('cell'))) {
        const result = window.handleCellTypeQuestion(query);
        if (result) {
            window.addChatMessage(result, false);
            return;
        }
    }
    
    if (window.log) window.log(`Routing query: ${query}`);
    
    try {
        if (!window.CiliAI || !window.CiliAI.ready) {
            window.addChatMessage("Data is still loading, please wait...", false);
            return;
        }
        
        let htmlResult = null;
        let match;
        
        // === 2. GENERALIZED: "Where is [GENE] expressed?" for ANY ciliary gene ===
        if (qLower.includes('where is') && qLower.includes('expressed')) {
            const genes = extractMultipleGenes(query);
            if (genes.length > 0) {
                const geneSymbol = genes[0];
                const gene = window.CiliAI.lookups.geneMap[geneSymbol];
                if (!gene) {
                    htmlResult = `<div class="ai-result-card"><p>Gene <strong>${geneSymbol}</strong> not found in database.</p></div>`;
                } else {
                    const loc = gene.Localization || 'Not specified';
                    let expressionInfo = '';
                    let scrnaSummary = '';
                    if (gene.expression?.scRNA) {
                        const expressed = getExpressedCellTypes(gene.expression.scRNA);
                        if (expressed.length > 0) {
                            scrnaSummary = `<p><strong>scRNA-seq (lung):</strong> Expressed in: <strong>${expressed.join(', ')}</strong></p>`;
                        }
                    }
                    // Detect motile cilia genes
                    const isMotile = loc.toLowerCase().includes('axoneme') ||
                                     loc.toLowerCase().includes('dynein') ||
                                     loc.toLowerCase().includes('radial spoke') ||
                                     geneSymbol.startsWith('DNAH') ||
                                     geneSymbol.startsWith('DNAI') ||
                                     geneSymbol.includes('DNAAF') ||
                                     (gene.Ciliopathies && gene.Ciliopathies.includes('Primary Ciliary Dyskinesia'));
                    const isMulticiliatedMarker = geneSymbol === 'FOXJ1' || loc.toLowerCase().includes('multiciliated');
                    
                    if (isMotile) {
                        expressionInfo = `
                            <p><strong>${geneSymbol}</strong> is expressed in <strong>cells with motile cilia</strong>:</p>
                            <ul>
                                <li>Multiciliated respiratory epithelium (lungs, trachea, bronchi)</li>
                                <li>Fallopian tube epithelium</li>
                                <li>Testicular sperm flagella</li>
                            </ul>
                            <p><strong>Localization:</strong> ${loc}</p>
                            <p>Defects often cause <strong>Primary Ciliary Dyskinesia (PCD)</strong>.</p>
                        `;
                    } else if (isMulticiliatedMarker) {
                        expressionInfo = `
                            <p><strong>${geneSymbol}</strong> is a master regulator of <strong>multiciliogenesis</strong>.</p>
                            <p>Specifically expressed in <strong>multiciliated cells</strong> (e.g., airway epithelium).</p>
                            ${scrnaSummary}
                        `;
                    } else {
                        expressionInfo = `
                            <p><strong>${geneSymbol}</strong> is expressed in cells with <strong>primary cilia</strong> (most vertebrate cell types).</p>
                            <p>Enriched in:</p>
                            <ul>
                                <li>Kidney tubules and collecting ducts</li>
                                <li>Brain (neurons, cerebellum)</li>
                                <li>Retina (photoreceptors)</li>
                                <li>Liver, pancreas, and other organs</li>
                            </ul>
                            <p><strong>Localization:</strong> ${loc}</p>
                            ${scrnaSummary}
                        `;
                    }
                    htmlResult = `
                        <div class="ai-result-card">
                            <h4>Expression of ${geneSymbol}</h4>
                            ${expressionInfo}
                        </div>
                    `;
                }
                if (htmlResult) {
                    window.addChatMessage(htmlResult, false);
                    return;
                }
            }
        }
        
        // === FIX: Handle "GO: intraflagellar transport" as a special case FIRST ===
        if (qLower.includes('go: intraflagellar transport') || qLower.includes('go term: intraflagellar transport')) {
            const genes = ['IFT88', 'IFT81', 'IFT172', 'IFT140', 'IFT122', 'WDR19', 'TTC21B', 'IFT80', 'IFT57', 'TRAF3IP1', 'CLUAP1', 'IFT20', 'IFT74', 'IFT52', 'IFT46', 'KIF3A', 'KIF3B', 'KIF17', 'DYNC2H1'];
            
            // Apply visualization
            window.resetViews();
            
            let visualizationApplied = false;
            if (window.SpatialManager && typeof window.SpatialManager.applyMultiOverlay === 'function') {
                window.SpatialManager.applyMultiOverlay(genes);
                visualizationApplied = true;
            } else if (typeof window.highlightCiliumLocation === 'function') {
                genes.forEach(gene => {
                    const geneData = window.CiliAI.lookups.geneMap[gene];
                    if (geneData && geneData.Localization) {
                        window.highlightCiliumLocation(geneData.Localization, gene);
                    }
                });
                visualizationApplied = true;
            }
            
            const preview = genes.slice(0, 8).join(', ');
            const more = genes.length > 8 ? `... and ${genes.length - 8} more` : '';
            
            htmlResult = `
                <div class="ai-result-card">
                    <h4>GO Term: intraflagellar transport</h4>
                    <p>Found <strong>${genes.length}</strong> IFT (intraflagellar transport) genes.</p>
                    <p><strong>Examples:</strong> ${preview}${more}</p>
                    ${visualizationApplied 
                        ? '<p>A <strong>multi-colored overlay</strong> has been applied to the ciliary diagram showing IFT protein localization.</p>'
                        : '<p>Visualization could not be applied. Showing IFT gene list instead.</p>'}
                    <p>IFT proteins form trains that transport cargo along the ciliary axoneme.</p>
                    <div style="margin-top: 10px;">
                        <button class="ciliai-button" onclick="window.handleBatchQuery('${genes.join(',')}')" style="background: #D4EDDA;">
                            📊 Show Batch Table for ${genes.length} IFT Genes
                        </button>
                    </div>
                </div>
            `;
            
            window.addChatMessage(htmlResult, false);
            return;
        }
        
        // === 3. FULLY FIXED CILIOPATHY CLASSIFICATION, OVERLAP & ORTHOLOG HANDLER ===
        const classificationMap = getDiseaseClassificationMap();
        // Extended keyword mapping (includes common variations)
        const classificationKeywords = {
            'primary ciliopathies': 'Primary Ciliopathies',
            'primary': 'Primary Ciliopathies',
            'motile ciliopathies': 'Motile Ciliopathies',
            'motile': 'Motile Ciliopathies',
            'secondary diseases': 'Secondary Diseases',
            'secondary': 'Secondary Diseases',
            'atypical ciliopathies': 'Atypical Ciliopathies',
            'atypical': 'Atypical Ciliopathies'
        };
        let matchedClassification = null;
        for (const [kw, full] of Object.entries(classificationKeywords)) {
            if (qLower.includes(kw)) {
                matchedClassification = full;
                break;
            }
        }
        
        // === MODEL ORGANISM ORTHOLOGS/HOMOLOGS FOR CILIOPATHY GROUPS ===
        const organismKeywords = {
            'mouse': 'Mouse',
            'drosophila': 'Drosophila',
            'fly': 'Drosophila',
            'c. elegans': 'C_elegans',
            'worm': 'C_elegans',
            'zebrafish': 'Zebrafish',
            'fish': 'Zebrafish',
            'xenopus': 'Xenopus',
            'frog': 'Xenopus'
        };
        let requestedOrganism = null;
        for (const [keyword, field] of Object.entries(organismKeywords)) {
            if (qLower.includes(keyword)) {
                requestedOrganism = field;
                break;
            }
        }
        
        // Only run if a model organism is mentioned AND a ciliopathy group is mentioned
        if (requestedOrganism &&
            (qLower.includes('senior løken') ||
             qLower.includes('bardet biedl') ||
             qLower.includes('meckel gruber') ||
             qLower.includes('joubert') ||
             qLower.includes('primary ciliopathy') ||
             qLower.includes('motile ciliopathy') ||
             qLower.includes('atypical ciliopathy') ||
             qLower.includes('all ciliopathy') ||
             qLower.includes('ciliopathies') ||
             qLower.includes('ciliopathy genes'))) {
            let targetGenes = new Set();
            // Collect human genes
            if (qLower.includes('all ciliopathy') || qLower.includes('ciliopathies')) {
                ['Primary Ciliopathies', 'Motile Ciliopathies', 'Atypical Ciliopathies'].forEach(className => {
                    window.CiliAI.masterData.forEach(gene => {
                        if (gene.ciliopathy_classification === className) {
                            targetGenes.add(gene.Gene);
                        }
                    });
                });
            } else if (qLower.includes('primary ciliopathy')) {
                window.CiliAI.masterData.forEach(gene => {
                    if (gene.ciliopathy_classification === 'Primary Ciliopathies') {
                        targetGenes.add(gene.Gene);
                    }
                });
            } else if (qLower.includes('motile ciliopathy')) {
                window.CiliAI.masterData.forEach(gene => {
                    if (gene.ciliopathy_classification === 'Motile Ciliopathies') {
                        targetGenes.add(gene.Gene);
                    }
                });
            } else if (qLower.includes('atypical ciliopathy')) {
                window.CiliAI.masterData.forEach(gene => {
                    if (gene.ciliopathy_classification === 'Atypical Ciliopathies') {
                        targetGenes.add(gene.Gene);
                    }
                });
            } else if (qLower.includes('joubert')) {
                window.CiliAI.masterData.forEach(gene => {
                    if (gene.Ciliopathy && normalizeTerm(gene.Ciliopathy).includes('joubert')) {
                        targetGenes.add(gene.Gene);
                    }
                });
            }
            
            if (targetGenes.size === 0) {
                window.addChatMessage(`<div class="ai-result-card"><p>No genes found for the requested group.</p></div>`, false);
                return;
            }
            
            const mappings = [];
            targetGenes.forEach(humanGene => {
                const geneData = window.CiliAI.lookups.geneMap[humanGene];
                if (geneData) {
                    const orthoField = `Ortholog_${requestedOrganism}`;
                    const ortholog = geneData[orthoField];
                    if (ortholog && ortholog !== 'null' && ortholog.trim()) {
                        mappings.push({ human: humanGene, ortholog: ortholog.trim() });
                    }
                }
            });
            
            if (mappings.length === 0) {
                const orgName = requestedOrganism === 'C_elegans' ? 'C. elegans' : requestedOrganism;
                window.addChatMessage(`<div class="ai-result-card"><p>No ${orgName} orthologs found.</p></div>`, false);
                return;
            }
            
            mappings.sort((a, b) => a.human.localeCompare(b.human));
            const listHtml = mappings.map(m => `<li><strong>${m.human}</strong> → <em>${m.ortholog}</em></li>`).join('');
            const groupName = qLower.includes('all') ? 'All Ciliopathies' :
                              qLower.includes('joubert') ? 'Joubert Syndrome' :
                              qLower.includes('primary') ? 'Primary Ciliopathies' :
                              qLower.includes('motile') ? 'Motile Ciliopathies' :
                              qLower.includes('atypical') ? 'Atypical Ciliopathies' : 'Group';
            const orgDisplay = requestedOrganism === 'C_elegans' ? 'C. elegans' : requestedOrganism;
            window.addChatMessage(`<div class="ai-result-card">
                <h4>${orgDisplay} Orthologs: ${groupName}</h4>
                <p><strong>${mappings.length}</strong> mappings:</p>
                <ul style="columns: 2;">${listHtml}</ul>
            </div>`, false);
            return; // Critical: stop further processing
        }
        
        // === A. List diseases in classification ===
        if (matchedClassification && !qLower.includes('genes')) {
            const diseases = classificationMap[matchedClassification];
            htmlResult = `<div class="ai-result-card">
                <h4>${matchedClassification} (${diseases.length} diseases)</h4>
                <ul style="columns: 2; font-size: 13px; line-height: 1.5;">
                    ${diseases.map(d => `<li>${d}</li>`).join('')}
                </ul>
            </div>`;
            window.addChatMessage(htmlResult, false);
            return;
        }
        
        // === B. Genes in a classification (Primary, Secondary, etc.) ===
        if (qLower.includes('genes') && matchedClassification) {
            const diseases = classificationMap[matchedClassification];
            let allGenes = new Set();
            diseases.forEach(disease => {
                const normKey = normalizeTerm(disease);
                const genes = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                genes.forEach(g => allGenes.add(g));
            });
            const geneList = Array.from(allGenes);
            if (geneList.length === 0) {
                htmlResult = `<div class="ai-result-card"><p>No genes found for <strong>${matchedClassification}</strong>.</p></div>`;
            } else {
                const geneObjects = geneList.map(g => ({
                    gene: g,
                    description: window.CiliAI.lookups.geneMap[g]?.Localization || 'Ciliary protein'
                }));
                window.CiliAI.lastQueryContext = {  // FIX: Use window.CiliAI.lastQueryContext, not lastQueryContext
                    type: 'list_followup',
                    data: geneObjects,
                    term: `Genes in ${matchedClassification}`
                };
                htmlResult = `<div class="ai-result-card">
                    <h4>Genes Associated with ${matchedClassification}</h4>
                    <p>Found <strong>${geneList.length}</strong> unique genes across all related diseases.</p>
                    <p>Would you like to <strong>view the full list</strong>?</p>
                </div>`;
            }
            window.addChatMessage(htmlResult, false);
            return;
        }
        
        // === C. Shared genes between any two classifications or diseases ===
        if (qLower.includes('shared') || qLower.includes('overlap') || qLower.includes('common') || qLower.includes('between')) {
            let set1 = null, set2 = null;
            let name1 = '', name2 = '';
            const foundClasses = Object.keys(classificationKeywords).filter(k => qLower.includes(k));
            if (foundClasses.length >= 2) {
                name1 = classificationKeywords[foundClasses[0]];
                name2 = classificationKeywords[foundClasses[1]];
                const diseases1 = classificationMap[name1];
                const diseases2 = classificationMap[name2];
                set1 = new Set();
                set2 = new Set();
                diseases1.forEach(d => {
                    const genes = window.CiliAI.lookups.byCiliopathy[normalizeTerm(d)] || [];
                    genes.forEach(g => set1.add(g));
                });
                diseases2.forEach(d => {
                    const genes = window.CiliAI.lookups.byCiliopathy[normalizeTerm(d)] || [];
                    genes.forEach(g => set2.add(g));
                });
            } else {
                const diseaseKeywords = {
                    'mks': 'Meckel–Gruber Syndrome', 'meckel': 'Meckel–Gruber Syndrome',
                    'nphp': 'Nephronophthisis', 'nephronophthisis': 'Nephronophthisis',
                    'joubert': 'Joubert Syndrome', 'bbs': 'Bardet–Biedl Syndrome',
                    'pcd': 'Primary Ciliary Dyskinesia', 'senior': 'Senior-Løken Syndrome'
                };
                const foundDiseases = Object.keys(diseaseKeywords).filter(k => qLower.includes(k));
                if (foundDiseases.length >= 2) {
                    name1 = diseaseKeywords[foundDiseases[0]];
                    name2 = diseaseKeywords[foundDiseases[1]];
                    set1 = new Set(window.CiliAI.lookups.byCiliopathy[normalizeTerm(name1)] || []);
                    set2 = new Set(window.CiliAI.lookups.byCiliopathy[normalizeTerm(name2)] || []);
                }
            }
            
            if (set1 && set2) {
                const overlap = [...set1].filter(g => set2.has(g));
                if (overlap.length === 0) {
                    htmlResult = `<div class="ai-result-card">
                        <h4>No Shared Genes</h4>
                        <p>No overlapping genes found between <strong>${name1}</strong> and <strong>${name2}</strong>.</p>
                    </div>`;
                } else {
                    const geneObjects = overlap.map(g => ({ gene: g }));
                    window.CiliAI.lastQueryContext = {  // FIX: Use window.CiliAI.lastQueryContext
                        type: 'list_followup',
                        data: geneObjects,
                        term: `Shared: ${name1} ∩ ${name2}`
                    };
                    htmlResult = `<div class="ai-result-card">
                        <h4>Shared Genes: ${name1} ∩ ${name2}</h4>
                        <p><strong>${overlap.length}</strong> gene(s) in common:</p>
                        <p><strong>${overlap.join(', ')}</strong></p>
                        <p>(These are often allelic — same gene, different severity)</p>
                        <p>Would you like to <strong>view details</strong>?</p>
                    </div>`;
                }
                window.addChatMessage(htmlResult, false);
                return;
            }
        }
        
        // === SAFE "yes" HANDLER FOR LIST FOLLOW-UP - FIXED VERSION ===
        if ((qLower === 'yes' || qLower === 'y' || qLower === 'sure' || qLower === 'show' || qLower === 'list') &&
            window.CiliAI.lastQueryContext && window.CiliAI.lastQueryContext.type === 'list_followup') {
            if (window.CiliAI.lastQueryContext.data && window.CiliAI.lastQueryContext.data.length > 0) {
                // Clear the main panel first
                if (typeof window.resetViews === 'function') {
                    window.resetViews();
                }
                
                // Show the data in left panel
                if (typeof window.showDataInLeftPanel === 'function') {
                    window.showDataInLeftPanel(
                        window.CiliAI.lastQueryContext.term || 'Gene List',
                        window.CiliAI.lastQueryContext.data || []
                    );
                    window.addChatMessage(`Displaying <strong>${window.CiliAI.lastQueryContext.term}</strong> (${window.CiliAI.lastQueryContext.data.length} genes) in the main panel.`, false);
                } else {
                    // Fallback: show as HTML table
                    const geneList = window.CiliAI.lastQueryContext.data.map(item => item.gene);
                    const geneTable = geneList.map(gene => `<tr><td>${gene}</td><td>${window.CiliAI.lookups.geneMap[gene]?.Localization || '-'}</td></tr>`).join('');
                    htmlResult = `
                        <div class="ai-result-card">
                            <h4>${window.CiliAI.lastQueryContext.term}</h4>
                            <p>Showing ${geneList.length} genes:</p>
                            <table style="width:100%; border-collapse:collapse; margin-top:10px;">
                                <thead>
                                    <tr style="background:#f1f5f9;">
                                        <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0;">Gene</th>
                                        <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0;">Localization</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${geneTable}
                                </tbody>
                            </table>
                        </div>
                    `;
                    window.addChatMessage(htmlResult, false);
                }
            } else {
                window.addChatMessage(`No genes to display for <strong>${window.CiliAI.lastQueryContext.term}</strong>.`, false);
            }
            window.CiliAI.lastQueryContext = { type: null, data: [], term: null };
            return;
        }
        
        // === ORTHOLOG QUESTIONS (Mouse, Drosophila, C. elegans) ===
        if (qLower.includes('ortholog') || qLower.includes('orthologue')) {
            const genes = extractMultipleGenes(query);
            if (genes.length === 0) {
                window.addChatMessage(`<div class="ai-result-card"><p>Please specify a gene (e.g., "ortholog of ARL13B").</p></div>`, false);
                return;
            }
            const geneSymbol = genes[0];
            const geneData = window.CiliAI.lookups.geneMap[geneSymbol];
            if (!geneData) {
                window.addChatMessage(`<div class="ai-result-card"><p>Gene <strong>${geneSymbol}</strong> not found in database.</p></div>`, false);
                return;
            }
            const mouse = geneData.Ortholog_Mouse || 'Not reported';
            const drosophila = geneData.Ortholog_Drosophila || 'Not reported';
            const celegans = geneData.Ortholog_C_elegans || 'Not reported';
            let response = `<div class="ai-result-card">
                <h4>Orthologs of ${geneSymbol}</h4>
                <ul style="margin: 10px 0;">`;
            if (qLower.includes('mouse') || qLower.includes('all')) {
                response += `<li><strong>Mouse:</strong> ${mouse}</li>`;
            }
            if (qLower.includes('drosophila') || qLower.includes('fly') || qLower.includes('all')) {
                response += `<li><strong>Drosophila:</strong> ${drosophila}</li>`;
            }
            if (qLower.includes('c. elegans') || qLower.includes('worm') || qLower.includes('all')) {
                response += `<li><strong>C. elegans:</strong> ${celegans}</li>`;
            }
            response += `</ul></div>`;
            window.addChatMessage(response, false);
            return;
        }
        
        // === TOTAL UNIQUE GENES IN CILIOPATHIES ===
        const ciliopathyQueryPatterns = [
            'how many unique genes.*ciliopathies',
            'how many unique.*ciliopathy genes',
            'how many.*unique genes.*ciliopathies',
            'total unique genes.*ciliopathies',
            'total.*unique.*ciliopathy genes',
            'number of unique genes.*ciliopathies',
            'unique genes in ciliopathies',
            'ciliopathies unique genes count',
            'how many genes are in ciliopathies'
        ];
        const matchesCiliopathyCount = ciliopathyQueryPatterns.some(pattern =>
            new RegExp(pattern, 'i').test(query)
        );
        if (matchesCiliopathyCount ||
            (qLower.includes('how many') && qLower.includes('unique') && qLower.includes('genes') && qLower.includes('ciliopathies'))) {
            const includedClasses = [
                'Primary Ciliopathies',
                'Motile Ciliopathies',
                'Atypical Ciliopathies'
            ];
            let allUniqueGenes = new Set();
            includedClasses.forEach(className => {
                const diseases = classificationMap[className] || [];
                diseases.forEach(disease => {
                    const normKey = normalizeTerm(disease);
                    const genes = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                    genes.forEach(g => allUniqueGenes.add(g));
                });
            });
            const totalCount = allUniqueGenes.size;
            htmlResult = `<div class="ai-result-card">
                <h4>Total Unique Genes in Ciliopathies</h4>
                <p>Across <strong>Primary, Motile, and Atypical Ciliopathies</strong>:</p>
                <p style="font-size:22px; font-weight:bold; color:#2b6cb0; margin:20px 0;">
                    <strong>${totalCount}</strong> unique genes
                </p>
                <p>This count includes all known causative and associated genes from the three core ciliopathy classes.</p>
                <p><em>(Secondary diseases are excluded from this total.)</em></p>
            </div>`;
            window.addChatMessage(htmlResult, false);
            return;
        }
        
        // === "How many genes are in [disease/classification]?" ===
        if (qLower.match(/how many.*genes.*(in|for|are|associated with)/i)) {
            let target = null;
            if (qLower.includes('joubert')) target = 'Joubert Syndrome';
            else if (qLower.includes('mks') || qLower.includes('meckel')) target = 'Meckel–Gruber Syndrome';
            else if (qLower.includes('bbs')) target = 'Bardet–Biedl Syndrome';
            else if (qLower.includes('nphp') || qLower.includes('nephronophthisis')) target = 'Nephronophthisis';
            else if (qLower.includes('pcd')) target = 'Primary Ciliary Dyskinesia';
            else if (qLower.includes('senior')) target = 'Senior-Løken Syndrome';
            else if (qLower.includes('primary ciliopathies')) target = 'Primary Ciliopathies';
            else if (qLower.includes('motile ciliopathies')) target = 'Motile Ciliopathies';
            else if (qLower.includes('atypical ciliopathies')) target = 'Atypical Ciliopathies';
            
            if (target) {
                let geneList = [];
                if (target === 'Primary Ciliopathies' || target === 'Motile Ciliopathies' || target === 'Atypical Ciliopathies') {
                    const diseases = classificationMap[target] || [];
                    let set = new Set();
                    diseases.forEach(d => {
                        const genes = window.CiliAI.lookups.byCiliopathy[normalizeTerm(d)] || [];
                        genes.forEach(g => set.add(g));
                    });
                    geneList = Array.from(set);
                } else {
                    const normKey = normalizeTerm(target);
                    geneList = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                }
                const count = geneList.length;
                htmlResult = `<div class="ai-result-card">
                    <h4>Genes in ${target}</h4>
                    <p style="font-size:18px; font-weight:bold; color:#2b6cb0; margin:15px 0;">
                        <strong>${count}</strong> unique gene${count === 1 ? '' : 's'}
                    </p>
                    <p>These are all known causative/associated genes in the database.</p>
                    <p>Would you like to <strong>view the full list</strong>?</p>
                </div>`;
                window.CiliAI.lastQueryContext = {
                    type: 'list_followup',
                    data: geneList.map(g => ({ gene: g })),
                    term: `Genes in ${target}`
                };
                window.addChatMessage(htmlResult, false);
                return;
            }
        }
        
        // === Disease implicated by a gene ===
        if ((qLower.includes('disease') || qLower.includes('ciliopathy')) &&
            (qLower.includes('implicated') || qLower.includes('associated') || qLower.includes('linked') || qLower.includes('cause')) &&
            qLower.includes('with')) {
            const genes = extractMultipleGenes(query);
            if (genes.length === 0) return;
            const geneSymbol = genes[0];
            const geneData = window.CiliAI.lookups.geneMap[geneSymbol];
            if (!geneData) {
                htmlResult = `<div class="ai-result-card">
                    <p>Gene <strong>${geneSymbol}</strong> not found in the database.</p>
                </div>`;
                window.addChatMessage(htmlResult, false);
                return;
            }
            let associatedDiseases = [];
            Object.keys(window.CiliAI.lookups.byCiliopathy).forEach(normKey => {
                const diseaseGenes = window.CiliAI.lookups.byCiliopathy[normKey] || [];
                if (diseaseGenes.includes(geneSymbol)) {
                    let foundName = normKey;
                    Object.values(classificationMap).flat().forEach(d => {
                        if (normalizeTerm(d) === normKey) foundName = d;
                    });
                    associatedDiseases.push(foundName);
                }
            });
            if (associatedDiseases.length === 0 && geneData.Ciliopathies) {
                associatedDiseases = Array.isArray(geneData.Ciliopathies)
                    ? geneData.Ciliopathies
                    : [geneData.Ciliopathies];
            }
            if (associatedDiseases.length === 0) {
                htmlResult = `<div class="ai-result-card">
                    <p><strong>${geneSymbol}</strong> is a known ciliary gene but not yet directly linked to a specific ciliopathy in the current database.</p>
                    <p>It localizes to the <strong>${geneData.Localization || 'cilium'}</strong> and is highly conserved.</p>
                </div>`;
            } else {
                htmlResult = `<div class="ai-result-card">
                    <h4>Disease Associations: ${geneSymbol}</h4>
                    <p><strong>${geneSymbol}</strong> is implicated in the following ciliopathies:</p>
                    <ul>
                        ${associatedDiseases.map(d => `<li><strong>${d}</strong></li>`).join('')}
                    </ul>
                    <p>These are typically <strong>transition zone</strong> disorders with overlapping phenotypes (brain, retina, kidney).</p>
                </div>`;
            }
            window.addChatMessage(htmlResult, false);
            return;
        }
        
        // === Mouse Knockout Phenotype Handler ===
        if (qLower.includes('mouse') && (qLower.includes('knockout') || qLower.includes('phenotype')) && qLower.includes('of')) {
            const genes = extractMultipleGenes(query);
            if (genes.length > 0) {
                const gene = genes[0];
                const data = window.CiliAI.lookups.geneMap[gene];
                if (data && (data.mouse_phenotype || data.mouse_ciliopathy_phenotype)) {
                    const pheno = data.mouse_phenotype || 'Ciliopathy-related phenotype observed';
                    const model = data.Ortholog_Mouse ? ` (${data.Ortholog_Mouse} mouse model)` : '';
                    htmlResult = `<div class="ai-result-card">
                        <h4>Mouse Knockout Phenotype: ${gene}${model}</h4>
                        <p><strong>Phenotype:</strong> ${pheno}</p>
                        ${data.mouse_ciliopathy_phenotype ? '<p>Known ciliopathy model.</p>' : ''}
                    </div>`;
                } else {
                    htmlResult = `<div class="ai-result-card">
                        <p>No mouse knockout phenotype data available for <strong>${gene}</strong> in current database.</p>
                    </div>`;
                }
                window.addChatMessage(htmlResult, false);
                return;
            }
        }
        
        // Intent 1: Greetings
        const simpleGreetings = ['hello', 'hi', 'hey', 'greetings'];
        const terminologyQueries = window.terminologyQueries || {};
        if (simpleGreetings.includes(qLower)) {
            window.addChatMessage("Hello! I'm CiliAI. How can I help you? Try asking 'What is IFT88?' or 'List genes in the transition zone'.", false);
            return;
        }
        if (terminologyQueries[qLower]) {
            window.addChatMessage(`<div class="ai-result-card"><p>${terminologyQueries[qLower]}</p></div>`, false);
            return;
        }
        
        // Intent 2: Default Buttons
        if (qLower === 'plot default umap') {
            if (!window.CiliAI.activeDataset) window.CiliAI.activeDataset = 'lung';
            window.renderUMAPPlot('WDR31', ['WDR31']);
            const dsName = window.CiliAI.datasets[window.CiliAI.activeDataset].name;
            htmlResult = `<div class="ai-result-card"><p>Displaying ${dsName} scRNA-seq UMAP for <strong>WDR31</strong> on the left.</p></div>`;
        }
        else if (qLower === 'plot default phylogeny') {
            htmlResult = await window.handleAIQuery(`show nevers plot for ${DEFAULT_PHYLO_GENES.join(',')}`);
            return;
        }
        
        // Intent 3: Contextual Follow-up
        const isComplexQuery = qLower.includes('expression') || qLower.includes('plot') || qLower.includes('umap') || qLower.includes('scrna') || qLower.includes('kidney') || qLower.includes('lung') || qLower.includes('evolution');
        const yesRegex = /^(yes|yeah|sure|ok|okay|yep|show|view|list|show list|view list|display)/i;
        if (!isComplexQuery && htmlResult === null && yesRegex.test(qLower) && window.CiliAI.lastQueryContext && window.CiliAI.lastQueryContext.type) {
            if (window.CiliAI.lastQueryContext.type === 'list_followup') {
                if (typeof window.showDataInLeftPanel === 'function') {
                    window.showDataInLeftPanel(
                        window.CiliAI.lastQueryContext.term || 'Gene List',
                        window.CiliAI.lastQueryContext.data || []
                    );
                    window.addChatMessage(`Displaying <strong>${window.CiliAI.lastQueryContext.term}</strong> in the main panel.`, false);
                }
                window.CiliAI.lastQueryContext = { type: null, data: [], term: null };
                return;
            }
            else if (window.CiliAI.lastQueryContext.type === 'screen_references') {
                htmlResult = window.handleScreenReferenceFollowup();
                window.CiliAI.lastQueryContext = { type: null, data: [], term: null };
            }
            else if (window.CiliAI.lastQueryContext.type === 'top_500_ciliary') {
                const top500 = window.CiliAI.masterData.slice(0, 500).map(g => ({
                    Gene: g.Gene,
                    Localization: g.Localization || '-',
                    Description: g['Gene.Description'] || '-'
                }));
                if (typeof window.showDataInLeftPanel === 'function') {
                    window.showDataInLeftPanel('Top 500 Ciliary Genes', top500);
                    htmlResult = "I've loaded the top 500 ciliary genes into the main panel.";
                }
                window.CiliAI.lastQueryContext = { type: null };
            }
        }
        
        // Intent 4: List Genes - FIXED VERSION FOR "List transition zone genes"
        if (htmlResult === null && (match = qLower.match(/^(?:list|show|display|find|give me)\s+(?:all\s+)?(.+?)\s+genes$/i))) {
            const term = match[1].trim();
            const termUpper = term.toUpperCase();
            let genes = [];
            const locList = window.getGenesByLocalization(term);
            if (locList.length > 0) genes = locList.map(g => g.gene);
            if (genes.length === 0) {
                if (window.CiliAI.lookups.byCompartment?.[termUpper]) genes = window.CiliAI.lookups.byCompartment[termUpper];
                else if (window.CiliAI.lookups.byModuleOrComplex?.[termUpper]) genes = window.CiliAI.lookups.byModuleOrComplex[termUpper];
            }
            
            // Hardcoded fallback for transition zone
            if (genes.length === 0 && term.toLowerCase().includes('transition zone')) {
                genes = ['TMEM67', 'TMEM216', 'TMEM237', 'CEP290', 'CC2D2A', 'TCTN1', 'TCTN2', 'MKS1', 'NPHP1', 'RPGRIP1L', 
                        'NPHP4', 'NPHP3', 'AHI1', 'INVS', 'IQCB1', 'B9D1', 'B9D2', 'TMEM138', 'TMEM231', 'TMEM107'];
            }
            
            if (genes.length > 0) {
                const rows = genes.map(g => ({ 
                    gene: g,
                    description: window.CiliAI.lookups.geneMap[g]?.Localization || 'Ciliary protein'
                }));
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
                htmlResult = `<div class="ai-result-card">
                    <p>I couldn't find a gene set for <strong>${term}</strong> in the database.</p>
                    <p>Try: "List transition zone genes" or "List IFT genes"</p>
                </div>`;
            }
            window.addChatMessage(htmlResult, false);
            return;
        }
        
        // Intent 5: Phylogeny - FIXED for background consistency
        if (htmlResult === null && (qLower.includes('evolution') || qLower.includes('conservation') || qLower.includes('phylogenetic') || qLower.includes('phylogeny') || qLower.includes('evo of') || qLower.match(/show.+evolution/i) || (qLower.includes('show') && qLower.includes('li')))) {
            let genes = window.extractMultipleGenes(query);
            if (genes.length === 0) {
                const geneMatch = query.match(/[A-Z0-9]{3,}/g);
                if (geneMatch) genes = geneMatch.map(g => g.toUpperCase()).filter(g => window.CiliAI.lookups.geneMap[g]);
            }
            if (genes.length > 0) {
                if (genes.length === 1) {
                    const definitiveDefaultGenes = ["ZC2HC1A", "CEP41", "BBS1", "BBS2", "BBS5", "ZNF474", "IFT81", "BBS7"];
                    genes = [...new Set([...definitiveDefaultGenes, ...genes])];
                }
                if (!window.liPhylogenyCache) {
                    window.addChatMessage("Loading large phylogeny datasets... this may take a moment.", false);
                    await window.ensurePhylogenyDataLoaded();
                }
                window.resetViews();
                if (window.renderLiPhylogenyHeatmap) {
                    const res = window.renderLiPhylogenyHeatmap(genes);
                    if (res && res.plotData) {
                        // Fix background color consistency
                        const fixedLayout = {
                            ...res.plotLayout,
                            paper_bgcolor: '#ffffff',
                            plot_bgcolor: '#f8fafc',
                            font: { family: 'Arial, sans-serif', size: 12, color: '#2d3748' }
                        };
                        Plotly.newPlot('cilia-svg', res.plotData, fixedLayout, {
                            displayModeBar: true,
                            responsive: true
                        });
                    }
                }
                htmlResult = `<div class="ai-result-card">
                    <p>Displaying phylogenetic conservation for <strong>${genes.length} genes</strong> in the main panel.</p>
                    <p style="font-size:12px; color:#666; margin-top:8px;">
                        <strong>Tip:</strong> Hover over the heatmap to see gene names and conservation scores across species.
                    </p>
                </div>`;
            } else {
                htmlResult = "Please specify a valid gene symbol for evolutionary analysis (e.g., 'Show evolution of BBS1').";
            }
            window.addChatMessage(htmlResult, false);
            return;
        }
        
        // Intent 6: Screen References
        else if (htmlResult === null && (qLower.includes('show screen reference') || qLower.includes('show publication detail') || qLower.includes('provide the paper'))) {
            htmlResult = window.handleScreenReferenceFollowup();
        }
        
        // Intent 7: Screens/Phenotypes
        else if (htmlResult === null && (qLower.includes('loss-of-function') || qLower.includes('lof') || qLower.includes('overexpression') || qLower.includes('oe') || qLower.includes('percent ciliated') || qLower.includes('cilia length') || (qLower.includes('effect') && qLower.includes('of')))) {
            const genes = window.extractMultipleGenes(query);
            if (genes.length > 0) htmlResult = window.handleScreenQuery(genes[genes.length - 1]);
            else htmlResult = `I see you're asking about screen effects, but I couldn't identify a gene. Please try again, like "loss-of-function effect of IFT88".`;
        }
        
        // Intent 8: What is [Gene] - FIXED for phylogeny heatmap background
        else if (htmlResult === null && (match = qLower.match(/^(?:what is|what's|describe|tell me about)\s+([A-Z0-9\-]{3,})\??$/i))) {
            const geneSymbol = match[1].toUpperCase();
            const geneData = window.CiliAI.lookups.geneMap[geneSymbol];
            
            if (!geneData) {
                htmlResult = `<div class="ai-result-card"><p>Gene <strong>${geneSymbol}</strong> not found in database.</p></div>`;
            } else {
                // Display basic gene info first
                const description = geneData['Gene.Description'] || 'Ciliary protein';
                const localization = geneData.Localization || 'Cilium';
                const ciliopathies = geneData.Ciliopathies ? 
                    (Array.isArray(geneData.Ciliopathies) ? geneData.Ciliopathies.join(', ') : geneData.Ciliopathies) : 
                    'Not specified';
                
                htmlResult = `<div class="ai-result-card">
                    <h4>${geneSymbol}</h4>
                    <p><strong>Description:</strong> ${description}</p>
                    <p><strong>Localization:</strong> ${localization}</p>
                    <p><strong>Associated Ciliopathies:</strong> ${ciliopathies}</p>
                    <div style="margin-top:15px; display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="ciliai-button" onclick="window.displayFullGeneInfo('${geneSymbol}')" style="background:#E2F0CB;">
                            📊 View Full Details
                        </button>
                        <button class="ciliai-button" onclick="window.handleAIQuery('evolution of ${geneSymbol}')" style="background:#D4EDDA;">
                            🌍 View Phylogeny
                        </button>
                        <button class="ciliai-button" onclick="window.handleAIQuery('domains for ${geneSymbol}')" style="background:#FEF3C7;">
                            🧬 View Domains
                        </button>
                    </div>
                </div>`;
            }
            window.addChatMessage(htmlResult, false);
            return;
        }
        
        // Intent 9: Orthologs
        else if (htmlResult === null && (match = qLower.match(/ortholog(?: of| for)?\s+([a-z0-9\-]+)\s+(?:in|for)\s+(c\. elegans|mouse|zebrafish|drosophila|xenopus)/i))) {
            htmlResult = window.handleOrthologQuery(match[1].toUpperCase(), match[2]);
        }
        else if (htmlResult === null && (match = qLower.match(/(c\. elegans|mouse|zebrafish|drosophila|xenopus)\s+ortholog(?: of| for)?\s+([a-z0-9\-]+)/i))) {
            htmlResult = window.handleOrthologQuery(match[2].toUpperCase(), match[1]);
        }
        
        // Intent 10: Domains (Visualizer)
        else if (htmlResult === null && (match = qLower.match(/(?:domains? (?:of|for)|domain architecture (?:of|for))\s+(.+)/i))) {
            const genes = window.extractMultipleGenes(match[1]);
            if (genes.length > 0) {
                // Ensure UI is clear before showing new viewer
                if (typeof window.resetViews === 'function') window.resetViews();
                
                // Trigger the visualizer defined in index.html
                if (typeof window.showDomainViewer === 'function') {
                    window.showDomainViewer(genes[0]);
                    htmlResult = `<div class="ai-result-card">
                        <h4>Domain Architecture: ${genes[0]}</h4>
                        <p>Displaying Pfam domains in the main panel.</p>
                        <p style="font-size:11px; color:#666;">(Hover over domains for details)</p>
                    </div>`;
                } else {
                    htmlResult = `<div class="ai-result-card"><p>Domain viewer function is missing.</p></div>`;
                }
            } else {
                htmlResult = `<div class="ai-result-card"><p>Please specify a gene to view domains (e.g., "Domains for IFT88").</p></div>`;
            }
        }
        
        // Intent 11: Modules
        else if (htmlResult === null && (match = qLower.match(/(?:functional modules of|modules for)\s+([a-z0-9\-]+)/i))) {
            const gene = match[1].toUpperCase();
            const g = window.CiliAI.lookups.geneMap[gene];
            if (g && g['Functional.category']) htmlResult = window.formatListResult(`Functional Modules for ${gene}`, window.ensureArray(g['Functional.category']).map(m => ({ gene: m, description: "Module" })));
            else htmlResult = `No functional modules listed for <strong>${gene}</strong>.`;
        }
        
        // =======================================================
        // (12) INTENT: UMAP & EXPRESSION (With Dynamic Switch Button)
        // =======================================================
        else if (
            htmlResult === null &&
            (
                qLower.includes('plot') ||
                qLower.includes('display') ||
                qLower.includes('heatmap') ||
                qLower.includes('umap') ||
                qLower.includes('scrna') ||
                qLower.includes('expression')
            )
        ) {
            // ---------------------------------------------------
            // Explicit dataset switching (standalone commands)
            // ---------------------------------------------------
            if (qLower === 'switch to kidney') {
                window.CiliAI.activeDataset = 'kidney';
                window.addChatMessage('Switched to Kidney scRNA-seq dataset.', false);
                return;
            }
            if (qLower === 'switch to lung') {
                window.CiliAI.activeDataset = 'lung';
                window.addChatMessage('Switched to Lung scRNA-seq dataset.', false);
                return;
            }
            // ---------------------------------------------------
            // Dataset inference from query
            // ---------------------------------------------------
            if (qLower.includes('kidney')) window.CiliAI.activeDataset = 'kidney';
            else if (qLower.includes('lung')) window.CiliAI.activeDataset = 'lung';
            // ---------------------------------------------------
            // Target gene / complex parsing
            // ---------------------------------------------------
            let target = 'WDR31';
            match = qLower.match(/(?:for|of|in)\s+(.+)/i);
            if (match) {
                target = match[1]
                    .replace(/lung|kidney|scrna-seq|scrna|expression|umap|plot|display|in/gi, '')
                    .trim();
                if (target.length < 2) target = 'WDR31';
            }
            let genes = window.extractMultipleGenes(target);
            let isComplex = false;
            let finalTargetTerm = target;
            if (genes.length === 0 && target) {
                const complexName = window.extractComplexIntent(target);
                if (complexName) {
                    const complexGenes = window.getGenesByComplex(complexName).map(g => g.gene);
                    if (complexGenes.length > 0) {
                        genes = complexGenes;
                        finalTargetTerm = complexName;
                        isComplex = true;
                    }
                }
            }
            const finalGenes = genes.length > 0 ? genes : ['WDR31'];
            const geneSymbol = isComplex ? finalTargetTerm : finalGenes[0];
            // ---------------------------------------------------
            // Optional zoom-to-cell-type
            // ---------------------------------------------------
            const zoomMatch = qLower.match(
                /zoom to\s+(ciliated cell|stem cell|club cell|goblet cell|neuroendocrine cell|basal cell|pulmonary alveolar type 1 cell|pulmonary alveolar type 2 cell|lung secretory cell)/i
            );
            const zoomToCellType = zoomMatch ? zoomMatch[1] : null;
            // ---------------------------------------------------
            // Render UMAP (SINGLE source of truth)
            // ---------------------------------------------------
            await window.renderUMAPPlot(geneSymbol, finalGenes, zoomToCellType);
            // ---------------------------------------------------
            // Dataset labels & switch target
            // ---------------------------------------------------
            const currentDS = window.CiliAI.activeDataset || 'lung';
            const dsName = window.CiliAI.datasets[currentDS]
                ? window.CiliAI.datasets[currentDS].name
                : 'scRNA-seq';
            const nextDS = currentDS === 'lung' ? 'kidney' : 'lung';
            const nextDSLabel = nextDS === 'lung' ? 'Lung' : 'Kidney';
            
            // Prepare safe arguments for HTML attributes
            const genesArg = finalGenes.join(',');
            const zoomArg = zoomToCellType || '';
            // ---------------------------------------------------
            // Chat output + safe switch button
            // ---------------------------------------------------
            htmlResult = `
                <div class="ai-result-card">
                    <p>
                        Displaying <strong>${dsName}</strong> scRNA-seq UMAP for
                        <strong>${geneSymbol}</strong>
                        (${isComplex ? 'Complex Avg.' : 'Single Gene'}) on the left.
                    </p>
                    ${zoomToCellType ? `<p>Zoomed to the <strong>${zoomToCellType}</strong> cluster.</p>` : ''}
                    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                        <button class="ciliai-button"
                            style="width:auto; margin:0; background:#B8E2F2;"
                            onclick="window.switchDatasetAndPlot('${nextDS}', '${geneSymbol}', '${genesArg}', '${zoomArg}')">
                            🔄 Switch to ${nextDSLabel}
                        </button>
                        <a href="#"
                           class="ai-action"
                           onclick="window.downloadUMAPDataAsCSV('${geneSymbol}')"
                           style="margin-left:5px; font-weight:600;">
                          ⬇️ CSV
                        </a>
                    </div>
                </div>
            `;
        }
        
        // Intent 13: Comparative
        else if (htmlResult === null && (qLower.includes('compare') || qLower.includes(' vs '))) {
            const matches = query.match(/([A-Z0-9]+)\s+vs\s+([A-Z0-9]+)/gi);
            if (matches) htmlResult = await window.handleComparativeDashboard(matches[0]);
            else htmlResult = await window.handleComparativeDashboard(query);
        }
        
        // Intent 14: Variants
        else if (htmlResult === null && (qLower.includes('variant') || qLower.includes('mutation'))) {
            const genes = window.extractMultipleGenes(query);
            if(genes.length > 0) htmlResult = await window.fetchVariantData(genes[0]);
        }
        
        // Intent 15: Batch Query
        else if (htmlResult === null && query.includes(',') && window.extractMultipleGenes(query).length > 1) {
            htmlResult = window.handleBatchQuery(query);
        }
        
        // Intent 16: Fold Change
        else if (htmlResult === null) {
            const foldChangeMatch = qLower.match(/compare\s+(.+)\s+in\s+(.+)\s+vs\s+(.+)/i);
            if (foldChangeMatch) {
                const result = window.calculateFoldChangeForComplex(foldChangeMatch[1].trim().toUpperCase(), foldChangeMatch[2].trim(), foldChangeMatch[3].trim());
                if (result.error) htmlResult = `<div class="ai-result-card"><h4>Differential Expression Error</h4><p>${result.error}</p></div>`;
                else htmlResult = `<div class="ai-result-card"><h4>Differential Expression: ${result.complex}</h4><p>Comparing average expression in **${result.cellTypeA}** (A) vs **${result.cellTypeB}** (B) (N=${result.count} genes).</p><p><strong>Fold Change (A/B): ${result.foldChange.toFixed(3)}</strong></p></div>`;
            }
        }
        
        // Intent 17: Phylogeny Overlap
        else if (htmlResult === null) {
            const classOverlapMatch = qLower.match(/species overlap between\s+(.+)\s+and\s+(.+)/i);
            if (classOverlapMatch && qLower.includes('li')) {
                const dataLoaded = await window.ensurePhylogenyDataLoaded();
                if (dataLoaded) {
                    const result = window.getPhylogenyClassSpeciesOverlap(classOverlapMatch[1].trim(), classOverlapMatch[2].trim(), 'li');
                    if (result.error) htmlResult = `<div class="ai-result-card"><h4>Error</h4><p>${result.error}</p></div>`;
                    else htmlResult = `<div class="ai-result-card"><h4>Overlap: ${result.classA} vs ${result.classB}</h4><p>Found **${result.sharedCount}** shared species.</p></div>`;
                }
            }
        }
        
        // Intent 18: Enrichment
        else if (htmlResult === null) {
            const enrichmentMatch = qLower.match(/enrichment for (.+)/);
            if (enrichmentMatch) {
                const geneList = window.extractMultipleGenes(enrichmentMatch[1]);
                const terms = window.getEnrichedGOTerms(geneList);
                if (terms.length > 0) htmlResult = `<div class="ai-result-card"><h4>Enrichment</h4><p>Top term: ${terms[0].term}</p></div>`;
                else htmlResult = "No enrichment found.";
            }
        }
        
        // Intent 19: Show Ciliary Cells
        else if (htmlResult === null && qLower.includes('show') && qLower.includes('ciliary cells')) {
            window.renderUMAPPlot('CLUSTER_VIEW');
            window.CiliAI.lastQueryContext = { type: 'top_500_ciliary' };
            htmlResult = `<div class="ai-result-card"><p>I've displayed the UMAP with <strong>all cell clusters</strong> highlighted.</p><p>Would you like to view the <strong>top 500 genes</strong> enriched in these ciliary cells?</p></div>`;
        }
        
        // === 20. Intent: "Where is [GENE] located?" (Visualizer) ===
        else if (htmlResult === null && qLower.startsWith('where is') && (qLower.includes('located') || qLower.includes('localised') || qLower.includes('localized'))) {
            const genes = extractMultipleGenes(query);
            
            if (genes.length === 0) {
                window.addChatMessage(`
                    <div class="ai-result-card">
                        <p>Please specify a gene symbol.</p>
                        <p><strong>Example:</strong> "Where is IFT88 located?" or "Where are BBS1 and FOXJ1 located?"</p>
                    </div>
                `, false);
                return;
            }
            
            // Force diagram visibility
            window.resetViews();
            
            let responseHtml = '<div class="ai-result-card"><h4>Gene Localization</h4>';
            
            genes.forEach((geneSymbol, index) => {
                geneSymbol = geneSymbol.toUpperCase();
                const geneData = window.CiliAI.lookups.geneMap[geneSymbol];
                
                let localization = 'Cilium (general)';
                let highlighted = false;
                
                if (geneData && geneData.Localization) {
                    localization = geneData.Localization.trim();
                    // Highlight on diagram
                    if (typeof window.highlightCiliumLocation === 'function') {
                        highlighted = window.highlightCiliumLocation(localization, geneSymbol);
                    }
                } else if (geneData) {
                    // Gene exists but no localization data
                    if (typeof window.highlightCiliumLocation === 'function') {
                        highlighted = window.highlightCiliumLocation('cilia', geneSymbol); // fallback
                    }
                } else {
                    // Gene not in database
                    responseHtml += `<p><strong>${geneSymbol}</strong>: Not found in database.</p>`;
                    return; // skip to next gene
                }
                
                const note = highlighted 
                    ? 'Highlighted on the diagram.' 
                    : 'Broad/general localization – full cilium shown.';
                
                responseHtml += `
                    <p>
                        <strong>${geneSymbol}</strong>: <span style="color:#2b6cb0;">${localization}</span><br>
                        <em>${note}</em>
                    </p>
                `;
                
                // Add separator if not last gene
                if (index < genes.length - 1) {
                    responseHtml += '<hr style="border:0; border-top:1px solid #e2e8f0; margin:10px 0;">';
                }
            });
            
            responseHtml += `
                <p style="margin-top:12px;"><strong>Interactive ciliary diagram</strong> is displayed on the left with highlighted compartments.</p>
            </div>`;
            
            window.addChatMessage(responseHtml, false);
            return;
        }
        
        // === 21. Intent: Multi-gene Overlay (Visualizer) - FIXED VERSION ===
        else if (htmlResult === null && (qLower.startsWith('multi:') || qLower.includes('multi:'))) {
            // Extract the part after "multi:" and clean it
            let geneString = query.replace(/^multi:?/i, '').trim();
            
            // Remove any leading/trailing punctuation or words
            geneString = geneString.replace(/^[:\s,]+/, '').replace(/[\.\?!]*$/, '');
            
            // Use extractMultipleGenes on the cleaned string
            let genes = extractMultipleGenes(geneString);
            
            // Fallback: if no genes found, try splitting by comma/space manually
            if (genes.length === 0 && geneString) {
                genes = geneString
                    .split(/[\s,]+/)
                    .map(g => g.trim().toUpperCase())
                    .filter(g => g.length >= 3 && /^[A-Z0-9]+$/.test(g));
            }
            
            // Validate gene existence
            genes = genes.filter(gene => window.CiliAI.lookups.geneMap[gene]);
            
            if (genes.length < 2) {
                window.addChatMessage(`
                    <div class="ai-result-card">
                        <h4>Multi-gene Overlay</h4>
                        <p>Please provide at least 2 valid gene symbols.</p>
                        <p><strong>Example:</strong> Multi: IFT88, FOXJ1</p>
                        <p>Or: Multi: BBS1, CEP290, TMEM67</p>
                        ${genes.length === 1 ? `<p>Found only 1 valid gene: <strong>${genes[0]}</strong></p>` : ''}
                    </div>
                `, false);
                return;
            }
            
            // Success: Show diagram and apply multi-overlay
            window.resetViews();
            
            // Try SpatialManager first, then fallback to manual highlighting
            let visualizationApplied = false;
            if (window.SpatialManager && typeof window.SpatialManager.applyMultiOverlay === 'function') {
                window.SpatialManager.applyMultiOverlay(genes);
                visualizationApplied = true;
            } else if (typeof window.highlightCiliumLocation === 'function') {
                // Fallback: highlight each gene individually
                genes.forEach(gene => {
                    const geneData = window.CiliAI.lookups.geneMap[gene];
                    if (geneData && geneData.Localization) {
                        window.highlightCiliumLocation(geneData.Localization, gene);
                    }
                });
                visualizationApplied = true;
            }
            
            const geneList = genes.join(', ');
            const preview = genes.length > 8 ? genes.slice(0, 8).join(', ') + '...' : geneList;
            
            // Also show batch table for the genes
            const batchResult = window.handleBatchQuery ? window.handleBatchQuery(geneList) : null;
            
            window.addChatMessage(`
                <div class="ai-result-card">
                    <h4>Multi-gene Localization Overlay</h4>
                    <p><strong>Genes:</strong> ${geneList} (${genes.length} total)</p>
                    <p><strong>Preview:</strong> ${preview}</p>
                    ${visualizationApplied 
                        ? '<p>Each gene is highlighted in a <strong>different color</strong> on the interactive ciliary diagram.</p>'
                        : '<p>Visualization could not be applied. Showing gene list instead.</p>'}
                    <div style="margin-top: 10px;">
                        <button class="ciliai-button" onclick="window.handleBatchQuery('${geneList}')" style="background: #E2F0CB;">
                            📊 Show Batch Table for ${genes.length} Genes
                        </button>
                    </div>
                </div>
            `, false);
            
            // Also trigger batch table display
            if (window.handleBatchQuery) {
                window.handleBatchQuery(geneList);
            }
            
            return;
        }
        
        // === 22. Intent: GO Term / Functional Heatmap (Visualizer) - GENERAL HANDLER ===
        else if (htmlResult === null && (qLower.startsWith('go:') || qLower.includes('go term:') || qLower.includes('functional category') || qLower.startsWith('function:'))) {
            let term = query.replace(/^(go:|go term:|function:|functional category:?)\s*/i, '').trim();
            
            if (!term) {
                window.addChatMessage(`<div class="ai-result-card"><p>Please provide a GO term or functional category (e.g., "GO: intraflagellar transport").</p></div>`, false);
                return;
            }
            
            // Hardcoded fallbacks for key ciliary terms
            const lowerTerm = term.toLowerCase();
            let genes = [];
            
            const fallbackMap = {
                'intraflagellar transport': ['IFT88', 'IFT81', 'IFT172', 'IFT140', 'IFT122', 'WDR19', 'TTC21B', 'IFT80', 'IFT57', 'TRAF3IP1', 'CLUAP1', 'IFT20', 'IFT74', 'IFT52', 'IFT46', 'KIF3A', 'KIF3B', 'KIF17', 'DYNC2H1'],
                'ift': ['IFT88', 'IFT81', 'IFT172', 'IFT140', 'IFT122', 'WDR19', 'TTC21B', 'IFT80', 'IFT57', 'TRAF3IP1', 'CLUAP1', 'IFT20', 'IFT74', 'IFT52', 'IFT46'],
                'bbsome': ['BBS1', 'BBS2', 'BBS4', 'BBS5', 'BBS7', 'TTC8', 'BBS9', 'BBIP1'],
                'transition zone': ['TMEM67', 'TMEM216', 'TMEM237', 'CEP290', 'CC2D2A', 'TCTN1', 'TCTN2', 'MKS1', 'NPHP1', 'RPGRIP1L'],
                'dynein arm': ['DNAH5', 'DNAH11', 'DNAI1', 'DNAI2', 'DNAAF1', 'DNAAF2', 'LRRC6'],
                'radial spoke': ['RSPH1', 'RSPH4A', 'RSPH9', 'DRC1'],
                'flagella': ['DNAH5', 'DNAH11', 'DNAI1', 'DNAI2', 'DNAAF1', 'LRRC6', 'RSPH1', 'RSPH4A', 'RSPH9', 'CCDC39', 'CCDC40', 'HYDIN', 'MCIDAS', 'FOXJ1']
            };
            
            for (const key in fallbackMap) {
                if (lowerTerm.includes(key)) {
                    genes = fallbackMap[key];
                    break;
                }
            }
            
            // If still no genes, try to search in the database
            if (genes.length === 0) {
                if (typeof window.getGenesByFunction === 'function') {
                    genes = window.getGenesByFunction(term);
                }
            }
            
            if (genes.length === 0) {
                window.addChatMessage(`
                    <div class="ai-result-card">
                        <h4>GO Term / Functional Category</h4>
                        <p>No genes found for <strong>"${term}"</strong>.</p>
                        <p>Try common terms like "intraflagellar transport", "bbsome", or "transition zone".</p>
                    </div>
                `, false);
                return;
            }
            
            // Apply visualization
            window.resetViews();
            
            let visualizationApplied = false;
            if (window.SpatialManager && typeof window.SpatialManager.applyMultiOverlay === 'function') {
                window.SpatialManager.applyMultiOverlay(genes);
                visualizationApplied = true;
            } else if (typeof window.highlightCiliumLocation === 'function') {
                genes.forEach(gene => {
                    const geneData = window.CiliAI.lookups.geneMap[gene];
                    if (geneData && geneData.Localization) {
                        window.highlightCiliumLocation(geneData.Localization, gene);
                    }
                });
                visualizationApplied = true;
            }
            
            const preview = genes.slice(0, 8).join(', ');
            const more = genes.length > 8 ? `... and ${genes.length - 8} more` : '';
            
            window.addChatMessage(`
                <div class="ai-result-card">
                    <h4>Functional Category / GO Term: ${term}</h4>
                    <p>Found <strong>${genes.length}</strong> genes.</p>
                    <p><strong>Examples:</strong> ${preview}${more}</p>
                    ${visualizationApplied 
                        ? '<p>A <strong>multi-colored overlay</strong> has been applied to the ciliary diagram showing protein localization.</p>'
                        : '<p>Visualization could not be applied. Showing gene list instead.</p>'}
                    <div style="margin-top: 10px;">
                        <button class="ciliai-button" onclick="window.handleBatchQuery('${genes.join(',')}')" style="background: #D4EDDA;">
                            📊 Show Batch Table for ${genes.length} Genes
                        </button>
                    </div>
                </div>
            `, false);
            
            // Also trigger batch table display
            if (window.handleBatchQuery) {
                window.handleBatchQuery(genes.join(','));
            }
            
            return;
        }
        
        // Fallback intent
        if (htmlResult === null) {
            const intent = window.flexibleIntentParser ? window.flexibleIntentParser(query) : null;
            if (intent && intent.handler) {
                htmlResult = intent.handler(intent.entity, query);
            }
            
            if (htmlResult === null) {
                let term = qLower;
                const match = qLower.match(/(?:what is|describe|localization of|where is)\s+(?:the\s+)?(.+)/i);
                if (match) term = match[1];
                
                term = term.replace(/[?.]/g, '').trim().toUpperCase();
                const genes = window.extractMultipleGenes ? window.extractMultipleGenes(term) : [];
                
                if (genes.length > 0) {
                    htmlResult = await window.displayFullGeneInfo(genes[0]);
                } else {
                    htmlResult = `Sorry, I didn't understand: "<strong>${query}</strong>". Try asking about a gene, localization, or GO term.`;
                }
            }
        }
        
        if (htmlResult) window.addChatMessage(htmlResult, false);
    } catch (e) {
        console.error("Error in handleAIQuery:", e);
        window.addChatMessage(`An internal error occurred: ${e.message}`, false);
    }
};


// Export query handlers to global scope
window.handleScreenQuery = handleScreenQuery;
window.handleOrthologQuery = handleOrthologQuery;
window.handleScRnaQuery = handleScRnaQuery;
window.handleLocalizationQuery = handleLocalizationQuery;
window.handleSimpleComplexQuery = handleSimpleComplexQuery;
window.handleGeneInComplexQuery = handleGeneInComplexQuery;
window.handleClassificationQuery = handleClassificationQuery;
window.tellAboutCiliAI = tellAboutCiliAI;
window.formatListResult = formatListResult;
window.sendFeedbackEmail = sendFeedbackEmail;
