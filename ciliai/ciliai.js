/**
 * ============================================================================
 * CiliAI.js - Standalone Module (FINAL INTEGRATED VERSION)
 * ============================================================================
 *
 * This file contains all logic for the CiliAI chatbot.
 * - Manages its own sandboxed cache (`ciliAI_geneCache`).
 * - Fetches all data sources in parallel (`ciliAI_getGeneData`).
 * - Resolves intents with a dual-stage system (`ciliAI_resolveIntent`).
 * - Attaches its own listeners robustly (`ciliAI_waitForElements`).
 *
 * This file REPLACES all old global functions like fetchCiliaData,
 * runAnalysis, getGenesByComplex, etc.
 *
 * Version: 6.0 (Cleaned and Sandboxed)
 */

// ============================================================================
// 1. 🌎 CiliAI GLOBAL CACHE
// ============================================================================

/**
 * @type {Map<string, Promise<object>>}
 * CiliAI's private cache for all gene-related data.
 */
const ciliAI_geneCache = new Map();


// ============================================================================
// 2. 🧲 CiliAI "GATEKEEPER" CACHING FUNCTION (FINAL)
// ============================================================================
/**
 * Ensures all data for a specific gene is fetched and cached *within CiliAI*.
 * This is the primary "gatekeeper" function for all *single-gene* data.
 *
 * @param {string} geneName - The human gene name (e.g., "IFT88"). Case-insensitive.
 * @returns {Promise<object>} A promise that resolves to an object 
 * containing all data for that gene (or a "notFound" state).
 */
async function ciliAI_getGeneData(geneName) {
    const upperGeneName = geneName.toUpperCase(); // Standardize key

    // 1. [CACHE HIT]
    if (ciliAI_geneCache.has(upperGeneName)) {
        return ciliAI_geneCache.get(upperGeneName);
    }

    // 2. [CACHE MISS]
    const dataPromise = (async () => {
        console.log(`[CiliAI Cache MISS] Fetching all data for ${upperGeneName}...`);

        const results = await Promise.allSettled([
            ciliAI_fetchCiliaHubData_internal(upperGeneName),     // Main JSON file (contains geneInfo, effects)
            ciliAI_fetchPhylogenyData_internal(upperGeneName),   // Combined (Nevers + Li)
            ciliAI_fetchDomainData_internal(upperGeneName),       // Domain data
            ciliAI_fetchComplexData_internal(upperGeneName),      // Protein complex data (from CORUM)
            ciliAI_fetchTissueData_internal(upperGeneName),       // Tissue consensus TSV
            ciliAI_fetchScRnaData_internal(upperGeneName),        // scRNA-seq data
            ciliAI_fetchScreenData_internal(upperGeneName)        // Separate screen data
        ]);

        // 3. Collate the results
        const ciliaHubResult = results[0].status === 'fulfilled' ? results[0].value : null;

        const combinedData = {
            // Spread the CiliaHub data (geneInfo, expression, etc.)
            ...(ciliaHubResult || { geneInfo: null, expression: null }), 
            
            // Assign results from other fetches
            phylogeny:   results[1].status === 'fulfilled' ? results[1].value : null,
            domains:     results[2].status === 'fulfilled' ? results[2].value : null,
            complex:     results[3].status === 'fulfilled' ? results[3].value : null,
            tissue:      results[4].status === 'fulfilled' ? results[4].value : null, 
            scRNA:       results[5].status === 'fulfilled' ? results[5].value : null,
            screens:     results[6].status === 'fulfilled' ? results[6].value : null,
            lastFetched: new Date().toISOString()
        };

        // 4. Check if we got any data at all
        if (!combinedData.geneInfo) {
            console.warn(`[CiliAI] No data found for ${upperGeneName} in any key source.`);
            const notFoundData = { notFound: true, ...combinedData };
            ciliAI_geneCache.set(upperGeneName, Promise.resolve(notFoundData)); 
            return notFoundData;
        }

        // 5. Return the combined data
        return combinedData;

    })().catch(err => {
        console.error(`[CiliAI] Catastrophic failure fetching data for ${upperGeneName}:`, err);
        ciliAI_geneCache.delete(upperGeneName);
        return { notFound: true, error: err.message };
    });

    // 6. Store the promise *itself* in the cache
    ciliAI_geneCache.set(upperGeneName, dataPromise);

    // 7. [OPTIMIZATION] Replace promise with resolved data once complete
    dataPromise.then(data => {
        ciliAI_geneCache.set(upperGeneName, Promise.resolve(data));
    }).catch(() => { /* Handled in the .catch() block above */ });

    return dataPromise;
}


// ============================================================================
// 3. 🛠️ CiliAI "INTERNAL" HELPER FETCH FUNCTIONS (FINAL)
// ============================================================================

