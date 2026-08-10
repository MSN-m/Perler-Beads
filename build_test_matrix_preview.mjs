import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const outputDir = '/Users/msn/Documents/GitHub/Perler-Beads/outputs/algorithm-test-preview';
await fs.mkdir(outputDir, { recursive: true });

const wb = Workbook.create();
const sheet = wb.worksheets.add('测试矩阵预览');
sheet.showGridLines = false;

const navy = '#172033';
const pink = '#E85D8E';
const palePink = '#FCE7F3';
const slate = '#475569';
const line = '#D9E1EA';
const paleBlue = '#F1F5F9';
const paleGreen = '#ECFDF5';
const paleAmber = '#FFFBEB';
const paleRed = '#FEF2F2';

sheet.mergeCells('A1:E1');
sheet.getRange('A1').values = [['Perler Beads · 生成策略测试矩阵（样式预览）']];
sheet.getRange('A1:E1').format = { fill: navy, font: { color: '#FFFFFF', bold: true, size: 16 }, horizontalAlignment: 'left', verticalAlignment: 'center' };
sheet.getRange('A1:E1').format.rowHeight = 32;

sheet.mergeCells('A2:E2');
sheet.getRange('A2').values = [['同一图片风格下比较 8 种生成策略；每个交叉点放置结果截图，并填写 1–3 级适配度评分。']];
sheet.getRange('A2:E2').format = { fill: '#F8FAFC', font: { color: slate, italic: true, size: 10 }, horizontalAlignment: 'left', verticalAlignment: 'center', wrapText: true };
sheet.getRange('A2:E2').format.rowHeight = 28;

const styles = ['人物头像', '动物 / 宠物', '风景 / 建筑', '插画 / 游戏'];
const strategies = [
  ['原版算法', '区域平均采样与最近色匹配'],
  ['高精度采样', '中心加权采样，减少单格取色误差'],
  ['边缘感知采样', '优先保护轮廓和颜色突变区域'],
  ['主体与背景分离', '分别处理主体、背景和透明区域'],
  ['全局颜色优化', '从整张图统一规划颜色使用'],
  ['结构化抖动', '优化渐变过渡，减少条纹与棋盘格'],
  ['形状优先生成', '先确定轮廓，再填充内部颜色'],
  ['可制作性优化', '减少孤立点和断裂结构，方便实际拼制'],
];

sheet.getRange('A4:E4').values = [['生成策略', ...styles]];
sheet.getRange('A4:E4').format = { fill: pink, font: { color: '#FFFFFF', bold: true }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true, borders: { preset: 'all', style: 'thin', color: '#FFFFFF' } };
sheet.getRange('A4:E4').format.rowHeight = 28;

const matrix = strategies.map(([name, desc]) => [name, ...styles.map(() => '截图占位\n评分：— / 3')]);
sheet.getRange('A5:E12').values = matrix;
sheet.getRange('A5:A12').format = { fill: paleBlue, font: { bold: true, color: navy }, horizontalAlignment: 'left', verticalAlignment: 'center', wrapText: true, borders: { preset: 'all', style: 'thin', color: line } };
sheet.getRange('B5:E12').format = { fill: '#FFFFFF', font: { color: '#94A3B8', italic: true, size: 10 }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true, borders: { preset: 'all', style: 'thin', color: line } };
sheet.getRange('A5:E12').format.rowHeight = 62;

sheet.mergeCells('A14:E14');
sheet.getRange('A14').values = [['评分规则']];
sheet.getRange('A14:E14').format = { fill: navy, font: { color: '#FFFFFF', bold: true }, horizontalAlignment: 'left', verticalAlignment: 'center' };
sheet.getRange('A15:E17').values = [
  ['3 分', '高度适配', '主体清晰、颜色关系准确、边缘稳定，适合实际拼制', '', ''],
  ['2 分', '基本适配', '整体可识别，但细节、渐变或边缘存在明显损失', '', ''],
  ['1 分', '不适配', '主体失真、颜色混乱或结构断裂，不建议采用', '', ''],
];
sheet.getRange('A15:C17').format = { borders: { preset: 'all', style: 'thin', color: line }, verticalAlignment: 'center', wrapText: true };
sheet.getRange('A15:A17').format.font = { bold: true, color: navy };
sheet.getRange('A15:C15').format.fill = paleGreen;
sheet.getRange('A16:C16').format.fill = paleAmber;
sheet.getRange('A17:C17').format.fill = paleRed;
sheet.getRange('A15:E17').format.rowHeight = 28;

sheet.mergeCells('A19:E19');
sheet.getRange('A19').values = [['录入提示：将每个交叉点的“截图占位”替换为对应生成结果截图，并把“—”改为 1、2 或 3。']];
sheet.getRange('A19:E19').format = { fill: palePink, font: { color: '#9D174D', bold: true, size: 10 }, horizontalAlignment: 'left', verticalAlignment: 'center', wrapText: true };
sheet.getRange('A19:E19').format.rowHeight = 30;

sheet.getRange('B5:E12').dataValidation = { rule: { type: 'list', values: [1, 2, 3] } };
sheet.freezePanes.freezeRows(4);
sheet.freezePanes.freezeColumns(1);

sheet.getRange('A:A').format.columnWidth = 22;
sheet.getRange('B:E').format.columnWidth = 24;

const check = await wb.inspect({ kind: 'table', range: '测试矩阵预览!A1:E19', include: 'values,formulas', tableMaxRows: 25, tableMaxCols: 8, maxChars: 5000 });
console.log(check.ndjson);
const preview = await wb.render({ sheetName: '测试矩阵预览', range: 'A1:E19', scale: 1.5, format: 'png' });
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(`${outputDir}/algorithm-test-matrix-preview.xlsx`);
console.log(`${outputDir}/algorithm-test-matrix-preview.xlsx`);
