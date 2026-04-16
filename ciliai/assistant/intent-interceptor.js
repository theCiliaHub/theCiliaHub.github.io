/**
 * CiliAI Intent Interceptor v2.1
 * Install: ONE script tag AFTER ciliai.js in index.html
 *   <script src="./ciliai/ciliai.js"></script>
 *   <script src="./ciliai/assistant/intent-interceptor.js"></script>
 */
'use strict';
(function (win) {

var LOF_KEYS = [
    'Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)',
    'lof_effects', 'LoF_effects', 'lof_effect'
];
var OE_KEYS = [
    'Overexpression effects on cilia length (increase/decrease/no effect)',
    'overexpression_effects'
];
var PCT_KEYS = [
    'Percentage of ciliated cells (increase/decrease/no effect)',
    'percent_ciliated_cells_effects'
];

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

/* DATA HELPERS */
function db() { return (win.CiliAI && win.CiliAI.masterData) ? win.CiliAI.masterData : []; }
function gmap() { return (win.CiliAI && win.CiliAI.lookups && win.CiliAI.lookups.geneMap) || {}; }
function getField(row, keys) {
    for (var i = 0; i < keys.length; i++) {
        var v = row[keys[i]];
        if (v && typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
}
function getLOF(row)  { return getField(row, LOF_KEYS);  }
function getOE(row)   { return getField(row, OE_KEYS);   }
function getPCT(row)  { return getField(row, PCT_KEYS);  }
function getLoc(row)  { return ((row['Localization'] || row['localization'] || '')).toLowerCase(); }
function lofMatches(row, effect) {
    var v = getLOF(row).toLowerCase();
    if (!v || v.indexOf('not reported') !== -1) return false;
    if (effect === 'shorter')   return /shorter|short.cilia|short.cilium/.test(v);
    if (effect === 'longer')    return /longer|elongat/.test(v);
    if (effect === 'loss')      return /loss.of.cilia|no.cilia|blocked|abolished/.test(v);
    if (effect === 'no_effect') return /^no[_ ]effect$/.test(v.trim());
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
function inComplex(gene, key) { return (COMPLEX_SETS[key] || []).indexOf(gene) !== -1; }

/* PHYLO CONTEXT — stores last comparison so "yes"/"show it" can re-render */
var _lastPhyloGenes = null;
var _lastPhyloNames = null;

function renderPhyloPlot(geneSymbols) {
    if (!geneSymbols || !geneSymbols.length) return false;
    if (typeof win.switchView === 'function') win.switchView('plot');
    var gmapObj = gmap();
    var geneObjs = geneSymbols.map(function(s){ return gmapObj[s]; }).filter(Boolean);
    if (!geneObjs.length) return false;
    var fns = ['renderPhylogenyHeatmap','getPhylogenyAnalysis',
               'displayPhylogenyHeatmap','showPhylogenyHeatmap','renderPhylogenetics'];
    for (var fi = 0; fi < fns.length; fi++) {
        var fn = win[fns[fi]] || (win.CiliAI && win.CiliAI[fns[fi]]);
        if (typeof fn === 'function') {
            try { fn(geneObjs, {}); return true; } catch(e) {}
        }
    }
    return false;
}

/* SUPPRESSION — blocks ciliai.js from appending its own answer after ours */
var _suppressing = false;
var _suppressTimer = null;
function startSuppression() {
    _suppressing = true;
    if (_suppressTimer) clearTimeout(_suppressTimer);
    _suppressTimer = setTimeout(function() { _suppressing = false; _suppressTimer = null; }, 1200);
}

/* INTENT MATCHERS */
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
function matchLocKw(q) {
    var locs = [
        ['transition zone', {term:'transition zone',label:'Transition Zone'}],
        ['ciliary axoneme', {term:'axoneme',label:'Axoneme'}],
        ['ciliary tip',     {term:'ciliary tip',label:'Ciliary Tip'}],
        ['ciliary membrane',{term:'ciliary membrane',label:'Ciliary Membrane'}],
        ['basal body',      {term:'basal body',label:'Basal Body'}],
        ['motile cilia',    {term:'motile cilia',label:'Motile Cilia'}],
        ['centrosome',      {term:'centrosome',label:'Centrosome'}],
        ['mitochondria',    {term:'mitochondria',label:'Mitochondria'}],
        ['lysosom',         {term:'lysosom',label:'Lysosomes'}],
        ['axonemal',        {term:'axoneme',label:'Axoneme'}],
        ['axoneme',         {term:'axoneme',label:'Axoneme'}],
        ['flagella',        {term:'flagella',label:'Flagella / Axoneme'}],
        ['nucleus',         {term:'nucleus',label:'Nucleus'}],
        ['cilia',           {term:'cilia',label:'Cilia'}]
    ];
    for (var i = 0; i < locs.length; i++) {
        if (q.indexOf(locs[i][0]) !== -1) return locs[i][1];
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
        ['cerebellum','cerebellum'],['cerebellar','cerebellum'],
        ['hypothalamus','hypothalamus'],['brain','hypothalamus'],
        ['kidney','kidney'],['renal','kidney'],
        ['lung','lung'],['airway','lung'],['pulmonary','lung'],
        ['liver','liver'],['hepat','liver'],['retina','retina'],
        ['olfactory','olfactory'],['pancrea','pancreas'],
        ['chondrocyte','chondrocyte'],['testis','testis'],
        ['testicular','testis'],['limb bud','limb_bud']
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
    if (/no effect|no phenotype/.test(q)) return 'no_effect';
    if (/motility defect|immotile/.test(q)) return 'motility';
    if (/knocked down|knockdown|depletion/.test(q)) return 'knockdown';
    return null;
}
function matchDomainKw(q) {
    for (var fam in DOMAIN_TERMS) {
        var terms = DOMAIN_TERMS[fam];
        for (var i = 0; i < terms.length; i++) { if (q.indexOf(terms[i]) !== -1) return fam; }
    }
    return null;
}

function matchIntent(raw) {
    var t = raw.trim();
    var q = t.toLowerCase();

    if (/what can you do|tell me about yourself|what are you|ciliai capabilities|what information|what datasets|how can you help/.test(q)) {
        return {type:'self_intro'};
    }

    /* Follow-up: re-render last phylo when user says "yes" / "show it" etc */
    if (_lastPhyloGenes && _lastPhyloGenes.length) {
        if (/^(yes|yeah|sure|ok|okay|please|show it|do it|show the plot|show heatmap|render|plot it|display it|show phylo|phylogenetic heatmap)[\s.!?]*$/.test(q) ||
            /phylogenetic heatmap shown in plot/.test(q) ||
            /show.*heatmap|heatmap.*plot/.test(q)) {
            return {type:'show_last_phylo'};
        }
    }

    var loc     = matchLocKw(q);
    var disease = matchDiseaseKw(q);
    var tissue  = matchTissueKw(q);
    var complex = matchComplexKw(q);
    var lofEff  = matchLOFKw(q);
    var domain  = matchDomainKw(q);
    var genes   = extractGenes(t);

    if (domain && /how many|count|number of/.test(q)) return {type:'domain_count', domain:domain};
    if (domain && /which genes|what genes|list|show|proteins with|genes with|containing/.test(q) && genes.length < 2) return {type:'domain_list', domain:domain};
    if (/domain/.test(q) && /enrich|common|frequent|top domain/.test(q)) return {type:'domain_enrichment'};
    if (/what domains|domains of|domain structure|domains does|domains in/.test(q) && genes.length === 1) return {type:'domain_gene', gene:genes[0]};
    if (genes.length === 1 && /lof|loss.of.function|knockout|knock.out|knockdown|phenotype.*of|effect.*of|what does.*do|what happen/.test(q)) return {type:'lof_gene', gene:genes[0]};

    /* Suppress spurious 'cilia' loc match from disease names like 'Primary Ciliary Dyskinesia' */
    if (loc && loc.term === 'cilia' && disease) loc = null;

    if (loc && lofEff) return {type:'loc_phenotype', loc:loc, effect:lofEff};
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
    if (pfamM) return {type:'pfam_filter', pfam:pfamM[0], scope:/vertebrate/.test(q)?'vertebrate':'all'};
    if (/no.effect|no.*phenotype/.test(q) && /conserv|phylogen/.test(q)) return {type:'lof_conserved_tissue', tissue:tissue};
    return null;
}

/* RENDER HELPERS */
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
    var names = {lung:'Lung',kidney:'Kidney',liver:'Liver',hypothalamus:'Hypothalamus',
                 retina:'Retina',cerebellum:'Cerebellum',chondrocyte:'Chondrocyte',testis:'Testis',limb_bud:'Limb Bud'};
    var n = names[tissue] || tissue;
    var has = 'lung kidney liver hypothalamus chondrocyte retina cerebellum'.indexOf(tissue) !== -1;
    return has
        ? '<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">scRNA-seq data for <b>'+n+'</b> is available. Click the Plot tab.</div>'
        : '<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#92400e;">Tissue expression for <b>'+n+'</b> not yet in CiliAI. Gene list from CiliaHub annotations.</div>';
}
function disName(tag) {
    var N = {joubert:'Joubert Syndrome',bardet_biedl:'Bardet-Biedl Syndrome',meckel:'Meckel-Gruber Syndrome',
             nphp:'Nephronophthisis',pcd:'Primary Ciliary Dyskinesia',retinal:'Retinal Ciliopathies',
             skeletal:'Skeletal Ciliopathies',infertility:'Male Infertility',medulloblastoma:'Medulloblastoma',
             alstrom:'Alstrom Syndrome',pkd:'Polycystic Kidney Disease',usher:'Usher Syndrome',
             holoprosencephaly:'Holoprosencephaly',polydactyly:'Polydactyly'};
    return N[tag] || tag;
}
function tisName(t) {
    var N = {lung:'Human Lung',kidney:'Human Kidney',liver:'Human Liver',hypothalamus:'Hypothalamus/Brain',
             chondrocyte:'Chondrocyte',retina:'Retina',cerebellum:'Fetal Cerebellum',
             testis:'Testis',limb_bud:'Embryonic Limb Bud'};
    return N[t] || t;
}
function cxName(k) {
    var N = {ift_b:'IFT-B',ift_a:'IFT-A',bbsome:'BBSome',dynein2:'Dynein-2',
             mks_module:'MKS module',nphp_module:'NPHP module',transition_zone:'Transition Zone'};
    return N[k] || k;
}

/* DISPATCH */
function dispatch(intent) {
    var type = intent.type;

    if (type === 'self_intro') {
        var total = db().length;
        var withDis = db().filter(function(r){ return r['Ciliopathy'] && r['Ciliopathy'] !== 'N/A'; }).length;
        return '<b>CiliAI</b> - CiliaHub specialist assistant<br><b>Database:</b> '+total+' ciliary genes, '+withDis+' ciliopathy-associated<br><br>'
            +'<b>I can answer:</b><br>'
            +'<div style="margin:3px 0;">LoF phenotype - <i>What is the knockdown effect of KIF3A?</i></div>'
            +'<div style="margin:3px 0;">Protein domains - <i>How many genes have WD40 domains?</i></div>'
            +'<div style="margin:3px 0;">Ciliopathy genes - <i>Joubert syndrome genes</i></div>'
            +'<div style="margin:3px 0;">Loc + phenotype - <i>Basal body genes that shorten cilia</i></div>'
            +'<div style="margin:3px 0;">Complex intersections - <i>BBS genes also in IFT-B</i></div>'
            +'<div style="margin:3px 0;">Phylo comparison - <i>Compare BBSome vs IFT-A conservation</i></div>'
            +'<div style="margin:3px 0;">scRNA-seq - <i>IFT88 in lung</i></div>';
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

    if (type === 'lof_gene') {
        var gobj = gmap()[intent.gene.toUpperCase()];
        if (!gobj) return 'Gene <b>'+intent.gene+'</b> not found in CiliaHub.';
        var lof = getLOF(gobj) || 'Not reported';
        var oe  = getOE(gobj)  || 'Not reported';
        var pct = getPCT(gobj) || 'Not reported';
        var loc = gobj['Localization'] || gobj['localization'] || '-';
        var dis = gobj['Ciliopathy'] || gobj['Ciliopathies'] || '-';
        var sum = gobj['Functional.Summary.from.Literature'] || gobj['functional_summary'] || gobj['Gene.Description'] || '';
        var diseaseHtml = (dis && dis !== '-' && dis !== 'N/A')
            ? '<div style="margin-top:8px;"><b style="font-size:11.5px;color:#475569;">Disease</b><br>'+dis.split(',').slice(0,4).map(function(d){ return pill(d.trim(),'red'); }).join(' ')+'</div>'
            : '';
        return '<b style="font-size:15px;color:#005b96;">'+intent.gene+'</b> - Cilia Phenotype Summary<br><br>'
            +(sum ? '<p style="font-size:12.5px;color:#334155;line-height:1.5;margin-bottom:10px;">'+sum.slice(0,250)+(sum.length>250?'...':'')+'</p>' : '')
            +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">'
            +'<div><b style="color:#475569;">LoF</b><br><span style="color:#7c3aed;font-weight:600;">'+lof+'</span></div>'
            +'<div><b style="color:#475569;">Overexpression</b><br><span style="color:#b45309;">'+oe+'</span></div>'
            +'<div><b style="color:#475569;">% ciliated cells</b><br><span style="color:#065f46;">'+pct+'</span></div>'
            +'<div><b style="color:#475569;">Localization</b><br>'+loc+'</div>'
            +'</div>'+diseaseHtml;
    }

    if (type === 'domain_count') {
        var matches = db().filter(function(r){ return hasDomain(r, intent.domain); });
        return 'There are <b>'+matches.length+' ciliary genes</b> in CiliaHub with a <b>'+intent.domain+'</b> domain.<br>'
            +'<span style="font-size:11.5px;color:#888;">Ask "list genes with '+intent.domain+' domains" to see them all.</span>';
    }

    if (type === 'domain_list') {
        var matches = db().filter(function(r){ return hasDomain(r, intent.domain); });
        if (!matches.length) return 'No genes found with <b>'+intent.domain+'</b> domain in CiliaHub.';
        return '<b>'+intent.domain+' domain</b> - <b>'+matches.length+' genes</b>:<br>'
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
        if (!matches.length) return 'No <b>'+loc.label+'</b> genes found with <b>'+intent.effect.replace('_',' ')+'</b> cilia phenotype.';
        return '<b>'+loc.label+'</b> genes with <b>'+intent.effect.replace('_',' ')+'</b> cilia phenotype - <b>'+matches.length+' genes</b>:<br>'
            +tbl(['Gene','LoF Effect','Disease'],matches.slice(0,40).map(function(g){
                var dis=g['Ciliopathy']&&g['Ciliopathy']!=='N/A'?pill(g['Ciliopathy'].split(',')[0].trim(),'red'):'-';
                return [chip(g['Gene']),getLOF(g)||'-',dis];
            }),40)
            +csvLink(matches,['Gene','Localization','Ciliopathy'],loc.term.replace(/\s/g,'_')+'_'+intent.effect+'.csv');
    }

    if (type === 'loc_disease') {
        var loc = intent.loc;
        var matches = db().filter(function(r){ return getLoc(r).indexOf(loc.term)!==-1 && diseaseMatches(r,intent.disease); });
        if (!matches.length) return 'No <b>'+loc.label+'</b> genes found associated with <b>'+disName(intent.disease)+'</b>.';
        return '<b>'+loc.label+'</b> genes associated with <b>'+disName(intent.disease)+'</b> - <b>'+matches.length+' genes</b>:<br>'
            +tbl(['Gene','Localization','Disease'],matches.map(function(g){ return [chip(g['Gene']),g['Localization']||'-',(g['Ciliopathy']||'').split(',').slice(0,2).join('; ')]; }))
            +csvLink(matches,['Gene','Localization','Ciliopathy'],loc.term.replace(/\s/g,'_')+'_'+intent.disease+'.csv');
    }

    if (type === 'loc_tissue') {
        var loc = intent.loc;
        var matches = db().filter(function(r){ return getLoc(r).indexOf(loc.term)!==-1; });
        if (!matches.length) return 'No genes found with <b>'+loc.label+'</b> localization.';
        return '<b>'+loc.label+'</b> genes (context: <b>'+tisName(intent.tissue)+'</b>) - <b>'+matches.length+' genes</b>:<br>'
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
        return '<b>'+disName(intent.disease)+'</b> genes (context: <b>'+tisName(intent.tissue)+'</b>) - <b>'+matches.length+' genes</b>:<br>'
            +tbl(['Gene','Localization','Disease'],matches.slice(0,40).map(function(g){ return [chip(g['Gene']),g['Localization']||'-',(g['Ciliopathy']||'').split(',').slice(0,2).join('; ')]; }),40)
            +note+csvLink(matches,['Gene','Localization','Ciliopathy'],intent.disease+'_genes.csv');
    }

    if (type === 'disease_complex') {
        var matches = db().filter(function(r){ return inComplex(r['Gene'],intent.complex) && diseaseMatches(r,intent.disease); });
        if (!matches.length) return 'No genes in both <b>'+disName(intent.disease)+'</b> and <b>'+cxName(intent.complex)+'</b>.';
        return '<b>'+disName(intent.disease)+'</b> intersect <b>'+cxName(intent.complex)+'</b> - <b>'+matches.length+' gene'+(matches.length!==1?'s':'')+'</b>:<br>'
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
        /* Store context so follow-up "yes" / "show it" can re-render */
        _lastPhyloGenes = allSymbols;
        _lastPhyloNames = cxName(intent.complexA)+' vs '+cxName(intent.complexB);
        /* Render immediately */
        renderPhyloPlot(allSymbols);
        /* Clickable redraw button */
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

    if (type === 'phylo_domain') {
        var matches = db().filter(function(r){ return hasDomain(r,intent.domain); });
        return 'Ciliary genes with <b>'+intent.domain+'</b> domain - <b>'+matches.length+' genes</b>:<br>'
            +'<div style="margin-top:8px;line-height:1.8;">'+matches.slice(0,60).map(function(g){return chip(g['Gene']);}).join('')+'</div>'
            +(matches.length>60?'<p style="color:#888;font-size:11px">Showing 60 of '+matches.length+'</p>':'')
            +'<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">For Nevers/Li phylogenetic classification, use the Phylogeny tab on the Cilia Analysis page.</div>'
            +csvLink(matches,['Gene','Domain_Descriptions','PFAM_IDs'],intent.domain+'_ciliary_genes.csv');
    }

    if (type === 'pfam_filter') {
        var matches = db().filter(function(r){ return (r['PFAM_IDs']||'').indexOf(intent.pfam)!==-1||(r['Domain_Descriptions']||'').indexOf(intent.pfam)!==-1; });
        if (!matches.length) return 'No CiliaHub genes found with PFAM accession <b>'+intent.pfam+'</b>.';
        return 'Genes with PFAM <b>'+intent.pfam+'</b> - <b>'+matches.length+' genes</b>:<br>'
            +tbl(['Gene','Domain Descriptions','Localization'],matches.map(function(g){return[chip(g['Gene']),(g['Domain_Descriptions']||'').slice(0,80),g['Localization']||'-'];}))
            +csvLink(matches,['Gene','PFAM_IDs','Domain_Descriptions','Localization'],intent.pfam+'_genes.csv');
    }

    if (type === 'lof_conserved_tissue') {
        var matches = db().filter(function(r){ return lofMatches(r,'no_effect'); });
        return 'Genes with <b>no cilia length phenotype</b> on LoF - <b>'+matches.length+' genes</b>:<br>'
            +tbl(['Gene','LoF Effect','Localization'],matches.slice(0,30).map(function(g){return[chip(g['Gene']),getLOF(g)||'-',getLoc(g)||'-'];}),30)
            +(intent.tissue ? tisNote(intent.tissue) : '')
            +'<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;margin-top:8px;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;">For conservation filtering, use the Phylogeny tab and select "in_all_organisms".</div>'
            +csvLink(matches,['Gene','Localization','Ciliopathy'],'lof_no_effect_genes.csv');
    }

    return null;
}

/* INSTALL */
function say(html) { if (typeof win.addChatMessage === 'function') win.addChatMessage(html, false); }

function installGuard() {
    if (!win.addChatMessage || win.addChatMessage.__guardInstalled) return;
    var origAdd = win.addChatMessage;
    win.addChatMessage = function(html, isUser) {
        if (isUser) return origAdd.call(this, html, isUser);
        if (_suppressing) { console.debug('[CiliAI Interceptor] Blocked ciliai.js message'); return; }
        return origAdd.call(this, html, isUser);
    };
    win.addChatMessage.__guardInstalled = true;
    console.log('[CiliAI Interceptor] Guard installed');
}

function wrap(originalFn) {
    var wrapped = function(queryOrOpts) {
        var text = (typeof queryOrOpts === 'string') ? queryOrOpts : (queryOrOpts && (queryOrOpts.text || queryOrOpts.raw || ''));
        if (!text || !text.trim()) return originalFn.apply(this, arguments);
        var intent = matchIntent(text);
        if (intent) {
            var html = dispatch(intent);
            if (html) { say(html); startSuppression(); return; }
        }
        return originalFn.apply(this, arguments);
    };
    wrapped.__intercepted = true;
    return wrapped;
}

function install() {
    if (typeof win.handleAIQuery === 'function' && !win.handleAIQuery.__intercepted) {
        win.handleAIQuery = wrap(win.handleAIQuery);
        console.log('[CiliAI Interceptor] Patched handleAIQuery');
    }
    if (win.CiliAI && win.CiliAI.Router && typeof win.CiliAI.Router.dispatchAction === 'function' && !win.CiliAI.Router.dispatchAction.__intercepted) {
        win.CiliAI.Router.dispatchAction = wrap(win.CiliAI.Router.dispatchAction);
        console.log('[CiliAI Interceptor] Patched Router.dispatchAction');
    }
    ['processQuery','routeQuery','handleQuery','processMessage'].forEach(function(name){
        if (win.CiliAI && typeof win.CiliAI[name] === 'function' && !win.CiliAI[name].__intercepted) {
            win.CiliAI[name] = wrap(win.CiliAI[name]);
            console.log('[CiliAI Interceptor] Patched CiliAI.'+name);
        }
    });
    installGuard();
}

install();
setTimeout(install, 300);
setTimeout(install, 800);
setTimeout(install, 2000);

win._CiliAI_Interceptor = {matchIntent: matchIntent, dispatch: dispatch};
win._ciliaiShowLastPhylo = function() {
    if (_lastPhyloGenes && _lastPhyloGenes.length) {
        var rendered = renderPhyloPlot(_lastPhyloGenes);
        say(rendered
            ? 'Heatmap for <b>'+(_lastPhyloNames||'genes')+'</b> shown in Plot view (left panel).'
            : 'Phylogeny function not yet available. Use the Cilia Analysis page, Phylogeny tab.');
        startSuppression();
    }
};
console.log('[CiliAI Interceptor v2.1] Loaded.');

})(window);
