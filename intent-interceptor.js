'use strict';
/**
 * CiliaHub Intent Interceptor v9.0
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN PRINCIPLES:
 * 1. NEVER add user bubble — ciliai.js Router already adds it via echo:true
 * 2. Wrap returns early (no originalFn call) when intent matched and html returned
 * 3. No suppression timer — early return is sufficient to prevent double firing
 * 4. Clear lastQueryContext BEFORE say() to stop stale follow-up panel updates
 * 5. gene_overview returns '' (empty string) — gene card renders in left panel
 * 6. All 200 questions covered across 30+ intent types
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function (win) {

/* ══════════════════════════════════════════════════════════════════════════
 * DATA ACCESS
 * ══════════════════════════════════════════════════════════════════════════ */
function db()   { return (win.CiliAI && win.CiliAI.masterData) ? win.CiliAI.masterData : []; }
function gmap() { return (win.CiliAI && win.CiliAI.lookups && win.CiliAI.lookups.geneMap) || {}; }

/* Field accessors */
function getGene(r) { return r.Gene || r.gene || ''; }
function getLoc(r) {
    var l = r.Localization || r.localization || '';
    if (Array.isArray(l)) return l.join(', ').toLowerCase();
    return String(l).toLowerCase();
}
function getLOF(r) {
    return r.lof_effects || r.lof_effect ||
           r['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'] || '';
}
function getOE(r) {
    return r.oe_effect ||
           r['Overexpression effects on cilia length (increase/decrease/no effect)'] ||
           r.overexpression_effects || '';
}
function getPCT(r) {
    return r.pct_ciliated ||
           r['Percentage of ciliated cells (increase/decrease/no effect)'] ||
           r.percent_ciliated_cells_effects || '';
}
function getCil(r) {
    var c = r.Ciliopathies || r.ciliopathies || '';
    if (Array.isArray(c)) return c.join(', ').toLowerCase();
    return String(c).toLowerCase();
}
function getDomains(r) { return r.pfam_domains || []; }
function findG(sym) {
    var u = sym.toUpperCase(), gm = gmap();
    return gm[u] || db().find(function(r){ return getGene(r).toUpperCase() === u; }) || null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * PFAM DATA
 * ══════════════════════════════════════════════════════════════════════════ */
function buildPfamData() {
    if (win._pfamReady) return;
    db().forEach(function(r) {
        var sym = getGene(r), doms = getDomains(r);
        if (sym && doms && doms.length && win.CiliAI && win.CiliAI.lookups)
            win.CiliAI.lookups.pfamByGene[sym.toUpperCase()] = doms;
    });
    win._pfamReady = true;
    console.log('[CiliaHub Interceptor] pfamData built:',
        Object.keys((win.CiliAI && win.CiliAI.lookups && win.CiliAI.lookups.pfamByGene) || {}).length, 'genes with domains');
}

/* ══════════════════════════════════════════════════════════════════════════
 * DOMAIN VOCABULARY
 * ══════════════════════════════════════════════════════════════════════════ */
var DOMAIN_TERMS = {
    'wd40':        ['wd domain','wd40','wdr','wd-40','wd repeat','seven-bladed','beta-propeller','yvtn'],
    'tpr':         ['tetratricopeptide','tpr repeat','tpr domain','tpr'],
    'coiled-coil': ['coiled-coil','coiled coil'],
    'kinase':      ['protein kinase','kinase domain','tyrosine kinase','serine/threonine kinase'],
    'kinesin':     ['kinesin motor','kinesin'],
    'gtpase':      ['gtpase'],
    'zinc finger': ['zinc finger','zinc-finger','znf'],
    'aaa atpase':  ['aaa atpase','aaa domain','aaa+ atpase'],
    'armadillo':   ['armadillo'],
    'ef-hand':     ['ef-hand','ef hand'],
    'lrr':         ['leucine rich repeat','leucine-rich repeat','lrr'],
    'dynein':      ['dynein heavy chain','dynein light chain','dynein'],
    'pdz':         ['pdz domain','pdz'],
    'sh3':         ['sh3 domain','sh3'],
    'ankyrin':     ['ankyrin'],
    'ph domain':   ['ph domain','pleckstrin homology'],
    'btb':         ['btb'],
    'ch domain':   ['calponin homology','ch domain'],
    'sam domain':  ['sam domain'],
    'egf':         ['egf-like','egf domain'],
    'fibronectin': ['fibronectin type iii']
};

function hasDomain(r, family) {
    var doms = getDomains(r);
    if (!doms || !doms.length) return false;
    var key = family.toLowerCase();
    var terms = DOMAIN_TERMS[key] || [key];
    for (var i = 0; i < doms.length; i++) {
        var name = (doms[i].name || '').toLowerCase();
        var pid  = (doms[i].pfam_id || '').toLowerCase();
        for (var j = 0; j < terms.length; j++) {
            if (name.indexOf(terms[j]) !== -1 || pid.indexOf(terms[j]) !== -1) return true;
        }
    }
    return false;
}

/* ══════════════════════════════════════════════════════════════════════════
 * COMPLEX GENE SETS
 * ══════════════════════════════════════════════════════════════════════════ */
var COMPLEX_SETS = {
    ift_b:         ['IFT22','IFT25','IFT27','IFT46','IFT52','IFT56','IFT57','IFT70A','IFT70B','IFT74','IFT81','IFT88','IFT172','CLUAP1','IFT20','TRAF3IP1'],
    ift_a:         ['IFT43','IFT80','IFT121','IFT122','IFT139','IFT140','IFT144','WDR19','WDR35','TTC21B'],
    bbsome:        ['BBS1','BBS2','BBS4','BBS5','BBS7','BBS8','BBS9','BBS18','BBIP1','TTC8','LZTFL1'],
    mks_module:    ['MKS1','TMEM216','TMEM67','CEP290','RPGRIP1L','CC2D2A','TCTN1','TCTN2','TCTN3','B9D1','B9D2','TMEM231','TMEM107','TMEM237','TMEM17','TMEM138','TMEM218','TMEM252'],
    nphp_module:   ['NPHP1','NPHP3','NPHP4','RPGRIP1L','IQCB1','CEP290','SDCCAG8','NEK8'],
    dynein2:       ['DYNC2H1','DYNC2LI1','WDR34','WDR60','DYNLT2B','TCTEX1D2'],
    dynein_arm:    ['DNAH1','DNAH2','DNAH5','DNAH6','DNAH7','DNAH8','DNAH9','DNAH10','DNAH11','DNAI1','DNAI2','DNAI3','DNAI7','DNAAF1','DNAAF2','DNAAF3','DNAAF5','DNAAF6','DNAAF8','DNAAF10','DNAAF19','LRRC6','CCDC103','ODAD1','ODAD2','ODAD3','ODAD4','NME8','DNAL1','CCDC114','GAS8'],
    radial_spoke:  ['RSPH1','RSPH3','RSPH4A','RSPH6A','RSPH9','RSPH10B','DRC1','DRC3','DRC7','CFAP57','CFAP61','CFAP70','CFAP251','SPAG17','SPAG16'],
    central_pair:  ['HYDIN','SPAG6','SPAG16','SPAG17','CFAP43','CFAP44','CFAP45'],
    transition_zone:['NPHP1','NPHP4','MKS1','CEP290','TCTN1','TCTN2','TCTN3','B9D1','B9D2','TMEM67','CC2D2A','RPGRIP1L','TMEM216','TMEM231','AHI1','CSPP1'],
    shh_pathway:   ['SMO','PTCH1','GLI1','GLI2','GLI3','SUFU','KIF7','TULP3','ARL13B','INPP5E'],
    exocyst:       ['EXOC1','EXOC2','EXOC3','EXOC4','EXOC5','EXOC6','EXOC7','EXOC8'],
    ift_motor:     ['KIF3A','KIF3B','KIF17','DYNC2H1','DYNC2LI1','WDR34','WDR60']
};

/* ══════════════════════════════════════════════════════════════════════════
 * DISEASE ALIASES
 * ══════════════════════════════════════════════════════════════════════════ */
var DISEASE_ALIASES = {
    joubert:      ['joubert'],
    bbs:          ['bardet','biedl','bardet-biedl'],
    pcd:          ['ciliary dyskinesia','primary ciliary dyskinesia'],
    mks:          ['meckel','meckel-gruber'],
    nphp:         ['nephronophthisis'],
    retinal:      ['retinal','leber congenital','retinitis pigmentosa','cone-rod'],
    skeletal:     ['skeletal','short-rib','jeune','thoracic dysplasia'],
    alstrom:      ['alstr'],
    coach:        ['coach'],
    ofd:          ['orofaciodigital','ofd syndrome'],
    pkd:          ['polycystic kidney'],
    lca:          ['leber congenital amaurosis'],
    slsn:         ['senior','loeken'],
    infertility:  ['infertility','male infertility']
};

function matchDiseaseKw(q) {
    for (var tag in DISEASE_ALIASES) {
        var terms = DISEASE_ALIASES[tag];
        for (var i = 0; i < terms.length; i++) {
            if (q.indexOf(terms[i]) !== -1) return tag;
        }
    }
    return null;
}

function genesByDisease(tag) {
    var terms = DISEASE_ALIASES[tag] || [tag];
    var seen = {}, result = [];
    db().forEach(function(r) {
        var cil = getCil(r);
        if (terms.some(function(t){ return cil.indexOf(t) !== -1; })) {
            var sym = getGene(r);
            if (sym && !seen[sym]) { seen[sym] = 1; result.push(sym); }
        }
    });
    return result;
}

/* ══════════════════════════════════════════════════════════════════════════
 * LOCALIZATION MAP
 * ══════════════════════════════════════════════════════════════════════════ */
var LOC_MAP = [
    ['transition zone',       'transition zone'],
    ['ciliary tip',           'cilia'],
    ['tip of cilia',          'cilia'],
    ['ciliary membrane',      'ciliary membrane'],
    ['ciliary pocket',        'ciliary pocket'],
    ['basal body',            'basal body'],
    ['axonem',                'axoneme'],
    ['flagell',               'flagella'],
    ['centrosome',            'centrosome'],
    ['centriolar satellite',  'centriolar satellites'],
    ['distal appendage',      'distal appendage'],
    ['mitochondri',           'mitochondria'],
    ['lysosom',               'lysosomes'],
    ['peroxisome',            'peroxisome'],
    ['endoplasmic reticulum', 'endoplasmic reticulum'],
    ['reticulum',             'endoplasmic reticulum'],
    ['golgi',                 'golgi apparatus'],
    ['endosome',              'endosome'],
    ['autophago',             'autophagosomes'],
    ['p-body',                'p-body'],
    ['nucleoplasm',           'nucleoplasm'],
    ['nucleoli',              'nucleoli'],
    ['nucleus',               'nucleus'],
    ['nuclear',               'nucleus'],
    ['cytosol',               'cytosol'],
    ['cytoplasm',             'cytosol'],
    ['microtubule',           'microtubules'],
    ['plasma membrane',       'plasma membrane'],
    ['cilia associated',      'cilia associated gene'],
    ['cilia',                 'cilia']
];

function matchLocKw(q) {
    for (var i = 0; i < LOC_MAP.length; i++) {
        if (q.indexOf(LOC_MAP[i][0]) !== -1)
            return {
                term: LOC_MAP[i][1],
                label: LOC_MAP[i][1].charAt(0).toUpperCase() + LOC_MAP[i][1].slice(1)
            };
    }
    return null;
}

function matchComplexKw(q) {
    var pairs = [
        ['ift-b','ift_b'],['ift b','ift_b'],
        ['ift-a','ift_a'],['ift a','ift_a'],
        ['bbsome','bbsome'],['bbs complex','bbsome'],
        ['mks module','mks_module'],['nphp module','nphp_module'],
        ['dynein-2','dynein2'],['dynein arm','dynein_arm'],
        ['radial spoke','radial_spoke'],['central pair','central_pair'],
        ['transition zone complex','transition_zone'],
        ['shh pathway','shh_pathway'],['hedgehog','shh_pathway'],
        ['ift motor','ift_motor']
    ];
    for (var i = 0; i < pairs.length; i++) {
        if (q.indexOf(pairs[i][0]) !== -1) return pairs[i][1];
    }
    return null;
}

function genesByLoc(term) {
    return db().filter(function(r){ return getLoc(r).indexOf(term) !== -1; });
}

/* ══════════════════════════════════════════════════════════════════════════
 * GOLD STANDARD
 * ══════════════════════════════════════════════════════════════════════════ */
var GOLD_LOCS = ['basal body','transition zone','axoneme','cilia','centrosome','flagella','ciliary tip','ciliary membrane'];
function isGoldStandard(r) {
    var loc = getLoc(r);
    if (!loc) return false;
    var hasCiliaAssoc = loc.indexOf('cilia associated') !== -1;
    return GOLD_LOCS.some(function(l) {
        if (l === 'cilia') return /\bcilia\b/.test(loc) && !hasCiliaAssoc;
        return loc.indexOf(l) !== -1;
    });
}

/* ══════════════════════════════════════════════════════════════════════════
 * PHENOTYPE MATCHERS
 * ══════════════════════════════════════════════════════════════════════════ */
function lofMatches(r, effect) {
    var v = getLOF(r).toLowerCase();
    if (!v || /not reported|unknown|unkown/.test(v)) return false;
    if (effect === 'shorter')   return /shorter cilia|shorter|decrease/.test(v);
    if (effect === 'longer')    return /longer cilia|longer|elongat|increase/.test(v);
    if (effect === 'loss')      return /loss of cilia|ciliogenesis blocked|impaired ciliogenesis|ciliary resorption/.test(v);
    if (effect === 'no_effect') return /no effect/.test(v);
    if (effect === 'motility')  return /motility|immotile/.test(v);
    return v.indexOf(effect.toLowerCase()) !== -1;
}
function oefMatches(r, effect) {
    var v = getOE(r).toLowerCase();
    if (!v || /not reported|unknown|unkown|n\/a/.test(v)) return false;
    if (effect === 'shorter')   return /shorter|short.cilia|decrease|decreased|reduc/.test(v);
    if (effect === 'longer')    return /longer|elongat|increase|increased/.test(v);
    if (effect === 'loss')      return /loss.of.cilia|no.cilia|blocked|inhibits/.test(v);
    if (effect === 'no_effect') return /no[_ ]effect|no.change|unchanged/.test(v);
    return v.indexOf(effect.toLowerCase()) !== -1;
}

/* ══════════════════════════════════════════════════════════════════════════
 * KEYWORD HELPERS
 * ══════════════════════════════════════════════════════════════════════════ */
function matchLOFKw(q) {
    if (/overexpress/i.test(q)) return null;
    if (/shorter cilia|shorten|short cilia|decrease.*cilia|cilia.*shorter/i.test(q)) return 'shorter';
    if (/longer cilia|elongat|lengthen|increase.*length|longer.*cilia/i.test(q)) return 'longer';
    if (/loss of cilia|no cilia|cilia loss|ciliogenesis blocked|absent cilia/i.test(q)) return 'loss';
    if (/\bno effect\b|no change|normal cilia length/i.test(q)) return 'no_effect';
    if (/motility|immotile|dyskinesia/i.test(q)) return 'motility';
    return null;
}
function matchOEKw(q) {
    if (!/overexpress|oe effect|oe.*cilia/i.test(q)) return null;
    if (/longer|increase|elongat|more/i.test(q)) return 'longer';
    if (/shorter|decrease|reduc/i.test(q)) return 'shorter';
    if (/loss|no cilia|blocked/i.test(q)) return 'loss';
    if (/no effect|no change/i.test(q)) return 'no_effect';
    return null;
}
function matchDomainKw(q) {
    if (/\bwd40\b|\bwd domain\b|\bwd repeat\b|\bwdr\b/.test(q)) return 'wd40';
    if (/tpr|tetratricopeptide/.test(q)) return 'tpr';
    if (/coiled.coil|coiledcoil/.test(q)) return 'coiled-coil';
    if (/\bkinase\b/.test(q)) return 'kinase';
    if (/\bkinesin\b/.test(q)) return 'kinesin';
    if (/\bgtpase\b|gtp.ase/.test(q)) return 'gtpase';
    if (/zinc finger|znf/.test(q)) return 'zinc finger';
    if (/aaa.atpase|aaa domain/.test(q)) return 'aaa atpase';
    if (/\barmadillo\b/.test(q)) return 'armadillo';
    if (/ef.hand/.test(q)) return 'ef-hand';
    if (/\blrr\b|leucine.rich repeat/.test(q)) return 'lrr';
    if (/dynein domain/.test(q)) return 'dynein';
    if (/\bpdz\b/.test(q)) return 'pdz';
    if (/\bsh3\b/.test(q)) return 'sh3';
    if (/\bankyrin\b/.test(q)) return 'ankyrin';
    if (/ph domain|pleckstrin/.test(q)) return 'ph domain';
    if (/\begf\b/.test(q)) return 'egf';
    return null;
}
function extractMultipleDomains(q) {
    var found = [];
    var keys = Object.keys(DOMAIN_TERMS);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var terms = DOMAIN_TERMS[key];
        if (terms.some(function(t){ return q.indexOf(t) !== -1; }) && found.indexOf(key) === -1)
            found.push(key);
    }
    return found;
}

