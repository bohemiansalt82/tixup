/**
 * Minimal .xlsx writer (no dependency): one sheet built from a cell grid with styles (bold,
 * font colour, fill, alignment, thin borders), merged cells, frozen panes, column widths /
 * row heights and an optional autofilter. `buildXlsx` is the simple header + rows table. The workbook is a ZIP with STORED (uncompressed) entries,
 * which every spreadsheet app accepts.
 *
 *   const blob = buildXlsx({ sheetName: 'Box', columns: [{ header: 'Title', width: 40 }], rows: [['a']] });
 */

const enc = new TextEncoder();

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP archive (STORED) from [{ name, data: string }]. */
function zip(files) {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.data);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true);      // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    locals.push(new Uint8Array(local.buffer), name, data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, dosTime, true);
    central.setUint16(14, dosDate, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// Strip characters XML 1.0 cannot hold (C0 controls except tab / LF / CR, lone surrogates,
// U+FFFE / U+FFFF), then escape. Built from a string so the source has no raw control chars.
const XML_INVALID = new RegExp('[^\\t\\n\\r\\u0020-\\uD7FF\\uE000-\\uFFFD\\u{10000}-\\u{10FFFF}]', 'gu');
const xml = (v) => String(v ?? '')
  .replace(XML_INVALID, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colName = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Excel sheet names: max 31 chars, none of []:*?/\ */
const sheetTitle = (name) => (String(name || 'Sheet1').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet1');

function cell(ref, value, style) {
  const s = style ? ` s="${style}"` : '';
  if (value === null || value === undefined || value === '') return `<c r="${ref}"${s}/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

const argb = (hex) => `FF${String(hex).replace('#', '').toUpperCase()}`;

/**
 * Style registry → styles.xml. A style is { bold, color, fill, align, valign, border, size }
 * (colours as 'RRGGBB'; border = 'RRGGBB' thin line on all sides). Index 0 is the default.
 */
function styleSheet(styles) {
  const fonts = ['<font><sz val="11"/><name val="Calibri"/></font>'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const pick = (list, x) => { let i = list.indexOf(x); if (i < 0) { list.push(x); i = list.length - 1; } return i; };
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  styles.slice(1).forEach((st = {}) => {
    const font = pick(fonts, `<font>${st.bold ? '<b/>' : ''}<sz val="${st.size || 11}"/>${st.color ? `<color rgb="${argb(st.color)}"/>` : ''}<name val="Calibri"/></font>`);
    const fill = st.fill ? pick(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(st.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const line = st.border ? `<color rgb="${argb(st.border)}"/>` : '';
    const border = st.border ? pick(borders, `<border><left style="thin">${line}</left><right style="thin">${line}</right><top style="thin">${line}</top><bottom style="thin">${line}</bottom><diagonal/></border>`) : 0;
    const align = st.align || st.valign ? `<alignment${st.align ? ` horizontal="${st.align}"` : ''}${st.valign ? ` vertical="${st.valign}"` : ''}/>` : '';
    xfs.push(`<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1"${fill ? ' applyFill="1"' : ''}${border ? ' applyBorder="1"' : ''}${align ? ` applyAlignment="1">${align}</xf>` : '/>'}`);
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

/**
 * One-sheet workbook from a cell grid.
 *   rows:    [[value | { v, s }]]  (s = index into `styles`)
 *   styles:  [null, { bold, fill, … }, …]  (index 0 = default)
 *   widths:  column widths (characters); heights: { [rowIndex]: points }
 *   merges:  ['A1:B2', …]; freeze: { cols, rows }; autoFilter: 'A1:K20'
 */
export function buildWorkbook({ sheetName, rows, styles = [null], widths = [], heights = {}, merges = [], freeze, autoFilter }) {
  const ncols = Math.max(1, widths.length, ...rows.map(r => r.length));
  const sheetRows = rows.map((row, r) => {
    const ht = heights[r] ? ` ht="${heights[r]}" customHeight="1"` : '';
    const cells = row.map((c, i) => {
      const isObj = c && typeof c === 'object';
      return cell(`${colName(i)}${r + 1}`, isObj ? c.v : c, isObj ? c.s : 0);
    }).join('');
    return `<row r="${r + 1}"${ht}>${cells}</row>`;
  }).join('');
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w ?? 14}" customWidth="1"/>`).join('')}</cols>` : '';
  let pane = '';
  if (freeze && (freeze.cols || freeze.rows)) {
    const tl = `${colName(freeze.cols || 0)}${(freeze.rows || 0) + 1}`;
    const active = freeze.cols && freeze.rows ? 'bottomRight' : freeze.rows ? 'bottomLeft' : 'topRight';
    pane = `<pane${freeze.cols ? ` xSplit="${freeze.cols}"` : ''}${freeze.rows ? ` ySplit="${freeze.rows}"` : ''} topLeftCell="${tl}" activePane="${active}" state="frozen"/>`;
  }
  const lastRef = `${colName(ncols - 1)}${Math.max(1, rows.length)}`;
  const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastRef}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>${cols}<sheetData>${sheetRows}</sheetData>${autoFilter ? `<autoFilter ref="${autoFilter}"/>` : ''}${mergeXml}</worksheet>`;

  const name = sheetTitle(sheetName);
  const filterName = autoFilter
    ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xml(name.replace(/'/g, "''"))}'!${autoFilter.split(':').map(ref => ref.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2')).join(':')}</definedName></definedNames>`
    : '';
  return zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(name)}" sheetId="1" r:id="rId1"/></sheets>${filterName}</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
    { name: 'xl/styles.xml', data: styleSheet(styles) },
  ]);
}

/** Table sheet: bold shaded header row (frozen, autofilter) + text/number rows. */
export function buildXlsx({ sheetName, columns, rows }) {
  const lastRef = `${colName(columns.length - 1)}${rows.length + 1}`;
  return buildWorkbook({
    sheetName,
    styles: [null, { bold: true, fill: 'F3F3F3' }],
    widths: columns.map(c => c.width ?? 14),
    rows: [columns.map(c => ({ v: c.header, s: 1 })), ...rows],
    freeze: { rows: 1 },
    autoFilter: `A1:${lastRef}`,
  });
}

export { colName };

/** Save a Blob as a file through a temporary link. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
