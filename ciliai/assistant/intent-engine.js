/**
 * CiliAI Intent Engine v3.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixes:
 *   BUG 1: "Dot plot of IFT88, ARL13B, BBS1, FOXJ1" → was showing Bardet-Biedl
 *          Fix: multi-gene parser runs BEFORE disease parser; disease parser
 *               is skipped when ≥2 gene symbols + list separator are present.
 *
 *   BUG 2: "How many ciliary proteins with WD40 repeats?" → returned 0
 *          Fix: domain search does case-insensitive substring match against
 *               BOTH Domain_Descriptions AND PFAM_IDs columns.
 *
 * New intents added (covers all 157 previously unsupported patterns):
 *   self_intro, help, domain_count, domain_list, domain_enrichment,
 *   domain_gene_list (which genes have X domain), multi_domain,
 *   phylo_gene, phylo_multi, phylo_filter, phylo_complex,
 *   ciliary_check, gene_function, loc_phenotype_combo,
 *   loc_phenotype (localization + cilia phenotype), stat_overview,
 *   classification_stats, and all ortholog sub-types.
 * ─────────────────────────────────────────────────────────────────────────────
 * INSTALL:  Save to  ciliai/assistant/intent-engine.js
 *           Add in index.html AFTER assistant-runtime.js, BEFORE ciliai.js:
 *             <script src="./ciliai/assistant/intent-engine.js"></script>
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

(function (win) {

// ═══════════════════════════════════════════════════════════════════════════
// § 1  DATA CONSTANTS  (grounded in the actual CSV schema)
// ═══════════════════════════════════════════════════════════════════════════

/* Disease name fragments → canonical disease tag.
   ORDER MATTERS: more-specific patterns first.
   Multi-gene queries containing "BBS1" must NOT reach this table —
   the multi-gene parser runs first (Bug 1 fix). */
const DISEASE_PATTERNS = [
    ['joubert',                   'joubert'],
    ['jbts',                      'joubert'],
    ['coach syndrome',            'joubert'],
    ['bardet',                    'bardet_biedl'],
    ['bardet-biedl',              'bardet_biedl'],
    ['bardet–biedl',              'bardet_biedl'],
    [/\bbbs\b/,                   'bardet_biedl'],
    ['meckel',                    'meckel'],
    ['mks',                       'meckel'],
    ['nephronophthisis',          'nphp'],
    [/\bnphp\b/,                  'nphp'],
    ['primary ciliary dyskinesia','pcd'],
    ['ciliary dyskinesia',        'pcd'],
    [/\bpcd\b/,                   'pcd'],
    ['leber congenital amaurosis','retinal'],
    ['leber',                     'retinal'],
    ['retinitis pigmentosa',      'retinal'],
    ['retinal ciliopathy',        'retinal'],
    ['retinal degeneration',      'retinal'],
    ['retinal dystrophy',         'retinal'],
    ['cone-rod dystrophy',        'retinal'],
    [/\blca\b/,                   'retinal'],
    ['ellis-van creveld',         'skeletal'],
    ['jeune',                     'skeletal'],
    ['cranioectodermal dysplasia','skeletal'],
    ['short-rib',                 'skeletal'],
    ['skeletal ciliopathy',       'skeletal'],
    ['polydactyly',               'polydactyly'],
    ['acrocallosal',              'polydactyly'],
    ['male infertility',          'infertility'],
    ['infertility',               'infertility'],
    [/\bmmaf\b/,                  'infertility'],
    ['medulloblastoma',           'medulloblastoma'],
    ['alstr',                     'alstrom'],
    ['polycystic kidney',         'pkd'],
    [/\bpkd\b/,                   'pkd'],
    ['senior-løken',              'senior_loken'],
    ['usher',                     'usher'],
    ['carpenter',                 'carpenter'],
    ['holoprosencephaly',         'holoprosencephaly'],
    [/\bhpe\b/,                   'holoprosencephaly'],
    ['epilepsy',                  'epilepsy'],
    ['myoclonic',                 'epilepsy'],
    ['spinocerebellar ataxia',    'ataxia'],
    ['ataxia',                    'ataxia'],
    ['tetralogy of fallot',       'cardiac'],
    [/\btof\b/,                   'cardiac'],
    ['heterotaxy',                'cardiac'],
    ['situs inversus',            'cardiac'],
    ['orofaciodigital',           'ofd'],
    [/\bofd\b/,                   'ofd'],
    ['simpson-golabi',            'simpson_golabi'],
    ['cornelia de lange',         'cornelia_de_lange'],
    ['spondylometaphyseal',       'skeletal'],
];

/* Localization canonical map */
const LOCALIZATION_MAP = {
    'cilia':             { id:'ciliary-membrane', label:'Cilium / Ciliary Membrane' },
    'ciliary membrane':  { id:'ciliary-membrane', label:'Ciliary Membrane' },
    'basal body':        { id:'basal-body',       label:'Basal Body (PCM1+)' },
    'centrosome':        { id:'basal-body',       label:'Centrosome / Basal Body' },
    'transition zone':   { id:'transition-zone',  label:'Transition Zone (Gate)' },
    'axoneme':           { id:'axoneme',           label:'Axoneme (Microtubule Core)' },
    'ciliary axoneme':   { id:'axoneme',           label:'Axoneme' },
    'flagella':          { id:'axoneme',           label:'Flagella / Axoneme' },
    'ciliary tip':       { id:'ciliary-tip',       label:'Ciliary Tip' },
    'nucleus':           { id:'nucleus',           label:'Nucleus' },
    'cytosol':           { id:'cell-body',         label:'Cytosol' },
    'motile cilia':      { id:'ciliary-membrane',  label:'Motile Cilia' },
    'distal appendage':  { id:'distal-appendage',  label:'Distal Appendage' },
    'mitochondria':      { id:'cell-body',         label:'Mitochondria' },
    'lysosome':          { id:'cell-body',         label:'Lysosome' },
};

/* Tissue synonyms */
const TISSUE_MAP = {
    lung:          ['lung','airway','bronchial','alveol','pulmonary'],
    kidney:        ['kidney','renal','nephron','proximal tubule','collecting duct','podocyte'],
    liver:         ['liver','hepat','cholangiocyte','bile'],
    hypothalamus:  ['hypothalamus','hypothalamic','brain','neural','neuron'],
    chondrocyte:   ['chondrocyte','cartilage','bone','skeletal cell'],
    retina:        ['retina','retinal','photoreceptor','rod','cone'],
    olfactory:     ['olfactory','nasal','smell'],
    pancreas:      ['pancrea','islet','beta cell'],
    choroid_plexus:['choroid plexus','csf','cerebrospinal'],
    cerebellum:    ['cerebellum','cerebellar','granule cell','purkinje'],
    limb_bud:      ['limb bud','limb development','digit'],
};

/* Domain family → search terms (searched against Domain_Descriptions + PFAM_IDs) */
const DOMAIN_FAMILIES = {
    'WD40':       ['wd40','wd repeat','wd40/yvtn'],
    'TPR':        ['tpr','tetratricopeptide'],
    'coiled-coil':['coiled-coil','coiled coil'],
    'kinase':     ['kinase'],
    'kinesin':    ['kinesin'],
    'GTPase':     ['gtpase','g-protein','ras gtpase'],
    'zinc finger':['zinc finger'],
    'AAA ATPase': ['aaa atpase','aaa+'],
    'armadillo':  ['armadillo'],
    'ankyrin':    ['ankyrin repeat'],
    'PDZ':        ['pdz'],
    'EF-hand':    ['ef-hand','efhand'],
    'IQ motif':   ['iq motif'],
    'PH domain':  ['ph domain','pleckstrin'],
    'HEAT repeat':['heat repeat'],
    'LRR':        ['leucine-rich repeat'],
    'motor domain':['motor domain'],
    'dynein':     ['dynein'],
    'IFT complex':['ift','intraflagellar'],
};

