/* ============================= HOME (Admin only) =============================
   Opens first for an Admin: Last update, Download Excel, four numbers and the
   change log. The log is read from the change_log table (Admin can read it). */
function homeWho(e){ return (e || '').split('@')[0] || '—'; }
function homeWhen(t){
  const d = new Date(t); if(isNaN(d)) return '';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) + ' · ' +
    d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
function renderHome(){
  const log = window.APPLOG || [], last = log[0];
  const inFleet = Object.values(F.vehicles).filter(v=>v.fleet==='In fleet').length;
  const tile = (l,n,note)=>`<div class="tile"><div class="lbl">${l}</div><div class="val">${n}</div><div class="note">${note}</div></div>`;
  el('homeBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:14px">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Admin</div>
        <h2 style="margin:2px 0 0">Fleet today</h2></div>
      <span style="flex:1"></span>
      <div style="text-align:right"><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Last update</div>
        ${last ? `<b>${esc(homeWhen(last.at))}</b> <span class="sm">by ${esc(homeWho(last.by_email))}</span>` : '<span class="sm">no change made in the app yet</span>'}</div>
      <button type="button" class="btn" id="homeXl" style="background:var(--navy,#16315c);color:#fff">Download Excel</button>
    </div>
    ${homeRequests(true)}
    <div class="tiles">
      ${tile('Vehicles in fleet', inFleet, 'our own, on the register')}
      ${tile('On Renewals', renewFlagged, 'expired or inside their window')}
      ${tile('Fines', FINES.tally.n, 'on record')}
      ${tile('Changes in the log', log.length, log.length >= 500 ? 'latest 500 shown' : 'made in the app')}
    </div>
    ${homeRequests(false)}
    ${homeChanges(log)}`;
  el('homeXl').onclick = homeExcel;
  homeRefreshLog();
}
/* 17 Nov 2026: changes made in the app are notifications. "New changes" lists the ones not yet seen; Seen moves a change to the
   History on the vehicle / driver card (change_log.seen_at, set by the database function mark_change_seen, Admin only). */
function homeChanges(log){
  const fresh = log.filter(e => !e.seen_at);
  const plateLink = e => { const v = e.vehicle_id ? Object.values(F.vehicles).find(x => x._id === e.vehicle_id) : null;
    return v ? ` <a data-f="card" data-plate="${esc(v.plate)}" class="sm" style="cursor:pointer;color:var(--brand)">open ${esc(v.plate)} →</a>` : ''; };
  return `<div style="margin-top:18px"><div style="display:flex;align-items:baseline;gap:12px;margin-bottom:8px;flex-wrap:wrap"><h3 style="margin:0;font-size:17px">New changes ${fresh.length ? `<span class="pill p-warn">${fresh.length}</span>` : ''}</h3>
      <span class="sm">made in the app · press Seen and it moves to the History on the vehicle or driver card</span><span style="flex:1"></span>
      ${fresh.length > 1 ? '<button type="button" class="btn" data-seen="all">Mark all seen</button>' : ''}</div>
    ${fresh.length ? `<div class="scroll"><table><thead><tr><th>When</th><th>Who</th><th>Type</th><th>What</th><th></th></tr></thead>
      <tbody>${fresh.map(e => `<tr><td class="sm" style="white-space:nowrap">${esc(homeWhen(e.at))}</td><td class="sm">${esc(homeWho(e.by_email))}</td>
        <td><span class="pill p-ok">${esc(e.kind)}</span></td><td>${esc(e.summary)}${plateLink(e)}</td>
        <td style="white-space:nowrap"><button type="button" class="btn" data-seen="${e.id}">Seen</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="sm" style="margin:0">No new changes. Everything made in the app is in the History on the vehicle or driver card.</p>'}
    <div id="seenMsg" class="sm" style="color:var(--crit);margin-top:6px"></div></div>`;
}
/* History of changes panel for a vehicle card ({vehicle: id}) or a driver card ({person: id}); Admin only. */
window.chgHistory = function(o){
  if((window.MYROLE || '') !== 'admin') return '';
  const pid = o.person;
  const mine = (window.APPLOG || []).filter(e => o.vehicle ? e.vehicle_id === o.vehicle
    : (() => { const d = e.details || {}; return d.person_id === pid || d.old_driver_id === pid || d.new_driver_id === pid; })());
  const row = e => `<div class="catt"><b>${esc(o.vehicle ? e.summary.replace(/^[^:]*:\s*/, '') : e.summary)}</b>${e.seen_at ? '' : ' <span class="pill p-warn">new</span>'}
    <div class="sm">${esc(homeWhen(e.at))} · ${esc(homeWho(e.by_email))}</div></div>`;
  return `<div class="panel"><div class="ph"><h3>History of changes</h3><span class="note">${mine.length} · newest first</span></div>${mine.length
    ? `<div style="max-height:380px;overflow:auto">${mine.map(row).join('')}</div>`
    : '<p class="sm" style="margin:0">No change made in the app yet.</p>'}</div>`;
};
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-seen]'); if(!b) return;
  const all = b.dataset.seen === 'all', msg = document.getElementById('seenMsg'); b.disabled = true; if(msg) msg.textContent = '';
  const { error } = await sb.rpc('mark_change_seen', { p_id: all ? null : +b.dataset.seen });
  if(error){ b.disabled = false; if(msg) msg.textContent = error.message; return; }
  const now = new Date().toISOString();
  (window.APPLOG || []).forEach(x => { if(!x.seen_at && (all || x.id === +b.dataset.seen)) x.seen_at = now; });
  homeBadge(); renderHome();
});
/* Read the change log again every time Home opens, so changes made by others (or after this page loaded) show up. */
async function homeRefreshLog(){
  try{
    const r = await sb.from('change_log').select('*').order('id',{ascending:false}).limit(500);
    if(r.error) return;
    const old = window.APPLOG || [];
    const sig = a => a.map(x => x.id + (x.seen_at ? 's' : 'u')).join(',');
    if(sig(r.data) !== sig(old)){
      window.APPLOG = r.data;
      if(el('homeBody')) renderHome();
    }
  }catch(e){}
}
/* Download Excel: a workbook that looks like the app (shown tabs) plus hidden notes for AI tools and the raw tables.
   The workbook itself is made by xlexport.js (FalaXlsx.make); this part reads the database and saves the file.
   Row counts are checked against the database before the file is saved. */
const XL_CORE = ['vehicles','people','sites','projects','paper_types','papers','hire_terms','hire_postings','suppliers','fines','change_log','tyres','tyre_moves','service_jobs','diesel_lines','log_entries','report_files'];
async function xlPull(table, orderBy){
  const out = []; let from = 0;
  for(;;){
    const { data, error } = await sb.from(table).select('*').order(orderBy || 'id', { ascending: true }).range(from, from + 999);
    if(error) throw new Error(table + ': ' + error.message);
    out.push(...data); if(data.length < 1000) return out; from += 1000;
  }
}
async function xlCount(table){
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if(error) throw new Error(table + ': ' + error.message);
  return count;
}
async function xlPicture(url){
  const resp = await fetch(url); if(!resp.ok) throw new Error('HTTP ' + resp.status); const blob = await resp.blob();
  return await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
}
async function homeExcelRun(){
  const XL = window.FalaXlsx, tables = {}, errors = {}, bad = [];
  for(const [t, ord] of XL.TABLE_ORDER){
    const b = el('homeXl'); if(b) b.textContent = 'Preparing ' + t + '…';
    try{
      const rows = await xlPull(t, ord), dbn = await xlCount(t);
      if(rows.length !== dbn) bad.push(t);
      tables[t] = rows;
    }catch(e){
      if(XL_CORE.includes(t)) throw e;
      tables[t] = []; errors[t] = e.message;            // a table the Admin cannot read is named in the hidden tabs, the file is still made
    }
  }
  if(bad.length) throw new Error('Row counts do not match for: ' + bad.join(', ') + '. File not saved.');
  const logos = [];
  for(const [nm, url] of [['App icon (truck, 512 px)', 'icon-512.png'], ['FALA logo', 'assets/logo.png']]){
    try{ logos.push({ name: nm, file: url, uri: await xlPicture(url) }); }catch(e){ logos.push({ name: nm, file: url, uri: '' }); }
  }
  let source = ''; try{ source = await (await fetch('xlexport.js')).text(); }catch(e){}
  const now = new Date(), today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(now);
  const bytes = await XL.make({ tables, errors, drawings: window.ICONS_DATA || {}, logos, today, madeAt: now, madeBy: window.MYEMAIL || 'admin', source });
  const p = n => String(n).padStart(2, '0');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `Fala Fleet FULL ${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}.xlsx`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function homeExcel(){
  const b = el('homeXl'); b.disabled = true; b.textContent = 'Preparing…';
  const done = () => { b.disabled = false; b.textContent = 'Download Excel'; };
  const go2 = () => { homeExcelRun().then(done).catch(e => { alert('Could not make the Excel file: ' + e.message); done(); }); };
  if(window.FalaXlsx) return go2();
  const s = document.createElement('script'); s.src = 'xlexport.js'; s.onload = go2;
  s.onerror = () => { done(); alert('Could not load the Excel maker.'); };
  document.head.appendChild(s);
}
if(window.MYROLE === 'admin') el('tabHome').style.display = '';
el('tabHome').onclick = ()=>{ location.hash='#home'; show('home', true); renderHome(); };


/* Requests waiting for the Admin: an Editor asked to change a plate / asset no., engine no. or Registered to. */
function homeRequests(top){
  const FN = {number:'Plate or asset no.', engine_no:'Engine no.', owner:'Registered to'};
  const p = (window.APPREQ || []).filter(r => r.status === 'pending');
  const plateOf = vid => { const v = Object.values(F.vehicles).find(x => x._id === vid); if(v) return v.plate; const m = ((typeof HIRE !== 'undefined' && HIRE.rows) || []).find(x => x.vid === vid); return m ? m.plate : 'vehicle ' + vid; };
  if(top && !p.length) return '';
  if(!top && p.length) return '';
  if(!p.length) return '<div style="margin-top:18px"><h3 style="margin:0 0 6px;font-size:17px">Requests waiting</h3><p class="sm" style="margin:0">Nothing is waiting for your approval.</p></div>';
  return `<div style="margin:0 0 18px;border:1px solid var(--warn,#d9a441);background:var(--soft,#f4f2ec);border-radius:12px;padding:14px 16px"><h3 style="margin:0 0 8px;font-size:17px">Waiting for your approval <span class="pill p-warn">${p.length}</span></h3>
    <div class="scroll"><table><thead><tr><th>Vehicle</th><th>What</th><th>Old</th><th>New</th><th>Asked by</th><th>Reason</th><th></th></tr></thead><tbody>
    ${p.map(r => `<tr><td><b>${esc(plateOf(r.vehicle_id))}</b></td><td>${esc(FN[r.field] || r.field)}</td><td class="sm">${esc(r.old_value || 'empty')}</td><td><b>${esc(r.new_value || 'empty')}</b></td>
      <td class="sm">${esc(homeWho(r.requested_email))}<br>${esc(homeWhen(r.requested_at))}</td><td class="sm">${esc(r.reason || '')}</td>
      <td style="white-space:nowrap"><button type="button" class="btn" data-mreq="${r.id}" data-ok="1" style="background:var(--navy,#16315c);color:#fff">Approve</button>
        <button type="button" class="btn" data-mreq="${r.id}" data-ok="0">Reject</button></td></tr>`).join('')}</tbody></table></div>
    <div id="mreqMsg" class="sm" style="color:var(--crit);margin-top:6px"></div></div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-mreq]'); if(!b) return;
  const msg = document.getElementById('mreqMsg'); b.disabled = true; if(msg) msg.textContent = '';
  const { error } = await sb.rpc('decide_machine_request', { p_id: +b.dataset.mreq, p_approve: b.dataset.ok === '1', p_note: null });
  if(error){ b.disabled = false; if(msg) msg.textContent = error.message; return; }
  const q = await sb.from('machine_change_requests').select('*').order('id', { ascending: false }).limit(300); if(!q.error) window.APPREQ = q.data;
  homeBadge(); renderHome(); homeRefreshLog();
  const m2 = document.getElementById('mreqMsg'); if(m2){ m2.style.color = '#1d6b3f'; m2.textContent = (b.dataset.ok === '1' ? 'Approved. ' : 'Rejected. ') + 'Refresh the page to see an approved change on the cards and lists.'; }
});

/* number badge on the Home button = requests waiting for the Admin */
function homeBadge(){
  const n = (window.APPREQ || []).filter(r => r.status === 'pending').length + (window.APPLOG || []).filter(x => !x.seen_at).length, c = document.getElementById('cntHome');
  if(c) c.textContent = (window.MYROLE === 'admin' && n) ? n : '';
}
homeBadge();