/**
 * [INTERNAL] Fetches main data from ciliahub_data.json.
 * This file is an ARRAY of gene objects.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchCiliaHubData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/ciliahub_data.json';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allData = await response.json(); // This is an ARRAY

        // Find the gene in the array
        const geneInfo = allData.find(entry => entry.gene && entry.gene.toUpperCase() === geneName);
        
        if (geneInfo) {
            // This file contains geneInfo, expression (in screens), and length effects
            // We return the *whole object* for that gene
            // 'expression' key is used for the 'screens' array in this file
            return { 
                geneInfo: geneInfo,
                expression: geneInfo.screens || null 
            };
        }
        return null;
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch CiliaHub data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches and combines phylogeny data from Nevers and Li.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchPhylogenyData_internal(geneName) {
    const neversURL = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/nevers_et_al_2017_matrix_optimized.json';
    const liURL = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/li_et_al_2014_matrix_optimized.json';

    try {
        const [neversResult, liResult] = await Promise.allSettled([
            fetch(neversURL).then(res => res.json()),
            fetch(liURL).then(res => res.json())
        ]);

        let combinedPhylogeny = { nevers: null, li: null };

        // Data is an OBJECT { "GENE": {...} }
        if (neversResult.status === 'fulfilled') {
            if (neversResult.value && neversResult.value[geneName]) {
                combinedPhylogeny.nevers = neversResult.value[geneName];
            }
        } else {
            console.warn(`[CiliAI] Could not load Nevers phylogeny for ${geneName}:`, neversResult.reason);
        }

        // Data is an OBJECT { "GENE": {...} }
        if (liResult.status === 'fulfilled') {
             if (liResult.value && liResult.value[geneName]) {
                combinedPhylogeny.li = liResult.value[geneName];
            }
        } else {
            console.warn(`[CiliAI] Could not load Li phylogeny for ${geneName}:`, liResult.reason);
        }

        return (combinedPhylogeny.nevers || combinedPhylogeny.li) ? combinedPhylogeny : null;

    } catch (err) {
        console.error(`[CiliAI] Failed to fetch phylogeny for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches domain data for a specific gene.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchDomainData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/protein_domains.json'; 
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allDomainData = await response.json();
        
        // Assuming allDomainData is an object keyed by gene name
        const geneDomainData = allDomainData[geneName] || null;

        return geneDomainData; 
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch domain data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches protein complex data from CORUM.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchComplexData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/corum_humanComplexes.json';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allComplexData = await response.json(); // This is an ARRAY

        // Find the first complex that includes this gene
        const foundComplex = allComplexData.find(complex => 
            complex.subunits && Array.isArray(complex.subunits) &&
            complex.subunits.some(subunit => subunit.gene_name && subunit.gene_name.toUpperCase() === geneName)
        );
        
        if (foundComplex) {
             // Return a simplified object
             return {
                name: foundComplex.complex_name,
                members: foundComplex.subunits.map(s => s.gene_name)
             };
        }
        return null;
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch complex data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches tissue expression data from the rna_tissue_consensus.tsv file.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>} An object with tissue expression data or null.
 */
async function ciliAI_fetchTissueData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/rna_tissue_consensus.tsv';
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const tsvData = await response.text();
        const lines = tsvData.split('\n');
        
        if (lines.length < 2) throw new Error("TSV file is empty or has no header.");

        const headers = lines[0].split('\t');
        const geneNameIndex = headers.findIndex(h => h.toLowerCase() === 'gene name' || h.toLowerCase() === 'gene');
        
        if (geneNameIndex === -1) throw new Error("Could not find 'Gene name' column in TSV header.");

        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split('\t');
            const currentGene = columns[geneNameIndex];
            
            if (currentGene && currentGene.toUpperCase() === geneName) {
                const tissueData = {};
                headers.forEach((header, index) => {
                    if (index !== geneNameIndex) {
                        tissueData[header] = columns[index];
                    }
                });
                return tissueData; // Success!
            }
        }
        return null; // Gene not found
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch tissue data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches scRNA-seq data from cellxgene_data.json.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>} An object with scRNA-seq data or null.
 */
