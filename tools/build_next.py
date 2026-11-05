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
EDITJS += open(os.path.join(here, "editsite.js"), encoding="utf-8").read()
EDITJS += open(os.path.join(here, "editpaper.js"), encoding="utf-8").read()
EDITJS += open(os.path.join(here, "edithist.js"), encoding="utf-8").read() + open(os.path.join(here, "back.js"), encoding="utf-8").read()
js = js.replace(a, DIESEL + EDITJS + a, 1).replace("${servicePanel(v)}\n    ${accidentPanel(v)}", "${servicePanel(v)}\n    ${dieselPanel(v)}\n    ${accidentPanel(v)}", 1)
o1 = '<span class="note">newest first &middot; the one on it today is at the top</span></div>'
assert o1 in js
js = js.replace(o1, '<span class="note">newest first &middot; the one on it today is at the top</span>${changeBtn(v)}</div>', 1)
o2 = '<span class="wtag">none on record</span></div>\n      <p class="sm" style="margin:0">No driver on the BOARD'
assert o2 in js
js = js.replace(o2, '<span class="wtag">none on record</span>${changeBtn(v)}</div>\n      <p class="sm" style="margin:0">No driver on the BOARD', 1)
o3 = "${driverLogPanel(v)}"
assert js.count(o3) == 1
js = js.replace(o3, o3 + "\n    ${sitesPanel(v)}", 1)
o4 = '<div class="d">${fmt.format(parse(d.v))}</div><div class="left">${word}</div></div>`;'
assert o4 in js
js = js.replace(o4, '<div class="d">${fmt.format(parse(d.v))}</div><div class="left">${word}</div>${renewBtn(d)}</div>`;', 1)
o5 = '<div class="d">${esc(LBL[s][0])}</div><div class="left sm">${LBL[s][1]}</div></div>`;'
assert o5 in js
js = js.replace(o5, '<div class="d">${esc(LBL[s][0])}</div><div class="left sm">${LBL[s][1]}</div>${renewBtn(d)}</div>`;', 1)
o6 = "  function renderCard(plate){\n    const v = V[plate];"
assert o6 in js
js = js.replace(o6, "  function renderCard(plate){\n    window.__curPlate = plate;\n    const v = V[plate];", 1)
o7 = '<th class="n">Time on it</th><th>Note</th></tr></thead>'
assert js.count(o7) == 1
js = js.replace(o7, '<th class="n">Time on it</th><th>Note</th>${histTh()}</tr></thead>', 1)
o8 = '<td class="sm">${r.note?esc(r.note):\'\'}</td></tr>`).join(\'\')}\n        </tbody></table></div>\n    </div>`;\n  }\n\n\n  function dieselPanel'
o8 = "<td class=\"sm\">${r.note?esc(r.note):''}</td></tr>`).join('')}\n        </tbody></table></div>\n    </div>`;\n  }\n\n\n  function dieselPanel"
assert js.count(o8) == 1, js.count(o8)
js = js.replace(o8, o8.replace("</td></tr>`", "</td>${histTd('driver', r, v.plate)}</tr>`"), 1)
o9 = "    ${tagRows.length?`<div class=\"panel\">"
assert js.count(o9) == 1
js = js.replace(o9, "    ${paperHistPanel(v)}\n" + o9, 1)
HOME = open(os.path.join(here, "home.js"), encoding="utf-8").read()
o10 = "/* ============================= tabs ============================= */\nel('cntRenew')"
assert js.count(o10) == 1
js = js.replace(o10, "/* ============================= tabs ============================= */\n" + HOME + "el('cntRenew')", 1)
o11 = "lists:['tabLists','pgLists']};"
assert js.count(o11) == 1
js = js.replace(o11, "lists:['tabLists','pgLists'], home:['tabHome','pgHome']};", 1)
o12 = "  if(h === 'lists' || h.startsWith('lists/'))"
assert js.count(o12) == 1
js = js.replace(o12, "  if((h === '' || h === 'home') && window.MYROLE === 'admin'){ show('home', false); renderHome(); return; }\n" + o12, 1)
o13 = '<nav class="rail" role="tablist" aria-label="Sections">'
assert head.count(o13) == 1
head = head.replace(o13, o13 + '\n    <button role="tab" id="tabHome" aria-selected="false" aria-controls="pgHome" style="display:none">\n      <svg viewBox="0 0 17 17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8 8.5 3 14.5 8M4 7v7h9V7"/></svg>\n      Home</button>', 1)
o14 = '<section id="pgFleet" role="tabpanel">'
assert head.count(o14) == 1
head = head.replace(o14, '<section id="pgHome" role="tabpanel" hidden><div id="homeBody"></div></section>\n\n' + o14, 1)
o15 = "    el('fCard').innerHTML = `\n    <div class=\"crumb\"><a data-f=\"home\">Fleet</a><span>&rsaquo;</span>\n      <a data-f=\"list\" data-cls=\"${esc(v.cls)}\">"
assert js.count(o15) == 1
js = js.replace(o15, "    el('fCard').innerHTML = `\n    <p style=\"margin:0 0 10px\"><a class=\"btn\" data-f=\"list\" data-back=\"1\" data-cls=\"${esc(v.cls)}\">&larr; Back to ${esc(v.cls)}</a></p>\n    <div class=\"crumb\"><a data-f=\"home\">Fleet</a><span>&rsaquo;</span>\n      <a data-f=\"list\" data-cls=\"${esc(v.cls)}\">", 1)
CARDJS = open(os.path.join(here, "cardlayout.js"), encoding="utf-8").read()
o16 = "  function renderCard(plate){\n    window.__curPlate = plate;"
assert js.count(o16) == 1
js = js.replace(o16, CARDJS + "  function renderCardOld(plate){\n    window.__curPlate = plate;", 1)
CARDCSS = open(os.path.join(here, "cardlayout.css"), encoding="utf-8").read()
k = head.rfind("</style>")
head = head[:k] + CARDCSS + head[k:]
# dark mode: --navy turns almost black, so text that used it vanished (Lists numbers etc.). --brand is the same navy in light mode and light blue in dark.
for o in ["#pgLists .lcard .big{font-size:27px;font-weight:700;color:var(--navy)", ".rail .hub{color:var(--navy)", "letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--navy)}"]:
    assert head.count(o) == 1, o
    head = head.replace(o, o.replace("color:var(--navy)", "color:var(--brand)"), 1)
o = "h2{font-size:17px;font-weight:600;margin:34px 0 8px;color:var(--navy)"
assert head.count(o) == 1
head = head.replace(o, o.replace("color:var(--navy)", "color:var(--brand)"), 1)
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
os.system(f'cp {here}/xlsx.js {root}/next/xlsx.js')
out += ('<script src="testdata.js"></script>\n' if test else '') + '<script src="geo.js"></script>\n' + '<script src="icons.js"></script>\n<script src="appdata.js"></script>\n<script>\n' + boot + '\n</script>\n' + tail
open(os.path.join(root, 'next', 'index.html'), 'w', encoding='utf-8').write(out)
open(os.path.join(root, 'next', 'appdata.js'), 'w').write(open(os.path.join(here, 'appdata.js')).read())
os.makedirs(os.path.join(root, 'next', 'assets'), exist_ok=True)
os.system(f'cp {root}/assets/logo.png {root}/next/assets/logo.png')
if test:
    open(os.path.join(root, 'next', 'testdata.js'), 'w').write('window.TESTDATA=' + open(test).read() + ';')
print('next/index.html', len(out) // 1024, 'KB')
