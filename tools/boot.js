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
  const names = ['vehicles', 'people', 'sites', 'paper_types', 'papers', 'log_entries', 'suppliers', 'projects', 'hire_terms', 'hire_postings', 'tyres', 'tyre_moves', 'service_jobs', 'fines', 'report_files', 'diesel_lines', 'board_history'];
  const t = await Promise.all(names.map(pull));
  const db = {}; names.forEach((n, i) => { db[n] = t[i]; });
  const today = new Date(); const pad = n => String(n).padStart(2, '0');
  const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const X = window.TESTDATA || {};
  const F = AppData.buildF(db, iso);
  window.APPDATA = Object.assign({}, X, { F, R: AppData.buildR(F, db, iso), M: AppData.buildM(F, db, iso, window.GEO), PPL: AppData.buildPPL(F), HIRE: AppData.buildHIRE(db, iso), FINES: AppData.buildFINES(db) });   // HIRE, FINES: next steps
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
