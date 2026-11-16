/* Sign in, read the tables, build the data blocks, then start the registry page unchanged. */
const SB_URL = "https://lmtwqdoldsxalwshltne.supabase.co";
const SB_KEY = "sb_publishable_x-C3LN42cBLjH4hHYvNs1Q_ktcSjZYe"; // public key; data is protected by database rules
const sb = supabase.createClient(SB_URL, SB_KEY);
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
  gmsg('Loading…');
  const names = ['vehicles', 'people', 'sites', 'paper_types', 'papers', 'log_entries', 'suppliers', 'projects', 'hire_terms', 'hire_postings', 'tyres', 'tyre_moves', 'service_jobs', 'fines', 'report_files', 'diesel_lines', 'machine_months', 'vehicle_old_numbers', 'board_history'];
  const t = await Promise.all(names.map(pull));
  const db = {}; names.forEach((n, i) => { db[n] = t[i]; });
  const today = new Date(); const pad = n => String(n).padStart(2, '0');
  const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const X = window.TESTDATA || {};
  const F = AppData.buildF(db, iso);
  window.APPDATA = Object.assign({}, X, { F, R: AppData.buildR(F, db, iso), M: AppData.buildM(F, db, iso, window.GEO), PPL: AppData.buildPPL(F), HIRE: AppData.buildHIRE(db, iso), FINES: AppData.buildFINES(db) });   // HIRE, FINES: next steps
  window.APPPEOPLE = db.people; window.APPSITES = db.sites; window.APPSUPPLIERS = (db.suppliers || []).map(x => ({ id: x.id, name: x.name }));
  try { const u = (await sb.auth.getUser()).data.user; const r = await sb.from('app_users').select('role').eq('id', u.id).maybeSingle(); window.MYROLE = r.data ? r.data.role : ''; } catch (e) { window.MYROLE = ''; }
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
  try { const q = await sb.from('machine_change_requests').select('*').order('id', { ascending: false }).limit(300); if (!q.error) window.APPREQ = q.data; } catch (e) {}
  window.APPGPS = {};
  try { const g = await sb.from(['admin','editor'].includes(window.MYROLE||'') ? 'gps_positions' : 'gps_odometer').select('*'); if (!g.error) g.data.forEach(r => { window.APPGPS[r.vehicle_id] = r; }); } catch (e) {}
  if (window.MYROLE === 'admin') { try { const r = await sb.from('change_log').select('*').order('id', { ascending: false }).limit(500); if (!r.error) window.APPLOG = r.data; } catch (e) {} }
  const s = document.createElement('script'); s.textContent = document.getElementById('pagejs').textContent;
  document.body.appendChild(s);
  document.getElementById('gate').remove();
  requestAnimationFrame(() => { try { drawLeads(); } catch (e) {} });
}
async function enter() {
  try { await start(); } catch (e) { console.error(e.stack); gmsg('Could not load: ' + (e.message || e)); document.getElementById('gate').style.display = 'flex'; }
}
document.getElementById('gateForm').addEventListener('submit', async (ev) => {
  ev.preventDefault(); gmsg('');
  const { error } = await sb.auth.signInWithPassword({ email: gEmail.value.trim(), password: gPass.value });
  if (error) return gmsg(error.message);
  enter();
});
sb.auth.getSession().then(({ data }) => { if (data.session) enter(); });
