
  /* ================= EDIT A DRIVER'S DETAILS (17 Nov 2026) =====================
     Admin only. Status Active / On Leave / Left, dates, role, employee no., note.
     Marking someone Left does not take him off his vehicle; the form lists the plates so Change driver can be used. */
  window.pedBtn = (name) => ((window.MYROLE||'') === 'admin' && D.persons[name] && D.persons[name]._id)
    ? `<button type="button" class="btn" data-ped="${esc(name)}" style="padding:6px 12px;min-height:32px;font-size:13px">Edit details</button>` : '';
  function openPersonEdit(name){
    const p = D.persons[name]; if(!p || document.getElementById('chgDlg')) return;
    const el2 = document.createElement('div'); el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    const plates = Object.values(V).filter(v => v.driver === name || v.driver2 === name || (v.driver2x||[]).includes(name)).map(v => v.plate);
    const st0 = p.Status === 'Left' ? 'Left' : (/leave/i.test(p.Status||'') ? 'On Leave' : 'Active');
    const f = (id, l, v, t) => `<div><label for="${id}" style="${lab}">${l}</label><input id="${id}" type="${t||'text'}" value="${esc(v||'')}" style="${fld}"></div>`;
    el2.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(560px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;max-height:92vh;overflow:auto">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Edit driver details</div>
        <h2 style="margin:4px 0 0;font-size:22px">${esc(name)}</h2></div>
      <div><label for="pdSt" style="${lab}">Status</label><select id="pdSt" style="${fld}">
        <option value="Active">Active</option><option value="On Leave">On leave</option><option value="Left">Left the company</option></select></div>
      <div id="pdWarn" class="sm" style="display:none;background:#fff4e0;border:1px solid #f0d49a;border-radius:10px;padding:11px 13px"></div>
      <div id="pdLeft">${f('pdLeftD','Last working day',p['Left date'],'date')}</div>
      <div id="pdLv" style="display:flex;flex-direction:column;gap:14px">${f('pdLvF','Leave from',p['Leave from'],'date')}${f('pdLvT','Leave to (empty if not known)',p['Leave to'],'date')}${f('pdLvN','Leave note',p['Leave note'])}</div>
      ${f('pdRole','Role',p.Role)}${f('pdEmp','Employee no.',p['Fala Employee No'])}${f('pdNote','Note',p.Note)}
      <div id="chgErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="chgX">Cancel</button>
        <button type="button" class="btn" id="chgOk" style="background:var(--navy,#16315c);color:#fff">Save change</button></div></div>`;
    document.body.appendChild(el2);
    const $ = id => document.getElementById(id), close = () => el2.remove();
    $('pdSt').value = st0;
    const sync = () => { const s = $('pdSt').value; $('pdLeft').style.display = s === 'Left' ? '' : 'none'; $('pdLv').style.display = s === 'On Leave' ? 'flex' : 'none';
      const w = $('pdWarn'); if(s === 'Left' && plates.length){ w.style.display = ''; w.innerHTML = `Still the driver of <b>${plates.map(esc).join(', ')}</b>. Saving does not remove him from the vehicle; use <b>Change driver</b> on the vehicle afterwards.`; } else w.style.display = 'none'; };
    $('pdSt').onchange = sync; sync();
    el2.addEventListener('click', e => { if(e.target === el2) close(); }); $('chgX').onclick = close;
    $('chgOk').onclick = async () => {
      const btn = $('chgOk'), err = $('chgErr'), s = $('pdSt').value, nv = id => $(id).value.trim() || null;
      btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
      const { error } = await sb.rpc('edit_person_details', { p_person: p._id, p_status: s, p_left: s === 'Left' ? nv('pdLeftD') : null,
        p_leave_from: s === 'On Leave' ? nv('pdLvF') : null, p_leave_to: s === 'On Leave' ? nv('pdLvT') : null, p_leave_note: s === 'On Leave' ? nv('pdLvN') : null,
        p_role: $('pdRole').value, p_emp: nv('pdEmp'), p_note: nv('pdNote') });
      if(error){ err.textContent = error.message; btn.disabled = false; btn.textContent = 'Save change'; return; }
      p.Status = s; p.Role = $('pdRole').value.trim(); p['Fala Employee No'] = $('pdEmp').value.trim(); p.Note = $('pdNote').value.trim();
      if(s === 'Left'){ p['Left date'] = $('pdLeftD').value; p['Start / Leave'] = $('pdLeftD').value; }
      if(s === 'On Leave'){ p['Leave from'] = $('pdLvF').value; p['Leave to'] = $('pdLvT').value; p['Leave note'] = $('pdLvN').value.trim(); }
      close(); personCard(name);
      const host = el('fPerson');
      if(host){ const n = document.createElement('div'); n.setAttribute('role', 'status');
        n.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
        n.textContent = `Saved. ${name} is now ${s === 'Left' ? 'marked as left' : s === 'On Leave' ? 'on leave' : 'active'}. The Drivers lists show it after you refresh the page.`;
        host.insertBefore(n, host.firstChild); }
    };
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ped]'); if(b) openPersonEdit(b.dataset.ped); });

  /* ---- Add a driver / operator (admin) ---- */
  function openPersonAdd(){
    if(document.getElementById('chgDlg')) return;
    const el2 = document.createElement('div'); el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    const uniq = k => [...new Set(Object.values(D.persons).map(x => (x[k]||'').trim()).filter(Boolean))].sort();
    const f = (id, l, t, list) => `<div><label for="${id}" style="${lab}">${l}</label><input id="${id}" type="${t||'text'}" ${list?`list="${id}L"`:''} style="${fld}">${list?`<datalist id="${id}L">${list.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`:''}</div>`;
    el2.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(560px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;max-height:92vh;overflow:auto">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Add driver / operator</div>
        <h2 style="margin:4px 0 0;font-size:22px">New person</h2></div>
      ${f('paName','Name as on the passport')}
      <div><label for="paSec" style="${lab}">Group</label><select id="paSec" style="${fld}"><option value="Drivers">Drivers</option><option value="Operators">Operators</option><option value="Staff">Staff</option></select></div>
      ${f('paRole','Role (choose or type)','text',uniq('Role'))}${f('paEmp','Employer','text',uniq('Employer'))}
      ${f('paNo','Employee no. (optional)')}${f('paCode','Code (optional)')}${f('paStart','Start date (optional)','date')}${f('paNote','Note (optional)')}
      <div id="chgErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="chgX">Cancel</button>
        <button type="button" class="btn" id="chgOk" style="background:var(--navy,#16315c);color:#fff">Add</button></div></div>`;
    document.body.appendChild(el2);
    const $ = id => document.getElementById(id), close = () => el2.remove(), nv = id => $(id).value.trim() || null;
    el2.addEventListener('click', e => { if(e.target === el2) close(); }); $('chgX').onclick = close; $('paName').focus();
    $('chgOk').onclick = async () => {
      const btn = $('chgOk'), err = $('chgErr'); btn.disabled = true; btn.textContent = 'Adding…'; err.textContent = '';
      const { data, error } = await sb.rpc('add_person', { p_name: $('paName').value, p_section: $('paSec').value, p_role: $('paRole').value, p_employer: nv('paEmp'),
        p_emp: nv('paNo'), p_code: nv('paCode'), p_start: nv('paStart'), p_note: nv('paNote') });
      if(error){ err.textContent = error.message; btn.disabled = false; btn.textContent = 'Add'; return; }
      const nm = data.name;
      D.persons[nm] = { _id: data.id, 'Name (as per passport)': nm, 'Code': $('paCode').value.trim(), 'Role': $('paRole').value.trim(), 'Status': 'Active',
        'Fala Employee No': $('paNo').value.trim(), 'Employer': $('paEmp').value.trim(), 'Start / Leave': $('paStart').value, 'Licence Expiry': '', 'Diesel Tanker Permit (DCDD)': '',
        'Landside Gate Pass': '', 'Leave note': '', 'Left date': '', 'Note': $('paNote').value.trim(), 'Leave from': '', 'Leave to': '', 'Airside Driving Permit': '' };
      close(); location.hash = '#p/' + encodeURIComponent(nm);
      setTimeout(() => { const host = el('fPerson'); if(host){ const n = document.createElement('div'); n.setAttribute('role', 'status');
        n.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
        n.textContent = `Saved. ${nm} is added. Add his papers below, and set his vehicle with Change driver on the vehicle. The Drivers lists show him after you refresh the page.`;
        host.insertBefore(n, host.firstChild); } }, 150);
    };
  }
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('#uAddBtn')) openPersonAdd(); });
  (function showAdd(n){ const h = document.getElementById('uAdd'); if(!h) return;
    if((window.MYROLE||'') === 'admin'){ h.innerHTML = '<button type="button" class="btn" id="uAddBtn" style="margin:2px 0 14px;background:var(--navy,#16315c);color:#fff">+ Add driver / operator</button>'; }
    else if(window.MYROLE === undefined && n < 40) setTimeout(() => showAdd(n + 1), 500); })(0);
