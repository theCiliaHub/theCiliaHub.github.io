// Test data setup
const testGenes = [
  {
    "gene": "ACE2",
    "ensembl_id": "ENSG00000130234",
    "description": "angiotensin converting enzyme 2 [Source:HGNC Symbol;Acc:HGNC:13557]",
    "synonym": "ACEH",
    "omim_id": "300335",
    "functional_summary": "ACE2 receptor protein robustly localizes within the membrane of the motile cilia of airway epithelial cells, which likely represents the initial or early subcellular site of SARS-CoV-2 viral entry during host respiratory transmission.",
    "localization": ["cilia", "Ciliary membrane"],
    "reference": ["33116139"],
    "functional_category": ["Ciliary membrane", "T cell biology", "Cardiac & muscle development", "Muscle contraction & physiology", "RTK/FGF signaling", "Metabolism", "Hormone & insulin signaling", "Viral interactions", "Cell migration & adhesion", "Protein processing & maturation", "Trafficking (BBSome", "small GTPases", "vesicular transport", "ATPases)", "Ciliary assembly/disassembly", "Cytoskeleton/adhesion links"],
    "complex_names": "ACE2-TMPRSS2 complex; ACE2-SLC6A19 complex; ACE2-AGTR1 complex",
    "complex_components": "ACE2;TMPRSS2 | ACE2;SLC6A19 | ACE2;AGTR1"
  },
  {
    "gene": "BBS1",
    "ensembl_id": "ENSG00000174483",
    "localization": ["Basal Body", "Cilia"],
    "functional_category": ["Ciliary assembly/disassembly", "Trafficking"],
    "complex_names": "BBSome complex",
    "complex_components": "BBS1;BBS2;BBS4;BBS5;BBS7;BBS8;BBS9"
  },
  {
    "gene": "IFT88",
    "ensembl_id": "ENSG00000108375",
    "localization": ["Cilia", "Transition Zone"],
    "functional_category": ["Intraflagellar transport", "Ciliary assembly/disassembly"]
  },
  {
    "gene": "TMEM216",
    "ensembl_id": "ENSG00000171345",
    "localization": ["Transition Zone", "Cilia"],
    "functional_category": ["Ciliary assembly/disassembly", "Joubert Syndrome"]
  }
];

// Set as global variable for testing
window.allGenes = testGenes;


function performFunctionalEnrichment(foundGenes) {
    // Extract all unique functional categories from the database
    const allCategories = new Set();
    window.allGenes.forEach(gene => {
        if (gene.functional_category && Array.isArray(gene.functional_category)) {
            gene.functional_category.forEach(cat => {
                if (cat && cat.trim()) {
                    allCategories.add(cat.trim());
                }
            });
        }
    });
    
    const results = [];
    const inputGenesUpper = foundGenes.map(g => g.gene.toUpperCase());
    
    allCategories.forEach(category => {
        // Find all genes in this category
        const categoryGenes = window.allGenes.filter(g => 
            g.functional_category && 
            g.functional_category.includes(category)
        ).map(g => g.gene.toUpperCase());
        
        if (categoryGenes.length === 0) return;
        
        // Find overlap with input genes
        const overlap = inputGenesUpper.filter(gene => 
            categoryGenes.includes(gene)
        );
        
        if (overlap.length > 0) {
            const pValue = hypergeometricPValue(
                overlap.length,
                inputGenesUpper.length,
                categoryGenes.length,
                20000
            );
            
            const enrichmentScore = (overlap.length / inputGenesUpper.length) / 
                                  (categoryGenes.length / 20000);
            
            results.push({
                category: category,
                overlap_count: overlap.length,
                total_category_genes: categoryGenes.length,
                overlap_genes: overlap,
                p_value: pValue,
                enrichment_score: enrichmentScore,
                fold_enrichment: enrichmentScore
            });
        }
    });
    
    return results.sort((a, b) => a.p_value - b.p_value);
}


