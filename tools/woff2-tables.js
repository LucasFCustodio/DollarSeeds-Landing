'use strict';

/**
 * Read the table directory out of a WOFF2 file without decompressing it.
 *
 * We use this to assert that a self-hosted face really is variable: a variable
 * font carries an `fvar` table, a static instance does not. The CSS
 * `font-weight: 300 900` header is Google's claim about the file; `fvar` is
 * the file's own answer, and headings at font-weight: 580 depend on it.
 *
 * Spec: https://www.w3.org/TR/WOFF2/#table_dir_format
 */

// WOFF2 known-table tags, in the order the 6-bit flag index refers to them.
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
  'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern',
  'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
  'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill'
];

/** UIntBase128 — the variable-length integer WOFF2 uses for table lengths. */
function readBase128(buf, pos) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[pos++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value: value >>> 0, pos };
  }
  throw new Error('malformed UIntBase128');
}

function tableTags(buf) {
  if (buf.toString('ascii', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  const numTables = buf.readUInt16BE(12);
  let pos = 48; // end of the fixed WOFF2 header
  const tags = [];

  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++];
    const index = flags & 0x3f;
    if (index === 0x3f) {           // 63 => an arbitrary 4-byte tag follows
      tags.push(buf.toString('ascii', pos, pos + 4));
      pos += 4;
    } else {
      tags.push(KNOWN_TAGS[index]);
    }
    ({ pos } = readBase128(buf, pos));                       // origLength
    const transform = (flags >> 6) & 0x03;
    const tag = tags[tags.length - 1];
    const transformed = (tag === 'glyf' || tag === 'loca') ? transform !== 3 : transform !== 0;
    if (transformed) ({ pos } = readBase128(buf, pos));      // transformLength
  }
  return tags;
}

module.exports = { tableTags };

if (require.main === module) {
  const fs = require('fs');
  let bad = 0;
  for (const file of process.argv.slice(2)) {
    const tags = tableTags(fs.readFileSync(file));
    const variable = tags.includes('fvar');
    if (!variable) bad++;
    console.log(
      (variable ? 'VARIABLE ' : 'STATIC   ') + file.padEnd(46) +
      (variable ? 'fvar + ' + (tags.includes('gvar') ? 'gvar' : 'CFF2') + ' present' : 'NO fvar TABLE')
    );
  }
  process.exit(bad ? 1 : 0);
}
