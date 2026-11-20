  /* ================= MACHINE DETAILS (15 Nov 2026) ============================
     One box on hired machine cards and own equipment cards: type, make and model, year, serial / chassis,
     plate or asset number, and (hired only) supplier, LPO, monthly rate, operator, hire start and end.
     Edit saves through edit_machine_details (Admin / Editor). Every save is written to the change log. Any box may stay empty. */
  const mdE = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const mdD = x => x ? new Date(x + 'T00:00:00').toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '';
  const mdCan = () => ['admin', 'editor'].includes(window.MYROLE || '');
  function mdBox(kind, key, f){
    const cell = (l, v, empty) => `<div><div class="lbl">${l}</div><div class="v">${v !== '' && v != null ? mdE(v) : `<span class="dash">${empty || 'not filled'}</span>`}</div></div>`;
    const hired = kind === 'hired';
    return `<div class="panel" id="mdBox"><div class="ph"><h3>Machine details</h3>
      ${mdCan() ? `<button type="button" class="btn" data-md="${kind}" data-key="${mdE(key)}" style="margin-left:auto">Edit</button>` : ''}</div>
      <div class="ckv">
        ${cell('Type', f.type)}${cell('Make and model', f.make)}${cell('Year', f.year)}
        ${cell('Serial / chassis no.', f.chassis)}${cell('Plate or asset no.', f.number)}${cell('Engine no.', f.engine)}${cell('Registered to', f.owner)}
        ${hired ? cell('Supplier', f.firm) + cell('LPO no.', f.lpo) + (window.NOMONEY ? '' : cell('Monthly rate', f.rate != null && f.rate !== '' ? 'AED ' + Number(f.rate).toLocaleString('en-GB') : ''))
          + cell('Operator', f.op) + cell('Hire start', mdD(f.start)) + cell('Hire end', mdD(f.end), 'still hired') : ''}
      </div>${mdOld(key)}${mdPending(key)}</div>`;
  }
  function mdOld(vid){
    const a = (window.APPOLDBYVEH || {})[vid]; if(!a || !a.length) return '';
    return `<div class="sm" style="margin-top:10px">Previous numbers: ${a.map(x => `<b>${mdE(x.old)}</b> (until ${mdE(x.when)})`).join(', ')}</div>`;
  }
  function mdPending(vid){
    const FN = {number:'Plate or asset no.', engine_no:'Engine no.', owner:'Registered to'};
    const p = (window.APPREQ || []).filter(r => String(r.vehicle_id) === String(vid) && r.status === 'pending');
    if(!p.length) return '';
    return `<div style="margin-top:12px;background:var(--soft,#f4f2ec);border-radius:10px;padding:10px 12px;font-size:13px"><b>Waiting for the administrator's approval</b>
      ${p.map(r => `<div class="sm">${FN[r.field] || mdE(r.label || r.field)}: ${mdE(r.old_value || 'empty')} &rarr; <b>${mdE(r.new_value || 'empty')}</b> &middot; asked by ${mdE((r.requested_email || '').split('@')[0])}</div>`).join('')}</div>`;
  }
  window.mdPanelHired = m => mdBox('hired', m.vid, { type: m.type, make: m.make, year: m.year, chassis: m.chassis, number: m.number, engine: m.engine, owner: m.owner,
    firm: m.firm && m.firm !== '(supplier not stated)' ? m.firm : '', lpo: m.lpo, rate: m.rate, op: m.drv && m.drv.toUpperCase() !== 'NA' ? m.drv : '', start: m.start, end: m.end });
  window.mdPanelOwn = v => mdBox('own', v._id, { type: v.type, make: v.model, year: v.year, chassis: v.chassis, number: v.plate, engine: v.engine, owner: v.owner });
  function openMachineDetails(kind, key){
    if(document.getElementById('mdDlg')) return;
    const hired = kind === 'hired';
    const m = hired ? (HIRE.rows || []).find(r => String(r.vid) === String(key)) : Object.values(V).find(x => String(x._id) === String(key));
    if(!m) return;
    const cur = hired ? { type: m.type, make: m.make, year: m.year, chassis: m.chassis, number: m.number, engine: m.engine, owner: m.owner, sid: m.sid, lpo: m.lpo, rate: m.rate, op: m.drv && m.drv.toUpperCase() !== 'NA' ? m.drv : '', start: m.start, end: m.end }
      : { type: m.type, make: m.model, year: m.year, chassis: m.chassis, number: m.plate, engine: m.engine, owner: m.owner };
    const val = x => x == null ? '' : mdE(x);
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    const ADM = (window.MYROLE || '') === 'admin';
    const one = (id, l, v, type, lock, appr) => `<div style="flex:1;min-width:200px"><label for="${id}" style="${lab}">${l}${lock && !ADM ? ' <span class="sm" style="font-weight:400">(Admin only)</span>' : ''}${appr && !ADM ? ' <span class="sm" style="font-weight:400">(needs Admin approval)</span>' : ''}</label><input id="${id}" type="${type || 'text'}" value="${val(v)}" ${type === 'number' ? 'step="any"' : ''} ${lock && !ADM ? 'disabled' : ''} style="${fld}${lock && !ADM ? ';opacity:.6' : ''}"></div>`;
    const sups = (window.APPSUPPLIERS || []).slice().sort((a, b) => a.name < b.name ? -1 : 1);
    const dlg = document.createElement('div'); dlg.id = 'mdDlg';
    dlg.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    dlg.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(640px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Machine details</div>
        <h2 style="margin:4px 0 0;font-size:22px">${mdE(cur.number || m.plate)} <span class="sm" style="font-weight:400">· ${mdE(cur.type || '')}</span></h2></div>
      <div class="sm">Any box may stay empty. Every save is written in the change log.${ADM ? '' : ' Type, make and model, year and chassis can only be changed by the Admin. A new plate, engine no. or Registered to goes to the Admin for approval first.'}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">${one('mdType', 'Type', cur.type, '', 1)}${one('mdMake', 'Make and model', cur.make, '', 1)}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">${one('mdYear', 'Year', cur.year, 'number', 1)}${one('mdChas', 'Serial / chassis no.', cur.chassis, '', 1)}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">${one('mdNum', 'Plate or asset no.', cur.number, '', 0, 1)}${one('mdEng', 'Engine no.', cur.engine, '', 0, 1)}${one('mdOwn', 'Registered to', cur.owner, '', 0, 1)}</div>
      ${ADM ? '' : `<div><label for="mdWhy" style="${lab}">Reason for a change that needs approval <span class="sm" style="font-weight:400">(optional)</span></label><input id="mdWhy" type="text" style="${fld}"></div>`}
      ${hired ? `<div style="display:flex;gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:200px"><label for="mdSup" style="${lab}">Supplier</label>
          <select id="mdSup" style="${fld}"><option value="">Not stated</option>${sups.map(s => `<option value="${s.id}" ${String(s.id) === String(cur.sid) ? 'selected' : ''}>${mdE(s.name)}</option>`).join('')}</select></div>
        ${one('mdLpo', 'LPO no.', cur.lpo)}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">${one('mdRate', 'Monthly rate (AED)', cur.rate, 'number')}${one('mdOp', 'Operator', cur.op)}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">${one('mdStart', 'Hire start', cur.start, 'date')}${one('mdEnd', 'Hire end (leave empty while hired)', cur.end, 'date')}</div>` : ''}
      <div id="mdErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="mdX">Cancel</button>
        <button type="button" class="btn" id="mdOk" style="background:var(--navy,#16315c);color:#fff">Save</button></div></div>`;
    document.body.appendChild(dlg);
    const close = () => dlg.remove(), g = id => document.getElementById(id), err = g('mdErr');
    dlg.addEventListener('click', e => { if(e.target === dlg) close(); });
    g('mdX').onclick = close;
    g('mdOk').onclick = async () => {
      const t = id => g(id) ? g(id).value.trim() : '';
      const yr = t('mdYear'), rate = t('mdRate');
      const args = { p_vehicle: +key, p_number: t('mdNum') || null, p_type: t('mdType') || null, p_make_model: t('mdMake') || null, p_year: yr ? Math.round(+yr) : null,
        p_chassis: t('mdChas') || null, p_engine: t('mdEng') || null, p_owner: t('mdOwn') || null, p_reason: t('mdWhy') || null, p_supplier: hired && g('mdSup').value ? +g('mdSup').value : null, p_lpo: t('mdLpo') || null, p_rate: rate ? +rate : null,
        p_operator: t('mdOp') || null, p_start: t('mdStart') || null, p_end: t('mdEnd') || null };
      const b = g('mdOk'); b.disabled = true; b.textContent = 'Saving…'; err.textContent = '';
      const { data: res, error } = await sb.rpc('edit_machine_details', args);
      if(error){ err.textContent = error.message; b.disabled = false; b.textContent = 'Save'; return; }
      const asked = res && res.requested ? res.requested : 0;
      if(asked){ try{ const q = await sb.from('machine_change_requests').select('*').order('id', { ascending: false }).limit(300); if(!q.error) window.APPREQ = q.data; }catch(_){} }
      const renamed = ADM && args.p_number && args.p_number !== (hired ? m.number : m.plate);
      if(hired){
        Object.assign(m, { type: args.p_type || '', make: args.p_make_model || '', year: args.p_year == null ? '' : args.p_year, chassis: args.p_chassis || '', number: ADM ? (args.p_number || m.number) : m.number, engine: ADM ? (args.p_engine || '') : m.engine, owner: ADM ? (args.p_owner || '') : m.owner,
          sid: args.p_supplier, firm: args.p_supplier ? (sups.find(s => s.id === args.p_supplier) || {}).name || m.firm : '(supplier not stated)', lpo: args.p_lpo || '', rate: args.p_rate, drv: args.p_operator || '', start: args.p_start || '', end: args.p_end || '' });
        if(ADM && m.idkind === 'plate' && args.p_number) m.plate = args.p_number;
      } else {
        Object.assign(m, { type: args.p_type || '', model: args.p_make_model || '', year: args.p_year == null ? '' : String(args.p_year), chassis: args.p_chassis || '', engine: ADM ? (args.p_engine || '') : m.engine, owner: ADM ? (args.p_owner || '') : m.owner });
      }
      close();
      if(hired && window.__machineCard) window.__machineCard(m.plate); else if(!hired) renderCard(m.plate);
      const host = hired ? document.getElementById('hCard') : el('fCard');
      if(host){
        const n = document.createElement('div'); n.setAttribute('role', 'status');
        n.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
        n.textContent = 'Saved.' + (asked ? ' ' + asked + ' change' + (asked > 1 ? 's' : '') + ' sent to the Admin for approval; the old value stays until it is approved.' : '') + (renamed ? ' The new number shows on the other pages after you refresh the page.' : '') + (args.p_end ? ' A hire end date was set: the machine leaves the Hired In list after you refresh.' : '');
        host.insertBefore(n, host.firstChild);
      }
    };
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-md]'); if(b) openMachineDetails(b.dataset.md, b.dataset.key); });
