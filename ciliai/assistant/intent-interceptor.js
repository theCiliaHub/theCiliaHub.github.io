/**
 * CiliAI Intent Interceptor v4.0 — Multi-Gene Comparison · Compartment Reasoning · AI Hypothesis Generator
 *
 * NEW in v4.0:
 *  H. multi_gene_compare — side-by-side structural comparison of 2+ genes:
 *       shared localization, shared complexes, shared ciliopathies, phenotype diff,
 *       domain overlap, conservation badges, direct Expression Atlas jump.
 *       Triggered by: "Compare BBS1 and CEP290", "BBS1 vs IFT88", "BBS1 CEP290 comparison"
 *
 *  I. compartment_reasoning — biologically interprets all genes in a compartment:
 *       phenotype distribution pie summary, disease enrichment, conservation profile,
 *       IFT/complex membership, and a one-sentence biological interpretation.
 *       Triggered by: "Transition zone biology", "What do basal body genes do?",
 *                     "Axoneme gene phenotypes", "Ciliary tip compartment"
 *
 *  J. hypothesis_generator — ranks candidate genes by similarity to a query gene:
 *       scores localization overlap + phenotype match + conservation class + domain overlap.
 *       Triggered by: "Genes similar to BBS1", "New ciliopathy candidates like CEP290",
 *                     "What genes are functionally related to IFT88?"
 *
 * Previous architecture retained (v3.1):
 *  Specificity-First parsing, Controller-Renderer Bridge, applyUnifiedHighlight,
 *  Expression Atlas button, normToCanonical, renderEnsemblLinks,
 *  oe_lof_combo, oe_filter, lof_filter, loc_disease_tissue, matchTissueKw,
 *  pfam_filter + Li2014 scoping, phylo_domain, complex_phylo_compare.
 *
 * Install: ONE script tag AFTER ciliai.js in index.html
 *   <script src="./ciliai/ciliai.js"></script>
 *   <script src="./ciliai/assistant/intent-interceptor.js"></script>
 */
