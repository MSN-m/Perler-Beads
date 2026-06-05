const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const graph = JSON.parse(fs.readFileSync(path.join(root, '.understand-anything', 'knowledge-graph.json'), 'utf8'));
const outPath = path.join(root, 'understand-view-standalone.html');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[ch]));

const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
const fileNodes = graph.nodes.filter((node) => ['file', 'document', 'service'].includes(node.type));
const edgeLabel = {
  imports: '导入',
  calls: '调用',
  depends_on: '依赖',
  reads_from: '读取',
  writes_to: '写入',
  documents: '记录',
  contains: '包含'
};

function nodeCard(node) {
  return `
    <article class="node-card rounded-md border border-zinc-200 bg-white p-3" data-search="${esc([node.name, node.id, node.filePath, node.summary, ...(node.tags || [])].join(' ').toLowerCase())}">
      <div class="flex items-center justify-between gap-3">
        <h4 class="truncate font-medium">${esc(node.name)}</h4>
        <span class="shrink-0 rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">${esc(node.type)}</span>
      </div>
      <p class="mt-2 text-sm leading-6 text-zinc-600">${esc(node.summary)}</p>
      <p class="mt-2 break-all font-mono text-xs text-zinc-500">${esc(node.filePath || node.id)}</p>
    </article>
  `;
}

const layersHtml = graph.layers.map((layer) => {
  const nodes = layer.nodeIds.map((id) => nodesById.get(id)).filter(Boolean);
  return `
    <section class="rounded-md border border-zinc-200 bg-zinc-50">
      <div class="border-b border-zinc-200 px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold">${esc(layer.name)}</h3>
          <span class="text-sm text-zinc-500">${nodes.length} 项</span>
        </div>
        <p class="mt-1 text-sm leading-6 text-zinc-600">${esc(layer.description)}</p>
      </div>
      <div class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        ${nodes.map(nodeCard).join('')}
      </div>
    </section>
  `;
}).join('\n');

const tourHtml = graph.tour.map((step) => `
  <article class="rounded-md border border-zinc-200 bg-white p-4">
    <div class="text-xs font-semibold text-teal-700">Step ${esc(step.order)}</div>
    <h3 class="mt-1 font-semibold">${esc(step.title)}</h3>
    <p class="mt-2 text-sm leading-6 text-zinc-600">${esc(step.description)}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      ${step.nodeIds.map((id) => `<span class="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700">${esc(nodesById.get(id)?.name || id)}</span>`).join('')}
    </div>
  </article>
`).join('\n');

const edgesHtml = graph.edges
  .filter((edge) => edge.type !== 'contains')
  .slice(0, 80)
  .map((edge) => {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    return `
      <tr class="border-b border-zinc-100">
        <td class="py-2 pr-3">${esc(source?.name || edge.source)}</td>
        <td class="py-2 pr-3 text-zinc-500">${esc(edgeLabel[edge.type] || edge.type)}</td>
        <td class="py-2">${esc(target?.name || edge.target)}</td>
      </tr>
    `;
  }).join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Perler Beads 架构图谱</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    @media print { #searchWrap { display: none; } }
  </style>
</head>
<body class="bg-zinc-50 text-zinc-900">
  <main class="mx-auto max-w-7xl px-4 py-6">
    <header class="mb-5 border-b border-zinc-200 pb-4">
      <h1 class="text-2xl font-semibold">Perler Beads 架构图谱</h1>
      <p class="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">${esc(graph.project.description)}</p>
      <div class="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
        <div class="rounded border border-zinc-200 bg-white px-3 py-2"><div class="text-xs text-zinc-500">文件</div><div class="text-lg font-semibold">${fileNodes.length}</div></div>
        <div class="rounded border border-zinc-200 bg-white px-3 py-2"><div class="text-xs text-zinc-500">节点</div><div class="text-lg font-semibold">${graph.nodes.length}</div></div>
        <div class="rounded border border-zinc-200 bg-white px-3 py-2"><div class="text-xs text-zinc-500">关系</div><div class="text-lg font-semibold">${graph.edges.length}</div></div>
        <div class="rounded border border-zinc-200 bg-white px-3 py-2"><div class="text-xs text-zinc-500">分层</div><div class="text-lg font-semibold">${graph.layers.length}</div></div>
        <div class="rounded border border-zinc-200 bg-white px-3 py-2"><div class="text-xs text-zinc-500">导览</div><div class="text-lg font-semibold">${graph.tour.length}</div></div>
      </div>
    </header>

    <section id="searchWrap" class="mb-5 rounded-md border border-zinc-200 bg-white p-4">
      <label class="text-sm font-medium" for="searchBox">搜索</label>
      <input id="searchBox" class="mt-2 w-full rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="搜索文件、函数、标签或说明">
    </section>

    <section class="mb-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <div class="space-y-4">
        <h2 class="text-xl font-semibold">分层视图</h2>
        ${layersHtml}
      </div>
      <aside class="space-y-3">
        <h2 class="text-xl font-semibold">导览路线</h2>
        ${tourHtml}
      </aside>
    </section>

    <section class="rounded-md border border-zinc-200 bg-white p-4">
      <h2 class="text-xl font-semibold">主要关系</h2>
      <div class="mt-3 overflow-auto">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead class="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr><th class="pb-2 pr-3">来源</th><th class="pb-2 pr-3">关系</th><th class="pb-2">目标</th></tr>
          </thead>
          <tbody>${edgesHtml}</tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    const searchBox = document.getElementById('searchBox');
    const cards = Array.from(document.querySelectorAll('.node-card'));
    searchBox.addEventListener('input', () => {
      const query = searchBox.value.trim().toLowerCase();
      for (const card of cards) {
        card.style.display = !query || card.dataset.search.includes(query) ? '' : 'none';
      }
    });
  </script>
</body>
</html>
`;

fs.writeFileSync(outPath, html, 'utf8');
console.log(JSON.stringify({
  output: outPath,
  bytes: Buffer.byteLength(html),
  layers: graph.layers.length,
  tourSteps: graph.tour.length,
  renderedCards: fileNodes.length
}, null, 2));
