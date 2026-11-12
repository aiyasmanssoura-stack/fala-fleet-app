  /* ================= NEW CARD LAYOUT (5 Nov 2026) ============================
     Header + tabs. Overview shows everything at a glance in three columns; the
     other tabs reuse the existing panels, so nothing is lost. */
  /* GPS card (13 Nov 2026): map, odometer and address from the GPS site, in the middle column above Compliance.
     The Refresh button asks the gps-sync function (Admin / Editor) to read the GPS site and save fresh values. */
  function gpsCard(v){
    const g = (window.APPGPS || {})[v._id];
    if(!g || g.latitude == null) return '';
    const tz = {timeZone:'Asia/Dubai', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:false};
    const when = x => x ? new Date(x).toLocaleString('en-GB', tz) : '—';
    const on = g.status === 'online';
    const move = g.parking ? 'Parked' : (g.speed_kmh > 0 ? 'Moving · ' + Math.round(g.speed_kmh) + ' km/h' : 'Stopped');
    const q = g.latitude + ',' + g.longitude;
    return `<div class="panel gpsbox"><div class="ph"><h3>GPS · ${esc(g.tracker_name)}</h3>
      <span class="pill ${on?'p-ok':'p-gap'}">${on?'Online':'Offline'}</span><span class="pill p-gap">${esc(move)}${g.ignition===false?' · ignition off':g.ignition?' · ignition on':''}</span></div>
      <div class="gpsgrid">
        <iframe class="gpsmap" loading="lazy" referrerpolicy="no-referrer" title="Truck position" src="https://maps.google.com/maps?q=${q}&z=16&output=embed"></iframe>
        <div>
          <div class="gpsrow"><div class="lbl">Odometer</div><div class="v"><b>${g.odometer_km==null?'—':NUM.format(Math.round(g.odometer_km))+' km'}</b></div></div>
          <div class="gpsrow"><div class="lbl">Location</div><div class="v">${g.address?esc(g.address.replace(/, United Arab Emirates$/,'')):'<span class="dash">no address</span>'}</div></div>
          <div class="gpsrow"><div class="lbl">Coordinates</div><div class="v mono">${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}</div></div>
          <div class="gpsrow"><div class="lbl">Last GPS fix</div><div class="v">${esc(when(g.fix_time))}</div></div>
          <div class="gpsrow"><div class="lbl">Refreshed</div><div class="v">${esc(when(g.synced_at))}</div></div>
        </div></div>
      <div class="linkrow"><a class="btn" href="https://www.google.com/maps?q=${q}" target="_blank" rel="noopener">Open in Google Maps</a>
        ${CAN_EDIT() ? '<button type="button" class="btn" data-gpsrefresh="1">Refresh</button>' : ''}<span class="sm" id="gpsMsg" style="color:var(--crit)"></span></div></div>`;
  }
  document.addEventListener('click', async e=>{
    const b = e.target.closest && e.target.closest('[data-gpsrefresh]'); if(!b) return;
    const msg = document.getElementById('gpsMsg'); b.disabled = true; b.textContent = 'Refreshing…'; if(msg) msg.textContent = '';
    try{
      const r = await sb.functions.invoke('gps-sync');
      if(r.error){ let t = r.error.message; try{ const j = await r.error.context.json(); if(j && j.error) t = j.error; }catch(_){} throw new Error(t); }
      const g = await sb.from('gps_positions').select('*'); if(g.error) throw g.error;
      window.APPGPS = {}; g.data.forEach(x=>{ window.APPGPS[x.vehicle_id] = x; });
      renderCard(window.__curPlate);
    }catch(err){ b.disabled = false; b.textContent = 'Refresh'; const m = document.getElementById('gpsMsg'); if(m) m.textContent = err.message || String(err); }
  });
  function renderCard(plate){
    window.__curPlate = plate;
    const v = V[plate];
    if(!v) return renderCardOld(plate);
    const [uk,uw,uy] = updLine(v), [pc,ptxt] = pillFor(v);
    const site = D.sites[v.site], kids = v.kids.map(k=>V[k]).filter(Boolean);
    const code = v.code && !['?','NA','N/A'].includes(v.code.toUpperCase());
    const live = v.dates.filter(d=>state(d) !== 'na');
    const ex = live.filter(d=>state(d)==='ex'), so = live.filter(d=>state(d)==='so');
    const rec = nRec(v.plate), tick = rec ? rec.tickets.length : 0, acc = rec ? rec.accidents.length : 0;
    const nTy = Object.keys(v.tyres || {}).length, nSv = (v.svc || []).length, dz = v.diesel || [];
    const dzM = dz.length ? dz.filter(r=>r.f===dz[0].f).reduce((a,r)=>a+(r.l||0),0) : null;
    const btn = (f,t) => CAN_EDIT() ? `<button type="button" class="btn" data-f="${f}" data-plate="${esc(v.plate)}">${t}</button>` : '';
    const isTrailer = v.cls === 'Trailer', word = v.cls === 'Equipment' ? 'operator' : 'driver';
    const dt = x => x ? fmt.format(parse(x)) : '<span class="dash">not recorded</span>';

    const who = v.driver && D.persons[v.driver] ? `<div class="panel">
      <div class="ph"><h3>Who runs it</h3></div>${person(v.driver)}
      ${[v.driver2,...(v.driver2x||[])].filter(n=>n && D.persons[n]).map(n=>`<div style="margin-top:13px;border-top:1px solid var(--line);padding-top:13px">
        <div class="lbl" style="margin-bottom:7px">Second driver</div>${person(n)}</div>`).join('')}</div>` : '';

    const assign = `<div class="panel"><div class="ph"><h3>Assignment</h3></div><div class="ckv">
      ${isTrailer ? '' : `<div><div class="lbl">${word[0].toUpperCase()+word.slice(1)}</div><div class="v">${v.driver
        ? `<b>${esc(v.driver)}</b><div class="sm">${v.dsince ? 'since ' + fmt.format(parse(v.dsince)) + ' · ' + ago(v.dsince) + ' days' : 'start date not recorded'}</div>` : '<span class="dash">none</span>'}</div></div>`}
      <div><div class="lbl">Site</div><div class="v">${v.site ? esc(v.site) + (site && site.what ? ` — ${esc(site.what)}` : '') : '<span class="dash">not set</span>'}
        ${v.since ? `<div class="sm">since ${fmt.format(parse(v.since))} · ${ago(v.since)} days</div>` : ''}</div></div>
      ${v.trailer ? `<div><div class="lbl">Pulled by</div><div class="v"><a data-f="card" data-plate="${esc(v.trailer)}" style="color:var(--brand);cursor:pointer">${esc(v.trailer)}</a></div></div>` : ''}
      ${kids.length ? `<div><div class="lbl">Trailer</div><div class="v">${kids.map(k=>`<a data-f="card" data-plate="${esc(k.plate)}" style="color:var(--brand);cursor:pointer">${esc(k.plate)}</a>`).join(', ')}</div></div>` : ''}
      ${v.note ? `<div><div class="lbl">Note</div><div class="v sm">${esc(v.note)}</div></div>` : ''}</div>
      ${CAN_EDIT() ? `<div class="linkrow" style="margin-top:12px">${isTrailer ? '' : btn('chgdrv', 'Change ' + word)}${btn('chgsite', 'Change site')}</div>` : ''}</div>`;

    const tagRows = (v.tags || []).filter(t=>t.v && !['NA','N/A'].includes(t.v.toUpperCase()));
    const details = `<div class="panel"><div class="ph"><h3>Details</h3></div><div class="ckv">
      ${v.chassis ? `<div><div class="lbl">Chassis no</div><div class="v mono">${esc(v.chassis)}</div></div>` : ''}
      ${v.engine && !['NA','N/A'].includes(v.engine.toUpperCase()) ? `<div><div class="lbl">Engine no</div><div class="v mono">${esc(v.engine)}</div></div>` : ''}
      ${v.owner ? `<div><div class="lbl">Registered to</div><div class="v">${esc(v.owner)}</div></div>` : ''}
      ${tagRows.map(t=>`<div><div class="lbl">${esc(t.k)}</div><div class="v mono">${esc(t.v)}</div></div>`).join('')}</div></div>`;

    const kpi = (l,n,cls) => `<div class="ckpi"><div class="lbl">${l}</div><b class="${cls||''}">${n}</b></div>`;
    const strip = `<div class="panel ckpis">${kpi('Papers', ex.length ? ex.length + ' expired' : so.length ? so.length + ' due soon' : 'all valid', ex.length ? 'bad' : so.length ? 'warn' : '')}
      ${kpi('Service', nSv + ' job' + (nSv===1?'':'s'))}${kpi('Diesel', dzM === null ? '—' : NUM.format(Math.round(dzM)) + ' L')}
      ${kpi('Fines', tick + acc ? (tick + acc) + ' on record' : 'none')}${kpi('Tyres', nTy || '—')}</div>`;

    const statusPill = d => { const s = state(d), l = d.st==='date' ? until(d.v) : null;
      if(s==='ex') return `<span class="pill p-crit">Expired ${-l} day${-l===1?'':'s'}</span>`;
      if(s==='so') return `<span class="pill p-warn">${l} day${l===1?'':'s'} left</span>`;
      if(s==='ok') return `<span class="pill p-ok">${l} days left</span>`;
      if(s==='task') return '<span class="pill p-task">TASK</span>';
      return `<span class="pill p-gap">${s==='note' ? 'noted' : 'not recorded'}</span>`; };
    const order = {ex:0, so:1, task:2, note:3, blank:4, ok:5};
    const comp = `<div class="panel"><div class="ph"><h3>Compliance</h3></div><div class="scroll"><table>
      <thead><tr><th>Paper</th><th class="n">Expires</th><th>Status</th><th></th></tr></thead><tbody>
      ${live.slice().sort((a,b)=>order[state(a)]-order[state(b)]).map(d=>`<tr><td><b>${esc(d.k)}</b></td>
        <td class="n id">${d.st==='date' ? fmt.format(parse(d.v)) : (d.st==='note' ? esc(d.v) : '<span class="dash">—</span>')}</td>
        <td>${statusPill(d)}</td><td class="n">${CAN_EDIT() && d.tid ? `<button type="button" class="btn" data-f="renew" data-vid="${d.vid}" data-tid="${d.tid}" style="padding:3px 10px;min-height:28px;font-size:12px">Renew</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;

    const attn = [...ex.map(d=>`<div class="catt"><span class="pill p-crit">Expired</span> ${esc(d.k)} — ${-until(d.v)} days ago</div>`),
      ...so.map(d=>`<div class="catt"><span class="pill p-warn">Soon</span> ${esc(d.k)} — ${until(d.v)} days</div>`),
      ...live.filter(d=>state(d)==='task').map(d=>`<div class="catt"><span class="pill p-task">TASK</span> ${esc(d.k)}</div>`)];
    const attnP = `<div class="panel"><div class="ph"><h3>Needs attention</h3></div>${attn.length ? attn.join('') : '<p class="sm" style="margin:0">Nothing needs attention.</p>'}</div>`;

    const log = (window.APPLOG || []).filter(e=>e.vehicle_id === v._id).slice(0, 6);
    const activity = IS_ADMIN() ? `<div class="panel"><div class="ph"><h3>Recent activity</h3></div>${log.length
      ? log.map(e=>`<div class="catt"><b>${esc(e.summary.replace(/^[^:]*:\s*/, ''))}</b><div class="sm">${esc(homeWhen(e.at))} · ${esc(homeWho(e.by_email))}</div></div>`).join('')
      : '<p class="sm" style="margin:0">No change made in the app yet.</p>'}</div>` : '';

    const overview = `<div class="cgrid"><div class="ccol">${assign}${details}</div>
      <div class="ccol">${strip}${gpsCard(v)}${comp}${driverLogPanel(v)}</div><div class="ccol">${attnP}${activity}</div></div>`;

    const coupled = kids.map(k=>`<div class="coupled">
        <div class="cphead"><img class="cpart" src="${ARTFOR(k)}" alt=""><div style="min-width:0">
          <div class="cplbl">Coupled today</div><div class="cpname">${esc(k.plate)}${k.high?' <span class="pill p-brand">HIGH body</span>':''}</div>
          <div class="sm">${[k.type,k.model,k.year].filter(Boolean).map(esc).join(' · ')}</div></div>
          <a class="btn" data-f="card" data-plate="${esc(k.plate)}">Open its own card →</a></div>
        <p class="cpnote">Everything below belongs to <b>the trailer</b>, not to ${esc(v.plate)}. It is here because the two are hitched together today.</p>
        ${k.cond?`<div class="banner crit" style="margin:0 3px 10px"><b>${esc(k.cond)}:</b> ${esc(k.cnote||'')}</div>`:''}
        ${block(k, true)}${tyrePanel(k, true)}</div>`).join('');
    const pulled = v.trailer ? `<div class="panel"><div class="ph"><h3>Pulled by</h3></div>
      <p class="cap" style="margin:0">This trailer travels behind <b>${esc(v.trailer)}</b> today. Its gate passes and its driver belong to that truck.</p>
      <div class="linkrow"><a class="btn" data-f="card" data-plate="${esc(v.trailer)}">Open ${esc(v.trailer)} →</a></div></div>` : '';

    const none = '<p class="cap">Nothing on record.</p>';
    const tabs = [
      {k:'ov', t:'Overview', h:overview},
      {k:'pp', t:'Papers', n:ex.length, hot:true, h:block(v, false)},
      {k:'ps', t:'People & sites', h:(who + assign) || none},
      ...((kids.length || v.trailer) ? [{k:'tl', t:'Trailer', h:coupled + pulled}] : []),
      {k:'ty', t:'Tyres', n:nTy, h:tyrePanel(v, false)},
      {k:'sv', t:'Service and maintenance', n:nSv, h:servicePanel(v)},
      {k:'di', t:'Diesel', h:dieselPanel(v) || none},
      {k:'fi', t:'Fines', n:tick + acc, h:finesPanel(v) + accidentPanel(v)},
      {k:'hi', t:'History', h:(driverLogPanel(v) + sitesPanel(v)) || none}
    ];
    const cur = (window.__cardTab && tabs.some(t=>t.k===window.__cardTab.k && window.__cardTab.p===v.plate)) ? window.__cardTab.k : 'ov';

    el('fCard').innerHTML = `
    <p style="margin:0 0 10px"><a class="btn" data-f="list" data-back="1" data-cls="${esc(v.cls)}">&larr; Back to ${esc(v.cls)}</a></p>
    <div class="vhead">
      <div><div class="shot"><img src="${ARTFOR(v)}" alt="${esc(v.type)}"></div></div>
      <div>
        <div class="vtitle"><span class="pl">${esc(v.plate)}</span>${code?`<span class="code">${esc(v.code)}</span>`:''}<span class="pill ${pc}">${ptxt}</span></div>
        <p class="vsub"><b>${esc(v.type)}</b> · ${esc(v.cls)}${v.model?' · '+esc(v.model):''}${v.year?' · '+esc(v.year):''}</p>
        <div class="vpills">
          ${v.fleet?`<span class="pill ${v.fleet==='In fleet'?'p-ok':'p-gap'}">${esc(v.fleet)}</span>`:''}
          ${v.site?`<span class="pill p-gap">At ${esc(v.site)}</span>`:'<span class="pill p-task">No location</span>'}
          ${v.gps==='Active'?'<a class="pill p-brand" href="#lists/gps" title="All vehicles with GPS">GPS active</a>':''}
          ${v.gps==='UD Active'?'<a class="pill p-brand" href="#lists/gps" title="All vehicles with GPS">GPS (UD)</a>':''}
          ${(v.tags||[]).some(t=>t.k==='Diesel Sensor'&&t.v==='Installed')?'<a class="pill p-brand" href="#lists/diesel" title="All vehicles with a diesel sensor">Diesel sensor</a>':''}
          ${(v.tags||[]).some(t=>t.k==='Diesel Sensor'&&t.v==='UD Original')?'<a class="pill p-brand" href="#lists/diesel" title="All vehicles with a diesel sensor">Diesel sensor (UD)</a>':''}
          ${v.high?'<span class="pill p-brand">HIGH body</span>':''}
          ${v.cond?`<span class="pill p-crit">${esc(v.cond)}${v.cnote?' — '+esc(v.cnote):''}</span>`:''}
          ${!v.onboard?'<span class="pill p-gap">not on the daily board</span>':''}
        </div>
        <div class="upd ${uk}"><span class="lbl">Last updated</span><b>${esc(uw)}</b><span class="sm">${esc(uy)}</span></div>
      </div>
    </div>
    <div class="ctabs" role="tablist">${tabs.map(t=>`<button type="button" role="tab" class="ctab${t.k===cur?' on':''}" data-ctab="${t.k}" aria-selected="${t.k===cur}">${esc(t.t)}${t.n?` <span class="cn${t.hot?' hot':''}">${t.n}</span>`:''}</button>`).join('')}</div>
    ${tabs.map(t=>`<div class="cpane" data-pane="${t.k}"${t.k===cur?'':' hidden'}>${t.h && t.h.trim() ? t.h : none}</div>`).join('')}`;
    window.__cardTab = {k:cur, p:v.plate};
  }
  document.addEventListener('click', e=>{
    const b = e.target.closest && e.target.closest('[data-ctab]'); if(!b) return;
    const k = b.dataset.ctab;
    document.querySelectorAll('#fCard [data-ctab]').forEach(x=>{ const on = x.dataset.ctab===k; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    document.querySelectorAll('#fCard [data-pane]').forEach(x=>{ x.hidden = x.dataset.pane!==k; });
    window.__cardTab = {k, p: window.__curPlate};
  });

