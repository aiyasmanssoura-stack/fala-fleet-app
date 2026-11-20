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
  const all = placeFlat(s.held || s.v || []);
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
/* ---- Settings page (Admin): places and projects ---- */
const PLACE_TAGS = {permanent:'Permanent', current:'Project', sister:'Sister company', none:'No map position', archive:'Archive'};
function plParsePos(t){
  t = (t || '').trim(); if(!t) return {lat: null, lng: null};
  const m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(t) || /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(t) || /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(t);
  if(!m) return null; const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  return (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) ? {lat, lng} : null;
}
function plDialog(title, fieldsHtml, buttons, onSave){
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
  o.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(520px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:22px 24px;display:flex;flex-direction:column;gap:14px">
    <h2 style="margin:0;font-size:21px">${esc(title)}</h2>${fieldsHtml}
    <div id="plErr" style="color:var(--crit,#b3261e);font-size:13px;min-height:16px"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">${buttons}<button type="button" class="btn" id="plX">Cancel</button><button type="button" class="btn" id="plOk" style="background:var(--navy,#16315c);color:#fff">Save</button></div></div>`;
  document.body.appendChild(o);
  const close = () => o.remove(); o.querySelector('#plX').onclick = close;
  o.addEventListener('click', e => { if(e.target === o) close(); });
  const err = o.querySelector('#plErr'), ok = o.querySelector('#plOk');
  ok.onclick = async () => { err.textContent = ''; ok.disabled = true; try{ const m = await onSave(o); if(m) err.textContent = m; else close(); }catch(x){ err.textContent = x.message || String(x); } ok.disabled = false; };
  return {o, err, close};
}
const PL_FLD = 'font:inherit;padding:10px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:42px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
const PL_LAB = 'display:block;font-weight:600;font-size:13px;margin-bottom:4px';
function plPlaceDialog(site){
  const isNew = !site, k = site ? (site.kind || 'current') : 'current', archived = k === 'archive';
  const pos = site && site.lat != null ? `${site.lat}, ${site.lng}` : '';
  const kinds = ['permanent', 'current', 'sister', 'none'].map(x => `<option value="${x}"${x === k ? ' selected' : ''}>${PLACE_TAGS[x]}</option>`).join('');
  const f = `<div><label style="${PL_LAB}">Name</label><input id="plN" style="${PL_FLD}" value="${esc(site ? site.name : '')}"></div>
    ${archived ? `<div class="sm">This place is in the Archive.</div>` : `<div><label style="${PL_LAB}">Kind</label><select id="plK" style="${PL_FLD}">${kinds}</select></div>`}
    <div><label style="${PL_LAB}">What it is</label><input id="plW" style="${PL_FLD}" value="${esc(site ? site.what_it_is || '' : '')}"></div>
    <div><label style="${PL_LAB}">Map position</label><input id="plP" style="${PL_FLD}" placeholder="24.994697, 55.437515  — or a full Google Maps address" value="${esc(pos)}">
      <div class="sm" style="margin-top:4px">Leave empty for no pin on the map. A short maps.app.goo.gl link cannot be read here — send it to me, or paste the latitude and longitude.</div></div>
    ${site ? `<div class="sm"><b>${placeCounts(site.name).ours}</b> ours · <b>${placeCounts(site.name).hired}</b> hired in at this place</div>` : ''}`;
  const btn = site ? (archived ? '<button type="button" class="btn" id="plArch">Restore place</button>' : '<button type="button" class="btn" id="plArch">Archive place</button>') : '';
  const d = plDialog(isNew ? 'Add place' : 'Place', f, btn, async o => {
    const v = id => o.querySelector(id).value, name = v('#plN').trim(), what = v('#plW').trim(), kind = archived ? 'archive' : v('#plK');
    const ps = plParsePos(v('#plP')); if(!ps) return 'The map position could not be read. Use latitude, longitude — for example 24.994697, 55.437515.';
    if(!name) return 'Type the place name.';
    const args = {p_name: name, p_kind: kind, p_what: what, p_lat: ps.lat, p_lng: ps.lng};
    const { data, error } = isNew ? await sb.rpc('add_place', args) : await sb.rpc('update_place', Object.assign({p_site: site.id}, args));
    if(error) return error.message;
    if(isNew) (window.APPSITES = window.APPSITES || []).push({id: data.id, name, kind, what_it_is: what || null, lat: ps.lat, lng: ps.lng});
    else Object.assign(site, {name, kind, what_it_is: what || null, lat: ps.lat, lng: ps.lng});
    renderSettings();
  });
  const a = d.o.querySelector('#plArch');
  if(a) a.onclick = async () => {
    const n = placeCounts(site.name); const cnt = n.ours + n.hired;
    if(!archived && cnt && !a.dataset.sure){ a.dataset.sure = '1'; a.textContent = `Confirm — ${cnt} machine${cnt === 1 ? ' is' : 's are'} still here`; return; }
    const to = archived ? 'current' : 'archive';
    const { error } = await sb.rpc('set_place_kind', {p_site: site.id, p_kind: to});
    if(error){ d.err.textContent = error.message; return; }
    site.kind = to; d.close(); renderSettings();
  };
}
function plProjectDialog(pr){
  const isNew = !pr, archived = pr && pr.status === 'archived';
  const sites = (window.APPSITES || []).filter(s => s.kind !== 'archive' || (pr && pr.site_id === s.id)).sort((a, b) => a.name < b.name ? -1 : 1);
  const f = `<div><label style="${PL_LAB}">Project name</label><input id="plN" style="${PL_FLD}" value="${esc(pr ? pr.name : '')}"></div>
    <div><label style="${PL_LAB}">Place</label><select id="plS" style="${PL_FLD}">${isNew ? '<option value="">Choose…</option>' : ''}${sites.map(s => `<option value="${s.id}"${pr && pr.site_id === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    ${pr ? `<div class="sm">${placeProjects({id: pr.site_id}).find(x => x.id === pr.id).hired} hired machine(s) on this project.${archived ? ' It is in the Archive.' : ''}</div>` : ''}`;
  const btn = pr ? `<button type="button" class="btn" id="plArch">${archived ? 'Restore project' : 'Archive project'}</button>` : '';
  const d = plDialog(isNew ? 'Add project' : 'Project', f, btn, async o => {
    const name = o.querySelector('#plN').value.trim(), site = +o.querySelector('#plS').value;
    if(!name) return 'Type the project name.'; if(!site) return 'Choose the place.';
    const { data, error } = isNew ? await sb.rpc('add_project', {p_name: name, p_site: site}) : await sb.rpc('update_project', {p_project: pr.id, p_name: name, p_site: site});
    if(error) return error.message;
    if(isNew) (window.APPPROJECTS = window.APPPROJECTS || []).push({id: data.id, name, site_id: site, status: 'current'});
    else Object.assign(pr, {name, site_id: site});
    renderSettings();
  });
  const a = d.o.querySelector('#plArch');
  if(a) a.onclick = async () => {
    const hired = placeProjects({id: pr.site_id}).find(x => x.id === pr.id).hired;
    if(!archived && hired && !a.dataset.sure){ a.dataset.sure = '1'; a.textContent = `Confirm — ${hired} machine${hired === 1 ? ' is' : 's are'} still on it`; return; }
    const to = archived ? 'current' : 'archived';
    const { error } = await sb.rpc('set_project_status', {p_project: pr.id, p_status: to});
    if(error){ d.err.textContent = error.message; return; }
    pr.status = to; d.close(); renderSettings();
  };
}
function renderSettings(){
  const root = el('settingsBody');
  if(!placeIsAdmin()){ root.innerHTML = '<p class="sm">Settings are for the Admin.</p>'; return; }
  const sites = (window.APPSITES || []).slice().sort((a, b) => a.name < b.name ? -1 : 1);
  const siteName = id => (sites.find(s => s.id === id) || {}).name || '';
  const srow = s => { const c = placeCounts(s.name), k = s.kind || 'current', n = c.ours + c.hired;
    return `<tr class="rowlink" data-pl-site="${s.id}" style="cursor:pointer"><td class="id"><b>${esc(s.name)}</b>${k === 'archive' && n ? ' <span class="pill p-crit">machines still here</span>' : ''}</td>
      <td><span class="pill p-gap">${esc(PLACE_TAGS[k] || k)}</span></td><td class="n">${n}</td></tr>`; };
  const act = sites.filter(s => (s.kind || 'current') !== 'archive'), arc = sites.filter(s => (s.kind || 'current') === 'archive');
  const prs = (window.APPPROJECTS || []).slice().sort((a, b) => a.name < b.name ? -1 : 1);
  const prow = p => { const h = placeProjects({id: p.site_id}).find(x => x.id === p.id); 
    return `<tr class="rowlink" data-pl-proj="${p.id}" style="cursor:pointer"><td class="id"><b>${esc(p.name)}</b></td><td>${esc(siteName(p.site_id))}</td>
      <td>${p.status === 'archived' ? '<span class="pill p-crit">Archived</span>' : 'Active'}</td><td class="n">${h ? h.hired : 0}</td></tr>`; };
  const view = (() => { const h = decodeURIComponent((location.hash || '').slice(1)); return h.startsWith('settings/') ? h.slice(9) : ''; })();
  const ICON = {
    places: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    projects: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    users: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>'};
  const CARDS = [['places', 'Places & Sites', 'Yards, projects, sister company, archive'], ['projects', 'Projects', 'Add, move to a place, archive'], ['users', 'Users', 'Add users, levels, passwords, switch off']];
  const head = (t, extra) => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px"><a class="btn" href="#settings">&lsaquo; Settings</a><h2 style="margin:0">${t}</h2><span class="sm">Click a line to change it.</span><span style="flex:1"></span>${extra}</div>`;
  if(view === 'places'){
    root.innerHTML = head('Places &amp; Sites', '<button type="button" class="btn" id="plAddSite" style="background:var(--navy,#16315c);color:#fff">+ Add place</button>') + `
    <div class="scroll"><table><thead><tr><th>Place</th><th>Kind</th><th class="n">Machines</th></tr></thead><tbody>
      <tr class="secthead"><td colspan="3">Active · ${act.length}</td></tr>${act.map(srow).join('')}
      ${arc.length ? `<tr class="secthead"><td colspan="3">Archive · ${arc.length}</td></tr>${arc.map(srow).join('')}` : ''}</tbody></table></div>`;
    el('plAddSite').onclick = () => plPlaceDialog(null);
  }else if(view === 'projects'){
    root.innerHTML = head('Projects', '<button type="button" class="btn" id="plAddProj" style="background:var(--navy,#16315c);color:#fff">+ Add project</button>') + `
    <div class="scroll"><table><thead><tr><th>Project</th><th>Place</th><th>Status</th><th class="n">Hired machines</th></tr></thead><tbody>
      ${prs.filter(p => p.status !== 'archived').map(prow).join('')}${prs.filter(p => p.status === 'archived').map(prow).join('')}</tbody></table></div>`;
    el('plAddProj').onclick = () => plProjectDialog(null);
  }else if(view === 'users'){
    root.innerHTML = head('Users', '<button type="button" class="btn" id="usAdd" style="background:var(--navy,#16315c);color:#fff">+ Add user</button>') + `<div class="scroll" id="usBox"><p class="sm">Loading…</p></div>`;
    el('usAdd').onclick = () => usDialog(null);
    usLoad();
  }else{
    root.innerHTML = `<h2 style="margin:0 0 14px">Settings</h2><div style="display:grid;gap:8px;max-width:760px">${CARDS.map(c =>
      `<a href="#settings/${c[0]}" class="setcard" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line,#d9d6cc);border-radius:10px;background:var(--card,#fff);color:inherit;text-decoration:none">${ICON[c[0]]}<span style="flex:1"><b style="display:block;font-size:15px">${c[1]}</b><span class="sm">${c[2]}</span></span><span class="sm" style="font-size:18px">&rsaquo;</span></a>`).join('')}</div>
      <style>.setcard:hover{background:var(--soft,#f4f2ec)!important}</style>`;
  }
}

/* ---- Users (Admin): the manage-users server function does the real work and checks the caller is an Admin ---- */
const US_NAMES = {admin: 'Admin', editor: 'Editor', manager: 'Manager', viewer: 'Guest', amia_editor: 'AMIA Project Editor'};
const US_HELP = {admin: 'everything', editor: 'changes the fleet', manager: 'views everything incl. GPS, changes nothing', viewer: 'views only', amia_editor: 'views, renews the Landside pass'};
let US_ROWS = [];
async function usCall(body){
  try{
    const r = await sb.functions.invoke('manage-users', {body});
    if(r.error){ let m = r.error.message; try{ const j = await r.error.context.json(); if(j && j.error) m = j.error; }catch(x){} return {error: m}; }
    if(r.data && r.data.error) return {error: r.data.error};
    return {data: r.data};
  }catch(x){ return {error: x.message || String(x)}; }
}
async function usLoad(){
  const box = el('usBox'); if(!box) return;
  const r = await usCall({action: 'list'});
  if(r.error){ box.innerHTML = `<p class="sm" style="color:var(--crit)">${esc(r.error)}</p>`; return; }
  US_ROWS = r.data.users || [];
  box.innerHTML = `<table><thead><tr><th>Email</th><th>Level</th><th>Status</th></tr></thead><tbody>${US_ROWS.map(u =>
    `<tr class="rowlink" data-pl-user="${esc(u.id)}" style="cursor:pointer${u.off ? ';opacity:.6' : ''}"><td class="id"><b>${esc(u.email)}</b>${u.me ? ' <span class="sm">(you)</span>' : ''}</td><td>${esc(US_NAMES[u.role] || u.role)}</td><td>${u.off ? '<span class="pill p-crit">Switched off</span>' : 'Active'}</td></tr>`).join('')}</tbody></table>`;
}
function usDialog(u){
  const isNew = !u;
  const opts = Object.keys(US_NAMES).map(k => `<option value="${k}"${(u ? u.role : 'viewer') === k ? ' selected' : ''}>${US_NAMES[k]} — ${US_HELP[k]}</option>`).join('');
  const f = isNew
    ? `<div><label style="${PL_LAB}">Email</label><input id="usE" type="email" autocomplete="off" style="${PL_FLD}" placeholder="name@company.com"></div>
       <div><label style="${PL_LAB}">Level</label><select id="usR" style="${PL_FLD}">${opts}</select></div>
       <div><label style="${PL_LAB}">First password</label><input id="usP" type="text" autocomplete="off" style="${PL_FLD}" placeholder="at least 8 characters"><div class="sm" style="margin-top:4px">Give it to the person. They can change it later.</div></div>`
    : `<div class="sm"><b>${esc(u.email)}</b>${u.me ? ' (you)' : ''}${u.off ? ' · switched off' : ''}</div>
       <div><label style="${PL_LAB}">Level</label><select id="usR" style="${PL_FLD}"${u.me ? ' disabled' : ''}>${opts}</select>${u.me ? '<div class="sm" style="margin-top:4px">You cannot change your own level.</div>' : ''}</div>
       <div><label style="${PL_LAB}">New password <span class="sm" style="font-weight:400">(leave empty to keep it)</span></label><input id="usP" type="text" autocomplete="off" style="${PL_FLD}" placeholder="at least 8 characters"></div>`;
  const btn = (!isNew && !u.me) ? `<button type="button" class="btn" id="usOff">${u.off ? 'Switch on' : 'Switch off'}</button>` : '';
  const d = plDialog(isNew ? 'Add user' : 'User', f, btn, async o => {
    const role = o.querySelector('#usR').value, pw = o.querySelector('#usP').value;
    if(isNew){
      const email = o.querySelector('#usE').value.trim();
      if(!email) return 'Type the email.';
      if(pw.length < 8) return 'The password needs at least 8 characters.';
      const r = await usCall({action: 'create', email, role, password: pw}); if(r.error) return r.error;
    }else{
      if(pw && pw.length < 8) return 'The password needs at least 8 characters.';
      if(!u.me && role !== u.role){ const r = await usCall({action: 'set_role', id: u.id, role}); if(r.error) return r.error; }
      if(pw){ const r = await usCall({action: 'set_password', id: u.id, password: pw}); if(r.error) return r.error; }
    }
    usLoad();
  });
  const off = d.o.querySelector('#usOff');
  if(off) off.onclick = async () => {
    const r = await usCall({action: 'set_active', id: u.id, active: !!u.off}); if(r.error){ d.err.textContent = r.error; return; }
    d.close(); usLoad();
  };
}
document.addEventListener('click', e => {
  const r = e.target.closest && e.target.closest('#settingsBody tr.rowlink'); if(!r) return;
  if(r.dataset.plSite) plPlaceDialog((window.APPSITES || []).find(s => s.id === +r.dataset.plSite));
  else if(r.dataset.plProj) plProjectDialog((window.APPPROJECTS || []).find(p => p.id === +r.dataset.plProj));
  else if(r.dataset.plUser) usDialog(US_ROWS.find(x => x.id === r.dataset.plUser));
});
if(window.MYROLE === 'admin') el('tabSettings').style.display = '';
el('tabSettings').onclick = () => { location.hash = '#settings'; show('settings', true); renderSettings(); };

/* ---- the map on Home: a circle per place; click one to open its machines at the side ---- */
function homeMapHtml(){
  return `<div class="panel" id="hmWrap" style="margin-top:16px">
    <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px"><h3 style="margin:0">Where everything is</h3>
      <span class="sm">Click a circle to see its machines. Grey ring = hired in.</span><span style="flex:1"></span>
      <a class="btn" href="#map">Full map</a><a class="btn" href="#settings">Settings</a></div>
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

/* A vehicle in a Map list, or in the list beside the Home map, opens its card (ours: #v/, hired in: #h/). */
document.addEventListener('click', e => {
  const n = e.target.closest && e.target.closest('#pgMap [data-plate], #pgHome [data-plate]');
  if(!n || e.ctrlKey || e.metaKey || e.button !== 0) return;
  const pre = n.dataset.h === 'card' ? '#h/' : n.dataset.f === 'card' ? '#v/' : '';
  if(!pre) return;
  e.preventDefault(); location.hash = pre + encodeURIComponent(n.dataset.plate); scrollTo({top: 0, behavior: 'smooth'});
});
