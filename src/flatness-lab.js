import { PALETTES } from './constants.js';
// 查询参数避免实验页复用其他页面缓存的旧 processor 模块。
import { generatePatternData, generatePatternDataProtected } from './processor.js?flatness-lab-v=2';

const $ = id => document.getElementById(id);
let sourceImageData = null;

function getSettings() {
    const maxSide = Math.max(16, Math.min(104, Number($('flat-grid-size').value) || 64));
    const ratio = sourceImageData ? sourceImageData.width / Math.max(1, sourceImageData.height) : 1;
    return { gridWidth: ratio >= 1 ? maxSide : Math.max(16, Math.round(maxSide * ratio)), gridHeight: ratio >= 1 ? Math.max(16, Math.round(maxSide / ratio)) : maxSide, brand: $('flat-brand').value, maxColors: Math.max(4, Number($('flat-max-colors').value) || 12) };
}

function draw(canvas, pixels, width, height) {
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); const imageData = ctx.createImageData(width, height);
    pixels.forEach((pixel, i) => { const o = i * 4; imageData.data[o] = pixel.r; imageData.data[o + 1] = pixel.g; imageData.data[o + 2] = pixel.b; imageData.data[o + 3] = pixel.a ?? 255; });
    ctx.putImageData(imageData, 0, 0);
}

function stats(pixels) { return { colors: new Set(pixels.filter(p => p.id !== 'NONE').map(p => p.id)).size, beads: pixels.filter(p => p.id !== 'NONE').length }; }
function updateStats(id, pixels, elapsed) { const s = stats(pixels); $(id).innerHTML = `<span>颜色<br><b class="text-slate-700">${s.colors}</b></span><span>豆数<br><b class="text-slate-700">${s.beads}</b></span><span>耗时<br><b class="text-slate-700">${elapsed}ms</b></span>`; }
function readNumber(id) { return Number($(id).value); }
function syncOutputs() { [['flat-subject','flat-subject-output'],['flat-edge','flat-edge-output'],['flat-detail','flat-detail-output'],['flat-color','flat-color-output'],['flat-continuity','flat-continuity-output']].forEach(([input, output]) => { $(output).value = Number($(input).value).toFixed(2); }); }

async function generate() {
    if (!sourceImageData) return;
    const settings = getSettings(); const palette = PALETTES[settings.brand] || PALETTES.mard;
    $('flat-generate-btn').disabled = true; $('flat-status').textContent = '正在生成对比结果...';
    let started = performance.now();
    const current = generatePatternData({ sourceImageData, ...settings, mardSet: '221', isColorLimitEnabled: true, isDitheringEnabled: false, precisionMode: 'standard', colorMatchMode: 'redmean', palettes: PALETTES });
    draw($('flat-current-canvas'), current, settings.gridWidth, settings.gridHeight); $('flat-current-empty').classList.add('hidden'); updateStats('flat-current-stats', current, Math.round(performance.now() - started));
    started = performance.now();
    const protectedPixels = generatePatternDataProtected({ sourceImageData, ...settings, mardSet: '221', isColorLimitEnabled: true, subjectThreshold: readNumber('flat-subject'), edgeStrength: readNumber('flat-edge'), detailStrength: readNumber('flat-detail'), colorWeight: readNumber('flat-color'), continuityWeight: readNumber('flat-continuity'), palettes: PALETTES });
    draw($('flat-protected-canvas'), protectedPixels, settings.gridWidth, settings.gridHeight); $('flat-protected-empty').classList.add('hidden'); updateStats('flat-protected-stats', protectedPixels, Math.round(performance.now() - started));
    $('flat-generate-btn').disabled = false; $('flat-status').textContent = '生成完成，可调整参数后再次生成。';
}

$('flat-image-input').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
        const image = await createImageBitmap(file); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); sourceImageData = ctx.getImageData(0, 0, image.width, image.height); $('flat-generate-btn').disabled = false; $('flat-status').textContent = '图片已载入，可以生成对比结果。';
    } catch (error) {
        sourceImageData = null; $('flat-generate-btn').disabled = true; $('flat-status').textContent = '图片读取失败，请重新选择图片。'; console.error(error);
    }
});
['flat-subject','flat-edge','flat-detail','flat-color','flat-continuity'].forEach(id => $(id).addEventListener('input', syncOutputs));
$('flat-generate-btn').addEventListener('click', () => generate().catch(error => {
    $('flat-generate-btn').disabled = false;
    $('flat-status').textContent = '生成失败，请检查图片或参数后重试。';
    console.error(error);
})); syncOutputs();
