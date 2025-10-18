// questionRegistry.js
// Master list of all answerable CiliAI questions
// Version: October 2025
// Author: CiliAI Team

export const questionRegistry = [
  // -------------------------------
    // 1. EXPRESSION-BASED QUESTIONS
  // -------------------------------
    { text: "Where is ARL13B expressed in human tissues?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Is FOXJ1 expressed in the lung?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "In which cell types is IFT88 expressed?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Show ciliary genes expressed in kidney epithelial cells.", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Display expression of DNAAF1 across tissues.", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Which tissues show the highest expression of ARL13B?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "What is the expression level of OFD1 in brain?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Where is CEP290 detected in single-cell RNA-seq data?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Which genes are enriched in multiciliated cells?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Show all ciliary genes expressed in testis.", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Compare expression of ARL13B and FOXJ1 in lung.", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Compare IFT88 and IFT172 across tissues.", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Which genes co-express with ARL13B?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Are CCDC39 and CCDC40 expressed in the same cells?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Which genes have correlated expression with DNAAF5?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Show clusters enriched for ciliary markers.", category: "expression", dataset: "umap_data.json" },
  { text: "Which cluster has high FOXJ1 expression?", category: "expression", dataset: "umap_data.json" },
  { text: "Where do ciliated cells cluster in the lung UMAP?", category: "expression", dataset: "umap_data.json" },
  { text: "Display ARL13B-positive clusters.", category: "expression", dataset: "umap_data.json" },
  { text: "Which clusters represent multiciliated epithelia?", category: "expression", dataset: "umap_data.json" },
  { text: "What percentage of lung cells express FOXJ1?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Show expression of IFT genes in brain cell types.", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Are cilia assembly genes enriched in any cluster?", category: "expression", dataset: "umap_data.json" },
  { text: "Plot ciliary gene expression by tissue type.", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Find top 10 cilia genes expressed in kidney.", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Which ciliary genes are expressed in ependymal cells?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Are ciliary transport genes expressed in neurons?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Which axonemal dynein genes are expressed in testis?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Which ciliary genes are expressed in retina photoreceptors?", category: "expression", dataset: "cellxgene_data.json" },
  { text: "Show primary cilia gene expression in fibroblasts.", category: "expression", dataset: "cellxgene_data.json" },
  
  // -------------------------------
    // 2. PHYLOGENETIC AND CONSERVATION
  // -------------------------------
    { text: "Which ciliary genes are conserved across all metazoans?", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Show cilia genes unique to vertebrates.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Which human ciliary genes are conserved in C. elegans?", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Find ciliary genes absent in nematodes.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "List highly conserved ciliary genes from algae to humans.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "How conserved is ARL13B across species?", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Compare IFT88 and IFT81 conservation profiles.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Is TTC21B conserved in unicellular organisms?", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Which genes show loss in nonciliated species?", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Which ciliary genes evolved recently in mammals?", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Show ciliary genes with conserved domains across species.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Which genes are conserved in both humans and zebrafish?", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Find ciliary genes shared between Drosophila and human.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Which ciliary kinases are conserved in vertebrates?", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "List conserved ciliary structural genes.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Show conserved genes also expressed in lung.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Which conserved cilia genes are disease-associated?", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Find conserved genes linked to hydrocephalus.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "List conserved ciliary kinases in mouse.", category: "conservation", dataset: "phylogeny_summary.json" },
  { text: "Show conserved transition zone proteins.", category: "conservation", dataset: "phylogeny_summary.json" },
  
  // -------------------------------
    // 3. FUNCTIONAL SCREENS AND PHENOTYPES
  // -------------------------------
    { text: "Which knockdowns cause short cilia?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "List genes causing elongated cilia phenotype.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Which genes lead to defective ciliogenesis?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Which genes affect IFT particle movement?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Find genes required for axoneme assembly.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Which knockdowns cause abnormal Hedgehog signaling?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "List genes involved in Shh pathway defects.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Which genes affect Wnt signaling via cilia?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Show genes linked to abnormal mechanosensation.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Which ciliary mutants disrupt olfactory signaling?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Which genes cause cystic kidney phenotypes in zebrafish?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Show genes causing hydrocephalus-like phenotypes.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Which genes affect left-right asymmetry?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Find genes linked to situs inversus in screens.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "List genes producing retinal degeneration phenotypes.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Show hits from Kim2016 screen for long cilia.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "List ciliary genes from Yee2015 screen.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Which genes were tested in RNAi-based ciliogenesis assays?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Find genes with axonemal motility defects.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Which knockdowns cause IFT particle accumulation?", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Show genes with short cilia phenotype that are conserved.", category: "phenotype", dataset: "phylogeny_summary.json" },
  { text: "List genes with motility defects expressed in neurons.", category: "phenotype", dataset: "cellxgene_data.json" },
  { text: "Which disease genes show long cilia phenotype?", category: "phenotype", dataset: "ciliahub_data.json" },
  { text: "Find IFT genes that produce abnormal morphology.", category: "phenotype", dataset: "cilia_screens_data.json" },
  { text: "Show genes that rescue ciliary defects upon co-knockdown.", category: "phenotype", dataset: "cilia_screens_data.json" },
  
  // -------------------------------
    // 4. CILIOPATHY AND DISEASE ASSOCIATION
  // -------------------------------
    { text: "Which ciliopathy is caused by mutations in IFT140?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "What disease is associated with ARL13B?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Which genes are linked to cranioectodermal dysplasia?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "What diseases involve CC2D1A?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Show genes causing nephronophthisis.", category: "disease", dataset: "ciliahub_data.json" },
  { text: "List genes associated with retinal degeneration.", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Show ciliopathy genes associated with hydrocephalus.", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Which genes are linked to Joubert syndrome?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Find genes linked to Bardet–Biedl syndrome.", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Which genes are involved in Meckel–Gruber syndrome?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Which transition zone genes cause ciliopathies?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Which basal body genes are linked to disease?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Which IFT-B genes cause human ciliopathies?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "List axonemal dynein–related ciliopathies.", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Which signaling-related genes lead to ciliopathy symptoms?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Show disease genes expressed in brain.", category: "disease", dataset: "cellxgene_data.json" },
  { text: "Which disease genes are highly conserved?", category: "disease", dataset: "phylogeny_summary.json" },
  { text: "Which ciliopathy genes cause neural defects?", category: "disease", dataset: "ciliahub_data.json" },
  { text: "List genes with both motility and sensory defects.", category: "disease", dataset: "ciliahub_data.json" },
  { text: "Which genes are linked to both renal and retinal disease?", category: "disease", dataset: "ciliahub_data.json" },
  
  // -------------------------------
    // 5. STRUCTURAL AND LOCALIZATION
  // -------------------------------
    { text: "Which proteins localize to the transition zone?", category: "structure", dataset: "ciliahub_data.json" },
  { text: "Which genes encode axonemal dyneins?", category: "structure", dataset: "ciliahub_data.json" },
  { text: "List genes localized at basal bodies.", category: "structure", dataset: "ciliahub_data.json" },
  { text: "Show genes localized to distal segment of cilia.", category: "structure", dataset: "ciliahub_data.json" },
  { text: "Which proteins are in ciliary membrane?", category: "structure", dataset: "ciliahub_data.json" },
  { text: "Which genes encode BBSome components?", category: "structure", dataset: "ciliahub_data.json" },
  { text: "List all IFT-B complex members.", category: "structure", dataset: "ciliahub_data.json" },
  { text: "Show IFT-A subunits and their functions.", category: "structure", dataset: "ciliahub_data.json" },
  { text: "Which genes encode motor proteins like kinesin-2?", category: "structure", dataset: "ciliahub_data.json" },
  { text: "Find ciliary proteins that traffic GPCRs.", category: "structure", dataset: "ciliahub_data.json" },
  
  // -------------------------------
    // 6. FUNCTIONAL CATEGORIES
  // -------------------------------
    { text: "Which genes are involved in ciliogenesis?", category: "function", dataset: "ciliahub_data.json" },
  { text: "Which genes control ciliary length regulation?", category: "function", dataset: "ciliahub_data.json" },
  { text: "List genes required for IFT particle assembly.", category: "function", dataset: "ciliahub_data.json" },
  { text: "Show genes regulating ciliary membrane composition.", category: "function", dataset: "ciliahub_data.json" },
  { text: "Which genes mediate protein trafficking into cilia?", category: "function", dataset: "ciliahub_data.json" },
  
  // -------------------------------
    // 7. CROSS-DATASET (INTEGRATIVE)
  // -------------------------------
    { text: "Show conserved ciliary genes expressed in brain.", category: "crossDataset", dataset: "phylogeny_summary.json" },
  { text: "Which disease-associated genes are expressed in lung?", category: "crossDataset", dataset: "ciliahub_data.json" },
  { text: "Find conserved genes expressed in kidney.", category: "crossDataset", dataset: "phylogeny_summary.json" },
  { text: "Show ciliary kinases expressed in multiciliated cells.", category: "crossDataset", dataset: "cellxgene_data.json" },
  { text: "Which ciliary genes are both conserved and disease-linked?", category: "crossDataset", dataset: "phylogeny_summary.json" },
  
  // -------------------------------
    // 8. EDUCATIONAL AND DESCRIPTIVE
  // -------------------------------
    { text: "What does IFT88 do?", category: "education" },
  { text: "Describe ARL13B function in cilia.", category: "education" },
  { text: "What is the role of CC2D1A in ciliogenesis?", category: "education" },
  { text: "How does OFD1 contribute to ciliary structure?", category: "education" },
  { text: "Explain the function of EFCAB7.", category: "education" },
  { text: "What is a primary cilium?", category: "education" },
  { text: "How do motile cilia differ from nonmotile cilia?", category: "education" },
  { text: "What is the BBSome complex?", category: "education" },
  { text: "Describe the IFT-A and IFT-B complexes.", category: "education" },
  { text: "What is the function of transition zone?", category: "education" },
  { text: "Explain how ciliary signaling works.", category: "education" },
  { text: "What happens when cilia are defective?", category: "education" },
  { text: "Describe how cilia are formed.", category: "education" },
  { text: "Which organ systems depend on cilia?", category: "education" },
  { text: "Explain the link between cilia and human disease.", category: "education" }
];
