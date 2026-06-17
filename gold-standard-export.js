/* ═══════════════════════════════════════════════════════════════════════════
 * gold-standard-export.js — Stage 1 of CiliaHub redesign
 * ───────────────────────────────────────────────────────────────────────────
 * Produces a downloadable Gold Standard Ciliary Gene list from masterData.
 *
 * All 2,588 genes in masterData are ciliary. This exporter assembles a "wide"
 * row per gene combining every section of the gene card (core identity,
 * ciliopathies, localization, perturbation, orthologs, domains, CilioGenics
 * reference, phylogeny, cross-species summary). No scoring, no tiering.
 *
 * Public API (attached to window.CiliAI.GoldStandard):
 *   buildRows({include_variants, include_interactors})  → Promise<Array<Row>>
 *   downloadCSV({filename, include_variants, include_interactors})  → triggers browser download
 *   downloadJSON({filename, include_variants, include_interactors}) → triggers browser download
 *   previewFirst(n)   → Promise<Array<Row>>             (handy for console)
 *
 * By default the exports do NOT include ClinVar variants or STRING partners
 * (they explode row counts — CEP290 alone has 1,144 ClinVar entries).
 * Pass include_variants:true or include_interactors:true to include counts
 * + compact representations.
 *
 * A ready-to-wire download button is exposed via:
 *   mountDownloadButton(targetElement)
 * which renders "Download Gold Standard (CSV / JSON)" as a small dropdown.
 * ═══════════════════════════════════════════════════════════════════════════ */

