
  /* ================= CHANGE DRIVER (editing on the card) =====================
     Opens a small window on a truck/equipment card; Save calls the database
     function change_driver, which moves the old driver into the history,
     sets the new one, and writes who changed it to the change log. */
  const CAN_EDIT = () => ['admin', 'editor'].includes(window.MYROLE || '');
  const ISO_TODAY = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
  const ISO_BEFORE = (iso) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - 1); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
  const changeBtn = (v) => CAN_EDIT() ? `<button type="button" class="btn" data-f="chgdrv" data-plate="${esc(v.plate)}" style="margin-left:auto">${v.driver ? 'Change' : 'Assign'} ${v.cls === 'Equipment' ? 'operator' : 'driver'}</button>` : '';

  function openChangeDriver(plate){
    const v = V[plate]; if(!v || document.getElementById('chgDlg')) return;
    const word = v.cls === 'Equipment' ? 'operator' : 'driver';
    const people = (window.APPPEOPLE || []).filter(p => p.passport_name && p.passport_name !== v.driver && p.status !== 'Left')
      .sort((a, b) => (a.passport_name < b.passport_name ? -1 : 1));
    const today = ISO_TODAY();
    const el2 = document.createElement('div');
    el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    el2.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="chgT" style="width:min(560px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Change ${word}</div>
        <h2 id="chgT" style="margin:4px 0 0;font-size:22px">${esc(v.plate)} <span class="sm" style="font-weight:400">· ${esc(v.type || v.cls)}</span></h2></div>
      <div class="sm" style="background:var(--soft,#f4f2ec);border-radius:10px;padding:11px 13px">${v.driver
        ? `On it now: <b>${esc(v.driver)}</b>${v.dsince ? ' since ' + fmt.format(parse(v.dsince)) : ''}` : `No ${word} on it now.`}</div>
      <div><label for="chgP" style="display:block;font-weight:600;font-size:13px;margin-bottom:5px">New ${word}</label>
        <select id="chgP" style="${fld}"><option value="">Choose…</option>${people.map(p => `<option value="${p.id}">${esc(p.passport_name)}${p.role ? ' — ' + esc(p.role) : ''}</option>`).join('')}</select></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:150px"><label for="chgS" style="display:block;font-weight:600;font-size:13px;margin-bottom:5px">Starts on</label>
          <input id="chgS" type="date" value="${today}" style="${fld}"></div>
        ${v.driver ? `<div style="flex:1;min-width:150px"><label for="chgE" style="display:block;font-weight:600;font-size:13px;margin-bottom:5px">Old ${word}'s last day</label>
          <input id="chgE" type="date" value="${ISO_BEFORE(today)}" style="${fld}"></div>` : ''}
      </div>
      <div><label for="chgN" style="display:block;font-weight:600;font-size:13px;margin-bottom:5px">Note <span class="sm" style="font-weight:400">(optional, kept with this change)</span></label>
        <input id="chgN" type="text" style="${fld}"></div>
      <div id="chgErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn" id="chgX">Cancel</button>
        <button type="button" class="btn" id="chgOk" style="background:var(--navy,#16315c);color:#fff">Save change</button></div></div>`;
    document.body.appendChild(el2);
    const close = () => el2.remove();
    el2.addEventListener('click', e => { if(e.target === el2) close(); });
    document.getElementById('chgX').onclick = close;
    const sEl = document.getElementById('chgS'), eEl = document.getElementById('chgE');
    sEl.addEventListener('change', () => { if(eEl && sEl.value) eEl.value = ISO_BEFORE(sEl.value); });
    document.getElementById('chgP').focus();
    document.getElementById('chgOk').onclick = async () => {
      const err = document.getElementById('chgErr'), btn = document.getElementById('chgOk');
      const pid = document.getElementById('chgP').value;
      if(!pid){ err.textContent = 'Choose the new ' + word + '.'; return; }
      if(!sEl.value){ err.textContent = 'Choose the start date.'; return; }
      btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
      const note = document.getElementById('chgN').value.trim();
      const { data, error } = await sb.rpc('change_driver', { p_vehicle: v._id, p_new: +pid, p_start: sEl.value,
        p_end: eEl && eEl.value ? eEl.value : null, p_note: note || null });
      if(error){ err.textContent = error.message; btn.disabled = false; btn.textContent = 'Save change'; return; }
      // bring this card up to date without reloading everything
      if(v.driver){
        v.drvlog = (v.drvlog || []).concat([{ n: v.driver, f: v.dsince || null, t: eEl && eEl.value ? eEl.value : null, note }])
          .sort((a, b) => { const x = a.t || a.f || '', y = b.t || b.f || ''; return x < y ? 1 : x > y ? -1 : 0; });
      }
      v.driver = data.new; v.dsince = sEl.value;
      close(); renderCard(plate);
      const host = el('fCard');
      if(host){
        const n = document.createElement('div');
        n.setAttribute('role', 'status');
        n.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
        n.textContent = `Saved. ${data.new} is now on ${plate}. Other pages (People, Renewals, Map) show it after you refresh the page.`;
        host.insertBefore(n, host.firstChild);
      }
    };
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-f="chgdrv"]');
    if(b) openChangeDriver(b.dataset.plate);
  });

