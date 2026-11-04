  /* Back to the category list, in the same place you left it. */
  document.addEventListener('click', e=>{
    const c = e.target.closest('#pgFleet [data-f="card"]');
    if(c && !el('fList').hidden) window.__listY = scrollY;
    const b = e.target.closest('#pgFleet [data-back]');
    if(b){ const y = window.__listY || 0; setTimeout(()=>scrollTo({top:y}), 90); }
  });

