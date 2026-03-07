# CiliaHub — Interactive Ciliary Gene Database

**Live site:** [https://theciliahub.github.io](https://theciliahub.github.io)

CiliaHub is a web-based research platform for exploring **human ciliary genes** — genes whose proteins form or operate cilia, the hair-like cellular organelles. It combines a curated database of 2,000+ genes with interactive visualizations and an AI-powered assistant (**CiliAI**).

---

## Pages

| Page | URL | Description |
|---|---|---|
| **Home** | `/` | Search genes, view interactive cilia diagram, chat with CiliAI assistant |
| **Cilia Analysis** | `/plots.html` | Generate scientific plots (UMAP, phylogeny, network, expression heatmap, etc.) |
| **CiliaHub** | `/ciliahub.html` | Detailed per-gene view (localization, ciliopathies, protein complexes, screen data) |
| **About** | `/about.html` | Project background, team, and citations |

---

## Key Features

- **Gene Search** — Real-time suggestions by symbol, synonym, or Ensembl ID
- **Interactive Cilia SVG** — Genes are highlighted at their subcellular location (Axoneme, Basal Body, Transition Zone, etc.)
- **Expression Visualization** — Organ-level (Human Protein Atlas nTPM) and single-cell (CellxGene UMAP) expression data
- **Phylogenetic Analysis** — Cross-species conservation heatmaps (Li *et al.* 2014, Nevers *et al.* 2017)
- **Protein Network Graph** — Visualize co-complex relationships (CORUM data)
- **Batch Query** — Analyze multiple genes at once; export results as CSV/JSON
- **CiliAI Assistant** — Conversational AI backed by DeepSeek, with database-grounded answers (RAG)

---

## Running Locally

This is a **pure static site** — no build step required.

```bash
# Clone and serve
git clone https://github.com/theCiliaHub/theCiliaHub.github.io.git
cd theCiliaHub.github.io
python3 -m http.server 8080
# Open http://localhost:8080
```

The AI assistant is pre-configured to use the cloud proxy (see `ciliai/env.js`), so it works out of the box.

---

## CiliAI Assistant

The assistant uses a **hybrid approach**:

1. **Rule-based** — 30+ intent handlers answer known questions directly from the local database (gene info, disease gene lists, localization, screens, etc.)
2. **LLM fallback** — Unhandled queries go to **DeepSeek Chat** via a Cloudflare Worker proxy, with relevant gene data injected as context (RAG)
3. **Local LLM** — You can switch to a local **Ollama / Llama 3** instance instead

### Environment Configuration

Copy `ciliai/env.example.js` to `ciliai/env.js` and set your values:

| Variable | Description |
|---|---|
| `CILIAI_LLM_PROVIDER` | `deepseek` or `ollama` |
| `CILIAI_MODEL` | e.g. `deepseek-chat` or `llama3.1` |
| `CILIAI_ASSISTANT_PROXY_URL` | Your Cloudflare Worker URL |
| `CILIAI_PROXY_SECRET` | Optional shared secret for proxy auth |
| `CILIAI_ASSISTANT_V2` | `true` to enable the LLM assistant |
| `CILIAI_DEBUG` | `true` to enable console logging |

### Cloudflare Worker Proxy (Recommended)

To keep your DeepSeek API key out of the browser:

1. Create a Cloudflare Worker and add your `DEEPSEEK_API_KEY` as a secret
2. Deploy the worker from `serverless/cloudflare-worker.js`
3. Set `CILIAI_ASSISTANT_PROXY_URL` in `ciliai/env.js` to your Worker URL

---

## Project Structure

```
theCiliaHub.github.io/
├── index.html              # Home page
├── plots.html              # Cilia Analysis / Plot page
├── ciliahub.html           # Gene database view
├── about.html              # About page
│
├── js/
│   ├── script.js           # SPA navigation, search, gene pages, expression viz
│   ├── plots.js            # All chart rendering (Plotly.js, D3.js)
│   └── globals.js          # Shared utilities
│
├── ciliai/
│   ├── ciliai.js           # Main logic engine (query routing, data handlers)
│   ├── env.js              # Runtime config (LLM provider, keys, proxy URL)
│   └── assistant/
│       ├── assistant-core.js      # Config builder, response parser
│       ├── assistant-runtime.js   # LLM integration, action dispatcher
│       └── providers/
│           ├── deepseek.js        # DeepSeek API provider
│           └── ollama.js          # Ollama local LLM provider
│
├── data/
│   ├── genes/              # Master gene DB + lookup maps (~30 MB)
│   ├── expression/         # RNA-seq & scRNA-seq data (~32 MB)
│   ├── phylogeny/          # Cross-species conservation matrices (~32 MB)
│   ├── umap/               # UMAP coordinates for single-cell plots
│   └── domains/            # Protein domain annotations
│
├── serverless/
│   └── cloudflare-worker.js   # Proxy worker (keeps API key server-side)
└── scripts/
    └── generate_json.py       # Python script to regenerate JSON data files
```

---

## Data Sources

| Source | Data |
|---|---|
| [Human Protein Atlas](https://www.proteinatlas.org/) | Tissue-level RNA expression (nTPM) |
| [CellxGene](https://cellxgene.cziscience.com/) | Single-cell RNA-seq expression + UMAP coordinates |
| [CORUM](https://mips.helmholtz-muenchen.de/corum/) | Human protein complex memberships |
| Ensembl | Gene IDs and annotations |
| OMIM | Disease associations |
| Li *et al.* 2014 / Nevers *et al.* 2017 | Phylogenetic conservation matrices |
| PubMed + manual curation | Expanded ciliome (688 → 2,000+ genes) |

---

## Testing the Assistant

Run the golden-contract test suite:
```bash
node --test ciliai/tests/assistant_golden.test.mjs
```

Or open the in-browser verification panel at `/verify.html`.

---

## Contact

- **Dr. Oktay I. Kaplan** — oktay.kaplan@agu.edu.tr  
- **Ferhan Yenisert** — ferhan.yenisert@agu.edu.tr

**License:** Research use only. Please cite relevant sources when publishing.
