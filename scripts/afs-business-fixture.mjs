// Isolated conditional-write root; no files, credentials or network.
export function memoryBusinessRoot() {
  const nodes = new Map(); let revision = 0;
  return {
    nodes,
    async read(path) {
      if (path.endsWith('.capabilities')) return {data:{content:{operations:{write:{features:{ifMatch:true,treeIncrement:true}}}}}};
      const node = nodes.get(path);
      if (!node) throw Object.assign(Error('Not found'),{code:'AFS_NOT_FOUND'});
      return {data:structuredClone(node)};
    },
    async write(path,input,options) {
      const node = nodes.get(path);
      if (options.ifMatch !== (node?.meta.version ?? '!absent')) throw Object.assign(Error('Conflict'),{code:'AFS_CONFLICT'});
      nodes.set(path,{content:input.content,meta:{version:String(++revision)}});
    },
  };
}
