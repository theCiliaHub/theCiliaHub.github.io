document.addEventListener('DOMContentLoaded', () => {
  // Chart.js for Gene Growth Over Time
  const ctx = document.getElementById('geneGrowthChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['2013', '2021', '2025'],
      datasets: [{
        label: 'Ciliary Gold Standard Genes',
        data: [303, 688, 2002],
        borderColor: '#007bff',
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Number of Genes' }
        },
        x: {
          title: { display: true, text: 'Year' }
        }
      }
    }
  });

  // Placeholder database functions
  window.resetSearch = function() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterSelect').value = '';
    document.getElementById('batchQuery').value = '';
    // Add logic to reset search results
  };

  window.downloadCSV = function() {
    // Placeholder for CSV download
    alert('Download CSV functionality to be implemented');
  };

  window.batchQuery = function() {
    const query = document.getElementById('batchQuery').value;
    // Placeholder for batch query
    alert('Batch query for: ' + query);
  };

  // Basic URL routing for SPA
  function loadContent() {
    const path = window.location.pathname;
    if (path.startsWith('/gene/')) {
      const gene = path.split('/gene/')[1];
      document.querySelector('main') ? document.querySelector('main').innerHTML = `<h2>Gene: ${gene}</h2><p>Loading data for ${gene}...</p>` : 
        document.body.innerHTML += `<main><h2>Gene: ${gene}</h2><p>Loading data for ${gene}...</p></main>`;
      // Add schema.org for gene
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        'name': `Ciliary Gene: ${gene}`,
        'description': `Information about the ciliary gene ${gene} from the CiliaHub database.`,
        'url': `https://theciliahub.github.io/gene/${gene}`
      });
      document.head.appendChild(script);
    }
  }

  // Handle navigation
  window.addEventListener('popstate', loadContent);
  loadContent();
});