(function (win, doc) {
    'use strict';

    function log(msg, kind) {
        var prefix = '[CiliAI GoldStandard]';
        if (kind === 'warn')       { if (console && console.warn)  console.warn(prefix, msg); }
        else if (kind === 'error') { if (console && console.error) console.error(prefix, msg); }
        else                       { if (console && console.log)   console.log(prefix, msg); }
    }

    function up(v) { return String(v || '').trim().toUpperCase(); }

    function masterData() { return (win.CiliAI && win.CiliAI.masterData) || []; }

    function ensureGene() {
        if (!win.CiliAI || !win.CiliAI.Gene) {
            throw new Error('CiliAI.Gene not loaded — gene-data.js must load before gold-standard-export.js');
        }
        return win.CiliAI.Gene;
    }

    /* ── Row assembly ───────────────────────────────────────────────────── */

    // Flatten a GeneCard into a single flat object suitable for CSV export.
    // Nested fields (arrays, objects) are stringified in a predictable,
    // human-readable way.
    function cardToRow(card, opts) {
        opts = opts || {};
        if (!card) return null;

        function joinList(a, sep) {
            sep = sep || '; ';
            return Array.isArray(a) ? a.filter(Boolean).join(sep) : '';
        }
        function ciliopathiesCell(list) {
            if (!Array.isArray(list)) return '';
            return list.map(function(c) {
                return c.omim ? (c.name + ' (OMIM:' + c.omim + ')') : c.name;
            }).join('; ');
        }
        function orthologsCell(o) {
            if (!o) return '';
            return Object.keys(o).map(function(k) {
                var v = o[k];
                if (!v) return '';
                var parts = [];
                if (v.symbol) parts.push(v.symbol);
                if (v.phenotype && v.phenotype !== 'Not reported') parts.push('[' + v.phenotype + ']');
                return k + ':' + parts.join(' ');
            }).filter(Boolean).join('; ');
        }
        function domainsCell(list) {
            if (!Array.isArray(list)) return '';
            return list.map(function(d) {
                if (d.id && d.start && d.end) return d.id + ':' + d.name + '(' + d.start + '-' + d.end + ')';
                if (d.id) return d.id + ':' + d.name;
                return d.name;
            }).join('; ');
        }
        function crossSpeciesCell(cs) {
            if (!cs) return '';
            var bits = [];
            if (cs.ciliary_status) bits.push(cs.ciliary_status);
            if (cs.n_publications) bits.push(cs.n_publications + ' pubs');
            if (cs.species_with_phenotype) bits.push(cs.species_with_phenotype + ' species');
            if (Array.isArray(cs.evidence_terms) && cs.evidence_terms.length) {
                bits.push('terms: ' + cs.evidence_terms.slice(0, 5).join('/'));
            }
            return bits.join('; ');
        }
        function crossSpeciesPmids(cs) {
            if (!cs || !Array.isArray(cs.references)) return '';
            return cs.references.map(function(r) { return r.pmid; }).filter(Boolean).slice(0, 20).join('|');
        }
        function cgCell(cg) {
            if (!cg) return '';
            var parts = [];
            if (cg.score_mean != null)       parts.push('mean=' + cg.score_mean);
            if (cg.their_confidence_tier)    parts.push('tier=' + cg.their_confidence_tier);
            if (cg.n_publications)           parts.push(cg.n_publications + ' pubs');
            if (cg.ciliogenics_rank)         parts.push('rank=' + cg.ciliogenics_rank);
            return parts.join('; ');
        }
        function cgComponents(cg) {
            if (!cg || !cg.score_components) return '';
            var s = cg.score_components;
            var keys = ['protein_interaction','phylogenetic','motif','protein_atlas','single_cell','publication'];
            return keys.map(function(k) {
                return s[k] != null ? k + '=' + s[k] : '';
            }).filter(Boolean).join('; ');
        }
        function phyloCell(p) {
            if (!p) return '';
            var bits = [];
            if (p.class)      bits.push(p.class);
            if (p.n_species)  bits.push(p.n_species + ' species');
            return bits.join('; ');
        }
        function phyloSpecies(p) {
            if (!p || !Array.isArray(p.species)) return '';
            return p.species.join('|');
        }
        function perturbationCell(p, key) {
            if (!p || !p[key]) return '';
            var section = p[key];
            var effect = section.effect || '';
            var refs = Array.isArray(section.references) ? section.references.map(function(r){ return r.pmid || r; }).filter(Boolean) : [];
            return refs.length ? (effect + ' [PMIDs:' + refs.join(',') + ']') : effect;
        }

        var row = {
            Gene:                card.symbol,
            Synonyms:            joinList(card.synonyms),
            Description:         card.description || '',
            Ensembl_ID:          card.ensembl_id  || '',
            Entrez_ID:           card.entrez_id   || '',
            OMIM_ID:             card.omim_id     || '',
            UniProt_ID:          card.uniprot_id  || '',

            Ciliopathies:        ciliopathiesCell(card.ciliopathies),
            Localization:        joinList(card.localization),

            LoF_Effect:          perturbationCell(card.perturbation, 'loss_of_function'),
            Overexpression_Effect: perturbationCell(card.perturbation, 'overexpression'),
            Percent_Ciliated:    perturbationCell(card.perturbation, 'percent_ciliated'),

            Orthologs:           orthologsCell(card.orthologs),
            CrossSpecies_Summary: crossSpeciesCell(card.cross_species_summary),
            CrossSpecies_PMIDs:   crossSpeciesPmids(card.cross_species_summary),

            Pfam_Domains:        domainsCell(card.domains),

            CilioGenics_Summary: cgCell(card.ciliogenics),
            CilioGenics_Components: cgComponents(card.ciliogenics),

            Phylogeny:           phyloCell(card.phylogeny),
            Phylogeny_Species:   phyloSpecies(card.phylogeny)
        };

        if (opts.include_variants) {
            row.ClinVar_N_Variants  = Array.isArray(card.clinvar_variants) ? card.clinvar_variants.length : 0;
            // Pathogenic-only count, computed if variants loaded
            if (Array.isArray(card.clinvar_variants) && card.clinvar_variants.length) {
                var pathog = card.clinvar_variants.filter(function(v) {
                    return /pathogenic/i.test(v.clinical_significance || '') && !/conflicting/i.test(v.clinical_significance || '');
                }).length;
                row.ClinVar_N_Pathogenic = pathog;
            } else {
                row.ClinVar_N_Pathogenic = 0;
            }
        }
        if (opts.include_interactors) {
            row.STRING_N_Partners = Array.isArray(card.string_interactors) ? card.string_interactors.length : 0;
            row.STRING_Top_Partners = Array.isArray(card.string_interactors)
                ? card.string_interactors.slice(0, 5).map(function(p){ return p.partner + '(' + (p.score||'?') + ')'; }).join('; ')
                : '';
        }
        return row;
    }

    function buildRows(options) {
        options = options || {};
        var Gene = ensureGene();

        // Make sure supplementary data is loaded first so crossSpecies,
        // CilioGenics, and phylogeny fields actually populate.
        return Gene._internal.ensureSupplementary().then(function() {
            var md = masterData();
            if (!md.length) throw new Error('masterData is empty — data.js has not finished loading');

            var rows = [];
            // Optionally pre-load variants/interactors for every gene.
            // (SLOW for full corpus — only if explicitly requested.)
            var prelude = Promise.resolve();
            if (options.include_variants) {
                prelude = prelude.then(function() {
                    if (typeof win.CiliAI.loadClinVar === 'function') return win.CiliAI.loadClinVar();
                });
            }
            if (options.include_interactors) {
                prelude = prelude.then(function() {
                    if (typeof win.CiliAI.loadSTRING === 'function') return win.CiliAI.loadSTRING();
                });
            }

            return prelude.then(function() {
                for (var i = 0; i < md.length; i++) {
                    var sym = up(md[i].Gene || md[i].gene);
                    if (!sym) continue;
                    var card = Gene.getSync(sym);
                    if (!card) continue;

                    // Attach variant/interactor lists if requested (sync
                    // because the raw data is already loaded above).
                    if (options.include_variants) {
                        var cv = (win.CiliAI.data && win.CiliAI.data.clinvar && win.CiliAI.data.clinvar[sym]) || [];
                        card.clinvar_variants = cv;
                    }
                    if (options.include_interactors) {
                        var st = (win.CiliAI.data && win.CiliAI.data.string && win.CiliAI.data.string[sym]) || [];
                        card.string_interactors = st.map(function(p) {
                            return { partner: up(p.partner || p.gene), score: p.score || null };
                        });
                    }

                    var row = cardToRow(card, options);
                    if (row) rows.push(row);
                }
                log('buildRows: produced ' + rows.length + ' rows.');
                return rows;
            });
        });
    }

    /* ── CSV serialisation ──────────────────────────────────────────────── */

    function csvEscape(v) {
        if (v === null || v === undefined) return '';
        var s = String(v);
        if (s.indexOf('"') !== -1 || s.indexOf(',') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }
    function rowsToCSV(rows) {
        if (!rows.length) return '';
        var headers = Object.keys(rows[0]);
        var lines = [ headers.map(csvEscape).join(',') ];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var cells = headers.map(function(h) { return csvEscape(row[h]); });
            lines.push(cells.join(','));
        }
        return lines.join('\n');
    }

    /* ── Download trigger ───────────────────────────────────────────────── */

    function triggerDownload(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = doc.createElement('a');
        a.href = url;
        a.download = filename;
        doc.body.appendChild(a);
        a.click();
        setTimeout(function() {
            doc.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }

    function timestamp() {
        var d = new Date();
        function pad(n) { return n < 10 ? '0' + n : String(n); }
        return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    }

    function downloadCSV(options) {
        options = options || {};
        var filename = options.filename || ('ciliahub_gold_standard_' + timestamp() + '.csv');
        return buildRows(options).then(function(rows) {
            var csv = rowsToCSV(rows);
            var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }); // BOM for Excel
            triggerDownload(blob, filename);
            log('Downloaded ' + filename + ' (' + rows.length + ' rows).');
            return rows.length;
        });
    }

    function downloadJSON(options) {
        options = options || {};
        var filename = options.filename || ('ciliahub_gold_standard_' + timestamp() + '.json');
        return buildRows(options).then(function(rows) {
            // Reassemble a richer JSON — keep the full card structure, not
            // the CSV-flattened one. Users asking for JSON want the nested data.
            var Gene = ensureGene();
            var cards = [];
            var md = masterData();
            for (var i = 0; i < md.length; i++) {
                var sym = up(md[i].Gene || md[i].gene);
                if (!sym) continue;
                var c = Gene.getSync(sym);
                if (c) cards.push(c);
            }
            var payload = {
                source:      'CiliaHub',
                url:         'https://ciliahub.org',
                generated:   new Date().toISOString(),
                n_genes:     cards.length,
                description: 'Gold Standard Ciliary Gene list. Every gene is curated as ciliary. Supplementary fields (CilioGenics score, phylogeny, cross-species, ClinVar, STRING) are reference material and do not affect inclusion.',
                genes:       cards
            };
            var json = JSON.stringify(payload, function(k, v) {
                if (k === '_raw_masterdata_ref') return undefined;  // drop circular back-ref
                return v;
            }, 2);
            var blob = new Blob([json], { type: 'application/json' });
            triggerDownload(blob, filename);
            log('Downloaded ' + filename + ' (' + cards.length + ' genes).');
            return cards.length;
        });
    }

    function previewFirst(n) {
        n = n || 5;
        return buildRows({}).then(function(rows) { return rows.slice(0, n); });
    }

    /* ── UI: mountable download button ──────────────────────────────────── */

    function mountDownloadButton(target) {
        var host = (typeof target === 'string') ? doc.querySelector(target) : target;
        if (!host) { log('mountDownloadButton: target not found', 'warn'); return null; }

        var wrap = doc.createElement('div');
        wrap.className = 'ciliahub-gs-download';
        wrap.style.cssText = 'display:inline-flex;gap:8px;align-items:center;font-family:inherit;';

        var label = doc.createElement('span');
        label.textContent = 'Download Gold Standard:';
        label.style.cssText = 'font-weight:500;color:#334155;';

        function mkBtn(text, fn) {
            var b = doc.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.style.cssText = 'background:#0ea5e9;color:#fff;border:0;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:14px;';
            b.addEventListener('mouseenter', function() { b.style.background = '#0284c7'; });
            b.addEventListener('mouseleave', function() { b.style.background = '#0ea5e9'; });
            b.addEventListener('click', function() {
                b.disabled = true;
                var originalText = b.textContent;
                b.textContent = 'Preparing…';
                Promise.resolve(fn()).catch(function(e) {
                    log('Download failed: ' + e.message, 'error');
                    alert('Download failed: ' + e.message);
                }).then(function() {
                    b.textContent = originalText;
                    b.disabled = false;
                });
            });
            return b;
        }

        wrap.appendChild(label);
        wrap.appendChild(mkBtn('CSV',  function() { return downloadCSV();  }));
        wrap.appendChild(mkBtn('JSON', function() { return downloadJSON(); }));

        host.appendChild(wrap);
        return wrap;
    }

    /* ── Expose ─────────────────────────────────────────────────────────── */

    win.CiliAI = win.CiliAI || {};
    win.CiliAI.GoldStandard = {
        buildRows:           buildRows,
        downloadCSV:         downloadCSV,
        downloadJSON:        downloadJSON,
        previewFirst:        previewFirst,
        mountDownloadButton: mountDownloadButton,
        version: '1.0'
    };

    log('gold-standard-export.js v1.0 loaded. CiliAI.GoldStandard.downloadCSV() or .downloadJSON() to export.');
})(window, document);
