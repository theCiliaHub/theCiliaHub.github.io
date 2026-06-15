# CiliaHub — an updated gold-standard catalogue of ciliary genes with integrated ciliopathy data

**Live site:** https://ciliahub.org
*(The legacy `theciliahub.github.io` address redirects here. This repository holds the
source code, data-build pipeline, and CiliAI assistant.)*

CiliaHub is a freely accessible, login-free web resource for human **ciliary genes** and
the **ciliopathies**. It couples an expert-curated, evidence-tiered gold-standard gene
catalogue to an integrated, queryable platform spanning evolutionary conservation,
functional screens, protein domains, complex membership, clinical variants, phenotypes,
and expression — together with a natural-language assistant (**CiliAI**) and a
four-class ciliopathy framework.

---

## What's in the catalogue

- **2,790** human ciliary and cilia-associated genes.
- **2,148** designated **gold-standard** (confirmed localization to the cilium, transition
  zone, basal body, or flagellum) and **642** cilia-associated.
- **88** ciliopathies linked to **542** disease genes, organized into a four-class
  framework: **Primary**, **Motile**, **Tissue-restricted**, and **Secondary**
  (the last catalogued separately as non-ciliary disorders).
- Orthologs across **five** model organisms (mouse, *Xenopus*, zebrafish, *Drosophila*,
  *C. elegans*).

---

## Pages

| Page | URL | Description |
|---|---|---|
| **Home** | `/` (`index.html`) | Gene search, interactive cilia diagram, gold-standard CSV/JSON export |
| **Cilia Analysis** | `/plots.html` | Classify gene lists (≤2,000) → enrichment, classification, localization, ciliopathy association, functional category, screens, overview (SVG/PNG/CSV) |
| **CiliAI** | `/ciliai.html` | Natural-language assistant over the curated database, with spatial/structural visualizations |
| **Ciliopathy** | `/phenotype.html` | Disease–gene–symptom search across the four-class framework (HPO-backed) |
| **API** | `/api.html` | Static-JSON endpoint documentation and code examples |
| **About** | `/about.html` | Project background, dataset download, contact |
| **Interactive Cilium** | `/ciliahub.html` | Per-localization interactive cilium view |

---

## Data access

All data are served as static JSON with no authentication or rate limits, and as a single
downloadable file. Canonical endpoints (see `/api.html` for the full list):

```
https://ciliahub.org/data/genes/ciliahub_master_merged.json     # full gene catalogue
https://ciliahub.org/data/phenotype/phenotype_meta.json         # ciliopathy summary
https://ciliahub.org/data/phenotype/class_index.json            # disease → class index
https://ciliahub.org/data/phenotype/gene_to_diseases.json       # gene → diseases index
```

Per-gene pages: `https://ciliahub.org/gene/<SYMBOL>` (e.g. `/gene/BBS1`).

---

## Running locally

A pure static site — no build step required to view it:

```bash
git clone https://github.com/theCiliaHub/theCiliaHub.github.io.git
cd theCiliaHub.github.io
python3 -m http.server 8080
# open http://localhost:8080
```

---

## CiliAI assistant

CiliAI uses a large language model to interpret natural-language queries against the
curated database; **all underlying annotations are expert-reviewed** (the model interprets
questions, it does not generate the data). It runs a hybrid pipeline: rule-based intent
handlers answer known questions directly from the local database, and unhandled queries
fall back to a configurable LLM provider via a proxy.

Configure via `ciliai/env.js` (copy from `ciliai/env.example.js`):

| Variable | Description |
|---|---|
| `CILIAI_LLM_PROVIDER` | LLM backend (e.g. `deepseek`, `ollama`) |
| `CILIAI_MODEL` | Model name |
| `CILIAI_ASSISTANT_PROXY_URL` | Proxy worker URL (keeps API keys server-side) |
| `CILIAI_ASSISTANT_V2` | `true` to enable the LLM assistant |
| `CILIAI_DEBUG` | `true` for console logging |

The proxy worker lives in `serverless/cloudflare-worker.js`.

---

## Data-build pipeline

The catalogue and derived JSON are regenerated from curated source tables:

```bash
python3 scripts/sync_genes.py          # source tables -> generated JSON datasets
python3 scripts/build_site_jsons.py    # site-facing JSON (called by sync_genes.py)
```

The phenotype data is regenerated from Supplementary Tables S1 (gene catalogue),
S2 (disease catalogue), and S5 (symptom classification). A GitHub Actions workflow
(`.github/workflows/sync-genes.yml`) reruns the pipeline when the source tables change.

---

## Repository layout

```
theCiliaHub.github.io/
├── *.html                 # page sources (or redirect stubs; see deployment notes)
├── js/                    # SPA navigation, search, plotting
├── ciliai/                # CiliAI engine
│   ├── ciliai.js
│   ├── env.example.js
│   └── assistant/         # intent engine, runtime, providers
├── data/                  # genes, phenotype, expression, phylogeny, domains, umap, source
├── styles/                # CSS
├── assets/                # logos, diagrams
├── scripts/               # data-build pipeline (Python)
├── serverless/            # Cloudflare worker proxy
└── docs/                  # additional documentation
```

---

## Data sources

Human Protein Atlas (tissue nTPM) · CELLxGENE (single-cell expression + UMAP) ·
Alliance of Genome Resources (orthology) · CORUM (complexes) · Ensembl · OMIM ·
ClinVar · MGI (mouse phenotypes) · Pfam · Reactome/GO/KEGG · PubMed + expert curation.

---

## Citing CiliaHub

If you use CiliaHub, please cite the Application Note and the archived software release:

> Yenisert, F., Cevik, S., Kaplan, O.I. (2026) CiliaHub: an updated gold-standard catalogue of ciliary genes with
> integrated ciliopathy data. (submitted).

Software archive: Zenodo DOI `10.5281/zenodo.20696641` *(fill in on release)*.
Machine-readable citation metadata is in `CITATION.cff`.

---

## License

See `LICENSE`. *(Confirm the intended license — the Application Note states the source code
is open, which requires an OSI-approved license file in the repository.)*

---

## Contact

Dr. Oktay I. Kaplan — oktay.kaplan@agu.edu.tr
Rare Disease Laboratory, Faculty of Life and Natural Sciences, Abdullah Gül University,
38080 Kayseri, Türkiye.
