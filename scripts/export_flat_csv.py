import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "data" / "genes" / "ciliahub_master_merged.json"
OUT = REPO / "data" / "exports" / "ciliahub_v9_2_genes.csv"

SCALAR = [
    "gene", "ensembl_id", "description", "omim_id", "uniprot_id", "evidence_tier",
    "evidence_type", "source", "ciliopathy_classification", "ciliopathies",
    "functional_summary", "lof_effect", "oe_effect", "pct_ciliated",
    "protein_complex", "complex_subunits", "human_phenotype",
    "human_ciliopathy_phenotype", "mouse_phenotype", "mouse_ciliopathy_phenotype",
    "clingen_disease", "clingen_report", "mgi_id", "mgi_url", "pathway_ids",
    "domain_descriptions", "alphafold_url", "clinvar_variant_count",
    "pan_idio_class", "pan_idio_tissues",
]
LISTS = [
    "synonyms", "localization", "functional_category", "pfam_ids",
    "go_bp", "go_mf", "go_cc", "ciliopathy_refs", "localization_refs",
]
ORTHO = ["mouse", "c_elegans", "xenopus", "zebrafish", "drosophila"]


ALIASES = {"gene": "symbol", "ensembl_id": "ensembl_gene_id", "omim_id": "omim"}


def get(g, key, sym):
    if key == "gene":
        return g.get("gene") or g.get("symbol") or sym
    v = g.get(key)
    if v in (None, "") and key in ALIASES:
        v = g.get(ALIASES[key])
    return v


def cell(v):
    if v is None:
        return ""
    if isinstance(v, list):
        return "; ".join(str(x) for x in v)
    return v


def main():
    master = json.load(open(SRC, encoding="utf-8"))
    genes = master["genes"]
    header = SCALAR[:2] + ["synonyms"] + SCALAR[2:] + LISTS[1:] + [f"ortholog_{o}" for o in ORTHO] + [
        "ciliogenics_rank", "ciliogenics_score", "ciliogenics_tier", "n_screens", "n_publications",
    ]
    rows = 0
    with open(OUT, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        for sym in sorted(genes):
            g = genes[sym]
            row = [cell(get(g, c, sym)) for c in SCALAR[:2]] + [cell(g.get("synonyms"))]
            row += [cell(get(g, c, sym)) for c in SCALAR[2:]]
            row += [cell(g.get(c)) for c in LISTS[1:]]
            orth = g.get("orthologs") or {}
            row += [cell(orth.get(o)) for o in ORTHO]
            cg = g.get("ciliogenics") or {}
            row += [cell(cg.get("rank")), cell(cg.get("score")), cell(cg.get("tier"))]
            row += [len(g.get("screens") or []), len(g.get("publications") or [])]
            w.writerow(row)
            rows += 1
    print(f"wrote {OUT.relative_to(REPO)}: {rows} genes, {len(header)} columns")


if __name__ == "__main__":
    sys.exit(main())