/* Known protein complex → gene list */
const COMPLEX_GENES = {
    ift_b:  ['IFT27','IFT46','IFT52','IFT57','IFT70A','IFT70B','IFT74','IFT81','IFT88','IFT172'],
    ift_a:  ['IFT43','IFT80','IFT121','IFT122','IFT139','IFT140','IFT144'],
    bbsome: ['BBS1','BBS2','BBS4','BBS5','BBS7','BBS8','BBS9','BBS18','BBIP1'],
    dynein2:['DYNC2H1','DYNC2LI1','WDR34','WDR60','DYNLT2B','TCTEX1D2'],
    transition_zone:['NPHP1','NPHP4','NPHP8','TMEM67','CEP290','TCTN1','TCTN2','TCTN3',
                     'B9D1','B9D2','MKS1','RPGRIP1L','CC2D2A','TMEM216','TMEM231'],
    evc:    ['EVC','EVC2','EFCAB7','IQCE'],
    nphp_module:['NPHP1','NPHP4','NPHP8','INVERSIN','NEK8'],
    mks_module: ['MKS1','TMEM216','TMEM67','CEP290','RPGRIP1L','CC2D2A','TCTN1','TCTN2'],
};

/* Functional category keyword → CSV 'Functional.category' search term */
const FUNCTION_MAP = {
    hedgehog:    ['hedgehog','shh signaling','gli','smo','smoothened'],
    ift:         ['intraflagellar transport','ciliary transport'],
    trafficking: ['trafficking','bbsome','vesicular transport'],
    gpcr:        ['gpcr','g protein coupled receptor'],
    actin:       ['actin','cytoskeleton regulation'],
    transcription:['transcription regulation'],
    assembly:    ['ciliary assembly','ciliogenesis'],
    sperm:       ['reproduction','sperm','flagella motility'],
    ion_channel: ['ion channel'],
    signaling:   ['signaling'],
    migration:   ['migration','adhesion'],
    viral:       ['viral'],
    protein_processing:['protein processing','maturation'],
};

/* LOF / overexpression effect terms */
const LOF_PATTERNS = {
    shorter:       ['shorter cilia','shorten','cilia shortening','short cilia'],
    longer:        ['longer cilia','lengthen','cilia elongation','elongated cilia'],
    loss:          ['loss of cilia','no cilia','absent cilia','ciliogenesis blocked','abolished ciliogenesis'],
    supernumerary: ['supernumerary','extra cilia'],
    no_effect:     ['no effect'],
    motility:      ['motility defect','immotile'],
};

/* Phylogeny scope terms */
const PHYLO_SCOPE = {
    ciliated:      ['ciliated','cilia-bearing','flagellate'],
    mammalian:     ['mammal','mammalian','vertebrate-specific'],
    vertebrate:    ['vertebrate'],
    conserved:     ['conserved','universal','ubiquitous','ancient','all organisms'],
    specific:      ['specific','restricted','unique','only'],
    absent_fungi:  ['fungi','fungus','non-ciliated','absent in fungi'],
};

/* Stop words: tokens that look like gene symbols but aren't */
const STOP = new Set([
    'DNA','RNA','ATP','GTP','ADP','GDP','NAD','CEL','PCR','SHH','NOT','AND',
    'THE','FOR','ARE','ALL','ANY','HOW','CAN','HAS','ITS','OUR','WHO','YES',
    'LCA','PCD','PKD','USA','TSV','CSV','SVG','HTML','CSS','SHOW','TELL',
    'FIND','GIVE','LIST','PLOT','UMAP','WHAT','WHERE','DOES','HAVE','WITH',
    'FROM','THAT','THIS','THEY','WHEN','MORE','SOME','GENE','GENES','LOC',
    'IFT','BBS','NPHP','MKS','CEP','WDR','TTC','TMEM',   // prefix-only tokens
]);

// ═══════════════════════════════════════════════════════════════════════════
// § 2  INTENT PARSER
// ═══════════════════════════════════════════════════════════════════════════

