(function(){
  /* ================= EDIT A NUMBER OR TAG (20 Nov 2026) =====================
     The reference / tag no. of a paper (vehicle or person) and the two diesel sensor numbers.
     Admin: saved at once. Editor: sent to the Admin (Home > Waiting for your approval). Always written to the change log.
     Saves through change_number (supabase/017_edit_numbers.sql). Refs come from window.APPREF (set in boot.js). */
  const role = () => window.MYROLE || '';
  const CAN = () => ['admin', 'editor'].includes(role());
  const e = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const REF = () => window.APPREF || { v: {}, p: {} };
  const has = (kind, id, tid) => { const m = (REF()[kind] || {})[id]; return !!(m && tid != null && Object.prototype.hasOwnProperty.call(m, tid)); };
  const refOf = (kind, id, tid) => has(kind, id, tid) ? (REF()[kind][id][tid] || '') : '';
  const BTN = 'margin-left:8px;padding:3px 10px;min-height:28px;font-size:12px';
  const btn = (spec, text) => `<button type="button" class="btn" data-f="editno" data-no="${e(JSON.stringify(spec))}" style="${BTN}">${text || 'Edit no.'}</button>`;

  window.refCell = (kind, id, tid) => { const r = refOf(kind, id, tid); return r ? `<span class="mono">${e(r)}</span>` : '<span class="dash">—</span>'; };
  window.numPaperBtn = (kind, id, tid, label, title) => (CAN() && has(kind, id, tid))
    ? btn({ title, items: [{ field: 'paper_ref', vehicle: kind === 'v' ? id : null, person: kind === 'p' ? id : null, type: tid, label, cur: refOf(kind, id, tid) }] }) : '';

  /* a person's paper tile: shows the number and the Edit button */
  const PT = { 'Licence Expiry': 'Driver Licence' };
  window.numPersonBtn = (p, k) => {
    const tn = PT[k] || k, tid = (window.APPPTYPES || {})[tn]; if(!p || !p._id || !tid || !has('p', p._id, tid)) return '';
    const r = refOf('p', p._id, tid);
    return `<div class="sm" style="margin-top:6px">No. ${r ? `<b class="mono">${e(r)}</b>` : '<span class="dash">not recorded</span>'}</div>`
      + (CAN() ? `<div>${btn({ title: p['Name (as per passport)'], items: [{ field: 'paper_ref', vehicle: null, person: p._id, type: tid, label: k === 'Licence Expiry' ? 'Licence no.' : k + ' no.', cur: r }] }).replace('margin-left:8px', 'margin-left:0;margin-top:6px')}</div>` : '');
  };

  /* the "Tags and numbers" rows of a vehicle card */
  const sensors = v => { const t = (v.tags || []).find(x => x.k === 'Diesel Sensor No.'); const a = t && t.v ? String(t.v).split(' / ') : []; return [a[0] || '', a[1] || '']; };
  window.numTagRows = (v, rows) => {
    if(!CAN()) return rows;
    const inst = (v.tags || []).find(x => x.k === 'Diesel Sensor' && x.v === 'Installed');
    return (inst && !rows.some(x => x.k === 'Diesel Sensor No.')) ? rows.concat([{ k: 'Diesel Sensor No.', v: '', _add: true }]) : rows;
  };
  window.numTagBtn = (v, t) => {
    if(!CAN()) return '';
    if(t.k === 'Diesel Sensor No.'){ const s = sensors(v);
      return btn({ title: v.plate, items: [{ field: 'sensor_1', vehicle: v._id, person: null, type: null, label: 'Diesel sensor no. 1', cur: s[0] }, { field: 'sensor_2', vehicle: v._id, person: null, type: null, label: 'Diesel sensor no. 2', cur: s[1] }] }, t._add ? 'Add no.' : 'Edit no.'); }
    if(t.k === 'FNRC Tag No.'){ const d = (v.dates || []).find(x => x.k === 'FNRC WB tag');
      return d && d.tid ? window.numPaperBtn('v', v._id, d.tid, 'FNRC WB tag no.', v.plate) : ''; }
    return '';
  };

  function open(spec){
    if(document.getElementById('numDlg')) return;
    const ADM = role() === 'admin';
    const el2 = document.createElement('div'); el2.id = 'numDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    el2.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="numT" style="width:min(560px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Edit number</div>
        <h2 id="numT" style="margin:4px 0 0;font-size:22px">${e(spec.title)}</h2></div>
      ${spec.items.map((it, i) => `<div><label for="num${i}" style="${lab}">${e(it.label)}</label><input id="num${i}" type="text" value="${e(it.cur)}" style="${fld}" autocomplete="off"></div>`).join('')}
      <div class="sm" style="background:var(--soft,#f4f2ec);border-radius:10px;padding:11px 13px">${ADM
        ? 'Saved at once. The old number stays in the change history.'
        : 'The administrator must approve this before the number changes.'}</div>
      <div><label for="numR" style="${lab}">Reason <span class="sm" style="font-weight:400">(optional)</span></label><input id="numR" type="text" style="${fld}"></div>
      <div id="numErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="numX">Cancel</button>
        <button type="button" class="btn" id="numOk" style="background:var(--navy,#16315c);color:#fff">${ADM ? 'Save' : 'Send for approval'}</button></div></div>`;
    document.body.appendChild(el2);
    const close = () => el2.remove(), err = document.getElementById('numErr');
    el2.addEventListener('click', ev => { if(ev.target === el2) close(); });
    document.getElementById('numX').onclick = close; document.getElementById('num0').focus();
    document.getElementById('numOk').onclick = async () => {
      const ok = document.getElementById('numOk'); err.textContent = '';
      const todo = spec.items.map((it, i) => ({ it, val: document.getElementById('num' + i).value.trim() })).filter(x => x.val !== String(x.it.cur || '').trim());
      if(!todo.length){ err.textContent = 'Nothing changed.'; return; }
      ok.disabled = true; ok.textContent = 'Saving…';
      const why = document.getElementById('numR').value.trim() || null;
      for(const x of todo){
        const { error } = await sb.rpc('change_number', { p_field: x.it.field, p_vehicle: x.it.vehicle, p_person: x.it.person, p_type: x.it.type, p_new: x.val, p_reason: why, p_label: x.it.label });
        if(error){ err.textContent = error.message; ok.disabled = false; ok.textContent = ADM ? 'Save' : 'Send for approval'; return; }
      }
      if(ADM){ err.style.color = '#1d6b3f'; err.textContent = 'Saved.'; setTimeout(() => location.reload(), 700); }
      else {
        try { const q = await sb.from('machine_change_requests').select('*').order('id', { ascending: false }).limit(300); if(!q.error) window.APPREQ = q.data; } catch(_){}
        close();
        const host = document.getElementById('fCard') || document.getElementById('pPeople') || document.body;
        const n = document.createElement('div'); n.setAttribute('role', 'status');
        n.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
        n.textContent = 'Sent to the administrator for approval. The number changes after he approves it.';
        host.insertBefore(n, host.firstChild); setTimeout(() => n.remove(), 8000);
      }
    };
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-f="editno"]');
    if(b){ try { open(JSON.parse(b.dataset.no)); } catch(_){} }
  });
})();