async function ciliAI_fetchScRnaData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cellxgene_data.json';
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allScRnaData = await response.json();
        
        // Data is an object { "GENE": {...} }
        const geneKey = Object.keys(allScRnaData).find(key => key.toUpperCase() === geneName);
        
        if (geneKey) {
            return allScRnaData[geneKey];
        }
        return null; // Gene not found
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch scRNA-seq data for ${geneName}:`, err);
        return null;
    }
}

/**
 * [INTERNAL] Fetches screen data.
 * @param {string} geneName - The human gene name (UPPERCASE)
 * @returns {Promise<object | null>}
 */
async function ciliAI_fetchScreenData_internal(geneName) {
    const url = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/refs/heads/main/cilia_screens_data.json';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allScreenData = await response.json(); // Data is { "GENE": [...] }

        const geneKey = Object.keys(allScreenData).find(key => key.toUpperCase() === geneName);
        
        if (geneKey) {
            return allScreenData[geneKey]; // Return the array of screen results
        }
        return null;
    } catch (err) {
        console.error(`[CiliAI] Failed to fetch screen data for ${geneName}:`, err);
        return null;
    }
}


// ============================================================================
// 4. 🧠 CiliAI DUAL-STAGE INTENT RESOLVER (FINAL)
// ============================================================================

/**
 * Parses the user's query and calls the appropriate handler function.
 * This is the main entry point for all user input *to CiliAI*.
 *
 * @param {string} query - The raw user input.
 */
async function ciliAI_resolveIntent(query) {
    console.log("[CiliAI LOG] 4. ciliAI_resolveIntent started.");
    const qLower = query.toLowerCase().trim();
    
    ciliAI_updateChatWindow("Thinking...", "system");

    try {
        // --- STAGE 1: Check for complex, list-based, or non-gene queries ---
        console.log("[CiliAI LOG] 5. Trying Stage 1 (Complex Intent)...");
        const complexResult = await ciliAI_resolveComplexIntent(qLower, query); 
        
        if (complexResult !== null) {
            console.log("[CiliAI LOG] 5a. Stage 1 Matched. Result:", complexResult);
            if (typeof complexResult === 'string') {
                ciliAI_updateChatWindow(complexResult, "ciliai");
            }
            return; // Intent was handled. Stop here.
        }

        console.log("[CiliAI LOG] 5b. Stage 1 Failed. Proceeding to Stage 2 (Single Gene)...");
        
        // --- STAGE 2: Fallback to single-gene query resolution ---
        
        // This RegEx looks for all-caps words (3+ chars) OR
        // words with letters and numbers (like IFT88).
        // It explicitly IGNORES common English words.
        const geneRegex = /\b(?!show\b|me\b|what\b|is\b|tell\b|about\b|for\b|genes\b)([A-Z]{3,}|[A-Z0-9-]{3,})\b/i;
        const geneMatch = query.match(geneRegex); // Match against the *original* query to preserve case
        const geneName = geneMatch ? geneMatch[1].toUpperCase() : null;

        console.log(`[CiliAI LOG] 6. Gene parsed: ${geneName}`);

        let intent = null;
        let params = { gene: geneName };

        // --- Intent Matching (for single-gene queries) ---
        if (qLower.includes("phylogeny") || qLower.includes("evolution") || qLower.includes("ortholog")) {
            intent = "getPhylogeny";
        } else if (qLower.includes("domain") || qLower.includes("structure")) {
            intent = "getDomains";
        } else if (qLower.includes("length") || qLower.includes("long") || qLower.includes("short")) {
            intent = "getCiliaLength";
        } else if (qLower.includes("complex") || qLower.includes("interact")) {
            intent = "getComplex";
        } else if (qLower.includes("expression") || qLower.includes("tissue") || qLower.includes("scrna")) {
            intent = "getExpression"; // New consolidated intent
        } else if (qLower.includes("summary") || qLower.includes("what is") || qLower.includes("tell me about")) {
            intent = "getSummary"; 
        } else if (geneName) {
            intent = "getSummary"; // Default action
        } else if (qLower.includes("hello") || qLower.includes("hi")) {
            intent = "greet";
        } else {
            intent = "unknown";
        }

        console.log(`[CiliAI LOG] 7. Intent parsed: ${intent}`);

        // --- Action Dispatch (for single-gene queries) ---
        if (intent !== "greet" && intent !== "unknown" && !params.gene) {
            console.warn("[CiliAI LOG] 7a. Intent needs gene, but none found.");
            ciliAI_updateChatWindow("Please specify a gene name for that request.", "ciliai");
            return;
        }

        switch (intent) {
            case "getSummary":
                await ciliAI_handleGeneSummary(params.gene);
                break;
            case "getPhylogeny":
                await ciliAI_handlePhylogeny(params.gene);
                break;
            case "getDomains":
                await ciliAI_handleDomains(params.gene);
                break;
            case "getCiliaLength":
                await ciliAI_handleCiliaLength(params.gene);
                break;
            case "getComplex":
                await ciliAI_handleComplex(params.gene);
                break;
            case "getExpression": // Handles both tissue and scRNA
                await ciliAI_handleExpression(params.gene);
                break;
            case "greet":
                ciliAI_updateChatWindow("Hello! I am CiliAI. How can I help you learn about ciliary genes?", "ciliai");
                break;
            default: // unknown
                console.warn("[CiliAI LOG] 7b. Unknown intent.");
                ciliAI_updateChatWindow("I'm sorry, I didn't understand that. Please ask about a specific gene (e.g., 'What is IFT88?') or a complex topic (e.g., 'List genes for Joubert Syndrome').", "ciliai");
        }
    
    } catch (err) {
        console.error("[CiliAI] Error handling intent: ", err);
        ciliAI_updateChatWindow(`An unexpected error occurred: ${err.message}`, "error");
    }
}

/**
 * STAGE 1 HANDLER: Resolves complex, list-based, and non-gene queries.
 * @param {string} qLower - The lowercased query.
 * @param {string} query - The original query (for case-sensitive parts).
 * @returns {Promise<string | null>} An HTML string for display, or null if no intent is matched.
 */
async function ciliAI_resolveComplexIntent(qLower, query) {
    // --- Define semantic clusters for major biological contexts ---
    const intentClusters = {
        ciliary_tip: ["ciliary tip", "distal tip", "tip proteins", "tip components", "tip composition", "proteins at the ciliary tip", "ciliary tip complex", "enriched at the tip", "distal region", "ciliary tip proteome"],
        domain: ["domain", "motif", "architecture", "protein fold", "domain organization", "enriched", "depleted"],
        phylogeny: ["phylogeny", "evolution", "conservation", "ortholog", "paralog", "species tree", "evolutionary profile", "conservation heatmap", "conserved"],
        complex: ["complex", "interactome", "binding partners", "corum", "protein interaction", "ift", "bbsome", "dynein", "mks", "nphp", "radial spoke", "axoneme", "transition zone"],
        expression: ["expression", "umap", "tissue", "cell type", "where expressed", "scRNA", "single-cell", "transcript", "abundance", "expression pattern", "plot"],
        disease: ["mutation", "variant", "pathogenic", "ciliopathy", "disease", "syndrome", "bbs", "joubert", "mks", "pcd", "lca", "nephronophthisis", "polycystic kidney disease"],
        disease_classification: ["primary ciliopathy", "secondary ciliopathy", "motile ciliopathy", "atypical ciliopathy", "primary disease", "secondary disease", "motile disease", "atypical disease", "ciliopathy classification"],
        localization: ["localize", "location", "subcellular", "basal body", "transition zone", "centrosome", "axoneme", "ciliary membrane"],
        phenotype: ["knockdown", "phenotype", "effect", "shorter cilia", "longer cilia", "cilia length", "cilia number", "decreased ciliation", "loss of cilia"]
    };

    // --- Terms for Priority Checks ---
    const localizationTerms = [
        "basal body", "transition zone", "cilia", "axoneme", "centrosome",  
        "ciliary membrane", "nucleus", "lysosome", "mitochondria", "ciliary tip"
    ];
    const phenotypeTerms = [
        "short cilia", "longer cilia", "cilia length", "cilia defects",  
        "decreased ciliation", "loss of cilia", "reduced cilia", "increase", "decrease", "no effect"
    ];
    const diseaseNames = ["bardet-biedl syndrome", "joubert syndrome", "meckel-gruber syndrome", "primary ciliary dyskinesia", "leber congenital amaurosis", "nephronophthisis", "polycystic kidney disease", "autosomal dominant polycystic kidney disease", "autosomal recessive polycystic kidney disease", "short-rib thoracic dysplasia", "senior-løken syndrome", "cranioectodermal dysplasia", "nphp", "bbs", "mks", "pcd", "ciliopathy", "syndrome"];
    const strictPhenotypeTerms = ["phenotype", "short cilia", "long cilia", "cilia length", "cilia number", "decreased ciliation", "loss of cilia", "reduced cilia", "increase", "decrease"];

    // --- Check for gene name ---
    const geneRegex = /\b(?!show\b|me\b|what\b|is\b|tell\b|about\b|for\b|genes\b)([A-Z]{3,}|[A-Z0-9-]{3,})\b/i;
    const hasGene = geneRegex.test(qLower);

    // --- Priority Rule 1: Combined "disease" + "phenotype" ---
    const matchedDisease = diseaseNames.find(name => qLower.includes(name));
    const matchedStrictPhenotype = strictPhenotypeTerms.find(term => qLower.includes(term));

    if (matchedDisease && matchedStrictPhenotype) {
        const standardDisease =
            matchedDisease.toUpperCase() === "BBS" ? "Bardet–Biedl Syndrome" :
            matchedDisease.toUpperCase() === "MKS" ? "Meckel–Gruber Syndrome" :
            matchedDisease.toUpperCase() === "PCD" ? "Primary Ciliary Dyskinesia" :
            matchedDisease.toUpperCase() === "NPHP" ? "Nephronophthisis" :
            matchedDisease;
        console.log(`[CiliAI Complex] getDiseaseGenesByPhenotype("${standardDisease}", "${matchedStrictPhenotype}")`);
        return `<p>Functionality for 'getDiseaseGenesByPhenotype' (Disease: ${standardDisease}, Phenotype: ${matchedStrictPhenotype}) is not yet implemented.</p>`; // Placeholder
    }

    // --- Priority Rule 2: Combined "localization" + "phenotype" ---
    const matchedLocalization = localizationTerms.find(name => qLower.includes(name));
    const matchedPhenotype = phenotypeTerms.find(term => qLower.includes(term));

    if (matchedLocalization && matchedPhenotype) {
        console.log(`[CiliAI Complex] getLocalizationPhenotypeGenes("${matchedLocalization}", "${matchedPhenotype}")`);
        return `<p>Functionality for 'getLocalizationPhenotypeGenes' (Location: ${matchedLocalization}, Phenotype: ${matchedPhenotype}) is not yet implemented.</p>`; // Placeholder
    }
    
    // --- Rule-based fuzzy detection (Fallback) ---
    let detectedIntent = null;
    for (const [intent, phrases] of Object.entries(intentClusters)) {
        if (phrases.some(p => qLower.includes(p))) {
            detectedIntent = intent;
            break;
        }
    }

    // --- If an intent is detected BUT a gene is also present, FALL BACK ---
    if (hasGene && detectedIntent && 
        ["phylogeny", "domain", "complex", "expression", "localization", "phenotype"].includes(detectedIntent)) {
        return null; // Let Stage 2 (single-gene handler) take it
    }

    // --- Intent Resolution Logic (No gene present) ---

    if (detectedIntent === "ciliary_tip") {
        console.log("[CiliAI Complex] getCuratedComplexComponents('CILIARY TIP')");
        return `<p>Functionality for 'getCuratedComplexComponents' (CILIARY TIP) is not yet implemented.</p>`; // Placeholder
    }

    // --- Disease Classification Handler ---
    else if (detectedIntent === "disease_classification") {
        let classification = null;
        if (qLower.includes('primary ciliopathy') || qLower.includes('primary disease')) {
            classification = "Primary Ciliopathies";
        } else if (qLower.includes('motile ciliopathy') || qLower.includes('motile disease')) {
            classification = "Motile Ciliopathies";
        } else if (qLower.includes('secondary ciliopathy') || qLower.includes('secondary disease')) {
            classification = "Secondary Diseases";
        } else if (qLower.includes('atypical ciliopathy') || qLower.includes('atypical disease')) {
            classification = "Atypical Ciliopathies";
        }

        if (classification) {
            console.log(`[CiliAI Complex] getGenesByCiliopathyClassification("${classification}")`);
            return `<p>Functionality for 'getGenesByCiliopathyClassification' (${classification}) is not yet implemented.</p>`; // Placeholder
        }
    }

    // --- Specific Disease Handler (Generic List) ---
    else if (detectedIntent === "disease") {
        const diseaseList = ["bardet-biedl syndrome", "joubert syndrome", "meckel-gruber syndrome", "primary ciliary dyskinesia", "leber congenital amaurosis", "nephronophthisis", "polycystic kidney disease", "autosomal dominant polycystic kidney disease", "autosomal recessive polycystic kidney disease", "short-rib thoracic dysplasia", "senior-løken syndrome", "cranioectodermal dysplasia", "nphp", "bbs", "mks", "pcd", "ciliopathy", "syndrome"];

        let targetDisease = null;
        for (const name of diseaseList.sort((a, b) => b.length - a.length)) {
            if (qLower.includes(name)) {
                targetDisease = name;
                break;
            }
        }

        if (targetDisease) {
            const standardName =
                targetDisease.toUpperCase() === "BBS" ? "Bardet–Biedl Syndrome" :
                targetDisease.toUpperCase() === "MKS" ? "Meckel–Gruber Syndrome" :
                targetDisease.toUpperCase() === "PCD" ? "Primary Ciliary Dyskinesia" :
                targetDisease.toUpperCase() === "NPHP" ? "Nephronophthisis" :
                targetDisease;
            console.log(`[CiliAI Complex] getCiliopathyGenes("${standardName}")`);
            return `<p>Functionality for 'getCiliopathyGenes' (${standardName}) is not yet implemented.</p>`; // Placeholder
        }

        return `<p>🩺 Disease query detected, but no specific disease or classification was identified for listing genes. Please try a query like "List genes for Joubert Syndrome".</p>`;
    }

    // --- Domain Handler (No Gene) ---
    else if (detectedIntent === "domain") {
        console.log(`[CiliAI Complex] resolveDomainQuery("${query}")`);
        return `<p>Functionality for 'resolveDomainQuery' (without a gene) is not yet implemented.</p>`; // Placeholder
    }

    // --- Phylogeny Handler (No Gene) ---
    else if (detectedIntent === "phylogeny") {
        console.log(`[CiliAI Complex] resolvePhylogeneticQuery("${query}")`);
        return `<p>Functionality for 'resolvePhylogeneticQuery' (without a gene) is not yet implemented.</p>`; // Placeholder
    }

    // --- Complex Handler (No Gene) ---
    else if (detectedIntent === "complex") {
        console.log(`[CiliAI Complex] routeComplexPhylogenyAnalysis("${query}")`);
        return `<p>Functionality for 'routeComplexPhylogenyAnalysis' (without a gene) is not yet implemented.</p>`; // Placeholder
    }

    // --- Expression Handler (No Gene) ---
    else if (detectedIntent === "expression") {
        return `<p>🧬 Please specify a gene to show expression data.</p>`;
    }

    // --- Localization Handler (Generic List) ---
    else if (detectedIntent === "localization") {
        const locationMatch = qLower.match(/(basal body|transition zone|axoneme|centrosome|ciliary membrane)/);
        if (locationMatch && locationMatch[1]) {
            console.log(`[CiliAI Complex] getGenesByLocalization("${locationMatch[1]}")`);
            return `<p>Functionality for 'getGenesByLocalization' (${locationMatch[1]}) is not yet implemented.</p>`; // Placeholder
        } else {
            return `<p>📍 Localization query detected. Please be more specific (e.g., "genes in the basal body").</p>`;
        }
    }
    // --- Phenotype Handler (Generic List) ---
    else if (detectedIntent === "phenotype") {
        return `<p>🔎 Phenotype/Screen query detected. Please use a specific gene (e.g., "What happens to cilia when KIF3A is knocked down?") or a specific phenotype (e.g., "Find genes causing short cilia").</p>`;
    }

    // --- Default fallback ---
    return null;
}


// ============================================================================
// 5. 💬 CiliAI "CONSUMER" HANDLER FUNCTIONS (FINAL)
// ============================================================================
// These functions are called by ciliAI_resolveIntent (Stage 2).
// They all use the SAME `ciliAI_getGeneData` function.

/**
 * Handles the "getSummary" intent. Provides a full overview.
 * @param {string} geneName 
 */
async function ciliAI_handleGeneSummary(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find any data for the gene "${geneName}".`, "error");
        return;
    }

    const geneSymbol = geneData.geneInfo?.gene || geneName.toUpperCase();
    let responses = [];
    responses.push(`Here's a summary for **${geneSymbol}**:`);

    if (geneData.geneInfo?.functional_summary) {
        responses.push(`**Summary:** ${geneData.geneInfo.functional_summary}`);
    } else {
        responses.push(`**Summary:** No summary is available for this gene.`);
    }

    let details = [];
    if (geneData.geneInfo?.lof_effects && geneData.geneInfo.lof_effects !== "Not Reported") {
        details.push(`**Cilia Effect (Loss-of-function):** ${geneData.geneInfo.lof_effects}.`);
    }
    if (geneData.geneInfo?.overexpression_effects && geneData.geneInfo.overexpression_effects !== "Not Reported") {
        details.push(`**Cilia Effect (Overexpression):** ${geneData.geneInfo.overexpression_effects}.`);
    }
    if (geneData.complex) details.push(`It is part of the **${geneData.complex.name}** protein complex.`);
    if (geneData.domains) details.push(`It has known protein domains.`);
    if (geneData.phylogeny) details.push(`Phylogenetic data is available.`);
    if (geneData.tissue) details.push(`Tissue expression data is available.`);
    if (geneData.scRNA) details.push(`Single-cell expression data is available.`);
    
    if (details.length > 0) {
        responses.push("\n**Key Details:**\n* " + details.join('\n* '));
    }

    ciliAI_updateChatWindow(responses.join('\n\n'), "ciliai");
}

