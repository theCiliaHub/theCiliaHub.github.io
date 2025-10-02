// ============================================================================
// ENHANCED CILIA LITERATURE RETRIEVAL ALGORITHM
// ============================================================================

const RETRIEVAL_CONFIG = {
    // Relevance scoring thresholds
    MIN_RELEVANCE_SCORE: 0.3,
    HIGH_RELEVANCE_THRESHOLD: 0.7,
    
    // Context window for passage extraction
    CONTEXT_WINDOW_SENTENCES: 3,
    MAX_PASSAGE_LENGTH: 500,
    MIN_PASSAGE_LENGTH: 50,
    
    // Co-occurrence requirements
    MAX_GENE_DISTANCE: 150, // characters between gene mention and cilia keywords
    
    // Deduplication
    SIMILARITY_THRESHOLD: 0.85 // For detecting near-duplicate passages
};

// ============================================================================
// ENHANCED KEYWORD LEXICON WITH WEIGHTS
// ============================================================================

const WEIGHTED_KEYWORDS = {
    // High-specificity cilia terms (weight: 3.0)
    HIGH_SPECIFICITY: {
        weight: 3.0,
        terms: [
            'ciliogenesis', 'multiciliated', 'multiciliation', 'axoneme',
            'basal body', 'transition zone', 'ciliary membrane', 'ciliary tip',
            'intraflagellar transport', 'IFT', 'ciliary gate', 'ciliopathy',
            'primary cilium assembly', 'ciliary pocket', 'inversin compartment'
        ]
    },
    
    // Medium-specificity (weight: 2.0)
    MEDIUM_SPECIFICITY: {
        weight: 2.0,
        terms: [
            'cilia', 'ciliary', 'cilium', 'cilia length', 'ciliary length',
            'shorter cilia', 'longer cilia', 'elongated cilia', 'stunted cilia',
            'cilia assembly', 'cilia formation', 'ciliated cells', 'motile cilia',
            'primary cilia', 'nodal cilia', 'sensory cilia'
        ]
    },
    
    // Phenotype-specific terms (weight: 2.5)
    PHENOTYPE: {
        weight: 2.5,
        terms: [
            'cilia number', 'ciliated cell percentage', 'ciliation frequency',
            'loss of cilia', 'absent cilia', 'fewer cilia', 'reduced ciliation',
            'impaired ciliogenesis', 'defective ciliogenesis', 'cilia defects',
            'abnormal cilia', 'cilia morphology', 'hyperelongated cilia'
        ]
    },
    
    // Functional assays (weight: 2.0)
    FUNCTIONAL: {
        weight: 2.0,
        terms: [
            'fluid flow', 'flow velocity', 'mucociliary clearance', 'ciliary beat',
            'beat frequency', 'ciliary motility', 'bead displacement',
            'particle tracking', 'flow measurement', 'nodal flow',
            'cerebrospinal fluid flow', 'extracellular fluid flow'
        ]
    },
    
    // Context terms (weight: 1.0) - indicate relevant context
    CONTEXT: {
        weight: 1.0,
        terms: [
            'polarized', 'apical surface', 'epithelial', 'ependymal',
            'respiratory', 'renal', 'retinal', 'photoreceptor', 'olfactory',
            'airway', 'kidney', 'brain ventricles', 'node', 'left-right'
        ]
    }
};

// Compile all terms into a flat structure for quick lookup
const COMPILED_KEYWORDS = Object.entries(WEIGHTED_KEYWORDS).flatMap(([category, data]) =>
    data.terms.map(term => ({ term: term.toLowerCase(), weight: data.weight, category }))
);

// ============================================================================
// NEGATIVE KEYWORDS (Exclude irrelevant contexts)
// ============================================================================

const NEGATIVE_KEYWORDS = [
    'bacterial', 'bacteria', 'prokaryotic', 'e. coli', 'salmonella',
    'flagellum', 'flagella', 'archaeal', 'chlamydomonas reinhardtii',
    'tetrahymena', 'paramecium', 'trypanosoma', // Exclude unless in ciliate context
    'review article', 'commentary', 'editorial', // Meta-literature
    'abbreviations:', 'keywords:', 'funding:', 'conflict of interest',
    'supplementary material', 'data availability'
];

// ============================================================================
// PASSAGE EXTRACTION WITH RELEVANCE SCORING
// ============================================================================

