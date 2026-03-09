#!/usr/bin/env python3
"""
build_site_jsons.py
===================
Canonical dataset → all site-consumed JSON files.

Reads  : data/generated/genes.json          (produced by sync_genes.py)
         data/genes/cilia_screens_data.json  (functional screen results, unchanged)

Writes :
  ciliahub_data.json                       (repo root — for script.js / plots.js)
  data/genes/ciliAI_master_database.json   (AI chatbot master store)
  data/genes/ciliAI_lookups.json           (pre-indexed lookups for AI engine)

Usage:
  python3 scripts/build_site_jsons.py
  python3 scripts/build_site_jsons.py --dry-run    # validate + report, no output

The canonical dataset is the ONLY source of gene truth.
Screen data (cilia_screens_data.json) is supplementary and is never replaced.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent

CANONICAL_FILE   = REPO_ROOT / "data" / "generated" / "genes.json"
SCREENS_FILE     = REPO_ROOT / "data" / "genes" / "cilia_screens_data.json"

OUT_SITE         = REPO_ROOT / "ciliahub_data.json"
OUT_AI_MASTER    = REPO_ROOT / "data" / "genes" / "ciliAI_master_database.json"
OUT_AI_LOOKUPS   = REPO_ROOT / "data" / "genes" / "ciliAI_lookups.json"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger("build_site_jsons")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe(val: Any, default: str = "") -> str:
    """Return string or default for None / empty."""
    if val is None:
        return default
    if isinstance(val, list):
        return ", ".join(str(v) for v in val if v)
    return str(val)


def _norm(term: str) -> str:
    """Mirror JS normalizeTerm: lowercase, drop non-alphanumeric."""
    return re.sub(r"[^a-z0-9]", "", term.lower())


def _atomic_write(path: Path, payload: Any, dry_run: bool, label: str) -> None:
    """Atomically write JSON; no-op when dry_run=True."""
    if dry_run:
        json.dumps(payload, ensure_ascii=False)          # serialisation check
        log.info("[DRY-RUN] Would write %s", path)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, path)
        log.info("✅  %-46s  (%s)", label, path.name)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# Load inputs
# ---------------------------------------------------------------------------

def load_canonical() -> list[dict]:
    if not CANONICAL_FILE.exists():
        log.error("Canonical dataset not found: %s", CANONICAL_FILE)
        log.error("Run  python3 scripts/sync_genes.py  first.")
        sys.exit(1)
    with open(CANONICAL_FILE, encoding="utf-8") as f:
        data = json.load(f)
    genes = data.get("genes", [])
    log.info("Canonical dataset: %d genes loaded", len(genes))
    return genes


def load_screens() -> dict[str, list]:
    if not SCREENS_FILE.exists():
        log.warning("Screen data not found (%s) — screens will be empty.", SCREENS_FILE)
        return {}
    with open(SCREENS_FILE, encoding="utf-8") as f:
        data = json.load(f)
    log.info("Screen data: %d gene entries loaded", len(data))
    return data


# ---------------------------------------------------------------------------
# Build 1:  ciliahub_data.json
#
# Flat JSON array consumed by:
#   js/script.js  — loadAndPrepareDatabase(), allGenes, geneMapCache
#   js/plots.js   — loadAllData() / findAndMergeGenes()
#   js/data.js    — loadAndPrepareDatabase() (legacy duplicate)
#
# Required field names (lowercase, snake_case) — verified from source:
#   gene, ensembl_id, description, functional_summary, synonym, omim_id,
#   localization (array), reference (array), protein_complexes,
#   gene_annotation, functional_category (array),
#   pfam_ids, domain_descriptions, ciliopathy, ciliopathy_classification,
#   ortholog_mouse, ortholog_c_elegans, ortholog_xenopus, ortholog_zebrafish,
#   ortholog_drosophila, mouse_phenotype, human_phenotype,
#   overexpression_effects, lof_effects, percent_ciliated_cells_effects,
#   screens (list, merged from cilia_screens_data.json),
#   complex_names (alias for protein_complexes — used by plots.js)
# ---------------------------------------------------------------------------

def build_site_array(genes: list[dict], screens: dict) -> list[dict]:
    """Return a flat list compatible with script.js / plots.js."""
    result = []
    for g in genes:
        name = g.get("name", "")
        if not name:
            continue

        # Merge screen data (keyed by UPPER gene symbol)
        gene_screens = screens.get(name.upper(), screens.get(name, []))

        record: dict[str, Any] = {
            # Primary identifier used throughout JS: g.gene
            "gene": name,

            # Core annotations
            "ensembl_id":              _safe(g.get("ensembl_id")),
            "description":             _safe(g.get("description")),
            "functional_summary":      _safe(g.get("functional_summary")),
            "synonym":                 _safe(g.get("synonym")),
            "omim_id":                 _safe(g.get("omim_id")),

            # Arrays — script.js checks Array.isArray()
            "localization":            g.get("localization") or [],
            "reference":               g.get("reference") or [],
            "functional_category":     g.get("functional_category") or [],

            # Complex / module info (both spellings used in codebase)
            "protein_complexes":       _safe(g.get("protein_complexes")),
            "complex_names":           _safe(g.get("protein_complexes")),   # plots.js key

            # Annotations
            "gene_annotation":         _safe(g.get("gene_annotation")),

            # Domain data — kept as strings to match legacy behaviour
            "pfam_ids":                _safe(g.get("pfam_ids")
                                            if not isinstance(g.get("pfam_ids"), list)
                                            else "; ".join(g.get("pfam_ids", []))),
            "domain_descriptions":     _safe(g.get("domain_descriptions")
                                            if not isinstance(g.get("domain_descriptions"), list)
                                            else "; ".join(g.get("domain_descriptions", []))),

            # Disease associations
            "ciliopathy":              _safe(g.get("ciliopathy")
                                            if not isinstance(g.get("ciliopathy"), list)
                                            else ", ".join(g.get("ciliopathy", []))),
            "ciliopathy_classification": _safe(g.get("ciliopathy_classification")),

            # Orthologs — kept as strings (comma-sep) matching legacy
            "ortholog_mouse":          _safe(g.get("ortholog_mouse")),
            "ortholog_c_elegans":      _safe(g.get("ortholog_c_elegans")),
            "ortholog_xenopus":        _safe(g.get("ortholog_xenopus")),
            "ortholog_zebrafish":      _safe(g.get("ortholog_zebrafish")),
            "ortholog_drosophila":     _safe(g.get("ortholog_drosophila")),

            # Phenotypes
            "mouse_phenotype":         _safe(g.get("mouse_phenotype")),
            "mouse_ciliopathy_phenotype": _safe(g.get("mouse_ciliopathy_phenotype")),
            "human_phenotype":         _safe(g.get("human_phenotype")),
            "human_ciliopathy_phenotype": _safe(g.get("human_ciliopathy_phenotype")),

            # Screen effects
            "overexpression_effects":          _safe(g.get("overexpression_effects")),
            "lof_effects":                     _safe(g.get("lof_effects")),
            "percent_ciliated_cells_effects":  _safe(g.get("percent_ciliated_cells_effects")),

            # Functional screens (array of {source, result} objects)
            "screens":                 gene_screens,
        }
        result.append(record)

    log.info("Site array built: %d gene records", len(result))
    return result


# ---------------------------------------------------------------------------
# Build 2:  ciliAI_master_database.json
#
# Consumed by index.html → loadCiliAIData():
#   window.CiliAI.masterData = mainRes.masterData  (array)
#
# Field names used throughout ciliai.js (PascalCase / dot notation):
#   g.Gene, g['Gene.Description'], g['Ensembl ID'], g.Localization,
#   g.Ciliopathies (array), g.Ciliopathy (string),
#   g.Ortholog_Mouse, g.Ortholog_C_elegans, g.Ortholog_Xenopus,
#   g.Ortholog_Zebrafish, g.Ortholog_Drosophila,
#   g.PFAM_IDs, g.Domain_Descriptions,
#   g['Functional.category'],  g.screens (array)
# ---------------------------------------------------------------------------

def build_ai_master(genes: list[dict], screens: dict) -> dict:
    """Return { masterData: [...] } for the AI chatbot."""
    master = []
    for g in genes:
        name = g.get("name", "")
        if not name:
            continue

        gene_screens = screens.get(name.upper(), screens.get(name, []))

        # Localization: AI code uses a string (g.Localization.includes(...))
        loc_list = g.get("localization") or []
        loc_str  = ", ".join(loc_list) if isinstance(loc_list, list) else _safe(loc_list)

        # Ciliopathies: AI code checks Array.isArray(g.Ciliopathies)
        cilio_raw = g.get("ciliopathy") or []
        cilio_list = cilio_raw if isinstance(cilio_raw, list) else [cilio_raw] if cilio_raw else []

        record: dict[str, Any] = {
            # Primary key used throughout ciliai.js: g.Gene
            "Gene":                  name,

            # Dot-notation fields (literal key names the JS uses)
            "Gene.Description":      _safe(g.get("description")),
            "Ensembl ID":            _safe(g.get("ensembl_id")),
            "Ensembl.ID":            _safe(g.get("ensembl_id")),   # secondary alias
            "Localization":          loc_str,
            "Ciliopathies":          cilio_list,
            "Ciliopathy":            ", ".join(cilio_list),         # string alias
            "Functional.category":   _safe(g.get("functional_category")
                                          if not isinstance(g.get("functional_category"), list)
                                          else ", ".join(g.get("functional_category", []))),
            "Functional_Summary":    _safe(g.get("functional_summary")),
            "OMIM_ID":               _safe(g.get("omim_id")),
            "synonym":               _safe(g.get("synonym")),
            "Protein_Complexes":     _safe(g.get("protein_complexes")),

            # Domain data
            "PFAM_IDs":              _safe(g.get("pfam_ids")
                                          if not isinstance(g.get("pfam_ids"), list)
                                          else "; ".join(g.get("pfam_ids", []))),
            "Domain_Descriptions":   _safe(g.get("domain_descriptions")
                                          if not isinstance(g.get("domain_descriptions"), list)
                                          else "; ".join(g.get("domain_descriptions", []))),

            # Orthologs
            "Ortholog_Mouse":        _safe(g.get("ortholog_mouse")),
            "Ortholog_C_elegans":    _safe(g.get("ortholog_c_elegans")),
            "Ortholog_Xenopus":      _safe(g.get("ortholog_xenopus")),
            "Ortholog_Zebrafish":    _safe(g.get("ortholog_zebrafish")),
            "Ortholog_Drosophila":   _safe(g.get("ortholog_drosophila")),

            # Phenotypes
            "mouse_phenotype":              _safe(g.get("mouse_phenotype")),
            "mouse_ciliopathy_phenotype":   _safe(g.get("mouse_ciliopathy_phenotype")),
            "human_phenotype":              _safe(g.get("human_phenotype")),
            "human_ciliopathy_phenotype":   _safe(g.get("human_ciliopathy_phenotype")),

            # Screen effects
            "overexpression_effects":         _safe(g.get("overexpression_effects")),
            "lof_effects":                    _safe(g.get("lof_effects")),
            "percent_ciliated_cells_effects": _safe(g.get("percent_ciliated_cells_effects")),

            # Functional screen results
            "screens": gene_screens,
        }
        master.append(record)

    log.info("AI master array built: %d gene records", len(master))
    return {"masterData": master}


# ---------------------------------------------------------------------------
# Build 3:  ciliAI_lookups.json
#
# Consumed by index.html → loadCiliAIData():
#   window.CiliAI.lookups = lookupsRes.lookups
#
# Lookup maps expected by ciliai.js:
#   lookups.geneMap          { GENE_SYMBOL: <AI master record> }
#   lookups.byCiliopathy     { normalizeTerm(disease): [GENE, ...] }
#   lookups.byModuleOrComplex { COMPLEX_NAME_UPPER: [GENE, ...] }
#   lookups.pfamByGene       { GENE: [{id,name,start,end}, ...] }
# ---------------------------------------------------------------------------

def _build_pfam(g_record: dict) -> list[dict]:
    """
    Build Pfam domain objects from Domain_Descriptions / PFAM_IDs.
    Replicates the JS fallback logic in showDomainViewer().
    """
    desc_raw = g_record.get("Domain_Descriptions", "")
    if not desc_raw:
        desc_raw = g_record.get("PFAM_IDs", "")
    if not desc_raw:
        return []
    parts = [p.strip() for p in re.split(r"[;,]", desc_raw) if p.strip()]
    domains = []
    for i, part in enumerate(parts):
        domains.append({
            "id":    f"DOM_{i + 1}",
            "name":  part,
            "start": (i * 200) + 50,
            "end":   (i * 200) + 150,
        })
    return domains


def build_ai_lookups(master_records: list[dict]) -> dict:
    """Build the four lookup structures from the AI master records list."""
    gene_map:       dict[str, dict]         = {}
    by_ciliopathy:  dict[str, list[str]]    = {}
    by_complex:     dict[str, list[str]]    = {}
    pfam_by_gene:   dict[str, list[dict]]   = {}

    for g in master_records:
        gene_sym = g.get("Gene", "").upper()
        if not gene_sym:
            continue

        # ── geneMap ──────────────────────────────────────────────────────────
        gene_map[gene_sym] = g

        # ── byCiliopathy ──────────────────────────────────────────────────────
        diseases = g.get("Ciliopathies", [])
        if isinstance(diseases, str):
            diseases = [d.strip() for d in re.split(r"[,;]", diseases) if d.strip()]
        for disease in diseases:
            norm_d = _norm(disease)
            if norm_d:
                by_ciliopathy.setdefault(norm_d, [])
                if gene_sym not in by_ciliopathy[norm_d]:
                    by_ciliopathy[norm_d].append(gene_sym)

        # ── byModuleOrComplex ─────────────────────────────────────────────────
        complex_raw = g.get("Protein_Complexes", "")
        if complex_raw:
            for cx in re.split(r"[;,]", complex_raw):
                cx = cx.strip()
                if cx:
                    key = cx.upper()
                    by_complex.setdefault(key, [])
                    if gene_sym not in by_complex[key]:
                        by_complex[key].append(gene_sym)

        # ── pfamByGene ────────────────────────────────────────────────────────
        domains = _build_pfam(g)
        if domains:
            pfam_by_gene[gene_sym] = domains

    log.info(
        "Lookups built: geneMap=%d  byCiliopathy=%d  byComplex=%d  pfamByGene=%d",
        len(gene_map), len(by_ciliopathy), len(by_complex), len(pfam_by_gene),
    )

    return {
        "lookups": {
            "geneMap":           gene_map,
            "byCiliopathy":      by_ciliopathy,
            "byModuleOrComplex": by_complex,
            "pfamByGene":        pfam_by_gene,
        }
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build site JSON files from the canonical gene dataset.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and report only — write nothing.",
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Enable DEBUG logging.",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    dry = args.dry_run
    if dry:
        log.info("=== DRY-RUN mode — no files will be written ===")

    # ── Load ─────────────────────────────────────────────────────────────────
    genes   = load_canonical()
    screens = load_screens()

    # ── Build ─────────────────────────────────────────────────────────────────
    site_array  = build_site_array(genes, screens)
    ai_master   = build_ai_master(genes, screens)
    ai_lookups  = build_ai_lookups(ai_master["masterData"])

    # ── Write ─────────────────────────────────────────────────────────────────
    meta = {
        "generated_at":   datetime.now(timezone.utc).isoformat(),
        "generator":      "scripts/build_site_jsons.py",
        "canonical_source": str(CANONICAL_FILE.relative_to(REPO_ROOT)),
        "total_genes":    len(genes),
    }

    # 1. ciliahub_data.json — expects a bare array (script.js: const rawGenes = await resp.json())
    _atomic_write(OUT_SITE, site_array, dry, f"ciliahub_data.json ({len(site_array)} genes)")

    # 2. ciliAI_master_database.json — expects { masterData: [...], meta: {...} }
    _atomic_write(OUT_AI_MASTER, {**ai_master, "meta": meta}, dry,
                  f"ciliAI_master_database.json ({len(ai_master['masterData'])} genes)")

    # 3. ciliAI_lookups.json — expects { lookups: {...}, meta: {...} }
    _atomic_write(OUT_AI_LOOKUPS, {**ai_lookups, "meta": meta}, dry,
                  f"ciliAI_lookups.json ({len(ai_lookups['lookups']['geneMap'])} genes in geneMap)")

    log.info("─" * 60)
    log.info("Done. %s three site JSON files generated from canonical dataset.",
             "[DRY-RUN] Validated" if dry else "✅")


if __name__ == "__main__":
    main()
