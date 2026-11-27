"""Validate the MiniTool example catalog and emit on-demand classic scripts."""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / 'assets/data/minitool-examples'


def read_groups(library=LIBRARY):
    catalog = json.loads((library / 'catalog.json').read_text())
    groups = catalog.get('groups', [])
    if not groups:
        groups = [{'id': 'all', 'title': '示例图纸', 'defaultOpen': True,
                   'patterns': catalog.get('patterns', []), 'ungrouped': True}]
    if sum(group.get('defaultOpen') is True for group in groups) != 1:
        raise ValueError('Exactly one example group must have defaultOpen: true')
    seen = set()
    result = []
    for group in groups:
        key = group['id']
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', key) or key in seen:
            raise ValueError('Invalid or duplicate group id: ' + key)
        seen.add(key)
        if not isinstance(group['title'], str) or not group['title'].strip():
            raise ValueError('Group title cannot be empty')
        records = []
        files = group['patterns']
        if not isinstance(files, list) or not files or len(set(files)) != len(files):
            raise ValueError('Group patterns must be a nonempty list of unique paths')
        for name in files:
            path = (library / name).resolve()
            if library.resolve() not in path.parents or path.suffix != '.json':
                raise ValueError('Pattern must be a JSON file inside the library: ' + name)
            record = json.loads(path.read_text())
            width, height = record['gridWidth'], record['gridHeight']
            if any(type(n) is not int or n < 1 for n in (width, height)):
                raise ValueError('Invalid grid size: ' + name)
            if not isinstance(record['name'], str):
                raise ValueError('Invalid pattern name: ' + name)
            colors, indices = record['colors'], record['indices']
            if not colors or any(not isinstance(c, list) or len(c) != 4 or
                                 not isinstance(c[0], str) or
                                 any(type(v) is not int or not 0 <= v <= 255 for v in c[1:]) for c in colors):
                raise ValueError('Invalid palette: ' + name)
            if len(indices) != width * height or any(type(i) is not int or not 0 <= i < len(colors) for i in indices):
                raise ValueError('Invalid grid indices: ' + name)
            # Whitelist only current pattern fields; never ship source images or history.
            records.append({key: record[key] for key in
                            ('name', 'gridWidth', 'gridHeight', 'brand', 'mardSet', 'colors', 'indices')})
        result.append((group, records))
    return result


def emit_groups(output, library=LIBRARY):
    manifest = []
    for group, records in read_groups(library):
        relative = 'assets/example-groups/' + group['id'] + '.js'
        path = output / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        data = json.dumps(records, ensure_ascii=True, separators=(',', ':'))
        path.write_text('window.__perlerReceiveExampleGroup(' + json.dumps(group['id']) + ',' + data + ');\n')
        manifest.append({'id': group['id'], 'title': group['title'], 'count': len(records),
                         'defaultOpen': group.get('defaultOpen') is True, 'ungrouped': group.get('ungrouped') is True, 'src': './' + relative})
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Emit group scripts for preview, without creating a ZIP')
    args = parser.parse_args()
    groups = emit_groups(args.output) if args.output else [
        {'id': group['id'], 'title': group['title'], 'count': len(records)}
        for group, records in read_groups()]
    print(json.dumps(groups, ensure_ascii=False, indent=2))