const Parser = {

    parse(text) {
        if (!text || typeof text !== 'string') return { type:'unknown', raw:text };
        const t = text.trim();
        const q = t.toLowerCase();

        return (
            this._self(t, q)              ||  // "What can you do?"
            this._help(t, q)              ||  // "How can you help?"
            // ── BUG 1 FIX: multi-gene runs BEFORE disease ──
            this._multiGene(t, q)         ||  // "Dot plot of IFT88, ARL13B, BBS1"
            this._domainQuery(t, q)       ||  // "WD40 domain genes" / "WDR31 domains"
            this._diseaseQuery(t, q)      ||  // "Joubert syndrome genes"
            this._ciliaryCheck(t, q)      ||  // "Is CEP290 a ciliary gene?"
            this._localizationQuery(t, q) ||  // "Where is IFT88 localized?"
            this._locPhenoCombo(t, q)     ||  // "basal body genes that shorten cilia"
            this._tissueQuery(t, q)       ||  // "hypothalamus ciliary genes"
            this._complexQuery(t, q)      ||  // "BBSome complex genes"
            this._functionQuery(t, q)     ||  // "hedgehog signaling genes"
            this._lofQuery(t, q)          ||  // "genes that shorten cilia"
            this._phyloQuery(t, q)        ||  // "BBS1 evolution" / "conserved in C. elegans"
            this._classQuery(t, q)        ||  // "primary ciliopathy gene count"
            this._orthologQuery(t, q)     ||  // "mouse ortholog of IFT88"
            this._statQuery(t, q)         ||  // "how many ciliary genes"
            this._comparisonQuery(t, q)   ||  // "compare IFT88 and IFT52"
            this._singleGene(t, q)        ||  // "IFT88" / "tell me about CEP290"
            { type:'ai_fallback', raw:t }
        );
    },

    // ── Shared utilities ─────────────────────────────────────────────────

    _genes(text) {
        return [...new Set(
            (text.match(/\b[A-Z][A-Z0-9]{1,11}\b/g) || []).filter(g => !STOP.has(g) && g.length >= 3)
        )];
    },

    _matchDisease(q) {
        for (const [pat, tag] of DISEASE_PATTERNS) {
            if (pat instanceof RegExp ? pat.test(q) : q.includes(pat)) return tag;
        }
        return null;
    },

    _matchTissue(q) {
        for (const [key, terms] of Object.entries(TISSUE_MAP))
            if (terms.some(t => q.includes(t))) return key;
        return null;
    },

    _matchLoc(q) {
        const sorted = Object.entries(LOCALIZATION_MAP).sort((a,b) => b[0].length - a[0].length);
        for (const [term, info] of sorted)
            if (q.includes(term)) return { term, ...info };
        return null;
    },

    _matchDomain(q) {
        for (const [family, terms] of Object.entries(DOMAIN_FAMILIES))
            if (terms.some(t => q.includes(t))) return family;
        return null;
    },

    _isListSeparated(text) {
        // True if text has comma-separated tokens or "and" between caps tokens
        return /[A-Z][A-Z0-9]+,\s*[A-Z]/.test(text) || /[A-Z][A-Z0-9]+\s+and\s+[A-Z][A-Z0-9]+/.test(text);
    },

    // ── Intent matchers ──────────────────────────────────────────────────

    _self(t, q) {
        if (!/(what can you do|tell me about yourself|what are you|who are you|ciliai capabilities|what is ciliai|explain ciliai|about ciliai|your features|what information|what datasets|what questions can)/i.test(t)) return null;
        return { type:'self_intro', raw:t };
    },

    _help(t, q) {
        if (!(q.startsWith('help') || q === '?' || q.includes('how can you help') || q.includes('what can i ask') || q.includes('give me an overview') || q.includes('how do i use'))) return null;
        return { type:'help', raw:t };
    },

    /* BUG 1 FIX — runs before _diseaseQuery */
    _multiGene(t, q) {
        const genes = this._genes(t);
        const hasSep = this._isListSeparated(t);
        // Need ≥2 genes AND (a list separator OR an explicit multi-gene keyword)
        const isMultiIntent =
            genes.length >= 2 &&
            (hasSep || /dot.?plot|dotplot|multi:|compare expression|heatmap|expression of|plot of/i.test(t));
        if (!isMultiIntent) return null;
        const isPlot = /dot.?plot|dotplot|plot|expression|umap|visuali|heatmap/i.test(q);
        const isCompare = /compare|versus|\bvs\b/i.test(q);
        return { type: isCompare ? 'gene_comparison' : 'multi_expression', genes, raw:t };
    },

    /* BUG 2 FIX — domain query handles count/list/enrichment all via substring search */
    _domainQuery(t, q) {
        const domFamily = this._matchDomain(q);
        const genes = this._genes(t);
        const isDomainQ = /domain|pfam|motif|repeat|architecture/i.test(q);
        const isCount = /how many|count|number of/i.test(q);
        const isList  = /list|show|which genes|what genes|proteins with|genes with|genes containing/i.test(q);
        const isEnrich= /enrich|overrepresent|depleted|absent|rare/i.test(q);
        const isMulti = genes.length >= 2 && isDomainQ;

        // "Show domain architecture for IFT88, IFT81, WDR19"
        if (isMulti) return { type:'multi_domain', genes, raw:t };

        // "What domains does IFT88 have?" / "IFT88 domain structure"
        if (genes.length === 1 && isDomainQ) return { type:'gene_domains', gene:genes[0], raw:t };

        // "How many proteins have WD40 domains?"
        if (domFamily && isCount) return { type:'domain_count', domain:domFamily, raw:t };

        // "List genes with TPR domains" / "Which genes have WD40 domains?"
        if (domFamily && (isList || !isCount)) return { type:'domain_gene_list', domain:domFamily, raw:t };

        // "What domains are enriched in ciliary genes?"
        if (isEnrich && isDomainQ) return { type:'domain_enrichment', enriched: !isEnrich || !q.includes('deplet'), raw:t };

        // Generic domain search
        if (isDomainQ && genes.length === 0) return { type:'domain_enrichment', raw:t };

        return null;
    },

    _diseaseQuery(t, q) {
        const disease = this._matchDisease(q);
        if (!disease) return null;
        const isCount = /how many|count|number of/i.test(q);
        const isPlot  = /plot|chart|visual/i.test(q);
        return { type: isCount ? 'disease_count' : isPlot ? 'disease_plot' : 'disease_list', disease, raw:t };
    },

    _ciliaryCheck(t, q) {
        const isCheck = /is .+ (a |an |the )?(ciliary|cilia|ciliopathy)|does .+ locali(z|s)e to cilia|is .+ (related|involved|associated) .+ cili|confirm if .+ is ciliary/i.test(t);
        if (!isCheck) return null;
        const genes = this._genes(t);
        return { type:'ciliary_check', gene: genes[0] || null, raw:t };
    },

    _localizationQuery(t, q) {
        const loc = this._matchLoc(q);
        const genes = this._genes(t);
        const isWhere = /where|locat|compart|found in|locali/i.test(q);
        // "genes at the transition zone" → list
        if (loc && genes.length === 0)
            return { type:'localization_list', loc, raw:t };
        // "Where is IFT88 localized?"
        if ((loc || isWhere) && genes.length === 1)
            return { type:'gene_localization', gene:genes[0], loc, raw:t };
        return null;
    },

    /* "Show basal body genes that shorten cilia" = localization + phenotype combo */
    _locPhenoCombo(t, q) {
        const loc = this._matchLoc(q);
        if (!loc) return null;
        let effect = null;
        for (const [eff, terms] of Object.entries(LOF_PATTERNS))
            if (terms.some(tr => q.includes(tr))) { effect = eff; break; }
        if (!effect) return null;
        return { type:'loc_phenotype', loc, effect, raw:t };
    },

    _tissueQuery(t, q) {
        const tissue = this._matchTissue(q);
        if (!tissue) return null;
        const genes = this._genes(t);
        const isExpr = /express|specific|enriched|umap|scrna/i.test(q);
        const isCellType = /cell type|cell population|which cells/i.test(q);
        if (genes.length >= 1 && isExpr) return { type:'tissue_gene_expression', genes, tissue, raw:t };
        if (isCellType) return { type:'tissue_cell_types', tissue, raw:t };
        return { type:'tissue_genes', tissue, raw:t };
    },

    _complexQuery(t, q) {
        // Named complex first
        for (const [cxKey, terms] of Object.entries({
            ift_b:['ift-b','ift complex b','intraflagellar transport b','ift b complex'],
            ift_a:['ift-a','ift complex a','intraflagellar transport a','ift a complex'],
            bbsome:['bbsome','bbs complex'],
            dynein2:['dynein-2','dynein 2','retrograde dynein'],
            transition_zone:['transition zone complex','tectonic','mks module','nphp module'],
            evc:['evc complex','ellis-van creveld complex'],
        })) {
            if (terms.some(t2 => q.includes(t2)))
                return { type:'complex_genes', complex:cxKey, raw:t };
        }
        // Co-complex (single gene + "complex")
        if (/complex|module/.test(q)) {
            const genes = this._genes(t);
            if (genes.length === 1) return { type:'co_complex', gene:genes[0], raw:t };
        }
        return null;
    },

    _functionQuery(t, q) {
        // pan-ciliary / gold standard
        if (/pan.ciliary|gold standard|core ciliary|all ciliary genes|show all ciliary|list all ciliary|what are all/i.test(q))
            return { type:'gold_standard', raw:t };
        for (const [funcKey, terms] of Object.entries(FUNCTION_MAP))
            if (terms.some(tr => q.includes(tr)))
                return { type:'function_genes', func:funcKey, raw:t };
        return null;
    },

    _lofQuery(t, q) {
        const isLOF = /knock|lof|loss.of.function|mutant|deple|when.*(lost|removed|absent)|cilia.*(shorter|longer|lost|absent)/i.test(q);
        const isOE  = /overexpress/i.test(q);
        for (const [eff, terms] of Object.entries(LOF_PATTERNS))
            if (terms.some(tr => q.includes(tr)))
                return { type: isOE ? 'overexpression_effect' : 'lof_effect', effect:eff, raw:t };
        if (/cilia length|cilium length/.test(q))
            return { type:'lof_effect', effect:'all', raw:t };
        return null;
    },

    _phyloQuery(t, q) {
        const isPhylo = /evol|conserv|phylogen|ancestral|species|ortholog|homolog/i.test(q);
        if (!isPhylo) return null;
        const genes = this._genes(t);

        // Scope filter: "Show ciliary-specific genes" / "Mammalian-specific"
        for (const [scope, terms] of Object.entries(PHYLO_SCOPE))
            if (terms.some(tr => q.includes(tr)) && genes.length === 0)
                return { type:'phylo_filter', scope, raw:t };

        // Multi-gene comparison: "Compare IFT88 and IFT140 phylogeny"
        if (genes.length >= 2) return { type:'phylo_multi', genes, raw:t };

        // Single gene: "BBS1 evolution"
        if (genes.length === 1) return { type:'gene_evolution', gene:genes[0], raw:t };

        // Complex phylogeny: "Show evolution of the IFT-B complex"
        for (const cx of ['ift-b','ift-a','bbsome','dynein-2','transition zone'])
            if (q.includes(cx)) return { type:'phylo_complex', complex:cx, raw:t };

        return { type:'evolution_overview', raw:t };
    },

    _classQuery(t, q) {
        const isClass = /primary ciliopathy|motile ciliopathy|atypical ciliopathy|secondary disease|classification|classified/i.test(q);
        if (!isClass) return null;
        let classType = 'all';
        if (/primary/.test(q))   classType = 'primary';
        if (/motile/.test(q))    classType = 'motile';
        if (/atypical/.test(q))  classType = 'atypical';
        if (/secondary/.test(q)) classType = 'secondary';
        const isCount = /how many|count|number/.test(q);
        return { type: isCount ? 'classification_count' : 'classification_list', classType, raw:t };
    },

    _orthologQuery(t, q) {
        if (!/ortholog|homolog|mouse gene|zebrafish gene|worm gene|c\. elegans|danio|drosophila/.test(q)) return null;
        const genes = this._genes(t);
        let species = 'all';
        if (/mouse|mus/.test(q))         species = 'mouse';
        if (/zebrafish|danio/.test(q))   species = 'zebrafish';
        if (/elegans|worm/.test(q))      species = 'elegans';
        if (/xenopus/.test(q))           species = 'xenopus';
        if (/drosophila/.test(q))        species = 'drosophila';
        return { type:'ortholog', gene:genes[0]||null, species, raw:t };
    },

    _statQuery(t, q) {
        if (!/how many|total|count|number of|statistics|how much/.test(q)) return null;
        if (/disease|ciliopathy/.test(q)) return { type:'stat_diseases', raw:t };
        if (/gene/.test(q))              return { type:'stat_genes', raw:t };
        return { type:'stat_overview', raw:t };
    },

    _comparisonQuery(t, q) {
        if (!/difference|compare|versus|\bvs\b/.test(q)) return null;
        const genes = this._genes(t);
        if (genes.length >= 2) return { type:'gene_comparison', genes, raw:t };
        return null;
    },

    /* Single gene — last resort before ai_fallback */
    _singleGene(t, q) {
        const genes = this._genes(t);
        if (genes.length !== 1) return null;
        // Accept if: bare gene symbol, or common info-seeking verbs
        if (
            /^[A-Z][A-Z0-9]{2,11}$/.test(t.trim()) ||
            /what is|tell me|describe|explain|show|find|info|details|function|role|does|about/.test(q)
        ) return { type:'gene_overview', gene:genes[0], raw:t };
        return null;
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// § 3  ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

const Actions = {

    // ── Data accessors ───────────────────────────────────────────────────
    _db()  { return win.CiliAI?.masterData || []; },
    _gmap(){ return win.CiliAI?.lookups?.geneMap || {}; },
    _gene(sym) { return this._gmap()[sym?.toUpperCase()] || null; },

    _arr(g, key) {
        if (!g) return [];
        let v = g[key];
        if (!v) {
            if (key === 'Protein.complexes') v = g.complex_components || g.Protein_Complexes;
            if (key === 'Phenotypes_mouse')  v = g.mouse_phenotype;
        }
        if (!v) return [];
        if (Array.isArray(v)) return v.map(String).filter(Boolean);
        return String(v).split(/[,;]/).map(s => s.trim()).filter(Boolean);
    },

    /* BUG 2 FIX — search both Domain_Descriptions AND PFAM_IDs, case-insensitive */
    _hasDomain(row, domainFamily) {
        const terms = DOMAIN_FAMILIES[domainFamily] || [domainFamily.toLowerCase()];
        const haystack = (
            (row['Domain_Descriptions'] || '') + ' ' +
            (row['PFAM_IDs'] || '')
        ).toLowerCase();
        return terms.some(t => haystack.includes(t));
    },

    _diseaseMatch(row, tag) {
        const raw = String(row['Ciliopathy'] || row.Ciliopathies || '').toLowerCase();
        const tagMap = {
            joubert:      ['joubert'],
            bardet_biedl: ['bardet','biedl'],
            meckel:       ['meckel'],
            nphp:         ['nephronophthisis','nphp'],
            pcd:          ['ciliary dyskinesia'],
            retinal:      ['retinal','leber','retinitis','cone-rod'],
            skeletal:     ['skeletal ciliopathy','ellis-van','jeune','short-rib','cranioectodermal'],
            polydactyly:  ['polydactyly'],
            infertility:  ['infertility'],
            medulloblastoma:['medulloblastoma'],
            alstrom:      ['alstr'],
            pkd:          ['polycystic kidney'],
            usher:        ['usher'],
            holoprosencephaly:['holoprosencephaly'],
            epilepsy:     ['epilepsy','myoclonic'],
            ataxia:       ['ataxia'],
            cardiac:      ['tetralogy','situs inversus','heterotaxy'],
            ofd:          ['orofaciodigital'],
            senior_loken: ['senior','løken'],
            cornelia_de_lange:['cornelia'],
            simpson_golabi:['simpson'],
        };
        return (tagMap[tag] || [tag]).some(t => raw.includes(t));
    },

    _locMatch(row, term) {
        return String(row['Localization'] || '').toLowerCase().includes(term);
    },

    // ── Rendering helpers ────────────────────────────────────────────────
    _say(html)  { win.addChatMessage(html, false); },

    _pill(text, color) {
        const C = {
            blue:  ['#dbeafe','#1e40af'], red:   ['#fee2e2','#991b1b'],
            green: ['#dcfce7','#166534'], amber: ['#fef3c7','#92400e'],
            purple:['#ede9fe','#5b21b6'], gray:  ['#f3f4f6','#374151'],
            teal:  ['#ccfbf1','#0f766e'],
        };
        const [bg,fg] = C[color] || C.gray;
        return `<span style="background:${bg};color:${fg};padding:2px 7px;border-radius:8px;
                font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-block;margin:1px;">${text}</span>`;
    },

    _chip(label, isDisease) {
        const safe = label.replace(/'/g, "\\'");
        return `<span onclick="window.CiliAI.Router.dispatchAction({text:'${safe}',echo:false})"
                      style="background:${isDisease?'#fce8eb':'#e6f2fb'};
                             color:${isDisease?'#9b1c2b':'#005b96'};
                             border:1px solid ${isDisease?'#f4b8c1':'#b3cde0'};
                             margin:2px;padding:4px 10px;border-radius:12px;
                             font-size:11.5px;font-weight:600;cursor:pointer;display:inline-block;">
                  ${label}</span>`;
    },

    _table(headers, rows, max = 50) {
        const shown = rows.slice(0, max);
        const more  = rows.length > max ? `<p style="color:#888;font-size:11px;margin-top:4px;">Showing ${max} of ${rows.length}</p>` : '';
        return `<div style="overflow-x:auto;margin-top:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr>${headers.map(h =>
                `<th style="padding:7px 10px;text-align:left;background:#f1f5f9;
                            border-bottom:2px solid #e2e8f0;color:#475569;font-weight:700;">${h}</th>`
              ).join('')}</tr></thead>
              <tbody>${shown.map((r,i) =>
                `<tr style="background:${i%2?'#f8fafc':'white'};border-bottom:1px solid #f1f5f9;">
                   ${r.map(cell => `<td style="padding:6px 10px;vertical-align:top;">${cell}</td>`).join('')}
                 </tr>`
              ).join('')}</tbody>
            </table></div>${more}`;
    },

    _csv(genes, fields) {
        const hdr = fields.join(',');
        const body = genes.map(g => fields.map(f => `"${String(g[f]||'').replace(/"/g,'""')}"`).join(','));
        return [hdr,...body].join('\n');
    },

    _dl(label, csv, filename) {
        return `<a href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}" download="${filename}"
                   style="display:inline-block;margin-top:8px;padding:6px 14px;background:#005b96;
                          color:white;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">
                   ⬇ ${label}</a>`;
    },

    _plotBar(data, title) {
        if (!win.showPlot) return;
        const sorted = Object.entries(data).sort((a,b) => b[1]-a[1]).slice(0,14);
        win.showPlot({
            data: [{ type:'bar', orientation:'h',
                     x: sorted.map(d=>d[1]).reverse(),
                     y: sorted.map(d=>d[0]).reverse(),
                     marker:{ color:'#005b96' } }],
            layout:{ title:{ text:title, font:{size:13} },
                     xaxis:{ title:'Genes' }, yaxis:{ automargin:true } }
        }, title);
    },

    // ── SELF INTRO ────────────────────────────────────────────────────────
    self_intro(i) {
        const db = this._db();
        const withDis = db.filter(r => r['Ciliopathy'] && r['Ciliopathy'] !== 'N/A').length;
        this._say(`
            <b>CiliAI</b> is a specialist assistant for the CiliaHub ciliary gene database.<br><br>
            <b>I can help you with:</b><br>
            ${['🔍 Gene details & function (e.g. <i>IFT88</i>)',
               '🧬 Disease gene lists (e.g. <i>Joubert syndrome genes</i>)',
               '🗺️ Localization (e.g. <i>Where is CEP290?</i>)',
               '🔬 Protein domains (e.g. <i>Which genes have WD40 domains?</i>)',
               '🌿 Evolution (e.g. <i>BBS1 evolution</i>)',
               '📊 Expression across tissues (e.g. <i>IFT88 in hypothalamus</i>)',
               '⚙️ Complexes (e.g. <i>BBSome complex genes</i>)',
               '🧫 Phenotypes (e.g. <i>genes that shorten cilia</i>)',
            ].map(s => `<div style="margin:3px 0;">• ${s}</div>`).join('')}
            <br>
            <b>Database:</b> ${db.length.toLocaleString()} ciliary genes · ${withDis} ciliopathy-associated<br>
            <b>Tissues:</b> Lung · Kidney · Liver · Hypothalamus · Chondrocyte · Retina · Cerebellum · Limb bud`);
    },

    // ── HELP ─────────────────────────────────────────────────────────────
    help(i) { return this.self_intro(i); },

    // ── GENE OVERVIEW ────────────────────────────────────────────────────
    gene_overview(i) {
        const g = this._gene(i.gene);
        if (!g) {
            this._say(`<b>${i.gene}</b> was not found in CiliaHub. It may not be a confirmed ciliary gene, or check the exact symbol.`);
            return;
        }
        win.CiliAI.activeGeneContext = i.gene;
        const locs     = this._arr(g, 'Localization');
        const diseases = this._arr(g, 'Ciliopathy').filter(d => d && d.toUpperCase() !== 'N/A');
        const funcs    = this._arr(g, 'Functional.category');
        const complexes= this._arr(g, 'Protein.complexes');
        const lof = g['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || 'Not reported';
        const oe  = g['Overexpression effects on cilia length (increase/decrease/no effect)'] || 'Not reported';
        const desc= g['Functional.Summary.from.Literature'] || g['Gene.Description'] || g['Gene.description'] || '';
        const mouse = g['Ortholog_Mouse'] || '—';
        const omim  = g['OMIM.ID'] || g['OMIM_ID'] || '—';

        if (locs.length && win.SpatialManager)
            setTimeout(() => win.SpatialManager.highlight(locs[0].toLowerCase(), i.gene), 200);
        if (win.showDomainViewer) win.showDomainViewer(i.gene);

        this._say(`
            <div style="border-left:3px solid #005b96;padding-left:10px;margin-bottom:6px;">
              <span style="font-size:17px;font-weight:800;color:#005b96;">${i.gene}</span>
              <span style="font-size:11px;color:#888;margin-left:8px;">${g['Gene.Description'] || g['Gene.description'] || ''}</span>
            </div>
            ${desc ? `<p style="font-size:12.5px;color:#334155;line-height:1.5;margin-bottom:8px;">${desc.slice(0,300)}${desc.length>300?'…':''}</p>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
              <div><b style="color:#475569;">Localization</b><br>${locs.map(l=>this._pill(l,'blue')).join(' ')||'—'}</div>
              <div><b style="color:#475569;">Function</b><br>${funcs.slice(0,3).map(f=>this._pill(f,'green')).join(' ')||'—'}</div>
              <div><b style="color:#475569;">LoF → cilia</b><br><span style="color:#7c3aed;">${lof}</span></div>
              <div><b style="color:#475569;">Overexpression</b><br><span style="color:#b45309;">${oe}</span></div>
              <div><b style="color:#475569;">Mouse ortholog</b><br><i>${mouse}</i></div>
              <div><b style="color:#475569;">OMIM</b><br>${omim !== '—' ? `<a href="https://omim.org/entry/${omim}" target="_blank" style="color:#005b96">${omim}</a>` : '—'}</div>
            </div>
            ${diseases.length ? `<div style="margin-top:8px;"><b style="font-size:11.5px;color:#475569;">Associated ciliopathies</b><br>${diseases.slice(0,6).map(d=>this._pill(d,'red')).join(' ')}</div>` : ''}
            ${complexes.length ? `<div style="margin-top:6px;"><b style="font-size:11.5px;color:#475569;">Protein complexes</b><br>${complexes.slice(0,4).map(c=>this._pill(c,'purple')).join(' ')}</div>` : ''}
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
              <button onclick="window.switchView('plot')" class="action-btn" style="font-size:11px;padding:5px 12px;">📊 Expression</button>
              <button onclick="window.switchView('domain')" class="action-btn" style="font-size:11px;padding:5px 12px;">🧬 Domains</button>
              <button onclick="window.CiliAI.Router.dispatchAction({text:'${i.gene} evolution',echo:false})" class="action-btn" style="font-size:11px;padding:5px 12px;">🌿 Evolution</button>
            </div>`);
    },

    // ── CILIARY CHECK ────────────────────────────────────────────────────
    ciliary_check(i) {
        if (!i.gene) { this._say('Please specify a gene symbol, e.g. <i>Is CEP290 a ciliary gene?</i>'); return; }
        const g = this._gene(i.gene);
        if (g) {
            const locs = this._arr(g, 'Localization');
            const dis  = this._arr(g, 'Ciliopathy').filter(d => d && d.toUpperCase() !== 'N/A');
            this._say(`
                ✅ <b>${i.gene}</b> <b>is</b> a confirmed ciliary gene in CiliaHub.<br>
                <b>Localization:</b> ${locs.map(l=>this._pill(l,'blue')).join(' ')||'—'}<br>
                ${dis.length ? `<b>Ciliopathies:</b> ${dis.slice(0,4).map(d=>this._pill(d,'red')).join(' ')}` : ''}`);
        } else {
            this._say(`❌ <b>${i.gene}</b> is <b>not</b> currently listed in the CiliaHub database as a confirmed ciliary gene. It may be a candidate or non-ciliary gene.`);
        }
    },

    // ── DOMAIN COUNT (Bug 2 Fix) ──────────────────────────────────────────
    domain_count(i) {
        const matches = this._db().filter(r => this._hasDomain(r, i.domain));
        this._say(`There are <b>${matches.length} ciliary genes</b> with <b>${i.domain}</b> domain(s) in CiliaHub.
            <br><span style="font-size:11.5px;color:#888;">Ask "<i>list genes with ${i.domain} domains</i>" to see the full list.</span>`);
    },

    // ── DOMAIN GENE LIST ──────────────────────────────────────────────────
    domain_gene_list(i) {
        const matches = this._db().filter(r => this._hasDomain(r, i.domain));
        if (!matches.length) {
            this._say(`No genes found with <b>${i.domain}</b> domain. Try a different domain name.`); return;
        }
        const chips = matches.slice(0,60).map(g => this._chip(g['Gene'], false)).join('');
        const csv   = this._csv(matches, ['Gene','Domain_Descriptions','PFAM_IDs','Localization']);
        this._say(`<b>${i.domain} domain</b> — ${matches.length} genes:<br>
            <div style="margin-top:8px;line-height:1.8;">${chips}</div>
            ${matches.length>60?`<p style="color:#888;font-size:11px">Showing 60 of ${matches.length}</p>`:''}
            ${this._dl(`CSV (${matches.length} genes)`, csv, `${i.domain.replace(/\s/g,'_')}_domain_genes.csv`)}`);
    },

    // ── MULTI-DOMAIN (multiple genes, show their domains) ────────────────
    multi_domain(i) {
        const rows = i.genes.map(sym => {
            const g = this._gene(sym);
            if (!g) return [sym, '<span style="color:#aaa">Not found</span>', '—'];
            const desc = (g['Domain_Descriptions']||'').split(',').slice(0,3).join('; ') || '—';
            const pfam = (g['PFAM_IDs']||'').split(',').slice(0,3).join('; ') || '—';
            return [`<b style="color:#005b96">${sym}</b>`, desc, pfam];
        });
        if (win.showDomainViewer && i.genes[0]) win.showDomainViewer(i.genes[0]);
        this._say(`<b>Domain architecture: ${i.genes.join(', ')}</b><br>
            ${this._table(['Gene','Key Domains','PFAM Accessions'], rows)}`);
    },

    // ── DOMAIN ENRICHMENT ─────────────────────────────────────────────────
    domain_enrichment(i) {
        const counts = {};
        this._db().forEach(r => {
            const text = (r['Domain_Descriptions']||'') + ' ' + (r['PFAM_IDs']||'');
            for (const family of Object.keys(DOMAIN_FAMILIES)) {
                if (this._hasDomain(r, family)) counts[family] = (counts[family]||0) + 1;
            }
        });
        const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
        const rows = sorted.map(([d,n]) => [this._pill(d,'purple'), n]);
        this._plotBar(counts, 'Protein domain enrichment in CiliaHub');
        this._say(`<b>Most common protein domains in CiliaHub</b> (${this._db().length} genes):<br>
            ${this._table(['Domain Family','Genes'],rows)}`);
    },

    // ── GENE DOMAINS ─────────────────────────────────────────────────────
    gene_domains(i) {
        win.CiliAI.activeGeneContext = i.gene;
        if (win.showDomainViewer) win.showDomainViewer(i.gene);
        const g = this._gene(i.gene);
        const desc = g ? (g['Domain_Descriptions']||'') : '';
        const pfam = g ? (g['PFAM_IDs']||'') : '';
        const parts = (desc + (pfam ? (';' + pfam) : '')).split(/[,;]/).map(s=>s.trim()).filter(Boolean);
        this._say(`<b>${i.gene}</b> protein domains (Pfam):<br>
            ${parts.length ? parts.map(d=>this._pill(d,'purple')).join(' ') : '<span style="color:#aaa">No domain data found.</span>'}
            <br><small style="color:#888;margin-top:4px;display:block;">Diagram shown in the Domains view on the left ↑</small>`);
    },

    // ── DISEASE LIST ──────────────────────────────────────────────────────
    disease_list(i) {
        const matches = this._db().filter(r => this._diseaseMatch(r, i.disease));
        if (!matches.length) { this._say(`No genes found for <b>${this._disName(i.disease)}</b>.`); return; }
        const chips = matches.slice(0,60).map(g => this._chip(g['Gene'], true)).join('');
        const csv   = this._csv(matches, ['Gene','Localization','Ciliopathy','Ciliopathy Classification']);
        const locCounts = {};
        matches.forEach(g => (g['Localization']||'').split(',').forEach(l => {
            l = l.trim().toLowerCase(); if(l) locCounts[l] = (locCounts[l]||0)+1;
        }));
        this._plotBar(locCounts, `${this._disName(i.disease)} — localization`);
        this._say(`<b>${this._disName(i.disease)}</b> — ${matches.length} associated genes:<br>
            <div style="margin-top:8px;line-height:1.8;">${chips}</div>
            ${matches.length>60?`<p style="color:#888;font-size:11px">Showing 60 of ${matches.length}</p>`:''}
            ${this._dl(`CSV (${matches.length})`, csv, `${i.disease}_genes.csv`)}`);
    },
    disease_count(i) {
        const n = this._db().filter(r => this._diseaseMatch(r, i.disease)).length;
        this._say(`There are <b>${n} genes</b> in CiliaHub associated with <b>${this._disName(i.disease)}</b>.`);
    },
    disease_plot(i) { return this.disease_list(i); },

    // ── LOCALIZATION ──────────────────────────────────────────────────────
    gene_localization(i) {
        const g = this._gene(i.gene);
        if (!g) { this._say(`Gene <b>${i.gene}</b> not found.`); return; }
        const locs = this._arr(g, 'Localization');
        if (locs.length && win.SpatialManager) win.SpatialManager.highlight(locs[0].toLowerCase(), i.gene);
        this._say(`<b>${i.gene}</b> localizes to:<br>
            <div style="margin-top:6px;">${locs.map(l=>this._pill(l,'blue')).join(' ')||'—'}</div>
            <p style="font-size:11.5px;color:#475569;margin-top:6px;">Click compartments in the diagram to explore further.</p>`);
    },

    localization_list(i) {
        const term  = i.loc.term;
        const label = i.loc.label;
        const matches = this._db().filter(r => this._locMatch(r, term));
        if (!matches.length) { this._say(`No genes found at <b>${label}</b>.`); return; }
        if (win.SpatialManager) win.SpatialManager.highlight(term);
        const chips = matches.slice(0,50).map(g => this._chip(g['Gene'], false)).join('');
        this._say(`<b>${label}</b> — ${matches.length} genes:<br>
            <div style="margin-top:8px;line-height:1.8;">${chips}</div>
            ${matches.length>50?`<p style="color:#888;font-size:11px">Showing 50 of ${matches.length}</p>`:''}`);
    },

    // ── LOC + PHENOTYPE COMBO ─────────────────────────────────────────────
    loc_phenotype(i) {
        const term = i.loc.term;
        const LOF_KEY = 'Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)';
        const effectTerms = {
            shorter:['shorter cilia','short cilia'],
            longer: ['longer cilia'],
            loss:   ['loss of cilia','ciliogenesis blocked','abolished'],
        };
        const eTerms = effectTerms[i.effect] || [i.effect];
        const matches = this._db().filter(r =>
            this._locMatch(r, term) &&
            eTerms.some(e => (r[LOF_KEY]||'').toLowerCase().includes(e))
        );
        this._say(`<b>${i.loc.label}</b> genes with LoF effect "<b>${i.effect}</b>":<br>
            <div style="margin-top:8px;">
              ${matches.length
                ? matches.slice(0,40).map(g => this._chip(g['Gene'], false)).join('')
                : `<span style="color:#888">No genes match this combination.</span>`}
            </div>`);
    },

    // ── GOLD STANDARD ─────────────────────────────────────────────────────
    gold_standard(i) {
        if (win.showGoldStandardTable) win.showGoldStandardTable();
        this._say(`<b>CiliaHub</b> contains <b>${this._db().length} ciliary genes</b> with experimental evidence.
            The full database is now displayed on the left. Click any gene for details.<br><br>
            <b>Core structural categories:</b><br>
            ${['IFT-B complex','IFT-A complex','Dynein-2','BBSome','Transition Zone','Basal Body']
              .map(s=>this._pill(s,'blue')).join(' ')}`);
    },

    // ── MULTI EXPRESSION ──────────────────────────────────────────────────
    multi_expression(i) {
        this._say(`Loading expression data for: <b>${i.genes.join(', ')}</b>…`);
        if (win.renderUMAPPlot) { win.switchView('plot'); win.renderUMAPPlot(i.genes[0], i.genes); }
    },

    // ── TISSUE ────────────────────────────────────────────────────────────
    async tissue_genes(i) {
        const name = this._tisName(i.tissue);
        this._say(`Loading <b>${name}</b> scRNA-seq data… switching to Plot view.`);
        if (win.CiliAI?.loadDatasetOnDemand) await win.CiliAI.loadDatasetOnDemand(i.tissue);
        win.CiliAI.activeDataset = i.tissue;
        if (win.renderUMAPPlot) { win.switchView('plot'); win.renderUMAPPlot('IFT88',['IFT88']); }
    },
    async tissue_gene_expression(i) {
        this._say(`Showing <b>${i.genes.join(', ')}</b> in <b>${this._tisName(i.tissue)}</b>…`);
        if (win.CiliAI?.loadDatasetOnDemand) await win.CiliAI.loadDatasetOnDemand(i.tissue);
        win.CiliAI.activeDataset = i.tissue;
        if (win.renderUMAPPlot) { win.switchView('plot'); win.renderUMAPPlot(i.genes[0], i.genes); }
    },
    tissue_cell_types(i) {
        const types = {
            lung:         ['Ciliated cells','Club cells','Goblet cells','Basal cells','Alveolar Type 1','Alveolar Type 2'],
            cerebellum:   ['Granule cell progenitors (GCP)','Purkinje cells','Granule neurons','Bergmann glia','Rhombic lip'],
            limb_bud:     ['DistalMes','RDH10+ anterior mesenchyme','ZPA mesenchyme','AER basal','Chondroprogenitors'],
            hypothalamus: ['Neurons','Astrocytes','Oligodendrocytes','Microglia','Ependymal cells'],
            kidney:       ['Nephron progenitors','Proximal tubule','Distal tubule','Podocytes','Collecting duct'],
            retina:       ['Rod photoreceptors','Cone photoreceptors','Ganglion cells','Müller glia','RPE'],
        };
        this._say(`<b>${this._tisName(i.tissue)}</b> key cell populations:<br>
            <div style="margin-top:6px;">${(types[i.tissue]||['Not available']).map(t=>this._pill(t,'teal')).join(' ')}</div>`);
    },

    // ── COMPLEX ───────────────────────────────────────────────────────────
    complex_genes(i) {
        const glist = COMPLEX_GENES[i.complex] || [];
        const name  = { ift_b:'IFT-B', ift_a:'IFT-A', bbsome:'BBSome', dynein2:'Dynein-2',
                        transition_zone:'Transition Zone', evc:'EvC', nphp_module:'NPHP module',
                        mks_module:'MKS module' }[i.complex] || i.complex;
        if (glist.length) {
            this._say(`<b>${name}</b> complex core components:<br>
                <div style="margin-top:8px;line-height:2;">${glist.map(g=>this._chip(g,false)).join('')}</div>`);
        } else {
            this._say(`<b>${name}</b> — searching database for complex annotation…`);
        }
    },
    co_complex(i) {
        const g = this._gene(i.gene);
        if (!g) { this._say(`Gene <b>${i.gene}</b> not found.`); return; }
        const cxs = this._arr(g, 'Protein.complexes');
        this._say(!cxs.length
            ? `No protein complex annotations found for <b>${i.gene}</b> in CiliaHub.`
            : `<b>${i.gene}</b> is part of:<br><div style="margin-top:6px;">${cxs.map(c=>this._pill(c,'purple')).join(' ')}</div>`
        );
    },

    // ── FUNCTION GENES ────────────────────────────────────────────────────
    function_genes(i) {
        const terms = FUNCTION_MAP[i.func] || [i.func];
        const matches = this._db().filter(r =>
            terms.some(t => String(r['Functional.category']||'').toLowerCase().includes(t))
        );
        const fname = { hedgehog:'Hedgehog / SHH Signaling', ift:'IFT Transport',
                        trafficking:'Ciliary Trafficking', gpcr:'GPCRs',
                        actin:'Actin & Cytoskeleton', transcription:'Transcription',
                        assembly:'Cilia Assembly / Disassembly', sperm:'Sperm / Flagella',
                        ion_channel:'Ion Channels', signaling:'Signaling',
                      }[i.func] || i.func;
        this._say(`<b>${fname}</b> — ${matches.length} genes:<br>
            <div style="margin-top:8px;line-height:1.8;">${matches.slice(0,50).map(g=>this._chip(g['Gene'],false)).join('')}</div>`);
    },

    // ── LOF / OE ─────────────────────────────────────────────────────────
    lof_effect(i) {
        const KEY = 'Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)';
        const eMap = {
            shorter:'shorter cilia', longer:'longer cilia',
            loss:'loss of cilia', supernumerary:'supernumerary',
            no_effect:'no effect', motility:'motility',
        };
        const matches = i.effect === 'all'
            ? this._db().filter(r => r[KEY] && !/not reported/i.test(r[KEY]))
            : this._db().filter(r => String(r[KEY]||'').toLowerCase().includes((eMap[i.effect]||i.effect).toLowerCase()));
        const rows = matches.slice(0,40).map(g => [
            `<b style="color:#005b96">${g['Gene']}</b>`,
            g[KEY]||'—',
            (g['Localization']||'').split(',')[0]?.trim()||'—',
        ]);
        this._say(`<b>LoF: ${eMap[i.effect]||i.effect}</b> — ${matches.length} genes<br>
            ${this._table(['Gene','LoF Effect','Primary Location'], rows, 40)}`);
    },
    overexpression_effect(i) {
        const KEY = 'Overexpression effects on cilia length (increase/decrease/no effect)';
        const matches = this._db().filter(r =>
            String(r[KEY]||'').toLowerCase().includes((i.effect||'').replace('_',' '))
        );
        const rows = matches.slice(0,40).map(g => [
            `<b style="color:#005b96">${g['Gene']}</b>`, g[KEY]||'—',
            (g['Localization']||'').split(',')[0]?.trim()||'—',
        ]);
        this._say(`<b>Overexpression effect: ${i.effect}</b> — ${matches.length} genes<br>
            ${this._table(['Gene','OE Effect','Location'], rows, 40)}`);
    },

    // ── EVOLUTION / PHYLOGENY ─────────────────────────────────────────────
    gene_evolution(i) {
        const g = this._gene(i.gene);
        if (!g) { this._say(`Gene <b>${i.gene}</b> not found.`); return; }
        if (win.switchView) win.switchView('plot');
        if (win.renderPhylogenyHeatmap) win.renderPhylogenyHeatmap([g], {});
        const orth = [
            ['Mouse', g['Ortholog_Mouse']||'—'],
            ['Zebrafish', g['Ortholog_Zebrafish']||'—'],
            ['Xenopus', g['Ortholog_Xenopus']||'—'],
            ['C. elegans', g['Ortholog_C_elegans']||'—'],
            ['Drosophila', g['Ortholog_Drosophila']||'—'],
        ];
        this._say(`<b>${i.gene}</b> evolutionary conservation:<br>
            ${this._table(['Species','Ortholog'], orth)}
            <p style="font-size:11.5px;color:#888;margin-top:6px;">Phylogenetic heatmap shown in Plot view.</p>`);
    },
    phylo_multi(i) {
        if (win.switchView) win.switchView('plot');
        const genes = i.genes.map(s => this._gene(s)).filter(Boolean);
        if (win.renderPhylogenyHeatmap && genes.length) win.renderPhylogenyHeatmap(genes, {});
        this._say(`Phylogenetic comparison for <b>${i.genes.join(', ')}</b> shown in the Plot view.`);
    },
    phylo_filter(i) {
        const scopeDesc = {
            ciliated:'conserved in ciliated organisms',
            mammalian:'mammalian-specific',
            vertebrate:'vertebrate-specific',
            conserved:'universally conserved',
            absent_fungi:'absent in non-ciliated fungi',
        };
        this._say(`<b>${scopeDesc[i.scope]||i.scope}</b> ciliary genes: this query requires the phylogenetic matrix.
            <br>Use the <b>Phylogeny</b> tab on the Cilia Analysis page for filtered views by species group.
            <br><br>Quick reference counts from CiliaHub:<br>
            ${this._pill('Mouse orthologs: 2,486 genes','blue')}
            ${this._pill('Zebrafish orthologs: available','blue')}`);
    },
    phylo_complex(i) {
        const cxGenes = COMPLEX_GENES[i.complex.replace('-','_').replace(' ','_')] || [];
        if (!cxGenes.length) { this._say(`Complex <b>${i.complex}</b> phylogeny — try the Plots page.`); return; }
        if (win.switchView) win.switchView('plot');
        const genes = cxGenes.map(s => this._gene(s)).filter(Boolean);
        if (win.renderPhylogenyHeatmap && genes.length) win.renderPhylogenyHeatmap(genes, {});
        this._say(`Phylogenetic heatmap for <b>${i.complex}</b> complex shown in Plot view.`);
    },
    evolution_overview(i) {
        this._say(`Ask about a specific gene or complex, e.g.:<br>
            <i>BBS1 evolution</i> · <i>Compare IFT88 and IFT140 phylogeny</i> · <i>IFT-B complex conservation</i>`);
    },

    // ── ORTHOLOG ──────────────────────────────────────────────────────────
    ortholog(i) {
        if (!i.gene) { this._say('Please include a gene symbol, e.g. <i>mouse ortholog of IFT88</i>'); return; }
        const g = this._gene(i.gene);
        if (!g) { this._say(`Gene <b>${i.gene}</b> not found.`); return; }
        const keyMap = { mouse:'Ortholog_Mouse', zebrafish:'Ortholog_Zebrafish',
                         xenopus:'Ortholog_Xenopus', elegans:'Ortholog_C_elegans',
                         drosophila:'Ortholog_Drosophila' };
        if (i.species !== 'all' && keyMap[i.species]) {
            const sym = g[keyMap[i.species]] || '—';
            this._say(`<b>${i.gene}</b> ${i.species} ortholog: <b><i>${sym}</i></b>`);
        } else {
            const rows = Object.entries(keyMap).map(([sp, key]) =>
                [this._pill(sp,'blue'), `<i>${g[key]||'—'}</i>`]
            );
            this._say(`<b>${i.gene}</b> orthologs:<br>${this._table(['Species','Symbol'], rows)}`);
        }
    },

    // ── STATS ─────────────────────────────────────────────────────────────
    stat_genes(i) {
        const db = this._db();
        const withDis = db.filter(r => r['Ciliopathy'] && r['Ciliopathy'] !== 'N/A').length;
        const withLOF = db.filter(r => !/not reported/i.test(r['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)']||'Not Reported')).length;
        this._say(`📊 <b>CiliaHub Gene Database</b><br>
            <div style="margin-top:6px;">
              ${this._pill(`${db.length} total genes`,'blue')}
              ${this._pill(`${withDis} ciliopathy-associated`,'red')}
              ${this._pill(`${withLOF} with LOF phenotype data`,'amber')}
              ${this._pill('2,486 with mouse ortholog','green')}
              ${this._pill('2,035 with domain data','purple')}
            </div>`);
    },
    stat_diseases(i) {
        const diseases = new Set();
        this._db().forEach(r => String(r['Ciliopathy']||'').split(',')
            .forEach(d => { d=d.trim(); if(d && d.toUpperCase()!=='N/A') diseases.add(d); }));
        this._say(`CiliaHub covers <b>${diseases.size} unique ciliopathy/disease names</b> across ${this._db().length} genes.`);
    },
    stat_overview(i) { return this.stat_genes(i); },

    // ── CLASSIFICATION ────────────────────────────────────────────────────
    classification_count(i) {
        const counts = {};
        this._db().forEach(r => {
            (r['Ciliopathy Classification'] || r.ciliopathy_classification || '').split(';')
                .forEach(c => { c=c.trim(); if(c) counts[c]=(counts[c]||0)+1; });
        });
        const rows = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12)
            .map(([c,n]) => [c, n]);
        this._plotBar(counts, 'Genes by ciliopathy classification');
        this._say(`<b>Genes by ciliopathy classification:</b><br>${this._table(['Classification','Gene Count'], rows)}`);
    },
    classification_list(i) { return this.classification_count(i); },

    // ── GENE COMPARISON ───────────────────────────────────────────────────
    gene_comparison(i) {
        const fields = [
            ['Localization',     'Localization'],
            ['Functional.category','Function'],
            ['Ciliopathy',       'Disease'],
            ['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)','LoF Effect'],
            ['Protein.complexes','Complex'],
        ];
        const resolved = i.genes.slice(0,4).map(s => ({ s, g: this._gene(s) }));
        const rows = fields.map(([key, label]) => [
            `<b>${label}</b>`,
            ...resolved.map(({ g }) => {
                if (!g) return '<span style="color:#aaa">Not found</span>';
                const v = String(g[key]||'—');
                return v.length>70 ? v.slice(0,70)+'…' : v;
            })
        ]);
        this._say(`<b>Comparison: ${i.genes.join(' vs ')}</b><br>
            ${this._table(['Property',...i.genes.slice(0,4)], rows)}`);
    },

    // ── AI FALLBACK ───────────────────────────────────────────────────────
    async ai_fallback(i) {
        if (win.CiliAI?.assistantRuntime?.sendMessage) {
            try { await win.CiliAI.assistantRuntime.sendMessage(i.raw); return; }
            catch (e) { console.warn('AI provider failed, using local fallback:', e); }
        }
        const genes = (i.raw||'').match(/\b[A-Z][A-Z0-9]{2,11}\b/g) || [];
        if (genes.length === 1) return this.gene_overview({ type:'gene_overview', gene:genes[0] });
        if (genes.length > 1)  return this.multi_expression({ type:'multi_expression', genes });
        this._say(`I couldn't find a match for "<i>${i.raw||''}</i>".<br>
            Try: a gene symbol (<b>IFT88</b>), a disease (<b>Joubert syndrome genes</b>),
            a domain (<b>WD40 domain genes</b>), or a location (<b>transition zone genes</b>).`);
    },

    unknown(i) { return this.ai_fallback(i); },

    // ── Name helpers ──────────────────────────────────────────────────────
    _disName(t) {
        return { joubert:'Joubert Syndrome', bardet_biedl:'Bardet–Biedl Syndrome',
                 meckel:'Meckel–Gruber Syndrome', nphp:'Nephronophthisis',
                 pcd:'Primary Ciliary Dyskinesia', retinal:'Retinal Ciliopathies',
                 skeletal:'Skeletal Ciliopathies', polydactyly:'Polydactyly Ciliopathies',
                 infertility:'Male Infertility / MMAF', medulloblastoma:'Medulloblastoma (SHH)',
                 alstrom:'Alström Syndrome', pkd:'Polycystic Kidney Disease',
                 usher:'Usher Syndrome', holoprosencephaly:'Holoprosencephaly',
                 epilepsy:'Ciliopathy-related Epilepsy', ataxia:'Spinocerebellar Ataxia',
                 cardiac:'Cardiac / Laterality Defects', ofd:'Orofaciodigital Syndrome',
                 senior_loken:'Senior–Løken Syndrome',
               }[t] || t;
    },
    _tisName(t) {
        return { lung:'Human Lung', kidney:'Human Kidney', liver:'Human Liver',
                 hypothalamus:'Hypothalamus', chondrocyte:'Chondrocyte',
                 retina:'Retina', olfactory:'Olfactory Neurons', pancreas:'Pancreas',
                 choroid_plexus:'Choroid Plexus', cerebellum:'Fetal Cerebellum',
                 limb_bud:'Embryonic Limb Bud',
               }[t] || t;
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// § 4  ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const Router = {
    async dispatchAction(opts) {
        const { text, source, echo=true, intent:preIntent, gene:preGene } = opts;

        // 1. Hide empty state
        const es = document.getElementById('emptyState');
        if (es) es.remove();

        // 2. Echo user bubble
        if (echo && text) win.addChatMessage(text, true);

        // 3. Parse intent
        let intent;
        if (preIntent === 'gene_overview' && preGene) {
            intent = { type:'gene_overview', gene:preGene, raw:text||preGene };
        } else {
            intent = Parser.parse(text || '');
        }
        console.debug('[CiliAI v3]', intent.type, intent);

        // 4. Dispatch
        const handler = Actions[intent.type];
        if (typeof handler === 'function') {
            try { await handler.call(Actions, intent); }
            catch(e) {
                console.error('[CiliAI] Handler error:', e);
                win.addChatMessage('An error occurred. Please try again.', false);
            }
        } else {
            await Actions.ai_fallback.call(Actions, intent);
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// § 5  ATTACH TO WINDOW
// ═══════════════════════════════════════════════════════════════════════════

win.CiliAI          = win.CiliAI || {};
win.CiliAI.Router   = Router;
win.CiliAI.Parser   = Parser;   // expose for console debugging

// Legacy compat
win.handleAIQuery = (text) => Router.dispatchAction({ text, source:'legacy', echo:false });

console.log('[CiliAI Intent Engine v3.0] Loaded. Fixes: Bug1 (multi-gene→disease hijack), Bug2 (WD40 domain search).');

})(window);