/**
 * Handles the "getPhylogeny" intent.
 * @param {string} geneName 
 */
async function ciliAI_handlePhylogeny(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    if (!geneData.phylogeny) {
        ciliAI_updateChatWindow(`No phylogeny data was found for **${geneName}**.`, "ciliai");
        return;
    }

    let responses = [];
    if (geneData.phylogeny.nevers) {
        responses.push(`**Nevers et al. (2017) data found.**`);
        // if (window.plotNeversPhylogeny) window.plotNeversPhylogeny(geneData.phylogeny.nevers);
        console.log("[CiliAI PLOTTER] Plotting Nevers data for", geneName);
    }
    if (geneData.phylogeny.li) {
        responses.push(`**Li et al. (2016) data found.**`);
        // if (window.plotLiPhylogeny) window.plotLiPhylogeny(geneData.phylogeny.li);
        console.log("[CiliAI PLOTTER] Plotting Li data for", geneName);
    }

    ciliAI_updateChatWindow(responses.join('\n'), "ciliai");
}

/**
 * Handles the "getDomains" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleDomains(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    // Assumes geneData.domains is an array of objects: [{name: "PF0001", ...}, ...]
    if (!geneData.domains || geneData.domains.length === 0) {
        ciliAI_updateChatWindow(`No protein domain information was found for **${geneName}**.`, "ciliai");
        return;
    }

    const domainNames = geneData.domains.map(d => d.name).join(', ');
    ciliAI_updateChatWindow(`**${geneName}** contains the following domains: **${domainNames}**.`, "ciliai");
    
    // Example: Trigger a domain plotting function
    // if (window.plotDomains) window.plotDomains(geneData.domains);
}

/**
 * Handles the "getCiliaLength" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleCiliaLength(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    // *** CORRECTION ***
    // This data now lives inside the geneInfo object, fetched from ciliahub_data.json
    if (!geneData.geneInfo) {
        ciliAI_updateChatWindow(`No cilia length data was found for **${geneName}**.`, "ciliai");
        return;
    }
    
    const lof = geneData.geneInfo.lof_effects || "Not Reported";
    const oe = geneData.geneInfo.overexpression_effects || "Not Reported";
    const perc = geneData.geneInfo.percent_ciliated_cells_effects || "Not Reported";

    let responses = [];
    responses.push(`Cilia phenotype effects for **${geneName}**:`);
    responses.push(`* **Loss-of-function:** ${lof}`);
    responses.push(`* **Overexpression:** ${oe}`);
    responses.push(`* **% Ciliated Cells:** ${perc}`);

    ciliAI_updateChatWindow(responses.join('\n'), "ciliai");
}

/**
 * Handles the "getComplex" intent.
 * @param {string} geneName 
 */
