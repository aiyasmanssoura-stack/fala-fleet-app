
/* ================= OPEN IN A NEW TAB (16 Nov 2026) ============================
   Ctrl+click, Cmd+click or middle-click on a menu item, list row, card link or search result opens it in a new tab;
   right-click shows "Open in new tab" and "Copy link". The look of the page is not changed. */
(function(){
  const enc = encodeURIComponent, base = () => location.href.split('#')[0];
  const TAB = {tabHome:'#home', tabFleet:'#fleet', tabRenew:'#renewals', tabMap:'#map', tabPeople:'#people', tabHired:'#hired', tabFines:'#fines', tabLists:'#lists'};
  function hashFor(n){
    if(!n || !n.closest) return '';
    const q = n.closest('.qrow[data-hash]'); if(q) return q.dataset.hash;
    const t = n.closest('[role="tab"]'); if(t && TAB[t.id]) return TAB[t.id];
    const f = n.closest('[data-f]');
    if(f){ const d = f.dataset;
      if(d.f === 'home') return '#fleet';
      if(d.f === 'list' && d.cls) return '#fleet/' + enc(d.cls);
      if(d.f === 'card' && d.plate) return '#v/' + enc(d.plate);
      if(d.f === 'person' && d.name) return '#p/' + enc(d.name); }
    const h = n.closest('[data-h]');
    if(h){ const d = h.dataset;
      if(d.h === 'home') return '#hired';
      if(d.h === 'firm' && d.firm) return '#hired/f/' + enc(d.firm);
      if(d.h === 'proj' && d.proj) return '#hired/p/' + enc(d.proj);
      if(d.h === 'cls' && d.cls) return '#hired/c/' + enc(d.cls);
      if(d.h === 'card' && d.plate) return '#h/' + enc(d.plate); }
    return '';
  }
  const openNew = hash => window.open(base() + hash, '_blank', 'noopener');
  document.addEventListener('click', e => {
    if(!(e.ctrlKey || e.metaKey)) return;
    const h = hashFor(e.target); if(!h) return;
    e.preventDefault(); e.stopPropagation(); openNew(h);
  }, true);
  document.addEventListener('auxclick', e => {
    if(e.button !== 1) return;
    const h = hashFor(e.target); if(!h) return;
    e.preventDefault(); e.stopPropagation(); openNew(h);
  }, true);
  document.addEventListener('mousedown', e => { if(e.button === 1 && hashFor(e.target)) e.preventDefault(); }, true);
  let menu = null;
  const closeMenu = () => { if(menu){ menu.remove(); menu = null; } };
  document.addEventListener('contextmenu', e => {
    const h = hashFor(e.target); if(!h){ closeMenu(); return; }
    e.preventDefault(); closeMenu();
    menu = document.createElement('div'); menu.setAttribute('role', 'menu');
    menu.style.cssText = `position:fixed;z-index:2000;left:${Math.min(e.clientX, innerWidth - 190)}px;top:${Math.min(e.clientY, innerHeight - 90)}px;min-width:170px;background:var(--card,#fff);color:var(--ink,inherit);border:1px solid var(--line,#d9d6cc);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:5px`;
    const item = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = t;
      b.style.cssText = 'display:block;width:100%;text-align:left;font:inherit;font-size:14px;padding:9px 12px;border:0;background:none;color:inherit;border-radius:7px;cursor:pointer';
      b.onmouseenter = () => { b.style.background = 'var(--soft,#f4f2ec)'; }; b.onmouseleave = () => { b.style.background = 'none'; };
      b.onclick = () => { closeMenu(); fn(); }; menu.appendChild(b); };
    item('Open in new tab', () => openNew(h));
    item('Copy link', () => { try{ navigator.clipboard.writeText(base() + h); }catch(_){} });
    document.body.appendChild(menu);
  }, true);
  document.addEventListener('click', e => { if(menu && !menu.contains(e.target)) closeMenu(); }, true);
  addEventListener('keydown', e => { if(e.key === 'Escape') closeMenu(); });
  addEventListener('scroll', closeMenu, true);
})();
