#!/usr/bin/env python3
"""Builds next/index.html: the registry page, unchanged, fed from the database.
usage: build_next.py TEMPLATE FONTS_CSS ART_JSON [--test TESTDATA.json]
No fleet data is ever written into the output (--test is for local screenshots only)."""
import sys, json, re, os
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
tpl, fonts, art = sys.argv[1:4]
test = sys.argv[sys.argv.index('--test') + 1] if '--test' in sys.argv else None
T = open(tpl, encoding='utf-8').read()
i = T.index('<script>\nconst R = '); j = T.index('</script>', i)
head, js, tail = T[:i], T[i + len('<script>\n'):j], T[j + len('</script>'):]
head = head.replace('/*__FONTS__*/', open(fonts, encoding='utf-8').read())
# the data line now reads what the database gave us
k = js.index('const el = ')
js = ('const R = APPDATA.R, M = APPDATA.M, F = APPDATA.F, ICONS = ICONS_DATA, FINES = APPDATA.FINES,\n'
      '      PPL = APPDATA.PPL, HIRE = APPDATA.HIRE, LOGO = "assets/logo.png", VERSION = "live";\n\n') + js[k:]
assert '</script' not in js
boot = open(os.path.join(here, 'boot.js'), encoding='utf-8').read()
gate = open(os.path.join(here, 'gate.html'), encoding='utf-8').read()
os.makedirs(os.path.join(root, 'next'), exist_ok=True)
open(os.path.join(root, 'next', 'icons.js'), 'w').write('window.ICONS_DATA=' + open(art).read().strip() + ';')
out = head + gate + '\n<script type="text/plain" id="pagejs">\n' + js + '\n</script>\n'
out += '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>\n'
os.system(f'cp {here}/geo.js {root}/next/geo.js')
out += ('<script src="testdata.js"></script>\n' if test else '') + '<script src="geo.js"></script>\n' + '<script src="icons.js"></script>\n<script src="appdata.js"></script>\n<script>\n' + boot + '\n</script>\n' + tail
open(os.path.join(root, 'next', 'index.html'), 'w', encoding='utf-8').write(out)
open(os.path.join(root, 'next', 'appdata.js'), 'w').write(open(os.path.join(here, 'appdata.js')).read())
os.makedirs(os.path.join(root, 'next', 'assets'), exist_ok=True)
os.system(f'cp {root}/assets/logo.png {root}/next/assets/logo.png')
if test:
    open(os.path.join(root, 'next', 'testdata.js'), 'w').write('window.TESTDATA=' + open(test).read() + ';')
print('next/index.html', len(out) // 1024, 'KB')
