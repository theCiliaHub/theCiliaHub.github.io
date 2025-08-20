#!/usr/bin/env node

/**
 * CiliaHub Static Site Generator
 * Generates a main search page, individual gene pages, and a sitemap.
 * Usage: node generateSite.js
 */

const fs = require('fs');
const path = require('path');

// --- GENE DATA ---
// Replace this with your actual gene database from a JSON file or API call.
const geneData = [
    {
        symbol: "CFTR",
        fullName: "Cystic Fibrosis Transmembrane Conductance Regulator",
        description: "Ion channel protein involved in chloride transport and mucus production regulation. Essential for proper fluid balance across epithelial surfaces and ciliary function.",
        chromosome: "7q31.2",
        proteinLength: "1,480 amino acids",
        alternativeNames: "ABCC7, CF, MRP7",
        localization: ["Apical Membrane", "Endoplasmic Reticulum", "Ciliary Membrane"],
        functions: ["Ion Transport", "Chloride Channel", "Fluid Regulation"],
        diseases: ["Cystic Fibrosis", "CBAVD", "Pancreatitis"],
        pubmedCitations: 25847,
        knownMutations: "1,750+",
        clinicalTrials: 96,
        ncbiGeneId: "1080",
        uniprotId: "P13569",
        omimId: "602421",
        relatedGenes: ["SCNN1A", "AQP1", "SLC12A2", "SLC26A9"]
    },
    {
        symbol: "BBS1",
        fullName: "Bardet-Biedl Syndrome 1",
        description: "Component of BBSome complex involved in ciliary trafficking and protein transport to primary cilia. Essential for proper ciliary function and signaling.",
        chromosome: "11q13.2",
        proteinLength: "593 amino acids",
        alternativeNames: "BBS2L2",
        localization: ["Basal Body", "Ciliary Base", "Centrosome"],
        functions: ["Protein Trafficking", "Ciliary Assembly", "Signal Transduction"],
        diseases: ["Bardet-Biedl Syndrome", "Retinal Dystrophy", "Obesity"],
        pubmedCitations: 1205,
        knownMutations: "150+",
        clinicalTrials: 8,
        ncbiGeneId: "582",
        uniprotId: "Q8NFJ9",
        omimId: "209901",
        relatedGenes: ["BBS2", "BBS4", "BBS7", "BBS10"]
    },
    {
        symbol: "IFT88",
        fullName: "Intraflagellar Transport 88",
        description: "Core component of IFT-B complex essential for cilia assembly and maintenance. Critical for anterograde intraflagellar transport.",
        chromosome: "13q12.11",
        proteinLength: "832 amino acids",
        alternativeNames: "TG737, TTC10",
        localization: ["Ciliary Axoneme", "Basal Body", "IFT Particles"],
        functions: ["Intraflagellar Transport", "Cilia Assembly", "Cargo Transport"],
        diseases: ["Nephronophthisis", "Polycystic Kidney Disease", "Jeune Syndrome"],
        pubmedCitations: 892,
        knownMutations: "75+",
        clinicalTrials: 3,
        ncbiGeneId: "8100",
        uniprotId: "Q13099",
        omimId: "600132",
        relatedGenes: ["IFT52", "IFT57", "IFT172", "IFT140"]
    }
];


// --- HTML TEMPLATES ---

const genePageTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <title>{{GENE_SYMBOL}} Gene - {{GENE_FULL_NAME}} | CiliaHub</title>
    <meta name="description" content="{{GENE_SYMBOL}} ({{GENE_FULL_NAME}}) - Complete gene information, localization, function, disease associations, and research data from CiliaHub database.">
    <meta name="keywords" content="{{GENE_SYMBOL}} gene, {{GENE_KEYWORDS}}, ciliary genes, ciliopathy, rare diseases">
    
    <meta property="og:title" content="{{GENE_SYMBOL}} Gene - {{GENE_FULL_NAME}}">
    <meta property="og:description" content="Complete information about {{GENE_SYMBOL}} gene including function, localization, disease associations and research data.">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://theciliahub.github.io/genes/{{GENE_SYMBOL_LOWER}}.html">
    <meta property="og:site_name" content="CiliaHub">
    
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{GENE_SYMBOL}} Gene - CiliaHub">
    <meta name="twitter:description" content="Complete information about {{GENE_SYMBOL}} gene including function, localization, disease associations and research data.">
    
    <link rel="canonical" href="https://theciliahub.github.io/genes/{{GENE_SYMBOL_LOWER}}.html">
    
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "MedicalEntity",
      "name": "{{GENE_SYMBOL}}",
      "alternateName": "{{GENE_FULL_NAME}}",
      "description": "{{GENE_DESCRIPTION}}",
      "identifier": "{{GENE_SYMBOL}}",
      "url": "https://theciliahub.github.io/genes/{{GENE_SYMBOL_LOWER}}.html",
      "sameAs": [
        "https://www.ncbi.nlm.nih.gov/gene/{{NCBI_ID}}",
        "https://www.uniprot.org/uniprot/{{UNIPROT_ID}}"
      ],
      "associatedAnatomy": {
        "@type": "AnatomicalStructure",
        "name": "Primary Cilium"
      }
    }
    </script>
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        header { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1); position: fixed; width: 100%; top: 0; z-index: 1000; }
        nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; }
        .logo { font-size: 1.8rem; font-weight: bold; color: #4a5568; text-decoration: none; }
        .breadcrumb { background: rgba(255, 255, 255, 0.9); padding: 1rem; margin-top: 80px; border-radius: 8px; }
        .breadcrumb a { color: #667eea; text-decoration: none; margin-right: 0.5rem; }
        .breadcrumb a:hover { text-decoration: underline; }
        main { padding: 2rem 0; }
        .gene-header { background: white; border-radius: 15px; padding: 2rem; margin: 2rem 0; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); text-align: center; }
        .gene-symbol { font-size: 3rem; font-weight: bold; color: #667eea; margin-bottom: 1rem; }
        .gene-full-name { font-size: 1.5rem; color: #4a5568; margin-bottom: 1rem; }
        .gene-description { font-size: 1.2rem; color: #666; max-width: 800px; margin: 0 auto; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin: 2rem 0; }
        .info-card { background: white; border-radius: 15px; padding: 2rem; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); transition: transform 0.3s ease; }
        .info-card:hover { transform: translateY(-5px); }
        .info-card h3 { color: #667eea; margin-bottom: 1rem; font-size: 1.3rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
        .tag-container { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
        .tag { background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.9rem; font-weight: 500; }
        .disease-tag { background: linear-gradient(45deg, #f093fb, #f5576c); }
        .function-tag { background: linear-gradient(45deg, #4ecdc4, #44a08d); }
        .external-links { background: white; border-radius: 15px; padding: 2rem; margin: 2rem 0; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); }
        .link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .external-link { display: flex; align-items: center; padding: 1rem; background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; color: #4a5568; transition: all 0.3s ease; }
        .external-link:hover { background: #667eea; color: white; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3); }
        .research-section { background: white; border-radius: 15px; padding: 2rem; margin: 2rem 0; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); }
        .research-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0; }
        .stat-item { text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 8px; }
        .stat-number { font-size: 2rem; font-weight: bold; color: #667eea; }
        .stat-label { color: #4a5568; font-size: 0.9rem; }
        .related-genes { background: white; border-radius: 15px; padding: 2rem; margin: 2rem 0; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); }
        .gene-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .related-gene-card { padding: 1rem; background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; text-decoration: none; color: #4a5568; transition: all 0.3s ease; }
        .related-gene-card:hover { background: #667eea; color: white; transform: translateY(-3px); }
        .back-to-search { display: inline-block; background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 2rem 0; transition: all 0.3s ease; }
        .back-to-search:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3); }
        @media (max-width: 768px) { .gene-symbol { font-size: 2rem; } .info-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <header>
        <nav class="container">
            <a href="../search.html" class="logo">🧬 CiliaHub</a>
        </nav>
    </header>
    <div class="container">
        <div class="breadcrumb">
            <a href="../search.html">Home</a> > 
            <a href="../search.html">Search</a> > 
            <span>{{GENE_SYMBOL}}</span>
        </div>
        <main>
            <section class="gene-header">
                <h1 class="gene-symbol">{{GENE_SYMBOL}}</h1>
                <h2 class="gene-full-name">{{GENE_FULL_NAME}}</h2>
                <p class="gene-description">{{GENE_DESCRIPTION}}</p>
            </section>
            <div class="info-grid">
                <div class="info-card">
                    <h3>🎯 Cellular Localization</h3>
                    <p>Primary locations where this gene product is found:</p>
                    <div class="tag-container">{{LOCALIZATION_TAGS}}</div>
                </div>
                <div class="info-card">
                    <h3>⚙️ Function</h3>
                    <p>Primary molecular and cellular functions:</p>
                    <div class="tag-container">{{FUNCTION_TAGS}}</div>
                </div>
                <div class="info-card">
                    <h3>🏥 Associated Diseases</h3>
                    <p>Diseases linked to mutations in this gene:</p>
                    <div class="tag-container">{{DISEASE_TAGS}}</div>
                </div>
                <div class="info-card">
                    <h3>📊 Gene Details</h3>
                    <ul>
                        <li><strong>Chromosome:</strong> {{CHROMOSOME}}</li>
                        <li><strong>Protein Length:</strong> {{PROTEIN_LENGTH}}</li>
                        <li><strong>Alternative Names:</strong> {{ALTERNATIVE_NAMES}}</li>
                    </ul>
                </div>
            </div>
            <section class="research-section">
                <h3>📈 Research Impact</h3>
                <div class="research-stats">
                    <div class="stat-item"><div class="stat-number">{{PUBMED_CITATIONS}}</div><div class="stat-label">PubMed Citations</div></div>
                    <div class="stat-item"><div class="stat-number">{{KNOWN_MUTATIONS}}</div><div class="stat-label">Known Mutations</div></div>
                    <div class="stat-item"><div class="stat-number">{{CLINICAL_TRIALS}}</div><div class="stat-label">Clinical Trials</div></div>
                </div>
            </section>
            <section class="external-links">
                <h3>🔗 External Resources</h3>
                <div class="link-grid">
                    <a href="https://www.ncbi.nlm.nih.gov/gene/{{NCBI_ID}}" class="external-link" target="_blank" rel="noopener">📚 NCBI Gene</a>
                    <a href="https://www.uniprot.org/uniprot/{{UNIPROT_ID}}" class="external-link" target="_blank" rel="noopener">🧬 UniProt</a>
                    <a href="https://www.omim.org/entry/{{OMIM_ID}}" class="external-link" target="_blank" rel="noopener">🏥 OMIM</a>
                    <a href="https://www.genecards.org/cgi-bin/carddisp.pl?gene={{GENE_SYMBOL}}" class="external-link" target="_blank" rel="noopener">🃏 GeneCards</a>
                </div>
            </section>
            <section class="related-genes">
                <h3>🔗 Related Ciliary Genes</h3>
                <p>Genes with similar function or localization patterns:</p>
                <div class="gene-list">{{RELATED_GENES}}</div>
            </section>
            <a href="../search.html" class="back-to-search">← Back to Gene Search</a>
        </main>
    </div>
</body>
</html>`;

const searchPageTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CiliaHub: A Curated Database of Ciliary Genes</title>
    <meta name="description" content="CiliaHub is an updated and curated database of all experimentally confirmed ciliary genes with over 2,002 genes including 1300+ newly associated ciliary genes.">
    <meta name="keywords" content="ciliary genes, cilia database, ciliopathy, rare diseases, gene research">
    <meta name="author" content="CiliaHub Team">
    <meta property="og:title" content="CiliaHub: A Curated Database of Ciliary Genes">
    <meta property="og:description" content="Comprehensive database of experimentally confirmed ciliary genes with advanced search and visualization tools.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://theciliahub.github.io">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "name": "CiliaHub: Ciliary Genes Database",
      "description": "A curated database of all experimentally confirmed ciliary genes",
      "url": "https://theciliahub.github.io",
      "keywords": "ciliary genes, cilia, ciliopathy, gene database",
      "creator": { "@type": "Organization", "name": "CiliaHub Team" }
    }
    </script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        header { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1); position: fixed; width: 100%; top: 0; z-index: 1000; }
        nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; }
        .logo { font-size: 1.8rem; font-weight: bold; color: #4a5568; text-decoration: none; }
        .nav-links { display: flex; list-style: none; gap: 2rem; }
        .nav-links a { text-decoration: none; color: #4a5568; font-weight: 500; transition: color 0.3s ease; position: relative; }
        .nav-links a:hover { color: #667eea; }
        .nav-links a::after { content: ''; position: absolute; width: 0; height: 2px; bottom: -5px; left: 0; background-color: #667eea; transition: width 0.3s ease; }
        .nav-links a:hover::after { width: 100%; }
        main { margin-top: 80px; padding: 2rem 0; }
        .hero { text-align: center; padding: 4rem 0; color: white; }
        .hero h1 { font-size: 3.5rem; margin-bottom: 1rem; background: linear-gradient(45deg, #fff, #e2e8f0); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .hero p { font-size: 1.2rem; max-width: 600px; margin: 0 auto 2rem; opacity: 0.9; }
        .search-section { background: white; border-radius: 15px; padding: 2rem; margin: 2rem 0; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); }
        .search-container { position: relative; }
        .search-input { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem; }
        #suggestions-box { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; max-height: 300px; overflow-y: auto; z-index: 999; }
        .suggestion-item { padding: 10px 16px; cursor: pointer; }
        .suggestion-item:hover { background-color: #f8f9fa; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin: 3rem 0; }
        .stat-card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 2rem; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); }
        .stat-number { font-size: 2.5rem; font-weight: bold; color: #667eea; margin-bottom: 0.5rem; }
        .stat-label { color: #4a5568; font-weight: 500; }
        .charts-section { background: white; border-radius: 15px; padding: 2rem; margin: 3rem 0; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); }
        .charts-title { text-align: center; font-size: 2rem; color: #4a5568; margin-bottom: 2rem; }
        .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; }
        .chart-container { position: relative; height: 400px; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8f9fa; }
        .chart-title { text-align: center; font-weight: 600; margin-bottom: 1rem; color: #4a5568; }
        .footer { background: rgba(255, 255, 255, 0.95); text-align: center; padding: 2rem; margin-top: 4rem; color: #4a5568; }
    </style>
</head>
<body>
    <header>
        <nav class="container">
            <a href="#" class="logo">🧬 CiliaHub</a>
            <ul class="nav-links">
                <li><a href="search.html">Home</a></li>
                <li><a href="search.html#search">Search</a></li>
                <li><a href="search.html#stats">Statistics</a></li>
                <li><a href="about.html">About</a></li>
            </ul>
        </nav>
    </header>
    <main class="container">
        <section class="hero">
            <h1>CiliaHub</h1>
            <p>A comprehensive, curated database of all experimentally confirmed ciliary genes. Discover, explore, and analyze over 2,002 genes including 1300+ newly associated ciliary genes.</p>
        </section>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-number">2,002+</div><div class="stat-label">Total Genes</div></div>
            <div class="stat-card"><div class="stat-number">1,300+</div><div class="stat-label">Newly Associated</div></div>
            <div class="stat-card"><div class="stat-number">100%</div><div class="stat-label">Experimentally Confirmed</div></div>
        </div>
        <section class="search-section" id="search">
            <h2>Search Ciliary Genes</h2>
            <div class="search-container">
                <input type="text" class="search-input" placeholder="Enter gene symbol (e.g., CFTR, BBS1, IFT88)" id="geneSearch">
                <div id="suggestions-box"></div>
            </div>
        </section>
        <section class="charts-section" id="stats">
            <h2 class="charts-title">Ciliary Gene Analytics Dashboard</h2>
            <div class="charts-grid">
                <div class="chart-container"><div class="chart-title">Gene Discovery Timeline</div><canvas id="timelineChart"></canvas></div>
                <div class="chart-container"><div class="chart-title">Localization Distribution</div><canvas id="localizationChart"></canvas></div>
            </div>
        </section>
    </main>
    <footer class="footer">
        <p>&copy; 2025 CiliaHub. A comprehensive resource for ciliary gene research.</p>
    </footer>
    <script>
        const geneDatabase = ${JSON.stringify(geneData, null, 4)};

        const searchInput = document.getElementById('geneSearch');
        const suggestionsBox = document.getElementById('suggestions-box');

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            if (query.length < 1) {
                suggestionsBox.innerHTML = '';
                return;
            }
            const filteredGenes = geneDatabase.filter(gene => gene.symbol.toLowerCase().startsWith(query)).slice(0, 10);
            suggestionsBox.innerHTML = filteredGenes.map(gene => 
                \`<div class="suggestion-item" data-symbol="\${gene.symbol}">\${gene.symbol} - \${gene.fullName}</div>\`
            ).join('');
        });

        suggestionsBox.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-item')) {
                const symbol = e.target.dataset.symbol;
                window.location.href = \`genes/\${symbol.toLowerCase()}.html\`;
            }
        });
        
        // Chart.js implementation
        new Chart(document.getElementById('timelineChart'), {
            type: 'line',
            data: {
                labels: ['2000', '2005', '2010', '2015', '2020', '2025'],
                datasets: [{
                    label: 'Cumulative Genes Discovered',
                    data: [250, 450, 680, 1200, 1600, 2002],
                    borderColor: '#667eea',
                    tension: 0.1
                }]
            }
        });

        new Chart(document.getElementById('localizationChart'), {
            type: 'pie',
            data: {
                labels: ['Ciliary Axoneme', 'Basal Body', 'Transition Zone', 'Ciliary Membrane', 'Other'],
                datasets: [{
                    data: [35, 28, 15, 12, 10],
                    backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#4ecdc4', '#45b7d1']
                }]
            }
        });
    </script>
</body>
</html>`;


// --- GENERATOR FUNCTIONS ---

function generateGenePage(gene) {
    let html = genePageTemplate;
    html = html.replace(/{{GENE_SYMBOL}}/g, gene.symbol);
    html = html.replace(/{{GENE_SYMBOL_LOWER}}/g, gene.symbol.toLowerCase());
    html = html.replace(/{{GENE_FULL_NAME}}/g, gene.fullName);
    html = html.replace(/{{GENE_DESCRIPTION}}/g, gene.description);
    html = html.replace(/{{CHROMOSOME}}/g, gene.chromosome);
    html = html.replace(/{{PROTEIN_LENGTH}}/g, gene.proteinLength);
    html = html.replace(/{{ALTERNATIVE_NAMES}}/g, gene.alternativeNames);
    html = html.replace(/{{PUBMED_CITATIONS}}/g, gene.pubmedCitations.toLocaleString());
    html = html.replace(/{{KNOWN_MUTATIONS}}/g, gene.knownMutations);
    html = html.replace(/{{CLINICAL_TRIALS}}/g, gene.clinicalTrials);
    html = html.replace(/{{NCBI_ID}}/g, gene.ncbiGeneId);
    html = html.replace(/{{UNIPROT_ID}}/g, gene.uniprotId);
    html = html.replace(/{{OMIM_ID}}/g, gene.omimId);
    
    const keywords = [...gene.functions, ...gene.diseases].join(', ').toLowerCase();
    html = html.replace(/{{GENE_KEYWORDS}}/g, keywords);
    
    html = html.replace(/{{LOCALIZATION_TAGS}}/g, gene.localization.map(loc => `<span class="tag">${loc}</span>`).join(''));
    html = html.replace(/{{FUNCTION_TAGS}}/g, gene.functions.map(func => `<span class="tag function-tag">${func}</span>`).join(''));
    html = html.replace(/{{DISEASE_TAGS}}/g, gene.diseases.map(disease => `<span class="tag disease-tag">${disease}</span>`).join(''));
    html = html.replace(/{{RELATED_GENES}}/g, gene.relatedGenes.map(relGene => `<a href="${relGene.toLowerCase()}.html" class="related-gene-card"><strong>${relGene}</strong></a>`).join(''));
    
    return html;
}

function generateSitemap(genes) {
    const today = new Date().toISOString().split('T')[0];
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://theciliahub.github.io/search.html</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>`;
    
    genes.forEach(gene => {
        sitemap += `
    <url>
        <loc>https://theciliahub.github.io/genes/${gene.symbol.toLowerCase()}.html</loc>
        <lastmod>${today}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.9</priority>
    </url>`;
    });

    sitemap += `\n</urlset>`;
    return sitemap;
}


function generateSite() {
    const outputDir = path.join(__dirname, 'dist');
    const genesDir = path.join(outputDir, 'genes');

    // Create output directories
    if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(genesDir, { recursive: true });
    
    console.log('Generating main search page...');
    const searchPageHtml = searchPageTemplate.replace(/\${JSON\.stringify\(geneData, null, 4\)}/g, JSON.stringify(geneData));
    fs.writeFileSync(path.join(outputDir, 'search.html'), searchPageHtml, 'utf8');
    console.log(`✅ Generated: search.html`);

    console.log('\nGenerating individual gene pages...');
    geneData.forEach(gene => {
        const html = generateGenePage(gene);
        const filename = path.join(genesDir, `${gene.symbol.toLowerCase()}.html`);
        fs.writeFileSync(filename, html, 'utf8');
        console.log(`✅ Generated: ${filename}`);
    });
    
    console.log('\nGenerating sitemap...');
    const sitemapContent = generateSitemap(geneData);
    fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), sitemapContent, 'utf8');
    console.log(`✅ Generated: sitemap.xml`);

    console.log(`\n🎉 Successfully generated ${geneData.length} gene pages, search page, and sitemap!`);
    console.log(`\nOutput directory: ${outputDir}`);
}

// Execute the script
generateSite();