function performComplexEnrichment(foundGenes) {
    const complexDatabase = {};
    
    // Build complex database from all genes
    window.allGenes.forEach(gene => {
        if (gene.complex_names) {
            const complexes = gene.complex_names.split(';').map(c => c.trim());
            complexes.forEach(complex => {
                if (complex && !complexDatabase[complex]) {
                    // Find all genes in this complex
                    const complexGenes = new Set();
                    window.allGenes.forEach(g => {
                        if (g.complex_names && g.complex_names.includes(complex)) {
                            complexGenes.add(g.gene.toUpperCase());
                        }
                    });
                    complexDatabase[complex] = Array.from(complexGenes);
                }
            });
        }
    });
    
    const results = [];
    const inputGenesUpper = foundGenes.map(g => g.gene.toUpperCase());
    
    Object.entries(complexDatabase).forEach(([complex, complexGenes]) => {
        if (complexGenes.length === 0) return;
        
        const overlap = inputGenesUpper.filter(gene => 
            complexGenes.includes(gene)
        );
        
        if (overlap.length > 0) {
            const pValue = hypergeometricPValue(
                overlap.length,
                inputGenesUpper.length,
                complexGenes.length,
                20000
            );
            
            const enrichmentScore = (overlap.length / inputGenesUpper.length) / 
                                  (complexGenes.length / 20000);
            
            results.push({
                complex: complex,
                overlap_count: overlap.length,
                total_complex_genes: complexGenes.length,
                overlap_genes: overlap,
                p_value: pValue,
                enrichment_score: enrichmentScore,
                fold_enrichment: enrichmentScore
            });
        }
    });
    
    return results.sort((a, b) => a.p_value - b.p_value);
}

function testAllEnrichmentAnalyses() {
    console.log("=== Testing Enrichment Analyses ===");
    
    const testInputGenes = ["ACE2", "BBS1", "IFT88", "TMEM216"];
    const foundGenes = testInputGenes.map(geneName => 
        window.allGenes.find(g => g.gene.toUpperCase() === geneName.toUpperCase())
    ).filter(Boolean);
    
    console.log("Input genes:", testInputGenes);
    console.log("Found genes:", foundGenes.map(g => g.gene));
    
    // Test Disease Enrichment
    console.log("\n1. Disease Enrichment:");
    const diseaseResults = performDiseaseEnrichment(foundGenes);
    console.log(diseaseResults);
    
    // Test Functional Enrichment
    console.log("\n2. Functional Enrichment:");
    const functionalResults = performFunctionalEnrichment(foundGenes);
    console.log(functionalResults.slice(0, 5)); // Show top 5
    
    // Test Complex Enrichment
    console.log("\n3. Complex Enrichment:");
    const complexResults = performComplexEnrichment(foundGenes);
    console.log(complexResults);
    
    // Test Localization Analysis (existing)
    console.log("\n4. Localization Analysis:");
    const localizationResults = analyzeLocalization(foundGenes);
    console.log(localizationResults);
    
    return {
        disease: diseaseResults,
        functional: functionalResults,
        complex: complexResults,
        localization: localizationResults
    };
}

// Helper function for localization analysis
function analyzeLocalization(foundGenes) {
    const localizationCounts = {};
    foundGenes.forEach(gene => {
        if (gene.localization && Array.isArray(gene.localization)) {
            gene.localization.forEach(loc => {
                localizationCounts[loc] = (localizationCounts[loc] || 0) + 1;
            });
        }
    });
    return localizationCounts;
}


