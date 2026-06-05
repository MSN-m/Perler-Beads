const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const graphPath = path.join(root, '.understand-anything', 'knowledge-graph.json');
const htmlPath = path.join(root, 'understand-view.html');
const standalonePath = path.join(root, 'understand-view-standalone.html');

const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

const summaries = {
  'index.html': '主界面入口，负责图片上传、拼豆参数配置、生成图纸编辑，以及可打印图纸导出。',
  'workbench.html': '工作台版界面入口，包含源图预览、裁剪控制、草稿管理、对比预览和编辑流程。',
  'color_check.html': '调色板颜色数据的检查和复核页面。',
  'style.css': '叠加在 Tailwind CDN 之上的少量项目自定义样式。',
  'server.js': '本地静态文件服务，用于在浏览器中预览这个无构建前端项目。',
  'generate_check_page_dedup.js': '辅助脚本，用于生成或支持带去重逻辑的调色板检查页面。',
  'get_mard_221.js': '辅助脚本，导入调色板常量以提取或检查 MARD 颜色数据。',
  'README.md': '项目交接和归档规则，约定多 AI 协作时的长期记忆入口。',
  'COMMON_ISSUES.md': '项目常见问题和排查经验记录。',
  'MARD_COLORS.md': 'MARD 拼豆颜色数据参考文档。',
  'guige221.md': '拼豆颜色或规格数据相关参考说明。',
  'guige264.md': '规格说明占位或草稿文件。',
  'main.js': '应用启动入口：绑定 DOM 事件、Canvas 交互、上传流程、编辑控制、缩放和导出动作。',
  'ui.js': '主 UI 流程模块：步骤切换、背景移除、像素图生成、图纸生成、草稿、裁剪/预览控制，并对外转发编辑命令。',
  'state.js': '共享 AppState，保存图片数据、生成图纸、编辑模式、缩放状态、裁剪状态、草稿和工作台设置。',
  'renderer.js': 'Canvas 渲染模块，负责拼豆图纸、标尺、高亮颜色、内容边界和缩放变换。',
  'processor.js': '图像处理流水线：背景移除、碎片清理、像素采样、颜色量化、调色板匹配、dithering、区域清理和图纸数据生成。',
  'constants.js': '支持品牌和色组的调色板数据库。',
  'exporter.js': '导出模块，生成原图、镜像图和带标注的可打印图片。',
  'utils.js': '通用颜色工具，例如 nearest-color 匹配。',
  'editor.js': '编辑共享工具：暂存像素修改、调色板访问、批量替换、颜色距离、统计信息和编辑动作配置。',
  'zoom.js': '结果 Canvas 的缩放和平移模块，处理鼠标/触摸交互和重置行为。',
  'adjust.js': '颜色调整与填充/清除编辑模块，包含网格命中、暂存编辑、undo/apply/cancel、取色和对比拖拽交互。',
  'delete.js': '删除模式模块，通过确认弹窗暂存并删除单个拼豆格。',
  'edge.js': '边缘调整模块，识别边界拼豆并进入批量替换编辑流程。',
  'TEST_CASES.md': '关键用户流程的手工回归测试清单。',
  'REFACTOR_SPEC.md': '模块边界和迁移步骤的重构计划。',
  'gonnengguize.md': '归档的项目规则或流程说明。',
  'DEVELOPMENT_SUMMARY_20260409_1755.md': '最新开发归档，记录近期工作和后续计划。',
  'DEVELOPMENT_SUMMARY_20260409_1658.md': '编辑模块抽离和剩余回归风险的开发总结。'
};

const layers = {
  'layer:entry-and-pages': ['入口与页面', 'HTML 页面、样式和本地预览服务，共同承载浏览器端应用。'],
  'layer:application-ui': ['应用 UI 流程', '负责启动绑定、流程编排、草稿、裁剪预览，以及协调用户操作的模块。'],
  'layer:editing-features': ['编辑功能', '缩放、颜色调整、填充/清除、删除和边缘调整等聚焦的交互模块。'],
  'layer:image-and-rendering-core': ['图像与渲染核心', '把源图转换成可打印拼豆图纸的处理、渲染、导出和颜色工具。'],
  'layer:state-and-data': ['状态与数据', '跨处理、渲染、编辑和导出流程共享的 AppState 与调色板数据。'],
  'layer:documentation': ['文档与归档', '项目交接说明、参考数据、问题记录、回归计划和开发总结。']
};

const tour = {
  1: ['项目概览', '先看 README 和最新归档，了解项目规则、交接方式以及最近一次模块拆分。'],
  2: ['浏览器入口', '从 HTML 入口进入 JavaScript bootstrap，理解上传、处理、编辑、缩放和导出控件如何绑定。'],
  3: ['UI 工作流', '查看流程协调模块和共享编辑工具，理解 AppState 如何在上传、清理、生成、编辑、草稿和导出阶段流转。'],
  4: ['图像处理流水线', '阅读图像处理核心，理解源像素如何转换为 pixel art，并进一步匹配到拼豆调色板。'],
  5: ['Canvas 与导出', '查看生成的图纸数据如何渲染成 Canvas 图纸，并导出为可下载图片。'],
  6: ['编辑模式', '最后看缩放、调色、删除和边缘调整模块，这里是最需要回归验证的交互区域。']
};

graph.project.description = '无构建浏览器应用：把上传图片转换为匹配拼豆调色板的图案，并生成可打印图纸。';

for (const node of graph.nodes) {
  const base = path.basename(node.filePath || node.name || '');
  if (summaries[base]) node.summary = summaries[base];
  if (node.type === 'function') {
    node.summary = `${node.name} 是 ${node.filePath} 对外导出的函数。`;
  }
  if (node.type === 'concept') {
    node.summary = `${node.name} 是 ${node.filePath} 对外导出的共享常量或数据对象。`;
  }
}

for (const layer of graph.layers) {
  if (layers[layer.id]) [layer.name, layer.description] = layers[layer.id];
}

for (const step of graph.tour) {
  if (tour[step.order]) [step.title, step.description] = tour[step.order];
}

const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
const edgeText = {
  imports: '导入',
  calls: '调用',
  depends_on: '依赖',
  reads_from: '读取',
  writes_to: '写入',
  documents: '记录',
  contains: '包含'
};

for (const edge of graph.edges) {
  const source = nodesById.get(edge.source)?.name || edge.source;
  const target = nodesById.get(edge.target)?.name || edge.target;
  edge.summary = `${source} ${edgeText[edge.type] || edge.type} ${target}。`;
}

fs.writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');

const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('async function init() {');
const end = html.indexOf('      document.getElementById("detail").addEventListener', start);
if (start < 0 || end < 0) {
  throw new Error('Could not find init block in understand-view.html');
}

const standalone = html.slice(0, start)
  + `async function init() {\n      state.graph = ${JSON.stringify(graph, null, 2)};\n`
  + `      document.getElementById("projectSummary").textContent = state.graph.project.description;\n`
  + `      state.graph.project.analyzedFiles = state.graph.project.analyzedFiles || 30;\n`
  + `      renderStats();\n`
  + `      renderLayers();\n`
  + `      renderTour();\n`
  + `      renderEdges();\n`
  + html.slice(end)
    .replace('请通过项目本地服务器打开本页，而不是直接双击 HTML 文件。', '这是单文件版本，若仍失败请刷新页面。');

fs.writeFileSync(standalonePath, standalone, 'utf8');

console.log(JSON.stringify({
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  layers: graph.layers.length,
  tourSteps: graph.tour.length
}, null, 2));
