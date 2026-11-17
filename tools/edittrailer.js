  /* ================= CHANGE TRAILER (17 Nov 2026) =====================
     Admin and Editor. Opens on a truck card; Save calls the database function
     change_trailer, which ends the old coupling with its dates, starts the new one,
     moves the trailer off another truck if it was behind one, and writes the change log. */
  function openChangeTrailer(plate){
    const v = V[plate]; if(!v || document.getElementById('chgDlg')) return;
    const kidsNow = (v.kids || []).map(k => V[k]).filter(Boolean);
    const trailers = Object.values(V).filter(x => x.cls === 'Trailer' && x._id && !(v.kids || []).includes(x.plate) && x.fleet !== 'Out of fleet')
      .sort((a, b) => (a.plate < b.plate ? -1 : 1));
    const today = ISO_TODAY();
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    const el2 = document.createElement('div'); el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    el2.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(560px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">${kidsNow.length ? 'Change trailer' : 'Add trailer'}</div>
        <h2 style="margin:4px 0 0;font-size:22px">${esc(v.plate)} <span class="sm" style="font-weight:400">· ${esc(v.type || v.cls)}</span></h2></div>
      <div class="sm" style="background:var(--soft,#f4f2ec);border-radius:10px;padding:11px 13px">${kidsNow.length
        ? 'Behind it now: ' + kidsNow.map(k => `<b>${esc(k.plate)}</b>${k.psince ? ' since ' + fmt.format(parse(k.psince)) : ' (start date not recorded)'}`).join(', ')
        : 'No trailer behind it now.'}</div>
      <div><label for="trP" style="${lab}">New trailer</label>
        <select id="trP" style="${fld}"><option value="">Choose…</option>${kidsNow.length ? '<option value="none">No trailer (uncouple)</option>' : ''}${trailers.map(t =>
          `<option value="${t._id}">${esc(t.plate)}${t.type ? ' — ' + esc(t.type) : ''}${t.trailer ? ' · now behind ' + esc(t.trailer) : ''}</option>`).join('')}</select></div>
      <div id="trWarn" class="sm" style="display:none;background:#fff4e0;border:1px solid #f0d49a;border-radius:10px;padding:11px 13px"></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:150px"><label for="trS" style="${lab}">Starts on</label><input id="trS" type="date" value="${today}" style="${fld}"></div>
        ${kidsNow.length ? `<div style="flex:1;min-width:150px"><label for="trE" style="${lab}">Old trailer's last day</label><input id="trE" type="date" value="${ISO_BEFORE(today)}" style="${fld}"></div>` : ''}
      </div>
      <div><label for="trN" style="${lab}">Note <span class="sm" style="font-weight:400">(optional, kept with this change)</span></label><input id="trN" type="text" style="${fld}"></div>
      <div id="chgErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="chgX">Cancel</button>
        <button type="button" class="btn" id="chgOk" style="background:var(--navy,#16315c);color:#fff">Save change</button></div></div>`;
    document.body.appendChild(el2);
    const $ = id => document.getElementById(id), close = () => el2.remove();
    el2.addEventListener('click', e => { if(e.target === el2) close(); }); $('chgX').onclick = close;
    const sEl = $('trS'), eEl = $('trE'), pEl = $('trP');
    sEl.addEventListener('change', () => { if(eEl && sEl.value) eEl.value = ISO_BEFORE(sEl.value); });
    pEl.addEventListener('change', () => { const t = [...trailers].find(x => String(x._id) === pEl.value), w = $('trWarn');
      if(t && t.trailer){ w.style.display = ''; w.innerHTML = `<b>${esc(t.plate)}</b> is behind <b>${esc(t.trailer)}</b> now. It will move here, and <b>${esc(t.trailer)}</b> will have no trailer from the day before the start date.`; }
      else w.style.display = 'none'; });
    pEl.focus();
    $('chgOk').onclick = async () => {
      const err = $('chgErr'), btn = $('chgOk'), pv = pEl.value;
      if(!pv){ err.textContent = 'Choose the new trailer.'; return; }
      if(!sEl.value){ err.textContent = 'Choose the start date.'; return; }
      btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
      const note = $('trN').value.trim(), endV = eEl && eEl.value ? eEl.value : null, startV = sEl.value;
      const { data, error } = await sb.rpc('change_trailer', { p_truck: v._id, p_trailer: pv === 'none' ? null : +pv, p_start: startV, p_end: endV, p_note: note || null });
      if(error){ err.textContent = error.message; btn.disabled = false; btn.textContent = 'Save change'; return; }
      // bring the cards up to date without reloading everything
      const endUsed = endV || ISO_BEFORE(startV);
      kidsNow.forEach(k => { const rec = { f: k.psince || null, t: endUsed, note };
        v.coupLog.unshift(Object.assign({ w: k.plate }, rec)); k.coupLog.unshift(Object.assign({ w: v.plate }, rec)); k.trailer = ''; k.psince = null; });
      v.kids = [];
      if(pv !== 'none'){
        const n = Object.values(V).find(x => String(x._id) === pv);
        if(n){ if(n.trailer && V[n.trailer]){ const u = V[n.trailer], rec = { f: n.psince || null, t: ISO_BEFORE(startV), note: 'Moved to ' + v.plate };
            u.kids = (u.kids || []).filter(k => k !== n.plate); u.coupLog.unshift(Object.assign({ w: n.plate }, rec)); n.coupLog.unshift(Object.assign({ w: u.plate }, rec)); }
          n.trailer = v.plate; n.psince = startV; v.kids = [n.plate]; }
      }
      close(); renderCard(plate);
      const host = el('fCard');
      if(host){ const m = document.createElement('div'); m.setAttribute('role', 'status');
        m.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
        m.textContent = data.new ? `Saved. ${data.new} is now behind ${plate}${data.moved_from ? ` (moved from ${data.moved_from})` : ''}. Other pages show it when you open them.` : `Saved. ${plate} has no trailer now. Other pages show it when you open them.`;
        host.insertBefore(m, host.firstChild); }
    };
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-f="chgtrl"]'); if(b) openChangeTrailer(b.dataset.plate); });