function renderFunctionalEnrichment(foundGenes) {
    const results = performFunctionalEnrichment(foundGenes);
    
    if (results.length === 0) {
        return '<p class="status-message">No significant functional category enrichments found.</p>';
    }
    
    const settings = getPlotSettings();
    const topResults = results.slice(0, 15); // Show top 15 categories
    
    // Create bar chart data
    const labels = topResults.map(r => r.category);
    const data = topResults.map(r => -Math.log10(r.p_value));
    const colors = topResults.map(r => 
        r.p_value < 0.001 ? '#006d2c' : 
        r.p_value < 0.01 ? '#2ca25f' : 
        r.p_value < 0.05 ? '#66c2a4' : '#b2e2e2'
    );
    
    return `
        <div style="position: relative; height: 600px;">
            <canvas id="functional-enrichment-chart"></canvas>
        </div>
        <script>
            new Chart(document.getElementById('functional-enrichment-chart'), {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(labels)},
                    datasets: [{
                        label: '-Log10(P-value)',
                        data: ${JSON.stringify(data)},
                        backgroundColor: ${JSON.stringify(colors)},
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: 'Functional Category Enrichment'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const result = ${JSON.stringify(topResults)}[context.dataIndex];
                                    return [
                                        'P-value: ' + result.p_value.toExponential(3),
                                        'Fold enrichment: ' + result.fold_enrichment.toFixed(2) + 'x',
                                        'Genes: ' + result.overlap_genes.join(', ')
                                    ];
                                }
                            }
                        }
                    }
                }
            });
        </script>
    `;
}

function renderComplexEnrichment(foundGenes) {
    const results = performComplexEnrichment(foundGenes);
    
    if (results.length === 0) {
        return '<p class="status-message">No significant protein complex enrichments found.</p>';
    }
    
    // Create network visualization or bubble chart
    return `
        <div style="position: relative; height: 500px;">
            <h4>Protein Complex Enrichment</h4>
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Complex</th>
                            <th>P-value</th>
                            <th>Fold Enrichment</th>
                            <th>Overlap Genes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(result => `
                            <tr>
                                <td>${result.complex}</td>
                                <td>${result.p_value.toExponential(3)}</td>
                                <td>${result.fold_enrichment.toFixed(2)}x</td>
                                <td>${result.overlap_genes.join(', ')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Update the main plotting function to include new analyses
function generateEnrichmentPlots() {
    const genesInput = document.getElementById('enrichment-genes-input').value.trim();
    if (!genesInput) {
        alert('Please enter or upload a gene list.');
        return;
    }

    const geneList = genesInput.split(/[\n,]+/).map(g => g.trim()).filter(Boolean);
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;

    const foundGenes = geneList.map(inputGene => {
        return window.allGenes?.find(gene => 
            gene.gene.toLowerCase() === inputGene.toLowerCase() ||
            (gene.synonym && gene.synonym.toLowerCase() === inputGene.toLowerCase())
        ) || { gene: inputGene };
    }).filter(gene => gene.gene);

    // Hide all plot containers
    document.getElementById('bubble-enrichment-container').style.display = 'none';
    document.getElementById('matrix-plot-container').style.display = 'none';
    document.getElementById('ciliome-plot-container').style.display = 'none';
    document.getElementById('disease-plot-container').style.display = 'none';
    document.getElementById('functional-plot-container').style.display = 'none';
    document.getElementById('complex-plot-container').style.display = 'none';
    
    document.getElementById('plot-container').style.display = 'block';
    document.getElementById('download-plot-btn').style.display = 'inline-block';

    // Destroy previous plot if exists
    if (currentPlot) {
        currentPlot.destroy();
        currentPlot = null;
    }

    switch(plotType) {
        case 'bubble':
            renderEnrichmentBubblePlot(foundGenes);
            break;
        case 'matrix':
            renderBubbleMatrix(foundGenes);
            break;
        case 'ciliome':
            const notFoundGenes = geneList.filter(inputGene => 
                !foundGenes.some(fg => fg.gene.toLowerCase() === inputGene.toLowerCase())
            );
            renderCiliomeEnrichment(foundGenes, notFoundGenes);
            break;
        case 'disease':
            renderDiseaseEnrichment(foundGenes);
            break;
        case 'functional':
            document.getElementById('functional-plot-container').innerHTML = renderFunctionalEnrichment(foundGenes);
            document.getElementById('functional-plot-container').style.display = 'block';
            break;
        case 'complex':
            document.getElementById('complex-plot-container').innerHTML = renderComplexEnrichment(foundGenes);
            document.getElementById('complex-plot-container').style.display = 'block';
            break;
    }

    document.getElementById('plot-container').scrollIntoView({ behavior: 'smooth' });
}

// Run this in your browser console after loading the page
testAllEnrichmentAnalyses();

