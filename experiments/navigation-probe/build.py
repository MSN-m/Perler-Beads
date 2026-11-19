#!/usr/bin/env python3
"""Build two isolated diagnostics; the multi-page package is experimental only."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import hashlib
import json
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
OUTPUT = ROOT / 'outputs/back-button-test'
AUDIT = ROOT / '.codex/skills/minitool-zip-builder/scripts/audit_artifact.py'

class Resources(HTMLParser):
    def __init__(self, folder):
        super().__init__()
        self.folder = folder

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if any(key.startswith('on') for key in attributes):
            raise ValueError('Inline events are forbidden')
        if tag == 'script' and not attributes.get('src'):
            raise ValueError('Inline scripts are forbidden')
        for key in ('src', 'href'):
            value = attributes.get(key)
            if not value:
                continue
            parsed = urlsplit(value)
            if parsed.scheme or value.startswith('/') or '..' in Path(parsed.path).parts:
                raise ValueError('Only package-local paths are allowed: ' + value)
            if parsed.path and not (self.folder / parsed.path).is_file():
                raise ValueError('Missing package file: ' + value)

def main():
    if OUTPUT.exists():
        raise SystemExit('Output already exists; choose a fresh directory rather than overwrite it.')
    OUTPUT.mkdir()
    results = []
    for name, label in [('single', '01-标准返回测试-A和B.zip'), ('multi', '02-多页返回实验-C.zip')]:
        folder = OUTPUT / name
        shutil.copytree(SOURCE / name, folder)
        for file in ['app.js', 'styles.css']:
            shutil.copy2(SOURCE / file, folder / file)
        for html in folder.glob('*.html'):
            Resources(folder).feed(html.read_text())
        subprocess.run(['python3', str(AUDIT), str(folder)], check=True)
        archive = OUTPUT / label
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
            for file in sorted(folder.iterdir()):
                if file.suffix not in {'.html', '.js', '.css'}:
                    raise ValueError('Unexpected diagnostic file')
                zipped.write(file, file.name)
        with zipfile.ZipFile(archive) as zipped:
            assert zipped.testzip() is None
            assert zipped.namelist().count('index.html') == 1
            assert len([name for name in zipped.namelist() if name.endswith('.html')]) == (1 if name == 'single' else 2)
        subprocess.run(['python3', str(AUDIT), str(archive)], check=True)
        results.append({
            'file': str(archive), 'bytes': archive.stat().st_size,
            'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
            'status': 'single-page diagnostic' if name == 'single' else 'EXPERIMENT: not a conforming single-page release',
        })
    (OUTPUT / 'packages.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