async function ciliAI_handleComplex(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    if (!geneData.complex) {
        ciliAI_updateChatWindow(`**${geneName}** is not listed as part of a known CORUM complex in our data.`, "ciliai");
        return;
    }

    const complexName = geneData.complex.name;
    const memberCount = geneData.complex.members.length;
    ciliAI_updateChatWindow(`**${geneName}** is a member of the **${complexName}** complex, which has ${memberCount} members.`, "ciliai");
}

/**
 * *** NEWLY ADDED ***
 * Handles the "getExpression" intent (for tissue and scRNA).
 * @param {string} geneName 
 */
async function ciliAI_handleExpression(geneName) {
    const geneData = await ciliAI_getGeneData(geneName);
    if (geneData.notFound) {
        ciliAI_updateChatWindow(`Sorry, I could not find data for "${geneName}".`, "error");
        return;
    }

    let responses = [];
    responses.push(`Expression data for **${geneName}**:`);
    
    // 1. Check for Tissue Data
    if (geneData.tissue) {
        responses.push(`\n**Tissue Consensus Data:**`);
        // Find top 3 tissues
        const tissues = Object.entries(geneData.tissue)
            .map(([tissue, nTPM]) => ({ tissue, nTPM: parseFloat(nTPM) }))
            .filter(t => !isNaN(t.nTPM))
            .sort((a, b) => b.nTPM - a.nTPM);
            
        if (tissues.length > 0) {
            responses.push(`* Highest expression in: **${tissues[0].tissue}** (${tissues[0].nTPM} nTPM)`);
            if (tissues.length > 1) responses.push(`* Second highest: **${tissues[1].tissue}** (${tissues[1].nTPM} nTPM)`);
            if (tissues.length > 2) responses.push(`* Third highest: **${tissues[2].tissue}** (${tissues[2].nTPM} nTPM)`);
        } else {
            responses.push(`* No tissue consensus data found.`);
        }
    } else {
        responses.push(`\n* No tissue consensus data found.`);
    }
    
    // 2. Check for scRNA-seq Data
    if (geneData.scRNA) {
        responses.push(`\n**Single-Cell (scRNA-seq) Data:**`);
        // Find top 3 cell types
         const cells = Object.entries(geneData.scRNA)
            .map(([cell, pct]) => ({ cell, pct: parseFloat(pct) }))
            .filter(c => !isNaN(c.pct))
            .sort((a, b) => b.pct - a.pct);
            
        if (cells.length > 0) {
            responses.push(`* Highest expression in: **${cells[0].cell}** (${cells[0].pct.toFixed(2)}% of cells)`);
            if (cells.length > 1) responses.push(`* Second highest: **${cells[1].cell}** (${cells[1].pct.toFixed(2)}% of cells)`);
            if (cells.length > 2) responses.push(`* Third highest: **${cells[2].cell}** (${cells[2].pct.toFixed(2)}% of cells)`);
        } else {
            responses.push(`* No scRNA-seq data found.`);
        }
    } else {
        responses.push(`\n* No scRNA-seq data found.`);
    }

    ciliAI_updateChatWindow(responses.join('\n'), "ciliai");
}


