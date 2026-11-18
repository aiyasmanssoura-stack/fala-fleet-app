
  /* ================= HIRED IN: LANDSIDE GATE PASS (18 Nov 2026) ================
     Hired machines have no papers of their own on record (the supplier's), but a machine working at the airport
     needs a Landside Gate Pass, and so does its driver. The driver of a hired machine is not on our People list,
     so his pass is kept on the machine (paper type 'Hired driver Landside Pass'). Admin, Editor and AMIA Project Editor
     can enter or renew either date; renew_paper keeps the old row as history and logs who did it. */
  const HP_CAN = () => ['admin', 'editor', 'amia_editor'].includes(window.MYROLE || '');
  const HP_KINDS = [['pass', 'Landside Gate Pass', 'Machine', 'Landside Gate Pass'], ['dpass', 'Hired driver Landside Pass', 'Driver', 'Landside Gate Pass — driver']];
  window.hiredPassBox = (m) => {
    const cell = (key, tname, who, label) => {
      const p = m[key]; let line = '<span class="dash">not recorded</span>';
      if(p && p.exp){ const l = until(p.exp); line = `<b>${fmt.format(parse(p.exp))}</b> · ${l < 0 ? '<span style="color:var(--crit)">expired ' + (-l) + ' days ago</span>' : l + ' days left'}${p.ref ? ' · ref ' + esc(p.ref) : ''}`; }
      const who2 = who === 'Driver' ? ` <span class="sm">(${m.drv && m.drv.toUpperCase() !== 'NA' ? esc(m.drv) : 'driver not named'})</span>` : '';
      return `<div style="flex:1;min-width:230px"><div class="k">${label}${who2}</div><div class="v" style="font-weight:500">${line}</div>
        ${HP_CAN() ? `<button type="button" class="btn" data-hp="${key}" data-plate="${esc(m.plate)}" style="margin-top:8px;padding:6px 12px;min-height:32px;font-size:13px">${p && p.exp ? 'Renew' : 'Enter date'}</button>` : ''}</div>`;
    };
    return `<div style="display:flex;gap:22px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line,#d9d6cc)">${HP_KINDS.map(k => cell(k[0], k[1], k[2], k[3])).join('')}</div>`;
  };
  function openHiredPass(plate, key){
    const R = (window.APPDATA.HIRE || {}).rows || [];
    const m = R.find(r => r.plate === plate); if(!m || document.getElementById('chgDlg')) return;
    const kd = HP_KINDS.find(k => k[0] === key); const tid = (window.APPHTYPES || {})[kd[1]];
    if(!tid){ alert('This paper type is not loaded. Refresh the page.'); return; }
    const p = m[key];
    const el2 = document.createElement('div'); el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    let now = 'Nothing recorded yet.';
    if(p && p.exp){ const l = until(p.exp); now = `Now expires: <b>${fmt.format(parse(p.exp))}</b> · ${l < 0 ? 'expired ' + (-l) + ' days ago' : l + ' days left'}`; }
    const t = new Date(); t.setFullYear(t.getFullYear() + 1); const z = n => String(n).padStart(2, '0'); const nxt = `${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())}`;
    el2.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(560px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">${p && p.exp ? 'Renew' : 'Enter'} Landside Gate Pass</div>
        <h2 style="margin:4px 0 0;font-size:22px">${esc(m.plate)} <span class="sm" style="font-weight:400">· ${kd[2] === 'Driver' ? 'driver' + (m.drv && m.drv.toUpperCase() !== 'NA' ? ' ' + esc(m.drv) : '') : 'machine'}</span></h2></div>
      <div class="sm" style="background:var(--soft,#f4f2ec);border-radius:10px;padding:11px 13px">${now}</div>
      <div><label for="chgS" style="${lab}">Expiry date</label><input id="chgS" type="date" value="${nxt}" style="${fld}"></div>
      <div><label for="chgR" style="${lab}">Pass no. <span class="sm" style="font-weight:400">(optional, kept as before if empty)</span></label><input id="chgR" type="text" style="${fld}"></div>
      <div><label for="chgN" style="${lab}">Note <span class="sm" style="font-weight:400">(optional)</span></label><input id="chgN" type="text" style="${fld}"></div>
      <div id="chgErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="chgX">Cancel</button>
        <button type="button" class="btn" id="chgOk" style="background:var(--navy,#16315c);color:#fff">Save</button></div></div>`;
    document.body.appendChild(el2);
    const close = () => el2.remove(), err = document.getElementById('chgErr');
    el2.addEventListener('click', e => { if(e.target === el2) close(); });
    document.getElementById('chgX').onclick = close; document.getElementById('chgS').focus();
    document.getElementById('chgOk').onclick = async () => {
      const btn = document.getElementById('chgOk'), ex = document.getElementById('chgS').value;
      if(!ex){ err.textContent = 'Choose the expiry date.'; return; }
      btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
      const ref = document.getElementById('chgR').value.trim() || null, note = document.getElementById('chgN').value.trim() || null;
      const { error } = await sb.rpc('renew_paper', { p_vehicle: m.vid, p_type: tid, p_expiry: ex, p_ref: ref, p_note: note });
      if(error){ err.textContent = error.message; btn.disabled = false; btn.textContent = 'Save'; return; }
      m[key] = { exp: ex, ref: ref || (p ? p.ref : ''), note: note || '' };
      close(); window.openHired('card', m.plate);
    };
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-hp]'); if(b) openHiredPass(b.dataset.plate, b.dataset.hp); });

  /* ================= HIRED IN: CHANGE THE DRIVER'S NAME (18 Nov 2026) ============
     A small window with only the name. It saves through edit_machine_details like Machine details > Edit,
     sending every other value unchanged, so nothing else moves, and the change is written to the change log. */
  const HD_CAN = () => ['admin', 'editor'].includes(window.MYROLE || '');
  window.hiredDrvBtn = (m) => HD_CAN() ? `<button type="button" class="btn" data-hd="${esc(m.plate)}" style="margin-top:6px;padding:4px 10px;min-height:28px;font-size:12px">Change</button>` : '';
  function openHiredDriver(plate){
    const m = ((window.APPDATA.HIRE || {}).rows || []).find(r => r.plate === plate); if(!m || document.getElementById('chgDlg')) return;
    const cur = m.drv && m.drv.toUpperCase() !== 'NA' ? m.drv : '';
    const el2 = document.createElement('div'); el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    el2.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(480px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Driver / operator</div><h2 style="margin:4px 0 0;font-size:22px">${esc(m.plate)}</h2></div>
      <div class="sm" style="background:var(--soft,#f4f2ec);border-radius:10px;padding:11px 13px">Now: <b>${cur ? esc(cur) : 'not named'}</b></div>
      <div><label for="hdN" style="display:block;font-weight:600;font-size:13px;margin-bottom:5px">New name</label><input id="hdN" type="text" value="${esc(cur)}" style="${fld}"></div>
      <div id="chgErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="chgX">Cancel</button>
        <button type="button" class="btn" id="chgOk" style="background:var(--navy,#16315c);color:#fff">Save</button></div></div>`;
    document.body.appendChild(el2);
    const close = () => el2.remove(), err = document.getElementById('chgErr'), inp = document.getElementById('hdN');
    el2.addEventListener('click', e => { if(e.target === el2) close(); });
    document.getElementById('chgX').onclick = close; inp.focus(); inp.select();
    document.getElementById('chgOk').onclick = async () => {
      const nm = inp.value.trim(); if(nm === cur){ close(); return; }
      const btn = document.getElementById('chgOk'); btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
      const yr = m.year;
      const args = { p_vehicle: m.vid, p_number: m.number || null, p_type: m.type || null, p_make_model: m.make || null, p_year: yr === '' || yr == null ? null : Math.round(+yr),
        p_chassis: m.chassis || null, p_engine: m.engine || null, p_owner: m.owner || null, p_reason: null, p_supplier: m.sid || null, p_lpo: m.lpo || null,
        p_rate: m.rate == null || m.rate === '' ? null : +m.rate, p_operator: nm || null, p_start: m.start || null, p_end: m.end || null };
      const { error } = await sb.rpc('edit_machine_details', args);
      if(error){ err.textContent = error.message; btn.disabled = false; btn.textContent = 'Save'; return; }
      m.drv = nm; close(); window.openHired('card', m.plate);
    };
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-hd]'); if(b) openHiredDriver(b.dataset.hd); });
