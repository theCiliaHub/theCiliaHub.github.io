import scanpy as sc
import pandas as pd
import numpy as np
import json
import time

# --- Configuration ---

# 1. SET YOUR FILE PATHS
H5AD_FILE_PATH = "/Users/sebihacevik/Downloads/a2011f35-04c4-427f-80d1-27ee0670251d.h5ad"
UMAP_OUTPUT_PATH = "umap_data.json"
CELLXGENE_OUTPUT_PATH = "cellxgene_data.json"

# 2. SET DATASET-SPECIFIC KEYS
# These are the *correct* keys for this specific dataset
CELL_TYPE_COLUMN = 'cell_type' # The column with the correct labels
GENE_NAME_COLUMN = 'feature_name'      # The column with gene symbols (e.g., "SOX2")
UMAP_KEY = 'X_umap'                    # The key in .obsm where UMAP coords are stored

# 3. SET SAMPLING SIZE
# 20,000 cells is a good balance for a responsive plot
UMAP_SAMPLE_SIZE = 20000

# ---------------------

def generate_umap_json(adata, sample_size):
    """
    Generates the umap_data.json file.
    It samples the cells and saves their UMAP x, y, and cell_type.
    """
    print(f"\n--- Generating {UMAP_OUTPUT_PATH} ---")
    
    # Create a small, sampled AnnData object
    print(f"Sampling {sample_size} cells from {len(adata)} total cells...")
    if len(adata) > sample_size:
        adata_sampled = sc.pp.subsample(adata, n_obs=sample_size, copy=True)
    else:
        adata_sampled = adata
        
    # Get the UMAP coordinates
    umap_coords = adata_sampled.obsm[UMAP_KEY]
    
    # Get the cell type labels
    cell_labels = adata_sampled.obs[CELL_TYPE_COLUMN]
    
    # Create the final DataFrame
    df_umap = pd.DataFrame(
        data=umap_coords,
        columns=['x', 'y']
    )
    df_umap['cell_type'] = cell_labels.values
    
    # Convert 'x' and 'y' to standard floats to avoid JSON issues
    df_umap['x'] = df_umap['x'].astype(float)
    df_umap['y'] = df_umap['y'].astype(float)
    
    # Save to JSON in the format: [ {"x":..., "y":..., "cell_type":...}, ... ]
    df_umap.to_json(UMAP_OUTPUT_PATH, orient='records')
    print(f"✅ Success! Saved {len(df_umap)} cells to {UMAP_OUTPUT_PATH}")

def generate_cellxgene_json(adata):
    """
    Generates the cellxgene_data.json file.
    Calculates the mean expression for every gene, grouped by cell type.
    This is memory-efficient and creates the exact structure needed.
    """
    print(f"\n--- Generating {CELLXGENE_OUTPUT_PATH} ---")
    print("This is a large dataset and may take a few minutes...")
    
    # 1. Get all unique cell type groups and their indices
    print("Finding cell type groups...")
    cell_type_groups = adata.obs.groupby(CELL_TYPE_COLUMN).indices
    
    # 2. Get all gene names, ensuring they are UPPERCASE for JS matching
    gene_names_upper = adata.var[GENE_NAME_COLUMN].str.upper().values
    
    # 3. Get the expression matrix in CSC format (fast for column slicing)
    matrix_csc = adata.X.tocsc()
    
    final_gene_data = {}
    total_genes = len(gene_names_upper)

    start_time = time.time()
    
    # 4. Iterate over each GENE (column)
    print(f"Calculating average expression for {total_genes} genes...")
    for i, gene_name in enumerate(gene_names_upper):
        
        # Print progress
        if (i + 1) % 1000 == 0:
            elapsed = time.time() - start_time
            print(f"  ...processed {i+1}/{total_genes} genes ({elapsed:.1f}s)")

        # Get the full expression vector for this one gene
        # .toarray().flatten() makes it a simple 1D numpy array
        gene_vector = matrix_csc[:, i].toarray().flatten()
        
        gene_avg_by_cell_type = {}
        
        # 5. For this gene, calculate its mean expression for each cell type
        for cell_type, indices in cell_type_groups.items():
            # Get all expression values for this gene from cells in this group
            values_for_group = gene_vector[indices]
            
            # Calculate the mean and store it
            avg_exp = np.mean(values_for_group)
            
            # Convert to standard float for JSON
            gene_avg_by_cell_type[cell_type] = float(avg_exp)
            
        # Add this gene's data to the final dictionary
        final_gene_data[gene_name] = gene_avg_by_cell_type

    # 6. Save the entire dictionary to a JSON file
    print(f"Saving aggregated data to {CELLXGENE_OUTPUT_PATH}...")
    with open(CELLXGENE_OUTPUT_PATH, 'w') as f:
        json.dump(final_gene_data, f)
        
    print(f"✅ Success! Saved aggregated data for {total_genes} genes to {CELLXGENE_OUTPUT_PATH}")


def main():
    print(f"Loading AnnData file: {H5AD_FILE_PATH}")
    try:
        adata = sc.read_h5ad(H5AD_FILE_PATH)
    except Exception as e:
        print(f"Error reading .h5ad file: {e}")
        return
        
    print(f"File loaded. Total cells: {len(adata)}, Total genes: {len(adata.var)}")

    # --- Validate Columns ---
    if CELL_TYPE_COLUMN not in adata.obs.columns:
        print(f"Error: Cell type column '{CELL_TYPE_COLUMN}' not in adata.obs!")
        print(f"Available columns: {list(adata.obs.columns)}")
        return
    if GENE_NAME_COLUMN not in adata.var.columns:
        print(f"Error: Gene name column '{GENE_NAME_COLUMN}' not in adata.var!")
        print(f"Available columns: {list(adata.var.columns)}")
        return
    if UMAP_KEY not in adata.obsm:
        print(f"Error: UMAP key '{UMAP_KEY}' not in adata.obsm!")
        print(f"Available keys: {list(adata.obsm.keys())}")
        return

    # --- Run Generators ---
    generate_umap_json(adata, UMAP_SAMPLE_SIZE)
    generate_cellxgene_json(adata)
    
    print("\nAll done! ✨")

if __name__ == "__main__":
    main()