// ============================================================================
// 6. 🔌 CiliAI EVENT HANDLERS
// ============================================================================
// This section connects CiliAI to the HTML DOM.

/**
 * Handles the query from the user input.
 * This function is attached to the "Send" button and "Enter" key.
 */
async function ciliAI_handleQuery() {
    console.log("[CiliAI LOG] 1. ciliAI_handleQuery fired.");
    
    // *** This ID must match your HTML ***
    const inputElement = document.getElementById('aiQueryInput'); 
    
    if (!inputElement) {
        console.error("[CiliAI LOG] 1a. CRITICAL: Cannot find input element '#aiQueryInput'.");
        return;
    }

    const query = inputElement.value;
    if (!query.trim()) {
        console.warn("[CiliAI LOG] 1b. Query is empty. Aborting.");
        return;
    }
    
    console.log(`[CiliAI LOG] 2. Query is: "${query}"`);
    
    // Add user's message to chat UI
    ciliAI_updateChatWindow(query, 'user');
    
    try {
        console.log("[CiliAI LOG] 3. Calling ciliAI_resolveIntent...");
        await ciliAI_resolveIntent(query); 
        console.log("[CiliAI LOG] 8. ciliAI_resolveIntent finished.");
    } catch (err) {
        console.error("[CiliAI] Query Error:", err);
        ciliAI_updateChatWindow("An error occurred: " + err.message, "error");
    }
    
    // Clear the input box *after* the query is processed
    inputElement.value = '';
}

/**
 * Updates the CiliAI chat UI.
 * @param {string} message - The message HTML or text to display.
 * @param {string} sender - The class name (e.g., "user", "ciliai", "error").
 */