/* ══════════════════════════════════════════════════════════════════════════
 * RENDER HELPERS
 * ══════════════════════════════════════════════════════════════════════════ */
function chip(sym) {
    var s = sym.replace(/'/g, "\\'");
    return '<span onclick="(function(){if(window.handleAIQuery)window.handleAIQuery(\''+s+'\');})()" '+
           'style="background:#e6f2fb;color:#005b96;border:1px solid #b3cde0;margin:2px;padding:4px 10px;'+
           'border-radius:12px;font-size:11.5px;font-weight:600;cursor:pointer;display:inline-block;">'+sym+'</span>';
}
function pill(text, color) {
    var C = {
        blue:  ['#dbeafe','#1e40af'], red:   ['#fee2e2','#991b1b'],
        green: ['#dcfce7','#166534'], amber: ['#fef3c7','#92400e'],
        purple:['#ede9fe','#5b21b6'], gray:  ['#f3f4f6','#374151']
    };
    var p = C[color] || C.gray;
    return '<span style="background:'+p[0]+';color:'+p[1]+';padding:2px 7px;border-radius:8px;'+
           'font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-block;margin:1px;">'+text+'</span>';
}
function badgeList(genes) {
    var MAX = 80;
    return '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0;">'+
        genes.slice(0, MAX).map(chip).join('')+
        (genes.length > MAX ? '<span style="font-size:11px;color:#64748b;padding:3px 8px;">\u2026+'+(genes.length-MAX)+' more</span>' : '')+
        '</div>';
}
function tbl(headers, rows, max) {
    max = max || 60;
    var shown = rows.slice(0, max);
    var more = rows.length > max ? '<p style="color:#888;font-size:11px;margin-top:4px;">Showing '+max+' of '+rows.length+'.</p>' : '';
    var head = headers.map(function(h) {
        return '<th style="padding:7px 10px;text-align:left;background:#f1f5f9;border-bottom:2px solid #e2e8f0;color:#475569;font-weight:700;">'+h+'</th>';
    }).join('');
    var body = shown.map(function(r, i) {
        return '<tr style="background:'+(i%2?'#f8fafc':'white')+';border-bottom:1px solid #f1f5f9;">'+
               r.map(function(c){ return '<td style="padding:6px 10px;vertical-align:top;">'+c+'</td>'; }).join('')+'</tr>';
    }).join('');
    return '<div style="overflow-x:auto;margin-top:8px;max-height:300px;overflow-y:auto;">'+
           '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>'+head+
           '</tr></thead><tbody>'+body+'</tbody></table></div>'+more;
}
function csvLink(rows, fieldNames, filename) {
    var header = fieldNames.join(',');
    var lines = rows.map(function(r) {
        return fieldNames.map(function(f) {
            var v = (typeof r === 'string') ? r : (r[f] || getGene(r) || '');
            return '"'+String(v).replace(/"/g,'""')+'"';
        }).join(',');
    });
    var csv = encodeURIComponent(header+'\n'+lines.join('\n'));
    return '<br><a href="data:text/csv;charset=utf-8,'+csv+'" download="'+filename+'" '+
           'style="display:inline-block;margin-top:8px;padding:6px 14px;background:#005b96;color:white;'+
           'border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">'+
           '\u2193 Download CSV ('+rows.length+' genes)</a>';
}
function card(title, body) {
    return '<div class="ai-result-card"><h4 style="margin:0 0 10px;color:#1e40af;font-size:14px;">'+title+'</h4>'+body+'</div>';
}

/* ══════════════════════════════════════════════════════════════════════════
 * REMOTE DATA LOADERS
 * ══════════════════════════════════════════════════════════════════════════ */
function loadCiliopathyData() {
    /* v3 (Apr 30, 2026): ciliopathy data is derived from the master JSON
     * loaded by data.js. Same retry pattern as loadScRNAClassification:
     * try to read from win.CiliaHubData; if not yet loaded, retry briefly;
     * fall back to the standalone files only if the master never arrives. */
    function deriveCiliopathyFromMaster() {
        var state = win.CiliaHubData && win.CiliaHubData.state;
        var geneMap = state && state.geneMap;
        if (!geneMap) return null;
        var byGene = {};
        var byClass = {};
        var diseaseSet = {};
        Object.keys(geneMap).forEach(function(sym) {
            var g = geneMap[sym] || {};
            var diseases = Array.isArray(g.Ciliopathies) ? g.Ciliopathies
                         : (Array.isArray(g.ciliopathies) ? g.ciliopathies : []);
            var classes  = Array.isArray(g.ciliopathy_classification)
                         ? g.ciliopathy_classification : [];
            if (diseases.length === 0 && classes.length === 0) return;
            byGene[sym] = {
                gene: sym,
                ensembl_gene_id: g.Ensembl || g.ensembl_id || '',
                description: g.Description || g.description || '',
                synonyms: Array.isArray(g.Synonyms) ? g.Synonyms
                        : (typeof g.Synonyms === 'string' ? g.Synonyms.split(/[,;|]/).map(function(s){return s.trim();}).filter(Boolean) : []),
                omim_id: g.omim_id || '',
                localization: typeof g.Localization === 'string'
                            ? g.Localization.split(/[,;|]/).map(function(s){return s.trim();}).filter(Boolean)
                            : (Array.isArray(g.Localization) ? g.Localization : []),
                classifications: classes,
                diseases: diseases,
                disease_refs: Array.isArray(g.ciliopathy_refs) ? g.ciliopathy_refs : [],
                pan_idio_class: g.pan_idio_class || null,
                pan_idio_tissues: (g.pan_idio_tissues != null) ? g.pan_idio_tissues : null
            };
            classes.forEach(function(c) {
                if (!byClass[c]) byClass[c] = [];
                byClass[c].push(sym);
            });
            diseases.forEach(function(d) { diseaseSet[d] = 1; });
        });
        return {
            byGene: byGene,
            byClass: { meta: { total_genes: Object.keys(byGene).length,
                               total_diseases: Object.keys(diseaseSet).length },
                       by_classification: byClass }
        };
    }

    function loadCiliopathyFromMaster() {
        var derived = deriveCiliopathyFromMaster();
        if (derived && Object.keys(derived.byGene).length > 0) {
            win._ciliopathyByGene = derived.byGene;
            win._ciliopathyByClass = derived.byClass;
            console.log('[CiliaHub] ciliopathy derived from master:',
                Object.keys(derived.byGene).length, 'genes,',
                Object.keys(derived.byClass.by_classification).length, 'classifications.');
            return;
        }
        if (!win._ciliopathyRetry) win._ciliopathyRetry = 0;
        if (win._ciliopathyRetry < 10) {
            win._ciliopathyRetry++;
            setTimeout(loadCiliopathyFromMaster, 500);
            return;
        }
        /* Fallback: master never loaded; use static files. */
        fetch('data/ciliopathy/ciliopathy_by_gene.json')
            .then(function(r){ return r.json(); })
            .then(function(d){
                win._ciliopathyByGene = d.genes || d;
                console.log('[CiliaHub] ciliopathy_by_gene loaded (fallback):',
                    Object.keys(win._ciliopathyByGene).length, 'genes');
            }).catch(function(e){
                console.warn('[CiliaHub] ciliopathy_by_gene failed:', e.message);
            });
        fetch('data/ciliopathy/ciliopathy_by_class.json')
            .then(function(r){ return r.json(); })
            .then(function(d){
                win._ciliopathyByClass = d;
                console.log('[CiliaHub] ciliopathy_by_class loaded (fallback)');
            })
            .catch(function(e){
                console.warn('[CiliaHub] ciliopathy_by_class failed:', e.message);
            });
    }
    loadCiliopathyFromMaster();
}

function loadTissueExpressionSummary() {
    fetch('data/tissue_expression_summary.json')
        .then(function(r){ return r.json(); })
        .then(function(d){
            win._tissueExpr = d;
            console.log('[CiliaHub] Tissue expression summary loaded:', Object.keys(d.max||{}).length, 'genes');
        }).catch(function(e){ console.warn('[CiliaHub] Tissue expression failed:', e.message); });
}

function loadScRNAClassification() {
    /* v3 (Apr 30, 2026): pan/idio classification is now stored per-gene
     * inside the master JSON (field: pan_idio_class). Derive the arrays
     * from the master at runtime so there is one source of truth.
     * Falls back to the standalone file if the master isn't yet loaded. */
    function deriveFromMaster() {
        var state = win.CiliaHubData && win.CiliaHubData.state;
        var geneMap = state && state.geneMap;
        if (!geneMap) return null;
        var pan = [], idio = [], notClassified = [];
        Object.keys(geneMap).forEach(function(sym) {
            var g = geneMap[sym] || {};
            var cls = g.pan_idio_class;
            if (cls === 'pan_ciliary')   pan.push(sym);
            else if (cls === 'idio_ciliary')  idio.push(sym);
            else if (cls === 'not_classified') notClassified.push(sym);
        });
        return { pan_ciliary: pan, idio_ciliary: idio, not_classified: notClassified };
    }

    var derived = deriveFromMaster();
    if (derived && derived.pan_ciliary.length > 0) {
        win._scRNAClassification = derived;
        console.log('[CiliaHub] scRNA classification derived from master:',
            derived.pan_ciliary.length, 'pan-ciliary,',
            derived.idio_ciliary.length, 'idio-ciliary,',
            derived.not_classified.length, 'not-classified.');
        return;
    }

    /* Master not yet loaded — retry shortly (data.js fetches async) or
     * fall back to the standalone file. */
    if (!win._scRNAClassificationRetry) {
        win._scRNAClassificationRetry = 0;
    }
    if (win._scRNAClassificationRetry < 10) {
        win._scRNAClassificationRetry++;
        setTimeout(loadScRNAClassification, 500);
        return;
    }

    fetch('data/scrna_ciliary_classification.json')
        .then(function(r){ return r.json(); })
        .then(function(d){
            win._scRNAClassification = d;
            console.log('[CiliaHub] scRNA classification loaded (fallback):',
                (d.pan_ciliary||[]).length, 'pan-ciliary,',
                (d.idio_ciliary||[]).length, 'idio-ciliary');
        }).catch(function(e){
            console.warn('[CiliaHub] scRNA classification failed:', e.message);
        });
}

function preloadPhylogenyData() {
    var base = (win.location && win.location.pathname.replace(/[^/]*$/, '')) || '/';
    Promise.all([
        fetch(base+'data/phylogeny/nevers_et_al_2017_matrix_optimized.json').then(function(r){ return r.json(); }),
        fetch(base+'data/phylogeny/li_et_al_2014_matrix_optimized.json').then(function(r){ return r.json(); })
    ]).then(function(results) {
        win.neversPhylogenyCache = results[0];
        win.liPhylogenyCache = results[1];
        console.log('[CiliaHub] Nevers phylogeny pre-loaded silently');
        console.log('[CiliaHub] Li phylogeny pre-loaded silently');
    }).catch(function(e){ console.warn('[CiliaHub] Phylogeny preload failed:', e.message); });
}

/* ══════════════════════════════════════════════════════════════════════════
 * INTENT MATCHER
 * Priorities checked top-to-bottom. First match wins.
 * ══════════════════════════════════════════════════════════════════════════ */
function matchIntent(raw) {
    var t = raw.trim();
    var q = t.toLowerCase();

    /* ─ P0: disease ⇄ symptom & phenotype-profile queries → defer to ciliai.js ─
     * ciliai.js owns the disease-phenotype-profile answers (gene → disease →
     * symptom). Returning null lets wrap() fall through to the original
     * handleAIQuery, where the priority 203–207 handlers render the answer.
     * gToks = real gene symbols present; used to separate gene-centric from
     * disease/symptom-centric phrasing so existing interceptor intents stay
     * untouched. Without P0, "symptoms of Joubert" is caught by P24 disease_list. */
    var gToks = (t.match(/\b[A-Z][A-Z0-9]{1,11}\b/g) || []).filter(function(s){ return gmap()[s.toUpperCase()]; });
    if (gToks.length === 0 && !/mouse|knockout/.test(q)) {
        // disease → symptoms
        if (/\bsymptom|\bphenotype|\bclinical feature|\bmanifestation|\bhpo\b/.test(q) && matchDiseaseKw(q)) return null;
        // symptom/organ → diseases
        if (/\b(diseases?|ciliopath\w*|conditions?)\b/.test(q)
            && /(associated with|linked to|cause[sd]?|present(?:s|ing)? with|characteri[sz]ed by|feature[sd]?|affect(?:ing|s)?|with(?: the)? symptom)/.test(q)) return null;
        // rankings / counts of symptoms or organ systems
        if (/(most common|commonest|most affected|most involved|top |frequent|prevalent|ranking)/.test(q) && /symptom|phenotype|organ/.test(q)) return null;
        // compare two diseases by symptoms
        if (/compare|versus|\bvs\b|difference between|shared/.test(q) && /symptom|phenotype/.test(q)) return null;
    }
    // gene → its diseases & symptoms (gene symbol + disease/symptom intent, excluding other gene intents)
    if (gToks.length >= 1
        && /\b(disease|diseases|symptom|symptoms|phenotype|phenotypes)\b/.test(q)
        && !/localiz|express|tissue|domain|ortholog|phylogen|conserv|evol|screen|compare|versus|\bvs\b|mouse|knockout|how many|count/.test(q)) return null;

    /* ─ P0b: gene + Wave-1 attribute lookup → defer to ciliai.js geneAttribute / geneLiterature ─
     * Identity/IDs/cross-refs, ciliogenics, pathways, ClinGen, clinical phenotype,
     * gold-standard tier, and literature/PMID evidence are answered by ciliai.js
     * (priority 210-211). Without this, "is IFT88 gold standard" is hijacked by the
     * gold_standard *list* intent below, and the other attributes have no interceptor
     * intent anyway. Excludes interceptor-owned attributes so those keep their handlers. */
    if (gToks.length >= 1
        && /synonym|alias|other name|also (?:called|known)|\buniprot|\bensembl|\bomim|\bmgi\b|alphafold|accession|ciliogenic|\bpathway|reactome|kegg|\bgo:|clingen|gene validity|clinical validity|gold standard|gold.standard|\btier\b|human (?:disease )?phenotype|clinical phenotype|clinical feature|\bids?\b|identifier|\bdescription\b|cross.?ref|\bpmid|publication|\bpaper|\bcitation|literature|\bevidence\b/.test(q)
        && !/localiz|express|tissue|\bdomain|ortholog|phylogen|conserv|evol|screen|compare|versus|\bvs\b|mouse|knockout|\blof\b|loss of function|overexpress|oe effect|complex|subunit/.test(q)) return null;

    /* ─ P0c: disease-CLASS browse (idio-ciliary / Secondary) → ciliai.js ─
     * classification_list only covers primary/motile; without this, "idio-ciliary
     * ciliopathy genes" hits the *expression* idio_ciliary intent (a different list).
     * ciliai.js (priority 213) uses the authoritative byClassification lookup.
     * Bare "idio-ciliary genes" / "pan-ciliary genes" (no ciliopathy/disease/class
     * word) is NOT matched here, so the expression intents keep those. */
    if ((/idio.?ciliary|tissue.?restricted/.test(q) && /ciliopath|disease|class/.test(q))
        || (/secondary/.test(q) && /ciliopath|disease|class/.test(q))) return null;

    /* ─ P0d: evidence-tier ∩ disease|localization → ciliai.js (priority 214) ─
     * "gold-standard genes causing Joubert" otherwise hits the all-gold-genes list
     * intent and drops the disease filter. Bare "gold standard genes" (no disease/loc)
     * is left to the interceptor's gold_standard list. */
    if (/gold.?standard|cilia.?associated/.test(q) && (matchDiseaseKw(q) || matchLocKw(q))) return null;

    /* ─ P0e: disease-class ∩ localization → ciliai.js (priority 215) ─
     * "primary-ciliopathy genes at the transition zone" — without this the loc_list
     * intent returns all transition-zone genes and drops the class filter. */
    if ((/(primary|motile)[ -]?cilio/.test(q) || /idio[ -]?ciliary|tissue[ -]?restricted/.test(q) || (/secondary/.test(q) && /cilio|disease|class/.test(q)))
        && matchLocKw(q)) return null;

    /* ─ P0f: gene-vs-gene comparison (2+ genes) → ciliai.js richer side-by-side compare ─
     * Supersedes the interceptor's 4-column multi_gene_compare. Disease/symptom and
     * phylogeny comparisons are excluded so their existing paths are untouched. */
    if (/compare|versus|\bvs\b|difference between/.test(q) && gToks.length>=2 && !/phylogen|conserv|evol|symptom|phenotype/.test(q)) return null;

    /* ─ P0g: rankings the interceptor doesn't own (literature / ciliogenics / disease-by-gene-count) → ciliai.js ─ */
    if (/(most|top|highest|lowest|fewest|rank|ranked|ranking|largest)/.test(q)
        && /studied|publication|\bpmid|literature|cited|ciliogenic|most genes|fewest genes|gene count/.test(q)) return null;

    /* ─ P0h: tier/class counts → ciliai.js ─ */
    if (/how many/.test(q) && /gold standard|cilia.?associated|idio.?ciliary|tissue.?restricted|secondary cili|secondary disease/.test(q)) return null;

    /* ─ P0i / P0j: conversational yes/no verification → ciliai.js verification handler ─
     * "is X a Joubert gene", "is X gold standard", "is X in the BBSome", "is Joubert a
     * primary ciliopathy", etc. These otherwise get hijacked by the interceptor's LIST
     * intents (disease_list, classification_list, complex_list, loc_list). Pass them to
     * ciliai.js, EXCLUDING interceptor-owned descriptive predicates (LoF/OE, expression,
     * "where does", "how many"). */
    var _ynV = /^(is|are|does|do|has|have|was|were|can|could|will)\b/.test(q)
            || /\b(do you know|do we know|is it true|is it known|can you (?:tell|confirm)|tell me (?:if|whether)|\bwhether\b)/.test(q);
    if (_ynV && !/\blof\b|loss of function|knockdown|knocked down|overexpress|oe effect|what happen|where does|how many/.test(q)) {
        if (gToks.length>=1 && (
              matchDiseaseKw(q)
           || /primary[ -]?cilio|motile[ -]?cilio|idio[ -]?ciliary|tissue[ -]?restricted|secondary (?:cili|disease)/.test(q)
           || /pan[ -]?ciliary/.test(q)
           || /bbsome|ift[ -]?[ab]\b|\bmks\b|\bnphp\b|dynein|radial spoke|transition zone|basal body|axoneme|centrosome|centriole|cilium|flagell/.test(q)
           || /wd-?40|coiled.?coil|pfam|\bdomain\b|\btpr\b|ankyrin|ef-hand/.test(q)
           || /conserv|ortholog|homolog|clingen|gene validity|ciliary gene|cilia gene|in (?:the )?(?:database|ciliahub|list|catalog|master)/.test(q)
           )) return null;
        if (gToks.length===0 && matchDiseaseKw(q) && /(primary|motile|idio|tissue[ -]?restricted|secondary|involve|affect|feature|classif|\borgan\b|kidney|retina|brain|liver|heart)/.test(q)) return null;
    }

    /* ─ P1: Phylogeny confirmation ─ */
    if (/^(yes|y|sure|ok|okay|yep)$/i.test(q) && win._lastPhyloGenes && win._lastPhyloGenes.length)
        return { type: 'show_last_phylo' };

    /* ─ P2: Complex phylo compare ─ */
    if (/compare|versus|\bvs\b/.test(q) && /phylogen|conserv|evol/.test(q)) {
        var ckeys = [];
        var clist = [['ift-b','ift_b'],['ift b','ift_b'],['ift-a','ift_a'],['ift a','ift_a'],
                     ['bbsome','bbsome'],['bbs complex','bbsome'],
                     ['mks module','mks_module'],['nphp module','nphp_module'],
                     ['dynein-2','dynein2'],['dynein arm','dynein_arm'],
                     ['radial spoke','radial_spoke'],['central pair','central_pair'],
                     ['transition zone','transition_zone'],['shh pathway','shh_pathway']];
        for (var ci = 0; ci < clist.length; ci++) {
            if (q.indexOf(clist[ci][0]) !== -1 && ckeys.indexOf(clist[ci][1]) === -1)
                ckeys.push(clist[ci][1]);
        }
        if (ckeys.length >= 2) return { type: 'complex_phylo_compare', cxA: ckeys[0], cxB: ckeys[1] };
    }

    /* ─ P3: Database stats ─ */
    if (/how many/.test(q)) {
        if (/ciliary genes|total genes|genes in ciliahub|genes are in ciliahub/i.test(q))
            return { type: 'db_count' };
        if (/diseases|ciliopathies/.test(q) && /does|cause|can/.test(q)) {
            var rawG = t.match(/\b[A-Z][A-Z0-9]{1,11}\b/g) || [];
            var vG = rawG.filter(function(s){ return !!gmap()[s.toUpperCase()]; });
            if (vG.length === 1) return { type: 'gene_disease_count', gene: vG[0] };
            return { type: 'disease_count_all' };
        }
        var domKw = matchDomainKw(q);
        if (domKw) return { type: 'domain_count', domain: domKw };
        var locKwC = matchLocKw(q);
        if (locKwC) return { type: 'loc_count', loc: locKwC };
        if (/screen|dataset/.test(q)) return { type: 'screen_count' };
    }

    /* ─ P4: Which gene causes most ciliopathies ─ */
    if (/which gene.*most|gene.*most.*ciliopathies|most ciliopathies/i.test(q))
        return { type: 'most_disease_gene' };

    /* ─ P4a: Dot plot (scRNA expression by cell type) ─
     *
     * Three trigger forms:
     *   • "Dot plot: GENE1, GENE2, ..."     — explicit gene list
     *   • "ComplexA vs ComplexB" with optional 'expression' / 'dot plot'
     *   • "Compare ComplexA and ComplexB expression"
     *
     * Phylogeny ("compare BBSome vs IFT-A phylogeny") stays separate —
     * its handler matches first because it requires the
     * 'phylogeny|conservation|evolution' keyword which we exclude here.
     */
    if (!/phylogeny|phylogenetic|conservation|evolution|evolutionary/i.test(q)) {
        // Form 1: explicit gene list
        var dpMatch = q.match(/^(?:dot ?plot|dot-plot)\s*[:\-]?\s*(.+)$/i);
        if (dpMatch) {
            // Match against UPPERCASED tail — q is lowercase here, so
            // [A-Z][A-Z0-9]+ would never match without this.
            var tail = dpMatch[1].toUpperCase();
            var genes = (tail.match(/[A-Z][A-Z0-9]{1,11}/g) || [])
                .filter(function(s){ return !!gmap()[s]; });
            if (genes.length > 0) {
                return { type: 'dot_plot', genes: genes, source: 'list' };
            }
        }
        // Form 2 & 3: complex-vs-complex pair
        if (/\bvs\b|\bversus\b|\band\b.*\band\b|compare/.test(q)) {
            // Find pairs of complex keywords. Re-use matchComplexKw twice
            // by stripping the first match and matching again.
            var firstCx = matchComplexKw(q);
            if (firstCx) {
                // Find first complex's matched substring, strip it, look again
                var pairs = [
                    ['ift-b','ift_b'],['ift b','ift_b'],
                    ['ift-a','ift_a'],['ift a','ift_a'],
                    ['bbsome','bbsome'],['bbs complex','bbsome'],
                    ['mks module','mks_module'],['nphp module','nphp_module'],
                    ['dynein-2','dynein2'],['dynein arm','dynein_arm'],
                    ['radial spoke','radial_spoke'],['central pair','central_pair']
                ];
                for (var pi = 0; pi < pairs.length; pi++) {
                    if (pairs[pi][1] === firstCx) {
                        var stripped = q.replace(pairs[pi][0], ' ');
                        var secondCx = matchComplexKw(stripped);
                        if (secondCx && secondCx !== firstCx) {
                            // Trigger only if expression/dot plot context OR
                            // a bare "X vs Y" without other strong intent.
                            var hasExprKw = /expression|express|dot ?plot|cell type|scrna|single.cell/.test(q);
                            var bareVs = /\bvs\b|\bversus\b/.test(q) && !/disease|gene list|genes\?|how many|count/.test(q);
                            if (hasExprKw || bareVs) {
                                return { type: 'dot_plot', complexA: firstCx, complexB: secondCx, source: 'pair' };
                            }
                        }
                        break;
                    }
                }
            }
        }
    }

    /* ─ P5: Domain queries (deferred for combo cases) ─
     *
     * If the query ALSO mentions a disease or a location, defer to the
     * combo handlers further down (P22 disease+loc, P23 loc+domain,
     * P24 disease+domain, P24a disease+loc+domain). Otherwise the
     * single-criterion 'domain_list' would fire here and return e.g. all
     * 35 dynein-domain genes when the user actually asked for "Joubert
     * genes localized to basal body with dynein domains" (3 criteria).
     */
    var domKw = matchDomainKw(q);
    if (domKw) {
        var hasDiseaseHint = /\bsyndrome\b|\bdyskinesia\b|\bjoubert|\bmeckel|\bbardet|\bnephronophthisis|\bsenior.loken|\balstrom|\bjeune|\boral.facial|\bofd\b|\bmks\b|\bbbs\b|\bnphp\b|\bpcd\b|\blca\b|\bsrtd\b/i.test(q);
        var hasLocHint = !!matchLocKw(q);
        var isDeferred = (hasDiseaseHint || hasLocHint);

        if (!isDeferred) {
            /* Domain combo: both X and Y */
            if (/both|and.*domain|domain.*and/.test(q)) {
                var doms2 = extractMultipleDomains(q);
                if (doms2.length >= 2) return { type: 'domain_combo', domains: doms2 };
            }
            /* Single gene domain query */
            var rawG5 = t.match(/\b[A-Z][A-Z0-9]{1,11}\b/g) || [];
            var vG5 = rawG5.filter(function(s){ return !!gmap()[s.toUpperCase()]; });
            if (vG5.length === 1 && /what domain|domain.*have|has.*domain|domain.*of|domain.*contain/i.test(q))
                return { type: 'domain_gene', gene: vG5[0] };
            if (/enrich|most common|top domain|frequent/.test(q)) return { type: 'domain_enrichment' };
            return { type: 'domain_list', domain: domKw };
        }
    }

    /* ─ P6: Tissue expression ─ */
    if (/where.*most express|highest.*express|most.*express|which tissue.*express/i.test(q)) {
        var rawG6 = t.match(/\b[A-Z][A-Z0-9]{1,11}\b/g) || [];
        var vG6 = rawG6.filter(function(s){ return !!gmap()[s.toUpperCase()]; });
        if (vG6.length === 1) return { type: 'tissue_max', gene: vG6[0] };
    }

    /* ─ Extract valid genes for gene-based priorities ─ */
    var rawGenes = (t.match(/\b[A-Za-z][A-Za-z0-9]{1,11}\b/g) || []);
    var validGenes = rawGenes.filter(function(s){ return !!gmap()[s.toUpperCase()]; });
    var isGroupQ = /\bgenes\b|\blist\b|\bshow\b|\ball\b|\bcomplex\b|\bdisease\b|\bsyndrome\b|\blocali\b|\bhow many\b|\bwhich\b|\bwhat\b/.test(q);

    /* ─ P7: Single gene LoF / OE ─ */
    if (validGenes.length === 1 && /lof|loss.of.function|knocked down|knockdown|oe effect|overexpress|what happen.*cilia|phenotype of|effect of/i.test(q)) {
        if (/overexpress|oe effect/i.test(q)) return { type: 'gene_oe', gene: validGenes[0].toUpperCase() };
        return { type: 'gene_lof', gene: validGenes[0].toUpperCase() };
    }

    /* ─ P8: Single gene disease count ─ */
    if (validGenes.length === 1 && /how many disease|how many ciliopathies|diseases.*cause|ciliopathies.*cause/i.test(q))
        return { type: 'gene_disease_count', gene: validGenes[0] };

    /* ─ P9: Single gene ortholog ─ */
    if (validGenes.length === 1 && /ortholog|orthologue|homolog|mouse.*of|elegans.*of|zebrafish.*of|drosophila.*of/i.test(q))
        return { type: 'gene_ortholog', gene: validGenes[0], q: q };

    /* ─ P10: Disease overlap ─ */
    if (/shared between|genes.*between|overlap.*disease|both.*syndrome/i.test(q)) {
        var dArr = [];
        for (var tag10 in DISEASE_ALIASES) {
            if (DISEASE_ALIASES[tag10].some(function(t){ return q.indexOf(t) !== -1; })) {
                if (dArr.indexOf(tag10) === -1) dArr.push(tag10);
                if (dArr.length === 2) break;
            }
        }
        if (dArr.length >= 2) return { type: 'disease_overlap', disA: dArr[0], disB: dArr[1] };
    }

    /* ─ P11: Disease diff ─ */
    if (/unique to|only in|not in|exclusive to/i.test(q) && matchDiseaseKw(q)) {
        var dArr2 = [];
        for (var tag11 in DISEASE_ALIASES) {
            if (DISEASE_ALIASES[tag11].some(function(t){ return q.indexOf(t) !== -1; })) {
                if (dArr2.indexOf(tag11) === -1) dArr2.push(tag11);
                if (dArr2.length === 2) break;
            }
        }
        if (dArr2.length >= 2) return { type: 'disease_diff', disA: dArr2[0], disB: dArr2[1] };
    }

    /* ─ P12: Ortholog filter (bulk) ─ */
    if (/with.*ortholog|ortholog.*in|conserved in.*elegans|conserved in.*mouse|mouse ortholog|zebrafish ortholog/i.test(q)) {
        var org12 = /elegans/.test(q) ? 'c_elegans' : /zebrafish|danio/.test(q) ? 'zebrafish' :
                    /drosophila|fly/.test(q) ? 'drosophila' : 'mouse';
        return { type: 'ortholog_filter', disease: matchDiseaseKw(q), loc: matchLocKw(q), organism: org12 };
    }

    /* ─ P13: Multi-localization (2+ compartments) ─ */
    if (/locali/i.test(q)) {
        var allLocs = [];
        for (var li = 0; li < LOC_MAP.length; li++) {
            if (q.indexOf(LOC_MAP[li][0]) !== -1 && allLocs.indexOf(LOC_MAP[li][1]) === -1)
                allLocs.push(LOC_MAP[li][1]);
        }
        if (allLocs.length >= 2) return { type: 'multi_loc', locs: allLocs, effect: matchLOFKw(q) };
    }

    /* ─ LOF / OE effect keywords ─ */
    var lofEff = matchLOFKw(q);
    var oefEff = matchOEKw(q);
    var locKw = matchLocKw(q);
    var disKw = matchDiseaseKw(q);
    var cxKw  = matchComplexKw(q);

    /* ─ P14: OE filter ─ */
    if (oefEff) return { type: 'oe_filter', effect: oefEff };

    /* ─ P15: LOF + localization ─ */
    if (lofEff && locKw) return { type: 'loc_phenotype', loc: locKw, effect: lofEff };

    /* ─ P16: LOF + disease ─ */
    if (lofEff && disKw) return { type: 'disease_lof', disease: disKw, effect: lofEff };

    /* ─ P17: Pure LOF filter ─ */
    if (lofEff) return { type: 'lof_filter', effect: lofEff };

    /* ─ P18: % Ciliated filter ─ */
    if (/percent.*ciliat|% ciliat|ciliat.*percent|ciliation rate/i.test(q)) {
        return { type: 'pct_filter', effect: /increase|more|higher/.test(q) ? 'increase' : 'decrease' };
    }

    /* ─ P19: Complex + disease ─ */
    if (cxKw && disKw) return { type: 'complex_disease', complex: cxKw, disease: disKw };

    /* ─ P20: Complex intersect ─ */
    if (cxKw && /in both|shared between|overlap/.test(q)) {
        var cxKeys = Object.keys(COMPLEX_SETS);
        for (var cxi = 0; cxi < cxKeys.length; cxi++) {
            var k = cxKeys[cxi];
            if (k !== cxKw && q.indexOf(k.replace(/_/g,' ')) !== -1)
                return { type: 'complex_intersect', cxA: cxKw, cxB: k };
        }
    }

    /* ─ P21: Complex list ─ */
    if (cxKw) return { type: 'complex_list', complex: cxKw };

    /* ─ P22a: Disease + Loc + Domain (3-way combo) ─
     *
     * Catches "Joubert syndrome genes localized to basal body with
     * dynein domains" — must be checked before the 2-way combos below
     * so all three criteria are applied. */
    var domKw22a = matchDomainKw(q);
    if (locKw && disKw && domKw22a) {
        return { type: 'disease_loc_domain', disease: disKw, loc: locKw, domain: domKw22a };
    }

    /* ─ P22: Loc + disease ─ */
    if (locKw && disKw) return { type: 'loc_disease', loc: locKw, disease: disKw };

    /* ─ P23: Loc + domain ─ */
    var domKw23 = matchDomainKw(q);
    if (locKw && domKw23) return { type: 'loc_domain', loc: locKw, domain: domKw23 };

    /* ─ P24: Disease + domain ─ */
    if (disKw && domKw23) return { type: 'disease_domain', disease: disKw, domain: domKw23 };

    /* ─ P25: Localization list ─ */
    /* ─ P24a: Classification keywords (must beat loc_list) ─
     *
     * "Gold Standard ciliary genes" / "pan-ciliary genes" / "primary
     * ciliopathy genes" all contain 'ciliary' (loc keyword) + 'genes'
     * (group qualifier), so without this they'd be caught by P25 (loc_list)
     * and return the full 1675-cilia-genes list. Move classification
     * checks ahead of loc_list so the more specific match wins. */
    if (/pan.ciliary|pan ciliary/i.test(q)) return { type: 'pan_ciliary' };
    if (/idio.ciliary|idio ciliary/i.test(q)) return { type: 'idio_ciliary' };
    if (/gold standard|gold.standard/i.test(q)) return { type: 'gold_standard' };
    if (/primary ciliopathy|primary ciliopathies/i.test(q)) return { type: 'classification_list', cls: 'primary' };
    if (/motile ciliopathy|motile ciliopathies/i.test(q)) return { type: 'classification_list', cls: 'motile' };

    if (locKw && /show|list|which|genes|proteins|locali|display/.test(q))
        return { type: 'loc_list', loc: locKw };

    /* ─ P26: Pan-ciliary / idio-ciliary / gold standard (now above) ─ */

    /* ─ P27: Classification list (now above) ─ */

    /* ─ P28: Disease list ─ */
    if (disKw && isGroupQ) return { type: 'disease_list', disease: disKw };

    /* ─ P29: Export ─ */
    if (/download|export|csv|save.*file/i.test(q)) return { type: 'export_csv' };

    /* ─ P30: Compartment biology ─ */
    if (locKw && /biology|function|role|what is|what are|about|important/i.test(q))
        return { type: 'compartment_bio', loc: locKw };

    /* ─ P31: Loc stats ─ */
    if (locKw && /how many|count|number/.test(q))
        return { type: 'loc_count', loc: locKw };

    /* ─ P32: Multi-gene ─ */
    if (validGenes.length >= 2 && !isGroupQ) {
        /* Skip if complex phylo (handled above) */
        var isCmp = /compare|\bvs\b|versus|side.by.side|difference/.test(q);
        if (isCmp) return { type: 'multi_gene_compare', genes: validGenes };
        return { type: 'multi_gene', genes: validGenes };
    }

    /* ─ P33: Single gene — let ciliai.js handle it (was: gene_overview) ─
     *
     * Per HANDOFF_FOR_OPUS.md (April 27, Bug 3): returning a
     * gene_overview intent here caused a race with ciliai.js's
     * own single-gene handler (line ~1773 + the "What is X"
     * handler at line ~6219). Both rendered the gene card; both
     * fired loadTissue / renderUMAPPlot — hence the doubled log
     * lines and the duplicate scroll button. Returning null here
     * lets ciliai.js handle single-gene queries on its own.  */
    if (validGenes.length === 1 && !isGroupQ)
        return null;

    return null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * DISPATCH
 * ══════════════════════════════════════════════════════════════════════════ */
function dispatch(intent) {
    var type = intent.type;

    /* show_last_phylo */
    if (type === 'show_last_phylo') {
        var genes = win._lastPhyloGenes;
        setTimeout(function() {
            if (!win.liPhylogenyCache && !win.neversPhylogenyCache) return;
            if (win.resetViews) win.resetViews();
            if (win.renderLiPhylogenyHeatmap) {
                var res = win.renderLiPhylogenyHeatmap(genes);
                if (res && res.plotData && win.Plotly) win.Plotly.newPlot('cilia-svg', res.plotData, res.plotLayout);
            }
        }, 50);
        return card('Phylogenetic Conservation',
            '<p>Displaying heatmap for <strong>'+genes.length+'</strong> genes.</p>');
    }

    /* complex_phylo_compare */
    if (type === 'complex_phylo_compare') {
        var genesA = COMPLEX_SETS[intent.cxA] || [];
        var genesB = COMPLEX_SETS[intent.cxB] || [];
        var seen = {}, combined = [];
        genesA.concat(genesB).forEach(function(g){ if (!seen[g]){ seen[g]=1; combined.push(g); } });
        win._lastPhyloGenes = combined;
        var labelA = intent.cxA.replace(/_/g,' ').toUpperCase();
        var labelB = intent.cxB.replace(/_/g,' ').toUpperCase();
        return card('Phylogeny: '+labelA+' vs '+labelB,
            '<p><strong>'+genesA.length+'</strong> '+labelA+' genes vs <strong>'+genesB.length+'</strong> '+labelB+' genes — combined: <strong>'+combined.length+'</strong></p>'+
            badgeList(combined)+
            '<p style="margin-top:10px;color:#475569;font-size:12px;">Type <strong>"yes"</strong> to display the phylogenetic heatmap.</p>');
    }

    /* db_count */
    if (type === 'db_count') {
        return card('CiliaHub Database',
            '<p>Total genes: <strong>'+db().length+'</strong></p>'+
            '<p>Gold Standard genes: <strong>'+db().filter(isGoldStandard).length+'</strong></p>'+
            '<p>Genes with ciliopathy: <strong>'+db().filter(function(r){ return getCil(r).length > 0; }).length+'</strong></p>');
    }

    /* screen_count */
    if (type === 'screen_count') {
        return card('Screen Datasets',
            '<p>CiliaHub contains data from <strong>5 functional cilia screens</strong>: Kim 2016, Wheway 2015, Breslow 2018, Mick 2015, and Reiter labs.</p>');
    }

    /* disease_count_all */
    if (type === 'disease_count_all') {
        var byCil = (win.CiliAI && win.CiliAI.lookups && win.CiliAI.lookups.byCiliopathy) || {};
        return card('Ciliopathy Statistics',
            '<p>CiliaHub tracks <strong>'+Object.keys(byCil).length+'</strong> ciliopathy disease categories.</p>');
    }

    /* loc_count */
    if (type === 'loc_count') {
        var count = genesByLoc(intent.loc.term).length;
        return card(intent.loc.label+' Gene Count',
            '<p><strong>'+count+'</strong> genes are localized to <strong>'+intent.loc.term+'</strong> in CiliaHub.</p>');
    }

    /* domain_count */
    if (type === 'domain_count') {
        var dcount = db().filter(function(r){ return hasDomain(r, intent.domain); }).length;
        return card('Domain Count',
            '<p><strong>'+dcount+'</strong> ciliary genes contain <strong>'+intent.domain.toUpperCase()+'</strong> domains.</p>');
    }

    /* domain_gene */
    if (type === 'domain_gene') {
        var g = findG(intent.gene);
        if (!g) return null;
        var doms = getDomains(g);
        if (!doms || !doms.length)
            return card(intent.gene+' Domains', '<p>No Pfam domain annotations found for <strong>'+intent.gene+'</strong>.</p>');
        return card(intent.gene+' Protein Domains',
            '<p><strong>'+doms.length+'</strong> domain(s):</p>'+
            tbl(['Pfam ID','Domain Name'], doms.map(function(d){
                return ['<a href="https://pfam.xfam.org/family/'+d.pfam_id+'" target="_blank" style="color:#005b96;">'+d.pfam_id+'</a>', d.name||'—'];
            })));
    }

    /* domain_list */
    if (type === 'domain_list') {
        var matches = db().filter(function(r){ return hasDomain(r, intent.domain); });
        return card(intent.domain.toUpperCase()+' Domain Genes',
            '<p>Found <strong>'+matches.length+'</strong> genes with '+intent.domain+' domains:</p>'+
            badgeList(matches.map(getGene))+
            csvLink(matches, ['Gene','Localization'], intent.domain.replace(/[^a-z0-9]/gi,'_')+'_genes.csv'));
    }

    /* domain_combo */
    if (type === 'domain_combo') {
        var doms = intent.domains;
        var matches = db().filter(function(r){ return doms.every(function(d){ return hasDomain(r,d); }); });
        return card('Genes with '+doms.map(function(d){ return d.toUpperCase(); }).join(' + ')+' Domains',
            '<p>Found <strong>'+matches.length+'</strong> genes:</p>'+
            badgeList(matches.map(getGene))+
            csvLink(matches, ['Gene','Localization'], doms.join('_')+'_combo.csv'));
    }

    /* domain_enrichment */
    if (type === 'domain_enrichment') {
        var counts = {};
        db().forEach(function(r){
            getDomains(r).forEach(function(d){
                var n = d.name || d.pfam_id || '?';
                counts[n] = (counts[n]||0) + 1;
            });
        });
        var sorted = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; }).slice(0,20);
        return card('Most Common Protein Domains',
            tbl(['Domain','Gene Count'], sorted.map(function(n){ return [n, counts[n]]; })));
    }

    /* tissue_max */
    if (type === 'tissue_max') {
        var sym = intent.gene.toUpperCase();
        var te = win._tissueExpr;
        if (te && te.max && te.max[sym]) {
            var m = te.max[sym];
            var top5 = (te.top5 && te.top5[sym]) || [];
            /* Heatmap button — only if the summary has the per-tissue
             * data for this gene (the 'all' field added by
             * build_tissue_summary.py). Without 'all' the original
             * max+top5 view renders unchanged; this is purely additive. */
            var hasAll = te.all && te.all[sym];
            var heatmapBtn = hasAll
                ? '<div style="margin-top:14px;text-align:right;">' +
                    '<button onclick="window.renderTissueHeatmap(\'' + sym + '\')" ' +
                    'style="padding:6px 14px;background:#185FA5;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">' +
                    '📊 View as heatmap (all tissues)' +
                    '</button>' +
                  '</div>'
                : '';
            return card(sym+' Tissue Expression',
                '<p>Highest: <strong>'+m.tissue+'</strong> ('+(m.nTPM ? m.nTPM.toFixed(1) : '—')+' nTPM)</p>'+
                (top5.length ? tbl(['Tissue','nTPM'], top5.map(function(x){ return [x.tissue, x.nTPM ? x.nTPM.toFixed(1) : '—']; })) : '')+
                heatmapBtn);
        }
        return card(sym+' Tissue Expression', '<p>No HPA expression data found for <strong>'+sym+'</strong>.</p>');
    }

    /* gene_lof */
    if (type === 'gene_lof') {
        var g = findG(intent.gene);
        if (!g) return null;
        return card(intent.gene+' Loss-of-Function Effect',
            '<p>LoF phenotype: <strong>'+(getLOF(g)||'Not Reported')+'</strong></p>'+
            '<p>% Ciliated cells: <strong>'+(getPCT(g)||'Not Reported')+'</strong></p>'+
            '<p>Localization: <em>'+getLoc(g)+'</em></p>');
    }

    /* gene_oe */
    if (type === 'gene_oe') {
        var g = findG(intent.gene);
        if (!g) return null;
        return card(intent.gene+' Overexpression Effect',
            '<p>OE phenotype: <strong>'+(getOE(g)||'Not Reported')+'</strong></p>'+
            '<p>Localization: <em>'+getLoc(g)+'</em></p>');
    }

    /* gene_disease_count */
    if (type === 'gene_disease_count') {
        var g = findG(intent.gene);
        if (!g) return null;
        var cils = g.Ciliopathies || [];
        if (!Array.isArray(cils)) cils = cils ? String(cils).split(/,\s*/) : [];
        if (!cils.length)
            return card(intent.gene+' Ciliopathies', '<p><strong>'+intent.gene+'</strong> has no direct ciliopathy association in CiliaHub.</p>');
        return card(intent.gene+' Ciliopathies — '+cils.length+' diseases',
            '<p>'+cils.map(function(c){ return pill(c.trim(),'blue'); }).join(' ')+'</p>');
    }

    /* most_disease_gene */
    if (type === 'most_disease_gene') {
        var top = null, topCount = 0;
        db().forEach(function(r){
            var cils = r.Ciliopathies || [];
            if (!Array.isArray(cils)) cils = cils ? String(cils).split(/,\s*/) : [];
            if (cils.length > topCount) { topCount = cils.length; top = r; }
        });
        if (!top) return null;
        var cils2 = top.Ciliopathies || [];
        if (!Array.isArray(cils2)) cils2 = String(cils2).split(/,\s*/);
        return card('Gene with Most Ciliopathies',
            '<p><strong>'+getGene(top)+'</strong> causes <strong>'+cils2.length+'</strong> ciliopathies:</p>'+
            '<p>'+cils2.map(function(c){ return pill(c.trim(),'blue'); }).join(' ')+'</p>');
    }

    /* gene_ortholog */
    if (type === 'gene_ortholog') {
        var g = findG(intent.gene);
        if (!g) return null;
        var q = intent.q || '';
        var mouse = g.Ortholog_Mouse || '—';
        var ce = g.Ortholog_C_elegans || '—';
        var zf = g.Ortholog_Zebrafish || '—';
        var dro = g.Ortholog_Drosophila || '—';
        if (/mouse/i.test(q)) return card(intent.gene+' Mouse Ortholog', '<p>Mouse: <strong>'+mouse+'</strong></p>');
        if (/elegans/i.test(q)) return card(intent.gene+' C. elegans Ortholog', '<p>C. elegans: <strong>'+ce+'</strong></p>');
        if (/zebrafish|danio/i.test(q)) return card(intent.gene+' Zebrafish Ortholog', '<p>Zebrafish: <strong>'+zf+'</strong></p>');
        if (/drosophila|fly/i.test(q)) return card(intent.gene+' Drosophila Ortholog', '<p>Drosophila: <strong>'+dro+'</strong></p>');
        return card(intent.gene+' Orthologs',
            tbl(['Organism','Ortholog'],[['Mouse',mouse],['C. elegans',ce],['Zebrafish',zf],['Drosophila',dro]]));
    }

    /* disease_overlap */
    if (type === 'disease_overlap') {
        var genesA = genesByDisease(intent.disA);
        var setB = {};
        genesByDisease(intent.disB).forEach(function(g){ setB[g]=1; });
        var overlap = genesA.filter(function(g){ return setB[g]; });
        return card(intent.disA.toUpperCase()+' \u2229 '+intent.disB.toUpperCase(),
            '<p>Shared genes: <strong>'+overlap.length+'</strong></p>'+
            badgeList(overlap)+
            csvLink(overlap.map(function(s){ return {Gene:s}; }), ['Gene'], intent.disA+'_'+intent.disB+'_overlap.csv'));
    }

    /* disease_diff */
    if (type === 'disease_diff') {
        var genesA = genesByDisease(intent.disA);
        var setB = {};
        genesByDisease(intent.disB).forEach(function(g){ setB[g]=1; });
        var unique = genesA.filter(function(g){ return !setB[g]; });
        return card('Unique to '+intent.disA.toUpperCase(),
            '<p>In '+intent.disA.toUpperCase()+' but NOT '+intent.disB.toUpperCase()+': <strong>'+unique.length+'</strong></p>'+
            badgeList(unique)+
            csvLink(unique.map(function(s){ return {Gene:s}; }), ['Gene'], intent.disA+'_not_'+intent.disB+'.csv'));
    }

    /* ortholog_filter */
    if (type === 'ortholog_filter') {
        var org = intent.organism || 'mouse';
        var orgField = {mouse:'Ortholog_Mouse',c_elegans:'Ortholog_C_elegans',zebrafish:'Ortholog_Zebrafish',drosophila:'Ortholog_Drosophila'}[org] || 'Ortholog_Mouse';
        var orgLabel = {mouse:'Mouse',c_elegans:'C. elegans',zebrafish:'Zebrafish',drosophila:'Drosophila'}[org] || 'Mouse';
        var pool = db();
        if (intent.disease) { var ds={}; genesByDisease(intent.disease).forEach(function(g){ ds[g]=1; }); pool=pool.filter(function(r){ return ds[getGene(r)]; }); }
        if (intent.loc) { pool=pool.filter(function(r){ return getLoc(r).indexOf(intent.loc.term) !== -1; }); }
        var filtered = pool.filter(function(r){ return r[orgField] && r[orgField] !== '—'; });
        return card((intent.disease?intent.disease.toUpperCase()+' ':'')+'Genes with '+orgLabel+' Ortholog',
            '<p>Found <strong>'+filtered.length+'</strong> genes:</p>'+
            tbl(['Gene',orgLabel+' Ortholog','Localization'], filtered.map(function(r){
                return [chip(getGene(r)), r[orgField]||'—', getLoc(r).slice(0,60)];
            }))+csvLink(filtered, ['Gene',orgField,'Localization'], org+'_orthologs.csv'));
    }

    /* multi_loc */
    if (type === 'multi_loc') {
        var locs = intent.locs, eff = intent.effect;
        var matches = db().filter(function(r){
            var loc = getLoc(r);
            return locs.every(function(l){ return loc.indexOf(l) !== -1; }) && (!eff || lofMatches(r, eff));
        });
        if (!matches.length)
            return card(locs.join(' + '), '<p>No genes found in both <strong>'+locs.join('</strong> and <strong>')+'</strong>'+(eff?' with '+eff+' phenotype':'')+'. Try a single compartment query.</p>');
        return card(locs.map(function(l){ return l.charAt(0).toUpperCase()+l.slice(1); }).join(' + ')+' Genes',
            '<p><strong>'+matches.length+'</strong> genes localized to '+locs.join(' AND ')+(eff?' with LoF <strong>'+eff+'</strong>':'')+':</p>'+
            tbl(['Gene','LoF Effect','Localization'], matches.map(function(r){
                return [chip(getGene(r)), getLOF(r)||'—', getLoc(r).slice(0,70)];
            }))+csvLink(matches, ['Gene','Localization'], locs.join('_')+(eff?'_'+eff:'')+'.csv'));
    }

    /* oe_filter */
    if (type === 'oe_filter') {
        var matches = db().filter(function(r){ return oefMatches(r, intent.effect); });
        return card('Overexpression: '+intent.effect,
            '<p><strong>'+matches.length+'</strong> genes where OE causes <strong>'+intent.effect+'</strong>:</p>'+
            tbl(['Gene','OE Effect','Localization'], matches.map(function(r){
                return [chip(getGene(r)), getOE(r)||'—', getLoc(r).slice(0,60)];
            }))+csvLink(matches, ['Gene','Localization'], 'oe_'+intent.effect+'.csv'));
    }

    /* loc_phenotype */
    if (type === 'loc_phenotype') {
        var locTerm = intent.loc.term;
        var matches = db().filter(function(r){ return getLoc(r).indexOf(locTerm) !== -1 && lofMatches(r, intent.effect); });
        return card(intent.loc.label+' Genes: LoF '+intent.effect,
            '<p><strong>'+matches.length+'</strong> '+intent.loc.label+' genes with LoF <strong>'+intent.effect+'</strong>:</p>'+
            tbl(['Gene','LoF Effect','% Ciliated','Localization'], matches.map(function(r){
                return [chip(getGene(r)), getLOF(r)||'—', getPCT(r)||'—', getLoc(r).slice(0,60)];
            }))+csvLink(matches, ['Gene','Localization'], locTerm.replace(/\s+/g,'_')+'_lof_'+intent.effect+'.csv'));
    }

    /* disease_lof */
    if (type === 'disease_lof') {
        var ds = {}; genesByDisease(intent.disease).forEach(function(g){ ds[g]=1; });
        var matches = db().filter(function(r){ return ds[getGene(r)] && lofMatches(r, intent.effect); });
        return card(intent.disease.toUpperCase()+': LoF '+intent.effect,
            '<p><strong>'+matches.length+'</strong> genes:</p>'+badgeList(matches.map(getGene)));
    }

    /* lof_filter */
    if (type === 'lof_filter') {
        var matches = db().filter(function(r){ return lofMatches(r, intent.effect); });
        return card('LoF Effect: '+intent.effect,
            '<p><strong>'+matches.length+'</strong> genes with LoF <strong>'+intent.effect+'</strong>:</p>'+
            tbl(['Gene','LoF Effect','% Ciliated','Localization'], matches.map(function(r){
                return [chip(getGene(r)), getLOF(r)||'—', getPCT(r)||'—', getLoc(r).slice(0,60)];
            }))+csvLink(matches, ['Gene','Localization'], 'lof_'+intent.effect+'.csv'));
    }

    /* pct_filter */
    if (type === 'pct_filter') {
        var matches = db().filter(function(r){
            var v = getPCT(r).toLowerCase();
            if (!v || /not reported|unknown/.test(v)) return false;
            return intent.effect === 'increase' ? /increase|higher|more/.test(v) : /decrease|lower|less|reduc/.test(v);
        });
        return card('% Ciliated: '+intent.effect,
            '<p><strong>'+matches.length+'</strong> genes that '+intent.effect+' % ciliated cells:</p>'+
            badgeList(matches.map(getGene)));
    }

    /* complex_disease */
    if (type === 'complex_disease') {
        var cxG = (COMPLEX_SETS[intent.complex]||[]).map(function(s){ return s.toUpperCase(); });
        var ds = {}; genesByDisease(intent.disease).forEach(function(g){ ds[g]=1; });
        var matches = cxG.filter(function(g){ return ds[g]; });
        return card(intent.complex.replace(/_/g,' ').toUpperCase()+' \u2229 '+intent.disease.toUpperCase(),
            '<p><strong>'+matches.length+'</strong> genes:</p>'+badgeList(matches));
    }

    /* complex_intersect */
    if (type === 'complex_intersect') {
        var setA = {};
        (COMPLEX_SETS[intent.cxA]||[]).forEach(function(g){ setA[g]=1; });
        var inter = (COMPLEX_SETS[intent.cxB]||[]).filter(function(g){ return setA[g]; });
        return card(intent.cxA.toUpperCase()+' \u2229 '+intent.cxB.toUpperCase(),
            '<p>Genes in both: <strong>'+inter.length+'</strong></p>'+badgeList(inter));
    }

    /* dot_plot — render scRNA expression dot plot inline */
    if (type === 'dot_plot') {
        var genes;
        var headerLabel;
        if (intent.source === 'pair') {
            var setA = COMPLEX_SETS[intent.complexA] || [];
            var setB = COMPLEX_SETS[intent.complexB] || [];
            genes = setA.concat(setB);
            // Mark each gene with which complex it belongs to so the
            // renderer can color or group them.
            var complexA_label = intent.complexA.replace(/_/g,'-').toUpperCase();
            var complexB_label = intent.complexB.replace(/_/g,'-').toUpperCase();
            headerLabel = complexA_label + ' vs ' + complexB_label;
            // Pass complex membership to renderer
            if (typeof win.renderDotPlot === 'function') {
                win.renderDotPlot({
                    genes: genes,
                    title: headerLabel,
                    setA: setA, labelA: complexA_label,
                    setB: setB, labelB: complexB_label
                });
            } else {
                return card('Dot plot unavailable',
                    '<p style="color:#94a3b8;">Dot plot renderer not loaded.</p>');
            }
            return '';   // Renderer added its own chat message
        }
        // source === 'list'
        genes = intent.genes;
        headerLabel = 'Dot plot: ' + genes.join(', ');
        if (typeof win.renderDotPlot === 'function') {
            win.renderDotPlot({
                genes: genes,
                title: headerLabel
            });
        } else {
            return card('Dot plot unavailable',
                '<p style="color:#94a3b8;">Dot plot renderer not loaded.</p>');
        }
        return '';   // Renderer added its own chat message
    }

    /* complex_list */
    if (type === 'complex_list') {
        var genes = COMPLEX_SETS[intent.complex] || [];
        var label = intent.complex.replace(/_/g,' ').toUpperCase();
        return card(label+' Genes',
            '<p><strong>'+genes.length+'</strong> genes:</p>'+
            badgeList(genes)+
            csvLink(genes.map(function(s){ return {Gene:s}; }), ['Gene'], intent.complex+'_genes.csv'));
    }

    /* disease_loc_domain (3-way combo) */
    if (type === 'disease_loc_domain') {
        var ds = {}; genesByDisease(intent.disease).forEach(function(g){ ds[g]=1; });
        var matches = db().filter(function(r){
            return ds[getGene(r)] &&
                   getLoc(r).indexOf(intent.loc.term) !== -1 &&
                   hasDomain(r, intent.domain);
        });
        return card(
            intent.disease.toUpperCase()+' + '+intent.loc.label+' + '+intent.domain.toUpperCase()+' Domain',
            '<p><strong>'+matches.length+'</strong> genes matching all three criteria:</p>'+
            (matches.length > 0
                ? badgeList(matches.map(getGene)) +
                  csvLink(matches, ['Gene','Localization'],
                          intent.disease+'_'+intent.loc.term.replace(/\s/g,'_')+'_'+intent.domain+'.csv')
                : '<p style="color:#64748b;">No genes match all three criteria.</p>'));
    }

    /* loc_disease */
    if (type === 'loc_disease') {
        var ds = {}; genesByDisease(intent.disease).forEach(function(g){ ds[g]=1; });
        var matches = db().filter(function(r){ return getLoc(r).indexOf(intent.loc.term) !== -1 && ds[getGene(r)]; });
        return card(intent.loc.label+' + '+intent.disease.toUpperCase(),
            '<p><strong>'+matches.length+'</strong> genes:</p>'+
            badgeList(matches.map(getGene))+
            csvLink(matches, ['Gene','Localization'], intent.loc.term.replace(/\s/g,'_')+'_'+intent.disease+'.csv'));
    }

    /* loc_domain */
    if (type === 'loc_domain') {
        var matches = db().filter(function(r){ return getLoc(r).indexOf(intent.loc.term) !== -1 && hasDomain(r, intent.domain); });
        return card(intent.loc.label+' + '+intent.domain.toUpperCase()+' Domain',
            '<p><strong>'+matches.length+'</strong> genes:</p>'+badgeList(matches.map(getGene)));
    }

    /* disease_domain */
    if (type === 'disease_domain') {
        var ds = {}; genesByDisease(intent.disease).forEach(function(g){ ds[g]=1; });
        var matches = db().filter(function(r){ return ds[getGene(r)] && hasDomain(r, intent.domain); });
        return card(intent.disease.toUpperCase()+' + '+intent.domain.toUpperCase()+' Domain',
            '<p><strong>'+matches.length+'</strong> genes:</p>'+badgeList(matches.map(getGene)));
    }

    /* loc_list */
    if (type === 'loc_list') {
        var locTerm = intent.loc.term;
        var matches = genesByLoc(locTerm);
        return card(intent.loc.label+' Genes',
            '<p>Found <strong>'+matches.length+'</strong> genes localized to <strong>'+locTerm+'</strong>:</p>'+
            badgeList(matches.map(getGene))+
            csvLink(matches, ['Gene','Localization'], locTerm.replace(/\s+/g,'_')+'_genes.csv'));
    }

    /* pan_ciliary */
    if (type === 'pan_ciliary') {
        var sc = win._scRNAClassification;
        if (!sc || !sc.pan_ciliary) return card('Pan-Ciliary Genes', '<p>scRNA data loading... Try again in a moment.</p>');
        var genes = sc.pan_ciliary;
        return card('Pan-Ciliary Genes ('+genes.length+')',
            '<small style="color:#64748b;display:block;margin-bottom:6px;">Expressed in ciliated cells across 4+ tissues (Lung, Retina, Olfactory, Pancreas, Limb Bud)</small>'+
            badgeList(genes.slice(0,80))+
            '<a href="data:text/csv;charset=utf-8,Gene\n'+encodeURIComponent(genes.join('\n'))+'" download="pan_ciliary_genes.csv" '+
            'style="display:inline-block;margin-top:8px;padding:6px 14px;background:#005b96;color:white;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">\u2193 Download CSV ('+genes.length+' genes)</a>');
    }

    /* idio_ciliary */
    if (type === 'idio_ciliary') {
        var sc = win._scRNAClassification;
        if (!sc || !sc.idio_ciliary) return card('Idio-Ciliary Genes', '<p>scRNA data loading... Try again in a moment.</p>');
        var genes = sc.idio_ciliary;
        return card('Idio-Ciliary Genes ('+genes.length+')',
            '<small style="color:#64748b;display:block;margin-bottom:6px;">Expressed in ciliated cells in 1-3 tissues</small>'+
            badgeList(genes.slice(0,80))+
            '<a href="data:text/csv;charset=utf-8,Gene\n'+encodeURIComponent(genes.join('\n'))+'" download="idio_ciliary_genes.csv" '+
            'style="display:inline-block;margin-top:8px;padding:6px 14px;background:#005b96;color:white;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">\u2193 Download CSV ('+genes.length+' genes)</a>');
    }

    /* gold_standard */
    if (type === 'gold_standard') {
        var genes = db().filter(isGoldStandard);
        return card('Gold Standard Ciliary Genes ('+genes.length+')',
            '<small style="color:#64748b;display:block;margin-bottom:6px;">Structurally localized to: basal body, transition zone, axoneme, cilia, centrosome, flagella</small>'+
            badgeList(genes.slice(0,80).map(getGene))+
            csvLink(genes, ['Gene','Localization'], 'gold_standard_ciliary_genes.csv'));
    }

    /* classification_list */
    if (type === 'classification_list') {
        var matches = db().filter(function(r){
            var cc = (r.ciliopathy_classification || '').toLowerCase();
            return intent.cls === 'primary' ? /primary/i.test(cc) : /motile/i.test(cc);
        });
        var label = intent.cls === 'primary' ? 'Primary Ciliopathy' : 'Motile Ciliopathy';
        return card(label+' Genes',
            '<p><strong>'+matches.length+'</strong> genes:</p>'+
            badgeList(matches.map(getGene))+
            csvLink(matches, ['Gene','Localization'], intent.cls+'_ciliopathy_genes.csv'));
    }

    /* disease_list */
    if (type === 'disease_list') {
        var genes = genesByDisease(intent.disease);
        return card(intent.disease.toUpperCase()+' Syndrome Genes',
            '<p>Found <strong>'+genes.length+'</strong> genes:</p>'+
            badgeList(genes)+
            csvLink(genes.map(function(s){ return {Gene:s}; }), ['Gene'], intent.disease+'_genes.csv'));
    }

    /* export_csv */
    if (type === 'export_csv') {
        var all = db();
        return card('Download All Ciliary Genes',
            '<p>Exporting <strong>'+all.length+'</strong> genes:</p>'+
            csvLink(all, ['Gene','Localization'], 'ciliahub_all_genes.csv'));
    }

    /* compartment_bio */
    if (type === 'compartment_bio') {
        var bios = {
            'transition zone': 'The transition zone (TZ) is a ciliary gate at the base of the cilium controlling protein entry/exit. It contains the MKS and NPHP modules and is mutated in Joubert, MKS, and NPHP syndromes.',
            'basal body': 'The basal body is derived from the mother centriole and templates axoneme assembly. It is the docking station for IFT trains and is critical for ciliogenesis.',
            'axoneme': 'The axoneme is the microtubule skeleton of the cilium (9+2 in motile; 9+0 in primary). It contains dynein arms, radial spokes, and nexin-dynein regulatory complexes.',
            'cilia': 'Cilia are hair-like cell projections functioning in signaling (primary cilia) or fluid movement (motile cilia). Defects cause ciliopathies affecting kidney, brain, retina, and other organs.',
            'centrosome': 'The centrosome is the main microtubule organizing center containing two centrioles and pericentriolar material. The mother centriole matures into the basal body during ciliogenesis.',
            'mitochondria': 'Mitochondria-ciliary connections involve energy supply for ciliogenesis and axonemal dynein function. Several ciliary genes localize to both compartments.',
            'peroxisome': 'Peroxisome-ciliary connections include lipid metabolism and ROS regulation. Several genes like PEX family members have dual peroxisome-cilia functions.',
            'nucleus': 'Many ciliary transcription factors and signaling molecules shuttle between the cilium and nucleus, including GLI proteins in Hedgehog signaling.'
        };
        var locTerm = intent.loc.term;
        var bio = bios[locTerm] || 'This compartment contains '+genesByLoc(locTerm).length+' ciliary genes in CiliaHub.';
        return card(intent.loc.label+' Biology',
            '<p>'+bio+'</p>'+
            '<p style="font-size:11px;color:#64748b;margin-top:8px;">'+genesByLoc(locTerm).length+' genes in this compartment. Ask "show '+locTerm+' genes" to list them.</p>');
    }

    /* multi_gene_compare */
    if (type === 'multi_gene_compare') {
        var rows = intent.genes.map(function(sym) {
            var g = findG(sym);
            if (!g) return null;
            return [chip(getGene(g)), getLoc(g).slice(0,50)||'—', getLOF(g)||'—', getOE(g)||'—', getCil(g).slice(0,50)||'—'];
        }).filter(Boolean);
        return card('Gene Comparison', tbl(['Gene','Localization','LoF','OE Effect','Ciliopathies'], rows));
    }

    /* multi_gene */
    if (type === 'multi_gene') {
        var rows = intent.genes.map(function(sym) {
            var g = findG(sym);
            if (!g) return null;
            return [chip(getGene(g)), getLoc(g).slice(0,50)||'—', getLOF(g)||'—', getCil(g).slice(0,50)||'—'];
        }).filter(Boolean);
        return card('Gene Summary', tbl(['Gene','Localization','LoF Effect','Ciliopathies'], rows));
    }

    /* gene_overview was removed (April 29). matchIntent no longer returns
     * this intent type — single-gene queries fall through to ciliai.js,
     * which has its own dedicated single-gene handler. Leaving the dispatch
     * arm here would be dead code. See matchIntent P33 for context. */

    return null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * WRAP & INSTALL
 * ══════════════════════════════════════════════════════════════════════════ */
function say(html) {
    if (typeof win.addChatMessage === 'function') win.addChatMessage(html, false);
}

function clearFollowUpContext() {
    /* Prevent ciliai.js from showing "Displaying X in main panel" for previous query */
    try { if (typeof lastQueryContext !== 'undefined') lastQueryContext = { type:null, data:[], term:null }; } catch(e){}
    if (win.lastQueryContext) win.lastQueryContext = { type:null, data:[], term:null };
}

function wrap(originalFn) {
    var wrapped = function(queryOrOpts) {
        var text = (typeof queryOrOpts === 'string') ? queryOrOpts
                 : (queryOrOpts && (queryOrOpts.text || queryOrOpts.raw || ''));
        if (!text || !text.trim()) return originalFn.apply(this, arguments);

        var intent = matchIntent(text);
        if (intent) {
            var html = dispatch(intent);
            if (html !== null && html !== undefined) {
                /* Ensure user query appears as a chat bubble even when
                 * intercepted. dispatchAction normally echoes the query
                 * before calling handleAIQuery, but for intercepted
                 * queries that path may be bypassed by other code (e.g.,
                 * the follow-up renderer in ciliai-enhancements.js
                 * appears to overwrite recent siblings). This idempotent
                 * check adds the bubble only if it isn't already the
                 * most recent user message — safe under all paths. */
                try {
                    var msgs = win.document.getElementById('messages');
                    var allUserMsgs = msgs && msgs.querySelectorAll('.ciliai-message.user');
                    var lastUser = allUserMsgs && allUserMsgs.length ? allUserMsgs[allUserMsgs.length - 1] : null;
                    var lastUserText = lastUser && lastUser.textContent && lastUser.textContent.trim();
                    if (lastUserText !== text.trim() && typeof win.addChatMessage === 'function') {
                        win.addChatMessage(text, true);
                    }
                } catch(e) {}
                /* Clear stale context to stop double panel update */
                clearFollowUpContext();
                /* Render response (empty string = gene card in panel, no chat message) */
                if (html !== '') say(html);
                /* Return without calling originalFn — this prevents ciliai.js pipeline */
                return;
            }
        }
        /* No intent matched — let ciliai.js handle it */
        return originalFn.apply(this, arguments);
    };
    wrapped.__intercepted = true;
    wrapped.__originalFn = originalFn;
    return wrapped;
}

function install() {
    if (typeof win.handleAIQuery === 'function' && !win.handleAIQuery.__intercepted)
        win.handleAIQuery = wrap(win.handleAIQuery);
    if (win.CiliAI && win.CiliAI.Router && typeof win.CiliAI.Router.dispatchAction === 'function' &&
        !win.CiliAI.Router.dispatchAction.__intercepted)
        win.CiliAI.Router.dispatchAction = wrap(win.CiliAI.Router.dispatchAction);
}

install();
setTimeout(install, 300);
setTimeout(install, 800);

/* Expose for external checks */
win._CiliAI_Interceptor = {
    isSuppressing: function() { return false; },
    clearFollowUpContext: clearFollowUpContext
};

/* Load remote data after page settles */
setTimeout(function() {
    buildPfamData();
    loadCiliopathyData();
    loadTissueExpressionSummary();
    loadScRNAClassification();
    preloadPhylogenyData();
}, 2000);

console.log('[CiliaHub Interceptor v9.9] Loaded — gene_overview removed; classification matchers above loc_list; defensive user echo; dot plot intent (P4a) for scRNA expression by cell type.');

})(window);