/**
 * Extracts relevant passages from text with context-aware scoring
 * @param {string} text - Full text or abstract
 * @param {string} gene - Target gene symbol
 * @param {string} source - 'abstract' or 'fulltext'
 * @returns {Array} Scored and ranked passages
 */
function extractRelevantPassages(text, gene, source = 'fulltext') {
    const sentences = splitIntoSentences(text);
    const passages = [];
    
    // Create sliding window of sentences
    const windowSize = RETRIEVAL_CONFIG.CONTEXT_WINDOW_SENTENCES;
    
    for (let i = 0; i < sentences.length; i++) {
        const window = sentences.slice(
            Math.max(0, i - 1),
            Math.min(sentences.length, i + windowSize)
        ).join(' ');
        
        // Check if this window contains both the gene and cilia terms
        if (!mentionsGene(window, gene)) continue;
        
        const score = scorePassage(window, gene, source);
        
        if (score.total >= RETRIEVAL_CONFIG.MIN_RELEVANCE_SCORE) {
            passages.push({
                text: window.trim(),
                score: score.total,
                breakdown: score.breakdown,
                startSentence: i,
                containsGene: true,
                containsCilia: score.breakdown.ciliaTerms > 0
            });
        }
    }
    
    // Deduplicate and rank passages
    const uniquePassages = deduplicatePassages(passages);
    return uniquePassages.sort((a, b) => b.score - a.score);
}

// ============================================================================
// RELEVANCE SCORING SYSTEM
// ============================================================================

/**
 * Scores a passage based on multiple relevance factors
 */
function scorePassage(text, gene, source) {
    const lowerText = text.toLowerCase();
    const breakdown = {
        ciliaTerms: 0,
        geneProximity: 0,
        phenotypeTerms: 0,
        quantitativeData: 0,
        methodologicalContext: 0,
        negativeFactors: 0
    };
    
    // 1. Cilia keyword scoring with weights
    let ciliaScore = 0;
    const matchedTerms = new Set();
    
    COMPILED_KEYWORDS.forEach(({ term, weight, category }) => {
        if (lowerText.includes(term)) {
            ciliaScore += weight;
            matchedTerms.add(term);
            
            if (category === 'PHENOTYPE') {
                breakdown.phenotypeTerms += weight;
            }
        }
    });
    breakdown.ciliaTerms = ciliaScore;
    
    // 2. Gene-cilia proximity scoring
    const genePositions = findAllPositions(text, gene);
    const ciliaPositions = Array.from(matchedTerms).flatMap(term =>
        findAllPositions(lowerText, term)
    );
    
    if (genePositions.length > 0 && ciliaPositions.length > 0) {
        const minDistance = Math.min(
            ...genePositions.flatMap(gPos =>
                ciliaPositions.map(cPos => Math.abs(gPos - cPos))
            )
        );
        
        if (minDistance <= RETRIEVAL_CONFIG.MAX_GENE_DISTANCE) {
            // Closer mentions get higher scores
            breakdown.geneProximity = 2.0 * (1 - minDistance / RETRIEVAL_CONFIG.MAX_GENE_DISTANCE);
        }
    }
    
    // 3. Quantitative data presence
    if (hasQuantitativeData(text)) {
        breakdown.quantitativeData = 2.0;
    }
    
    // 4. Methodological context (indicates primary research)
    const methodKeywords = [
        'measured', 'quantified', 'analyzed', 'observed', 'demonstrated',
        'showed', 'revealed', 'found that', 'we found', 'our results',
        'immunofluorescence', 'microscopy', 'western blot', 'qPCR',
        'CRISPR', 'knockout', 'knockdown', 'overexpression', 'rescue'
    ];
    
    const methodCount = methodKeywords.filter(kw => lowerText.includes(kw)).length;
    breakdown.methodologicalContext = Math.min(methodCount * 0.5, 2.0);
    
    // 5. Negative factors (penalize irrelevant contexts)
    const negativeCount = NEGATIVE_KEYWORDS.filter(nkw => lowerText.includes(nkw)).length;
    breakdown.negativeFactors = -negativeCount * 1.0;
    
    // 6. Source-specific bonuses
    let sourceBonus = 0;
    if (source === 'abstract') {
        sourceBonus = 0.5; // Abstracts are typically more focused
    }
    
    // Calculate total score
    const total = Math.max(0,
        breakdown.ciliaTerms +
        breakdown.geneProximity +
        breakdown.quantitativeData +
        breakdown.methodologicalContext +
        breakdown.negativeFactors +
        sourceBonus
    );
    
    return { total, breakdown };
}

