
  /* ================= HIRED IN — SENT BACK (17 Nov 2026) ========================
     Machines whose hire has ended. They are not on the current list or in its numbers; they are kept here,
     under the list, with their hire details and the monthly diesel/hours from the reports.
     Admin can bring one back (bring_back_hired puts the end date back to empty and logs it). */
  window.hiredBack = function(HR){
    const back = (HR && HR.back) || []; if(!document.getElementById('pgHired')) return;
    let host = document.getElementById('hBack');
    if(!host){ host = document.createElement('div'); host.id = 'hBack'; const o = document.getElementById('hOrphan'); (o && o.parentNode ? o.parentNode : document.getElementById('hHome')).appendChild(host); }
    if(!back.length){ host.innerHTML = ''; return; }
    const e = (x)=>String(x==null?'':x).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const day = (d)=>d?new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'<span class="dash">—</span>';
    const mon = (d)=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'});
    const nf = new Intl.NumberFormat('en-GB');
    const last = (r)=>{ const a = (r.mm||[]).find(x=>(x.l||0)>0 || (x.h||0)>0); return a ? mon(a.f) : '<span class="dash">—</span>'; };
    const lit = (r)=>(r.mm||[]).reduce((s,x)=>s+(x.l||0),0), hrs = (r)=>(r.mm||[]).reduce((s,x)=>s+(x.h||0),0);
    const adm = (window.MYROLE||'') === 'admin';
    host.innerHTML = `<h2 style="margin-top:34px">Sent back</h2>
      <p class="cap">${back.length} machine${back.length>1?'s':''} no longer on hire. They are not counted above. Click a machine to see its hire details and its diesel and hours by month.</p>
      <div id="hBackMsg" role="status"></div>
      <div class="scroll"><table><thead><tr><th>Machine</th><th>Type</th><th>Supplier</th><th>Project</th><th class="n">Sent back</th><th class="n">Last active</th><th class="n">Litres</th><th class="n">Hours</th></tr></thead>
      <tbody>${back.map((r,i)=>`<tr data-bk="${i}" tabindex="0" role="button" style="cursor:pointer"><td class="id"><b>${e(r.plate)}</b></td><td>${e(r.type)}</td><td class="sm">${e(r.firm)}</td><td class="sm">${e(r.proj)}</td>
        <td class="n">${day(r.end)}</td><td class="n">${last(r)}</td><td class="n">${lit(r)?nf.format(Math.round(lit(r))):'<span class="dash">—</span>'}</td><td class="n">${hrs(r)?nf.format(Math.round(hrs(r))):'<span class="dash">—</span>'}</td></tr>`).join('')}</tbody></table></div>
      <div id="hBackDetail"></div>`;
    const open = (i)=>{
      const r = back[i], d = document.getElementById('hBackDetail');
      d.innerHTML = `<div class="panel" style="margin-top:14px"><div class="ph"><h3>${e(r.plate)} · ${e(r.type)}</h3><span class="pill p-gap">sent back ${day(r.end)}</span></div>
        <div class="sm" style="line-height:1.7">Supplier: <b>${e(r.firm)}</b> · Project: <b>${e(r.proj)}</b>${r.site&&r.site!==r.proj?' ('+e(r.site)+')':''}<br>
        Hired from: <b>${day(r.start)}</b> · LPO: <b>${r.lpo?e(r.lpo):'—'}</b>${window.NOMONEY?'':` · Rate: <b>${r.rate?nf.format(r.rate)+' / month':'—'}</b>`} · Diesel: <b>${e(r.diesel||'not stated')}</b>${r.drv?' · Operator: <b>'+e(r.drv)+'</b>':''}</div>
        ${adm?`<div style="margin-top:12px"><button type="button" class="btn" id="hBackBring">Bring back to the hired list</button> <span id="hBackErr" class="sm" style="color:#b3261e"></span></div>`:''}</div>${window.mmPanel?window.mmPanel(r.mm):''}`;
      d.scrollIntoView({behavior:'smooth',block:'nearest'});
      const b = document.getElementById('hBackBring');
      if(b) b.onclick = async ()=>{
        if(!confirm('Put '+r.plate+' back on the current hired list?')) return;
        b.disabled = true;
        const { error } = await sb.rpc('bring_back_hired', { p_term: r.tid });
        if(error){ document.getElementById('hBackErr').textContent = error.message; b.disabled = false; return; }
        const m = document.getElementById('hBackMsg');
        m.style.cssText = 'background:#e6f4ec;border:1px solid #b9dfc8;color:#1d6b3f;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:500;margin-bottom:12px';
        m.textContent = 'Saved. '+r.plate+' is back on the hired list. Refresh the page to see it there.';
        d.innerHTML = '';
      };
    };
    host.querySelectorAll('tr[data-bk]').forEach(tr=>{ tr.onclick = ()=>open(+tr.dataset.bk); tr.onkeydown = (ev)=>{ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); open(+tr.dataset.bk); } }; });
  };
