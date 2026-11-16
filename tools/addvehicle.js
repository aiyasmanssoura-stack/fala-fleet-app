
  /* ================= ADD A VEHICLE (17 Nov 2026) ================================
     Admin only. Own fleet. add_vehicle creates it; the starting site and driver go through the same
     change_site / change_driver the vehicle card uses, so their history is written the normal way. */
  function openVehicleAdd(){
    if(document.getElementById('chgDlg')) return;
    const el2 = document.createElement('div'); el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    const own = Object.values(V).filter(v => v.fleet !== 'Out of fleet');
    const uniq = k => [...new Set(own.map(x => (x[k]||'').trim()).filter(Boolean))].sort();
    const f = (id, l, t, list) => `<div><label for="${id}" style="${lab}">${l}</label><input id="${id}" type="${t||'text'}" ${list?`list="${id}L"`:''} style="${fld}">${list?`<datalist id="${id}L">${list.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`:''}</div>`;
    const sel = (id, l, opts, first) => `<div><label for="${id}" style="${lab}">${l}</label><select id="${id}" style="${fld}">${first?`<option value="">${first}</option>`:''}${opts.map(o=>`<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select></div>`;
    const classes = ['3XL Truck','Six Wheel','Trailer','Special Trailer','Equipment','Car / Light Vehicle','Other Vehicle'];
    const sites = (window.APPSITES||[]).slice().sort((a,b)=>a.name<b.name?-1:1).map(s=>[s.id,s.name]);
    const drivers = (window.APPPEOPLE||[]).filter(p=>p.status==='Active'&&p.role).sort((a,b)=>a.passport_name<b.passport_name?-1:1).map(p=>[p.id,p.passport_name]);
    el2.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(600px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;max-height:92vh;overflow:auto">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Add vehicle</div>
        <h2 style="margin:4px 0 0;font-size:22px">New vehicle in our fleet</h2></div>
      ${f('avNo','Plate or asset no.')}
      ${sel('avNt','Number is a',[['Plate','Plate'],['Asset tag','Asset tag'],['Serial','Serial']])}
      ${sel('avCls','Class',classes.map(c=>[c,c]),'Choose…')}
      ${f('avType','Type (choose or type)','text',uniq('type'))}
      ${f('avMake','Make and model')}${f('avYear','Year','number')}${f('avCh','Chassis no.')}${f('avEng','Engine no.')}
      ${f('avOwn','Registered to','text',uniq('owner'))}
      ${sel('avEm','Emirate of registration',['Dubai','Abu Dhabi','Sharjah','Ajman','Umm Al Quwain','Ras Al Khaimah','Fujairah'].map(c=>[c,c]),'Not known')}
      ${f('avTr','GPS / tracking (optional)','text',['Diesel sensor','UD Original','None'])}
      ${sel('avSite','Starting site (optional)',sites,'None yet')}
      ${sel('avDrv','Driver (optional)',drivers,'None yet')}
      <div id="chgErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="chgX">Cancel</button>
        <button type="button" class="btn" id="chgOk" style="background:var(--navy,#16315c);color:#fff">Add vehicle</button></div></div>`;
    document.body.appendChild(el2);
    const $ = id => document.getElementById(id), close = () => el2.remove(), nv = id => $(id).value.trim() || null;
    el2.addEventListener('click', e => { if(e.target === el2) close(); }); $('chgX').onclick = close; $('avNo').focus();
    $('chgOk').onclick = async () => {
      const btn = $('chgOk'), err = $('chgErr'); btn.disabled = true; btn.textContent = 'Adding…'; err.textContent = '';
      const { data, error } = await sb.rpc('add_vehicle', { p_number: $('avNo').value, p_number_type: $('avNt').value, p_class: $('avCls').value, p_type: $('avType').value,
        p_make: nv('avMake'), p_year: $('avYear').value ? +$('avYear').value : null, p_chassis: nv('avCh'), p_engine: nv('avEng'), p_owner: nv('avOwn'), p_emirate: nv('avEm'), p_tracking: nv('avTr') });
      if(error){ err.textContent = error.message; btn.disabled = false; btn.textContent = 'Add vehicle'; return; }
      const today = new Date().toISOString().slice(0, 10), warn = [];
      if($('avSite').value){ const r = await sb.rpc('change_site', { p_vehicle: data.id, p_new: +$('avSite').value, p_start: today, p_end: null, p_note: 'Starting site' }); if(r.error) warn.push('site: ' + r.error.message); }
      if($('avDrv').value){ const r = await sb.rpc('change_driver', { p_vehicle: data.id, p_new: +$('avDrv').value, p_start: today, p_end: null, p_note: 'First driver' }); if(r.error) warn.push('driver: ' + r.error.message); }
      const d = el2.firstElementChild;
      d.innerHTML = `<div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Saved</div>
        <h2 style="margin:4px 0 0;font-size:22px">${esc(data.number)} is added</h2></div>
        <p style="margin:0">Open the vehicle and use <b>Renew</b> on Registration and Insurance to enter their expiry dates.</p>
        ${warn.length ? `<p class="sm" style="margin:0;color:#b3261e">Added, but not saved: ${esc(warn.join('; '))}. Use Change site or Change driver on the card.</p>` : ''}
        <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="avOpen" style="background:var(--navy,#16315c);color:#fff">Open vehicle</button></div>`;
      document.getElementById('avOpen').onclick = () => { location.hash = '#v/' + encodeURIComponent(data.number); location.reload(); };
    };
  }
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('#vAddBtn')) openVehicleAdd(); });
  (function showVAdd(n){ const h = document.getElementById('vAdd'); if(!h) return;
    if((window.MYROLE||'') === 'admin'){ h.innerHTML = '<button type="button" class="btn" id="vAddBtn" style="margin:2px 0 14px;background:var(--navy,#16315c);color:#fff">+ Add vehicle</button>'; }
    else if(window.MYROLE === undefined && n < 40) setTimeout(() => showVAdd(n + 1), 500); })(0);