// ============================================================================
// GENE MENTION DETECTION WITH VARIANTS
// ============================================================================

/**
 * Checks if text mentions the gene, including common variants
 */
function mentionsGene(text, gene) {
    const variants = generateGeneVariants(gene);
    const lowerText = text.toLowerCase();
    
    return variants.some(variant => {
        const regex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'i');
        return regex.test(text);
    });
}

/**
 * Generates common variants of a gene name
 */
function generateGeneVariants(gene) {
    const variants = [gene, gene.toLowerCase(), gene.toUpperCase()];
    
    // Add common formatting variants
    if (gene.includes('-')) {
        variants.push(gene.replace(/-/g, ''));
    }
    if (gene.match(/\d/)) {
        // e.g., IFT88 -> Ift88, ift88
        variants.push(
            gene.charAt(0).toUpperCase() + gene.slice(1).toLowerCase()
        );
    }
    
    // Add possessive and plural forms
    variants.push(`${gene}'s`, `${gene}s`);
    
    return [...new Set(variants)];
}

// ============================================================================
// CONTEXTUAL CO-OCCURRENCE ANALYSIS
// ============================================================================

/**
 * Analyzes the semantic relationship between gene and cilia mentions
 */
function analyzeCoOccurrence(text, gene) {
    const sentences = splitIntoSentences(text);
    const coOccurrences = [];
    
    sentences.forEach((sentence, idx) => {
        const hasGene = mentionsGene(sentence, gene);
        const ciliaTerms = COMPILED_KEYWORDS.filter(kw =>
            sentence.toLowerCase().includes(kw.term)
        );
        
        if (hasGene && ciliaTerms.length > 0) {
            // Analyze the grammatical relationship
            const relationship = inferRelationship(sentence, gene, ciliaTerms);
            
            coOccurrences.push({
                sentence,
                sentenceIndex: idx,
                ciliaTerms: ciliaTerms.map(t => t.term),
                relationship,
                confidence: relationship.confidence
            });
        }
    });
    
    return coOccurrences;
}

/**
 * Infers the relationship between gene and cilia terms in a sentence
 */
function inferRelationship(sentence, gene, ciliaTerms) {
    const lowerSentence = sentence.toLowerCase();
    
    // Pattern matching for common relationships
    const patterns = [
        {
            regex: new RegExp(`${escapeRegex(gene)}.*?(regulate|control|affect|influence|modify).*?(${ciliaTerms[0]?.term})`, 'i'),
            type: 'regulatory',
            confidence: 0.9
        },
        {
            regex: new RegExp(`${escapeRegex(gene)}.*?(required|necessary|essential|critical).*?(${ciliaTerms[0]?.term})`, 'i'),
            type: 'requirement',
            confidence: 0.95
        },
        {
            regex: new RegExp(`(loss|depletion|knockout).*?${escapeRegex(gene)}.*?(${ciliaTerms[0]?.term})`, 'i'),
            type: 'loss-of-function',
            confidence: 0.85
        },
        {
            regex: new RegExp(`${escapeRegex(gene)}.*?(localize|locate|present).*?(${ciliaTerms[0]?.term})`, 'i'),
            type: 'localization',
            confidence: 0.8
        }
    ];
    
    for (const pattern of patterns) {
        if (pattern.regex.test(sentence)) {
            return {
                type: pattern.type,
                confidence: pattern.confidence,
                matched: true
            };
        }
    }
    
    return {
        type: 'co-mention',
        confidence: 0.5,
        matched: false
    };
}

// ============================================================================
// PASSAGE DEDUPLICATION
// ============================================================================

/**
 * Removes near-duplicate passages using similarity scoring
 */
function deduplicatePassages(passages) {
    const unique = [];
    
    for (const passage of passages) {
        const isDuplicate = unique.some(existing =>
            calculateTextSimilarity(passage.text, existing.text) > RETRIEVAL_CONFIG.SIMILARITY_THRESHOLD
        );
        
        if (!isDuplicate) {
            unique.push(passage);
        } else {
            // Keep the higher-scoring version
            const duplicateIndex = unique.findIndex(existing =>
                calculateTextSimilarity(passage.text, existing.text) > RETRIEVAL_CONFIG.SIMILARITY_THRESHOLD
            );
            
            if (passage.score > unique[duplicateIndex].score) {
                unique[duplicateIndex] = passage;
            }
        }
    }
    
    return unique;
}

