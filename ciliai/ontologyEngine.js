// ontologyEngine.js
class Graph {
    constructor(){ this.nodes = new Map(); /* id -> {id,type,label,meta} */ this.edges = []; }
    addNode(id, type, label, meta={}){ if (!this.nodes.has(id)) this.nodes.set(id,{id,type,label,meta}); }
    addEdge(from,to,rel){ this.edges.push({from,to,rel}); }
    neighbors(id){ return this.edges.filter(e=>e.from===id).map(e=> ({to:e.to,rel:e.rel})); }
    // BFS path search limited depth
    findPaths(srcId, dstId, maxDepth=3){
      const results=[];
      const queue=[{path:[srcId], depth:0}];
      while(queue.length){
        const cur = queue.shift();
        const last = cur.path[cur.path.length-1];
        if (last === dstId) { results.push(cur.path.slice()); if (results.length>=10) break; continue; }
        if (cur.depth>=maxDepth) continue;
        for (const n of this.neighbors(last)){
          if (cur.path.includes(n.to)) continue;
          queue.push({ path: cur.path.concat([n.to]), depth: cur.depth+1});
        }
      }
      return results;
    }
    renderExplanation(path){
      // Simple templating: gene -> complex -> disease -> why
      const labels = path.map(id => (this.nodes.get(id)?.label || id));
      if (path.length === 3) {
        const [g,c,d] = labels;
        return `${g} is a member of ${c}, and mutations in ${c} have been linked to ${d}. This suggests a mechanistic link where disruption of ${c} impairs ciliary function leading to ${d}.`;
      }
      // fallback generic
      return 'Found a connection: ' + labels.join(' → ');
    }
  }
  
  // Example usage:
  const g = new Graph();
  g.addNode('KIF3A','gene','KIF3A');
  g.addNode('IFT_MOTOR','complex','IFT MOTOR COMPLEX');
  g.addNode('JBTS','disease','Joubert Syndrome');
  g.addEdge('KIF3A','IFT_MOTOR','member_of');
  g.addEdge('IFT_MOTOR','JBTS','associated_with');
  
  // find paths and render
  const paths = g.findPaths('KIF3A','JBTS',3);
  const explanations = paths.map(p => g.renderExplanation(p));
  