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
# diesel panel on the vehicle card (new in the app; the old registry had none)
DIESEL = r"""
  function dieselPanel(v){
    const rows = v.diesel || [];
    if(!rows.length) return '';
    const mon = (d)=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    const lit = (n)=>n===null||n===undefined?'<span class="dash">—</span>':NUM.format(Math.round(n))+'<span class="sm"> L</span>';
    const total = rows.reduce((a,r)=>a+(r.l||0),0);
    return `<div class="panel">
      <div class="ph"><h3>Diesel</h3>
        <span class="pill p-ok">${new Set(rows.map(r=>r.f)).size} month${new Set(rows.map(r=>r.f)).size>1?'s':''} on record</span>
        <span class="note">${NUM.format(Math.round(total))} L in total</span></div>
      <div class="scroll"><table>
        <thead><tr><th>Month</th><th>Project</th><th class="n">Litres</th><th class="n">Hours</th><th class="n">L / hour</th></tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td class="id"><b>${esc(mon(r.f))}</b></td>
          <td class="sm">${r.p?esc(r.p):'<span class="dash">—</span>'}</td>
          <td class="n">${lit(r.l)}</td>
          <td class="n">${r.h?NUM.format(r.h)+'<span class="sm"> h</span>':'<span class="dash">—</span>'}</td>
          <td class="n">${r.h&&r.l?(r.l/r.h).toFixed(1):'<span class="dash">—</span>'}</td></tr>`).join('')}
        </tbody></table></div></div>`;
  }

"""
a = "  function templates(v){"
assert a in js and "${servicePanel(v)}\n    ${accidentPanel(v)}" in js
EDITJS = open(os.path.join(here, "editdriver.js"), encoding="utf-8").read()
js = js.replace(a, DIESEL + EDITJS + a, 1).replace("${servicePanel(v)}\n    ${accidentPanel(v)}", "${servicePanel(v)}\n    ${dieselPanel(v)}\n    ${accidentPanel(v)}", 1)
o1 = '<span class="note">newest first &middot; the one on it today is at the top</span></div>'
assert o1 in js
js = js.replace(o1, '<span class="note">newest first &middot; the one on it today is at the top</span>${changeBtn(v)}</div>', 1)
o2 = '<span class="wtag">none on record</span></div>\n      <p class="sm" style="margin:0">No driver on the BOARD'
assert o2 in js
js = js.replace(o2, '<span class="wtag">none on record</span>${changeBtn(v)}</div>\n      <p class="sm" style="margin:0">No driver on the BOARD', 1)
# log notes are Aiyas's own; they are not shown on the vehicle cards (4 Nov)
a = "${v.log && v.log.length ? `<div class=\"panel\">"
assert a in js
js = js.replace(a, "${false ? `<div class=\"panel\">", 1)
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