'use strict';
(function (win) {

/* ─── FIELD KEY LISTS ─────────────────────────────────────────────────────── */
var LOF_KEYS = [
    'Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)',
    'lof_effects', 'LoF_effects', 'lof_effect'
];
var OE_KEYS  = ['Overexpression effects on cilia length (increase/decrease/no effect)', 'overexpression_effects',
                'Overexpression effects on cilia length or ciliogenesis'];
var PCT_KEYS = ['Percentage of ciliated cells (increase/decrease/no effect)', 'percent_ciliated_cells_effects'];

/* ─── DOMAIN VOCABULARY ───────────────────────────────────────────────────── */
var DOMAIN_TERMS = {
    'WD40':        ['wd40','wd repeat','wd40/yvtn'],
    'TPR':         ['tpr','tetratricopeptide'],
    'coiled-coil': ['coiled-coil','coiled coil'],
    'kinase':      ['kinase'],
    'kinesin':     ['kinesin'],
    'GTPase':      ['gtpase'],
    'zinc finger': ['zinc finger'],
    'AAA ATPase':  ['aaa atpase','aaa+'],
    'armadillo':   ['armadillo'],
    'EF-hand':     ['ef-hand'],
    'LRR':         ['leucine-rich repeat'],
    'motor domain':['motor domain'],
    'dynein':      ['dynein']
};

/* ─── COMPLEX MEMBERSHIP SETS ─────────────────────────────────────────────── */
var COMPLEX_SETS = {
    ift_b: ['IFT22','IFT25','IFT27','IFT46','IFT52','IFT56','IFT57',
             'IFT70A','IFT70B','IFT74','IFT81','IFT88','IFT172',
             'CLUAP1','IFT20','TRAF3IP1'],
    ift_a: ['IFT43','IFT80','IFT121','IFT122','IFT139','IFT140',
             'IFT144','WDR19','WDR35','TTC21B'],
    bbsome: ['BBS1','BBS2','BBS4','BBS5','BBS7','BBS8','BBS9',
              'BBS18','BBIP1','TTC8','LZTFL1'],
    mks_module: ['MKS1','TMEM216','TMEM67','CEP290','RPGRIP1L',
                  'CC2D2A','TCTN1','TCTN2','TCTN3','B9D1','B9D2',
                  'TMEM231','TMEM107','TMEM237','TMEM17','TMEM138',
                  'TMEM218','TMEM252'],
    nphp_module: ['NPHP1','NPHP3','NPHP4','NPHP5','NPHP8',
                   'RPGRIP1L','IQCB1','CEP290','SDCCAG8','INVERSIN','NEK8'],
    dynein2: ['DYNC2H1','DYNC2LI1','WDR34','WDR60','DYNLT2B','TCTEX1D2'],
    transition_zone: ['NPHP1','NPHP4','MKS1','CEP290','TCTN1','TCTN2',
                       'TCTN3','B9D1','B9D2','TMEM67','CC2D2A','RPGRIP1L',
                       'TMEM216','TMEM231','AHI1','CSPP1']
};

/* ─── LI ET AL 2014 PHYLOGENY CACHE ──────────────────────────────────────── */
/*
 * The Li2014 matrix encodes each gene's evolutionary profile as:
 *   { g: "SYMBOL", e: "entrezId", s: [speciesIndices], c: classIndex }
 * class_list = ["No_data","Ciliary_specific","Mammalian_specific",
 *               "Vertebrate_specific","Cilia_related","Other"]
 * So c === 3  →  Vertebrate_specific
 *    c === 2  →  Mammalian_specific
 *    c === 1  →  Ciliary_specific
 *
 * Vertebrate species occupy indices 126-139 in organisms_list.
 */
var LI2014_URL = 'https://raw.githubusercontent.com/theCiliaHub/theCiliaHub.github.io/' +
                 'refs/heads/main/data/phylogeny/li_et_al_2014_matrix_optimized.json';

var _li2014 = null;            // null = not loaded; false = load failed; object = loaded
var _li2014Loading = false;
var _li2014BySymbol = null;    // Map: SYMBOL → gene entry  (populated on load)

/* Li2014 class indices */
var LI_CLASS = { NO_DATA:0, CILIARY_SPECIFIC:1, MAMMALIAN_SPECIFIC:2, VERTEBRATE_SPECIFIC:3, CILIA_RELATED:4, OTHER:5 };
/* Vertebrate species indices in the Li2014 organisms_list (126-139 = D.rerio → H.sapiens) */
var LI_VERT_MIN = 126;
var LI_VERT_MAX = 139;

function loadLi2014(callback) {
    if (_li2014 !== null) { if (callback) callback(_li2014BySymbol); return; }
    if (_li2014Loading) { setTimeout(function(){ loadLi2014(callback); }, 300); return; }
    _li2014Loading = true;
    fetch(LI2014_URL)
        .then(function(r){ return r.json(); })
        .then(function(data){
            _li2014 = data;
            _li2014BySymbol = {};
            var genes = data.genes || {};
            Object.keys(genes).forEach(function(eid){
                var g = genes[eid];
                if (g.g) _li2014BySymbol[g.g.toUpperCase()] = g;
            });
            _li2014Loading = false;
            console.log('[CiliAI Interceptor] Li2014 loaded: ' + Object.keys(_li2014BySymbol).length + ' genes');
            if (callback) callback(_li2014BySymbol);
        })
        .catch(function(e){
            _li2014 = false;
            _li2014Loading = false;
            console.warn('[CiliAI Interceptor] Li2014 load failed:', e.message);
            if (callback) callback(null);
        });
}

/* ─── LI2014 QUERY HELPERS ────────────────────────────────────────────────── */

/**
 * isVertebrate(geneSymbol) — returns true only if the gene's species indices
 * in the Li2014 matrix are ALL within the vertebrate range (126-139).
 * This is the definitive "vertebrate-specific" check.
 */
function isVertebrateSpecific(sym) {
    if (!_li2014BySymbol) return false;
    var entry = _li2014BySymbol[sym.toUpperCase()];
    if (!entry || !entry.s || !entry.s.length) return false;
    // Use the pre-computed class label when available (c === 3 = Vertebrate_specific)
    if (entry.c === LI_CLASS.VERTEBRATE_SPECIFIC) return true;
    // Also accept genes whose species are entirely within vertebrate indices
    for (var i = 0; i < entry.s.length; i++) {
        if (entry.s[i] < LI_VERT_MIN || entry.s[i] > LI_VERT_MAX) return false;
    }
    return true;
}

function isMammalianSpecific(sym) {
    if (!_li2014BySymbol) return false;
    var entry = _li2014BySymbol[sym.toUpperCase()];
    if (!entry) return false;
    return entry.c === LI_CLASS.MAMMALIAN_SPECIFIC;
}

function isCiliarySpecific(sym) {
    if (!_li2014BySymbol) return false;
    var entry = _li2014BySymbol[sym.toUpperCase()];
    if (!entry) return false;
    return entry.c === LI_CLASS.CILIARY_SPECIFIC;
}

function getPhyloClass(sym) {
    if (!_li2014BySymbol) return null;
    var entry = _li2014BySymbol[sym.toUpperCase()];
    if (!entry) return null;
    var names = ['No data','Ciliary-specific','Mammalian-specific','Vertebrate-specific','Cilia-related','Other'];
    return names[entry.c] || 'Unknown';
}

/* ─── DATA HELPERS ────────────────────────────────────────────────────────── */
function db()   { return (win.CiliAI && win.CiliAI.masterData) ? win.CiliAI.masterData : []; }
function gmap() { return (win.CiliAI && win.CiliAI.lookups && win.CiliAI.lookups.geneMap) || {}; }
function getField(row, keys) {
    for (var i = 0; i < keys.length; i++) {
        var v = row[keys[i]];
        if (v && typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
}
function getLOF(row) { return getField(row, LOF_KEYS); }
function getOE(row)  { return getField(row, OE_KEYS); }
function getPCT(row) { return getField(row, PCT_KEYS); }
function getLoc(row) { return ((row['Localization'] || row['localization'] || '')).toLowerCase(); }

function lofMatches(row, effect) {
    var v = getLOF(row).toLowerCase();
    if (!v || v.indexOf('not reported') !== -1) return false;
    if (effect === 'shorter')   return /shorter|short.cilia|short.cilium/.test(v);
    if (effect === 'longer')    return /longer|elongat/.test(v);
    if (effect === 'loss')      return /loss.of.cilia|no.cilia|blocked|abolished/.test(v);
    /* "no_effect" = no change in cilia LENGTH — matches "no effect", "no change", variants */
    if (effect === 'no_effect') return /no[_ ]effect|no.change.in.cilia|no.change.cilia|no.cilia.length.change|unchanged/.test(v.trim());
    if (effect === 'motility')  return /motility/.test(v);
    if (effect === 'knockdown') return true;
    return v.indexOf(effect.toLowerCase()) !== -1;
}

function diseaseMatches(row, tag) {
    var raw = ((row['Ciliopathy'] || '') + ' ' + (row['Ciliopathies'] || '')).toLowerCase();
    var terms = {
        joubert:['joubert'], bardet_biedl:['bardet','biedl'], pcd:['ciliary dyskinesia'],
        meckel:['meckel'], nphp:['nephronophthisis','nphp'],
        retinal:['retinal','leber','retinitis','cone-rod'],
        skeletal:['skeletal ciliopathy','ellis-van','jeune','short-rib'],
        infertility:['infertility'], polydactyly:['polydactyly'],
        medulloblastoma:['medulloblastoma'], usher:['usher'],
        holoprosencephaly:['holoprosencephaly'], pkd:['polycystic kidney'], alstrom:['alstr']
    };
    var tlist = terms[tag] || [tag];
    for (var i = 0; i < tlist.length; i++) { if (raw.indexOf(tlist[i]) !== -1) return true; }
    return false;
}

function hasDomain(row, family) {
    var h = ((row['Domain_Descriptions'] || '') + ' ' + (row['PFAM_IDs'] || '')).toLowerCase();
    var terms = DOMAIN_TERMS[family] || [family.toLowerCase()];
    for (var i = 0; i < terms.length; i++) { if (h.indexOf(terms[i]) !== -1) return true; }
    return false;
}

/**
 * FIX #3 — exact PFAM accession matching.
 * Uses word-boundary regex to prevent "PF1343" matching inside "PF13432".
 * Checks both PFAM_IDs field and Domain_Descriptions field.
 */
function hasPfam(row, pfamId) {
    var combined = (row['PFAM_IDs'] || '') + ' ' + (row['Domain_Descriptions'] || '');
    // Word-boundary regex ensures exact token match, not substring
    var re = new RegExp('\\b' + pfamId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '\\b', 'i');
    return re.test(combined);
}

function inComplex(gene, key) { return (COMPLEX_SETS[key] || []).indexOf(gene) !== -1; }

/* ─── PHYLO CONTEXT — stores last comparison for "yes"/"show it" follow-ups ─ */
var _lastPhyloGenes = null;
var _lastPhyloNames = null;

function renderPhyloPlot(geneSymbols) {
    if (!geneSymbols || !geneSymbols.length) return false;
    if (typeof win.switchView === 'function') win.switchView('diagram');
    if (typeof win.getPhylogenyAnalysis === 'function') {
        try { win.getPhylogenyAnalysis(geneSymbols); return true; } catch(e) {}
    }
    if (typeof win.routePhylogenyAnalysis === 'function') {
        try { win.routePhylogenyAnalysis('Evolutionary profile: ' + geneSymbols.join(', ')); return true; } catch(e) {}
    }
    if (typeof win.handlePhylogenyVisualizationQuery === 'function') {
        try { win.handlePhylogenyVisualizationQuery(geneSymbols[0], 'nevers', 'heatmap'); return true; } catch(e) {}
    }
    if (win.CiliAI && win.CiliAI.Router && typeof win.CiliAI.Router.dispatchAction === 'function') {
        _suppressing = false;
        try {
            var orig = win.CiliAI.Router.dispatchAction.__originalFn;
            if (orig) orig({text:'Show evolution of '+geneSymbols.join(', '), echo:false});
        } catch(e) {}
    }
    return false;
}

/* ─── SUPPRESSION — blocks ciliai.js from appending its own answer ─────────
 * After the interceptor renders a response, we suppress ciliai.js's own async
 * AI response for a window long enough to cover network round-trips (~1800ms).
 * This is shorter than the previous 2500ms to avoid blocking legitimate
 * follow-on messages from ciliai-enhancements.js patches.
 * stopSuppression() can be called explicitly to end early (e.g. by patches).
 */
var _suppressing = false;
var _suppressTimer = null;
function startSuppression() {
    _suppressing = true;
    if (_suppressTimer) clearTimeout(_suppressTimer);
    _suppressTimer = setTimeout(function() { _suppressing = false; _suppressTimer = null; }, 1800);
}
function stopSuppression() {
    _suppressing = false;
    if (_suppressTimer) { clearTimeout(_suppressTimer); _suppressTimer = null; }
}

/* ─── INTENT KEYWORD MATCHERS ─────────────────────────────────────────────── */
var STOP = {
    'DNA':1,'RNA':1,'AND':1,'THE':1,'FOR':1,'ARE':1,'ALL':1,'ANY':1,
    'SHOW':1,'TELL':1,'LIST':1,'PLOT':1,'FROM':1,'WHAT':1,'WHERE':1,
    'DOES':1,'HAVE':1,'FIND':1,'GENE':1,'GENES':1,'WITH':1,'ALSO':1,
    'BOTH':1,'ONLY':1,'WHEN':1,'BEEN':1,'THAN':1,'THAT':1,'THIS':1,
    'WHICH':1,'THESE':1,'SOME':1,'MORE':1,'MANY':1,'MUCH':1,'MOST':1,
    'CAUSE':1,'CAUSES':1,'EFFECT':1,'EFFECTS':1
};

function extractGenes(text) {
    var found = {}, result = [];
    var matches = text.match(/\b[A-Z][A-Z0-9]{1,11}\b/g) || [];
    for (var i = 0; i < matches.length; i++) {
        var g = matches[i];
        if (!STOP[g] && g.length >= 3 && !found[g]) { found[g] = true; result.push(g); }
    }
    return result;
}

/* ── ARCHITECTURE A: Specificity-First Gene Validation ──────────────────────
 * Validates extracted tokens against the live geneMap BEFORE any keyword
 * matching. Returns only tokens that are real gene symbols in the database.
 * This prevents "BBS1" being hijacked by the bbsome/bbs keyword matchers,
 * and "IFT88" being incorrectly routed to complex/disease handlers.
 */
function resolveValidGenes(tokens) {
    var gm = gmap();
    if (!gm || !Object.keys(gm).length) return tokens; /* DB not loaded yet — fall back */
    return tokens.filter(function(sym) { return !!gm[sym.toUpperCase()]; });
}

function matchLocKw(q) {
    var locs = [
        /* Longest/most-specific matches first to avoid prefix collisions */
        ['transition zone',  {term:'transition zone', label:'Transition Zone'}],
        ['ciliary axoneme',  {term:'axoneme',         label:'Axoneme'}],
        ['ciliary tip',      {term:'ciliary tip',     label:'Ciliary Tip'}],
        ['tip of cilia',     {term:'ciliary tip',     label:'Ciliary Tip'}],
        ['cilia tip',        {term:'ciliary tip',     label:'Ciliary Tip'}],
        ['ciliary membrane', {term:'ciliary membrane',label:'Ciliary Membrane'}],
        ['basal body',       {term:'basal body',      label:'Basal Body'}],
        ['motile cilia',     {term:'motile cilia',    label:'Motile Cilia'}],
        ['centrosome',       {term:'centrosome',      label:'Centrosome'}],
        ['mitochondria',     {term:'mitochondria',    label:'Mitochondria'}],
        ['lysosom',          {term:'lysosom',         label:'Lysosomes'}],
        ['axonemal dynein',  {term:'axoneme',         label:'Axoneme'}],
        ['axonemal',         {term:'axoneme',         label:'Axoneme'}],
        /* bare 'tip' only when clearly about cilia context */
        ['\btip\b',          {term:'ciliary tip',     label:'Ciliary Tip'}],
        ['axoneme',          {term:'axoneme',         label:'Axoneme'}],
        ['flagella',         {term:'flagella',        label:'Flagella / Axoneme'}],
        ['nucleus',          {term:'nucleus',         label:'Nucleus'}],
        ['cilia',            {term:'cilia',           label:'Cilia'}]
    ];
    for (var i = 0; i < locs.length; i++) {
        var kw = locs[i][0];
        /* Use regex for word-boundary patterns (prefixed with \b), plain indexOf otherwise */
        if (kw.indexOf('\\b') !== -1) {
            if (new RegExp(kw).test(q)) return locs[i][1];
        } else {
            if (q.indexOf(kw) !== -1) return locs[i][1];
        }
    }
    return null;
}

function matchDiseaseKw(q) {
    if (/\bbbs\b/.test(q)) return 'bardet_biedl';
    if (/\bnphp\b/.test(q)) return 'nphp';
    if (/\bpcd\b/.test(q)) return 'pcd';
    if (/\bpkd\b/.test(q)) return 'pkd';
    var P = [
        ['joubert','joubert'],['bardet-biedl','bardet_biedl'],['bardet','bardet_biedl'],
        ['biedl','bardet_biedl'],['meckel','meckel'],['nephronophthisis','nphp'],
        ['primary ciliary dyskinesia','pcd'],['ciliary dyskinesia','pcd'],
        ['leber congenital amaurosis','retinal'],['leber','retinal'],
        ['retinitis pigmentosa','retinal'],['retinal ciliopathy','retinal'],
        ['retinal degeneration','retinal'],['cone-rod dystrophy','retinal'],
        ['skeletal ciliopathy','skeletal'],['ellis-van creveld','skeletal'],
        ['male infertility','infertility'],['infertility','infertility'],
        ['polydactyly','polydactyly'],['alstr','alstrom'],['polycystic kidney','pkd'],
        ['usher','usher'],['holoprosencephaly','holoprosencephaly'],
        ['medulloblastoma','medulloblastoma']
    ];
    for (var i = 0; i < P.length; i++) { if (q.indexOf(P[i][0]) !== -1) return P[i][1]; }
    return null;
}

function matchTissueKw(q) {
    var T = [
        /* Brain regions */
        ['cerebellum','cerebellum'],['cerebellar','cerebellum'],
        ['hypothalamus','hypothalamus'],
        /* Generic brain — only if no more specific match */
        ['brain','hypothalamus'],
        /* Kidney — specific cell types before generic */
        ['proximal tubule','proximal_tubule'],['proximal tubular','proximal_tubule'],
        ['distal tubule','distal_tubule'],['distal tubular','distal_tubule'],
        ['collecting duct','collecting_duct'],
        ['loop of henle','loop_of_henle'],['henle','loop_of_henle'],
        ['podocyte','podocyte'],
        ['glomerular','podocyte'],
        /* Generic kidney */
        ['kidney','kidney'],['renal','kidney'],['nephron','kidney'],
        /* Lung */
        ['lung','lung'],['airway','lung'],['pulmonary','lung'],['bronch','lung'],
        /* Liver */
        ['liver','liver'],['hepat','liver'],['cholangiocyte','liver'],
        /* Other tissues */
        ['retina','retina'],['photoreceptor','retina'],
        ['olfactory','olfactory'],['pancrea','pancreas'],['islet','pancreas'],
        ['chondrocyte','chondrocyte'],['cartilage','chondrocyte'],
        ['testis','testis'],['testicular','testis'],['sperm','testis'],
        ['limb bud','limb_bud'],
        ['node','embryonic_node'],['embryonic node','embryonic_node']
    ];
    for (var i = 0; i < T.length; i++) { if (q.indexOf(T[i][0]) !== -1) return T[i][1]; }
    return null;
}

function matchComplexKw(q) {
    var C = [
        ['ift-b complex','ift_b'],['ift complex b','ift_b'],['ift b complex','ift_b'],['ift-b','ift_b'],
        ['ift-a complex','ift_a'],['ift complex a','ift_a'],['ift a complex','ift_a'],['ift-a','ift_a'],
        ['bbsome','bbsome'],['bbs complex','bbsome'],
        ['mks complex','mks_module'],['mks module','mks_module'],
        ['nphp complex','nphp_module'],['nphp module','nphp_module'],
        ['dynein-2','dynein2'],['dynein 2','dynein2']
    ];
    for (var i = 0; i < C.length; i++) { if (q.indexOf(C[i][0]) !== -1) return C[i][1]; }
    return null;
}

function matchLOFKw(q) {
    if (/shorter cilia|short cilia|shorten|cilia shortening/.test(q)) return 'shorter';
    if (/longer cilia|elongat|lengthen/.test(q)) return 'longer';
    if (/loss of cilia|no cilia|ciliogenesis blocked/.test(q)) return 'loss';
    /* "no change in cilia length" OR legacy "no effect" — both map to no_effect */
    if (/no change.{0,20}cilia|no cilia.{0,20}change|no effect|no phenotype/.test(q)) return 'no_effect';
    if (/motility defect|immotile/.test(q)) return 'motility';
    if (/knocked down|knockdown|depletion/.test(q)) return 'knockdown';
    return null;
}

/* matchOEKw — mirrors matchLOFKw but for overexpression effects */
function matchOEKw(q) {
    if (/overexpress.*shorter|overexpress.*short|shorter.*overexpress|short.*overexpress/.test(q)) return 'shorter';
    if (/overexpress.*longer|overexpress.*elongat|overexpress.*lengthen|longer.*overexpress|elongat.*overexpress|increase.*cilia.*length|cilia.*length.*increas|lengthen.*overexpress/.test(q)) return 'longer';
    if (/overexpress.*loss|overexpress.*no cilia|loss.*overexpress/.test(q)) return 'loss';
    /* "no change in cilia length" OR legacy "no effect" */
    if (/overexpress.*no.change.{0,20}cilia|overexpress.*no effect|overexpress.*no phenotype|no effect.*overexpress|no.change.*cilia.*overexpress/.test(q)) return 'no_effect';
    if (/overexpress.*motility|motility.*overexpress/.test(q)) return 'motility';
    return null;
}

/* oefMatches — tests the OE field for a given effect keyword.
 * The OE field covers BOTH cilia length changes AND ciliogenesis effects.
 * "No effect" means no change in either cilia length or cilia formation.   */
function oefMatches(row, effect) {
    var v = getOE(row).toLowerCase();
    if (!v || v.indexOf('not reported') !== -1) return false;
    if (effect === 'shorter')   return /shorter|short.cilia|short.cilium/.test(v);
    if (effect === 'longer')    return /longer|elongat|increase/.test(v);
    /* loss covers both "loss of cilia" (ciliogenesis) and "blocked ciliogenesis" */
    if (effect === 'loss')      return /loss.of.cilia|no.cilia|blocked|abolished|ciliogenesis/.test(v);
    /* "no_effect" = no change in cilia length AND no change in ciliogenesis */
    if (effect === 'no_effect') return /no[_ ]effect|no.change.in.cilia|no.change.cilia|no.cilia.length.change|unchanged/.test(v.trim());
    if (effect === 'motility')  return /motility/.test(v);
    return v.indexOf(effect.toLowerCase()) !== -1;
}

function matchDomainKw(q) {
    for (var fam in DOMAIN_TERMS) {
        var terms = DOMAIN_TERMS[fam];
        for (var i = 0; i < terms.length; i++) { if (q.indexOf(terms[i]) !== -1) return fam; }
    }
    return null;
}

/* ─── MAIN INTENT ROUTER ──────────────────────────────────────────────────── */
function matchIntent(raw) {
    var t = raw.trim();
    var q = t.toLowerCase();

    if (/what can you do|tell me about yourself|what are you|ciliai capabilities|what information|what datasets|how can you help/.test(q)) {
        return {type:'self_intro'};
    }

    /* Follow-up: re-render last phylo */
    if (_lastPhyloGenes && _lastPhyloGenes.length) {
        if (/^(yes|yeah|sure|ok|okay|please|show it|do it|show the plot|show heatmap|render|plot it|display it|show phylo|phylogenetic heatmap)[\s.!?]*$/.test(q) ||
            /phylogenetic heatmap shown in plot/.test(q) ||
            /show.*heatmap|heatmap.*plot/.test(q)) {
            return {type:'show_last_phylo'};
        }
    }

    /* ══════════════════════════════════════════════════════════════════════════
     * ARCHITECTURE A — SPECIFICITY FIRST
     * Validate gene tokens against the live geneMap BEFORE running any keyword
     * matchers. A single validated gene symbol forces gene_overview and short-
     * circuits all broad keyword routes (disease, complex, tissue, etc.).
     * This prevents "BBS1" from being hijacked by the "bbs/bbsome" matchers,
     * and "IFT88" from being captured by IFT complex keyword rules.
     * ════════════════════════════════════════════════════════════════════════*/
    var rawGenes  = extractGenes(t);
    var validGenes = resolveValidGenes(rawGenes);

    /* Single validated gene + no explicit group query → gene overview page */
    var isGroupQuery = /genes|list|show all|display all|how many|count|complex|syndrome|ciliopathy|disease|pathway/.test(q);
    if (validGenes.length === 1 && !isGroupQuery) {
        return {type:'gene_overview', gene:validGenes[0]};
    }

    /* Multiple validated genes → expression dot-plot / multi-gene view */
    if (validGenes.length >= 2 && !isGroupQuery) {
        return {type:'multi_gene', genes:validGenes};
    }

    /* ── FEATURE H: MULTI-GENE COMPARISON ──────────────────────────────────────
     * "Compare BBS1 and CEP290"  /  "BBS1 vs IFT88"  /  "BBS1 CEP290 comparison"
     * Requires 2+ validated genes AND an explicit compare/vs keyword.
     * Also catches: "BBS1 CEP290 side by side" / "BBS1 and IFT88 differences"
     */
    var isCompareQuery = /\bcompare\b|\bvs\b|\bversus\b|\bside.by.side\b|\bdifference|\bsimilar\b|\bboth\b/.test(q);
    if (validGenes.length >= 2 && isCompareQuery) {
        return {type:'multi_gene_compare', genes:validGenes};
    }
    /* Catch "Compare BBS1 and CEP290" where genes may also appear in keyword matchers */
    if (isCompareQuery && validGenes.length === 1 && rawGenes.length >= 2) {
        var allValid = resolveValidGenes(rawGenes);
        if (allValid.length >= 2) return {type:'multi_gene_compare', genes:allValid};
    }

    /* ── FEATURE I: COMPARTMENT REASONING ─────────────────────────────────────
     * "Transition zone biology"  /  "What do basal body genes do?"
     * "Axoneme phenotype profile"  /  "Ciliary tip compartment analysis"
     * Requires a localization keyword + a reasoning/biology/analysis qualifier.
     */
    var isReasonQuery = /\bbiology\b|\bfunction\b|\bwhat do\b|\bphenotype profile\b|\bcompartment\b|\banalysis\b|\bprofile\b|\brole\b|\bcharacter/.test(q);

    /* All other signals — now run keyword matchers on the full query */
    var loc     = matchLocKw(q);
    var disease = matchDiseaseKw(q);
    var tissue  = matchTissueKw(q);
    var complex = matchComplexKw(q);
    var lofEff  = matchLOFKw(q);
    var oeEff   = matchOEKw(q);
    var domain  = matchDomainKw(q);

    if (loc && isReasonQuery && !disease && !lofEff) {
        return {type:'compartment_reasoning', loc:loc};
    }

    /* ── FEATURE J: AI HYPOTHESIS GENERATOR ────────────────────────────────────
     * "Genes similar to BBS1"  /  "New ciliopathy candidates like CEP290"
     * "What genes are functionally related to IFT88?"
     * "Suggest genes with similar function to RPGRIP1L"
     * Requires 1 validated gene + a similarity/candidate/related keyword.
     */
    var isSimilarQuery = /\bsimilar\b|\brelated\b|\bcandidates?\b|\bsuggest\b|\blike\b|\banalogous\b|\bfunctionally.related\b|\bhypothes/.test(q);
    if (validGenes.length === 1 && isSimilarQuery) {
        return {type:'hypothesis_generator', gene:validGenes[0]};
    }

    /* Whether the query is primarily about overexpression */
    var isOEQuery = /overexpress|overexpression/.test(q);

    if (domain && /how many|count|number of/.test(q)) return {type:'domain_count', domain:domain};
    if (domain && /which genes|what genes|list|show|proteins with|genes with|containing/.test(q) && rawGenes.length < 2) return {type:'domain_list', domain:domain};
    if (/domain/.test(q) && /enrich|common|frequent|top domain/.test(q)) return {type:'domain_enrichment'};
    if (/what domains|domains of|domain structure|domains does|domains in/.test(q) && validGenes.length === 1) return {type:'domain_gene', gene:validGenes[0]};

    /* Single validated gene + explicit phenotype/LoF query → gene overview (covers "what does X do") */
    if (validGenes.length === 1) return {type:'gene_overview', gene:validGenes[0]};

    /* OE + LoF combo */
    if (oeEff && lofEff) return {type:'oe_lof_combo', oeEffect:oeEff, lofEffect:lofEff, loc:loc};
    if (oeEff && !lofEff) return {type:'oe_filter', oeEffect:oeEff, loc:loc};

    /* LoF-only filter */
    if (lofEff && !isOEQuery) {
        if (loc && loc.term === 'cilia' && disease) loc = null;
        if (loc) return {type:'loc_phenotype', loc:loc, effect:lofEff};
        return {type:'lof_filter', effect:lofEff, tissue:tissue};
    }

    /* Suppress spurious 'cilia' loc match from disease names */
    if (loc && loc.term === 'cilia' && disease) loc = null;

    /* 3-way: loc + disease + tissue */
    if (loc && disease && tissue) return {type:'loc_disease_tissue', loc:loc, disease:disease, tissue:tissue};

    /* 2-way combinations */
    if (loc && disease && !tissue && !lofEff) return {type:'loc_disease', loc:loc, disease:disease};
    if (loc && tissue && !disease && !lofEff && tissue !== 'testis') return {type:'loc_tissue', loc:loc, tissue:tissue};
    if (disease && tissue && !loc) {
        var exclude = tissue === 'testis' || /not expressed|not in|absent|exclude/.test(q);
        return {type:'disease_tissue', disease:disease, tissue:tissue, exclude:exclude};
    }
    if (disease && complex) return {type:'disease_complex', disease:disease, complex:complex};
    if (/compare|versus|\bvs\b/.test(q) && /phylogen|conserv|evol/.test(q)) {
        var ckeys = [];
        var clist = [['ift-b','ift_b'],['ift-a','ift_a'],['bbsome','bbsome'],
                     ['bbs complex','bbsome'],['mks','mks_module'],['nphp','nphp_module'],
                     ['dynein-2','dynein2'],['transition zone','transition_zone']];
        for (var ci = 0; ci < clist.length; ci++) {
            if (q.indexOf(clist[ci][0]) !== -1 && ckeys.indexOf(clist[ci][1]) === -1) ckeys.push(clist[ci][1]);
        }
        if (ckeys.length >= 2) return {type:'complex_phylo_compare', complexA:ckeys[0], complexB:ckeys[1]};
    }

    if (/conserv|phylogen|ciliary.specific|vertebrate.specific/.test(q) && domain) {
        var scope = /vertebrate/.test(q) ? 'vertebrate' : /mammalian/.test(q) ? 'mammalian' : 'ciliary_specific';
        return {type:'phylo_domain', domain:domain, scope:scope};
    }

    var pfamM = t.match(/\bPF\d{5}\b/);
    if (pfamM) {
        var pfamScope = /vertebrate.specific|vertebrate.only|only.*vertebrate/i.test(q) ? 'vertebrate'
                      : /mammalian.specific|mammalian.only/i.test(q) ? 'mammalian'
                      : /ciliary.specific/i.test(q) ? 'ciliary_specific'
                      : 'all';
        return {type:'pfam_filter', pfam:pfamM[0], scope:pfamScope};
    }

    if (/no.effect|no.*phenotype/.test(q) && /conserv|phylogen/.test(q)) {
        return {type:'lof_conserved_tissue', tissue:tissue};
    }

    return null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE C — UNIFIED HIGHLIGHT CONTROLLER
 * Reads localization directly from the DB string and maps each comma-
 * separated term to an SVG element ID. Uses a single CSS-class toggle,
 * no if/else chains. Wrapped in try/catch so SVG failures never break text.
 * ════════════════════════════════════════════════════════════════════════*/
var LOC_SVG_MAP = {
    'basal body':       'basal-body',
    'centrosome':       'basal-body',
    'pericentriolar':   'basal-body',
    'transition zone':  'transition-zone',
    'axoneme':          'axoneme',
    'microtubule':      'axoneme',
    'ciliary membrane': 'ciliary-membrane',
    'membrane':         'ciliary-membrane',
    'ciliary tip':      'ciliary-tip',
    'tip':              'ciliary-tip',
    'nucleus':          'nucleus',
    'cytosol':          'cell-body',
    'cytoplasm':        'cell-body',
    'cilia':            'ciliary-membrane',
    'flagella':         'axoneme'
};

function applyUnifiedHighlight(locString) {
    try {
        /* Architecture E: existence-check before any UI call */
        var svgEl = document.getElementById('cilia-svg');
        if (!svgEl) return;

        /* Switch to diagram view non-destructively */
        if (typeof win.switchView === 'function') {
            try { win.switchView('diagram'); } catch(e) {}
        }

        /* Clear all existing highlights */
        document.querySelectorAll('.cilia-part').forEach(function(p) {
            p.classList.remove('active-highlight');
        });

        /* Map each term to an SVG id and apply highlight class */
        var terms = (locString || '').toLowerCase().split(/[,;]/);
        var highlighted = [];
        terms.forEach(function(raw) {
            var term = raw.trim();
            /* Longest-match: try multi-word keys first */
            var svgId = null;
            Object.keys(LOC_SVG_MAP).sort(function(a,b){ return b.length - a.length; }).forEach(function(key) {
                if (!svgId && term.indexOf(key) !== -1) svgId = LOC_SVG_MAP[key];
            });
            if (svgId && highlighted.indexOf(svgId) === -1) {
                var el = document.getElementById(svgId);
                if (el) { el.classList.add('active-highlight'); highlighted.push(svgId); }
            }
        });
    } catch(e) {
        console.warn('[CiliAI] applyUnifiedHighlight failed gracefully:', e.message);
    }
}

/* ══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE B + D — CONTROLLER-RENDERER BRIDGE
 *
 * renderGenePage has two paths:
 *
 * PATH 1 (preferred): If displayIndividualGenePage() exists in script.js,
 *   normalise the gmap DB object into the canonical snake_case schema and
 *   call it directly. That function renders the full rich page (Ensembl links,
 *   OMIM, CORUM, STRING, orthologs, screen data, references).
 *
 * PATH 2 (fallback): If script.js hasn't loaded yet, render an inline card
 *   that covers all the same fields including Ensembl IDs with clickable links.
 *
 * Architecture E: all fields read from DB object keys, never hardcoded.
 * Architecture D: Expression Atlas button injected in both paths.
 * ════════════════════════════════════════════════════════════════════════*/
function normToCanonical(sym, gobj) {
    /* Convert the gmap mixed-key record to the snake_case canonical schema
     * that displayIndividualGenePage() expects.                           */
    var toArr = function(v) {
        if (!v) return [];
        if (Array.isArray(v)) return v.filter(Boolean);
        return String(v).split(/[;,]/).map(function(s){ return s.trim(); }).filter(Boolean);
    };

    /* Ensembl IDs — stored as 'Ensembl ID', 'Ensembl.ID', or 'ensembl_id' */
    var ensemblRaw = gobj['Ensembl ID'] || gobj['Ensembl.ID'] || gobj['ensembl_id'] || '';

    return {
        gene:                         (gobj['Gene'] || sym).toUpperCase(),
        description:                  gobj['Gene.Description'] || gobj['description'] || '',
        synonym:                      gobj['synonym'] || gobj['Synonym'] || '',
        ensembl_id:                   ensemblRaw,
        omim_id:                      gobj['OMIM_ID'] || gobj['omim_id'] || '',
        localization:                 toArr(gobj['Localization'] || gobj['localization']),
        functional_summary:           gobj['Functional.Summary.from.Literature'] || gobj['functional_summary'] || gobj['Functional_Summary'] || '',
        functional_category:          toArr(gobj['Functional.category'] || gobj['functional_category']),
        ciliopathy:                   toArr(gobj['Ciliopathies'] || gobj['Ciliopathy']),
        domain_descriptions:          toArr(gobj['Domain_Descriptions'] || gobj['domain_descriptions']),
        pfam_ids:                     toArr(gobj['PFAM_IDs'] || gobj['pfam_ids']),
        protein_complexes:            gobj['Protein_Complexes'] || gobj['protein_complexes'] || '',
        complex_names:                toArr(gobj['Protein_Complexes'] || gobj['protein_complexes']),
        string_link:                  gobj['string_link'] || '',
        reference:                    gobj['Reference'] || gobj['reference'] || '',
        ortholog_mouse:               gobj['Ortholog_Mouse']      || gobj['ortholog_mouse']      || '',
        ortholog_zebrafish:           gobj['Ortholog_Zebrafish']  || gobj['ortholog_zebrafish']  || '',
        ortholog_drosophila:          gobj['Ortholog_Drosophila'] || gobj['ortholog_drosophila'] || '',
        ortholog_c_elegans:           gobj['Ortholog_C_elegans']  || gobj['ortholog_c_elegans']  || '',
        ortholog_xenopus:             gobj['Ortholog_Xenopus']    || gobj['ortholog_xenopus']    || '',
        lof_effects:                  getLOF(gobj)  || '',
        overexpression_effects:       getOE(gobj)   || '',
        percent_ciliated_cells_effects: getPCT(gobj) || '',
        screens:                      gobj['screens'] || []
    };
}

function renderEnsemblLinks(ensemblRaw) {
    /* Renders one or more Ensembl IDs as clickable links */
    if (!ensemblRaw) return '<span style="color:#94a3b8;font-style:italic;">Not available</span>';
    var ids = String(ensemblRaw).split(/[;,\s]+/).map(function(s){ return s.trim(); }).filter(Boolean);
    if (!ids.length) return '<span style="color:#94a3b8;font-style:italic;">Not available</span>';
    return ids.map(function(id) {
        return '<a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g='
            +encodeURIComponent(id)+'" target="_blank" rel="noopener noreferrer" '
            +'style="color:#005b96;font-weight:600;text-decoration:none;font-size:12px;'
            +'background:#eff6ff;padding:2px 8px;border-radius:6px;border:1px solid #bfdbfe;'
            +'display:inline-block;margin:1px;">'
            +id+'</a>';
    }).join(' ');
}

function renderGenePage(sym, gobj) {
    var canonical = normToCanonical(sym, gobj);

    /* ── PATH 1: delegate to script.js full-page renderer ─────────────────
     * displayIndividualGenePage renders into .content-area with complete
     * Ensembl links, OMIM, CORUM, STRING, orthologs, screen table, references.
     * After calling it, inject the Expression Atlas button non-destructively.
     */
    if (typeof win.displayIndividualGenePage === 'function') {
        try {
            win.displayIndividualGenePage(canonical);

            /* Architecture D: inject Expression Atlas button after render */
            setTimeout(function() {
                try {
                    var contentArea = document.querySelector('.content-area');
                    if (!contentArea) return;
                    /* Don't inject twice */
                    if (contentArea.querySelector('.ciliai-expr-btn')) return;
                    var btn = document.createElement('button');
                    btn.className = 'ciliai-expr-btn';
                    btn.style.cssText = 'background:#005b96;color:white;border:none;padding:7px 16px;'
                        +'border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;'
                        +'display:inline-flex;align-items:center;gap:6px;margin:12px 0 4px;';
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
                        +'style="width:13px;height:13px;">'
                        +'<line x1="18" y1="20" x2="18" y2="10"/>'
                        +'<line x1="12" y1="20" x2="12" y2="4"/>'
                        +'<line x1="6" y1="20" x2="6" y2="14"/></svg>'
                        +'Expression Atlas';
                    btn.onclick = function() {
                        try {
                            if (win.CiliAI) win.CiliAI.activeGeneContext = canonical.gene;
                            if (typeof win.renderUMAPPlot === 'function') win.renderUMAPPlot(canonical.gene, [canonical.gene]);
                            else if (typeof win.switchView === 'function') win.switchView('plot');
                        } catch(e) {}
                    };
                    /* Insert at the top of the gene detail page */
                    var header = contentArea.querySelector('.gene-header');
                    if (header) header.appendChild(btn);
                    else contentArea.insertBefore(btn, contentArea.firstChild);
                } catch(e) {}
            }, 60);

            /* Return empty string — the full page is already in the DOM */
            return '';
        } catch(e) {
            console.warn('[CiliAI] displayIndividualGenePage failed, using fallback:', e.message);
        }
    }

    /* ── PATH 2: inline fallback card ─────────────────────────────────────
     * Used when displayIndividualGenePage isn't loaded yet.
     * Renders all fields including Ensembl IDs with clickable links.
     */
    var gene     = canonical.gene;
    var locRaw   = Array.isArray(canonical.localization) ? canonical.localization.join(', ') : (canonical.localization || '');
    var lof      = canonical.lof_effects              || 'Not reported';
    var oe       = canonical.overexpression_effects   || 'Not reported';
    var pct      = canonical.percent_ciliated_cells_effects || 'Not reported';
    var funcSum  = canonical.functional_summary       || '';
    var desc     = canonical.description              || '';
    var omim     = canonical.omim_id                  || '';
    var synonym  = canonical.synonym                  || '';
    var mouseOrtho = canonical.ortholog_mouse         || '';
    var ensemblRaw = canonical.ensembl_id             || '';
    var complexes  = canonical.complex_names.length ? canonical.complex_names[0] : '';

    /* Phylogeny badge — non-blocking */
    var phyloBadgeHtml = '';
    try { phyloBadgeHtml = _li2014BySymbol ? phyloBadge(gene) : ''; } catch(e) {}

    /* Domain pills */
    var domParts = canonical.domain_descriptions.concat(canonical.pfam_ids).slice(0,8);
    var domainHtml = domParts.length
        ? '<div style="margin-top:10px;">'
          +'<b style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Domains</b><br>'
          +'<div style="margin-top:3px;">'+domParts.map(function(d){ return pill(d,'purple'); }).join(' ')+'</div>'
          +'</div>'
        : '';

    /* Disease pills */
    var cilioList = canonical.ciliopathy;
    var hasCiliopathy = cilioList.length > 0 && cilioList[0].toUpperCase() !== 'N/A';
    var diseaseHtml = hasCiliopathy
        ? '<div style="margin-top:10px;">'
          +'<b style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Associated ciliopathies</b><br>'
          +'<div style="margin-top:3px;">'+cilioList.slice(0,6).map(function(d){ return pill(d,'red'); }).join(' ')+'</div>'
          +'</div>'
        : '';

    /* Ensembl IDs with links */
    var ensemblHtml = '<div style="margin-top:10px;">'
        +'<b style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Ensembl ID</b><br>'
        +'<div style="margin-top:3px;">'+renderEnsemblLinks(ensemblRaw)+'</div>'
        +'</div>';

    /* Meta row */
    var metaHtml = '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">';
    if (omim) metaHtml += '<a href="https://www.omim.org/entry/'+omim.replace(/[^0-9]/g,'')+'" target="_blank" '
        +'style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:6px;font-weight:600;text-decoration:none;">OMIM: '+omim+'</a>';
    if (synonym)   metaHtml += pill('aka '+synonym,'gray');
    if (mouseOrtho)metaHtml += pill('Mouse: '+mouseOrtho,'blue');
    if (complexes) metaHtml += pill(complexes,'blue');
    metaHtml += '</div>';

    /* Architecture D: Expression Atlas button */
    var exprBtn = '<button onclick="(function(){'
        +'try{'
        +'if(window.CiliAI)window.CiliAI.activeGeneContext=\''+gene+'\';'
        +'if(typeof window.renderUMAPPlot===\'function\')window.renderUMAPPlot(\''+gene+'\',[\''+gene+'\']);'
        +'else if(typeof window.switchView===\'function\')window.switchView(\'plot\');'
        +'}catch(e){}})()" '
        +'style="background:#005b96;color:white;border:none;padding:6px 14px;border-radius:8px;'
        +'font-size:11.5px;font-weight:600;cursor:pointer;margin-top:8px;display:inline-flex;'
        +'align-items:center;gap:5px;">'
        +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        +'style="width:11px;height:11px;"><line x1="18" y1="20" x2="18" y2="10"/>'
        +'<line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
        +'Expression Atlas</button>';

    return '<div style="line-height:1.5;">'
        /* Header */
        +'<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px;">'
        +'<b style="font-size:16px;color:#005b96;">'+gene+'</b>'
        +(phyloBadgeHtml||'')
        +(synonym ? '<span style="font-size:11px;color:#94a3b8;">'+synonym+'</span>' : '')
        +'</div>'
        +(desc ? '<p style="font-size:12px;color:#64748b;margin-bottom:8px;">'+desc.slice(0,140)+(desc.length>140?'…':'')+'</p>' : '')
        +(funcSum ? '<p style="font-size:12.5px;color:#334155;line-height:1.55;margin-bottom:10px;'
            +'padding:8px;background:#f8fafc;border-radius:6px;border-left:3px solid #b3cde0;">'
            +funcSum.slice(0,300)+(funcSum.length>300?'…':'')+'</p>' : '')
        /* 2×2 data grid */
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:4px;">'
        +'<div style="background:#f8fafc;padding:8px;border-radius:8px;">'
        +'<b style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Localization</b><br>'
        +'<span style="color:#0f172a;font-weight:500;">'+(locRaw||'—')+'</span></div>'
        +'<div style="background:#f8fafc;padding:8px;border-radius:8px;">'
        +'<b style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">LoF effect</b><br>'
        +'<span style="color:#7c3aed;font-weight:600;">'+lof+'</span></div>'
        +'<div style="background:#f8fafc;padding:8px;border-radius:8px;">'
        +'<b style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Overexpression (length / ciliogenesis)</b><br>'
        +'<span style="color:#b45309;font-weight:500;">'+oe+'</span></div>'
        +'<div style="background:#f8fafc;padding:8px;border-radius:8px;">'
        +'<b style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">% ciliated cells</b><br>'
        +'<span style="color:#065f46;font-weight:500;">'+pct+'</span></div>'
        +'</div>'
        +ensemblHtml
        +metaHtml
        +diseaseHtml
        +domainHtml
        +exprBtn
        +'</div>';
}

/* ─── DISPATCH ────────────────────────────────────────────────────────────── */
function pill(text, color) {
    var C = {blue:['#dbeafe','#1e40af'],red:['#fee2e2','#991b1b'],green:['#dcfce7','#166534'],
             amber:['#fef3c7','#92400e'],purple:['#ede9fe','#5b21b6'],gray:['#f3f4f6','#374151']};
    var p = C[color] || C.gray;
    return '<span style="background:'+p[0]+';color:'+p[1]+';padding:2px 7px;border-radius:8px;font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-block;margin:1px;">'+text+'</span>';
}
function chip(sym) {
    var s = sym.replace(/'/g,"\\'");
    return '<span onclick="(function(){var fn=window.CiliAI&&window.CiliAI.Router&&window.CiliAI.Router.dispatchAction;if(fn)fn({text:\''+s+'\',echo:false});else if(window.handleAIQuery)window.handleAIQuery(\''+s+'\');})()" style="background:#e6f2fb;color:#005b96;border:1px solid #b3cde0;margin:2px;padding:4px 10px;border-radius:12px;font-size:11.5px;font-weight:600;cursor:pointer;display:inline-block;">'+sym+'</span>';
}
function tbl(headers, rows, max) {
    max = max || 50;
    var shown = rows.slice(0, max);
    var more = rows.length > max ? '<p style="color:#888;font-size:11px;margin-top:4px;">Showing '+max+' of '+rows.length+' genes.</p>' : '';
    var head = headers.map(function(h){ return '<th style="padding:7px 10px;text-align:left;background:#f1f5f9;border-bottom:2px solid #e2e8f0;color:#475569;font-weight:700;">'+h+'</th>'; }).join('');
    var body = shown.map(function(r,i){
        return '<tr style="background:'+(i%2?'#f8fafc':'white')+';border-bottom:1px solid #f1f5f9;">'+r.map(function(c){ return '<td style="padding:6px 10px;vertical-align:top;">'+c+'</td>'; }).join('')+'</tr>';
    }).join('');
    return '<div style="overflow-x:auto;margin-top:8px;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>'+more;
}
function csvLink(genes, fields, filename) {
    var hdr = fields.join(',');
    var body = genes.map(function(g){ return fields.map(function(f){ return '"'+(g[f]||'').toString().replace(/"/g,'""')+'"'; }).join(','); });
    var csv = [hdr].concat(body).join('\n');
    return '<a href="data:text/csv;charset=utf-8,'+encodeURIComponent(csv)+'" download="'+filename+'" style="display:inline-block;margin-top:8px;padding:6px 14px;background:#005b96;color:white;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">Download CSV ('+genes.length+' genes)</a>';
}
function tisNote(tissue) {
    var names = {
        lung:'Lung', kidney:'Kidney', liver:'Liver', hypothalamus:'Hypothalamus',
        retina:'Retina', cerebellum:'Cerebellum', chondrocyte:'Chondrocyte',
        testis:'Testis', limb_bud:'Limb Bud',
        proximal_tubule:'Proximal Tubule', distal_tubule:'Distal Tubule',
        collecting_duct:'Collecting Duct', loop_of_henle:'Loop of Henle',
        podocyte:'Podocyte', pancreas:'Pancreas', olfactory:'Olfactory Epithelium',
        embryonic_node:'Embryonic Node'
    };
    var n = names[tissue] || tissue.replace(/_/g,' ');
    var hasScRNA = {lung:1,kidney:1,liver:1,hypothalamus:1,chondrocyte:1,retina:1,cerebellum:1};
    var isKidneyCellType = {proximal_tubule:1,distal_tubule:1,collecting_duct:1,loop_of_henle:1,podocyte:1};
    if (isKidneyCellType[tissue]) {
        return '<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">'
            +'<b>'+n+'</b> is a kidney cell type. Kidney scRNA-seq data is available in CiliAI — click the <b>Plot</b> tab and select a gene to see cell-type-level expression.</div>';
    }
    if (hasScRNA[tissue]) {
        return '<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">scRNA-seq data for <b>'+n+'</b> is available. Click the Plot tab.</div>';
    }
    return '<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#92400e;">Tissue expression for <b>'+n+'</b> is not yet in CiliAI. Gene list is from CiliaHub annotations.</div>';
}
function tisName(t) {
    var N = {
        lung:'Human Lung', kidney:'Human Kidney', liver:'Human Liver',
        hypothalamus:'Hypothalamus/Brain', chondrocyte:'Chondrocyte',
        retina:'Retina', cerebellum:'Fetal Cerebellum',
        testis:'Testis', limb_bud:'Embryonic Limb Bud',
        proximal_tubule:'Proximal Tubule (Kidney)',
        distal_tubule:'Distal Tubule (Kidney)',
        collecting_duct:'Collecting Duct (Kidney)',
        loop_of_henle:'Loop of Henle (Kidney)',
        podocyte:'Podocyte (Kidney)',
        pancreas:'Pancreas', olfactory:'Olfactory Epithelium',
        embryonic_node:'Embryonic Node'
    };
    return N[t] || t.replace(/_/g,' ');
}
function disName(tag) {
    var N = {joubert:'Joubert Syndrome',bardet_biedl:'Bardet-Biedl Syndrome',meckel:'Meckel-Gruber Syndrome',
             nphp:'Nephronophthisis',pcd:'Primary Ciliary Dyskinesia',retinal:'Retinal Ciliopathies',
             skeletal:'Skeletal Ciliopathies',infertility:'Male Infertility',medulloblastoma:'Medulloblastoma',
             alstrom:'Alstrom Syndrome',pkd:'Polycystic Kidney Disease',usher:'Usher Syndrome',
             holoprosencephaly:'Holoprosencephaly',polydactyly:'Polydactyly'};
    return N[tag] || tag;
}
function cxName(k) {
    var N = {ift_b:'IFT-B',ift_a:'IFT-A',bbsome:'BBSome',dynein2:'Dynein-2',
             mks_module:'MKS module',nphp_module:'NPHP module',transition_zone:'Transition Zone'};
    return N[k] || k;
}

/* ─── PHYLO BADGE HELPER ──────────────────────────────────────────────────── */
function phyloBadge(sym) {
    var cls = getPhyloClass(sym);
    if (!cls) return '';
    var colors = {
        'Vertebrate-specific': ['#dcfce7','#166534'],
        'Mammalian-specific':  ['#dbeafe','#1e40af'],
        'Ciliary-specific':    ['#ede9fe','#5b21b6'],
        'Cilia-related':       ['#fef3c7','#92400e'],
        'No data':             ['#f3f4f6','#374151']
    };
    var c = colors[cls] || colors['No data'];
    return '<span style="background:'+c[0]+';color:'+c[1]+';padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;margin-left:4px;">'+cls+'</span>';
}

/* ─── DISPATCH ────────────────────────────────────────────────────────────── */
function dispatch(intent) {
    var type = intent.type;

    if (type === 'self_intro') {
        var total = db().length;
        var withDis = db().filter(function(r){ return r['Ciliopathy'] && r['Ciliopathy'] !== 'N/A'; }).length;
        return '<b>CiliAI</b> — CiliaHub specialist assistant<br>'
            +'<b>Database:</b> '+total+' ciliary genes, '+withDis+' ciliopathy-associated<br>'
            +'<b>Phylogeny:</b> Li et al. (2014) matrix — '+(_li2014BySymbol ? Object.keys(_li2014BySymbol).length+' genes indexed' : 'loading...')+'<br><br>'
            +'<b>I can answer:</b><br>'
            +'<div style="margin:3px 0;">LoF phenotype — <i>What is the knockdown effect of KIF3A?</i></div>'
            +'<div style="margin:3px 0;">Protein domains — <i>How many genes have WD40 domains?</i></div>'
            +'<div style="margin:3px 0;">PFAM filter — <i>Vertebrate-specific genes with PFAM PF13432</i></div>'
            +'<div style="margin:3px 0;">Ciliopathy genes — <i>Joubert syndrome genes</i></div>'
            +'<div style="margin:3px 0;">Cilia phenotype — <i>Genes with no change in cilia length on LoF</i></div>'
            +'<div style="margin:3px 0;">Complex intersections — <i>BBS genes also in IFT-B</i></div>'
            +'<div style="margin:3px 0;">Phylo comparison — <i>Compare BBSome vs IFT-A conservation</i></div>'
            +'<div style="margin:3px 0;">scRNA-seq — <i>IFT88 in lung</i></div>';
    }

    if (type === 'show_last_phylo') {
        if (!_lastPhyloGenes || !_lastPhyloGenes.length) {
            return 'No previous comparison found. Run a comparison first, e.g. "Compare BBSome vs IFT-A phylogeny".';
        }
        var rendered = renderPhyloPlot(_lastPhyloGenes);
        if (rendered) {
            return 'Phylogenetic heatmap for <b>'+(_lastPhyloNames||'selected genes')+'</b> rendered in the Plot view.<br>'
                +'<span style="font-size:11.5px;color:#888;">'+_lastPhyloGenes.length+' genes: '+_lastPhyloGenes.join(', ')+'</span>';
        }
        return 'The phylogeny function is not yet loaded. Try the <b>Cilia Analysis</b> page, Phylogeny tab.';
    }

    /* ══════════════════════════════════════════════════════════════════════════
     * ARCHITECTURE B — CONTROLLER-RENDERER BRIDGE: gene_overview
     * Retrieves the live DB object and passes it to renderGenePage().
     * Triggers applyUnifiedHighlight as a visual side-effect (Architecture C).
     * Architecture E: try/catch guards all UI calls; text always renders.
     * ════════════════════════════════════════════════════════════════════════*/
    if (type === 'gene_overview') {
        var gobj = gmap()[intent.gene.toUpperCase()];
        if (!gobj) return 'Gene <b>'+intent.gene+'</b> not found in the CiliaHub database.';

        /* Architecture C — visual side-effect: highlight localization on SVG */
        var locForHighlight = gobj['Localization'] || gobj['localization'] || '';
        setTimeout(function() {
            try { applyUnifiedHighlight(locForHighlight); } catch(e) {}
        }, 50);

        /* Architecture B + D — render rich page from DB object */
        return renderGenePage(intent.gene, gobj);
    }

    /* multi_gene: user typed 2+ validated gene symbols — route to UMAP plot */
    if (type === 'multi_gene') {
        var syms = intent.genes;
        setTimeout(function() {
            try {
                if (typeof win.renderUMAPPlot === 'function') win.renderUMAPPlot(syms[0], syms);
                else if (typeof win.switchView === 'function') win.switchView('plot');
            } catch(e) {}
        }, 80);
        return 'Showing expression data for <b>'+syms.join(', ')+'</b> in the Plot view. '
            +'<div style="margin-top:8px;">'+syms.map(function(s){ return chip(s); }).join('')+'</div>';
    }

    /* ══ FEATURE H: MULTI-GENE COMPARISON ══════════════════════════════════════
     * "Compare BBS1 and CEP290" / "BBS1 vs IFT88" / "BBS1 CEP290 side by side"
     * Side-by-side card: shared localization, ciliopathies, complexes, domains,
     * per-gene phenotype data, compartment overlap score, Expression Atlas button.
     * ═════════════════════════════════════════════════════════════════════════*/
    if (type === 'multi_gene_compare') {
        var syms = intent.genes.slice(0, 4);
        var gm = gmap();
        var found = syms.filter(function(s){ return !!gm[s.toUpperCase()]; });
        var notFound = syms.filter(function(s){ return !gm[s.toUpperCase()]; });
        if (!found.length) return 'None of the genes ('+syms.join(', ')+') were found in CiliaHub.';

        function toSet(v) {
            var arr = !v ? [] : Array.isArray(v) ? v : String(v).split(/[;,]/).map(function(s){ return s.trim(); });
            return new Set(arr.filter(Boolean).map(function(s){ return s.toLowerCase(); }));
        }
        var gdata = found.map(function(sym) {
            var g = gm[sym.toUpperCase()];
            return {
                sym:    sym,
                loc:    toSet(g['Localization']||g['localization']),
                locRaw: g['Localization']||g['localization']||'—',
                lof:    getLOF(g)||'not reported',
                oe:     getOE(g)||'not reported',
                pct:    getPCT(g)||'not reported',
                dis:    toSet(g['Ciliopathies']||g['Ciliopathy']),
                disRaw: (Array.isArray(g['Ciliopathies'])?g['Ciliopathies'].join('; '):(g['Ciliopathy']||'—')),
                cplx:   toSet(g['Protein_Complexes']||g['protein_complexes']),
                dom:    toSet((g['Domain_Descriptions']||'')+' '+(g['PFAM_IDs']||''))
            };
        });
        function intersectAll(key) {
            var result = new Set(gdata[0][key]);
            for (var i=1;i<gdata.length;i++){
                var other=gdata[i][key];
                result.forEach(function(v){ if(!other.has(v)) result.delete(v); });
            }
            return result;
        }
        var sharedLoc=intersectAll('loc'), sharedDis=intersectAll('dis'),
            sharedCplx=intersectAll('cplx'), sharedDom=intersectAll('dom');

        function jaccardPct(a,b){
            var union=new Set([].concat(Array.from(a)).concat(Array.from(b)));
            if(!union.size) return 0;
            var inter=0; a.forEach(function(v){ if(b.has(v)) inter++; });
            return Math.round(100*inter/union.size);
        }
        var overlapScore = gdata.length===2
            ? jaccardPct(gdata[0].loc,gdata[1].loc)
            : Math.round(sharedLoc.size/Math.max(1,Array.from(new Set(
                gdata.reduce(function(acc,g){ return acc.concat(Array.from(g.loc)); },[])
              )).length)*100);

        setTimeout(function(){ try{ applyUnifiedHighlight(Array.from(sharedLoc).join(', ')||gdata[0].locRaw); }catch(e){} },50);

        /* ── PER-GENE COLOUR PALETTE ──────────────────────────────────────────
         * Assign each gene a distinct colour passed to renderUMAPPlot so they
         * appear in different colours on the same UMAP (if the renderer supports
         * a colorMap argument). Also provide separate single-gene buttons as a
         * reliable fallback that always works.
         */
        var GENE_COLORS = ['#e63946','#2a9d8f','#e9c46a','#6a4c93','#f77f00','#0077b6'];
        var colorMap = {};
        found.forEach(function(s,i){ colorMap[s] = GENE_COLORS[i % GENE_COLORS.length]; });

        /* Combined button — calls showCompareUMAP for true side-by-side panels */
        exprBtn += '<button onclick="(function(){'
            +'try{'
            +'var genes=['+symList+'];'
            +'var cmap='+JSON.stringify(colorMap)+';'
            +'if(window.CiliAI)window.CiliAI.activeGeneContext=genes[0];'
            +'if(typeof window.showCompareUMAP===\'function\'){'
            +'  window.showCompareUMAP(genes,cmap);'
            +'}else if(typeof window.renderUMAPPlot===\'function\'){'
            +'  window.renderUMAPPlot(genes[0],genes,cmap);'
            +'}else if(typeof window.switchView===\'function\'){window.switchView(\'plot\');}'
            +'}catch(e){console.warn(e);}})()" '
            +'style="background:#005b96;color:white;border:none;padding:6px 14px;border-radius:8px;'
            +'font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">'
            +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;">'
            +'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
            +'Compare in Expression Atlas</button>';

        /* Per-gene individual UMAP buttons with colour swatch */
        found.forEach(function(s, i) {
            var col = GENE_COLORS[i % GENE_COLORS.length];
            var sEsc = s.replace(/'/g,"\\'");
            exprBtn += '<button onclick="(function(){'
                +'try{'
                +'if(window.CiliAI)window.CiliAI.activeGeneContext=\''+sEsc+'\';'
                +'if(typeof window.renderUMAPPlot===\'function\')window.renderUMAPPlot(\''+sEsc+'\',[\''+sEsc+'\']);'
                +'else if(typeof window.switchView===\'function\')window.switchView(\'plot\');'
                +'}catch(e){}})()" '
                +'style="background:white;color:#334155;border:2px solid '+col+';padding:5px 12px;border-radius:8px;'
                +'font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">'
                +'<span style="width:10px;height:10px;border-radius:50%;background:'+col+';flex-shrink:0;"></span>'
                +s+'</button>';
        });
        exprBtn += '</div>';

        var scoreCol=overlapScore>=60?'#166534':overlapScore>=30?'#92400e':'#991b1b';
        var scoreBg=overlapScore>=60?'#dcfce7':overlapScore>=30?'#fef3c7':'#fee2e2';
        function setList(s,color){
            var arr=Array.from(s).filter(Boolean);
            if(!arr.length) return '<span style="color:#94a3b8;font-style:italic;font-size:11px;">none</span>';
            return arr.slice(0,8).map(function(v){ return pill(v,color); }).join(' ');
        }

        var out='<div style="line-height:1.5;">';
        out+='<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;">'
            +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
        found.forEach(function(s,i){
            var col=GENE_COLORS[i%GENE_COLORS.length];
            out+='<span style="display:inline-flex;align-items:center;gap:4px;">'
                +'<span style="width:10px;height:10px;border-radius:50%;background:'+col+';flex-shrink:0;display:inline-block;"></span>'
                +chip(s)+'</span>';
        });
        out+='</div>'
            +'<span style="background:'+scoreBg+';color:'+scoreCol+';padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">'+overlapScore+'% compartment overlap</span>'
            +'</div>';
        out+=exprBtn;
        out+='<div style="display:grid;grid-template-columns:repeat('+found.length+',1fr);gap:8px;margin-bottom:12px;">';
        gdata.forEach(function(g, i){
            var ph=''; try{ ph=_li2014BySymbol?phyloBadge(g.sym):''; }catch(e){}
            var geneColor = GENE_COLORS[i % GENE_COLORS.length];
            out+='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:4px solid '+geneColor+';border-radius:10px;padding:10px;">'
                +'<div style="font-size:15px;font-weight:700;color:'+geneColor+';margin-bottom:4px;">'+g.sym+(ph||'')+'</div>'
                +'<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-top:6px;">Localization</div>'
                +'<div style="font-size:11.5px;color:#0f172a;">'+g.locRaw+'</div>'
                +'<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-top:6px;">LoF effect</div>'
                +'<div style="font-size:11.5px;color:#7c3aed;font-weight:600;">'+g.lof+'</div>'
                +'<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-top:6px;">Overexpression (length / ciliogenesis)</div>'
                +'<div style="font-size:11.5px;color:#b45309;">'+g.oe+'</div>'
                +'<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-top:6px;">Ciliopathies</div>'
                +'<div style="font-size:11px;color:#be185d;">'+g.disRaw+'</div>'
                +'</div>';
        });
        out+='</div>';
        out+='<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:8px;">'
            +'<div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Shared biology</div>'
            +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11.5px;">'
            +'<div><b style="color:#475569;">Shared localization</b><br><div style="margin-top:3px;">'+setList(sharedLoc,'blue')+'</div></div>'
            +'<div><b style="color:#475569;">Shared ciliopathies</b><br><div style="margin-top:3px;">'+setList(sharedDis,'red')+'</div></div>'
            +'<div><b style="color:#475569;">Shared complexes</b><br><div style="margin-top:3px;">'+setList(sharedCplx,'green')+'</div></div>'
            +'<div><b style="color:#475569;">Shared domains</b><br><div style="margin-top:3px;">'+setList(sharedDom,'purple')+'</div></div>'
            +'</div></div>';
        out+='<div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Phenotype comparison</div>'
            +tbl(['Gene','LoF effect','Overexpression (length / ciliogenesis)','% ciliated cells'],
                gdata.map(function(g){
                    return [chip(g.sym),
                        pill(g.lof,g.lof==='not reported'?'gray':'amber'),
                        pill(g.oe, g.oe==='not reported'?'gray':'green'),
                        g.pct];
                }));
        if(notFound.length) out+='<p style="font-size:11px;color:#94a3b8;margin-top:8px;">Not found in CiliaHub: '+notFound.join(', ')+'</p>';
        out+='</div>';
        return out;
    }

    /* ══ FEATURE I: CILIARY COMPARTMENT REASONING ══════════════════════════════
     * "Transition zone biology" / "What do basal body genes do?"
     * "Axoneme phenotype profile" / "Ciliary tip compartment"
     * Biologically interprets all genes in a compartment with phenotype stats,
     * disease enrichment, conservation profile, complex membership.
     * ═════════════════════════════════════════════════════════════════════════*/
    if (type === 'compartment_reasoning') {
        var loc=intent.loc;

        /* ── MULTI-TERM DB SEARCH ──────────────────────────────────────────────
         * The database stores localization with varied spellings, prefixes and
         * compound terms. A single indexOf(loc.term) misses most entries.
         * Each compartment maps to ALL the strings that appear in the DB field.
         */
        var COMPARTMENT_TERMS = {
            'axoneme':         ['axoneme','axonemal','ciliary axoneme','outer dynein arm','inner dynein arm','nexin','radial spoke','central pair','intraflagellar transport','ift particle'],
            'ciliary tip':     ['ciliary tip','cilia tip','tip of cilia','tip of flagella','distal tip','flagellar tip'],
            'transition zone': ['transition zone','transition fiber','transition fibre'],
            'ciliary membrane':['ciliary membrane','ciliary ectosomes','ift membrane'],
            'basal body':      ['basal body','centriole','pericentriolar','subdistal appendage','distal appendage','mother centriole'],
            'centrosome':      ['centrosome','centriole','pcm','pericentriolar'],
            'cilia':           ['cilia','cilium','flagell','intraflagellar','ift'],
            'motile cilia':    ['motile cilia','motile cilium','outer dynein','inner dynein'],
            'nucleus':         ['nucleus','nuclear'],
            'flagella':        ['flagell','axoneme'],
            'lysosom':         ['lysosom']
        };
        var searchTerms = COMPARTMENT_TERMS[loc.term] || [loc.term];

        function matchesCompartment(row) {
            var locStr = getLoc(row); /* already lowercased */
            for (var ti = 0; ti < searchTerms.length; ti++) {
                if (locStr.indexOf(searchTerms[ti]) !== -1) return true;
            }
            return false;
        }

        var genes = db().filter(matchesCompartment);

        /* Diagnostic: show what was searched if still empty */
        if (!genes.length) {
            return 'No genes found with <b>'+loc.label+'</b> localization in CiliaHub.<br>'
                +'<span style="font-size:11px;color:#94a3b8;">Searched DB for: '
                +searchTerms.map(function(t){ return '<code>'+t+'</code>'; }).join(', ')+'</span><br>'
                +'<span style="font-size:11px;color:#94a3b8;">This compartment may use different terminology in the database. '
                +'Try: "cilia genes", "basal body genes", or "transition zone genes".</span>';
        }

        var phenoCounts={shorter:0,longer:0,loss:0,no_change:0,motility:0,not_reported:0};
        genes.forEach(function(g){
            var v=getLOF(g).toLowerCase();
            if(!v||v==='not reported')                          phenoCounts.not_reported++;
            else if(/shorter|short.cilia/.test(v))              phenoCounts.shorter++;
            else if(/longer|elongat/.test(v))                   phenoCounts.longer++;
            else if(/loss.of.cilia|no.cilia|blocked/.test(v))   phenoCounts.loss++;
            else if(/no[_ ]effect|no.change/.test(v))           phenoCounts.no_change++;
            else if(/motility/.test(v))                         phenoCounts.motility++;
            else                                                phenoCounts.not_reported++;
        });
        var disCounts={};
        genes.forEach(function(g){
            var raw=g['Ciliopathies']||g['Ciliopathy']||'';
            var list=Array.isArray(raw)?raw:String(raw).split(/[;,]/).map(function(s){ return s.trim(); });
            list.forEach(function(d){ if(d&&d.toUpperCase()!=='N/A'&&d.length>2) disCounts[d]=(disCounts[d]||0)+1; });
        });
        var topDiseases=Object.keys(disCounts).map(function(k){ return [k,disCounts[k]]; })
            .sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
        var conservCounts={'Ciliary-specific':0,'Vertebrate-specific':0,'Mammalian-specific':0,'Cilia-related':0,'No data':0};
        genes.forEach(function(g){
            var cls=getPhyloClass(g['Gene'])||'No data';
            conservCounts[cls]=(conservCounts[cls]||0)+1;
        });
        var cplxCounts={};
        Object.keys(COMPLEX_SETS).forEach(function(ckey){
            var n=genes.filter(function(g){ return inComplex(g['Gene'],ckey); }).length;
            if(n) cplxCounts[cxName(ckey)]=n;
        });
        var topCplx=Object.keys(cplxCounts).map(function(k){ return [k,cplxCounts[k]]; })
            .sort(function(a,b){ return b[1]-a[1]; }).slice(0,4);

        var bioInterp={
            'transition zone':'The transition zone acts as a selective gate controlling which proteins enter and exit the cilium. Defects here disrupt Hedgehog and Wnt receptor localisation and are strongly associated with Nephronophthisis and Joubert syndrome.',
            'basal body':'The basal body nucleates and anchors the cilium at the plasma membrane. Genes here control cilia assembly initiation, centrosome maturation, and satellite organisation, with enrichment for Bardet–Biedl, Joubert, and skeletal ciliopathies.',
            'axoneme':'The axoneme is the structural backbone of the cilium built from nine microtubule doublets. Genes here primarily drive motility via dynein arm assembly and are the major determinant of Primary Ciliary Dyskinesia.',
            'ciliary membrane':'The ciliary membrane is compositionally distinct from the plasma membrane, enriched in signalling receptors for Hedgehog, Wnt, and PDGF pathways. Disruption typically causes cilia length changes.',
            'ciliary tip':'The ciliary tip is the zone of IFT turnaround and tubulin addition. Genes here are critical for length homeostasis and characteristically produce elongation or shortening phenotypes.',
            'cilia':'Ciliary genes collectively regulate assembly, maintenance, and signalling. Phenotypic diversity reflects IFT dynamics, membrane composition, tip regulation, and axonemal integrity.'
        };
        var interpText=bioInterp[loc.term]||'Genes localised to the <b>'+loc.label+'</b> compartment regulate its structure and function.';

        setTimeout(function(){ try{ applyUnifiedHighlight(loc.term); }catch(e){} },50);

        var total=genes.length, withPheno=total-phenoCounts.not_reported;
        var topCplxName=topCplx.length?topCplx[0][0]:'—', topCplxN=topCplx.length?topCplx[0][1]:0;

        var out='<div style="line-height:1.5;">';
        out+='<div style="font-size:15px;font-weight:700;color:#005b96;margin-bottom:6px;">'+loc.label+' — Compartment Profile</div>';
        out+='<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:10px 12px;margin-bottom:12px;border-radius:0 8px 8px 0;font-size:12.5px;color:#1e3a5f;line-height:1.6;">'+interpText+'</div>';
        out+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">';
        [{v:total,l:'Total genes',c:'#005b96',bg:'#eff6ff'},
         {v:withPheno,l:'With phenotype data',c:'#7c3aed',bg:'#f5f3ff'},
         {v:topDiseases.length,l:'Ciliopathies',c:'#be185d',bg:'#fdf2f8'},
         {v:topCplxN,l:topCplxN?'in '+topCplxName:'Complex data',c:'#065f46',bg:'#f0fdf4'}
        ].forEach(function(s){
            out+='<div style="background:'+s.bg+';border-radius:8px;padding:8px;text-align:center;">'
                +'<div style="font-size:20px;font-weight:700;color:'+s.c+';">'+s.v+'</div>'
                +'<div style="font-size:10px;color:#64748b;">'+s.l+'</div></div>';
        });
        out+='</div>';
        out+='<div style="margin-bottom:12px;">'
            +'<div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">LoF Phenotype Distribution</div>'
            +'<div style="display:flex;flex-wrap:wrap;gap:6px;">';
        [{k:'shorter',l:'Shorter cilia',c:'red'},{k:'longer',l:'Longer cilia',c:'blue'},
         {k:'loss',l:'Cilia loss',c:'purple'},{k:'no_change',l:'No change in length',c:'green'},
         {k:'motility',l:'Motility defect',c:'amber'},{k:'not_reported',l:'Not reported',c:'gray'}
        ].forEach(function(p){ if(phenoCounts[p.k]) out+=pill(phenoCounts[p.k]+' × '+p.l,p.c); });
        out+='</div></div>';
        if(topDiseases.length){
            out+='<div style="margin-bottom:12px;">'
                +'<div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Top Associated Ciliopathies</div>'
                +'<div style="display:flex;flex-wrap:wrap;gap:5px;">';
            topDiseases.forEach(function(d){ out+=pill(d[0]+' ('+d[1]+')', 'red'); });
            out+='</div></div>';
        }
        if(topCplx.length){
            out+='<div style="margin-bottom:12px;">'
                +'<div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Complex Membership</div>'
                +'<div style="display:flex;flex-wrap:wrap;gap:5px;">';
            topCplx.forEach(function(c){ out+=pill(c[0]+' ('+c[1]+' genes)','green'); });
            out+='</div></div>';
        }
        if(_li2014BySymbol){
            out+='<div style="margin-bottom:10px;">'
                +'<div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Evolutionary Conservation</div>'
                +'<div style="display:flex;flex-wrap:wrap;gap:5px;">';
            var cColors={'Ciliary-specific':'purple','Vertebrate-specific':'green','Mammalian-specific':'blue','Cilia-related':'amber','No data':'gray'};
            Object.keys(conservCounts).forEach(function(cls){ if(conservCounts[cls]) out+=pill(conservCounts[cls]+' × '+cls,cColors[cls]||'gray'); });
            out+='</div></div>';
        }
        out+='<div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">All '+loc.label+' genes ('+total+')</div>'
            +'<div style="line-height:2;">'+genes.slice(0,40).map(function(g){ return chip(g['Gene']); }).join('')
            +(genes.length>40?'<span style="font-size:11px;color:#94a3b8;"> …and '+(genes.length-40)+' more</span>':'')+'</div>'
            +csvLink(genes,['Gene','Localization','lof_effects','Ciliopathy'],loc.term.replace(/\s/g,'_')+'_compartment.csv');
        out+='</div>';
        return out;
    }

    /* ══ FEATURE J: AI HYPOTHESIS GENERATOR ════════════════════════════════════
     * "Genes similar to BBS1" / "Candidates like CEP290" / "Related to IFT88"
     * Multi-dimensional similarity scoring:
     *   localization overlap 40% + phenotype match 30%
     *   + conservation class 15% + domain overlap 15%
     * ═════════════════════════════════════════════════════════════════════════*/
    if (type === 'hypothesis_generator') {
        var qSym=intent.gene.toUpperCase();
        var qGobj=gmap()[qSym];
        if(!qGobj) return 'Gene <b>'+intent.gene+'</b> not found in CiliaHub.';

        function toArr2(v){
            if(!v) return [];
            if(Array.isArray(v)) return v.map(function(s){ return String(s).toLowerCase().trim(); }).filter(Boolean);
            return String(v).split(/[;,]/).map(function(s){ return s.toLowerCase().trim(); }).filter(Boolean);
        }
        function jaccard(a,b){
            if(!a.length&&!b.length) return 0;
            var sa=new Set(a),sb=new Set(b),inter=0;
            sa.forEach(function(v){ if(sb.has(v)) inter++; });
            return new Set([].concat(a).concat(b)).size ? inter/new Set([].concat(a).concat(b)).size : 0;
        }
        var qLoc=toArr2(qGobj['Localization']||qGobj['localization']);
        var qLof=getLOF(qGobj).toLowerCase();
        var qPhylo=getPhyloClass(qSym)||'';
        var qDoms=toArr2((qGobj['Domain_Descriptions']||'')+' '+(qGobj['PFAM_IDs']||''));
        var qDis=toArr2(qGobj['Ciliopathies']||qGobj['Ciliopathy']);

        var scored=db().filter(function(r){ return r['Gene']!==qSym; }).map(function(r){
            var sym=r['Gene'];
            var rLoc=toArr2(r['Localization']||r['localization']);
            var rLof=getLOF(r).toLowerCase();
            var rPhy=getPhyloClass(sym)||'';
            var rDom=toArr2((r['Domain_Descriptions']||'')+' '+(r['PFAM_IDs']||''));
            var rDis=toArr2(r['Ciliopathies']||r['Ciliopathy']);
            var total=Math.round(
                jaccard(qLoc,rLoc)*40
                +((qLof&&rLof&&qLof===rLof)?30:0)
                +((qPhylo&&rPhy&&qPhylo===rPhy)?15:0)
                +jaccard(qDoms,rDom)*15
            );
            var sharedDis=qDis.filter(function(d){ return rDis.indexOf(d)!==-1; });
            var reasons=[];
            if(jaccard(qLoc,rLoc)>0.3)          reasons.push('shared localization: '+rLoc.slice(0,2).join(', '));
            if(qLof&&rLof&&qLof===rLof)          reasons.push('same LoF phenotype ('+rLof+')');
            if(qPhylo&&rPhy&&qPhylo===rPhy)      reasons.push(rPhy+' conservation');
            if(jaccard(qDoms,rDom)>0.25)         reasons.push('domain overlap');
            if(sharedDis.length)                 reasons.push('both in '+sharedDis[0]);
            return {sym:sym,score:total,reason:reasons.slice(0,2).join(' · '),sharedDis:sharedDis,lof:getLOF(r)||'—'};
        });
        scored.sort(function(a,b){ return b.score-a.score; });
        var topHits=scored.filter(function(s){ return s.score>10; }).slice(0,12);

        if(!topHits.length) return 'No strong candidates found similar to <b>'+qSym+'</b> in CiliaHub.<br>'
            +'<span style="font-size:11.5px;color:#888;">Try a gene with annotated localization and phenotype data.</span>';

        var qPhBadge=''; try{ qPhBadge=_li2014BySymbol?phyloBadge(qSym):''; }catch(e){}
        function scoreBadge(s){
            var bg=s>=60?'#dcfce7':s>=35?'#fef3c7':'#f3f4f6',col=s>=60?'#166534':s>=35?'#92400e':'#374151';
            return '<span style="background:'+bg+';color:'+col+';padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;flex-shrink:0;">'+s+'%</span>';
        }
        var out='<div style="line-height:1.5;">';
        out+='<div style="margin-bottom:8px;"><b style="font-size:14px;color:#005b96;">Functional candidates similar to </b>'+chip(qSym)+(qPhBadge||'')+'</div>';
        out+='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:11.5px;">'
            +'<b>Query:</b> '
            +'<span style="color:#7c3aed;">LoF: '+getLOF(qGobj)+'</span> · '
            +'<span style="color:#0f172a;">Loc: '+(qLoc.slice(0,2).join(', ')||'—')+'</span> · '
            +'<span style="color:#065f46;">Conservation: '+(qPhylo||'—')+'</span>'
            +'</div>';
        out+='<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:7px 10px;margin-bottom:10px;border-radius:0 6px 6px 0;font-size:11px;color:#78350f;">'
            +'⚡ AI-ranked by localization (40%), phenotype (30%), conservation (15%), domain similarity (15%). Experimental validation required.</div>';
        out+='<div style="display:flex;flex-direction:column;gap:6px;">';
        topHits.forEach(function(h,i){
            var ph=''; try{ ph=_li2014BySymbol?phyloBadge(h.sym):''; }catch(e){}
            var disHtml=h.sharedDis.length?'<span style="font-size:10px;color:#be185d;"> · '+h.sharedDis[0]+'</span>':'';
            out+='<div style="display:flex;align-items:center;gap:8px;background:'+(i===0?'#eff6ff':'white')+';'
                +'border:1px solid '+(i===0?'#bfdbfe':'#e2e8f0')+';border-radius:8px;padding:7px 10px;">'
                +'<span style="font-size:11px;color:#94a3b8;font-weight:600;min-width:18px;">'+(i+1)+'.</span>'
                +chip(h.sym)+(ph||'')
                +'<div style="flex:1;font-size:11px;color:#475569;">'+h.reason+disHtml+'</div>'
                +'<div style="font-size:11px;color:#64748b;flex-shrink:0;">LoF: <b>'+h.lof+'</b></div>'
                +scoreBadge(h.score)+'</div>';
        });
        out+='</div>';
        out+='<div style="margin-top:8px;font-size:11px;color:#94a3b8;">Based on '+db().length+' CiliaHub genes · Click any chip to view full profile</div>';
        out+='</div>';
        return out;
    }

    /* lof_gene kept as alias for backward compatibility (older ciliai.js Router calls) */

    if (type === 'lof_gene') {
        return dispatch({type:'gene_overview', gene:intent.gene});
    }

    if (type === 'domain_count') {
        var matches = db().filter(function(r){ return hasDomain(r, intent.domain); });
        return 'There are <b>'+matches.length+' ciliary genes</b> in CiliaHub with a <b>'+intent.domain+'</b> domain.<br>'
            +'<span style="font-size:11.5px;color:#888;">Ask "list genes with '+intent.domain+' domains" to see them all.</span>';
    }

    if (type === 'domain_list') {
        var matches = db().filter(function(r){ return hasDomain(r, intent.domain); });
        if (!matches.length) return 'No genes found with <b>'+intent.domain+'</b> domain in CiliaHub.';
        return '<b>'+intent.domain+' domain</b> — <b>'+matches.length+' genes</b>:<br>'
            +'<div style="margin-top:8px;line-height:1.8;">'+matches.slice(0,60).map(function(g){ return chip(g['Gene']); }).join('')+'</div>'
            +(matches.length>60 ? '<p style="color:#888;font-size:11px">Showing 60 of '+matches.length+'</p>' : '')
            +csvLink(matches,['Gene','Domain_Descriptions','PFAM_IDs','Localization'],intent.domain.replace(/\s/g,'_')+'_genes.csv');
    }

    if (type === 'domain_enrichment') {
        var counts = {};
        db().forEach(function(r){ Object.keys(DOMAIN_TERMS).forEach(function(fam){ if (hasDomain(r,fam)) counts[fam]=(counts[fam]||0)+1; }); });
        var sorted = Object.keys(counts).map(function(k){ return [k,counts[k]]; }).sort(function(a,b){ return b[1]-a[1]; });
        return '<b>Most common protein domains in CiliaHub:</b><br>'+tbl(['Domain','Gene Count'],sorted.map(function(d){ return [pill(d[0],'purple'),d[1]]; }));
    }

    if (type === 'domain_gene') {
        var gobj = gmap()[intent.gene.toUpperCase()];
        if (!gobj) return 'Gene <b>'+intent.gene+'</b> not found in CiliaHub.';
        var desc = gobj['Domain_Descriptions'] || '';
        var pfam = gobj['PFAM_IDs'] || '';
        var parts = (desc+(pfam?';'+pfam:'')).split(/[,;]/).map(function(s){ return s.trim(); }).filter(Boolean);
        if (win.showDomainViewer) win.showDomainViewer(intent.gene);
        return '<b>'+intent.gene+'</b> protein domains:<br>'
            +'<div style="margin-top:6px;">'+(parts.length ? parts.map(function(d){ return pill(d,'purple'); }).join(' ') : '<span style="color:#aaa">No domain data.</span>')+'</div>';
    }

    if (type === 'loc_phenotype') {
        var loc = intent.loc;
        var matches = db().filter(function(r){ return getLoc(r).indexOf(loc.term) !== -1 && lofMatches(r,intent.effect); });
        if (!matches.length) return 'No <b>'+loc.label+'</b> genes found with <b>'+intent.effect.replace('_',' ')+'</b> cilia phenotype on LoF.';
        return '<b>'+loc.label+'</b> genes with LoF <b>'+intent.effect.replace('_',' ')+'</b> cilia phenotype — <b>'+matches.length+' genes</b>:<br>'
            +tbl(['Gene','LoF effect','Overexpression (length / ciliogenesis)','Disease'],matches.slice(0,40).map(function(g){
                var dis = g['Ciliopathy'] && g['Ciliopathy'] !== 'N/A' ? pill(g['Ciliopathy'].split(',')[0].trim(),'red') : '-';
                var oe  = getOE(g) || '-';
                return [chip(g['Gene']), getLOF(g)||'-', oe, dis];
            }),40)
            +csvLink(matches,['Gene','Localization','lof_effects','overexpression_effects','Ciliopathy'],loc.term.replace(/\s/g,'_')+'_'+intent.effect+'.csv');
    }

    /* ── NEW: oe_lof_combo ───────────────────────────────────────────────────
     * "genes where overexpression increases cilia length but LoF has no effect"
     * Applies BOTH an OE filter AND a LoF filter simultaneously.
     * Optional loc filter narrows to a specific structure.
     */
    if (type === 'oe_lof_combo') {
        var matches = db().filter(function(r){
            var passOE  = oefMatches(r, intent.oeEffect);
            var passLoF = lofMatches(r, intent.lofEffect);
            var passLoc = !intent.loc || getLoc(r).indexOf(intent.loc.term) !== -1;
            return passOE && passLoF && passLoc;
        });

        var oeLabel  = intent.oeEffect  === 'longer'    ? 'increases cilia length'
                     : intent.oeEffect  === 'shorter'   ? 'decreases cilia length'
                     : intent.oeEffect  === 'no_effect' ? 'no change in cilia length or ciliogenesis'
                     : intent.oeEffect  === 'loss'      ? 'causes cilia loss / blocks ciliogenesis'
                     : intent.oeEffect;
        var lofLabel = intent.lofEffect === 'no_effect' ? 'no change in cilia length on LoF'
                     : intent.lofEffect === 'shorter'   ? 'shorter cilia on LoF'
                     : intent.lofEffect === 'longer'    ? 'longer cilia on LoF'
                     : intent.lofEffect === 'loss'      ? 'cilia loss on LoF'
                     : intent.lofEffect === 'knockdown' ? 'knockdown phenotype'
                     : intent.lofEffect;

        if (!matches.length) {
            return 'No genes found where overexpression <b>'+oeLabel+'</b> AND LoF gives <b>'+lofLabel+'</b>.<br>'
                +'<span style="font-size:11.5px;color:#888;">Try relaxing one of the filters.</span>';
        }

        var locNote = intent.loc ? ' in <b>'+intent.loc.label+'</b>' : '';
        return 'Genes where OE <b>'+oeLabel+'</b> but <b>'+lofLabel+'</b>'+locNote+' — <b>'+matches.length+' gene'+(matches.length!==1?'s':'')+'</b>:<br>'
            +tbl(
                ['Gene','Overexpression (length / ciliogenesis)','LoF effect','Localization','Disease'],
                matches.map(function(g){
                    var dis = g['Ciliopathy'] && g['Ciliopathy'] !== 'N/A'
                        ? pill(g['Ciliopathy'].split(',')[0].trim(),'red') : '-';
                    return [
                        chip(g['Gene']),
                        pill(getOE(g)||'-','green'),
                        pill(getLOF(g)||'-','amber'),
                        g['Localization']||'-',
                        dis
                    ];
                })
            )
            +csvLink(matches,['Gene','overexpression_effects','lof_effects','Localization','Ciliopathy'],'oe_lof_combo_genes.csv');
    }

    /* ── NEW: oe_filter ──────────────────────────────────────────────────────
     * "genes where overexpression increases cilia length"
     * Pure OE filter with no LoF constraint.
     */
    if (type === 'oe_filter') {
        var matches = db().filter(function(r){
            var passOE  = oefMatches(r, intent.oeEffect);
            var passLoc = !intent.loc || getLoc(r).indexOf(intent.loc.term) !== -1;
            return passOE && passLoc;
        });

        var oeLabel = intent.oeEffect === 'longer'    ? 'increases cilia length'
                    : intent.oeEffect === 'shorter'   ? 'decreases cilia length'
                    : intent.oeEffect === 'no_effect' ? 'no change in cilia length or ciliogenesis'
                    : intent.oeEffect === 'loss'      ? 'causes cilia loss / blocks ciliogenesis'
                    : intent.oeEffect;

        if (!matches.length) return 'No genes found where overexpression <b>'+oeLabel+'</b>.';

        var locNote = intent.loc ? ' in <b>'+intent.loc.label+'</b>' : '';
        return 'Genes where overexpression <b>'+oeLabel+'</b>'+locNote+' — <b>'+matches.length+' gene'+(matches.length!==1?'s':'')+'</b>:<br>'
            +tbl(
                ['Gene','Overexpression (length / ciliogenesis)','LoF effect','Localization','Disease'],
                matches.map(function(g){
                    var dis = g['Ciliopathy'] && g['Ciliopathy'] !== 'N/A'
                        ? pill(g['Ciliopathy'].split(',')[0].trim(),'red') : '-';
                    return [
                        chip(g['Gene']),
                        pill(getOE(g)||'-','green'),
                        getLOF(g) || pill('not reported','gray'),
                        g['Localization']||'-',
                        dis
                    ];
                })
            )
            +csvLink(matches,['Gene','overexpression_effects','lof_effects','Localization','Ciliopathy'],'oe_'+intent.oeEffect+'_genes.csv');
    }

    /* ── NEW: lof_filter ─────────────────────────────────────────────────────
     * General LoF-only filter: "genes where LoF has no effect"
     * Replaces the old lof_conserved_tissue which was too narrowly triggered.
     * Always shows OE column alongside LoF.
     */
    if (type === 'lof_filter') {
        var matches = db().filter(function(r){ return lofMatches(r, intent.effect); });

        var effectLabel = intent.effect === 'no_effect' ? 'no change in cilia length'
                        : intent.effect === 'shorter'   ? 'shorter cilia'
                        : intent.effect === 'longer'    ? 'longer / elongated cilia'
                        : intent.effect === 'loss'      ? 'cilia loss'
                        : intent.effect === 'motility'  ? 'motility defect'
                        : intent.effect === 'knockdown' ? 'knockdown phenotype'
                        : intent.effect.replace('_',' ');

        if (!matches.length) return 'No genes found with <b>'+effectLabel+'</b> on LoF.';

        /* Sort: genes that also have OE data float to top */
        matches.sort(function(a,b){
            var aHasOE = getOE(a) && getOE(a).indexOf('not reported') === -1 ? 0 : 1;
            var bHasOE = getOE(b) && getOE(b).indexOf('not reported') === -1 ? 0 : 1;
            return aHasOE - bHasOE;
        });

        return 'Genes with <b>'+effectLabel+'</b> on LoF — <b>'+matches.length+' genes</b>:<br>'
            +tbl(
                ['Gene','LoF effect','Overexpression (length / ciliogenesis)','Localization','Disease'],
                matches.map(function(g){
                    var dis = g['Ciliopathy'] && g['Ciliopathy'] !== 'N/A'
                        ? pill(g['Ciliopathy'].split(',')[0].trim(),'red') : '-';
                    var oe = getOE(g);
                    var oeCell = oe && oe.indexOf('not reported') === -1
                        ? pill(oe,'green') : '<span style="color:#b0bec5;font-size:11px;">not reported</span>';
                    return [
                        chip(g['Gene']),
                        pill(getLOF(g)||'-','amber'),
                        oeCell,
                        g['Localization']||'-',
                        dis
                    ];
                })
            )
            +(intent.tissue ? tisNote(intent.tissue) : '')
            +csvLink(matches,['Gene','lof_effects','overexpression_effects','Localization','Ciliopathy'],
                'lof_'+intent.effect+'_genes.csv');
    }

    if (type === 'lof_conserved_tissue') {
        /* Legacy handler — kept for backward compat with phylogeny conservation queries */
        var matches = db().filter(function(r){ return lofMatches(r,'no_effect'); });
        matches.sort(function(a,b){
            var aOE = getOE(a) && getOE(a).indexOf('not reported') === -1 ? 0 : 1;
            var bOE = getOE(b) && getOE(b).indexOf('not reported') === -1 ? 0 : 1;
            return aOE - bOE;
        });
        return 'Genes with <b>no change in cilia length</b> on LoF — <b>'+matches.length+' genes</b>:<br>'
            +tbl(
                ['Gene','LoF effect','Overexpression (length / ciliogenesis)','Localization'],
                matches.map(function(g){
                    var oe = getOE(g);
                    var oeCell = oe && oe.indexOf('not reported') === -1
                        ? pill(oe,'green') : '<span style="color:#b0bec5;font-size:11px;">not reported</span>';
                    return [chip(g['Gene']), pill(getLOF(g)||'-','amber'), oeCell, getLoc(g)||'-'];
                })
            )
            +(intent.tissue ? tisNote(intent.tissue) : '')
            +'<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">For conservation filtering, use the Phylogeny tab and select "in_all_organisms".</div>'
            +csvLink(matches,['Gene','lof_effects','overexpression_effects','Localization','Ciliopathy'],'lof_no_effect_genes.csv');
    }

    if (type === 'loc_disease') {
        var loc = intent.loc;
        var matches = db().filter(function(r){ return getLoc(r).indexOf(loc.term)!==-1 && diseaseMatches(r,intent.disease); });
        if (!matches.length) return 'No <b>'+loc.label+'</b> genes found associated with <b>'+disName(intent.disease)+'</b>.';
        return '<b>'+loc.label+'</b> genes associated with <b>'+disName(intent.disease)+'</b> — <b>'+matches.length+' genes</b>:<br>'
            +tbl(['Gene','Localization','Disease'],matches.map(function(g){ return [chip(g['Gene']),g['Localization']||'-',(g['Ciliopathy']||'').split(',').slice(0,2).join('; ')]; }))
            +csvLink(matches,['Gene','Localization','Ciliopathy'],loc.term.replace(/\s/g,'_')+'_'+intent.disease+'.csv');
    }

    /* ── NEW: loc_disease_tissue — 3-way intersection ───────────────────────
     * e.g. "Nephronophthisis transition zone genes expressed in proximal tubule cells"
     * Filters by: localization AND disease AND tissue/cell-type.
     * The tissue filter is advisory (CiliaHub has no per-cell expression)
     * so we apply loc+disease as hard filters and add a prominent tissue note.
     */
    if (type === 'loc_disease_tissue') {
        var loc = intent.loc;
        var matches = db().filter(function(r){
            return getLoc(r).indexOf(loc.term) !== -1 && diseaseMatches(r, intent.disease);
        });

        var tisHuman = tisName(intent.tissue);
        var summary = '<b>'+loc.label+'</b> genes associated with <b>'+disName(intent.disease)
            +'</b>, relevant to <b>'+tisHuman+'</b>';

        if (!matches.length) {
            return summary+' — <b>0 genes found</b>.<br>'
                +'<span style="font-size:11.5px;color:#888;">No genes match both the localization and disease filters.</span>';
        }

        return summary+' — <b>'+matches.length+' gene'+(matches.length!==1?'s':'')+'</b>:<br>'
            +tbl(
                ['Gene','Localization','Disease'],
                matches.map(function(g){
                    return [
                        chip(g['Gene']),
                        g['Localization'] || '-',
                        (g['Ciliopathy']||'').split(',').slice(0,3).map(function(d){ return d.trim(); }).filter(Boolean).join('; ') || '-'
                    ];
                })
            )
            +tisNote(intent.tissue)
            +csvLink(matches,['Gene','Localization','Ciliopathy'],
                loc.term.replace(/\s/g,'_')+'_'+intent.disease+'_'+intent.tissue+'.csv');
    }

    if (type === 'loc_tissue') {
        var loc = intent.loc;
        var matches = db().filter(function(r){ return getLoc(r).indexOf(loc.term)!==-1; });
        if (!matches.length) return 'No genes found with <b>'+loc.label+'</b> localization.';
        return '<b>'+loc.label+'</b> genes (context: <b>'+tisName(intent.tissue)+'</b>) — <b>'+matches.length+' genes</b>:<br>'
            +tbl(['Gene','Localization','Disease'],matches.slice(0,40).map(function(g){
                var dis=g['Ciliopathy']&&g['Ciliopathy']!=='N/A'?pill(g['Ciliopathy'].split(',')[0].trim(),'red'):'-';
                return [chip(g['Gene']),g['Localization']||'-',dis];
            }),40)
            +tisNote(intent.tissue)
            +csvLink(matches,['Gene','Localization','Ciliopathy'],loc.term.replace(/\s/g,'_')+'_'+intent.tissue+'.csv');
    }

    if (type === 'disease_tissue') {
        var matches = db().filter(function(r){ return diseaseMatches(r,intent.disease); });
        if (!matches.length) return 'No genes found for <b>'+disName(intent.disease)+'</b>.';
        var note = intent.exclude
            ? '<div style="background:#fff7ed;border-left:3px solid #f97316;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#9a3412;">Tissue-specific exclusion for <b>'+tisName(intent.tissue)+'</b> requires expression data. All '+disName(intent.disease)+' genes are listed.</div>'
            : tisNote(intent.tissue);
        if (win.showPlot) {
            var locC={};
            matches.forEach(function(g){ (g['Localization']||'').split(',').forEach(function(l){ l=l.trim().toLowerCase(); if(l) locC[l]=(locC[l]||0)+1; }); });
            var sorted=Object.keys(locC).map(function(k){return[k,locC[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,12);
            win.showPlot({data:[{type:'bar',orientation:'h',x:sorted.map(function(d){return d[1];}).reverse(),y:sorted.map(function(d){return d[0];}).reverse(),marker:{color:'#005b96'}}],layout:{title:{text:disName(intent.disease)+' - localization',font:{size:13}},xaxis:{title:'Genes'},yaxis:{automargin:true}}},disName(intent.disease));
        }
        return '<b>'+disName(intent.disease)+'</b> genes (context: <b>'+tisName(intent.tissue)+'</b>) — <b>'+matches.length+' genes</b>:<br>'
            +tbl(['Gene','Localization','Disease'],matches.slice(0,40).map(function(g){ return [chip(g['Gene']),g['Localization']||'-',(g['Ciliopathy']||'').split(',').slice(0,2).join('; ')]; }),40)
            +note+csvLink(matches,['Gene','Localization','Ciliopathy'],intent.disease+'_genes.csv');
    }

    if (type === 'disease_complex') {
        var matches = db().filter(function(r){ return inComplex(r['Gene'],intent.complex) && diseaseMatches(r,intent.disease); });
        if (!matches.length) return 'No genes in both <b>'+disName(intent.disease)+'</b> and <b>'+cxName(intent.complex)+'</b>.';
        return '<b>'+disName(intent.disease)+'</b> intersect <b>'+cxName(intent.complex)+'</b> — <b>'+matches.length+' gene'+(matches.length!==1?'s':'')+'</b>:<br>'
            +'<div style="margin-top:6px;">'+matches.map(function(g){ return chip(g['Gene']); }).join('')+'</div><br>'
            +tbl(['Gene','Localization','Disease'],matches.map(function(g){ return [chip(g['Gene']),g['Localization']||'-',(g['Ciliopathy']||'').split(',').slice(0,2).join('; ')]; }))
            +csvLink(matches,['Gene','Localization','Ciliopathy'],intent.disease+'_'+intent.complex+'.csv');
    }

    if (type === 'complex_phylo_compare') {
        var genesA = COMPLEX_SETS[intent.complexA] || [];
        var genesB = COMPLEX_SETS[intent.complexB] || [];
        var overlap = genesA.filter(function(g){ return genesB.indexOf(g)!==-1; });
        var seen = {};
        var allSymbols = genesA.concat(genesB).filter(function(s){ if(seen[s])return false; seen[s]=true; return true; });
        _lastPhyloGenes = allSymbols;
        _lastPhyloNames = cxName(intent.complexA)+' vs '+cxName(intent.complexB);
        renderPhyloPlot(allSymbols);
        var btn = '<div style="margin-top:10px;">'
            +'<button onclick="window._ciliaiShowLastPhylo&&window._ciliaiShowLastPhylo()" '
            +'style="background:#005b96;color:white;border:none;padding:8px 18px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">'
            +'Redraw Heatmap in Plot View</button></div>';
        return '<b>Phylogenetic comparison: '+cxName(intent.complexA)+' vs '+cxName(intent.complexB)+'</b><br><br>'
            +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
            +'<div><b style="color:#005b96;">'+cxName(intent.complexA)+'</b> ('+genesA.length+' genes)<br><div style="margin-top:4px;">'+genesA.map(function(g){return chip(g);}).join('')+'</div></div>'
            +'<div><b style="color:#7c3aed;">'+cxName(intent.complexB)+'</b> ('+genesB.length+' genes)<br><div style="margin-top:4px;">'+genesB.map(function(g){return chip(g);}).join('')+'</div></div>'
            +'</div>'
            +(overlap.length ? '<br><b>Shared genes:</b> '+overlap.map(function(g){return chip(g);}).join('') : '')
            +btn;
    }

    /* ── FIX #2 — phylo_domain now uses Li2014 class-based filtering ────────
     * Old code: just searched Domain_Descriptions text, ignored scope entirely.
     * New code: filters gene list by Li2014 class (c===3 for vertebrate, etc.)
     *           then intersects with domain match.
     * If Li2014 not yet loaded, shows a loading message and triggers load.
     */
    if (type === 'phylo_domain') {
        var domainMatches = db().filter(function(r){ return hasDomain(r, intent.domain); });
        if (intent.scope !== 'all' && intent.scope) {
            if (!_li2014BySymbol) {
                /* Li2014 not loaded yet — trigger load and tell user to re-ask */
                loadLi2014(function(){
                    say('<b>Li et al. 2014 phylogeny data loaded.</b> Please re-ask your question.');
                });
                return '<span style="color:#92400e;">Loading Li et al. (2014) phylogeny matrix... This takes a few seconds. Please re-ask in a moment.</span>';
            }
            var filterFn = intent.scope === 'vertebrate'      ? isVertebrateSpecific
                         : intent.scope === 'mammalian'       ? isMammalianSpecific
                         : intent.scope === 'ciliary_specific' ? isCiliarySpecific
                         : function(){ return true; };
            domainMatches = domainMatches.filter(function(r){ return filterFn(r['Gene']); });
        }
        var scopeLabel = intent.scope === 'vertebrate' ? 'vertebrate-specific '
                        : intent.scope === 'mammalian' ? 'mammalian-specific '
                        : intent.scope === 'ciliary_specific' ? 'ciliary-specific '
                        : '';
        if (!domainMatches.length) {
            return 'No '+scopeLabel+'ciliary genes found with <b>'+intent.domain+'</b> domain'
                +(intent.scope && intent.scope !== 'all' ? ' (per Li et al. 2014 classification).' : '.')
                +'<br><span style="font-size:11.5px;color:#888;">This is the correct answer — these genes are conserved across non-vertebrates.</span>';
        }
        return scopeLabel.charAt(0).toUpperCase()+scopeLabel.slice(1)+'ciliary genes with <b>'+intent.domain+'</b> domain'
            +(intent.scope && intent.scope !== 'all' ? ' (Li et al. 2014)' : '')
            +' — <b>'+domainMatches.length+' genes</b>:<br>'
            +'<div style="margin-top:8px;line-height:1.8;">'+domainMatches.slice(0,60).map(function(g){
                return chip(g['Gene'])+((_li2014BySymbol)?phyloBadge(g['Gene']):'');
            }).join('')+'</div>'
            +(domainMatches.length>60?'<p style="color:#888;font-size:11px">Showing 60 of '+domainMatches.length+'</p>':'')
            +(_li2014BySymbol && intent.scope === 'all'
                ? '<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">Add "vertebrate-specific" to filter by evolutionary conservation.</div>'
                : '')
            +csvLink(domainMatches,['Gene','Domain_Descriptions','PFAM_IDs'],intent.domain+'_'+intent.scope+'_genes.csv');
    }

    /* ── FIX #1 — pfam_filter with correct scope-based phylogenetic filtering ─
     * Old code: used string .indexOf(pfam) — matched substrings, ignored scope.
     * New code:
     *   - Uses hasPfam() with word-boundary regex for exact matching
     *   - When scope === 'vertebrate', cross-references Li2014 (c===3)
     *   - When Li2014 not loaded, triggers async load and defers with message
     *   - Shows clear "0 genes" result when correct answer is zero
     */
    if (type === 'pfam_filter') {
        /* Step 1: find all CiliaHub genes with this exact PFAM accession */
        var allPfamMatches = db().filter(function(r){ return hasPfam(r, intent.pfam); });

        if (!allPfamMatches.length) {
            return 'No CiliaHub genes found with PFAM accession <b>'+intent.pfam+'</b>.';
        }

        /* Step 2: if a phylogenetic scope was requested, apply Li2014 filter */
        if (intent.scope && intent.scope !== 'all') {
            if (!_li2014BySymbol) {
                /* Trigger async load; show deferred message */
                loadLi2014(function(){
                    say('<b>Li et al. (2014) phylogeny data ready.</b> Please re-ask: "'
                        +(intent.scope==='vertebrate'?'Vertebrate-specific ':'')+' genes with PFAM '+intent.pfam+'"');
                });
                return '<span style="color:#92400e;">Loading Li et al. (2014) phylogeny matrix '
                    +'('+allPfamMatches.length+' genes found with '+intent.pfam+')...<br>'
                    +'Please re-ask in a few seconds once loading completes.</span>';
            }

            var phyloFilter = intent.scope === 'vertebrate'      ? isVertebrateSpecific
                            : intent.scope === 'mammalian'       ? isMammalianSpecific
                            : intent.scope === 'ciliary_specific' ? isCiliarySpecific
                            : function(){ return true; };

            var phyloMatches = allPfamMatches.filter(function(r){ return phyloFilter(r['Gene']); });
            var scopeLbl = intent.scope === 'vertebrate' ? 'Vertebrate-specific'
                         : intent.scope === 'mammalian'  ? 'Mammalian-specific'
                         : 'Ciliary-specific';

            if (!phyloMatches.length) {
                /* Correct answer is zero — explain clearly */
                var nonVertRows = allPfamMatches.slice(0,15).map(function(g){
                    var cls = getPhyloClass(g['Gene']) || 'not in Li2014';
                    var entry = _li2014BySymbol ? _li2014BySymbol[g['Gene'].toUpperCase()] : null;
                    var nonVert = entry ? entry.s.filter(function(i){ return i < LI_VERT_MIN || i > LI_VERT_MAX; }).length : '?';
                    return [chip(g['Gene']), g['Localization']||'-', phyloBadge(g['Gene'])||cls,
                            nonVert ? '<span style="color:#dc2626;font-size:11px;">+'+nonVert+' non-vertebrate sp.</span>' : '—'];
                });
                return '<b>'+scopeLbl+' genes with PFAM '+intent.pfam+':</b> <b style="color:#dc2626;">0 found</b><br>'
                    +'<div style="background:#fef2f2;border-left:3px solid #ef4444;padding:10px 14px;margin:8px 0;border-radius:0 6px 6px 0;font-size:12px;color:#7f1d1d;">'
                    +'<b>This is the correct answer.</b> All '+allPfamMatches.length+' gene'+(allPfamMatches.length!==1?'s':'')+' with this domain '
                    +'are conserved across non-vertebrate organisms and are classified as <b>Cilia_related</b> or broader classes '
                    +'in the Li et al. (2014) matrix — not Vertebrate_specific.'
                    +'</div>'
                    +'<p style="font-size:12px;color:#475569;margin-bottom:4px;">All '+allPfamMatches.length+' genes with PFAM '+intent.pfam+' (for reference):</p>'
                    +tbl(['Gene','Localization','Li2014 class','Non-vertebrate presence'], nonVertRows, 15)
                    +csvLink(allPfamMatches,['Gene','PFAM_IDs','Domain_Descriptions','Localization'],intent.pfam+'_all_genes.csv');
            }

            /* Vertebrate-specific genes found */
            return '<b>'+scopeLbl+' genes with PFAM <b>'+intent.pfam+'</b> (Li et al. 2014) — <b>'+phyloMatches.length+' gene'+(phyloMatches.length!==1?'s':'')+'</b>:<br>'
                +tbl(['Gene','Domain descriptions','Localization','Li2014 class'],
                    phyloMatches.map(function(g){
                        return [chip(g['Gene']),
                                (g['Domain_Descriptions']||'').slice(0,60),
                                g['Localization']||'-',
                                phyloBadge(g['Gene'])];
                    }))
                +csvLink(phyloMatches,['Gene','PFAM_IDs','Domain_Descriptions','Localization'],intent.pfam+'_'+intent.scope+'_genes.csv');
        }

        /* No scope filter — return all genes with this PFAM (with phylo badges if available) */
        return 'Genes with PFAM <b>'+intent.pfam+'</b> — <b>'+allPfamMatches.length+' genes</b>:<br>'
            +tbl(['Gene','Domain descriptions','Localization','Li2014 class'],
                allPfamMatches.map(function(g){
                    return [chip(g['Gene']),
                            (g['Domain_Descriptions']||'').slice(0,60),
                            g['Localization']||'-',
                            _li2014BySymbol ? (phyloBadge(g['Gene'])||'—') : '—'];
                }))
            +csvLink(allPfamMatches,['Gene','PFAM_IDs','Domain_Descriptions','Localization'],intent.pfam+'_genes.csv');
    }

    return null;
}

/* ─── INSTALL ─────────────────────────────────────────────────────────────── */

/* say() always reads win.addChatMessage at call-time so it works regardless
 * of how many times the function has been replaced by patches.              */
function say(html) {
    if (typeof win.addChatMessage === 'function') win.addChatMessage(html, false);
}

/* ── GUARD ──────────────────────────────────────────────────────────────────
 * The guard intercepts addChatMessage to block ciliai.js's own AI responses
 * when we have already handled the query (suppression window).
 *
 * PROBLEM: ciliai-enhancements.js patches addChatMessage at 500ms and 1500ms.
 * Each patch creates a new function that does NOT carry __guardInstalled, so
 * install() would see a fresh function and re-wrap it on its 300/800/2000ms
 * retries — stacking three guards and causing unwanted suppressions.
 *
 * SOLUTION: use a stable flag on the window object (_ciliai_guard_active)
 * that survives any number of function replacements. Only one guard layer
 * is ever installed. When enhancements.js wraps addChatMessage, our flag
 * is still set so we don't re-wrap.
 */
function installGuard() {
    if (!win.addChatMessage) return;
    if (win._ciliai_guard_active) return; /* already installed — don't stack */

    var origAdd = win.addChatMessage;
    win.addChatMessage = function(html, isUser) {
        if (isUser) return origAdd.call(this, html, isUser);
        if (_suppressing) {
            console.debug('[CiliAI Interceptor] Blocked ciliai.js message');
            return;
        }
        return origAdd.call(this, html, isUser);
    };
    /* Copy any existing properties so downstream patches still see them */
    win.addChatMessage.__guardInstalled = true;
    win._ciliai_guard_active = true; /* stable sentinel on window — survives rewraps */
    console.log('[CiliAI Interceptor] Guard installed');
}

/*
 * wrap() patches a CiliAI query-handler function to intercept queries.
 * When matchIntent returns a result, we:
 *   1. Temporarily stop suppression so say() can deliver the HTML
 *   2. Call say(html) to render the interceptor's response
 *   3. Start suppression AFTER, so ciliai.js's own async response is blocked
 * This ordering prevents the guard from blocking our own say() call.
 */
function wrap(originalFn) {
    var wrapped = function(queryOrOpts) {
        var text = (typeof queryOrOpts === 'string') ? queryOrOpts
                 : (queryOrOpts && (queryOrOpts.text || queryOrOpts.raw || ''));
        if (!text || !text.trim()) return originalFn.apply(this, arguments);
        var intent = matchIntent(text);
        if (intent) {
            var html = dispatch(intent);
            if (html !== null && html !== undefined) {
                /* Pause suppression so our own message is not blocked */
                var wasSuppressing = _suppressing;
                _suppressing = false;
                if (html !== '') say(html); /* empty string = PATH 1 bridge already rendered */
                /* Re-arm suppression to block ciliai.js's async AI response */
                startSuppression();
                return; /* intercepted */
            }
        }
        return originalFn.apply(this, arguments);
    };
    wrapped.__intercepted = true;
    wrapped.__originalFn  = originalFn;
    return wrapped;
}

function install() {
    if (typeof win.handleAIQuery === 'function' && !win.handleAIQuery.__intercepted) {
        win.handleAIQuery = wrap(win.handleAIQuery);
        console.log('[CiliAI Interceptor] Patched handleAIQuery');
    }
    if (win.CiliAI && win.CiliAI.Router && typeof win.CiliAI.Router.dispatchAction === 'function'
            && !win.CiliAI.Router.dispatchAction.__intercepted) {
        win.CiliAI.Router.dispatchAction = wrap(win.CiliAI.Router.dispatchAction);
        console.log('[CiliAI Interceptor] Patched Router.dispatchAction');
    }
    ['processQuery','routeQuery','handleQuery','processMessage'].forEach(function(name){
        if (win.CiliAI && typeof win.CiliAI[name] === 'function' && !win.CiliAI[name].__intercepted) {
            win.CiliAI[name] = wrap(win.CiliAI[name]);
            console.log('[CiliAI Interceptor] Patched CiliAI.'+name);
        }
    });
    /* Guard installed once only — window-level sentinel prevents re-stacking */
    installGuard();
}

install();
setTimeout(install, 300);
setTimeout(install, 800);
/* NOTE: No 2000ms retry — by that point ciliai-enhancements.js has patched
 * addChatMessage (at 500ms + 1500ms). A late install() would see a new
 * addChatMessage that looks un-guarded and stack a second guard on top.
 * The window._ciliai_guard_active sentinel handles this case safely. */

/* Eagerly start loading Li2014 in the background so it's ready when needed */
setTimeout(function(){ loadLi2014(null); }, 1500);

win._CiliAI_Interceptor = {
    matchIntent:     matchIntent,
    dispatch:        dispatch,
    li2014BySymbol:  function(){ return _li2014BySymbol; },
    startSuppression: startSuppression,
    stopSuppression:  stopSuppression,
    isSuppressing:    function(){ return _suppressing; }
};
win._ciliaiShowLastPhylo = function() {
    if (_lastPhyloGenes && _lastPhyloGenes.length) {
        var rendered = renderPhyloPlot(_lastPhyloGenes);
        say(rendered
            ? 'Heatmap for <b>'+(_lastPhyloNames||'genes')+'</b> shown in Plot view (left panel).'
            : 'Phylogeny function not yet available. Use the Cilia Analysis page, Phylogeny tab.');
        startSuppression();
    }
};
console.log('[CiliAI Interceptor v4.2] Guard singleton · wrap() ordering fix · suppression 1800ms loaded.');

})(window);
