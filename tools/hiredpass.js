
  /* ================= HIRED IN: LANDSIDE GATE PASS (18 Nov 2026) ================
     Hired machines have no papers of their own on record (the supplier's), but a machine working at the airport
     needs a Landside Gate Pass, and so does its driver. The driver of a hired machine is not on our People list,
     so his pass is kept on the machine (paper type 'Hired driver Landside Pass'). Admin, Editor and AMIA Project Editor
     can enter or renew either date; renew_paper keeps the old row as history and logs who did it. */
  const HP_CAN = () => ['admin', 'editor', 'amia_editor'].includes(window.MYROLE || '');
  /* The Landside Gate Pass is MANDATORY for hired machines (and their drivers) working in the AMIA project; for other projects it is optional: tracked when a date is entered, never chased as missing. */
  const HP_REQ = m => /^AMIA$/i.test((m && m.proj) || '');
  const HP_KINDS = [['pass', 'Landside Gate Pass', 'Machine', 'Landside Gate Pass'], ['dpass', 'Hired driver Landside Pass', 'Driver', 'Landside Gate Pass — driver']];
  window.hiredPassBox = (m) => {
    const cell = (key, tname, who, label) => {
      const p = m[key]; let line = HP_REQ(m) ? '<span class="dash">not recorded</span>' : '<span class="dash">not required here</span> <span class="sm">(optional outside AMIA)</span>';
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
      close(); const rh = document.getElementById('rnHired'); if(rh && !rh.hidden && window.__rnHiredRender) window.__rnHiredRender(); else window.openHired('card', m.plate);
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

  /* ================= RENEWALS: HIRED IN · LANDSIDE (19 Nov 2026) ================
     A second view on the Renewals page for the airport Landside Gate Pass of every hired machine and of its driver.
     Our own fleet's Renewals stay exactly as they were (their count is not mixed with these). Items: the machine pass, and
     the driver pass when the driver is named. Status: missing (no date), expired, expiring within 10 days (the same warning
     as our own Landside pass), valid. Pressing a pass opens the same Enter date window. CSV export opens in Excel. */
  (function(){
    const pg = document.getElementById('pgRenew'); if(!pg) return;
    const WARN = 10, KIND = ['pass', 'dpass'], LBL = {missing: 'Missing', expired: 'Expired', soon: 'Expiring', valid: 'Valid'};
    const COL = {missing: ['#fde8e6', '#a32a20'], expired: ['#fde8e6', '#a32a20'], soon: ['#fbf0d4', '#8a5a00'], valid: ['#e6f4ec', '#1d6b3f']};
    const ORD = {expired: 0, missing: 1, soon: 2, valid: 3};
    const own = document.createElement('div'); own.id = 'rnOwn';
    while(pg.firstChild) own.appendChild(pg.firstChild);
    const bar = document.createElement('div'); bar.id = 'rnBar'; bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px';
    const hv = document.createElement('div'); hv.id = 'rnHired'; hv.hidden = true;
    pg.append(bar, own, hv);
    const rows = () => ((window.APPDATA || {}).HIRE || {}).rows || [];
    const drvName = m => (m.drv && m.drv.toUpperCase() !== 'NA') ? m.drv : '';
    const stOf = p => { if(!p || !p.exp) return {s: 'missing', d: null}; const d = until(p.exp); return {s: d < 0 ? 'expired' : d <= WARN ? 'soon' : 'valid', d}; };
    const items = m => KIND.filter(k => k === 'pass' || drvName(m)).map(k => Object.assign({k, p: m[k]}, stOf(m[k]))).filter(i => i.s !== 'missing' || HP_REQ(m));
    let VIEW = 'own', F = {proj: '', sup: '', show: 'both', st: ''};
    function chaseCount(){ let n = 0; rows().forEach(m => items(m).forEach(i => { if(i.s !== 'valid') n++; })); return n; }
    function head(){
      const n = chaseCount();
      const b = (k, t) => `<button type="button" class="btn" data-rnv="${k}" aria-pressed="${VIEW === k}" style="${VIEW === k ? 'border:1.5px solid var(--navy,#16315c);color:var(--navy,#16315c);font-weight:600' : ''}">${t}</button>`;
      bar.innerHTML = b('own', 'Our fleet') + b('hired', `Hired in · Landside <b>${n}</b>`);
      const c = document.getElementById('cntRenew'); if(c && !c.dataset.base) c.dataset.base = c.textContent;
      if(c) c.textContent = n ? (c.dataset.base + ' · ' + n) : c.dataset.base;
    }
    const pill = (i) => { const c = COL[i.s]; const t = i.s === 'valid' ? 'Valid · ' + i.d + ' d' : i.s === 'soon' ? i.d + ' days left' : i.s === 'expired' ? 'Expired ' + (-i.d) + ' days' : 'Missing';
      return `<span style="padding:2px 8px;border-radius:6px;background:${c[0]};color:${c[1]};white-space:nowrap">${t}</span>`; };
    const CAN = () => ['admin', 'editor', 'amia_editor'].includes(window.MYROLE || '');
    function render(){
      head();
      own.hidden = VIEW !== 'own'; hv.hidden = VIEW !== 'hired'; if(VIEW !== 'hired') return;
      const all = rows(), projs = [...new Set(all.map(m => m.proj).filter(Boolean))].sort(), sups = [...new Set(all.map(m => m.firm).filter(Boolean))].sort();
      let list = all.filter(m => (!F.proj || m.proj === F.proj) && (!F.sup || m.firm === F.sup));
      const kinds = F.show === 'machines' ? ['pass'] : F.show === 'drivers' ? ['dpass'] : KIND;
      const cnt = {missing: 0, expired: 0, soon: 0, valid: 0};
      list.forEach(m => items(m).filter(i => kinds.includes(i.k)).forEach(i => cnt[i.s]++));
      list = list.filter(m => { const it = items(m).filter(i => kinds.includes(i.k)); return it.length && (!F.st || it.some(i => i.s === F.st)); });
      list.sort((a, b) => { const w = m => Math.min(...items(m).filter(i => kinds.includes(i.k)).map(i => ORD[i.s])); return w(a) - w(b) || (a.plate < b.plate ? -1 : 1); });
      const sel = (id, opts, v) => `<select id="${id}" style="font:inherit;padding:8px 10px;border:1px solid var(--line,#c9c6bb);border-radius:8px;background:var(--card,#fff);color:inherit">${opts.map(o => `<option value="${esc(o[0])}"${o[0] === v ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
      const cell = (m, k) => { const i = items(m).find(x => x.k === k); if(!i) return k === 'dpass' && !drvName(m) ? '<span class="dash">not named</span>' : (HP_REQ(m) ? '' : '<span class="dash">optional</span>') + (CAN() && !HP_REQ(m) && (k === 'pass' || drvName(m)) ? ` <button type="button" class="btn" data-hp="${k}" data-plate="${esc(m.plate)}" style="padding:2px 9px;min-height:26px;font-size:12px;margin-left:4px">Enter date</button>` : ''); const dim = !kinds.includes(k) ? 'opacity:.45;' : '';
        return `<span style="${dim}">${pill(i)}</span>${CAN() ? ` <button type="button" class="btn" data-hp="${k}" data-plate="${esc(m.plate)}" style="padding:2px 9px;min-height:26px;font-size:12px;margin-left:4px">${i.s === 'missing' ? 'Enter date' : 'Renew'}</button>` : ''}`; };
      hv.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
          ${sel('rnProj', [['', 'All projects']].concat(projs.map(p => [p, p])), F.proj)}${sel('rnSup', [['', 'All suppliers']].concat(sups.map(p => [p, p])), F.sup)}
          ${sel('rnShow', [['both', 'Machines and drivers'], ['machines', 'Machines only'], ['drivers', 'Drivers only']], F.show)}
          <span style="flex:1"></span><button type="button" class="btn" id="rnCsv">Download for Excel</button></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${['expired', 'missing', 'soon', 'valid'].map(s => `<button type="button" data-rnst="${s}" style="font:inherit;cursor:pointer;padding:5px 11px;border-radius:8px;border:${F.st === s ? '1.5px solid ' + COL[s][1] : '1px solid transparent'};background:${COL[s][0]};color:${COL[s][1]}">${LBL[s]} <b>${cnt[s]}</b></button>`).join('')}
          ${F.st ? '<button type="button" class="btn" data-rnst="">Show all</button>' : ''}</div>
        <p class="cap">The Landside Gate Pass is mandatory for hired machines and their drivers in the AMIA project. Other projects are listed only once a date is entered. The supplier is who you chase. Worst first.</p>
        <div class="scroll"><table><thead><tr><th>Machine</th><th>Supplier</th><th>Machine pass</th><th>Driver · pass</th></tr></thead><tbody>
          ${list.map(m => `<tr><td class="id"><b>${esc(m.plate)}</b><div class="sm">${esc(m.type || '')} · ${esc(m.proj || '')}</div></td><td>${esc(m.firm || '')}</td><td>${cell(m, 'pass')}</td>
            <td>${drvName(m) ? esc(drvName(m)) + ' ' : ''}${cell(m, 'dpass')}</td></tr>`).join('') || '<tr><td colspan="4" class="sm">Nothing to list.</td></tr>'}</tbody></table></div>`;
      const on = (id, f) => { const e = document.getElementById(id); if(e) e.onchange = () => { f(e.value); render(); }; };
      on('rnProj', v => F.proj = v); on('rnSup', v => F.sup = v); on('rnShow', v => F.show = v);
      hv.querySelectorAll('[data-rnst]').forEach(b => b.onclick = () => { F.st = F.st === b.dataset.rnst ? '' : b.dataset.rnst; render(); });
      document.getElementById('rnCsv').onclick = () => {
        const q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"', day = p => p && p.exp ? p.exp : '';
        const out = [['Machine', 'Type', 'Project', 'Supplier', 'Machine pass expiry', 'Machine pass status', 'Driver', 'Driver pass expiry', 'Driver pass status']].concat(list.map(m => {
          const a = items(m).find(i => i.k === 'pass'), d = items(m).find(i => i.k === 'dpass');
          return [m.plate, m.type, m.proj, m.firm, day(m.pass), a ? LBL[a.s] : 'not required', drvName(m), day(m.dpass), d ? LBL[d.s] : (drvName(m) ? 'not required' : 'no driver named')]; }));
        const blob = new Blob(['﻿' + out.map(r => r.map(q).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hired-landside-passes-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      };
    }
    bar.addEventListener('click', e => { const b = e.target.closest('[data-rnv]'); if(b){ VIEW = b.dataset.rnv; render(); } });
    window.__rnHiredRender = render; try{ head(); }catch(_){}
  })();
