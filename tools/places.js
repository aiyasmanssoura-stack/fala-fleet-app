/* ============================= PLACES (18 Nov 2026) =============================
   One list of places drives the map, the Change site picker, the Hired In project tiles and this page.
   kinds: permanent | current | sister | archive | none.  Admin can Archive / Restore a place or a project
   (database functions set_place_kind and set_project_status). The Home map (Admin) uses the same list. */
const PLACE_KINDS = [['permanent','Permanent places','Head quarter, yards and crushers — never closed'],
  ['current','Current projects','Where we work now'],
  ['sister','Sister company','Vehicles here are outside our fleet'],
  ['none','No map position','A status, not a place'],
  ['archive','Archive','Finished — history kept']];
function placeIsAdmin(){ return window.MYROLE === 'admin'; }
function placeFlat(list){ return list.flatMap(v => [v, ...(v.kids || [])]); }
function placeCounts(name){
  const s = (M.sites || []).find(x => x.name === name); if(!s) return {ours: 0, hired: 0, list: []};
  const all = placeFlat(s.v || []);
  return {ours: all.filter(v => !v.hired).length, hired: all.filter(v => v.hired).length, list: all};
}
function placeMachinesHtml(name){
  const c = placeCounts(name); if(!c.list.length) return '<p class="sm" style="margin:6px 0">No machines here.</p>';
  const row = v => `<tr><td class="id"><a ${v.hired ? `data-h="card" data-plate="${esc(v.plate)}"` : `data-f="card" data-plate="${esc(v.plate)}"`} style="cursor:pointer;color:var(--brand)">${esc(v.plate)}</a>${v.hired ? ' <span class="pill p-gap">hired</span>' : ''}</td>
    <td>${esc(v.type || v.cls || '')}</td><td class="sm">${esc(v.driver || '')}${v.hired && v.firm ? esc(v.firm) : ''}</td></tr>`;
  return `<div class="scroll"><table><thead><tr><th>Vehicle</th><th>Type</th><th>Driver / supplier</th></tr></thead><tbody>${c.list.map(row).join('')}</tbody></table></div>`;
}
function placeProjects(site){
  const ps = (window.APPPROJECTS || []).filter(p => p.site_id === site.id);
  const rows = (typeof HIRE !== 'undefined' && HIRE.rows) ? HIRE.rows : [];
  return ps.map(p => ({id: p.id, name: p.name, status: p.status || 'current', hired: rows.filter(r => r.proj === p.name).length}));
}
function placePanel(s){
  const admin = placeIsAdmin(), c = placeCounts(s.name), ps = placeProjects(s), k = s.kind || 'current', n = c.ours + c.hired;
  const kl = (PLACE_KINDS.find(x => x[0] === k) || [k, k])[1];
  const btn = admin ? (k === 'archive'
    ? `<button type="button" class="btn" data-pl="kind" data-id="${s.id}" data-to="current">Restore place</button>`
    : (k === 'current' ? `<button type="button" class="btn" data-pl="arch" data-id="${s.id}" data-n="${n}">Archive place</button>` : '')) : '';
  return `<div class="panel" style="position:sticky;top:10px">
    <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><h3 style="margin:0">${esc(s.name)}</h3><span class="pill p-gap">${esc(kl)}</span><span style="flex:1"></span>${btn}</div>
    <p class="sm" style="margin:4px 0 6px">${esc(s.what_it_is || '')}</p>
    <p class="sm" style="margin:0 0 8px"><b>${c.ours}</b> ours${c.hired ? ` · <b>${c.hired}</b> hired in` : ''}</p>
    ${k === 'archive' && n ? `<p class="sm" style="margin:0 0 8px;color:var(--crit,#b3261e)"><b>${n}</b> machine${n === 1 ? ' is' : 's are'} still recorded here — move ${n === 1 ? 'it' : 'them'} to their real place.</p>` : ''}
    ${s.lat == null && k !== 'none' ? '<p class="sm" style="margin:0 0 8px">No position on the map yet.</p>' : ''}
    ${ps.length ? `<div style="margin:0 0 10px"><div class="sm" style="font-weight:600;margin-bottom:4px">Projects</div>${ps.map(p => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line,#e5e2d9);padding:6px 0">
        <span style="font-weight:600">${esc(p.name)}</span>${p.status === 'archived' ? ' <span class="pill p-crit">Archived</span>' : ''}
        <span class="sm">${p.hired} hired machine${p.hired === 1 ? '' : 's'}</span><span style="flex:1"></span>
        ${admin ? (p.status === 'archived'
          ? `<button type="button" class="btn" data-pl="proj" data-id="${p.id}" data-to="current">Restore project</button>`
          : `<button type="button" class="btn" data-pl="parch" data-id="${p.id}" data-n="${p.hired}">Archive project</button>`) : ''}</div>`).join('')}</div>` : ''}
    <div data-pl-msg style="margin:0 0 8px"></div>
    ${n ? `<div class="sm" style="font-weight:600;margin-bottom:4px">Machines</div><div style="max-height:380px;overflow:auto">${placeMachinesHtml(s.name)}</div>` : '<p class="sm">No machines here.</p>'}</div>`;
}
function renderPlaces(){
  const sites = (window.APPSITES || []).slice().sort((a, b) => a.name < b.name ? -1 : 1);
  const sel = window.PLSEL && sites.find(x => x.name === window.PLSEL);
  const row = s => { const c = placeCounts(s.name), k = s.kind || 'current', ps = placeProjects(s), n = c.ours + c.hired;
    return `<tr class="rowlink" data-site="${esc(s.name)}" style="cursor:pointer${sel && sel.name === s.name ? ';background:var(--soft,#f4f2ec)' : ''}">
      <td class="id"><b>${esc(s.name)}</b>${k === 'archive' && n ? ' <span class="pill p-crit">machines still here</span>' : ''}</td>
      <td>${esc((PLACE_KINDS.find(x => x[0] === k) || [k, k])[1])}</td><td class="n">${c.ours}</td><td class="n">${c.hired}</td>
      <td class="sm">${ps.map(p => esc(p.name) + (p.status === 'archived' ? ' (archived)' : '')).join(', ')}</td></tr>`; };
  const body = PLACE_KINDS.map(([k, t]) => { const g = sites.filter(x => (x.kind || 'current') === k); if(!g.length) return '';
    return `<tr class="secthead"><td colspan="5">${t} · ${g.length}</td></tr>` + g.map(row).join(''); }).join('');
  el('placesBody').innerHTML = `
    <div style="margin-bottom:12px"><h2 style="margin:0">Places</h2>
      <p class="sm" style="margin:4px 0 0">One list for the map, our vehicles and Hired In. Click a place to see its projects and machines${placeIsAdmin() ? ' and to archive it' : ''}.</p></div>
    <div id="plGrid" style="display:grid;gap:14px;grid-template-columns:minmax(0,1.3fr) minmax(280px,1fr);align-items:start">
      <div class="scroll"><table><thead><tr><th>Place</th><th>Kind</th><th class="n">Ours</th><th class="n">Hired in</th><th>Projects</th></tr></thead><tbody>${body}</tbody></table></div>
      <div id="plSide">${sel ? placePanel(sel) : '<p class="sm">Click a place in the list.</p>'}</div></div>
    <style>@media(max-width:820px){#plGrid{grid-template-columns:1fr!important}}#pgPlaces tr.rowlink:hover td{background:var(--soft,#f4f2ec)}</style>`;
}
async function placeSave(btn, fn, args, after){
  const box = btn.closest('.panel').querySelector('[data-pl-msg]'); btn.disabled = true; box.textContent = '';
  const { data, error } = await sb.rpc(fn, args);
  if(error){ btn.disabled = false; box.innerHTML = `<span style="color:var(--crit,#b3261e)">${esc(error.message)}</span>`; return; }
  after(data); renderPlaces();
}
document.addEventListener('click', e => {
  const r = e.target.closest && e.target.closest('#pgPlaces tr.rowlink');
  if(r && !e.target.closest('a,button')){ window.PLSEL = r.dataset.site; renderPlaces(); return; }
  const b = e.target.closest && e.target.closest('[data-pl]'); if(!b || !el('placesBody').contains(b)) return;
  const id = +b.dataset.id, what = b.dataset.pl;
  if(what === 'arch' || what === 'parch'){
    if(!b.dataset.sure){ b.dataset.sure = '1'; const n = +b.dataset.n;
      b.textContent = n ? `Confirm — ${n} machine${n === 1 ? ' is' : 's are'} still here` : 'Confirm archive';
      b.closest('.panel').querySelector('[data-pl-msg]').innerHTML = '<span class="sm">Press again to archive. Nothing is deleted; you can restore it.</span>'; return; }
    if(what === 'arch') placeSave(b, 'set_place_kind', {p_site: id, p_kind: 'archive'}, () => { (window.APPSITES.find(s => s.id === id) || {}).kind = 'archive'; const m = (M.sites || []).find(s => s.name === (window.APPSITES.find(s => s.id === id) || {}).name); if(m) m.kind = 'archive'; });
    else placeSave(b, 'set_project_status', {p_project: id, p_status: 'archived'}, () => { (window.APPPROJECTS.find(p => p.id === id) || {}).status = 'archived'; });
  } else if(what === 'kind'){
    placeSave(b, 'set_place_kind', {p_site: id, p_kind: b.dataset.to}, () => { const s = window.APPSITES.find(s => s.id === id) || {}; s.kind = b.dataset.to; const m = (M.sites || []).find(x => x.name === s.name); if(m) m.kind = b.dataset.to; });
  } else if(what === 'proj'){
    placeSave(b, 'set_project_status', {p_project: id, p_status: b.dataset.to}, () => { (window.APPPROJECTS.find(p => p.id === id) || {}).status = b.dataset.to; });
  }
});
el('tabPlaces').onclick = () => { location.hash = '#places'; show('places', true); renderPlaces(); };

/* ---- the map on Home: a circle per place; click one to open its machines at the side ---- */
function homeMapHtml(){
  return `<div class="panel" id="hmWrap" style="margin-top:16px">
    <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px"><h3 style="margin:0">Where everything is</h3>
      <span class="sm">Click a circle to see its machines. Grey ring = hired in.</span><span style="flex:1"></span>
      <a class="btn" href="#map">Full map</a><a class="btn" href="#places">Places</a></div>
    <div id="hmGrid" style="display:grid;gap:14px;grid-template-columns:minmax(0,1.5fr) minmax(260px,1fr)">
      <div><svg id="hmSvg" style="width:100%;height:auto;display:block;border-radius:10px"></svg></div>
      <div id="hmSide" style="min-width:0"><p class="sm">Pick a place on the map.</p></div></div></div>
    <style>@media(max-width:820px){#hmGrid{grid-template-columns:1fr!important}}#hmSvg .hp{cursor:pointer}#hmSvg .hp:hover circle.hc{stroke:var(--ink,#222)}</style>`;
}
function homeMapInit(){
  const svg = el('hmSvg'); if(!svg || typeof M === 'undefined' || !M.view) return;
  const D = M, V = D.view, W = 1000, H = Math.round(W * V.h / V.w);
  const u2x = u => (u - V.x) / V.w * W, u2y = u => (u - V.y) / V.h * H;
  const ux = lon => (lon - V.lon0) * V.co * V.k, uy = lat => -(lat - V.lat0) * V.k;
  const INS = {lon0:54.85, lat0:24.70, lon1:55.50, lat1:25.20, w:330, h:282, pad:10, x:24, y:24};
  INS.ux0 = ux(INS.lon0); INS.uy0 = uy(INS.lat1);
  INS.sx = (INS.w - 2*INS.pad) / (ux(INS.lon1) - INS.ux0); INS.sy = (INS.h - 2*INS.pad) / (uy(INS.lat0) - INS.uy0);
  const inInset = s => s.lon >= INS.lon0 && s.lon <= INS.lon1 && s.lat >= INS.lat0 && s.lat <= INS.lat1;
  const i2x = lon => INS.x + INS.pad + (ux(lon) - INS.ux0) * INS.sx, i2y = lat => INS.y + INS.pad + (uy(lat) - INS.uy0) * INS.sy;
  const shapeG = (sx, sy, tx, ty, lw) => D.shapes.map(s => { const u = s.name === 'UAE';
    return `<g transform="translate(${tx} ${ty}) scale(${sx} ${sy})"><path d="${s.d}" fill="${u ? 'var(--uae)' : 'var(--land)'}" stroke="${u ? 'var(--uae-line)' : 'var(--rule)'}" stroke-width="${(u ? lw : lw * .55) / sx}" stroke-linejoin="round"/></g>`; }).join('');
  const places = D.sites.filter(s => s.lat != null && !s.garage && s.kind !== 'none' && (s.kind !== 'archive' || placeCounts(s.name).list.length));
  const pos = s => inInset(s) ? [i2x(s.lon), i2y(s.lat)] : [u2x(ux(s.lon)), u2y(uy(s.lat))];
  let g = `<rect width="${W}" height="${H}" fill="var(--sea)"/>` + shapeG(W / V.w, H / V.h, -V.x * W / V.w, -V.y * H / V.h, 2.2);
  if(places.some(inInset)){
    const bx = u2x(INS.ux0), by = u2y(INS.uy0), bw = u2x(ux(INS.lon1)) - bx, bh = u2y(uy(INS.lat0)) - by;
    g += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="var(--brand)" stroke-width="1.4" stroke-dasharray="4 3" opacity=".7"/>
      <rect x="${INS.x}" y="${INS.y}" width="${INS.w}" height="${INS.h}" rx="10" fill="var(--sea)" stroke="var(--brand)" stroke-width="1.4"/>
      <clipPath id="hmClip"><rect x="${INS.x + 1}" y="${INS.y + 1}" width="${INS.w - 2}" height="${INS.h - 2}" rx="9"/></clipPath>
      <g clip-path="url(#hmClip)">${shapeG(INS.sx, INS.sy, INS.x + INS.pad - INS.ux0 * INS.sx, INS.y + INS.pad - INS.uy0 * INS.sy, 1.6)}</g>
      <text x="${INS.x + 11}" y="${INS.y + 20}" font-size="13" font-weight="650" fill="var(--brand)">Dubai area</text>`;
  }
  const seen = [];
  g += places.map(s => {
    const [x, y] = pos(s), c = placeCounts(s.name), n = c.ours + c.hired;
    let dy = 4; while(seen.some(([sx, sy]) => Math.abs(sx - x) < 110 && Math.abs(sy - (y + dy)) < 13)) dy += 15; seen.push([x, y + dy]);
    const r = n ? 13 : 8, arc = c.hired && n ? (() => { const f = c.hired / n, R = r + 4, a = 2 * Math.PI * f; return f >= 1 ? `<circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="var(--hire,#8a8a86)" stroke-width="3"/>` :
      `<path d="M${x},${y - R} A${R},${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x + R * Math.sin(a)},${y - R * Math.cos(a)}" fill="none" stroke="var(--hire,#8a8a86)" stroke-width="3"/>`; })() : '';
    const bad = s.kind === 'archive';
    return `<g class="hp" data-site="${esc(s.name)}">${arc}<circle class="hc" cx="${x}" cy="${y}" r="${r}" fill="${n ? (bad ? 'var(--crit,#b3261e)' : 'var(--brand)') : 'none'}" stroke="${n ? 'var(--surface)' : 'var(--gap)'}" stroke-width="2" ${n ? '' : 'stroke-dasharray="2.5 2"'}/>
      ${n ? `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${n}</text>` : ''}
      <text x="${x + r + 8}" y="${y + dy}" font-size="12" font-weight="600" fill="var(--ink)" paint-order="stroke" stroke="var(--sea)" stroke-width="3.5">${esc(s.name)}</text></g>`;
  }).join('');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = g;
  svg.onclick = e => { const p = e.target.closest('.hp'); if(p) homeMapOpen(p.dataset.site); };
}
function homeMapOpen(name){
  const c = placeCounts(name), s = (window.APPSITES || []).find(x => x.name === name) || {};
  const ps = placeProjects(s).filter(p => p.status !== 'archived');
  el('hmSide').innerHTML = `<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><h3 style="margin:0">${esc(name)}</h3>
      <span class="sm"><b>${c.ours}</b> ours${c.hired ? ` · <b>${c.hired}</b> hired in` : ''}</span></div>
    <p class="sm" style="margin:2px 0 6px">${esc(s.what_it_is || '')}</p>
    ${ps.length ? `<p class="sm" style="margin:0 0 6px">Projects: ${ps.map(p => `<b>${esc(p.name)}</b> (${p.hired} hired)`).join(' · ')}</p>` : ''}
    <div style="max-height:360px;overflow:auto">${placeMachinesHtml(name)}</div>`;
}
