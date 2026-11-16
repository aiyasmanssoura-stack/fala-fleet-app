
  /* ================= RENEW A PERSON'S PAPER (16 Nov 2026) =====================
     Licence, Diesel Tanker Permit, Landside Gate Pass, Airside Driving Permit on a person's card.
     renew_person_paper keeps the old row as history and writes the new one, and logs who did it. */
  const PTYPE_NAME = {'Licence Expiry':'Driver Licence'};
  window.prenewBtn = (p, k) => (CAN_EDIT() && p._id)
    ? `<button type="button" class="btn" data-pn="${esc(p['Name (as per passport)'])}" data-pk="${esc(k)}" style="margin-top:8px;padding:6px 12px;min-height:32px;font-size:13px">Renew</button>` : '';
  function openPersonRenew(name, k){
    const p = D.persons[name]; if(!p || document.getElementById('chgDlg')) return;
    const tn = PTYPE_NAME[k] || k;
    const pt = (window.APPPTYPES || {})[tn]; if(!pt) return;
    const el2 = document.createElement('div'); el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    const cur = (p[k] || '').trim(); let now = 'Nothing dated yet.';
    if(cur.length === 10 && cur[4] === '-'){ const l = until(cur); now = `Now expires: <b>${fmt.format(parse(cur))}</b> · ${l < 0 ? 'expired ' + (-l) + ' days ago' : l + ' days left'}`; }
    const nxt = (() => { const t = new Date(); t.setFullYear(t.getFullYear() + 1); const z = n => String(n).padStart(2, '0'); return `${t.getFullYear()}-${z(t.getMonth()+1)}-${z(t.getDate())}`; })();
    el2.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(560px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Renew paper</div>
        <h2 style="margin:4px 0 0;font-size:22px">${esc(name)} <span class="sm" style="font-weight:400">· ${esc(k)}</span></h2></div>
      <div class="sm" style="background:var(--soft,#f4f2ec);border-radius:10px;padding:11px 13px">${now}</div>
      <div><label for="chgS" style="${lab}">New expiry date</label><input id="chgS" type="date" value="${nxt}" style="${fld}"></div>
      <div><label for="chgR" style="${lab}">Reference no. <span class="sm" style="font-weight:400">(optional, kept as before if empty)</span></label><input id="chgR" type="text" style="${fld}"></div>
      <div><label for="chgN" style="${lab}">Note <span class="sm" style="font-weight:400">(optional)</span></label><input id="chgN" type="text" style="${fld}"></div>
      <div id="chgErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="chgX">Cancel</button>
        <button type="button" class="btn" id="chgOk" style="background:var(--navy,#16315c);color:#fff">Save change</button></div></div>`;
    document.body.appendChild(el2);
    const close = () => el2.remove(), err = document.getElementById('chgErr');
    el2.addEventListener('click', e => { if(e.target === el2) close(); });
    document.getElementById('chgX').onclick = close; document.getElementById('chgS').focus();
    document.getElementById('chgOk').onclick = async () => {
      const btn = document.getElementById('chgOk'), ex = document.getElementById('chgS').value;
      if(!ex){ err.textContent = 'Choose the new expiry date.'; return; }
      btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
      const { error } = await sb.rpc('renew_person_paper', { p_person: p._id, p_type: pt, p_expiry: ex,
        p_ref: document.getElementById('chgR').value.trim() || null, p_note: document.getElementById('chgN').value.trim() || null });
      if(error){ err.textContent = error.message; btn.disabled = false; btn.textContent = 'Save change'; return; }
      p[k] = ex; close(); personCard(name);
      const host = el('fPerson');
      if(host){ const n = document.createElement('div'); n.setAttribute('role', 'status');
        n.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
        n.textContent = `Saved. ${name} ${k} now expires ${fmt.format(parse(ex))}. The Renewals page shows it after you refresh the page.`;
        host.insertBefore(n, host.firstChild); }
    };
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-pn]'); if(b) openPersonRenew(b.dataset.pn, b.dataset.pk); });