/**
 * Calculates Jaccard similarity between two text passages
 */
function calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Splits text into sentences with improved accuracy
 */
function splitIntoSentences(text) {
    // Handle common abbreviations and edge cases
    text = text.replace(/([Dr|Mr|Mrs|Ms|Prof])\.(?=\s)/g, '$1<DOT>');
    text = text.replace(/(\d+)\.(\d+)/g, '$1<DOT>$2');
    text = text.replace(/([a-z])\.([A-Z])/g, '$1. $2');
    
    const sentences = text.split(/[.!?]+\s+/)
        .map(s => s.replace(/<DOT>/g, '.').trim())
        .filter(s => s.length >= RETRIEVAL_CONFIG.MIN_PASSAGE_LENGTH);
    
    return sentences;
}

/**
 * Finds all positions of a substring in text
 */
function findAllPositions(text, searchStr) {
    const positions = [];
    const lowerText = text.toLowerCase();
    const lowerSearch = searchStr.toLowerCase();
    let pos = lowerText.indexOf(lowerSearch);
    
    while (pos !== -1) {
        positions.push(pos);
        pos = lowerText.indexOf(lowerSearch, pos + 1);
    }
    
    return positions;
}

/**
 * Enhanced quantitative data detection
 */
function hasQuantitativeData(text) {
    const patterns = [
        /\b\d+(\.\d+)?\s*(µm|um|μm|nm|%|fold)\b/i,
        /\b\d+(\.\d+)?\s*±\s*\d+(\.\d+)?/i,
        /\bp\s*[<>=]\s*0?\.\d+/i,
        /\b(increased|decreased|reduced)\s+by\s+\d+/i,
        /\b\d+\s*(vs|versus|compared to)\s*\d+/i,
        /\bn\s*=\s*\d+/i
    ];
    
    return patterns.some(pattern => pattern.test(text));
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// MAIN RETRIEVAL FUNCTION
// ============================================================================

/**
 * Main function to retrieve cilia-related passages for a gene
 * @param {string} abstractText - PubMed abstract text
 * @param {string} fullText - PMC full text (optional)
 * @param {string} gene - Gene symbol
 * @returns {Object} Structured retrieval results
 */
function retrieveCiliaEvidence(abstractText, fullText, gene) {
    const results = {
        gene,
        abstractPassages: [],
        fullTextPassages: [],
        topPassages: [],
        confidence: 0,
        evidenceTypes: new Set()
    };
    
    // Extract from abstract
    if (abstractText) {
        results.abstractPassages = extractRelevantPassages(abstractText, gene, 'abstract');
    }
    
    // Extract from full text
    if (fullText) {
        results.fullTextPassages = extractRelevantPassages(fullText, gene, 'fulltext');
    }
    
    // Combine and rank all passages
    const allPassages = [...results.abstractPassages, ...results.fullTextPassages];
    results.topPassages = deduplicatePassages(allPassages)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Keep top 10
    
    // Calculate overall confidence
    if (results.topPassages.length > 0) {
        results.confidence = results.topPassages.reduce((sum, p) => sum + p.score, 0) / results.topPassages.length;
    }
    
    // Identify evidence types
    results.topPassages.forEach(passage => {
        const coOcc = analyzeCoOccurrence(passage.text, gene);
        coOcc.forEach(c => results.evidenceTypes.add(c.relationship.type));
    });
    
    results.evidenceTypes = Array.from(results.evidenceTypes);
    
    return results;
}

// ============================================================================
// EXPORT
// ============================================================================

// Make functions available globally
if (typeof window !== 'undefined') {
    window.CiliaRetrieval = {
        extractRelevantPassages,
        scorePassage,
        analyzeCoOccurrence,
        retrieveCiliaEvidence,
        mentionsGene,
        generateGeneVariants
    };
}

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        extractRelevantPassages,
        scorePassage,
        analyzeCoOccurrence,
        retrieveCiliaEvidence,
        mentionsGene,
        generateGeneVariants
    };
}
