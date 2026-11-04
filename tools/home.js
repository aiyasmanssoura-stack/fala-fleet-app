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
function homeExcel(){
  const b = el('homeXl'); b.disabled = true; b.textContent = 'Preparing…';
  const go2 = () => {
    try{
      const X = window.XLSX, dateKeys = ['Registration','Insurance','AMIA landside pass','Fujaira permit','FNRC WB tag'];
      const veh = Object.values(F.vehicles).map(v => {
        const r = {Plate:v.plate, Class:v.cls, Type:v.type, 'Fleet status':v.fleet, Site:v._yard||'', 'At site since':v.since||'', Driver:v.driver||'', 'Driver since':v.dsince||''};
        dateKeys.forEach(k => { const d = (v.dates||[]).find(x=>x.k===k); r[k] = d ? (d.st==='date' ? d.v : d.v||'') : ''; });
        return r;
      });
      const ppl = Object.values(F.persons || {});
      const log = (window.APPLOG||[]).map(e=>({When:homeWhen(e.at), Who:e.by_email||'', Type:e.kind, What:e.summary}));
      const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(veh), 'Vehicles');
      if(ppl.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(ppl), 'People');
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(log.length?log:[{When:'',Who:'',Type:'',What:''}]), 'Change log');
      const t = new Date(), p = n=>String(n).padStart(2,'0');
      X.writeFile(wb, `Fala Fleet ${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}.xlsx`);
    }catch(e){ alert('Could not make the Excel file: ' + e.message); }
    b.disabled = false; b.textContent = 'Download Excel';
  };
  if(window.XLSX) return go2();
  const s = document.createElement('script'); s.src = 'xlsx.js'; s.onload = go2;
  s.onerror = () => { b.disabled = false; b.textContent = 'Download Excel'; alert('Could not load the Excel maker.'); };
  document.head.appendChild(s);
}
if(window.MYROLE === 'admin') el('tabHome').style.display = '';
el('tabHome').onclick = ()=>{ location.hash='#home'; show('home', true); renderHome(); };

