/* ============================================================================
   xlexport.js - Fala Fleet Registry "Download Excel" workbook maker.
   Pure code: takes the database tables (already read) and returns the bytes of an .xlsx file.
   No library needed (writes the Excel XML and the zip itself), values only, no formulas.
   Used by home.js in the page and by the test script in node.
     FalaXlsx.make(ctx) -> Promise<Uint8Array>
     ctx = { tables:{name:[rows]}, errors:{name:'message'}, drawings:{name:'data:image/png;base64,...'},
             logos:[{name,file,uri}], today:'YYYY-MM-DD' (Asia/Dubai), madeAt:Date, madeBy:'email', source:'text of this file' }
   Shown tabs (11, in order): Home, Fleet, Renewals, People, Sites & Projects, Fines, Tyres, Service, Diesel, Hire, Log.
   Hidden tabs: AI README, AI Data dictionary, AI Rules, AI Screens, AI Build script, Notes for Claude, raw_<table> ...
   ============================================================================ */
(function (root) {
'use strict';

/* ---------- palette: the app's own colours (the app wins over the brief) ---------- */
const PAL = { navy: '16305C', gold: 'B8860B', bg: 'F4F6F9', white: 'FFFFFF', ink: '14181D', ink2: '48525F', muted: '78838F',
  line: 'E1E6EC', zebra: 'F4F6F9', crit: 'C0392B', warn: '7A5A06', link: '456FB2' };
const FONT = 'Calibri';
const DATE_FMT = 'dd\\-mmm\\-yyyy';
const CLASSES = ['3XL Truck', 'Six Wheel', 'Trailer', 'Special Trailer', 'Other Vehicle', 'Car / Light Vehicle', 'Equipment'];
const IMG_FOR_CLASS = { '3XL Truck': '3XL Sy', 'Six Wheel': 'Sixwheel', 'Trailer': 'Trailer', 'Special Trailer': 'Trailer',
  'Car / Light Vehicle': 'CAR SUV', 'Equipment': 'Equipment - Excavator', 'Other Vehicle': 'Other Tanker' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* database tables, in the order of the raw_ tabs, with the column they are read in order of */
const TABLE_ORDER = [['vehicles', 'id'], ['people', 'id'], ['sites', 'id'], ['projects', 'id'], ['paper_types', 'id'], ['papers', 'id'],
  ['board_history', 'id'], ['log_entries', 'id'], ['tyres', 'id'], ['tyre_moves', 'id'], ['service_jobs', 'id'], ['fines', 'id'],
  ['diesel_lines', 'id'], ['suppliers', 'id'], ['hire_terms', 'id'], ['hire_postings', 'id'], ['hire_months', 'id'], ['report_files', 'id'],
  ['name_spellings', 'id'], ['app_users', 'id'], ['change_log', 'id'], ['gps_positions', 'vehicle_id'], ['machine_months', 'id'],
  ['report_unmatched', 'id'], ['machine_change_requests', 'id'], ['vehicle_old_numbers', 'id']];
/* columns as the database defines them (used for empty tables and to keep the column order) */
const COLS = {
  app_users: 'id,email,role,person_id,created_at', sites: 'id,name,what_it_is,lat,lng,note,updated_at,updated_by',
  projects: 'id,name,site_id,note,updated_at,updated_by',
  people: 'id,passport_name,code,role,section,status,employee_no,employer,start_date,left_date,leave_from,leave_to,leave_note,note,updated_at,updated_by',
  vehicles: 'id,number,number_type,ownership,class,vehicle_type,code,year,make_model,chassis_no,engine_no,owner,fleet_status,condition,condition_note,registration_emirate,mortgage,tracking,sensor_1,sensor_2,site_id,site_since,driver_id,driver_since,second_driver_id,pulled_by_id,board_status,gps,board_note,note,updated_at,updated_by,board_coupled,board_driver_text',
  paper_types: 'id,name,applies_to,warn_days,sort,has_expiry', papers: 'id,paper_type_id,vehicle_id,person_id,state,expiry,ref_no,note,is_current,updated_at,updated_by',
  report_files: 'id,kind,file_name,covers_from,covers_to,uploaded_at,uploaded_by,note', tyres: 'id,tyre_no,brand,size,details,status,disposed_on,updated_at,updated_by',
  tyre_moves: 'id,tyre_id,vehicle_id,position,from_date,to_date,job,report_file_id,asset,booked_plate,project,machine,brand_as_written',
  service_jobs: 'id,vehicle_id,job_date,job,odometer,hours,note,report_file_id,service_type,done_by,unit',
  name_spellings: 'id,spelling,person_id',
  fines: 'id,kind,vehicle_id,vehicle_as_written,fine_date,ticket_no,amount,name_as_written,person_id,place,note,report_file_id,paid_date,offence,full_amount,also_with,cause,damage,date_as_written,sheet_row',
  diesel_lines: 'id,vehicle_id,vehicle_as_written,project_id,from_date,to_date,litres,cost,report_file_id,hours', suppliers: 'id,name,note',
  hire_terms: 'id,vehicle_id,supplier_id,monthly_rate,lpo_no,operator,operator_name,diesel_by,jack_hammer,start_date,end_date,note,updated_at,updated_by',
  hire_postings: 'id,hire_terms_id,project_id,from_date,to_date,note', hire_months: 'id,posting_id,month,days,hours,report_file_id',
  board_history: 'id,vehicle_id,site_id,driver_id,from_date,to_date,note,vehicle_as_written,driver_as_written',
  log_entries: 'id,entry_date,about,vehicle_id,person_id,category,text,done,updated_at,updated_by,which_as_written',
  change_log: 'id,at,by_user,by_email,kind,vehicle_id,summary,details,seen_at,seen_by',
  gps_positions: 'vehicle_id,tracker_name,status,parking,ignition,speed_kmh,latitude,longitude,address,odometer_km,satellites,fix_time,tracker_update,synced_at',
  machine_months: 'id,vehicle_id,month,litres,fuel_days,first_fuel,last_fuel,projects,equip_type,hours,working_days,trips,supplier_as_written,operators,plate_as_written,report_file_id',
  report_unmatched: 'id,kind,plate_as_written,month,litres,fuel_days,first_fuel,last_fuel,projects,equip_type,hours,working_days,trips,supplier_as_written,report_file_id,resolved,note,bucket,suggested_action,decided_by,decided_at',
  machine_change_requests: 'id,vehicle_id,field,old_value,new_value,reason,requested_by,requested_email,requested_at,status,decided_by,decided_email,decided_at,decision_note',
  vehicle_old_numbers: 'id,vehicle_id,old_number,changed_at,changed_by,changed_email'
};

/* ---------- small helpers ---------- */
const s = x => (x === null || x === undefined) ? '' : String(x).replace(/\s+/g, ' ').trim();
const iso = x => x ? String(x).slice(0, 10) : '';
const dnum = d => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : NaN; };
const serial = d => dnum(d) + 25569;                       // Excel date number
const fmtDate = d => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || ''); return m ? m[3] + '-' + MONTHS[+m[2] - 1] + '-' + m[1] : ''; };
const dubaiDate = t => { const d = new Date(t); return isNaN(d) ? '' : new Date(d.getTime() + 4 * 3600000).toISOString().slice(0, 10); };
const nat = (a, b) => String(a || '').localeCompare(String(b || ''), 'en', { numeric: true, sensitivity: 'base' });
const num = x => (x === null || x === undefined || x === '') ? null : (isFinite(Number(x)) ? Number(x) : null);
const colL = n => { let t = ''; n++; while (n > 0) { const m = (n - 1) % 26; t = String.fromCharCode(65 + m) + t; n = Math.floor((n - 1) / 26); } return t; };
const xe = t => String(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const CELL_MAX = 32000;                                   // Excel allows 32,767 characters in one cell

/* ---------- zip writer (deflate through the browser / node, else stored) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function deflateRaw(u8) {
  if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return null;
  try { const st = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw')); return new Uint8Array(await new Response(st).arrayBuffer()); } catch (e) { return null; }
}
async function zip(files) {                               // files: [{name, data:Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data); let data = f.data, method = 0;
    if (data.length > 200) { const d = await deflateRaw(data); if (d && d.length < data.length) { data = d; method = 8; } }
    const head = new Uint8Array([0x50, 0x4B, 3, 4, ...u16(20), ...u16(0x0800), ...u16(method), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0)]);
    parts.push(head, name, data);
    central.push(new Uint8Array([0x50, 0x4B, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(method), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + data.length;
  }
  let csize = 0; central.forEach(c => { csize += c.length; });
  const end = new Uint8Array([0x50, 0x4B, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), ...u16(0)]);
  const all = parts.concat(central, [end]); let n = 0; all.forEach(p => { n += p.length; });
  const out = new Uint8Array(n); let o = 0; all.forEach(p => { out.set(p, o); o += p.length; }); return out;
}

/* ---------- png helpers ---------- */
function b64bytes(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u;
}
function pngInfo(uri) {                                   // {bytes, w, h} from a data:image/png;base64 string
  if (!uri) return null; const m = /^data:image\/png;base64,(.+)$/.exec(uri); if (!m) return null;
  const bytes = b64bytes(m[1]); if (bytes.length < 24 || bytes[1] !== 0x50) return null;
  const w = (bytes[16] << 24 | bytes[17] << 16 | bytes[18] << 8 | bytes[19]) >>> 0, h = (bytes[20] << 24 | bytes[21] << 16 | bytes[22] << 8 | bytes[23]) >>> 0;
  return { bytes, w, h, key: uri.length + ':' + uri.slice(-40) };
}

/* ---------- the workbook model ---------- */
class Book {
  constructor() { this.sheets = []; this.fonts = []; this.fills = []; this.borders = []; this.fmts = []; this.xfs = []; this.sst = new Map(); this.sstList = []; this.media = new Map();
    this.fonts.push({}); this.fills.push(null, 'gray125'); this.borders.push({}); this.xfs.push({ f: 0, fi: 0, b: 0, n: 0, al: { h: null, v: 'center', w: false, ind: 0 } }); this.xmap = new Map(); }
  idx(arr, obj) { const k = JSON.stringify(obj); let i = arr.findIndex(x => JSON.stringify(x) === k); if (i < 0) { arr.push(obj); i = arr.length - 1; } return i; }
  style(sp) {                                              // sp: {b,i,sz,c,u, fill, bd:{t,b,l,r}, h,v,w,ind, nf}
    if (!sp) return 0; const key = JSON.stringify(sp); if (this.xmap.has(key)) return this.xmap.get(key);
    const font = { b: !!sp.b, i: !!sp.i, u: !!sp.u, sz: sp.sz || 11, c: sp.c || PAL.ink };
    const fi = this.idx(this.fonts, font), fl = sp.fill ? this.idx(this.fills, sp.fill) : 0, bd = sp.bd ? this.idx(this.borders, sp.bd) : 0;
    let n = 0; if (sp.nf) { n = this.idx(this.fmts, sp.nf) + 164; }
    const al = (sp.h || sp.v || sp.w || sp.ind) ? { h: sp.h || null, v: sp.v || 'center', w: !!sp.w, ind: sp.ind || 0 } : { h: null, v: 'center', w: false, ind: 0 };
    this.xfs.push({ f: fi, fi: fl, b: bd, n, al }); const id = this.xfs.length - 1; this.xmap.set(key, id); return id;
  }
  str(t) { let i = this.sst.get(t); if (i === undefined) { i = this.sstList.length; this.sst.set(t, i); this.sstList.push(t); } return i; }
  sheet(name, o) { const sh = new Sheet(this, name, o || {}); this.sheets.push(sh); return sh; }
}
class Sheet {
  constructor(book, name, o) { this.book = book; this.name = name; this.state = o.state || 'visible'; this.tab = o.tab || PAL.navy; this.cells = new Map(); this.rowsH = new Map(); this.widths = []; this.merges = []; this.links = []; this.images = []; this.freeze = null; this.colStyle = {}; this.bgCols = 0; this.ign = null; }
  set(r, c, v, sp) { let row = this.cells.get(r); if (!row) { row = new Map(); this.cells.set(r, row); } row.set(c, { v, s: this.book.style(sp) }); }
  h(r, pt) { this.rowsH.set(r, pt); }
  w(c, chars) { this.widths[c] = Math.max(this.widths[c] || 0, chars); }
  setw(c, chars) { this.widths[c] = chars; }
  merge(r1, c1, r2, c2) { this.merges.push(colL(c1) + (r1 + 1) + ':' + colL(c2) + (r2 + 1)); }
  link(r, c, loc) { this.links.push({ ref: colL(c) + (r + 1), loc }); }
  px(c) { const w = this.widths[c] || 8.43; return Math.floor(w * 7); }
  /* picture whose right edge sits at the right end of column lastCol; height in px */
  imageRight(img, lastCol, row, hpx, topPx) { if (img) this.images.push({ img, lastCol, row, rowOff: topPx, cy: hpx }); }
  placeImages() {                                          // called when the column widths are final
    this.images.forEach(im => { const wpx = Math.round(im.cy * im.img.w / im.img.h); let total = 0; for (let c = 0; c <= im.lastCol; c++) total += this.px(c);
      let x = Math.max(0, total - wpx - 6), c = 0; while (c < im.lastCol && x >= this.px(c)) { x -= this.px(c); c++; } im.col = c; im.colOff = x; im.cx = wpx; });
  }
}

/* ---------- write the xlsx parts ---------- */
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
function cellXml(book, r, c, cell) {
  const ref = colL(c) + (r + 1), v = cell.v, st = cell.s ? ' s="' + cell.s + '"' : '';
  if (v === null || v === undefined || v === '') return '<c r="' + ref + '"' + st + '/>';
  if (typeof v === 'number') return isFinite(v) ? '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>' : '<c r="' + ref + '"' + st + '/>';
  if (typeof v === 'boolean') return '<c r="' + ref + '"' + st + ' t="b"><v>' + (v ? 1 : 0) + '</v></c>';
  if (typeof v === 'object' && v.d) { const n = serial(v.d); return isFinite(n) ? '<c r="' + ref + '"' + st + '><v>' + n + '</v></c>' : '<c r="' + ref + '"' + st + '/>'; }
  let t = String(v); if (t.length > CELL_MAX) t = t.slice(0, CELL_MAX);
  return '<c r="' + ref + '"' + st + ' t="s"><v>' + book.str(t) + '</v></c>';
}
function sheetXml(book, sh, n, tabSelected) {
  const rows = [...sh.cells.keys()].sort((a, b) => a - b); let maxR = 0, maxC = 0;
  const rh = [...sh.rowsH.keys()]; const allRows = [...new Set(rows.concat(rh))].sort((a, b) => a - b);
  let sd = '';
  for (const r of allRows) {
    const row = sh.cells.get(r), h = sh.rowsH.get(r); let x = '<row r="' + (r + 1) + '"' + (h ? ' ht="' + h + '" customHeight="1"' : '') + '>';
    if (row) { for (const c of [...row.keys()].sort((a, b) => a - b)) { x += cellXml(book, r, c, row.get(c)); if (c > maxC) maxC = c; } if (r > maxR) maxR = r; }
    sd += x + '</row>';
  }
  let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet ' + NS + '><sheetPr><tabColor rgb="FF' + sh.tab + '"/>' + (sh.state === 'visible' ? '<pageSetUpPr fitToPage="1"/>' : '') + '</sheetPr>';
  x += '<dimension ref="A1:' + colL(maxC) + (maxR + 1) + '"/>';
  x += '<sheetViews><sheetView showGridLines="0"' + (tabSelected ? ' tabSelected="1"' : '') + ' workbookViewId="0">';
  if (sh.freeze) { const f = sh.freeze, tl = colL(f.col) + (f.row + 1);
    x += '<pane xSplit="' + f.col + '" ySplit="' + f.row + '" topLeftCell="' + tl + '" activePane="bottomRight" state="frozen"/><selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="' + tl + '" sqref="' + tl + '"/>'; }
  x += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
  const cols = []; const nW = Math.max(sh.widths.length, sh.bgCols);
  for (let c = 0; c < nW; c++) { const w = sh.widths[c]; const st = c < sh.bgCols ? ' style="' + sh.bgStyle + '"' : '';
    if (w || st) cols.push('<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + (w || 8.43) + '" customWidth="1"' + st + '/>'); }
  if (cols.length) x += '<cols>' + cols.join('') + '</cols>';
  x += '<sheetData>' + sd + '</sheetData>';
  if (sh.merges.length) x += '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>';
  if (sh.links.length) x += '<hyperlinks>' + sh.links.map(l => '<hyperlink ref="' + l.ref + '" location="' + xe(l.loc) + '" display="' + xe(l.loc) + '"/>').join('') + '</hyperlinks>';
  x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
  if (sh.ign) x += '<ignoredErrors><ignoredError sqref="' + sh.ign + '" numberStoredAsText="1"/></ignoredErrors>';
  if (sh.images.length) x += '<drawing r:id="rId1"/>';
  return x + '</worksheet>';
}
function stylesXml(b) {
  let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  if (b.fmts.length) x += '<numFmts count="' + b.fmts.length + '">' + b.fmts.map((f, i) => '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + xe(f) + '"/>').join('') + '</numFmts>';
  x += '<fonts count="' + b.fonts.length + '">' + b.fonts.map(f => '<font>' + (f.b ? '<b/>' : '') + (f.i ? '<i/>' : '') + (f.u ? '<u/>' : '') + '<sz val="' + (f.sz || 11) + '"/><color rgb="FF' + (f.c || PAL.ink) + '"/><name val="' + FONT + '"/><family val="2"/></font>').join('') + '</fonts>';
  x += '<fills count="' + b.fills.length + '">' + b.fills.map(f => f === null ? '<fill><patternFill patternType="none"/></fill>' : f === 'gray125' ? '<fill><patternFill patternType="gray125"/></fill>' : '<fill><patternFill patternType="solid"><fgColor rgb="FF' + f + '"/><bgColor indexed="64"/></patternFill></fill>').join('') + '</fills>';
  const side = (n, c) => c ? '<' + n + ' style="thin"><color rgb="FF' + c + '"/></' + n + '>' : '<' + n + '/>';
  x += '<borders count="' + b.borders.length + '">' + b.borders.map(o => '<border>' + side('left', o.l) + side('right', o.r) + side('top', o.t) + side('bottom', o.b) + '<diagonal/></border>').join('') + '</borders>';
  x += '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
  x += '<cellXfs count="' + b.xfs.length + '">' + b.xfs.map(f => '<xf numFmtId="' + f.n + '" fontId="' + f.f + '" fillId="' + f.fi + '" borderId="' + f.b + '" xfId="0"' + (f.n ? ' applyNumberFormat="1"' : '') + (f.f ? ' applyFont="1"' : '') + (f.fi ? ' applyFill="1"' : '') + (f.b ? ' applyBorder="1"' : '') + ' applyAlignment="1"><alignment' + (f.al.h ? ' horizontal="' + f.al.h + '"' : '') + ' vertical="' + f.al.v + '"' + (f.al.w ? ' wrapText="1"' : '') + (f.al.ind ? ' indent="' + f.al.ind + '"' : '') + '/></xf>').join('') + '</cellXfs>';
  return x + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}
async function writeXlsx(book, meta) {
  const enc = new TextEncoder(), files = []; const add = (name, text) => files.push({ name, data: typeof text === 'string' ? enc.encode(text) : text });
  book.sheets.forEach(sh => sh.placeImages());
  const sheetsXml = book.sheets.map((sh, i) => sheetXml(book, sh, i + 1, i === 0));   // fills the shared strings
  const ct = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'];
  let wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook ' + NS + '><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000" activeTab="0"/></bookViews><sheets>';
  let wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  let dn = 0, mediaN = 0; const mediaFiles = new Map();
  book.sheets.forEach((sh, i) => {
    const n = i + 1; wb += '<sheet name="' + xe(sh.name) + '" sheetId="' + n + '"' + (sh.state === 'hidden' ? ' state="hidden"' : '') + ' r:id="rId' + n + '"/>';
    wbRels += '<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
    ct.push('<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
    add('xl/worksheets/sheet' + n + '.xml', sheetsXml[i]);
    if (sh.images.length) {
      dn++; add('xl/worksheets/_rels/sheet' + n + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + dn + '.xml"/></Relationships>');
      ct.push('<Override PartName="/xl/drawings/drawing' + dn + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
      const rid = new Map(); let rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
      let dx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
      sh.images.forEach((im, k) => {
        let mf = mediaFiles.get(im.img.key); if (!mf) { mediaN++; mf = 'image' + mediaN + '.png'; mediaFiles.set(im.img.key, mf); add('xl/media/' + mf, im.img.bytes); }
        let id = rid.get(mf); if (!id) { id = 'rId' + (rid.size + 1); rid.set(mf, id); rels += '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + mf + '"/>'; }
        const E = 9525, cx = im.cx * E, cy = im.cy * E;
        dx += '<xdr:oneCellAnchor><xdr:from><xdr:col>' + im.col + '</xdr:col><xdr:colOff>' + im.colOff * E + '</xdr:colOff><xdr:row>' + im.row + '</xdr:row><xdr:rowOff>' + im.rowOff * E + '</xdr:rowOff></xdr:from><xdr:ext cx="' + cx + '" cy="' + cy + '"/>' +
          '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + (k + 2) + '" name="Picture ' + (k + 1) + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="' + id + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>';
      });
      add('xl/drawings/drawing' + dn + '.xml', dx + '</xdr:wsDr>'); add('xl/drawings/_rels/drawing' + dn + '.xml.rels', rels + '</Relationships>');
    }
  });
  const k = book.sheets.length;
  wbRels += '<Relationship Id="rId' + (k + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId' + (k + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>';
  add('[Content_Types].xml', ct.join('') + '</Types>');
  add('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
  add('xl/workbook.xml', wb + '</sheets></workbook>'); add('xl/_rels/workbook.xml.rels', wbRels);
  add('xl/styles.xml', stylesXml(book));
  add('xl/sharedStrings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + book.sstList.length + '" uniqueCount="' + book.sstList.length + '">' + book.sstList.map(t => '<si><t xml:space="preserve">' + xe(t) + '</t></si>').join('') + '</sst>');
  const when = (meta.madeAt || new Date()).toISOString().replace(/\.\d+Z$/, 'Z');
  add('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Fala Fleet Registry</dc:title><dc:creator>Fala Fleet App</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + when + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + when + '</dcterms:modified></cp:coreProperties>');
  add('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Fala Fleet App</Application></Properties>');
  return zip(files);
}

/* ---------- styles used by the shown tabs ---------- */
const ST = {
  band: { fill: PAL.navy, c: PAL.white },
  bandTitle: { fill: PAL.navy, c: PAL.white, b: true, sz: 24, v: 'center', h: 'left', ind: 1 },
  sheetTitle: { b: true, sz: 18, c: PAL.navy },
  sub: { c: PAL.muted, sz: 11 },
  tbar: { fill: PAL.navy, c: PAL.white, b: true, sz: 14, v: 'center', h: 'left', ind: 1 },
  head: { fill: PAL.gold, c: PAL.navy, b: true, w: true, v: 'center', h: 'left', bd: { b: PAL.navy } },
  cell: (z, t, extra) => Object.assign({ bd: { b: PAL.line }, fill: z ? PAL.zebra : undefined, v: 'center', h: 'left' }, t === 'date' ? { nf: DATE_FMT } : t === 'money' ? { nf: '#,##0.00', h: 'right' } : t === 'int' ? { nf: '#,##0', h: 'right' } : t === 'num' ? { nf: '0.######', h: 'right' } : t === 'plain' ? { nf: '0' } : {}, extra || {})
};
function clean(o) { Object.keys(o).forEach(k => { if (o[k] === undefined) delete o[k]; }); return o; }

/* a table: navy title bar (36 pt) with the picture at its right, gold heading row, rows with a thin bottom border and a light zebra.
   cols: [{h, get(row), t:'text'|'date'|'int'|'num'|'money'|'plain', w, style(row,val)}] ; returns the next free row */
function addTable(sh, r0, o) {
  const n = o.cols.length;
  sh.h(r0, 36);
  for (let c = 0; c < n; c++) sh.set(r0, c, c === 0 ? o.title : null, ST.tbar);
  if (o.img) sh.imageRight(o.img, n - 1, r0, 44, 2);
  sh.h(r0 + 1, 32);
  o.cols.forEach((col, c) => { sh.set(r0 + 1, c, col.h, ST.head); sh.w(c, Math.min(16, Math.max(8, col.h.length * 0.8))); if (col.w) sh.w(c, col.w); });
  let r = r0 + 2;
  if (!o.rows.length) { sh.set(r, 0, '(none)', clean(ST.cell(false, 'text', { c: PAL.muted }))); return r + 1; }
  o.rows.forEach((row, i) => {
    o.cols.forEach((col, c) => {
      let v = col.get(row); const z = i % 2 === 1;
      const t = col.t || 'text'; let shown;
      if (t === 'date') { v = v ? { d: String(v).slice(0, 10) } : null; shown = v ? 11 : 0; }
      else if (t === 'text') { v = v === null || v === undefined ? '' : String(v); shown = v.length; }
      else { v = num(v); shown = v === null ? 0 : String(v).length + 3; }
      const ex = col.style ? col.style(row, v) : null;
      sh.set(r, c, v, clean(ST.cell(z, t, ex)));
      if (shown) sh.w(c, Math.min(col.max || 46, shown + 2));
    });
    r++;
  });
  return r;
}
function pageTop(sh, title, sub, widthCols) {
  sh.set(0, 0, title, ST.sheetTitle); sh.h(0, 30); sh.set(1, 0, sub, ST.sub); sh.set(2, 0, null, null); sh.ign = 'A1:' + colL(Math.max(widthCols, 40)) + '3000';
}

/* ============================== read the database into the lists the tabs need ============================== */
function prepare(ctx) {
  const T = n => ctx.tables[n] || [];
  const D = { today: ctx.today, T0: dnum(ctx.today) };
  D.sites = {}; T('sites').forEach(x => { D.sites[x.id] = x; });
  D.projects = {}; T('projects').forEach(x => { D.projects[x.id] = x; });
  D.suppliers = {}; T('suppliers').forEach(x => { D.suppliers[x.id] = x; });
  D.people = {}; T('people').forEach(x => { D.people[x.id] = x; });
  D.vehicles = {}; T('vehicles').forEach(x => { D.vehicles[x.id] = x; });
  D.ptypes = {}; T('paper_types').forEach(x => { D.ptypes[x.id] = x; });
  /* current papers only (is_current = true); if a vehicle/person has two current of one type the highest id wins */
  D.vp = {}; D.pp = {};
  T('papers').filter(p => p.is_current === true).sort((a, b) => a.id - b.id).forEach(p => {
    const t = D.ptypes[p.paper_type_id]; if (!t) return;
    if (p.vehicle_id) (D.vp[p.vehicle_id] = D.vp[p.vehicle_id] || {})[t.name] = p;
    if (p.person_id) (D.pp[p.person_id] = D.pp[p.person_id] || {})[t.name] = p;
  });
  /* vehicle_type with different capital letters is one type: show the most common spelling */
  const cnt = {}; T('vehicles').forEach(v => { const t = s(v.vehicle_type); if (!t) return; const k = t.toLowerCase(); (cnt[k] = cnt[k] || {})[t] = (cnt[k][t] || 0) + 1; });
  D.vtype = {}; Object.keys(cnt).forEach(k => { D.vtype[k] = Object.entries(cnt[k]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]; });
  D.typeOf = v => { const t = s(v.vehicle_type); return t ? D.vtype[t.toLowerCase()] : ''; };
  D.plate = id => { const v = D.vehicles[id]; return v ? s(v.number) : ''; };
  D.pname = id => { const p = D.people[id]; return p ? s(p.passport_name) : ''; };
  /* hire: one hire_terms row per hired-in vehicle; project from the latest hire_postings row */
  D.hire = {}; T('hire_terms').forEach(h => { D.hire[h.vehicle_id] = h; });
  D.postProj = {}; T('hire_postings').slice().sort((a, b) => (iso(a.from_date) < iso(b.from_date) ? -1 : iso(a.from_date) > iso(b.from_date) ? 1 : a.id - b.id)).forEach(p => {
    const pr = D.projects[p.project_id]; if (pr) D.postProj[p.hire_terms_id] = s(pr.name); });
  /* papers as text: "Paper: date; Paper: date" */
  D.paperText = p => p.state === 'Date' && p.expiry ? fmtDate(p.expiry) : p.state === 'NA' ? 'NA' : p.state === 'TASK' ? (s(p.note) || 'TASK') : p.state === 'Note' ? s(p.note) : '';
  D.otherPapers = (map, skip, pt) => Object.keys(map || {}).filter(k => skip.indexOf(k) < 0).sort((a, b) => ((pt[a] || {}).sort - (pt[b] || {}).sort) || (a < b ? -1 : 1))
    .map(k => { const p = map[k]; if (p.state === 'NA' || p.state === 'Empty') return ''; const t = D.paperText(p); return t ? k + ': ' + t : ''; }).filter(Boolean).join('; ');
  D.ptV = {}; D.ptP = {}; T('paper_types').forEach(t => { (t.applies_to === 'person' ? D.ptP : D.ptV)[t.name] = t; });
  D.paperCell = p => !p ? '' : (p.state === 'Date' && p.expiry) ? { d: iso(p.expiry) } : D.paperText(p);
  /* renewals: current vehicle papers of Own vehicles that are not Out of fleet, with a date, days_left <= warn_days */
  D.renew = [];
  T('vehicles').filter(v => v.ownership === 'Own' && v.fleet_status !== 'Out of fleet').forEach(v => {
    const m = D.vp[v.id] || {};
    Object.keys(m).forEach(name => { const p = m[name], t = D.ptV[name]; if (!t || p.state !== 'Date' || !p.expiry) return;
      const left = dnum(iso(p.expiry)) - D.T0; if (left <= t.warn_days) D.renew.push({ v, plate: s(v.number), paper: name, expiry: iso(p.expiry), left, ref: s(p.ref_no), id: p.id }); });
  });
  D.renew.sort((a, b) => (a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1 : nat(a.plate, b.plate) || nat(a.paper, b.paper)));
  D.inFleet = T('vehicles').filter(v => v.ownership === 'Own' && v.fleet_status === 'In fleet').length;
  D.fines = T('fines').filter(f => s(f.ticket_no)).length;
  D.changes = T('change_log').length;
  return D;
}

/* ============================== the shown tabs ============================== */
function fleetRow(D, v) {
  const m = D.vp[v.id] || {}, h = D.hire[v.id], hired = v.ownership === 'Hired in';
  return { v, plate: s(v.number), code: s(v.code), type: D.typeOf(v), own: s(v.ownership), make: s(v.make_model), year: v.year, chassis: s(v.chassis_no), engine: s(v.engine_no), owner: s(v.owner),
    fleet: s(v.fleet_status), board: s(v.board_status), cond: s(v.condition) || s(v.condition_note), driver: v.driver_id ? D.pname(v.driver_id) : s(v.board_driver_text), driver2: v.second_driver_id ? D.pname(v.second_driver_id) : '',
    pulled: v.pulled_by_id ? D.plate(v.pulled_by_id) : '', site: v.site_id && D.sites[v.site_id] ? s(D.sites[v.site_id].name) : '', since: iso(v.site_since), gps: s(v.gps), tracking: s(v.tracking), mortgage: s(v.mortgage),
    emirate: s(v.registration_emirate), reg: D.paperCell(m['Registration']), ins: D.paperCell(m['Insurance']), other: D.otherPapers(m, ['Registration', 'Insurance'], D.ptV),
    supplier: h && h.supplier_id && D.suppliers[h.supplier_id] ? s(D.suppliers[h.supplier_id].name) : '', rate: h ? num(h.monthly_rate) : null, lpo: h ? s(h.lpo_no) : '',
    operator: h ? (s(h.operator_name) || s(h.operator)) : '', diesel: h ? s(h.diesel_by) : '', hfrom: h ? iso(h.start_date) : '', hto: h ? iso(h.end_date) : '', hproj: h ? (D.postProj[h.id] || '') : '',
    notes: s(v.note) || s(v.board_note) };
}
const FLEET_COLS = [
  ['Plate / No.', 'plate', 'text', 16], ['Code', 'code', 'text', 0], ['Type', 'type', 'text', 0], ['Ownership', 'own', 'text', 0], ['Make / model', 'make', 'text', 0], ['Year', 'year', 'plain', 0],
  ['Chassis no.', 'chassis', 'text', 0], ['Engine no.', 'engine', 'text', 0], ['Owner', 'owner', 'text', 0], ['Fleet status', 'fleet', 'text', 0], ['Board status', 'board', 'text', 0], ['Condition', 'cond', 'text', 0],
  ['Driver', 'driver', 'text', 0], ['Second driver', 'driver2', 'text', 0], ['Pulled by', 'pulled', 'text', 0], ['Site', 'site', 'text', 0], ['On site since', 'since', 'date', 0], ['GPS', 'gps', 'text', 0],
  ['Tracking', 'tracking', 'text', 0], ['Mortgage', 'mortgage', 'text', 0], ['Emirate', 'emirate', 'text', 0], ['Registration', 'reg', 'mixed', 0], ['Insurance', 'ins', 'mixed', 0],
  ['Gate pass / permits', 'other', 'text', 0], ['Supplier', 'supplier', 'text', 0], ['Monthly rate (AED)', 'rate', 'money', 0], ['LPO', 'lpo', 'text', 0], ['Operator', 'operator', 'text', 0],
  ['Diesel by', 'diesel', 'text', 0], ['Hire from', 'hfrom', 'date', 0], ['Hire to', 'hto', 'date', 0], ['Hire project', 'hproj', 'text', 0], ['Notes', 'notes', 'text', 0]];

function fleetCols() {
  return FLEET_COLS.map(([h, k, t, w]) => t === 'mixed' ? { h, t: 'text', w: 13, mixed: true, get: r => r[k] } : { h, t, get: r => r[k] === '' || r[k] === undefined ? null : r[k], w: w || 0, max: k === 'other' || k === 'notes' ? 60 : 36 });
}
/* Registration / Insurance hold a real date when the paper has an expiry, otherwise the text the app shows (NA, a note, TASK) */
function addTableMixed(sh, r0, o) {
  const n = o.cols.length; sh.h(r0, 36);
  for (let c = 0; c < n; c++) sh.set(r0, c, c === 0 ? o.title : null, ST.tbar);
  if (o.img) sh.imageRight(o.img, n - 1, r0, 44, 2);
  sh.h(r0 + 1, 32);
  o.cols.forEach((col, c) => { sh.set(r0 + 1, c, col.h, ST.head); sh.w(c, Math.min(16, Math.max(8, col.h.length * 0.8))); if (col.w) sh.w(c, col.w); });
  let r = r0 + 2;
  o.rows.forEach((row, i) => {
    const z = i % 2 === 1;
    o.cols.forEach((col, c) => {
      let v = col.get(row), t = col.t || 'text', shown;
      if (col.mixed) { if (v && typeof v === 'object') { t = 'date'; shown = 11; } else { v = v || ''; shown = String(v).length; } }
      else if (t === 'date') { v = v ? { d: String(v).slice(0, 10) } : null; shown = v ? 11 : 0; }
      else if (t === 'text') { v = v === null || v === undefined ? '' : String(v); shown = v.length; }
      else { v = num(v); shown = v === null ? 0 : String(v).length + 3; }
      sh.set(r, c, v, clean(ST.cell(z, t)));
      if (shown) sh.w(c, Math.min(col.max || 46, shown + 2));
    });
    r++;
  });
  return r;
}

function sheetHome(book, D, ctx, imgs) {
  const sh = book.sheet('Home'), bg = { fill: PAL.bg };
  sh.bgCols = 13; sh.bgStyle = book.style(bg);
  [3, 15, 15, 3, 15, 15, 3, 15, 15, 3, 15, 15, 3].forEach((w, c) => sh.setw(c, w));
  const band = 13;
  [0, 1, 2].forEach(r => { for (let c = 0; c < band; c++) sh.set(r, c, null, ST.band); });
  sh.h(0, 14); sh.h(1, 46); sh.h(2, 14); sh.set(1, 1, 'Fala Fleet Registry', ST.bandTitle);
  if (imgs.logo) sh.imageRight(imgs.logo, band - 1, 0, 64, 16);
  sh.h(3, 26); sh.set(3, 1, 'Last update ' + fmtDate(ctx.today) + ' · copy of the app database', { c: PAL.ink2, fill: PAL.bg, v: 'center' });
  sh.h(4, 10);
  const cards = [['Vehicles in fleet', D.inFleet, 'our own, on the register'], ['On renewals', D.renew.length, 'expired or inside their window'], ['Fines', D.fines, 'on record'], ['Changes in the log', D.changes, 'made in the app']];
  const bd = (t, b, l, r) => clean({ t: t ? PAL.line : undefined, b: b ? PAL.line : undefined, l: l ? PAL.line : undefined, r: r ? PAL.line : undefined });
  cards.forEach((cd, i) => {
    const c0 = 1 + i * 3, c1 = c0 + 1;
    [[5, cd[0], { c: PAL.muted, sz: 10, b: true }, 20, 1, 0], [6, cd[1], { c: PAL.navy, sz: 30, b: true }, 44, 0, 0], [7, cd[2], { c: PAL.muted, sz: 10 }, 20, 0, 1]].forEach(([r, v, f, ht, top, bot]) => {
      sh.h(r, ht);
      sh.set(r, c0, v, Object.assign({ fill: PAL.white, h: 'left', v: 'center', ind: 1, bd: bd(top, bot, 1, 0) }, f));
      sh.set(r, c1, null, { fill: PAL.white, bd: bd(top, bot, 0, 1) });
      sh.merge(r, c0, r, c1);
    });
  });
  sh.h(8, 18);
  sh.set(9, 1, 'What is in this workbook', { b: true, sz: 14, c: PAL.navy, fill: PAL.bg }); sh.h(9, 26);
  const items = [['Fleet', 'Every vehicle and machine, own and hired in, one table per class (' + D.vehiclesN + ' on the register).'], ['Renewals', 'Vehicle papers that are expired or inside their warning window, earliest first.'],
    ['People', 'Drivers, operators and staff with licences, passes, leave and the vehicles they drive.'], ['Sites & Projects', 'The sites with their map position and vehicles, and the projects.'], ['Fines', 'Traffic fines and accidents, newest first.'],
    ['Tyres', 'Every tyre with its last vehicle and position.'], ['Service', 'Service and maintenance jobs, newest first.'], ['Diesel', 'Diesel lines per vehicle and project, newest first.'],
    ['Hire', 'Hired-in terms: supplier, rate, LPO, operator, period and project.'], ['Log', 'History notes, and the changes made in the app.']];
  items.forEach(([nm, tx], i) => {
    const r = 10 + i; sh.h(r, 20);
    sh.set(r, 1, nm, { b: true, u: true, c: PAL.link, fill: PAL.bg, v: 'center' }); sh.link(r, 1, "'" + nm + "'!A1");
    sh.set(r, 4, tx, { c: PAL.ink2, fill: PAL.bg, v: 'center' });
  });
  const r2 = 10 + items.length + 1; sh.h(r2, 20);
  sh.set(r2, 1, 'More tabs are hidden: notes and instructions for Claude or any AI tool, and the raw database tables. Right-click a tab name > Unhide to see them.', { c: PAL.muted, i: true, fill: PAL.bg, v: 'center' });
  return sh;
}

function sheetFleet(book, D, ctx, imgs) {
  const sh = book.sheet('Fleet'); const all = ctx.tables.vehicles || [];
  pageTop(sh, 'Fleet', all.length + ' vehicles and equipment on the register · own and hired-in · ' + fmtDate(ctx.today), FLEET_COLS.length);
  sh.freeze = { row: 3, col: 1 };
  const rows = all.map(v => fleetRow(D, v)); const cols = fleetCols(); const classes = CLASSES.slice();
  all.forEach(v => { const c = s(v.class) || 'Unclassified'; if (classes.indexOf(c) < 0) classes.push(c); });
  let r = 3; D.fleetCounts = {};
  classes.forEach(cls => {
    const g = rows.filter(x => (s(x.v.class) || 'Unclassified') === cls).sort((a, b) => (a.own === b.own ? 0 : a.own === 'Own' ? -1 : 1) || nat(a.plate, b.plate) || a.v.id - b.v.id);
    if (!g.length && classes.indexOf(cls) >= CLASSES.length) return;
    D.fleetCounts[cls] = g.length;
    r = addTableMixed(sh, r, { title: cls + '  ·  ' + g.length, cols, rows: g, img: imgs.cls[cls] }) + 1;
  });
  return sh;
}

function sheetRenewals(book, D, ctx) {
  const sh = book.sheet('Renewals'); const rows = D.renew;
  pageTop(sh, 'Renewals', rows.length + ' vehicle papers expired or inside their warning window, earliest first', 7);
  addTable(sh, 3, { title: 'Expired and due soon', rows, cols: [
    { h: 'Plate / name', get: r => r.plate, w: 16 }, { h: 'For', get: () => 'Vehicle' }, { h: 'Paper', get: r => r.paper, w: 22 }, { h: 'Expiry', t: 'date', get: r => r.expiry },
    { h: 'Days left', t: 'plain', get: r => r.left },
    { h: 'Status', get: r => r.left < 0 ? 'Expired' : 'Due soon', style: r => ({ b: true, c: r.left < 0 ? PAL.crit : PAL.warn }) }, { h: 'Reference', get: r => r.ref, w: 22 }] });
  return sh;
}

function sheetPeople(book, D, ctx) {
  const sh = book.sheet('People'), P = ctx.tables.people || [];
  pageTop(sh, 'People', P.length + ' people · drivers, operators and staff', 17);
  const vehOf = {}; (ctx.tables.vehicles || []).forEach(v => { [v.driver_id, v.second_driver_id].forEach(id => { if (id) (vehOf[id] = vehOf[id] || []).push(s(v.number)); }); });
  const cols = [{ h: 'Code', get: p => s(p.code), w: 10 }, { h: 'Name', get: p => s(p.passport_name), w: 30 }, { h: 'Role', get: p => s(p.role) }, { h: 'Section', get: p => s(p.section) }, { h: 'Status', get: p => s(p.status) },
    { h: 'Employee no.', get: p => s(p.employee_no) }, { h: 'Employer', get: p => s(p.employer) }, { h: 'Start date', t: 'date', get: p => p.start_date }, { h: 'Left date', t: 'date', get: p => p.left_date },
    { h: 'Leave from', t: 'date', get: p => p.leave_from }, { h: 'Leave to', t: 'date', get: p => p.leave_to }, { h: 'Leave note', get: p => s(p.leave_note) },
    { h: 'Driver licence', get: p => { const x = (D.pp[p.id] || {})['Driver Licence']; return x ? s(x.ref_no) : ''; } },
    { h: 'Licence expiry', t: 'date', get: p => { const x = (D.pp[p.id] || {})['Driver Licence']; return x && x.state === 'Date' ? x.expiry : null; } },
    { h: 'Gate / other passes', get: p => D.otherPapers(D.pp[p.id], ['Driver Licence'], D.ptP), max: 60 },
    { h: 'Vehicle', get: p => (vehOf[p.id] || []).sort(nat).join(', '), max: 40 }, { h: 'Note', get: p => s(p.note), max: 60 }];
  const byCode = (a, b) => nat(a.code, b.code) || a.id - b.id; let r = 3;
  [['Drivers', 'Drivers'], ['Operators', 'Operators'], ['Staff', 'Staff']].forEach(([title, sec]) => {
    const g = P.filter(p => p.section === sec).sort(byCode); r = addTable(sh, r, { title: title + '  ·  ' + g.length, cols, rows: g }) + 1; });
  const rest = P.filter(p => ['Drivers', 'Operators', 'Staff'].indexOf(p.section) < 0).sort(byCode);
  if (rest.length) addTable(sh, r, { title: 'No section  ·  ' + rest.length, cols, rows: rest });
  return sh;
}

function sheetSites(book, D, ctx) {
  const sh = book.sheet('Sites & Projects'), S = ctx.tables.sites || [], PR = ctx.tables.projects || [];
  pageTop(sh, 'Sites & Projects', S.length + ' sites · ' + PR.length + ' projects', 6);
  const nv = {}; (ctx.tables.vehicles || []).forEach(v => { if (v.site_id) nv[v.site_id] = (nv[v.site_id] || 0) + 1; });
  const r = addTable(sh, 3, { title: 'Sites  ·  ' + S.length, rows: S.slice().sort((a, b) => a.id - b.id), cols: [{ h: 'Name', get: x => s(x.name), w: 24 }, { h: 'What it is', get: x => s(x.what_it_is), w: 30 },
    { h: 'Lat', t: 'num', get: x => x.lat, style: () => ({ nf: '0.000000' }) }, { h: 'Lng', t: 'num', get: x => x.lng, style: () => ({ nf: '0.000000' }) }, { h: 'Note', get: x => s(x.note), w: 40 }, { h: 'Vehicles there', t: 'int', get: x => nv[x.id] || 0 }] }) + 1;
  addTable(sh, r, { title: 'Projects  ·  ' + PR.length, rows: PR.slice().sort((a, b) => a.id - b.id), cols: [{ h: 'Name', get: x => s(x.name) }, { h: 'Site', get: x => x.site_id && D.sites[x.site_id] ? s(D.sites[x.site_id].name) : '' }, { h: 'Note', get: x => s(x.note) }] });
  return sh;
}

function sheetFines(book, D, ctx) {
  const sh = book.sheet('Fines'), F = (ctx.tables.fines || []).slice().sort((a, b) => (iso(b.fine_date) < iso(a.fine_date) ? -1 : iso(b.fine_date) > iso(a.fine_date) ? 1 : b.id - a.id));
  pageTop(sh, 'Fines', F.length + ' fines and accidents · newest first', 13);
  addTable(sh, 3, { title: 'Fines  ·  ' + F.length, rows: F, cols: [{ h: 'Kind', get: f => s(f.kind) }, { h: 'Plate', get: f => (f.vehicle_id ? D.plate(f.vehicle_id) : '') || s(f.vehicle_as_written), w: 14 },
    { h: 'Fine date', t: 'date', get: f => f.fine_date }, { h: 'Ticket no.', get: f => s(f.ticket_no) }, { h: 'Amount', t: 'money', get: f => f.amount }, { h: 'Paid on', t: 'date', get: f => f.paid_date },
    { h: 'Written name', get: f => s(f.name_as_written) }, { h: 'Person', get: f => f.person_id ? D.pname(f.person_id) : '' }, { h: 'Place', get: f => s(f.place) }, { h: 'Full amount', t: 'money', get: f => f.full_amount },
    { h: 'Cause', get: f => s(f.cause), max: 50 }, { h: 'Offence', get: f => s(f.offence), max: 50 }, { h: 'Note', get: f => s(f.note), max: 50 }] });
  return sh;
}

function sheetTyres(book, D, ctx) {
  const sh = book.sheet('Tyres'), Y = ctx.tables.tyres || [], last = {};
  (ctx.tables.tyre_moves || []).slice().sort((a, b) => (iso(a.from_date) < iso(b.from_date) ? -1 : iso(a.from_date) > iso(b.from_date) ? 1 : a.id - b.id)).forEach(m => { last[m.tyre_id] = m; });
  const rows = Y.slice().sort((a, b) => nat(a.tyre_no, b.tyre_no) || a.id - b.id);
  pageTop(sh, 'Tyres', rows.length + ' tyres · last vehicle and position from the newest tyre move', 10);
  addTable(sh, 3, { title: 'Tyres  ·  ' + rows.length, rows, cols: [{ h: 'Tyre no.', get: t => s(t.tyre_no) }, { h: 'Brand', get: t => s(t.brand) }, { h: 'Size', get: t => s(t.size) }, { h: 'Details', get: t => s(t.details), max: 40 },
    { h: 'Status', get: t => s(t.status) }, { h: 'Disposed on', t: 'date', get: t => t.disposed_on }, { h: 'Last vehicle', get: t => last[t.id] ? D.plate(last[t.id].vehicle_id) : '', w: 14 },
    { h: 'Position', get: t => last[t.id] ? s(last[t.id].position) : '' }, { h: 'From', t: 'date', get: t => last[t.id] ? last[t.id].from_date : null }, { h: 'To', t: 'date', get: t => last[t.id] ? last[t.id].to_date : null }] });
  return sh;
}

function sheetService(book, D, ctx) {
  const sh = book.sheet('Service'), J = (ctx.tables.service_jobs || []).slice().sort((a, b) => (iso(b.job_date) < iso(a.job_date) ? -1 : iso(b.job_date) > iso(a.job_date) ? 1 : b.id - a.id));
  pageTop(sh, 'Service', J.length + ' service jobs · newest first', 8);
  addTable(sh, 3, { title: 'Service  ·  ' + J.length, rows: J, cols: [{ h: 'Vehicle', get: j => D.plate(j.vehicle_id), w: 14 }, { h: 'Date', t: 'date', get: j => j.job_date }, { h: 'Job', get: j => s(j.job), max: 50 },
    { h: 'Odometer', t: 'int', get: j => j.odometer }, { h: 'Hours', t: 'int', get: j => j.hours }, { h: 'Note', get: j => s(j.note), max: 50 }, { h: 'Type', get: j => s(j.service_type) }, { h: 'Done by', get: j => s(j.done_by) }] });
  return sh;
}

function sheetDiesel(book, D, ctx) {
  const sh = book.sheet('Diesel'), L = (ctx.tables.diesel_lines || []).slice().sort((a, b) => (iso(b.from_date) < iso(a.from_date) ? -1 : iso(b.from_date) > iso(a.from_date) ? 1 : b.id - a.id));
  pageTop(sh, 'Diesel', L.length + ' diesel lines · newest first', 7);
  addTable(sh, 3, { title: 'Diesel  ·  ' + L.length, rows: L, cols: [{ h: 'Vehicle', get: d => (d.vehicle_id ? D.plate(d.vehicle_id) : '') || s(d.vehicle_as_written), w: 14 },
    { h: 'Project', get: d => d.project_id && D.projects[d.project_id] ? s(D.projects[d.project_id].name) : '', w: 22 }, { h: 'From', t: 'date', get: d => d.from_date }, { h: 'To', t: 'date', get: d => d.to_date },
    { h: 'Litres', t: 'int', get: d => d.litres }, { h: 'Cost', t: 'money', get: d => d.cost }, { h: 'Hours', t: 'int', get: d => d.hours }] });
  return sh;
}

function sheetHire(book, D, ctx) {
  const sh = book.sheet('Hire'), H = (ctx.tables.hire_terms || []).slice().sort((a, b) => nat(D.plate(a.vehicle_id), D.plate(b.vehicle_id)) || a.id - b.id);
  pageTop(sh, 'Hire', H.length + ' hired-in vehicles · terms, period and project', 12);
  addTable(sh, 3, { title: 'Hired in  ·  ' + H.length, rows: H, cols: [{ h: 'Vehicle', get: h => D.plate(h.vehicle_id), w: 14 }, { h: 'Supplier', get: h => h.supplier_id && D.suppliers[h.supplier_id] ? s(D.suppliers[h.supplier_id].name) : '', w: 24 },
    { h: 'Monthly rate (AED)', t: 'money', get: h => h.monthly_rate }, { h: 'LPO', get: h => s(h.lpo_no) }, { h: 'Operator', get: h => s(h.operator) }, { h: 'Operator name', get: h => s(h.operator_name) }, { h: 'Diesel by', get: h => s(h.diesel_by) },
    { h: 'Jack hammer', get: h => h.jack_hammer === true ? 'Yes' : '' }, { h: 'Start', t: 'date', get: h => h.start_date }, { h: 'End', t: 'date', get: h => h.end_date }, { h: 'Project', get: h => D.postProj[h.id] || '', w: 22 }, { h: 'Note', get: h => s(h.note), max: 50 }] });
  return sh;
}

function sheetLog(book, D, ctx) {
  const sh = book.sheet('Log'), E = (ctx.tables.log_entries || []).slice().sort((a, b) => (iso(b.entry_date) < iso(a.entry_date) ? -1 : iso(b.entry_date) > iso(a.entry_date) ? 1 : b.id - a.id));
  const C = (ctx.tables.change_log || []).slice().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id));
  pageTop(sh, 'Log', E.length + ' log entries · ' + C.length + ' changes made in the app · newest first', 7);
  let r = addTable(sh, 3, { title: 'Log entries  ·  ' + E.length, rows: E, cols: [{ h: 'Date', t: 'date', get: e => e.entry_date }, { h: 'About', get: e => s(e.about) }, { h: 'Vehicle', get: e => (e.vehicle_id ? D.plate(e.vehicle_id) : '') || s(e.which_as_written), w: 14 },
    { h: 'Person', get: e => e.person_id ? D.pname(e.person_id) : '' }, { h: 'Category', get: e => s(e.category) }, { h: 'Text', get: e => s(e.text), max: 70 }, { h: 'Done', get: e => e.done === true ? 'Yes' : 'No' }] }) + 1;
  addTable(sh, r, { title: 'Changes made in the app  ·  ' + C.length, rows: C, cols: [{ h: 'Date', t: 'date', get: c => dubaiDate(c.at) }, { h: 'Kind', get: c => s(c.kind) }, { h: 'Vehicle', get: c => c.vehicle_id ? D.plate(c.vehicle_id) : '', w: 14 },
    { h: 'By', get: c => s(c.by_email), w: 28 }, { h: 'Summary', get: c => s(c.summary), max: 70 }] });
  return sh;
}

/* ============================== hidden tabs: raw tables, dictionary, notes for AI ============================== */
const FK = { vehicle_id: 'vehicles', pulled_by_id: 'vehicles', driver_id: 'people', second_driver_id: 'people', person_id: 'people', site_id: 'sites', project_id: 'projects', paper_type_id: 'paper_types',
  supplier_id: 'suppliers', tyre_id: 'tyres', hire_terms_id: 'hire_terms', report_file_id: 'report_files', posting_id: 'hire_postings', by_user: 'app_users (uuid)', updated_by: 'app_users (uuid)',
  uploaded_by: 'app_users (uuid)', decided_by: 'app_users (uuid)', requested_by: 'app_users (uuid)', changed_by: 'app_users (uuid)' };
const TABLE_DOC = {
  vehicles: 'THE main table: one row per truck, trailer, car, tanker, machine and piece of equipment, own and hired in (247 on 17 Nov 2026: 136 Own + 111 Hired in). Drivers, sites and the pulling truck are links (_id columns). Fleet, Map and Renewals are built from it.',
  people: 'Drivers, operators and staff (one row per person, 135 on 17 Nov 2026). section = Drivers / Operators / Staff (8 people have no section). Papers of a person (licence, passes) are in papers.',
  sites: 'Sites and yards (Jebel Ali, DIC, AMIA, ...) with map position (lat, lng). Vehicles point to their site with site_id.',
  projects: 'Projects, each at one site. Used by hire postings and diesel lines. "Fala Yard" is Fala headquarters, not a project.',
  paper_types: 'The list of paper names (Registration, Insurance, gate passes, permits, Driver Licence ...) with warn_days = how many days before expiry the paper counts as "on renewal", and applies_to = vehicle or person.',
  papers: 'Every paper of every vehicle or person, with history. ALWAYS use only rows with is_current = true. state = Date (has an expiry date), Note or TASK (text in note), NA (not needed), Empty (not held).',
  board_history: 'Earlier driver / site of a vehicle with from and to dates (history of the old board).',
  log_entries: 'The history notes written by the Logistics Manager about a vehicle or a person (category, text, done yes/no).',
  tyres: 'One row per tyre (number, brand, size, fitted or disposed).',
  tyre_moves: 'Where a tyre was fitted: vehicle, position, from_date, to_date. The newest from_date per tyre is where it is now (replaced tyres keep to_date empty).',
  service_jobs: 'Service and maintenance jobs done on a vehicle (date, job, odometer, hours, who did it).',
  fines: 'Traffic fines (kind Ticket) and accidents (kind Accident), with ticket number, amount, person and place. Contains personal data.',
  diesel_lines: 'Diesel taken by a vehicle for a project in a period (litres, cost, hours).',
  suppliers: 'Companies that hire machines to Fala.',
  hire_terms: 'Hired-in terms, exactly one row per hired-in vehicle: supplier, monthly rate (AED), LPO, operator, who pays diesel, start and end date.',
  hire_postings: 'The project a hired-in machine is posted to, with from / to dates (link to hire_terms).',
  hire_months: 'Monthly days and hours of a hire posting (empty today).',
  report_files: 'Which report files were loaded (tyres, service, fines, diesel, hired timesheet) and the dates they cover.',
  name_spellings: 'Other spellings of a person name found in reports, pointing to the person (empty today).',
  app_users: 'Who can sign in to the app and their role (admin, editor, viewer). Passwords are in Supabase and are not exported. Personal data.',
  change_log: 'Everything changed in the app: when, who (email), what kind, which vehicle, a summary and details (JSON).',
  gps_positions: 'Last GPS position of a tracked vehicle (snapshot, refreshed by hand).',
  machine_months: 'Per vehicle and month (Jul-Oct 2026): litres, fuel days, last fuel date, hours, working days, trips.',
  report_unmatched: 'Report lines that could not be linked to a vehicle, kept for a decision.',
  machine_change_requests: 'Requests by an Editor to change a plate / asset no., engine no. or Registered to; the Admin approves or rejects ("Requests waiting").',
  vehicle_old_numbers: 'Old plate or asset numbers of a vehicle, kept so searches still find it.',
  drawings: 'The vehicle drawings used on the cards and in Fleet. name = drawing name; the PNG as base64 text is cut in part1, part2, ... (join them in order, then prefix data:image/png;base64,).',
  app_logos: 'The app icon and the FALA logo as PNG. The base64 text is cut in part1, part2, ... (join in order).'
};
const COL_DOC = {
  'vehicles.year': 'Year of manufacture.', 'vehicles.make_model': 'Make and model.', 'vehicles.chassis_no': 'Chassis number.', 'vehicles.engine_no': 'Engine number.',
  'vehicles.number': 'Plate or asset / serial number shown as "Plate / No." everywhere.', 'vehicles.number_type': 'Plate, Serial or Asset tag.', 'vehicles.ownership': 'Own (Fala owns it) or Hired in (hired from a supplier).',
  'vehicles.class': 'Group used by the app: 3XL Truck, Six Wheel, Trailer, Special Trailer, Other Vehicle, Car / Light Vehicle, Equipment.', 'vehicles.vehicle_type': 'Kind of vehicle. Capital letters are not consistent (EXCAVATOR / Excavator): compare case-insensitively.',
  'vehicles.code': 'Short code of the vehicle.', 'vehicles.fleet_status': 'In fleet, Out of fleet, or Rented to Fala Road (own trucks rented to Fala Road Contracting).', 'vehicles.condition': 'OK, Watch, Needs repair, Out of service, In garage.',
  'vehicles.condition_note': 'Free text about the condition.', 'vehicles.registration_emirate': 'Emirate of registration.', 'vehicles.tracking': 'Diesel sensor, UD Original or None.', 'vehicles.site_id': 'Where the vehicle is now.',
  'vehicles.site_since': 'Date it arrived at this site.', 'vehicles.driver_id': 'Current driver.', 'vehicles.second_driver_id': 'Second driver.', 'vehicles.driver_since': 'Date the current driver started.', 'vehicles.pulled_by_id': 'For a trailer: the truck that pulls it.',
  'vehicles.board_status': 'Text status from the old board.', 'vehicles.board_driver_text': 'Driver as written on the old board when no person is linked.', 'vehicles.board_note': 'Note from the old board.', 'vehicles.note': 'Free note.', 'vehicles.gps': 'GPS text (Yes / No ...).', 'vehicles.owner': 'Registered owner (Registered to).',
  'people.passport_name': 'Full name as on the passport (the name shown in the app).', 'people.code': 'Short code, used to sort people.', 'people.section': 'Drivers, Operators or Staff.', 'people.status': 'Active, On Leave, Left or Suspended.', 'people.employee_no': 'Employee number (personal data).',
  'people.employer': 'Company that employs the person.', 'people.leave_from': 'Start of the leave.', 'people.leave_to': 'End of the leave.',
  'papers.is_current': 'True = the paper the app shows today. False = history. Always filter is_current = true.', 'papers.state': 'Date = has an expiry date; Note / TASK = text in note; NA = not needed; Empty = not held.', 'papers.expiry': 'Expiry date (when state = Date).', 'papers.ref_no': 'Paper number, for example the licence number.',
  'papers.vehicle_id': 'The vehicle the paper belongs to (empty for a person paper).', 'papers.person_id': 'The person the paper belongs to (empty for a vehicle paper).',
  'paper_types.warn_days': 'A paper is on renewal when days_left = expiry - today <= warn_days; Expired when days_left < 0.', 'paper_types.applies_to': 'vehicle or person.', 'paper_types.sort': 'Order of the papers on a card.',
  'hire_terms.monthly_rate': 'Monthly rate in AED.', 'hire_terms.lpo_no': 'Local purchase order number.', 'hire_terms.operator': 'With operator or Without operator.', 'hire_terms.diesel_by': 'Who pays the diesel.', 'hire_terms.jack_hammer': 'True when a jack hammer comes with the machine.',
  'hire_terms.start_date': 'Start of the hire.', 'hire_terms.end_date': 'End of the hire (set when the machine is sent back).', 'hire_postings.project_id': 'Project the hired machine is posted to.',
  'fines.kind': 'Ticket or Accident.', 'fines.ticket_no': 'Ticket number; a fine counts on Home when it is filled.', 'fines.amount': 'Amount paid or due, AED.', 'fines.full_amount': 'Full amount before reduction, AED.', 'fines.vehicle_as_written': 'Plate as written in the report when no vehicle could be linked.',
  'fines.name_as_written': 'Name as written in the report.', 'fines.paid_date': 'Date the fine was paid.',
  'tyre_moves.position': 'Position of the tyre on the vehicle (for example T13).', 'tyre_moves.from_date': 'Date fitted.', 'tyre_moves.to_date': 'Date removed (empty = still there or replaced without a date).',
  'tyres.status': 'Fitted or Disposed.', 'service_jobs.service_type': 'Kind of service.', 'service_jobs.odometer': 'Odometer in km.', 'service_jobs.hours': 'Engine hours.',
  'diesel_lines.litres': 'Litres of diesel.', 'diesel_lines.cost': 'Cost in AED.', 'diesel_lines.vehicle_as_written': 'Plate as written in the report when no vehicle could be linked.',
  'change_log.at': 'When (UTC timestamp).', 'change_log.by_email': 'Who made the change.', 'change_log.kind': 'Kind of change.', 'change_log.summary': 'Text shown in the app change log.', 'change_log.details': 'JSON with old and new values.', 'change_log.seen_at': 'When the administrator marked it as seen on Home (empty = still a new change).', 'change_log.seen_by': 'User id who marked it seen.',
  'log_entries.about': 'Asset or Person.', 'log_entries.category': 'Renewal, Maintenance, Incident, Document, Personnel, Assignment or Other.', 'log_entries.done': 'True when the note is finished.', 'log_entries.which_as_written': 'Vehicle as written when no link could be made.',
  'sites.what_it_is': 'Short description of the site.', 'sites.lat': 'Latitude for the map.', 'sites.lng': 'Longitude for the map.', 'machine_months.litres': 'Litres of diesel in the month.', 'machine_months.month': 'First day of the month.',
  'app_users.role': 'admin, editor or viewer.', 'app_users.email': 'Sign-in email (personal data).', 'machine_change_requests.status': 'pending, approved or rejected.', 'machine_change_requests.field': 'number, engine_no or owner.'
};
const GEN_DOC = { id: 'Row number of the table (integer, never reused).', name: 'Name.', note: 'Free text note.', updated_at: 'When the row was last changed (UTC).', updated_by: 'App user who last changed the row.', created_at: 'When the row was created (UTC).' };

function colMeaning(tab, col) {
  if (COL_DOC[tab + '.' + col]) return COL_DOC[tab + '.' + col];
  if (FK[col]) return 'Link: id of the row in ' + FK[col] + '.';
  if (GEN_DOC[col]) return GEN_DOC[col];
  if (/_date$/.test(col) || /^date_/.test(col)) return 'Date (' + col.replace(/_/g, ' ') + ').';
  if (/_as_written$/.test(col)) return 'Original report text, kept when no link could be made. Use the linked id first.';
  return col.replace(/_/g, ' ') + '.';
}
function typeOf(vals) {
  let t = ''; for (const v of vals) { if (v === null || v === undefined || v === '') continue;
    const k = typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v === 'object' ? 'json' :
      /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v) ? 'uuid' : /^\d{4}-\d\d-\d\dT/.test(v) ? 'timestamp (ISO, UTC)' : /^\d{4}-\d\d-\d\d$/.test(v) ? 'date (ISO text)' : 'text';
    if (!t) t = k; else if (t !== k) { if ((t === 'integer' && k === 'number') || (t === 'number' && k === 'integer')) t = 'number'; else return 'text'; } }
  return t || 'text';
}

function rawCell(v) { return v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : v; }
function rawTables(ctx) {                                 // [{name, cols, rows:[[...]], note}]
  const out = [];
  TABLE_ORDER.forEach(([t]) => {
    const rows = ctx.tables[t] || []; let cols = COLS[t] ? COLS[t].split(',') : [];
    rows.forEach(r => Object.keys(r).forEach(k => { if (cols.indexOf(k) < 0) cols.push(k); }));
    out.push({ name: t, cols, rows: rows.map(r => cols.map(c => rawCell(r[c]))), note: ctx.errors && ctx.errors[t] ? 'This table could not be read: ' + ctx.errors[t] : '' });
  });
  const split = (rowsIn) => { let max = 0; const rs = rowsIn.map(o => { const parts = []; const u = o.uri || ''; for (let i = 0; i < u.length; i += 30000) parts.push(u.slice(i, i + 30000)); max = Math.max(max, parts.length); return { o, parts }; }); return { rs, max }; };
  const dr = split(Object.keys(ctx.drawings || {}).sort().map(k => ({ name: k, uri: ctx.drawings[k] })));
  out.push({ name: 'drawings', cols: ['name'].concat(Array.from({ length: Math.max(1, dr.max) }, (_, i) => 'part' + (i + 1))), rows: dr.rs.map(x => [x.o.name].concat(Array.from({ length: Math.max(1, dr.max) }, (_, i) => x.parts[i] || null))), note: '' });
  const lg = split((ctx.logos || []).map(l => ({ name: l.name, file: l.file, uri: l.uri })));
  out.push({ name: 'app_logos', cols: ['name', 'file'].concat(Array.from({ length: Math.max(1, lg.max) }, (_, i) => 'part' + (i + 1))), rows: lg.rs.map(x => [x.o.name, x.o.file].concat(Array.from({ length: Math.max(1, lg.max) }, (_, i) => x.parts[i] || null))), note: '' });
  return out;
}

function textSheet(book, name, head, rows, widths, hidden, code) {
  const sh = book.sheet(name, { state: hidden ? 'hidden' : 'visible' });
  sh.set(0, 0, name, ST.sheetTitle); sh.h(0, 30);
  head.forEach((h, c) => { sh.set(2, c, h, ST.head); sh.setw(c, widths[c]); }); sh.h(2, 24);
  rows.forEach((r, i) => { r.forEach((v, c) => { if (v === undefined) return; const num = typeof v === 'number'; sh.set(3 + i, c, v, clean({ w: !num && widths[c] >= 30 && !code, v: 'top', h: 'left', bd: code ? undefined : { b: PAL.line }, b: !code && c === 0 })); }); });
  return sh;
}

const TEXT = {
  readme: (D, ctx, raws) => [
    ['Purpose', 'This workbook is a copy of the Fala Fleet Registry app database, made on ' + fmtDate(ctx.today) + ' by ' + (ctx.madeBy || 'an admin') + '. It has two kinds of tabs: tabs that show what the app shows, and hidden tabs for AI tools.'],
    ['Visible tabs', 'Home, Fleet, Renewals, People, Sites & Projects, Fines, Tyres, Service, Diesel, Hire, Log. Values only (no formulas), no ids (names are written out), one row per vehicle in Fleet. People read these.'],
    ['Hidden tabs', 'AI README, AI Data dictionary, AI Rules, AI Screens, AI Build script, Notes for Claude = documentation for Claude or any AI tool. raw_<table> = the raw database tables with the original column names, ids and values: the source of truth. The visible tabs are derived from them. Right-click a tab > Unhide shows them.'],
    ['How to rebuild the app', '1) Create one table per raw_<table> sheet with the same column names and the same integer ids (app_users uses uuid). 2) Apply the joins listed in AI Data dictionary (columns ending _id point to another table). 3) Apply AI Rules (only papers.is_current = true; renewals; counts; case-insensitive vehicle_type). 4) Reproduce the screens listed in AI Screens (Home, Fleet, Renewals, Map, People, Hired In, Fines ...). 5) Pictures: raw_drawings (vehicle drawings by name) and raw_app_logos (icon and FALA logo): join part1, part2, ... in order, put data:image/png;base64, in front and you have the PNG.'],
    ['Company', 'Fala Group, Dubai / Jebel Ali (FALA Building Demolition, FALA Building Material, FALA Transportation & Earthworks). Fala Building Material Trading LLC owns the fleet. Some own trucks are rented to Fala Road Contracting (fleet_status = Rented to Fala Road). The owner of the file is the Logistics Manager.'],
    ['Not linked', 'The Fleet Registry is NOT linked to the DIC Operations, Driver Overtime or Costs modules of the FALA LOGISTICS project: never join them.'],
    ['Personal data', 'employee_no, app_users emails and fines are personal data. Keep this file for admins only.'],
    ['Dataset size', raws.filter(t => t.rows.length || true).map(t => t.name + ' ' + t.rows.length).join(' · ') + ' · total ' + raws.reduce((a, t) => a + t.rows.length, 0) + ' rows'],
    ['Today and time', 'Made on ' + ctx.today + ' (Asia/Dubai). Dates in raw tabs are ISO text (YYYY-MM-DD); timestamps are UTC; the business timezone is Asia/Dubai (UTC+4).']],
  rules: (D, ctx) => [
    ['Ids and links', 'Every table has an integer id (app_users uses uuid). Columns ending _id point to another table: vehicle_id, pulled_by_id -> vehicles; driver_id, second_driver_id, person_id -> people; site_id -> sites; project_id -> projects; paper_type_id -> paper_types; supplier_id -> suppliers; tyre_id -> tyres; hire_terms_id -> hire_terms; report_file_id -> report_files.'],
    ['Papers', 'papers keeps history. ALWAYS use only is_current = True. state = Date has an expiry; Note / TASK keep text in note; Empty = not held. A paper is on renewal when days_left = expiry - today <= paper_types.warn_days; it is Expired when days_left < 0 (expired items are also on renewal).'],
    ['Ownership and status', 'vehicles.ownership: Own | Hired in. fleet_status: In fleet | Out of fleet | Rented to Fala Road (own trucks rented out to Fala Road Contracting). Sidebar "Fleet" count = Own with fleet_status <> Out of fleet (131).'],
    ['Vehicle type', 'vehicle_type has inconsistent case (EXCAVATOR / Excavator, BOBCAT / Bobcat): normalise case-insensitively when grouping.'],
    ['As written', 'Columns *_as_written keep the original report text when no link could be made; use the linked id first.'],
    ['Dates and time', 'Dates are ISO text; timestamps are UTC; business timezone is Asia/Dubai (UTC+4).'],
    ['Not linked', 'The Fleet Registry is NOT linked to the DIC Operations / Driver Overtime / Costs modules of the FALA LOGISTICS project: never join them.'],
    ['Personal data', 'Personal data (employee_no, app_users emails, fines) is in the file: keep the download for admins only if the app already restricts it that way.'],
    ['Home: Vehicles in fleet', 'Count of vehicles with ownership = Own AND fleet_status = In fleet. Now ' + D.inFleet + '. Caption "our own, on the register".'],
    ['Home: On renewals', 'Count of current vehicle papers (is_current, state = Date) on renewal, for Own vehicles whose fleet_status <> Out of fleet. Now ' + D.renew.length + '. Caption "expired or inside their window".'],
    ['Home: Fines', 'Count of fines rows with ticket_no filled. Now ' + D.fines + '. Caption "on record".'],
    ['Home: Changes in the log', 'Count of change_log rows. Now ' + D.changes + '. Caption "made in the app".'],
    ['Fleet tab', 'One row per vehicle (' + (ctx.tables.vehicles || []).length + '): one table per class in the order 3XL Truck, Six Wheel, Trailer, Special Trailer, Other Vehicle, Car / Light Vehicle, Equipment; Own first, then Hired in, by number. The table counts add up to the total.'],
    ['Hire columns', 'From hire_terms (one row per hired-in vehicle) + suppliers + hire_postings (project, the newest posting).']],
  screens: (D, ctx) => [
    ['Home', 'Navy title band "Fala Fleet Registry" with the Fala logo at the top right, a line with the date, 4 white cards (caption, big navy number, sub-caption), then the contents list.', 'vehicles, papers, paper_types, fines, change_log', 'Cream-grey background, white cards with a thin border, no gridlines.'],
    ['Fleet', 'Every vehicle, one table per class, columns as in the app plus ownership, papers, hire terms.', 'vehicles, people, sites, papers, paper_types, hire_terms, suppliers, hire_postings, projects', 'Navy title bar "<class>  ·  <count>" with the class drawing at its right, gold heading row, thin bottom borders, light zebra. Freeze panes at B4.'],
    ['Renewals', 'Vehicle papers expired or inside their warning window, earliest first. Status Expired (bold red) / Due soon (bold amber).', 'papers, paper_types, vehicles', 'One table "Expired and due soon".'],
    ['People', 'Drivers, Operators, Staff with licence, passes, leave and vehicles.', 'people, papers, paper_types, vehicles', 'Three tables sorted by code (plus a table for people with no section).'],
    ['Sites & Projects', 'Sites with map position and number of vehicles; projects with their site.', 'sites, projects, vehicles', 'Two tables.'],
    ['Fines', 'All fines and accidents, newest first.', 'fines, vehicles, people', 'One table.'],
    ['Tyres', 'Every tyre with its last vehicle, position and dates.', 'tyres, tyre_moves, vehicles', 'One table.'],
    ['Service', 'Service jobs, newest first.', 'service_jobs, vehicles', 'One table.'],
    ['Diesel', 'Diesel lines, newest first.', 'diesel_lines, vehicles, projects', 'One table.'],
    ['Hire', 'Hired-in terms, one row per hired-in vehicle.', 'hire_terms, vehicles, suppliers, hire_postings, projects', 'One table.'],
    ['Log', 'History notes and the changes made in the app, newest first.', 'log_entries, change_log, vehicles, people', 'Two tables.'],
    ['Palette (the app\'s own colours)', 'Navy ' + PAL.navy + ' (title bars, big numbers), gold ' + PAL.gold + ' (heading row), page grey ' + PAL.bg + ' (Home background, zebra), borders ' + PAL.line + ', red ' + PAL.crit + ' (Expired), amber ' + PAL.warn + ' (Due soon), link blue ' + PAL.link + '. Font in Excel: Calibri (the app itself uses Archivo and IBM Plex).', '', 'Dates are real dates formatted DD-MMM-YYYY; headings wrap; gridlines off; navy tab colour.'],
    ['App screen: Home "Fleet today"', 'Admin only. Last update, Download Excel button, four numbers, requests waiting, change log.', 'change_log, vehicles, fines, papers', ''],
    ['App screen: Fleet', 'Own fleet (Own and not Out of fleet = ' + (ctx.tables.vehicles || []).filter(v => v.ownership === 'Own' && v.fleet_status !== 'Out of fleet').length + '), cards by class with a drawing, card tabs, Change driver / Change site / Renew.', 'vehicles', ''],
    ['App screen: Renewals', 'Everything dated that is expired or due, split by kind; count ' + D.renew.length + ' for vehicles.', 'papers, paper_types', ''],
    ['App screen: Map', 'Pins of vehicles by site using sites.lat / sites.lng and vehicles.site_id (131 own vehicles).', 'sites, vehicles', ''],
    ['App screen: People', 'Team, who is on leave, Add driver / operator, Edit details (Admin).', 'people, papers', ''],
    ['App screen: Hired In', 'Hired machines by supplier / project / category; "Sent back" section.', 'hire_terms, vehicles', ''],
    ['App screen: Requests waiting', 'Approval queue for edits made by viewers / editors (plate, engine no., Registered to); Admin approves or rejects.', 'machine_change_requests', ''],
    ['App: other', 'Dark mode, Download Excel, Sign out, global search by plate / driver / site (old plate numbers are searched too).', '', '']],
  notes: (D, ctx) => [
    ['Design', 'Design chosen by the owner on 17 Nov 2026: a workbook that looks like the app and that any AI tool can use to rebuild a similar app.'],
    ['Values only', 'Shown tabs hold values only, no formulas, no ids (names instead), one row per vehicle in Fleet.'],
    ['Home cards', 'The four Home cards equal the app numbers on the day of the download (' + D.inFleet + ' / ' + D.renew.length + ' / ' + D.fines + ' / ' + D.changes + ').'],
    ['Raw tabs hidden', 'Every raw_ tab and every AI tab is hidden. The shown tabs are derived from the raw tabs, which are the source of truth.'],
    ['Colours', 'The brief gave a palette (navy 1B2F5E, gold F2B93B, cream F6F3EA, red B3261E, amber B26A00); where the app uses other values the app wins, so this file uses the app\'s: navy ' + PAL.navy + ', gold ' + PAL.gold + ', grey ' + PAL.bg + ', red ' + PAL.crit + ', amber ' + PAL.warn + '.'],
    ['Renewals "For"', 'The "For" column says what the paper belongs to: Vehicle (this tab lists vehicle papers only).'],
    ['Home "Last update"', 'The date shown is the day of the download; the data is a live copy of the app database.'],
    ['Condition', 'Fleet "Condition" shows vehicles.condition, or condition_note when condition is empty.'],
    ['Hire project', 'When a hired-in vehicle has several hire_postings, the newest posting (by from_date) is shown.'],
    ['Class drawings', '3XL Truck = "3XL Sy", Six Wheel = "Sixwheel", Trailer and Special Trailer = "Trailer", Car / Light Vehicle = "CAR SUV", Equipment = "Equipment - Excavator", Other Vehicle = "Other Tanker" (same as the app).'],
    ['Wording', '"Fala Yard" is Fala headquarters, NOT a project. Never write "Fala HQ".'],
    ['Do not', 'Do not use the DIC Operations, Driver Overtime or Costs data with this file. Do not edit raw_ tabs by hand: edit the app.']]
};

function dictRows(raws, D) {
  const rows = [];
  raws.forEach(t => {
    rows.push(['raw_' + t.name, '(whole table)', 'table', t.rows.length, null, '', TABLE_DOC[t.name] || '', t.note || (t.rows.length + ' rows')]);
    t.cols.forEach((c, i) => {
      const vals = t.rows.map(r => r[i]); const filled = vals.filter(v => v !== null && v !== undefined && v !== '');
      const long = /^part\d+$/.test(c) || c === 'picture'; const distinct = long ? null : new Set(filled.map(v => String(v))).size;
      let ex = ''; if (long) ex = 'base64 text of the PNG, cut in pieces of 30000 characters'; else { const u = [...new Set(filled.map(v => String(v)))]; ex = u.length <= 14 ? u.map(x => x.length > 60 ? x.slice(0, 57) + '...' : x).join(' | ') : u.slice(0, 3).map(x => x.length > 60 ? x.slice(0, 57) + '...' : x).join(' | ') + ' ...'; }
      let ty = long ? 'text' : typeOf(filled); if (c === 'id' && t.name !== 'app_users') ty = 'integer';
      rows.push(['raw_' + t.name, c, ty, filled.length, distinct, FK[c] ? FK[c] : '', t.name === 'drawings' || t.name === 'app_logos' ? (c === 'name' ? 'Name.' : c === 'file' ? 'File the picture came from.' : 'Part of the PNG as base64 text.') : colMeaning(t.name, c), ex]);
    });
  });
  return rows;
}

/* ============================== make the workbook ============================== */
async function make(ctx) {
  const book = new Book(), D = prepare(ctx); D.vehiclesN = (ctx.tables.vehicles || []).length;
  const imgs = { cls: {}, logo: null };
  CLASSES.concat(Object.keys(IMG_FOR_CLASS)).forEach(cl => { if (!imgs.cls[cl] && IMG_FOR_CLASS[cl]) imgs.cls[cl] = pngInfo((ctx.drawings || {})[IMG_FOR_CLASS[cl]]); });
  const lg = (ctx.logos || []).find(l => l.name === 'FALA logo'); imgs.logo = lg ? pngInfo(lg.uri) : null;
  sheetHome(book, D, ctx, imgs); sheetFleet(book, D, ctx, imgs); sheetRenewals(book, D, ctx); sheetPeople(book, D, ctx); sheetSites(book, D, ctx); sheetFines(book, D, ctx); sheetTyres(book, D, ctx);
  sheetService(book, D, ctx); sheetDiesel(book, D, ctx); sheetHire(book, D, ctx); sheetLog(book, D, ctx);
  const raws = rawTables(ctx);
  textSheet(book, 'AI README', ['Topic', 'What it says'], TEXT.readme(D, ctx, raws), [26, 150], true);
  textSheet(book, 'AI Data dictionary', ['Table', 'Column', 'Type', 'Rows filled', 'Distinct values', 'Points to', 'Meaning', 'Example / allowed values'], dictRows(raws, D), [26, 24, 18, 12, 14, 20, 70, 70], true);
  textSheet(book, 'AI Rules', ['Topic', 'Rule'], TEXT.rules(D, ctx), [26, 150], true);
  textSheet(book, 'AI Screens', ['Screen', 'What it shows', 'Built from', 'Layout and look'], TEXT.screens(D, ctx), [30, 90, 45, 70], true);
  const code = (ctx.source || '').split('\n').map(l => [l]);
  const pseudo = ['PSEUDO-CODE of the shown tabs (the exact code follows below, one line per row):', '  read every table; keep papers with is_current = true; today = Asia/Dubai date',
    '  Home: cards = count(Own & In fleet), count(renewals), count(fines with ticket_no), count(change_log)',
    '  Fleet: for class in [3XL Truck, Six Wheel, Trailer, Special Trailer, Other Vehicle, Car / Light Vehicle, Equipment]: rows = vehicles of the class, Own first then Hired in, sorted by number; title bar, picture, gold heading row, rows',
    '  Renewals: current vehicle papers (Own, not Out of fleet, state Date) with expiry - today <= warn_days, sorted by expiry; Expired if < 0',
    '  People / Sites & Projects / Fines / Tyres / Service / Diesel / Hire / Log: one table each as listed in AI Screens',
    '  hidden: AI tabs (text), raw_<table> for every table (original columns and values)', ''].map(l => [l]);
  textSheet(book, 'AI Build script', ['Line'], pseudo.concat(code.length ? code : [['(source not available in this run)']]), [200], true, true);
  textSheet(book, 'Notes for Claude', ['Topic', 'Note'], TEXT.notes(D, ctx), [26, 150], true);
  raws.forEach(t => {
    const sh = book.sheet('raw_' + t.name, { state: 'hidden' });
    if (!t.cols.length) { sh.set(0, 0, '(no columns)', null); return; }
    t.cols.forEach((c, i) => { sh.set(0, i, c, { b: true, c: PAL.white, fill: PAL.navy }); sh.setw(i, /^part\d+$/.test(c) ? 20 : Math.min(40, Math.max(10, c.length + 2))); });
    t.rows.forEach((r, ri) => r.forEach((v, c) => { if (v !== null && v !== undefined) sh.set(ri + 1, c, v, null); }));
    if (t.note) sh.set(t.rows.length + 2, 0, t.note, null);
  });
  const hiddenFirstFix = book.sheets.findIndex(x => x.state !== 'hidden'); if (hiddenFirstFix !== 0) throw new Error('first sheet must be visible');
  return writeXlsx(book, { madeAt: ctx.madeAt });
}

const api = { make, TABLE_ORDER, COLS, CLASSES, prepare, dnum, fmtDate };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FalaXlsx = api;
})(typeof window !== 'undefined' ? window : globalThis);
