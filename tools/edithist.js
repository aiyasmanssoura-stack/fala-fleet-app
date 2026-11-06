
  /* ================= FIX HISTORY LINES (Admin only) ==========================
     Edit or remove a past driver / site / paper line. Every fix is logged
     with the old values by the database function. */
  const histTh = () => IS_ADMIN() ? '<th></th>' : '';
  const histTd = (kind, r, plate) => !IS_ADMIN() ? '' : (!r.id || r.cur ? '<td></td>'
    : `<td style="white-space:nowrap"><button type="button" class="btn" data-f="hedit" data-kind="${kind}" data-id="${r.id}" data-plate="${esc(plate)}" style="padding:4px 10px;min-height:30px;font-size:13px">Edit</button>
       <button type="button" class="btn" data-f="hdel" data-kind="${kind}" data-id="${r.id}" data-plate="${esc(plate)}" style="padding:4px 10px;min-height:30px;font-size:13px;color:#b3261e">Remove</button></td>`);
  function paperHistPanel(v){
    const rows = v.phist || [];
    if(!rows.length) return '';
    const dt = x => x ? fmt.format(parse(x)) : '<span class="dash">not recorded</span>';
    // Admin only: who renewed it (from the change log; older dates from before the app show a dash)
    const renewedBy = r => {
      if(!IS_ADMIN()) return '';
      const e = (window.APPLOG || []).find(x => x.kind === 'paper' && x.details && x.details.old_paper_id === r.id);
      return e ? `<td class="sm"><b>${esc(homeWho(e.by_email))}</b><br><span class="sm">${esc(homeWhen(e.at))}</span></td>` : '<td class="sm"><span class="dash">—</span></td>';
    };
    return `<div class="panel"><div class="ph"><h3>Earlier expiry dates</h3><span class="pill p-ok">${rows.length} on record</span>
      <span class="note">dates that were replaced by a renewal</span></div>
      <div class="scroll"><table><thead><tr><th>Paper</th><th class="n">Expired</th><th>Ref</th><th>Note</th>${IS_ADMIN() ? '<th>Renewed by</th>' : ''}${histTh()}</tr></thead>
      <tbody>${rows.map(r => `<tr><td><b>${esc(r.k)}</b></td><td class="n id"><b>${dt(r.v)}</b></td><td class="sm">${esc(r.ref)}</td><td class="sm">${esc(r.note)}</td>${renewedBy(r)}${histTd('paper', r, v.plate)}</tr>`).join('')}</tbody></table></div></div>`;
  }
  function findLine(kind, id, plate){
    const v = V[plate]; if(!v) return [];
    const arr = kind === 'driver' ? v.drvlog : kind === 'site' ? v.sitelog : v.phist;
    return [v, arr || [], (arr || []).find(x => x.id === +id)];
  }
  function histDialog(inner){
    const el2 = document.createElement('div');
    el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    el2.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(520px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px">${inner}</div>`;
    document.body.appendChild(el2);
    el2.addEventListener('click', e => { if(e.target === el2) el2.remove(); });
    return el2;
  }
  function doneNote(plate, text){
    renderCard(window.__curPlate || plate);
    const host = el('fCard'); if(!host) return;
    const n = document.createElement('div'); n.setAttribute('role', 'status');
    n.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
    n.textContent = text; host.insertBefore(n, host.firstChild);
  }
  function openHistEdit(kind, id, plate){
    if(!IS_ADMIN() || document.getElementById('chgDlg')) return;
    const [v, arr, r] = findLine(kind, id, plate); if(!r) return;
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    const isP = kind === 'paper';
    const el2 = histDialog(`<div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Edit history line</div>
      <h2 style="margin:4px 0 0;font-size:20px">${esc(plate)} <span class="sm" style="font-weight:400">· ${esc(r.n || r.k)}</span></h2></div>
      ${isP ? `<div><label for="hA" style="${lab}">Expiry date</label><input id="hA" type="date" value="${r.v || ''}" style="${fld}"></div>
        <div><label for="hR" style="${lab}">Reference no.</label><input id="hR" type="text" value="${esc(r.ref || '')}" style="${fld}"></div>`
      : `<div style="display:flex;gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:140px"><label for="hA" style="${lab}">From</label><input id="hA" type="date" value="${r.f || ''}" style="${fld}"></div>
        <div style="flex:1;min-width:140px"><label for="hB" style="${lab}">To</label><input id="hB" type="date" value="${r.t || ''}" style="${fld}"></div></div>`}
      <div><label for="hN" style="${lab}">Note</label><input id="hN" type="text" value="${esc(r.note || '')}" style="${fld}"></div>
      <div id="hErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="hX">Cancel</button>
        <button type="button" class="btn" id="hOk" style="background:var(--navy,#16315c);color:#fff">Save</button></div>`);
    document.getElementById('hX').onclick = () => el2.remove();
    document.getElementById('hOk').onclick = async () => {
      const err = document.getElementById('hErr'), btn = document.getElementById('hOk');
      const a = document.getElementById('hA').value || null, note = document.getElementById('hN').value.trim();
      btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
      let res;
      if(isP){ const ref = document.getElementById('hR').value.trim();
        res = await sb.rpc('edit_paper_history', { p_id: r.id, p_expiry: a, p_ref: ref || null, p_note: note || null });
        if(!res.error){ r.v = a || ''; r.ref = ref; r.note = note; } }
      else { const b = document.getElementById('hB').value || null;
        res = await sb.rpc('edit_history', { p_id: r.id, p_from: a, p_to: b, p_note: note || null });
        if(!res.error){ r.f = a; r.t = b; r.note = note; } }
      if(res.error){ err.textContent = res.error.message; btn.disabled = false; btn.textContent = 'Save'; return; }
      el2.remove(); doneNote(plate, 'Saved. The history line is fixed and the old values are in the change log.');
    };
  }
  function openHistRemove(kind, id, plate){
    if(!IS_ADMIN() || document.getElementById('chgDlg')) return;
    const [v, arr, r] = findLine(kind, id, plate); if(!r) return;
    const what = kind === 'paper' ? `${esc(r.k)} (expired ${r.v ? fmt.format(parse(r.v)) : 'date not recorded'})`
      : `${esc(r.n)}${r.t ? ', to ' + fmt.format(parse(r.t)) : ''}`;
    const el2 = histDialog(`<div>Remove <b>${what}</b> from the history of <b>${esc(plate)}</b>?</div>
      <div id="hErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="hX">Keep it</button>
        <button type="button" class="btn" id="hOk" style="background:#b3261e;color:#fff">Yes, remove</button></div>`);
    document.getElementById('hX').onclick = () => el2.remove();
    document.getElementById('hOk').onclick = async () => {
      const err = document.getElementById('hErr'), btn = document.getElementById('hOk');
      btn.disabled = true; btn.textContent = 'Removing…';
      const res = kind === 'paper' ? await sb.rpc('remove_paper_history', { p_id: r.id }) : await sb.rpc('remove_history', { p_id: r.id });
      if(res.error){ err.textContent = res.error.message; btn.disabled = false; btn.textContent = 'Yes, remove'; return; }
      arr.splice(arr.indexOf(r), 1);
      el2.remove(); doneNote(plate, 'Removed. The old line is kept in the change log.');
    };
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-f="hedit"],[data-f="hdel"]');
    if(!b) return;
    (b.dataset.f === 'hedit' ? openHistEdit : openHistRemove)(b.dataset.kind, b.dataset.id, b.dataset.plate);
  });