function ciliAI_updateChatWindow(message, sender) {
    // *** This ID must match your HTML ***
    const chatBox = document.getElementById('ai-result-area');
    
    if (message === "Thinking...") {
        if (chatBox) {
            chatBox.style.display = 'block'; // Make sure it's visible
            chatBox.innerHTML = `<p class="status-searching">CiliAI is thinking... 🧠</p>`;
        }
        return; 
    }
    
    if (!chatBox) {
        // Fallback to console
        const formattedMessage = message.replace(/<[^>]*>?/gm, '');
        console.log(`[CiliAI - ${sender.toUpperCase()}]: ${formattedMessage}`);
        return;
    }

    // Make sure the chatbox is visible
    chatBox.style.display = 'block';

    const msgElement = document.createElement('div');
    msgElement.className = `ciliai-message ${sender}`;
    
    // Convert markdown bold to HTML bold
    message = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert newlines to <br> tags
    message = message.replace(/\n/g, '<br>');
    
    msgElement.innerHTML = message;

    if (sender === 'user') {
        chatBox.innerHTML = ''; // Clear previous results
        chatBox.appendChild(msgElement);
    } else {
        // If it's a CiliAI message, *replace* the "Thinking..."
        chatBox.innerHTML = msgElement.innerHTML;
    }
    
    chatBox.scrollTop = chatBox.scrollHeight;
}


// ============================================================================
// 7. 🚀 RUN CiliAI (ROBUST INITIALIZER)
// ============================================================================

/**
 * Attaches all CiliAI event listeners to the DOM.
 * This is the *only* place the listeners are added.
 */
function ciliAI_init_listeners() {
    // *** These IDs must match your HTML ***
    const sendButton = document.getElementById('aiQueryBtn');
    const inputElement = document.getElementById('aiQueryInput');
    const exampleQueriesContainer = document.querySelector('.example-queries'); 

    let listenersAttached = true; // Start optimistic

    // 1. Attach to Send Button
    if (sendButton) {
        sendButton.addEventListener('click', ciliAI_handleQuery);
    } else {
        console.warn("[CiliAI] Send button 'aiQueryBtn' not found.");
        listenersAttached = false;
    }

    // 2. Attach to Input Box (for 'Enter' key)
    if (inputElement) {
        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); 
                ciliAI_handleQuery();
            }
        });
    } else {
        console.warn("[CiliAI] Input box 'aiQueryInput' not found.");
        listenersAttached = false;
    }

    // 3. Attach to Example Queries Container
    if (exampleQueriesContainer) {
        exampleQueriesContainer.addEventListener('click', (e) => {
            // Check if the clicked element is one of the <span> tags
            if (e.target && e.target.matches('.example-queries span')) {
                const query = e.target.dataset.question || e.target.textContent;
                
                // Put the query in the input box
                const input = document.getElementById('aiQueryInput');
                if (input) {
                    input.value = query;
                }
                
                // Manually trigger the query handler
                ciliAI_handleQuery(); 
            }
        });
    } else {
        console.warn("[CiliAI] Example queries container '.example-queries' not found.");
    }

    // Final check
    if (listenersAttached) {
        console.log("✅ [CiliAI] Event listeners successfully attached.");
        return true; // Success
    }
    
    // Log explicit "not found" messages
    if (!sendButton) console.warn("[CiliAI] Send button not found. (Tried 'aiQueryBtn')");
    if (!inputElement) console.warn("[CiliAI] Input box not found. (Tried 'aiQueryInput')");

    return false; // Elements not found yet
}

/**
 * This function waits for the CiliAI HTML elements (which are injected 
 * by displayCiliAIPage) to appear in the DOM before attaching listeners.
 */
function ciliAI_waitForElements() {
    console.log("[CiliAI] Waiting for elements 'aiQueryBtn' and 'aiQueryInput'...");

    // Try to attach listeners immediately
    if (ciliAI_init_listeners()) {
        return; // Success, elements were already there
    }

    // If not found, set up an interval to check for them
    let attempts = 0;
    const maxAttempts = 50; // Check for 5 seconds (50 * 100ms)

    const checkInterval = setInterval(() => {
        attempts++;
        if (ciliAI_init_listeners()) {
            // Success! Elements are now loaded.
            clearInterval(checkInterval);
        } else if (attempts > maxAttempts) {
            // Failed. Stop trying.
            clearInterval(checkInterval);
            console.error("[CiliAI] FAILED to find 'aiQueryBtn' or 'aiQueryInput' after 5 seconds.");
        }
    }, 100);
}

// Start the process as soon as this file is loaded.
ciliAI_waitForElements();


// ============================================================================
// 8. 🧪 CiliAI SIMULATION (for testing)
// ============================================================================
// (Simulation functions are omitted for clarity, but you can add them back
// from the previous response if you need them for testing.)
// ============================================================================


