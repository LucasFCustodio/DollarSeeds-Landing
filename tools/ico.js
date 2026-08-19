'use strict';

/**
 * Minimal ICO container writer. sharp has no .ico encoder, and every browser
 * that matters reads PNG-compressed ICO entries, so we just wrap PNG buffers
 * in an ICONDIR.
 *
 * Format: https://learn.microsoft.com/en-us/previous-versions/ms997538(v=msdn.10)
 */

/**
 * @param {{size:number, png:Buffer}[]} entries  smallest-first is conventional
 * @returns {Buffer}
 */
function buildIco(entries) {
  const HEADER = 6;
  const DIR_ENTRY = 16;
  const header = Buffer.alloc(HEADER);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // type: 1 = icon
  header.writeUInt16LE(entries.length, 4); // image count

  const dir = Buffer.alloc(DIR_ENTRY * entries.length);
  let offset = HEADER + DIR_ENTRY * entries.length;

  entries.forEach((entry, i) => {
    const at = i * DIR_ENTRY;
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, at);     // 0 means 256
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1);
    dir.writeUInt8(0, at + 2);                 // palette size (0 = no palette)
    dir.writeUInt8(0, at + 3);                 // reserved
    dir.writeUInt16LE(1, at + 4);              // color planes
    dir.writeUInt16LE(32, at + 6);             // bits per pixel
    dir.writeUInt32LE(entry.png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map(e => e.png)]);
}

module.exports = { buildIco };
