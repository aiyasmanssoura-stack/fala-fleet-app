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
    <div class="tiles">
      ${tile('Vehicles in fleet', inFleet, 'our own, on the register')}
      ${tile('On Renewals', renewFlagged, 'expired or inside their window')}
      ${tile('Fines', FINES.tally.n, 'on record')}
      ${tile('Changes in the log', log.length, log.length >= 500 ? 'latest 500 shown' : 'made in the app')}
    </div>
    <div style="margin-top:18px"><div style="display:flex;align-items:baseline;gap:12px;margin-bottom:8px"><h3 style="margin:0;font-size:17px">Change log</h3>
      <span class="sm">everything changed in the app, newest first · Admin only</span></div>
      ${log.length ? `<div class="scroll"><table><thead><tr><th>When</th><th>Who</th><th>Type</th><th>What</th></tr></thead>
        <tbody>${log.map(e=>`<tr><td class="sm" style="white-space:nowrap">${esc(homeWhen(e.at))}</td><td class="sm">${esc(homeWho(e.by_email))}</td>
          <td><span class="pill p-ok">${esc(e.kind)}</span></td><td>${esc(e.summary)}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="sm" style="margin:0">Nothing yet. Changes made with Change driver, Change site, Renew and the history fixes show here.</p>'}</div>`;
  el('homeXl').onclick = homeExcel;
}
/* Full backup: one sheet per database table, every column, original ids kept, plus a "Read me" sheet.
   Row counts are checked against the database before the file is saved. */
const XL_TABLES = [
  ['vehicles','Every truck, trailer, vehicle and machine (own and hired). driver_id, site_id link to people and sites.'],
  ['people','Drivers and other staff.'],
  ['sites','Sites / yards.'],
  ['projects','Projects.'],
  ['paper_types','The list of paper names (registration, insurance, permits...).'],
  ['papers','Every paper of every vehicle: current (is_current = true) and earlier ones.'],
  ['board_history','Driver and site history of each vehicle (from / to dates).'],
  ['log_entries','Your history notes.'],
  ['tyres','Tyres.'],
  ['tyre_moves','Tyre fitting and removal movements.'],
  ['service_jobs','Service and maintenance jobs.'],
  ['fines','Traffic fines.'],
  ['diesel_lines','Diesel lines.'],
  ['suppliers','Hire suppliers.'],
  ['hire_terms','Hired-in terms (rates, periods).'],
  ['hire_postings','Hired-in postings.'],
  ['report_files','Which reports were loaded, and the dates they cover.'],
  ['name_spellings','Name spelling fixes.'],
  ['app_users','Who can log in and their role (passwords are private to Supabase and cannot be exported).'],
  ['change_log','Everything changed in the app (who, when, old and new values).']
];
async function xlPull(table){
  const out = []; let from = 0;
  for(;;){
    const { data, error } = await sb.from(table).select('*').order('id', { ascending: true }).range(from, from + 999);
    if(error) throw new Error(table + ': ' + error.message);
    out.push(...data); if(data.length < 1000) return out; from += 1000;
  }
}
async function xlCount(table){
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if(error) throw new Error(table + ': ' + error.message);
  return count;
}
async function homeExcelRun(){
  const X = window.XLSX, wb = X.utils.book_new(), readme = [], bad = [];
  const flat = v => v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
  const sheets = [];
  for(const [t, what] of XL_TABLES){
    const b = el('homeXl'); if(b) b.textContent = 'Preparing ' + t + '…';
    const rows = await xlPull(t), dbn = await xlCount(t);
    const cols = []; rows.forEach(r => Object.keys(r).forEach(k => { if(!cols.includes(k)) cols.push(k); }));
    const data = rows.map(r => { const o = {}; cols.forEach(k => { o[k] = flat(r[k]); }); return o; });
    const ws = data.length ? X.utils.json_to_sheet(data, { header: cols }) : X.utils.aoa_to_sheet([['(no rows in this table)']]);
    sheets.push([t, ws]);
    const ok = rows.length === dbn;
    if(!ok) bad.push(t);
    readme.push({ Sheet: t, 'What it holds': what, 'Rows in the database': dbn, 'Rows in this sheet': rows.length, Match: ok ? 'yes' : 'NO', Columns: cols.join(', ') });
  }
  const icons = window.ICONS_DATA || {}, inames = Object.keys(icons).sort();
  if(inames.length){
    sheets.push(['drawings', X.utils.json_to_sheet(inames.map(k => ({ drawing: k, picture: icons[k] })), { header: ['drawing', 'picture'] })]);
    readme.push({ Sheet: 'drawings', 'What it holds': 'The truck drawings used on the cards. "picture" is the PNG as text (data:image/png;base64,...): paste it into a browser address bar to see it, or decode the base64 part to get the file.', 'Rows in the database': '(in the page)', 'Rows in this sheet': inames.length, Match: 'yes', Columns: 'drawing, picture' });
  }
  if(typeof CLASS_ART !== 'undefined'){
    const m = Object.keys(CLASS_ART).map(k => ({ class: k, drawing: CLASS_ART[k] }));
    sheets.push(['drawing_by_class', X.utils.json_to_sheet(m, { header: ['class', 'drawing'] })]);
    readme.push({ Sheet: 'drawing_by_class', 'What it holds': 'Which drawing a class uses when its type has no drawing of its own.', 'Rows in the database': '(in the page)', 'Rows in this sheet': m.length, Match: 'yes', Columns: 'class, drawing' });
  }
  const now = new Date();
  const head = [{ Sheet: 'READ ME', 'What it holds': 'Full copy of the Fala Fleet App database, made ' + now.toLocaleString('en-GB') + ' by ' + ((window.MYEMAIL) || 'admin') + '. One sheet per table, all columns, original ids kept, plus the truck drawings: columns ending in _id point to the id column of another sheet: vehicle_id = vehicles, driver_id / second_driver_id / person_id = people, pulled_by_id = vehicles, site_id = sites, project_id = projects, paper_type_id = paper_types, supplier_id = suppliers, tyre_id = tyres, hire_terms_id = hire_terms, report_file_id = report_files.' }];
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(head.concat([{}], readme), { header: ['Sheet', 'What it holds', 'Rows in the database', 'Rows in this sheet', 'Match', 'Columns'] }), 'Read me');
  sheets.forEach(([t, ws]) => X.utils.book_append_sheet(wb, ws, t));
  if(bad.length) throw new Error('Row counts do not match for: ' + bad.join(', ') + '. File not saved.');
  const p = n => String(n).padStart(2, '0');
  X.writeFile(wb, `Fala Fleet FULL ${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}.xlsx`);
}
function homeExcel(){
  const b = el('homeXl'); b.disabled = true; b.textContent = 'Preparing…';
  const done = () => { b.disabled = false; b.textContent = 'Download Excel'; };
  const go2 = () => { homeExcelRun().then(done).catch(e => { alert('Could not make the Excel file: ' + e.message); done(); }); };
  if(window.XLSX) return go2();
  const s = document.createElement('script'); s.src = 'xlsx.js'; s.onload = go2;
  s.onerror = () => { done(); alert('Could not load the Excel maker.'); };
  document.head.appendChild(s);
}
if(window.MYROLE === 'admin') el('tabHome').style.display = '';
el('tabHome').onclick = ()=>{ location.hash='#home'; show('home', true); renderHome(); };

