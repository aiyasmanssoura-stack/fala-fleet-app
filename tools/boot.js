/* Sign in, read the tables, build the data blocks, then start the registry page unchanged. */
const SB_URL = "https://lmtwqdoldsxalwshltne.supabase.co";
const SB_KEY = "sb_publishable_x-C3LN42cBLjH4hHYvNs1Q_ktcSjZYe"; // public key; data is protected by database rules
const sb = supabase.createClient(SB_URL, SB_KEY);
/* After a save, the next page you open reloads the data first, so it shows the new info without pressing refresh (17 Nov 2026). */
window.DIRTY = false;
{ const _rpc = sb.rpc.bind(sb); sb.rpc = (name, ...a) => { if (name !== 'mark_change_seen') window.DIRTY = true; return _rpc(name, ...a); };
  const _from = sb.from.bind(sb);
  sb.from = (t) => { const b = _from(t); ['insert', 'update', 'upsert', 'delete'].forEach((m) => { if (typeof b[m] === 'function') { const f = b[m].bind(b); b[m] = (...a) => { window.DIRTY = true; return f(...a); }; } }); return b; }; }
window.addEventListener('hashchange', () => { if (window.DIRTY && document.getElementById('pagejs') && !document.getElementById('gate')) { window.DIRTY = false; location.reload(); } });
/* Refresh shows a plain white "Loading…" until we know if you are signed in; the login box only appears if you are not. */
const showLoading = () => { const g = document.getElementById('gate'); g.style.background = '#fff'; g.style.display = 'flex'; g.style.opacity = '1'; document.getElementById('gateForm').hidden = true; document.getElementById('gLoad').hidden = false; };
const showLogin = () => { const g = document.getElementById('gate'); g.style.background = '#16305C'; g.style.display = 'flex'; document.getElementById('gateForm').hidden = false; document.getElementById('gLoad').hidden = true; };
const gmsg = t => { document.getElementById('gMsg').textContent = t || ''; };

async function pull(table) {
  const out = []; let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999);
    if (error) throw error;
    out.push(...data); if (data.length < 1000) return out; from += 1000;
  }
}
async function start() {
  const names = ['vehicles', 'people', 'sites', 'paper_types', 'papers', 'log_entries', 'suppliers', 'projects', 'hire_terms', 'hire_postings', 'tyres', 'tyre_moves', 'service_jobs', 'fines', 'report_files', 'diesel_lines', 'machine_months', 'vehicle_old_numbers', 'board_history', 'coupling_history'];
  const t = await Promise.all(names.map(n => pull(n === 'hire_terms' ? 'hire_terms_open' : n)));
  const db = {}; names.forEach((n, i) => { db[n] = t[i]; });
  const today = new Date(); const pad = n => String(n).padStart(2, '0');
  const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const X = window.TESTDATA || {};
  const F = AppData.buildF(db, iso);
  window.APPDATA = Object.assign({}, X, { F, R: AppData.buildR(F, db, iso), M: AppData.buildM(F, db, iso, window.GEO), PPL: AppData.buildPPL(F), HIRE: AppData.buildHIRE(db, iso), FINES: AppData.buildFINES(db) });   // HIRE, FINES: next steps
  window.APPPEOPLE = db.people; window.APPSITES = db.sites; window.APPPROJECTS = db.projects; window.APPSUPPLIERS = (db.suppliers || []).map(x => ({ id: x.id, name: x.name }));
  try { const u = (await sb.auth.getUser()).data.user; const r = await sb.from('app_users').select('role').eq('id', u.id).maybeSingle(); window.MYROLE = r.data ? r.data.role : ''; } catch (e) { window.MYROLE = ''; }
  window.NOMONEY = !['admin', 'editor', 'manager'].includes(window.MYROLE || '');   // Guest and AMIA Project Editor: no fines, accidents or hired prices
  if (window.NOMONEY) document.body.classList.add('nomoney');
  window.APPLOG = [];
  // old plate / asset numbers: search for an old number leads to the vehicle; the Machine details box lists them
  window.APPOLDNUMS = []; window.APPOLDBYVEH = {};
  (db.vehicle_old_numbers || []).forEach((o) => {
    const v = db.vehicles.find((x) => x.id === o.vehicle_id); if (!v) return;
    const when = new Date(o.changed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    (window.APPOLDBYVEH[o.vehicle_id] = window.APPOLDBYVEH[o.vehicle_id] || []).push({ old: o.old_number, when });
    if (v.ownership === 'Own') { if (v.number && window.APPDATA.F.vehicles[v.number]) window.APPOLDNUMS.push({ kind: 'v', cur: v.number, cls: v.class, old: o.old_number, when }); }
    else { const r = ((window.APPDATA.HIRE || {}).rows || []).find((x) => x.vid === v.id); if (r) window.APPOLDNUMS.push({ kind: 'h', cur: r.plate, cls: r.cls, old: o.old_number, when }); }
  });
  window.APPREQ = [];
  window.APPHTYPES = {}; (db.paper_types || []).filter((t) => t.applies_to === 'vehicle' && (t.name === 'Landside Gate Pass' || t.name === 'Hired driver Landside Pass')).forEach((t) => { window.APPHTYPES[t.name] = t.id; });
  window.APPPTYPES = {}; (db.paper_types || []).filter((t) => t.applies_to === 'person').forEach((t) => { window.APPPTYPES[t.name] = t.id; });
  try { const q = await sb.from('machine_change_requests').select('*').order('id', { ascending: false }).limit(300); if (!q.error) window.APPREQ = q.data; } catch (e) {}
  window.APPREF = { v: {}, p: {} };   // reference no. of every current paper: v[vehicle id][paper type id], p[person id][paper type id]
  (db.papers || []).forEach((x) => { if (!x.is_current) return; if (x.vehicle_id) (window.APPREF.v[x.vehicle_id] = window.APPREF.v[x.vehicle_id] || {})[x.paper_type_id] = x.ref_no || ''; if (x.person_id) (window.APPREF.p[x.person_id] = window.APPREF.p[x.person_id] || {})[x.paper_type_id] = x.ref_no || ''; });
  window.APPGPS = {};
  try { const g = await sb.from(['admin','editor','manager'].includes(window.MYROLE||'') ? 'gps_positions' : 'gps_odometer').select('*'); if (!g.error) g.data.forEach(r => { window.APPGPS[r.vehicle_id] = r; }); } catch (e) {}
  if (window.MYROLE === 'admin') { try { const r = await sb.from('change_log').select('*').order('id', { ascending: false }).limit(500); if (!r.error) window.APPLOG = r.data; } catch (e) {} }
  const s = document.createElement('script'); s.textContent = document.getElementById('pagejs').textContent;
  document.body.appendChild(s);
  { const g = document.getElementById('gate'); g.style.opacity = '0'; setTimeout(() => g.remove(), 280); }
  requestAnimationFrame(() => { try { drawLeads(); } catch (e) {} });
}
async function enter() {
  try { await start(); } catch (e) { console.error(e.stack); showLogin(); gmsg('Could not load: ' + (e.message || e)); }
}
document.getElementById('gateForm').addEventListener('submit', async (ev) => {
  ev.preventDefault(); gmsg('');
  const { error } = await sb.auth.signInWithPassword({ email: gEmail.value.trim(), password: gPass.value });
  if (error) return gmsg(error.message);
  showLoading(); enter();
});
sb.auth.getSession().then(({ data }) => { if (data.session) enter(); else showLogin(); }).catch(() => showLogin());
