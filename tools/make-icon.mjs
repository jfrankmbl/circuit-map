// Draws icons/icon-180.png: a white outlet face on the app's blue. Run once: node tools/make-icon.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const N = 180, BLUE = [11, 87, 208], WHITE = [255, 255, 255];

// Is (x, y) inside a rounded rectangle centred at (cx, cy)?
const inRound = (x, y, cx, cy, w, h, r) => {
  const dx = Math.max(Math.abs(x - cx) - (w / 2 - r), 0), dy = Math.max(Math.abs(y - cy) - (h / 2 - r), 0);
  return dx * dx + dy * dy <= r * r;
};

const rows = [];
for (let y = 0; y < N; y++) {
  const row = [0]; // filter type: none
  for (let x = 0; x < N; x++) {
    let c = BLUE;
    if (inRound(x, y, 90, 90, 112, 136, 22)) {
      c = WHITE;
      const slot = inRound(x, y, 68, 66, 12, 34, 4) || inRound(x, y, 112, 66, 12, 34, 4) || inRound(x, y, 90, 118, 22, 22, 11);
      if (slot) c = BLUE;
    }
    row.push(...c);
  }
  rows.push(Buffer.from(row));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), 8 + data.length);
  return out;
};
const head = Buffer.alloc(13);
head.writeUInt32BE(N, 0);
head.writeUInt32BE(N, 4);
head.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB

mkdirSync("icons", { recursive: true });
writeFileSync("icons/icon-180.png", Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", head), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0)),
]));
console.log("wrote icons/icon-180.png");
