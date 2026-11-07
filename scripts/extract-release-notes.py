#!/usr/bin/env python3
"""Extract only the matching top-level numeric release chapter; fail closed."""
import argparse
import json
import re
from pathlib import Path


def extract(text, version):
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Expected a numeric release version')
    headings = list(re.finditer(r'^# +([^\n]+)\n?', text, re.M))
    matches = [(i, h) for i, h in enumerate(headings) if re.match(r'v?' + re.escape(version) + r'(?=$|[\s（(])', h.group(1))]
    if len(matches) != 1:
        raise ValueError('Expected exactly one matching release chapter')
    index, heading = matches[0]
    end = headings[index + 1].start() if index + 1 < len(headings) else len(text)
    body = text[heading.end():end].strip()
    if not body:
        raise ValueError('Release chapter is empty')
    return text[heading.start():heading.end()].rstrip() + '\n\n' + body + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--version')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    version = args.version or json.loads((root / 'package.json').read_text())['version']
    args.output.write_text(extract((root / 'docs/release-notes.md').read_text(), version))
