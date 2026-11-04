
  /* ================= SITES: where it is now + where it has been ==============
     "Change site" saves through change_site (old site goes to the history,
     the change is logged). "Add a new site" (Admin only) saves through add_site. */
  const IS_ADMIN = () => (window.MYROLE || '') === 'admin';
  function sitesPanel(v){
    if(v.cls === 'Trailer') return '';
    const rows = [];
    if(v._yard) rows.push({n:v._yard, f:v.since||null, t:null, cur:true, note:''});
    (v.sitelog || []).forEach(e => rows.push(Object.assign({cur:false}, e)));
    const btn = CAN_EDIT() ? `<button type="button" class="btn" data-f="chgsite" data-plate="${esc(v.plate)}" style="margin-left:auto">Change site</button>` : '';
    if(!rows.length && !btn) return '';
    const dt = x => x ? fmt.format(parse(x)) : '<span class="dash">not recorded</span>';
    return `<div class="panel" id="siteLog">
      <div class="ph"><h3>Sites this ${v.cls === 'Equipment' ? 'machine' : 'truck'} has been at</h3>
        ${rows.length ? `<span class="pill p-ok">${rows.length} on record</span>` : '<span class="wtag">none on record</span>'}${btn}</div>
      ${rows.length ? `<div class="scroll"><table>
        <thead><tr><th>Site</th><th class="n">From</th><th class="n">To</th><th>Note</th>${histTh()}</tr></thead>
        <tbody>${rows.map(r => `<tr><td><b>${esc(r.n)}</b>${r.cur ? ' <span class="pill p-ok">there now</span>' : ''}</td>
          <td class="n"><b>${dt(r.f)}</b></td><td class="n">${r.cur ? '<span class="sm">to date</span>' : dt(r.t)}</td>
          <td class="sm">${esc(r.note || '')}</td>${histTd('site', r, v.plate)}</tr>`).join('')}</tbody></table></div>` : ''}</div>`;
  }
  function openChangeSite(plate){
    const v = V[plate]; if(!v || document.getElementById('chgDlg')) return;
    const today = ISO_TODAY();
    const el2 = document.createElement('div');
    el2.id = 'chgDlg';
    el2.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,50,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    const fld = 'font:inherit;padding:11px 12px;border:1px solid var(--line,#c9c6bb);border-radius:8px;min-height:44px;box-sizing:border-box;width:100%;background:var(--card,#fff);color:inherit';
    const lab = 'display:block;font-weight:600;font-size:13px;margin-bottom:5px';
    const sites = () => (window.APPSITES || []).slice().sort((a, b) => a.name < b.name ? -1 : 1).filter(s => s.name !== v._yard);
    const opts = () => '<option value="">Choose…</option>' + sites().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    el2.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="chgT" style="width:min(560px,100%);background:var(--card,#fff);color:var(--ink,inherit);border-radius:16px;border:1px solid var(--line,#d9d6cc);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px">
      <div><div class="sm" style="letter-spacing:.08em;text-transform:uppercase;font-weight:600">Change site</div>
        <h2 id="chgT" style="margin:4px 0 0;font-size:22px">${esc(v.plate)} <span class="sm" style="font-weight:400">· ${esc(v.type || v.cls)}</span></h2></div>
      <div class="sm" style="background:var(--soft,#f4f2ec);border-radius:10px;padding:11px 13px">${v._yard
        ? `Now at: <b>${esc(v._yard)}</b>${v.since ? ' since ' + fmt.format(parse(v.since)) : ''}` : 'No site on record.'}</div>
      <div><label for="chgP" style="${lab}">New site</label>
        <select id="chgP" style="${fld}">${opts()}</select>
        ${IS_ADMIN() ? `<div style="margin-top:8px"><a href="#" id="chgAdd" style="font-size:13px;font-weight:600">+ Add a new site</a>
          <div id="chgAddBox" hidden style="display:none;gap:8px;margin-top:8px"><input id="chgAddN" type="text" placeholder="New site name" style="${fld}"><button type="button" class="btn" id="chgAddOk">Add</button></div></div>` : ''}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:150px"><label for="chgS" style="${lab}">Arrived on</label><input id="chgS" type="date" value="${today}" style="${fld}"></div>
        ${v._yard ? `<div style="flex:1;min-width:150px"><label for="chgE" style="${lab}">Left the old site on</label><input id="chgE" type="date" value="${ISO_BEFORE(today)}" style="${fld}"></div>` : ''}</div>
      <div><label for="chgN" style="${lab}">Note <span class="sm" style="font-weight:400">(optional)</span></label><input id="chgN" type="text" style="${fld}"></div>
      <div id="chgErr" role="alert" style="color:#b3261e;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn" id="chgX">Cancel</button>
        <button type="button" class="btn" id="chgOk" style="background:var(--navy,#16315c);color:#fff">Save change</button></div></div>`;
    document.body.appendChild(el2);
    const close = () => el2.remove(), err = document.getElementById('chgErr');
    el2.addEventListener('click', e => { if(e.target === el2) close(); });
    document.getElementById('chgX').onclick = close;
    const sEl = document.getElementById('chgS'), eEl = document.getElementById('chgE'), sel = document.getElementById('chgP');
    sEl.addEventListener('change', () => { if(eEl && sEl.value) eEl.value = ISO_BEFORE(sEl.value); });
    sel.focus();
    const addA = document.getElementById('chgAdd');
    if(addA){
      addA.onclick = e => { e.preventDefault(); const b = document.getElementById('chgAddBox'); b.hidden = false; b.style.display = 'flex'; document.getElementById('chgAddN').focus(); };
      document.getElementById('chgAddOk').onclick = async () => {
        const name = document.getElementById('chgAddN').value.trim(); err.textContent = '';
        const { data, error } = await sb.rpc('add_site', { p_name: name });
        if(error){ err.textContent = error.message; return; }
        (window.APPSITES = window.APPSITES || []).push({ id: data.id, name: data.name });
        sel.innerHTML = opts(); sel.value = String(data.id);
        document.getElementById('chgAddBox').style.display = 'none';
      };
    }
    document.getElementById('chgOk').onclick = async () => {
      const btn = document.getElementById('chgOk');
      if(!sel.value){ err.textContent = 'Choose the new site.'; return; }
      if(!sEl.value){ err.textContent = 'Choose the arrival date.'; return; }
      btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
      const note = document.getElementById('chgN').value.trim();
      const { data, error } = await sb.rpc('change_site', { p_vehicle: v._id, p_new: +sel.value, p_start: sEl.value,
        p_end: eEl && eEl.value ? eEl.value : null, p_note: note || null });
      if(error){ err.textContent = error.message; btn.disabled = false; btn.textContent = 'Save change'; return; }
      if(v._yard){
        v.sitelog = (v.sitelog || []).concat([{ n: v._yard, f: v.since || null, t: eEl && eEl.value ? eEl.value : null, note }])
          .sort((a, b) => { const x = a.t || a.f || '', y = b.t || b.f || ''; return x < y ? 1 : x > y ? -1 : 0; });
      }
      v._yard = data.new; v.site = data.new; v.since = sEl.value;
      close(); renderCard(plate);
      const host = el('fCard');
      if(host){
        const n = document.createElement('div');
        n.setAttribute('role', 'status');
        n.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
        n.textContent = `Saved. ${plate} is now at ${data.new}. Other pages (Map, Fleet lists) show it after you refresh the page.`;
        host.insertBefore(n, host.firstChild);
      }
    };
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-f="chgsite"]');
    if(b) openChangeSite(b.dataset.plate);
  });

