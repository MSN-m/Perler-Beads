#!/usr/bin/env python3
"""Build an isolated native MiniTool artifact from the formal workbench sources.

Build tools live outside the project. Supply pinned esbuild 0.25.12, Node 22+
and lightningcss 1.30.2 paths; none is shipped or used at runtime.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile
from html.parser import HTMLParser
from urllib.parse import urlsplit
from minitool_examples import emit_groups

ROOT = Path(__file__).resolve().parents[1]
TOOLS = Path('/private/tmp/perler-minitool-build-tools')

def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise RuntimeError('Source changed; review the MiniTool adapter: ' + label)
    return text.replace(old, new, 1)

def replace_function(text, name, replacement):
    match = re.search(r'^(?:export )?(?:async )?function ' + re.escape(name) + r'\([^\n]*\{', text, re.M)
    if not match:
        raise RuntimeError('Function not found: ' + name)
    # These audited top-level functions end at a column-zero closing brace.
    end = text.index('\n}', match.end()) + 2
    return text[:match.start()] + replacement + text[end:]

def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.replace('\r\n', '\n').replace('\n', '\r\n').encode())

def stage_sources(stage, example_groups):
    shutil.copytree(ROOT / 'src', stage / 'src')
    for path in (stage / 'src').rglob('*.js'):
        text = path.read_text()
        text = re.sub(r"((?:from|import)\s*['\"][^'\"]+)\?v=[^'\"]+(['\"])", r'\1\2', text)
        write(path, text)
    ui = stage / 'src/ui.js'
    text = ui.read_text()
    text = "import { miniToolStore } from './platform/minitool/storage.js';\n" + text
    text = replace_function(text, 'openDraftsDb', '')
    text = replace_function(text, 'loadWorkbenchDrafts', '''async function loadWorkbenchDrafts() {
    try {
        const drafts = await miniToolStore.list();
        AppState.autoSaves = drafts.filter(item => item.kind === 'autosave').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        AppState.drafts = drafts.filter(item => item.kind !== 'autosave' && item.kind !== 'setup-recovery').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        document.getElementById('minitool-storage-status').hidden = true;
    } catch (error) {
        console.warn('Native draft read failed.', error);
        const status = document.getElementById('minitool-storage-status');
        status.textContent = error.message || '草稿读取失败，请退出后重试；当前图纸仍可继续编辑。';
        status.hidden = false;
        throw error;
    }
}''')
    text = replace_function(text, 'upsertWorkbenchDraft', 'async function upsertWorkbenchDraft(draft) { await miniToolStore.put(draft); }')
    text = replace_function(text, 'removeWorkbenchDraftFromDb', 'async function removeWorkbenchDraftFromDb(id) { await miniToolStore.remove(id); }')
    text = replace_function(text, 'downloadJsonFile', "function downloadJsonFile() { throw new Error('小工具不提供草稿文件下载。'); }")
    text = replace_once(text, "worker = new Worker(new URL('./features/pixel-art-detection-worker.js?v=20261116-preview-first', import.meta.url), { type: 'module' });", "if (miniToolStore.clientVersion < 9530 || typeof Worker !== 'function') throw new Error('Worker unavailable');\n        worker = new Worker('./pixel-worker.js');\n        if (typeof worker.onTerminate === 'function') worker.onTerminate(reason => { if (reason === 'system') fallback(); });", 'classic worker')
    text = replace_once(text, 'worker.postMessage({ data, width, height }, [data.buffer]);', 'worker.postMessage({ data, width, height });', 'retain detection source for fallback')
    text, cursor_count = re.subn(r"new URL\('(?:\.\./)(assets/[^']+)', import.meta.url\)\.href", lambda match: repr('./' + match[1].split('?')[0]), text)
    if cursor_count != 8: raise RuntimeError('Review cursor asset paths')
    # A failed native read must remain an error; UI callers may retry and must not overwrite unseen drafts.
    text = replace_once(text, 'const workbenchDraftsReady = loadWorkbenchDrafts().then(() => {', 'let nativeDraftReadError = null;\nconst workbenchDraftsReady = loadWorkbenchDrafts().catch(error => { nativeDraftReadError = error; }).then(() => {', 'draft readiness')
    text = text.replace('await workbenchDraftsReady;', 'await workbenchDraftsReady;\n    if (nativeDraftReadError) { await loadWorkbenchDrafts(); nativeDraftReadError = null; }')
    # An intentionally empty title is a valid saved value, not a missing legacy field.
    text = replace_once(text, "String(draft.patternName || draft.name || '').trim()", "String(draft.patternName ?? draft.name ?? '').trim()", 'unnamed saved diagram dirty check')
    text = text.replace("draft.patternName || draft.name || ''", "draft.patternName ?? draft.name ?? ''")
    text = "import { isMiniToolHomeViewport } from './platform/minitool/home-layout.js';\n" + text
    text = replace_once(text, 'if (!isWorkbenchMobileLayout() || AppState.image || hasWorkbenchPattern() || AppState.draftRestorePending) return false;', 'if (!isMiniToolHomeViewport() || AppState.image || hasWorkbenchPattern() || AppState.draftRestorePending) return false;', 'tablet home example entry')
    text = replace_once(text, 'const showMobileHome = isMobile && !hasPattern && !hasImage;', 'const showMobileHome = isMiniToolHomeViewport() && !hasPattern && !hasImage;', 'native tablet home visibility')
    # Reuse phone upload semantics only for the native tablet upload surface.
    text = replace_once(text, 'return isWorkbenchMobileLayout() && Boolean(AppState.image) && !hasWorkbenchPattern();', 'return isMiniToolHomeViewport() && Boolean(AppState.image) && !hasWorkbenchPattern();', 'tablet upload controls')
    text = replace_once(text, 'const mobileUploadSetup = isMobile && hasImage && !hasPattern;', 'const mobileUploadSetup = isMobileUploadSetup();', 'tablet upload UI state')
    text = replace_once(text, 'layout.dataset.mobileStep = isMobile && hasImage && !hasPattern ? \'upload\' : \'\';', 'layout.dataset.mobileStep = isMobile && hasImage && !hasPattern ? \'upload\' : \'\';\n    layout.toggleAttribute(\'data-minitool-upload\', !isMobile && isMiniToolHomeViewport() && hasImage && !hasPattern);', 'tablet upload layout marker')
    text = replace_once(text, "if (patternSettings) patternSettings.hidden = !active || mobileUploadTab !== 'pattern';", "if (patternSettings) patternSettings.hidden = !active || (isWorkbenchMobileLayout() && mobileUploadTab !== 'pattern');", 'parallel tablet pattern settings')
    text = replace_once(text, "setHidden('image-adjustments-panel', mobileUploadTab !== 'image');", "setHidden('image-adjustments-panel', isWorkbenchMobileLayout() && mobileUploadTab !== 'image');", 'parallel tablet image adjustments')
    text = replace_once(text, 'const isOpen = isWorkbenchMobileLayout() && Boolean(AppState.mobileSettingsModal);', 'const isOpen = (isWorkbenchMobileLayout() || isMobileUploadSetup()) && Boolean(AppState.mobileSettingsModal);', 'tablet settings modal')
    text = replace_once(text, "if (!isWorkbenchMobileLayout() || !['name', 'scheme'].includes(type)) return false;", "if ((!isWorkbenchMobileLayout() && !isMobileUploadSetup()) || !['name', 'scheme'].includes(type)) return false;", 'tablet name and brand entry')
    # Native iPad offers the same pixel-art option as phone/desktop, retaining detection gates.
    text = replace_once(text, "const offersPixelStyle = viewportMode !== 'tablet';", "const offersPixelStyle = viewportMode !== 'tablet' || isMiniToolHomeViewport();", 'tablet pixel style grid')
    text = replace_once(text, "button.classList.toggle('hidden', viewportMode === 'tablet');", "button.classList.toggle('hidden', viewportMode === 'tablet' && !isMiniToolHomeViewport());", 'tablet pixel style visibility')
    text = text.replace("getWorkbenchViewportMode() === 'tablet' || (!AppState.patternPreviewPixelGridDetection", "(getWorkbenchViewportMode() === 'tablet' && !isMiniToolHomeViewport()) || (!AppState.patternPreviewPixelGridDetection")
    write(ui, text)
    editor = stage / 'src/editor.js'
    text = "import { miniToolStore } from './platform/minitool/storage.js';\n" + editor.read_text()
    text = replace_function(text, 'readColorSelections', 'function readColorSelections() { return miniToolStore.getColorSelections(); }')
    text = replace_once(text, 'globalThis.localStorage?.setItem(COLOR_SELECTION_KEY, JSON.stringify(Object.fromEntries(latest)));', "miniToolStore.setColorSelections(Object.fromEntries(latest)).catch(error => console.warn('最近颜色暂未持久化，当前选色保留。', error));", 'native recent colors')
    write(editor, text)
    main = stage / 'src/main.js'
    text = main.read_text()
    text = replace_once(text, "from './features/export-modal.js'", "from './platform/minitool/output.js'", 'native output modal')
    text = replace_once(text, "if (AppState.workbenchViewportMode === 'desktop') exportModal.open();", "if (true) exportModal.open();", 'native output all viewports')
    text = replace_once(text, '    installWorkbenchAutoSave();', '    // Native progress installer replaces the website five-minute timer.', 'native progress scheduling')
    write(main, text)
    exporter = stage / 'src/exporter.js'
    text = exporter.read_text()
    text, count = re.subn(r"    const link = document.createElement\('a'\);\n    link.download = getExportFilename\('[^']+'\);\n    link.href = exportCanvas.toDataURL\('image/png'\);\n    link.click\(\);", "    throw new Error('请使用保存到相册或发作品。');", text)
    if count != 3: raise RuntimeError('Review exporter download branches')
    text = replace_function(text, 'startPatternDownloads', "export function startPatternDownloads() { throw new Error('小工具不支持浏览器下载。'); }")
    write(exporter, text)
    home = stage / 'src/features/mobile-home.js'
    text = home.read_text()
    text = replace_once(text, "const response = await fetch('assets/data/mobile-home-patterns.json');\n            if (!response.ok) throw new Error(`HTTP ${response.status}`);\n            const records = await response.json();\n            records.forEach(record => renderPatternCard(grid, record, openExample));", 'installMiniToolExamples(grid, MINI_TOOL_EXAMPLE_GROUPS, openExample);', 'grouped offline examples')
    text = "import { installMiniToolExamples } from '../platform/minitool/example-library.js';\nconst MINI_TOOL_EXAMPLE_GROUPS = " + json.dumps(example_groups, ensure_ascii=True) + ';\n' + text
    text = "import { isMiniToolHomeViewport } from '../platform/minitool/home-layout.js';\n" + text
    text = text.replace("const mobileViewport = '(max-width: 767px)';", "const mobileViewport = '(max-width: 1023px), (pointer: coarse)';")
    text = replace_once(text, 'if (!viewport.matches) return;', 'if (!isMiniToolHomeViewport()) return;', 'native tablet example loading')
    write(home, text)
    drafts = stage / 'src/features/mobile-drafts.js'
    text = "import { isMiniToolHomeViewport } from '../platform/minitool/home-layout.js';\n" + drafts.read_text()
    text = replace_once(text, "window.matchMedia('(max-width: 767px)')", "window.matchMedia('(max-width: 1023px), (pointer: coarse)')", 'native draft dialog viewport')
    text = replace_once(text, 'if (!event.matches && dialog.open) dialog.close();', 'if (!isMiniToolHomeViewport() && dialog.open) dialog.close();', 'retain tablet drafts across rotation')
    write(drafts, text)
    loading = stage / 'src/features/mobile-loading.js'
    text = "import { isMiniToolHomeViewport } from '../platform/minitool/home-layout.js';\n" + loading.read_text()
    text = replace_once(text, "!window.matchMedia('(max-width: 767px)').matches", '!isMiniToolHomeViewport()', 'tablet upload and generation loading')
    write(loading, text)
    return stage / 'src'

OUTPUT_HTML = '''
<aside id="minitool-storage-status" hidden role="status"></aside>
<div id="minitool-output" hidden>
 <section role="dialog" aria-modal="true" aria-labelledby="minitool-output-title" tabindex="-1">
  <h2 id="minitool-output-title">保存与分享</h2>
  <label><input type="checkbox" value="pattern" checked>拼豆图纸</label>
  <label><input type="checkbox" value="mirrored">镜像图纸</label>
  <label><input type="checkbox" value="raw">无标注图</label>
  <div class="output-actions"><button type="button" data-destination="album">保存到相册</button><button type="button" data-destination="post">发作品</button></div>
  <p role="status" aria-live="polite"></p><button type="button" data-output-close>返回编辑</button>
 </section>
</div>
'''

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--esbuild', default=str(TOOLS / 'package/bin/esbuild'))
    parser.add_argument('--node', default=str(TOOLS / 'node-v22.16.0-darwin-arm64/bin/node'))
    parser.add_argument('--lightningcss', default=str(TOOLS / 'node_modules/lightningcss'))
    parser.add_argument('--output', default=str(ROOT / 'outputs/minitool-release'))
    parser.add_argument('--preview-only', action='store_true', help='Compile and audit a preview directory without creating a release ZIP')
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output == ROOT or ROOT not in output.parents: raise RuntimeError('Output must be a dedicated project subdirectory')
    # Never remove an existing artifact directory or user files.
    if output.exists() and any(output.iterdir()): raise RuntimeError('Choose a new/empty output directory')
    output.mkdir(parents=True, exist_ok=True)
    artifact = output / 'app'; artifact.mkdir()
    example_groups = emit_groups(artifact)
    with tempfile.TemporaryDirectory(prefix='perler-minitool-') as temp:
        stage = Path(temp)
        sources = stage_sources(stage, example_groups)
        css_input = stage / 'all.css'
        css_input.write_text('\n'.join((ROOT / file).read_text() for file in ['css/tailwind.generated.css', 'css/style.css', 'src/platform/minitool/output.css', 'src/platform/minitool/chrome.css', 'src/platform/minitool/progress.css', 'src/platform/minitool/example-library.css', 'src/platform/minitool/home-tablet.css', 'src/platform/minitool/upload-tablet.css']))
        # style.css lives in css/ in the web app; the release stylesheet is at the ZIP root.
        css_input.write_text(css_input.read_text().replace('../assets/', './assets/'))
        meta = output / 'css-compatibility.json'
        env = dict(os.environ, PERLER_LIGHTNINGCSS=args.lightningcss)
        subprocess.run([args.node, str(ROOT / 'scripts/minitool/compile-css.cjs'), str(css_input), str(artifact / 'style.css'), str(meta)], env=env, check=True)
        info = json.loads(meta.read_text())
        write(stage / 'entry.js', "import './src/platform/minitool/polyfills.js';\nimport { installMiniToolCompatibility } from './src/platform/minitool/compat.js';\nimport { installMiniToolHomeChrome } from './src/platform/minitool/home-chrome.js';\nimport { installMiniToolProgress } from './src/platform/minitool/progress.js';\nimport './src/main.js';\nimport { updateWorkbenchUI } from './src/ui.js';\nimport { installMiniToolHomeLayout } from './src/platform/minitool/home-layout.js';\ndocument.addEventListener('DOMContentLoaded', installMiniToolProgress);\ninstallMiniToolCompatibility(" + json.dumps(info['has']) + ', ' + json.dumps(info['gaps']) + ', ' + json.dumps(info['aspects']) + ');\ninstallMiniToolHomeLayout(updateWorkbenchUI);\ninstallMiniToolHomeChrome();\n')
        command = [args.esbuild, '--bundle', '--format=iife', '--target=chrome61', '--tree-shaking=true', '--minify', '--legal-comments=none', '--metafile=' + str(output / 'bundle-inputs.json')]
        subprocess.run(command + [str(stage / 'entry.js'), '--outfile=' + str(artifact / 'app.js')], check=True)
        subprocess.run([args.esbuild, str(sources / 'features/pixel-art-detection-worker.js'), '--bundle', '--format=iife', '--target=chrome61', '--minify', '--legal-comments=none', '--outfile=' + str(artifact / 'pixel-worker.js')], check=True)
    html = (ROOT / 'index.html').read_text()
    html = re.sub(r'\s*<script\b[^>]*>.*?</script>', '', html, flags=re.S)
    html = re.sub(r'\s*<link[^>]+(?:rel="manifest"|rel="stylesheet")[^>]*>', '', html)
    html = html.replace('content="width=device-width, initial-scale=1.0"', 'content="width=device-width, initial-scale=1.0, viewport-fit=cover"')
    html = html.replace('</head>', '<link rel="stylesheet" href="./style.css">\n<script defer src="./app.js"></script>\n</head>')
    html = replace_once(html, '<h1>一秒转图纸<br>一格一格改喜欢</h1>', '<h1><span>一秒转图纸</span><br><span>一格一格改喜欢</span></h1>', 'tablet homepage headline')
    html = replace_once(html, '<div id="mobile-upload-pattern-settings" hidden>', '<div id="mobile-upload-pattern-settings" hidden><h2 class="minitool-upload-settings-title">图纸设置</h2>', 'tablet settings section heading')
    for button, label in [('mobile-upload-crop-confirm', '确认'), ('mobile-upload-crop-undo', '撤回'), ('mobile-upload-crop-cancel', '取消')]:
        html, count = re.subn(r'(<button\b[^>]*id="' + button + r'"[^>]*>.*?)(</button>)', lambda match: match[1] + '<span class="minitool-crop-label">' + label + '</span>' + match[2], html, count=1, flags=re.S)
        if count != 1: raise RuntimeError('Review tablet crop button: ' + button)
    html = html.replace('</body>', OUTPUT_HTML + '\n</body>')
    # Keep old hidden views for shared DOM binding, but remove unsupported file controls.
    html = re.sub(r'<label for="import-drafts-file".*?</label>\s*<input id="import-drafts-file"[^>]*>', '', html, flags=re.S)
    html = html.replace('仅保存在当前浏览器', '仅保存在当前小工具').replace('工作台测试版', '小工具')
    write(artifact / 'index.html', html)
    for folder in ['figma-ui', 'cursors']:
        shutil.copytree(ROOT / 'assets' / folder, artifact / 'assets' / folder, ignore=shutil.ignore_patterns('.DS_Store', '*.md', '*.txt'))
    for name in ['favicon-64.png', 'apple-touch-icon.png', 'app-icon-192.png']:
        shutil.copy2(ROOT / 'assets' / name, artifact / 'assets' / name)
    licenses = (ROOT / 'assets/lucide-LICENSE.txt').read_text() + '\nTailwind CSS\n' + (ROOT / 'scripts/minitool/tailwind-LICENSE.txt').read_text()
    (artifact / 'licenses.json').write_text(json.dumps({'thirdPartyNotices': licenses}, ensure_ascii=False, indent=2))
    # This audit is an additional gate, not a replacement for semantic/device tests.
    subprocess.run(['python3', str(ROOT / '.codex/skills/minitool-zip-builder/scripts/audit_artifact.py'), str(artifact)], check=True)
    for name in ['app.js', 'pixel-worker.js']:
        text = (artifact / name).read_text()
        forbidden = [r'\bfetch\(', r'\bindexedDB\b', r'\blocalStorage\b', r'\.download\s*=', r'\beval\(', r'\bnew Function\(', r'import\.meta', r'type:"module"']
        found = [pattern for pattern in forbidden if re.search(pattern, text)]
        if found: raise RuntimeError(name + ' contains forbidden APIs: ' + ', '.join(found))
    css = (artifact / 'style.css').read_text()
    if re.search(r'@layer\b|@property\b|:has\(|:where\(', css): raise RuntimeError('CSS compatibility conversion incomplete')
    class ResourceCheck(HTMLParser):
        def handle_starttag(self, tag, attributes):
            attrs = dict(attributes)
            if tag == 'script' and not attrs.get('src'): raise RuntimeError('Inline script in release HTML')
            if any(key.startswith('on') for key in attrs): raise RuntimeError('Inline event in release HTML')
            if tag in ('script', 'link', 'img'):
                for key in ('src', 'href'):
                    if not attrs.get(key): continue
                    ref = urlsplit(attrs[key])
                    if ref.scheme in ('http', 'https'): raise RuntimeError('External release resource: ' + attrs[key])
                    if not ref.scheme and not (artifact / ref.path).exists(): raise RuntimeError('Missing release resource: ' + attrs[key])
    ResourceCheck().feed(html)
    allowed = {'.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json'}
    for file in artifact.rglob('*'):
        if file.is_file() and file.suffix.lower() not in allowed: raise RuntimeError('Unsupported release file: ' + str(file))
    if args.preview_only:
        print(json.dumps({'preview': str(artifact), 'zipCreated': False}, ensure_ascii=False))
        return
    archive = output / '小豆鸡-小红书小工具.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipout:
        for file in sorted(artifact.rglob('*')):
            if file.is_file(): zipout.write(file, file.relative_to(artifact).as_posix())
    subprocess.run(['python3', str(ROOT / '.codex/skills/minitool-zip-builder/scripts/audit_artifact.py'), str(archive)], check=True)
    manifest = {'zip': str(archive), 'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'skill': '1.11.1', 'esbuild': '0.25.12', 'lightningcss': '1.30.2', 'nativeDeviceVerification': 'pending'}
    (output / 'build-result.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