// --- Main Page Display Function (REPLACEMENT) ---
// This function should be in your main script.js or globals.js
window.displayCiliAIPage = async function displayCiliAIPage() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) {
        console.error('Content area not found');
        return;
    }
    contentArea.className = 'content-area content-area-full';
    const ciliaPanel = document.querySelector('.cilia-panel');
    if (ciliaPanel) {
        ciliaPanel.style.display = 'none';
    }

    try {
        // Step 1: Inject the HTML
        contentArea.innerHTML = `
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/cytoscape@3.23.0/dist/cytoscape.min.js"></script>
            <div class="ciliai-container">
                <div class="ciliai-header">
                    <h1>CiliAI</h1>
                    <p>Your AI-powered partner for discovering gene-cilia relationships.</p>
                </div>
                <div class="ciliai-main-content">
                    <div class="ai-query-section">
                        <h3>Ask a Question</h3>
                        <div class="ai-input-group autocomplete-wrapper">
                            <input type="text" id="aiQueryInput" class="ai-query-input" placeholder="What's on your mind? Try a gene name or a question...">
                            <div id="aiQuerySuggestions" class="suggestions-container"></div>
                            <button class="ai-query-btn" id="aiQueryBtn">Ask CiliAI</button>
                        </div>
                        <div class="example-queries">
                            <p>
                                <strong>Try asking:</strong> 
                                <span data-question="What can you do?">About CiliAI</span>, 
                                <span data-question="Show genes for Joubert syndrome">List genes for Joubert syndrome</span>, 
                                <span data-question="List ciliary genes in C. elegans">List potential ciliary genes in C. elegans (Phylogenetic)</span>, 
                                <span data-question="Plot UMAP expression for FOXJ1">Display expression for FOXJ1 in Lung</span>,
                                <span data-question="Compare ARL13B and FOXJ1 expression in lung scRNA-seq">Compare ARL13B and FOXJ1 expression in lung scRNA-seq</span>,
                                <span data-question="Compare phylogeny of BBS1 and CEP290.">Compare phylogeny of BBS1 and CEP290</span>,
                                <span data-question="What proteins are enriched at the ciliary tip?">What proteins are enriched at the ciliary tip?</span>,
                                <span data-question="Which Joubert Syndrome genes are expressed in ciliated cells?">Joubert genes in ciliated cells</span>
                            </p>
                        </div>
                        <div id="ai-result-area" class="results-section" style="display: none; margin-top: 1.5rem; padding: 1rem;"></div>
                    </div>
                    
                    <div class="input-section" style="display:none;"> 
                        <h3>Analyze Gene Phenotypes</h3>
                        <div class="input-group">
                            <label for="geneInput">Gene Symbols:</label>
                            <div class="autocomplete-wrapper">
                                <textarea id="geneInput" class="gene-input-textarea" placeholder="Start typing a gene symbol (e.g., IFT88)..."></textarea>
                                <div id="geneSuggestions" class="suggestions-container"></div>
                            </div>
                        </div>
                        <div class="input-group">
                            <label>Analysis Mode:</label>
                            <div class="mode-selector">
                                </div>
                        </div>
                        <button class="analyze-btn" id="analyzeBtn">🔍 Analyze Genes</button>
                    </div>
                    <div id="resultsSection" class="results-section" style="display: none;">
                        </div>
                </div>
            </div>
            <style>
                .ciliai-container { font-family: 'Arial', sans-serif; max-width: 950px; margin: 2rem auto; padding: 2rem; background-color: #f9f9f9; border-radius: 12px; }
                .ciliai-header { text-align: center; margin-bottom: 2rem; }
                .ciliai-header h1 { font-size: 2.8rem; color: #2c5aa0; margin: 0; }
                .ciliai-header p { font-size: 1.2rem; color: #555; margin-top: 0.5rem; }
                .ai-query-section { background-color: #e8f4fd; border: 1px solid #bbdefb; padding: 1.5rem 2rem; border-radius: 8px; margin-bottom: 2rem; }
                .ai-query-section h3 { margin-top: 0; color: #2c5aa0; }
                .ai-input-group { position: relative; display: flex; gap: 10px; }
                .ai-query-input { flex-grow: 1; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
                .ai-query-btn { padding: 0.8rem 1.2rem; font-size: 1rem; background-color: #2c5aa0; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
                .ai-query-btn:hover { background-color: #1e4273; }
                .example-queries { margin-top: 1rem; font-size: 0.9rem; color: #555; text-align: left; }
                .example-queries span { background-color: #d1e7fd; padding: 4px 10px; border-radius: 12px; font-family: 'Arial', sans-serif; cursor: pointer; margin: 4px; display: inline-block; transition: background-color 0.2s; border: 1px solid #b1d7fc;}
                .example-queries span:hover { background-color: #b1d7fc; }
                .input-section { background-color: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .input-group { margin-bottom: 1.5rem; }
                .input-group label { display: block; font-weight: bold; margin-bottom: 0.5rem; color: #333; }
                .gene-input-textarea { width: 100%; box-sizing: border-box; padding: 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; min-height: 80px; resize: vertical; }
                .mode-selector { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
                .mode-option input[type="radio"] { display: none; }
                .mode-option label { display: flex; align-items: center; gap: 10px; padding: 1rem; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
                .mode-option input[type="radio"]:checked + label { border-color: #2c5aa0; background-color: #e8f4fd; box-shadow: 0 0 5px rgba(44, 90, 160, 0.3); }
                .mode-icon { font-size: 1.8rem; }
                .analyze-btn { width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold; background-color: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; }
                .analyze-btn:hover:not([disabled]) { background-color: #218838; }
                .results-section { margin-top: 2rem; padding: 2rem; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .result-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
                .result-card h3 { margin-top: 0; color: #2c5aa0; }
                .ciliopathy-table, .expression-table, .gene-detail-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .ciliopathy-table th, .ciliopathy-table td, .expression-table th, .expression-table td, .gene-detail-table th, .gene-detail-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .ciliopathy-table th, .expression-table th, .gene-detail-table th { background-color: #e8f4fd; color: #2c5aa0; }
                .suggestions-container { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ccc; z-index: 1000; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .suggestion-item { padding: 10px; cursor: pointer; }
                .suggestion-item:hover { background-color: #f0f0f0; }
                .download-button { background-color: #28a745; color: white; padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; font-weight: bold; margin-top: 15px; transition: background-color 0.3s ease; }
                .download-button:hover { background-color: #218838; }
            </style>
        `;
    } catch (error) {
        console.error('Failed to inject CiliAI HTML:', error);
        contentArea.innerHTML = '<p>Error: Failed to load CiliAI interface.</p>';
        return;
    }
    
    console.log('ciliAI.js: Page HTML injected.');
    
    // NOTE: The "Analyze Gene Phenotypes" section is now hidden by default
    // because its functions (runAnalysis, etc.) were removed.
    const analyzeSection = contentArea.querySelector('.input-section');
    if (analyzeSection) {
        analyzeSection.style.display = 'none';
        console.log('[CiliAI] "Analyze Gene Phenotypes" section hidden (functionality removed).');
    }
};
