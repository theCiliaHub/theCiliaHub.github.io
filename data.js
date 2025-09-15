/**
 * Sanitizes any string by removing invisible characters and normalizing it.
 */
function sanitize(input) {
    if (typeof input !== 'string') return '';
    // Removes zero-width spaces, non-printable characters, trims, and normalizes case
    return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
                .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII
                .trim()
                .toUpperCase();
}

/**
 * Loads, sanitizes, and prepares the gene database into an efficient lookup map.
 */
async function loadAndPrepareDatabase() {
    if (geneDataCache) return true;
    try {
        const resp = await fetch('https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/main/ciliahub_data.json');
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const rawGenes = await resp.json();

        if (!Array.isArray(rawGenes)) {
            throw new Error('Invalid data format: expected array');
        }

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
          // This part of your code already handles Ensembl IDs
if (g.ensembl_id) {
    String(g.ensembl_id).split(/[,;]/).forEach(id => {
        const key = sanitize(id);
        if (key) geneMapCache.set(key, g);
    });
} 
            
            // 4. Prepare localization data for SVG mapping - MODIFIED: Sanitize input to filter non-ciliary terms and add debug logging for ACTN2
           if (g.localization) {
            // ✨ REPLACE the old array with this one ✨
            const validLocalizations = [
                'cilia', 'basal body', 'transition zone', 'axoneme', 'ciliary membrane', 
                'centrosome', 'flagella', 'nucleus', 'cytosol', 'mitochondrion', 
                'endoplasmic reticulum', 'golgi apparatus', 'lysosome', 'microbody', 
                'peroxisome', 'microtubules', 'autophagosomes', 'ribosome', 'p-body'
            ];
            
            let sanitizedLocalization = (Array.isArray(g.localization) ? g.localization : String(g.localization).split(/[,;]/))
                .map(loc => loc ? loc.trim().toLowerCase() : '')
                .filter(loc => loc && validLocalizations.includes(loc));
            
            geneLocalizationData[g.gene] = mapLocalizationToSVG(sanitizedLocalization); 
        }
                
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
        // Fallback logic remains the same
        allGenes = getDefaultGenes();
        currentData = allGenes;
        geneMapCache = new Map();
        allGenes.forEach(g => {
            if (g.gene) geneMapCache.set(sanitize(g.gene), g);
        });
        return false;
    }
}

/**
 * Search genes using symbols, synonyms, or ENSG IDs.
 * Handles multiple IDs per gene.
 */
/**
 * Search genes using symbols, synonyms, or Ensembl IDs from the pre-built cache.
 * Handles multiple queries efficiently.
 *
 * @param {string[]} queries - An array of sanitized, uppercase gene identifiers.
 * @returns {{foundGenes: object[], notFoundGenes: string[]}} - An object containing found gene objects and not-found queries.
 */
function findGenes(queries) {
    const foundGenes = new Map(); // Use a Map to store unique genes by their canonical name
    const notFound = [];

    queries.forEach(query => {
        // The query is expected to be sanitized (trimmed, uppercased) before being passed.
        const result = geneMapCache.get(query);
        
        if (result) {
            // Use the canonical gene name as the key to prevent duplicates
            if (!foundGenes.has(result.gene)) {
                foundGenes.set(result.gene, result);
            }
        } else {
            // The original, unsanitized query should be returned for user feedback.
            // This requires the calling function to manage the original queries.
            notFound.push(query); 
        }
    });
    
    return { 
        foundGenes: Array.from(foundGenes.values()), 
        notFoundGenes: notFound 
    };
}

// Add this function to help with debugging
function debugSearch(query) {
    console.log("Searching for:", query);
    console.log("Cache has key?", geneMapCache.has(query));
    
    if (!geneMapCache.has(query)) {
        console.log("Available keys matching query:");
        for (let key of geneMapCache.keys()) {
            if (key.includes(query) || query.includes(key)) {
                console.log(`- ${key}`);
            }
        }
    }
}

async function loadExpressionData() {
    try {
        const response = await fetch('rna_tissue_consensus.tsv');
        if (!response.ok) throw new Error('Failed to load expression data');

        const tsvText = await response.text();
        const rawData = parseTSV(tsvText);
        expressionData = processExpressionData(rawData);

        const geneSet = new Set();
        Object.keys(expressionData).forEach(gene => {
            geneSet.add(gene); // Gene names are now already uppercase
        });
        availableGenes = geneSet;

        console.log(`Loaded ${Object.keys(expressionData).length} genes with expression data from TSV`);
    } catch (error) {
        console.error('Error loading expression data:', error);
    }
}

function parseTSV(tsvText) {
    const lines = tsvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split('\t');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
    }
    return data;
}

function processExpressionData(rawData) {
    const processedData = {};
    rawData.forEach(row => {
        const geneName = row['Gene name'] || row['Gene'];
        if (geneName) {
            const upperGeneName = geneName.toUpperCase(); // Standardize to uppercase
            const tissue = row['Tissue'];
            const nTPM = parseFloat(row['nTPM']);

            if (tissue && !isNaN(nTPM)) {
                if (!processedData[upperGeneName]) {
                    processedData[upperGeneName] = {};
                }
                processedData[upperGeneName][tissue] = nTPM;
            }
        }
    });
    return processedData;
}
