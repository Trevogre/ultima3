"""Fetch the pinned CC0 source subset for prepare-orchestra.py.
Usage: python3 web/tools/fetch-orchestra.py /tmp/ultima3-vsco-source
Development only. Game/build/offline playback never contact this host.
"""
from pathlib import Path
import hashlib
import json
import sys
import urllib.parse
import urllib.request
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'public/music/orchestra/manifest.json').read_text())
out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
paths = {s['id']: s['source'] for s in manifest['samples']}
for name, path in {**paths, 'LICENSE': 'LICENSE', 'Readme.txt': 'Readme.txt'}.items():
    url = f"https://raw.githubusercontent.com/sgossner/VSCO-2-CE/{manifest['revision']}/{urllib.parse.quote(path)}"
    data = urllib.request.urlopen(url, timeout=60).read()
    if name in paths:
        expected = next(s['sourceSha256'] for s in manifest['samples'] if s['id'] == name)
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f'Source hash mismatch: {name}')
    (out / (name + '.wav' if name in paths else name)).write_bytes(data)
(out / 'sources.json').write_text(json.dumps({'revision': manifest['revision'], 'paths': paths}, indent=2)+'\n')
