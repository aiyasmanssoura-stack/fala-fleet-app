/* Turns the database tables into the data blocks the registry page expects.
   The page itself is unchanged; only its data source is new. */
(function () {
  const CLASSES = ['3XL Truck', 'Six Wheel', 'Equipment', 'Trailer', 'Other Vehicle', 'Car / Light Vehicle'];
  const CLASS_MAP = { 'Special Trailer': 'Trailer' };
  const WHAT = {
    '3XL Truck': 'Tractor units on the 3XL contract', 'Six Wheel': 'Rigid six-wheel tippers',
    'Equipment': 'Plant — nothing road-registered', 'Trailer': 'Towed only — no engine, no driver',
    'Other Vehicle': 'The one-offs — tanker, crane, mixer, bus', 'Car / Light Vehicle': 'Staff and site vehicles'
  };
  // card label : database paper name : warning window
  const DATES = [['Registration', 'Registration', 30], ['Insurance', 'Insurance', 30],
    ['AMIA landside pass', 'Landside Gate Pass', 10], ['Fujaira permit', 'Fujaira Permit', 30],
    ['FNRC WB tag', 'FNRC WB Ticket', 30]];
  const ART_EXACT = {
    '3XL Trailer': '3XL Sy', 'Six Wheel': 'Sixwheel', 'Trailer Only': 'Trailer',
    'BOBCAT': 'Equipment - Bobcat', 'EXCAVATOR': 'Equipment - Excavator', 'ROLLER': 'Equipment - Roller',
    'GRADER': 'Equipment - Grader', 'WHEEL DOZER': 'Equipment - Wheel Dozer', 'FORKLIFT': 'Equipment - Forklift',
    'Crain Truck': 'Other Crain', 'Diesel Tanker': 'Other Tanker', 'Bus': 'Other Bus', 'Van': 'Other Van',
    'SUV': 'CAR SUV', 'PICK UP': 'CAR Pick Up', 'MIXER': 'Mixer', 'Sedan': 'CAR SEDAN', 'Service Car': 'Other Service'
  };
  const ART_NEAR = {
    '3XL / Crain': ['Other Crain', 'crane'], '3XL / Flatbed': ['3XL Sy', '3XL tractor unit'],
    'Crain Only': ['Other Crain', 'crane'], 'Flatbed Only': ['Trailer', 'trailer'],
    'Lowbed Only': ['Trailer', 'trailer'], 'BABY ROLLER': ['Equipment - Roller', 'ROLLER'],
    'MINI EXCAV': ['Equipment - Excavator', 'EXCAVATOR']
  };
  const artFor = (t) => ART_EXACT[t] ? [ART_EXACT[t], 'exact'] : ART_NEAR[t] ? ART_NEAR[t] : ['', 'none'];

  const s = (x) => (x === null || x === undefined) ? '' : String(x).replace(/\s+/g, ' ').trim();
  const iso = (x) => x ? String(x).slice(0, 10) : '';

  // one paper row -> what the card shows
  function cell(p, withDate) {
    if (!p) return { st: 'blank', v: '' };
    if (p.state === 'Date' && p.expiry) return { st: 'date', v: iso(p.expiry) };
    if (p.state === 'NA') return { st: 'na', v: 'NA' };
    if (p.state === 'TASK') return { st: 'task', v: s(p.note) || 'TASK' };
    if (p.state === 'Note' && s(p.note)) return { st: 'note', v: s(p.note) };
    return { st: 'blank', v: '' };
  }

  function indexPapers(db) {
    const pt = {}; db.paper_types.forEach((t) => { pt[t.id] = t; });
    const byVeh = {}, byPer = {};
    db.papers.forEach((p) => {
      if (!p.is_current) return;
      const t = pt[p.paper_type_id]; if (!t) return;
      if (p.vehicle_id) (byVeh[p.vehicle_id] = byVeh[p.vehicle_id] || {})[t.name] = p;
      if (p.person_id) (byPer[p.person_id] = byPer[p.person_id] || {})[t.name] = p;
    });
    return { byVeh, byPer };
  }

  function buildF(db, today) {
    const { byVeh, byPer } = indexPapers(db);
    const siteName = {}; db.sites.forEach((x) => { siteName[x.id] = x.name; });
    const per = {}; db.people.forEach((x) => { per[x.id] = x; });
    const own = db.vehicles.filter((v) => v.ownership === 'Own').sort((a, b) => a.id - b.id);
    const byId = {}; db.vehicles.forEach((v) => { byId[v.id] = v; });
    const plateOf = (v) => s(v.number);

    // trailers hang under the truck that pulls them
    const kidsOf = {};
    own.forEach((v) => { if (v.pulled_by_id) (kidsOf[v.pulled_by_id] = kidsOf[v.pulled_by_id] || []).push(v); });

    // log notes
    const logOf = {};
    (db.log_entries || []).forEach((e) => {
      if (!e.vehicle_id) return;
      (logOf[e.vehicle_id] = logOf[e.vehicle_id] || []).push(
        { d: iso(e.entry_date), cat: s(e.category), note: s(e.text), about: e.about || 'Asset' });
    });
    Object.values(logOf).forEach((a) => a.sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0)));

    const vehicles = {};
    own.forEach((v) => {
      const plate = plateOf(v); if (!plate) return;
      const pp = byVeh[v.id] || {};
      const pull = v.pulled_by_id ? byId[v.pulled_by_id] : null;
      const cls = CLASS_MAP[v.class] || s(v.class);

      const dates = DATES.map(([label, name, thr]) => Object.assign({ k: label, thr }, cell(pp[name])));

      const tags = [];
      const tag = (k, val, extra) => { val = s(val); if (val) tags.push(Object.assign({ k, v: val }, extra || {})); };
      tag('Registration Emirate', v.registration_emirate);
      tag('Mortgage', v.mortgage);
      const trk = v.tracking;
      tag('Diesel Sensor', trk === 'Diesel sensor' ? 'Installed' : trk === 'UD Original' ? 'UD Original' : trk === 'None' ? 'NA' : '');
      tag('Diesel Sensor No.', [s(v.sensor_1), s(v.sensor_2)].filter(Boolean).join(' / '));
      tag('FNRC Tag No.', pp['FNRC WB Ticket'] && pp['FNRC WB Ticket'].ref_no);
      ['Aber Registered', 'Tahseel Sharjah', 'Masar Sharjah', 'Sharjah RTA Reg'].forEach((n) => {
        const c = cell(pp[n]); if (c.v) tag(n, c.v);
      });

      const [art, artfit] = artFor(s(v.vehicle_type));
      const kids = (kidsOf[v.id] || []).map(plateOf);
      const site = v.site_id ? siteName[v.site_id] : (pull && pull.site_id ? siteName[pull.site_id] : '');
      const drv = v.driver_id ? per[v.driver_id] : null, drv2 = v.second_driver_id ? per[v.second_driver_id] : null;
      const upd = v.site_since && v.site_id ? { d: iso(v.site_since), why: 'arrived at ' + siteName[v.site_id], src: 'board' } : null;

      vehicles[plate] = {
        plate, cls, type: s(v.vehicle_type), code: s(v.code), year: s(v.year), model: s(v.make_model),
        chassis: s(v.chassis_no), engine: s(v.engine_no), owner: s(v.owner), fleet: s(v.fleet_status),
        cond: s(v.condition), cnote: s(v.condition_note),
        _yard: site || '', _raw: s(v.board_status), _coupled: s(v.board_coupled), site: /garage/i.test(s(v.board_status)) ? s(v.board_status) : (site || ''), since: v.site_since ? iso(v.site_since) : null,
        dsince: v.driver_since ? iso(v.driver_since) : null,
        gps: s(v.gps), note: s(v.board_note),
        onboard: !!(v.site_id || v.driver_id || v.board_status || v.gps),
        driver: drv ? drv.passport_name : '', driver2: drv2 ? drv2.passport_name : '', driver2x: (/^Secondary:/i.test(s(v.board_driver_text)) ? s(v.board_driver_text).replace(/^Secondary:\s*/i, '').split('/').slice(1).map(s).filter(Boolean) : []),
        trailer: pull ? plateOf(pull) : '', kids,
        high: plate.toUpperCase().includes('HIGH'),
        dates, tags, upd, log: logOf[v.id] || [], art, artfit, _id: v.id
      };
    });

    const out = Object.keys(vehicles).filter((p) => vehicles[p].fleet === 'Out of fleet').sort();
    const order = Object.keys(vehicles).filter((p) => vehicles[p].fleet !== 'Out of fleet')
      .sort((a, b) => {
        const d = CLASSES.indexOf(vehicles[a].cls) - CLASSES.indexOf(vehicles[b].cls);
        return d || (a < b ? -1 : a > b ? 1 : 0);
      });
    const cats = CLASSES.map((c) => {
      const m = new Map();
      Object.values(vehicles).forEach((v) => { if (v.cls === c && v.fleet !== 'Out of fleet') m.set(v.type, (m.get(v.type) || 0) + 1); });
      const types = [...m.entries()].sort((a, b) => b[1] - a[1]);   // most common first (stable for ties)
      return { name: c, n: types.reduce((t, x) => t + x[1], 0), what: WHAT[c], types };
    });
    const tally = {};
    Object.values(vehicles).forEach((v) => { tally[v.fleet] = (tally[v.fleet] || 0) + 1; });

    const sites = {};
    db.sites.forEach((x) => { sites[x.name] = { what: s(x.what_it_is), note: s(x.note) }; });

    const persons = {};
    db.people.forEach((p) => {
      if (!s(p.role)) return;
      const pa = byPer[p.id] || {};
      const pc = (n) => cell(pa[n]).v;
      persons[p.passport_name] = {
        'Name (as per passport)': p.passport_name, 'Code': s(p.code), 'Role': s(p.role), 'Status': s(p.status),
        'Fala Employee No': s(p.employee_no), 'Employer': s(p.employer),
        'Start / Leave': iso(p.status === 'Left' ? (p.left_date || p.start_date) : p.start_date),
        'Licence Expiry': pc('Driver Licence'), 'Diesel Tanker Permit (DCDD)': pc('Diesel Tanker Permit (DCDD)'),
        'Landside Gate Pass': pc('Landside Gate Pass'), 'Leave note': s(p.leave_note),
        'Leave from': iso(p.leave_from), 'Leave to': iso(p.leave_to), 'Airside Driving Permit': pc('Airside Driving Permit')
      };
    });
    // person-level Landside Gate Pass shares its name with the vehicle one: pick the person's
    db.papers.forEach((p) => {
      if (!p.is_current || !p.person_id) return;
      const t = db.paper_types.find((x) => x.id === p.paper_type_id);
      const pe = per[p.person_id];
      if (t && t.applies_to === 'person' && pe && persons[pe.passport_name] && t.name === 'Landside Gate Pass')
        persons[pe.passport_name]['Landside Gate Pass'] = cell(p).v;
    });

    const recordSpan = attachRecords(vehicles, db);
    return { today, classes: CLASSES, cats, sites, persons, vehicles, order, outfleet: out, fleetTally: tally, recordSpan };
  }

  // ---------------------------------------------------------------- tyres and service on each card
  // Same result as merge_records.py: newest change per position, full history, the workshop's asset code,
  // service newest first. The owner/trailer split is already in the data (tyre_moves.vehicle_id is the
  // vehicle that wears the tyre, booked_plate the truck it was booked under).
  const digitsOf = (x) => String(x == null ? '' : x).replace(/\D/g, '');
  function attachRecords(vehicles, db) {
    const plateById = {}; db.vehicles.forEach((v) => { plateById[v.id] = s(v.number); });
    const tyreById = {}; (db.tyres || []).forEach((x) => { tyreById[x.id] = x; });
    const moves = (db.tyre_moves || []).slice().sort((a, b) => a.id - b.id);
    const hist = {}, cur = {};
    let tFrom = '', tTo = '';
    moves.forEach((m) => {
      const plate = plateById[m.vehicle_id]; if (!plate || !vehicles[plate]) return;
      const ty = tyreById[m.tyre_id] || {}, d = iso(m.from_date);
      if (d && (!tFrom || d < tFrom)) tFrom = d;
      if (d && (!tTo || d > tTo)) tTo = d;
      const via = s(m.booked_plate);
      const rec = { date: d, plate: digitsOf(via || plate), asset: s(m.asset), mtype: s(m.machine), proj: s(m.project), pos: s(m.position),
        ser: s(ty.tyre_no), size: s(ty.size), brand: s(m.brand_as_written || ty.brand), src: '', via };
      (hist[plate] = hist[plate] || []).push(rec);
      cur[plate] = cur[plate] || {};
      const c = cur[plate][rec.pos];
      if (!c || rec.date > c.date) cur[plate][rec.pos] = rec;
    });
    Object.keys(hist).forEach((plate) => {
      const v = vehicles[plate];
      v.tyres = {}; Object.keys(cur[plate]).forEach((pos) => { const r = cur[plate][pos]; v.tyres[pos] = { d: r.date, b: r.brand, s: r.ser, sz: r.size, pr: r.proj }; });
      v.tyreHist = hist[plate].slice().sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.pos !== b.pos ? (a.pos < b.pos ? 1 : -1) : 0)));
      const assets = new Set(hist[plate].map((r) => r.asset).filter(Boolean));
      if (assets.size === 1) v.asset = [...assets][0];
    });
    const svc = {}; let sFrom = '', sTo = '';
    (db.service_jobs || []).slice().sort((a, b) => a.id - b.id).forEach((j) => {
      const plate = plateById[j.vehicle_id]; const d = iso(j.job_date);
      if (d && (!sFrom || d < sFrom)) sFrom = d;
      if (d && (!sTo || d > sTo)) sTo = d;
      if (!plate || !vehicles[plate]) return;
      const r = s(j.unit) === 'HM' ? j.hours : j.odometer;
      (svc[plate] = svc[plate] || []).push({ d, j: s(j.job), t: s(j.service_type), by: s(j.done_by), r: r === null || r === undefined ? null : Number(r), u: s(j.unit) });
    });
    Object.keys(svc).forEach((plate) => { vehicles[plate].svc = svc[plate].sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)); });
    return { tyreFrom: tFrom, tyreTo: tTo, svcFrom: sFrom, svcTo: sTo };
  }


  // ---------------------------------------------------------------- Renewals
  const AIRPORT = 'AMIA';
  const SECTIONS = [['reg', 'Registration', 'Vehicle registration.'], ['ins', 'Insurance', 'Vehicle insurance.'],
    ['permit', 'Permits', 'Fujaira and FNRC.'], ['gate', 'Gate passes', 'Landside, for the airport.'],
    ['licence', 'Driver licence', 'Road licences.'],
    ['airside', 'Airside — hand back or renew', 'Seasonal. These expire because the season closes, not because anyone is late.']];
  // name, V/P, field, warn days, group, optional, section
  const RCATS = [
    ['Registration', 'V', 'Registration', 30, 'Vehicle registration', false, 'reg'],
    ['Insurance', 'V', 'Insurance', 30, 'Vehicle insurance', false, 'ins'],
    ['Airport landside', 'V', 'AMIA landside pass', 10, 'Landside gate pass — vehicle', 'site', 'gate'],
    ['Fujaira permit', 'V', 'Fujaira permit', 30, 'Permission', false, 'permit'],
    ['FNRC WB ticket', 'V', 'FNRC WB tag', 30, 'Permission', false, 'permit'],
    ['Driver licence', 'P', 'Licence Expiry', 30, 'Driver licence', false, 'licence'],
    ['Driver landside', 'P', 'Landside Gate Pass', 10, 'Landside gate pass — driver', 'site', 'gate'],
    ['Airside driving permit', 'P', 'Airside Driving Permit', 30, 'Permission', true, 'airside']];
  const dnum = (a) => { const p = a.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; };
  // a text cell from a person row, read the same way a vehicle paper is
  function textCell(v) {
    v = s(v);
    if (!v) return { st: 'blank', v: '' };
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return { st: 'date', v: v.slice(0, 10) };
    if (/^(NA|N\/A|NO)$/i.test(v)) return { st: 'na', v: 'NA' };
    if (/^TASK/i.test(v)) return { st: 'task', v };
    return { st: 'note', v };
  }
  function buildR(F, db, today) {
    const T = dnum(today);
    const veh = Object.values(F.vehicles).filter((v) => v.fleet !== 'Out of fleet').sort((a, b) => a._id - b._id);
    const personSites = {};
    Object.values(F.vehicles).forEach((v) => {
      [v.driver, v.driver2].forEach((w) => { if (w) (personSites[w] = personSites[w] || new Set()).add(v._yard); });
    });
    const personSite = (n) => { const ss = personSites[n]; if (!ss) return ''; return ss.has(AIRPORT) ? AIRPORT : ([...ss].sort()[0] || ''); };
    const ppl = db.people.filter((p) => s(p.passport_name) && s(p.role)).sort((a, b) => a.id - b.id);
    const items = [], cats = [], open = [];
    RCATS.forEach(([name, sheet, field, thr, grp, opt, sect]) => {
      let e = 0, so = 0, ok = 0, blank = 0, na = 0, task = 0, note = 0; const notes = [];
      const rows = sheet === 'V' ? veh : ppl;
      rows.forEach((r) => {
        const subj = sheet === 'V' ? r.plate : r.passport_name;
        let c;
        if (sheet === 'V') { const d = r.dates.find((x) => x.k === field); c = d ? { st: d.st, v: d.v } : { st: 'blank', v: '' }; }
        else c = textCell(F.persons[subj][field]);
        if (c.st === 'date' || c.st === 'blank' || c.st === 'task') { /* kept */ }
        if (c.st === 'note' && /^(NA|N\/A|NO)$/i.test(c.v)) c = { st: 'na', v: 'NA' };
        if (c.st === 'na') { na++; return; }
        const site = sheet === 'V' ? r._yard : personSite(subj), who = sheet === 'V' ? r.driver : '';
        const base = { c: name, s: String(subj), thr, site: String(site || ''), who: String(who || ''), sect };
        if (opt === true) base.seas = 1;
        if (c.st === 'task') { task++; notes.push({ s: String(subj), c: name, kind: 'task', txt: c.v }); items.push(Object.assign({}, base, { st: 'task', txt: c.v })); return; }
        if (c.st === 'note') { note++; notes.push({ s: String(subj), c: name, kind: 'note', txt: c.v }); items.push(Object.assign({}, base, { st: 'note', txt: c.v })); return; }
        if (c.st === 'blank') {
          if (opt === true) { na++; return; }
          if (opt === 'site' && String(site) !== AIRPORT) { na++; return; }
          blank++; items.push(Object.assign({}, base, { st: 'blank' })); return;
        }
        const d = dnum(c.v) - T, st = d < 0 ? 'e' : d <= thr ? 'so' : 'ok';
        items.push(Object.assign({}, base, { st, e: c.v, d }));
        if (st === 'e') e++; else if (st === 'so') so++; else ok++;
      });
      cats.push({ name, grp, sect, thr, e, so, ok, task, note, blank, na, opt });
      notes.forEach((n) => open.push(n));
    });
    RCATS.forEach(([name, sheet, field, , , opt]) => {
      if (opt === true) return;
      (sheet === 'V' ? veh : ppl).forEach((r) => {
        const subj = sheet === 'V' ? r.plate : r.passport_name;
        const here = sheet === 'V' ? r._yard : personSite(subj);
        if (opt === 'site' && here !== AIRPORT) return;
        const c = sheet === 'V' ? (r.dates.find((x) => x.k === field) || { st: 'blank' }) : textCell(F.persons[subj][field]);
        if (c.st === 'blank') open.push({ s: String(subj), c: name, kind: 'blank', txt: '' });
      });
    });
    const ORD = { blank: 0, task: 1, note: 2 };
    open.sort((x, y) => ORD[x.kind] - ORD[y.kind] || (x.c < y.c ? -1 : x.c > y.c ? 1 : 0) || (x.s < y.s ? -1 : x.s > y.s ? 1 : 0));
    const flag = items.filter((i) => (i.st === 'e' || i.st === 'so') && !i.seas).sort((a, b) => a.d - b.d);
    const dated = items.filter((i) => i.e);
    const byDate = {}; dated.forEach((i) => { (byDate[i.e] = byDate[i.e] || []).push(i); });
    const runs = [];
    Object.keys(byDate).forEach((d) => {
      const g = byDate[d]; if (g.length < 3 || new Set(g.map((i) => i.s)).size < 3) return;
      const k = new Map(); g.forEach((i) => k.set(i.c, (k.get(i.c) || 0) + 1));
      const what = [...k.entries()].sort((a, b) => b[1] - a[1]).map(([a, n]) => a + ' ×' + n).join(' + ');
      runs.push({ date: d, days: dnum(d) - T, n: g.length, what, who: [...new Set(g.map((i) => i.s))].sort() });
    });
    runs.sort((a, b) => (a.date < b.date ? -1 : 1));
    const mc = {}; dated.forEach((i) => { if (i.e >= today) mc[i.e.slice(0, 7)] = (mc[i.e.slice(0, 7)] || 0) + 1; });
    const mon = Object.entries(mc).sort((a, b) => (a[0] < b[0] ? -1 : 1)).filter((m) => m[0] >= today.slice(0, 7)).slice(0, 14);
    const st = {}; ppl.forEach((p) => { const k = s(p.status) || 'Active'; st[k] = (st[k] || 0) + 1; });
    const leave = ppl.filter((p) => /^on leave/i.test(s(p.status))).map((p) => ({ n: p.passport_name, role: p.role, d: iso(p.leave_from) }));
    const need = items.filter((i) => i.st === 'e' || i.st === 'so');
    const sects = SECTIONS.map(([k, lab, what]) => { const m = need.filter((i) => i.sect === k);
      return { k, lab, what, n: m.length, e: m.filter((i) => i.st === 'e').length, so: m.filter((i) => i.st === 'so').length, seas: k === 'airside' }; });
    return { today, cats, items, flag, runs, mon, leave, sects, stat: Object.entries(st).sort((a, b) => (a[0] < b[0] ? -1 : 1)), open };
  }


  // ---------------------------------------------------------------- Map
  const GARAGE = 'In the garage';
  function buildM(F, db, today, geo) {
    const T = dnum(today);
    const days = (d) => (d ? T - dnum(d) : null);
    const bySite = {}; db.sites.forEach((x) => { bySite[x.name] = x; });
    const vs = Object.values(F.vehicles).sort((a, b) => a._id - b._id);
    const rec = (v) => {
      const onb = v.onboard, gar = /garage/i.test(v.site) && v.site === s(v.site) && v.site === GARAGE;
      const r = { plate: v.plate, site: v.site, rawsite: onb ? (v._raw || '') : '', since: v.since, driver: v.driver,
        dsince: v.dsince, driver2: v.driver2, trailer: v.kids[0] || (onb ? v._coupled : ''), gps: v.gps, note: v.note,
        src: onb ? 'board' : 'vehicles', cls: v.cls, type: v.type, code: v.code, cond: v.cond, cnote: v.cnote,
        fleet: v.fleet, kids: [], since_d: days(v.since), dsince_d: days(v.dsince), high: v.high };
      if (onb) { r.garage = gar; r.driver2x = v.driver2x; if (gar) r.yard = v._yard; }
      return r;
    };
    const R = {}; vs.forEach((v) => { R[v.plate] = rec(v); });
    const kidSet = new Set();
    vs.forEach((v) => { v.kids.forEach((k) => { const kid = R[k]; if (kid && k !== v.plate) { kid.coupledTo = v.plate; kid.site = R[v.plate].site || kid.site; R[v.plate].kids.push(kid); kidSet.add(k); } }); });
    const sites = db.sites.slice().sort((a, b) => a.id - b.id).map((x) => ({ name: x.name, what: s(x.what_it_is), note: s(x.note),
      lat: x.lat === null ? null : Number(x.lat), lon: x.lng === null ? null : Number(x.lng), v: [] }));
    const garaged = Object.values(R).filter((v) => v.garage);
    if (garaged.length) {
      const yard = garaged[0].yard, base = sites.find((x) => x.name === yard);
      sites.push({ name: GARAGE, what: 'The garage at the ' + yard + ' yard',
        note: 'Pinned just beside ' + yard + ', which is where the garage is — the position is approximate.',
        lat: base.lat, lon: base.lon === null ? null : base.lon + 0.03, v: [], garage: true });
    }
    const gone = Object.values(R).filter((v) => v.fleet === 'Out of fleet').sort((a, b) => (a.plate < b.plate ? -1 : 1));
    const rented = Object.values(R).filter((v) => v.fleet === 'Rented to Fala Road').sort((a, b) => (a.plate < b.plate ? -1 : 1));
    const byName = {}; sites.forEach((x) => { byName[x.name] = x; });
    let placed = 0; const unplaced = [];
    Object.values(R).forEach((v) => {
      if (kidSet.has(v.plate) || v.fleet === 'Out of fleet') return;
      const x = byName[v.site];
      if (x) { x.v.push(v); placed += 1 + v.kids.length; } else unplaced.push(v);
    });
    sites.forEach((x) => {
      x.v.sort((a, b) => (F.classes.indexOf(a.cls) - F.classes.indexOf(b.cls)) || (a.plate < b.plate ? -1 : 1));
      x.n = x.v.length + x.v.reduce((n, v) => n + v.kids.length, 0);
      const cnt = {}; x.v.forEach((v) => { cnt[v.cls] = (cnt[v.cls] || 0) + 1; v.kids.forEach((k) => { cnt[k.cls] = (cnt[k.cls] || 0) + 1; }); });
      x.by = F.classes.filter((c) => cnt[c]).map((c) => [c, cnt[c]]);
      x.drivers = new Set(x.v.filter((v) => v.driver).map((v) => v.driver)).size;
      x.flags = [];
    });
    const log = {}; Object.values(F.vehicles).forEach((v) => { if (v.log.length) log[v.plate] = v.log.map((e) => ({ d: e.d, cat: e.cat, note: e.note })); });
    const ppl = db.people.filter((p) => s(p.passport_name) && s(p.role)).sort((a, b) => a.id - b.id);
    const pname = {}; db.people.forEach((p) => { pname[p.id] = p.passport_name; });
    (db.log_entries || []).forEach((e) => { if (e.person_id && pname[e.person_id]) (log[pname[e.person_id]] = log[pname[e.person_id]] || []).push({ d: iso(e.entry_date), cat: s(e.category), note: s(e.text) }); });
    const leave = ppl.filter((p) => /^on leave/i.test(s(p.status))).map((p) => ({ n: p.passport_name, role: p.role, d: iso(p.leave_from),
      days: p.leave_from ? T - dnum(iso(p.leave_from)) : 0, site: '', note: s(p.leave_note) })).sort((a, b) => b.days - a.days);
    const fleetN = Object.values(R).length - gone.length;
    return Object.assign({ fleetTally: F.fleetTally, gone, rented, today, sites, unplaced,
      nocoords: sites.filter((x) => x.lat === null).map((x) => x.name), classes: F.classes, log,
      leave, flags: [], mismatch: [], unresolved: [], fleet: fleetN, outfleet: gone.length, placed, coupled: kidSet.size }, geo);
  }


  // ---------------------------------------------------------------- People
  const PGROUPS = [['3xl', '3XL Drivers', 'On the 3XL contract', 's1', (r) => r.includes('3xl') || r.includes('flatbed')],
    ['six', 'Six Wheel Drivers', 'On the rigid tippers', 's2', (r) => r.includes('six wheel') || r.includes('sixwheel')],
    ['plant', 'Plant Operators', 'Excavators, bobcats, rollers, graders', 's3', (r) => r.includes('operator')],
    ['other', 'Other Drivers', 'Tanker, crane, bus, van, cars', 's5', (r) => r.includes('driver')],
    ['staff', 'Staff and Office', 'Foremen, engineers, managers', 's6', () => true]];
  const cmpCount = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  function buildPPL(F) {
    const groupOf = (role) => { const r = role.toLowerCase(); for (const g of PGROUPS) if (g[4](r)) return g[0]; return 'staff'; };
    const onboard = {};
    Object.values(F.vehicles).sort((a, b) => a._id - b._id).forEach((v) => {
      [v.driver, v.driver2, ...(v.driver2x || [])].forEach((w) => { if (w) (onboard[s(w)] = onboard[s(w)] || []).push({ plate: v.plate, cls: v.cls, type: v.type }); });
    });
    const people = {}, buckets = {};
    Object.entries(F.persons).forEach(([name, p]) => {
      const role = s(p.Role); if (!role) return;
      const status = s(p.Status) || 'Active', left = /^(left|cancel)/i.test(status);
      const key = left ? 'left' : groupOf(role);
      const okd = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(s(x)) ? s(x) : '');
      const from = okd(p['Leave from']), to = okd(p['Leave to']);
      const leave = from ? { from, to, days: to ? dnum(to) - dnum(from) : null } : null;
      people[name] = { name, role, code: s(p.Code), emp: s(p['Fala Employee No']), status, site: s(p.Site), runs: onboard[s(name)] || [],
        grp: key, since: okd(p['Start / Leave']), leave };
      (buckets[key] = buckets[key] || []).push(name);
    });
    const groups = [];
    PGROUPS.map((g) => [g[0], g[1], g[2], g[3]]).concat([['left', 'Left the company', 'Kept for the archive', 'gap']]).forEach(([key, lab, what, col]) => {
      const names = buckets[key] || []; if (!names.length) return;
      const rows = names.map((n) => people[n]), roles = new Map(); rows.forEach((r) => roles.set(r.role, (roles.get(r.role) || 0) + 1));
      groups.push({ key, lab, what, col, n: rows.length, roles: cmpCount(roles).map(([r, n]) => ({ r, n })),
        away: rows.filter((r) => /^on leave/i.test(r.status)).length, onveh: rows.filter((r) => r.runs.length).length,
        noveh: rows.filter((r) => !r.runs.length && !/^(left|cancel)/i.test(r.status)).length, blind: key === 'plant',
        names: names.slice().sort((a, b) => { const ka = people[a].code || 'zz', kb = people[b].code || 'zz'; return ka < kb ? -1 : ka > kb ? 1 : (a < b ? -1 : a > b ? 1 : 0); }) });
    });
    const active = Object.values(people).filter((r) => r.grp !== 'left');
    const noveh = active.filter((r) => !r.runs.length && r.status.toLowerCase() !== 'on leave');
    const nr = new Map(); noveh.forEach((x) => nr.set(x.role, (nr.get(x.role) || 0) + 1));
    return { groups, people, tally: { total: Object.keys(people).length, working: active.filter((r) => r.status.toLowerCase() === 'active').length,
      away: active.filter((r) => /^on leave/i.test(r.status)).length, onveh: active.filter((r) => r.runs.length).length,
      left: (buckets.left || []).length, noveh: noveh.length }, noVehRoles: cmpCount(nr).map(([r, n]) => ({ r, n })) };
  }


  // ---------------------------------------------------------------- Hired in
  const ART_HIRE = { 'Excavator': 'Equipment - Excavator', 'Bobcat': 'Equipment - Bobcat', 'Grader': 'Equipment - Grader', 'Roller': 'Equipment - Roller',
    'Baby Roller': 'Equipment - Roller', 'Mini Roller': 'Equipment - Roller', 'Wheel Loader': 'Equipment - Wheel Dozer', 'Dozer': 'Equipment - Wheel Dozer',
    'JCB': 'Equipment - Bobcat', 'PTR': 'Equipment - Roller', 'Plate Compactor': 'Equipment - Roller', 'Six Wheel': 'Sixwheel',
    'Water Tanker': 'Other Tanker', 'Bus': 'Other Bus', 'Crane': 'Other Crain' };
  const CLASS_ART = { 'Six Wheel': 'Sixwheel', 'Equipment': 'Equipment - Excavator', 'Other Vehicle': 'Other Tanker' };
  const tally = (arr) => { const m = new Map(); arr.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function buildHIRE(db, todayIso) {
    const veh = {}; db.vehicles.forEach((v) => { veh[v.id] = v; });
    const sup = {}; (db.suppliers || []).forEach((x) => { sup[x.id] = x.name; });
    const prj = {}; db.projects.forEach((x) => { prj[x.id] = x; });
    const site = {}; db.sites.forEach((x) => { site[x.id] = x.name; });
    const terms = {}; db.hire_terms.forEach((x) => { terms[x.id] = x; });
    const notedTerm = new Set(db.hire_postings.filter((x) => /Written on Hired IN as/.test(s(x.note))).map((x) => x.hire_terms_id));
    const written = (n) => { const m = /Written on Hired IN as "(.*)"/.exec(s(n)); return m ? m[1] : ''; };
    const rows = [];
    db.hire_postings.slice().sort((a, b) => a.id - b.id).forEach((hp) => {
      const t = terms[hp.hire_terms_id], v = t && veh[t.vehicle_id], pr = prj[hp.project_id]; if (!t || !v || !pr) return;
      if (t.end_date && iso(t.end_date) <= todayIso) return;   // machines already sent back sit in the history, not on the list
      const type = s(v.vehicle_type), plateW = written(hp.note) || (notedTerm.has(hp.hire_terms_id) && s(v.number) ? s(v.number) + ' /1' : s(v.number));
      const kind = !s(v.number) ? 'none' : v.number_type === 'Serial' ? 'serial' : v.number_type === 'Asset tag' ? 'asset' : 'plate';
      const plate = kind === 'none' ? (type.toUpperCase()) : plateW;
      const op = s(t.operator), opw = /Operator Status written as: (.*)$/.exec(s(t.note));
      const dz = s(t.diesel_by), rate = t.monthly_rate === null || t.monthly_rate === undefined ? null : Number(t.monthly_rate);
      rows.push({ plate, idkind: kind, dig: plateW.split('/')[0].replace(/\D/g, ''), type, cls: s(v.class) || 'Equipment', firm: sup[t.supplier_id] || '',
        drv: s(t.operator_name) === 'NA' ? 'NA' : s(t.operator_name), lpo: s(t.lpo_no), rate, proj: pr.name,
        rawproj: written(pr.note) || pr.name, site: pr.site_id ? site[pr.site_id] : pr.name,
        withDriver: /^with operator/i.test(op), opStatus: op ? op.replace(/\boperator\b/, 'Operator') : (opw ? opw[1] : ''),
        diesel: dz, dieselOurs: ['FALA', 'FALA AL MARWAN'].includes(dz.toUpperCase()), jack: !!t.jack_hammer, svcInc: type !== 'JCB',
        note: s(t.note).replace(/^Operator Status written as: .*$/, ''), art: ART_HIRE[type] || '', svcd: false });
    });
    rows.sort((a, b) => cmp(a.proj, b.proj) || cmp(a.type, b.type) || cmp(a.plate, b.plate));
    // hired machines the workshop services (matched on the digits of the plate)
    const svcByDig = {};
    (db.service_jobs || []).forEach((j) => { const v = veh[j.vehicle_id]; if (!v || v.ownership === 'Own') return;
      const d = digitsOf(v.number); const r = s(j.unit) === 'HM' ? j.hours : j.odometer;
      (svcByDig[d] = svcByDig[d] || []).push({ d: iso(j.job_date), j: s(j.job), t: s(j.service_type), by: s(j.done_by), r: r === null || r === undefined ? null : Number(r), u: s(j.unit) }); });
    rows.forEach((r) => { const got = (svcByDig[r.dig] || []).slice().sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
      if (r.dig && got.length) { r.svc = got; r.svcd = true; } else r.svcd = false; });
    const firms = tally(rows.map((r) => r.firm)).map(([firm, n]) => { const ms = rows.filter((r) => r.firm === firm);
      return { firm, n, rate: ms.reduce((x, r) => x + (r.rate || 0), 0), rated: ms.filter((r) => r.rate).length, types: tally(ms.map((r) => r.type)),
        projects: [...new Set(ms.map((r) => r.proj))].sort(), withDriver: ms.filter((r) => r.withDriver).length, jack: ms.filter((r) => r.jack).length,
        svcOnUs: ms.filter((r) => !r.svcInc).length, dieselOurs: ms.filter((r) => r.dieselOurs).length,
        lpos: [...new Set(ms.map((r) => r.lpo).filter(Boolean))].sort(), plates: ms.map((r) => r.plate) }; });
    const projects = tally(rows.map((r) => r.proj)).map(([proj, n]) => { const ms = rows.filter((r) => r.proj === proj);
      return { proj, site: ms[0].site, n, rate: ms.reduce((x, r) => x + (r.rate || 0), 0), firms: new Set(ms.map((r) => r.firm)).size,
        dieselOurs: ms.filter((r) => r.dieselOurs).length, types: tally(ms.map((r) => r.type)) }; });
    const groups = ['Six Wheel', 'Equipment', 'Other Vehicle'].map((cls) => { const ms = rows.filter((r) => r.cls === cls); if (!ms.length) return null;
      return { cls, n: ms.length, firms: new Set(ms.map((r) => r.firm)).size, rate: ms.reduce((x, r) => x + (r.rate || 0), 0), art: CLASS_ART[cls] || '',
        dieselOurs: ms.filter((r) => r.dieselOurs).length, projects: [...new Set(ms.map((r) => r.proj))].sort(), types: tally(ms.map((r) => r.type)) }; }).filter(Boolean);
    const bySite = {}; rows.forEach((r) => { bySite[r.site] = (bySite[r.site] || 0) + 1; });
    return { rows, firms, projects, groups, tally: { n: rows.length, firms: firms.length, projects: projects.length, rate: rows.reduce((x, r) => x + (r.rate || 0), 0),
      rated: rows.filter((r) => r.rate).length, noLpo: rows.filter((r) => !r.lpo).length, withDriver: rows.filter((r) => r.withDriver).length,
      svcOnUs: rows.filter((r) => !r.svcInc).length, dieselOurs: rows.filter((r) => r.dieselOurs).length },
      dieselBy: tally(rows.map((r) => r.diesel || '(not stated)')), bySite, source: 'RAW DATA — Hired IN', orphanServices: [] };
  }

  // ---------------------------------------------------------------- Fines (same shape parse_fines.py wrote)
  function buildFINES(db) {
    const rows = (db && db.fines) || [];
    const plateById = {}; (db && db.vehicles || []).forEach((v) => { plateById[v.id] = s(v.number); });
    const rf = ((db && db.report_files) || []).filter((x) => x.kind === 'Fines').sort((a, b) => b.id - a.id)[0];
    const note = rf ? s(rf.note) : '';
    const sheetN = +((/sheetN=(\d+)/.exec(note) || [])[1] || 0), sheetFee = +((/sheetFee=(\d+)/.exec(note) || [])[1] || 0);
    const num = (x) => (x === null || x === undefined ? null : Number(x));
    const withOf = (r) => s(r.also_with).split(',').map(s).filter(Boolean);
    const tickets = [], accidents = [], offFleet = [], offFleetAcc = [];
    rows.slice().sort((a, b) => a.id - b.id).forEach((r) => {
      const plate = r.vehicle_id ? plateById[r.vehicle_id] : '';
      if (r.kind === 'Ticket') {
        if (!plate) { offFleet.push({ wrote: s(r.vehicle_as_written), fee: num(r.amount), r: r.sheet_row }); return; }
        tickets.push({ plate, paid: r.paid_date ? iso(r.paid_date) : '', date: r.fine_date ? iso(r.fine_date) : '', rcpt: s(r.ticket_no),
          fee: num(r.amount), full: num(r.full_amount), with: withOf(r), drv: s(r.name_as_written), who: s(r.note), what: s(r.offence) });
      } else {
        if (!plate) { offFleetAcc.push({ wrote: s(r.vehicle_as_written), r: r.sheet_row }); return; }
        accidents.push({ plate, date: r.fine_date ? iso(r.fine_date) : '', wrote: s(r.date_as_written), drv: s(r.name_as_written), who: s(r.note),
          with: withOf(r), cause: s(r.cause), dmg: s(r.damage) });
      }
    });
    const key = (x) => x || '';
    tickets.sort((a, b) => (key(a.paid) < key(b.paid) ? -1 : key(a.paid) > key(b.paid) ? 1 : a.plate < b.plate ? -1 : a.plate > b.plate ? 1 : 0));
    accidents.sort((a, b) => (key(a.date) < key(b.date) ? 1 : key(a.date) > key(b.date) ? -1 : a.plate < b.plate ? 1 : a.plate > b.plate ? -1 : 0));
    accidents.sort((a, b) => (!a.date) - (!b.date));      // undated to the bottom
    const byVehicle = {};
    tickets.forEach((x) => { (byVehicle[x.plate] = byVehicle[x.plate] || { tickets: [], accidents: [] }).tickets.push(x); });
    accidents.forEach((x) => { (byVehicle[x.plate] = byVehicle[x.plate] || { tickets: [], accidents: [] }).accidents.push(x); });
    const per = {}; Object.keys(byVehicle).forEach((p) => { const d = byVehicle[p];
      per[p] = { n: d.tickets.length, fee: Math.round(d.tickets.reduce((x, y) => x + y.fee, 0) * 100) / 100, acc: d.accidents.length }; });
    const linked = new Set(tickets.concat(accidents).map((x) => x.who).filter(Boolean));
    return { tickets, accidents, byVehicle, per, offFleet, offFleetAcc,
      tally: { n: tickets.length, fee: Math.round(tickets.reduce((x, y) => x + y.fee, 0) * 100) / 100, vehicles: Object.keys(per).length,
        acc: accidents.length, accVehicles: new Set(accidents.map((x) => x.plate)).size, sheetN, sheetFee, linked: linked.size },
      source: rf ? 'Input/Traffic Reports/' + s(rf.file_name).replace(/ \(loaded.*$/, '') : 'no fines loaded' };
  }
  window.AppData = { buildFINES, buildHIRE, buildPPL, buildM, buildR, buildF, indexPapers, cell, iso, s, CLASSES };
})();
