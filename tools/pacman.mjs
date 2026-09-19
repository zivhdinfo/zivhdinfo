// Màn pacman của header.svg — một màn hình game riêng, chiếm trọn card.
//
// Vẫn chỉ animate `opacity` như phần còn lại của card (xem ghi chú 1 trong
// build-assets.mjs): chuyển động = mỗi bước một khung đứng yên. Pacman và cả ba
// con ma của cùng một bước nằm CHUNG một khung — vừa gọn hơn bốn chuỗi khung
// riêng, vừa không đời nào lệch nhịp nhau.

const T = 20; // cạnh một ô mê cung
const COLS = 56;
const MX = 40; // mê cung đặt ở đâu trong card 1200x280
const MY = 30;

export const STEP_PX = 7; // mỗi bước pacman dịch bao nhiêu px
const FRIGHT = 45; // ăn một hạt to thì ma sợ bao nhiêu bước
const TRAILS = [14, 26, 38]; // ba con ma bám sau pacman bao nhiêu bước
const PAC_R = 9;

const C = {
  wall: "#2f4fd8",
  pellet: "#f2d9a0",
  pac: "#f7df1e",
  ghosts: ["#ff4b4b", "#ffb8de", "#69e6ff"],
  fright: "#2b34d9",
  eye: "#ffffff",
  pupil: "#1b2559",
  ready: "#f7df1e",
};

/* ------------------------------------------------------------------ mê cung */
// Mỗi dòng viết nửa trái 28 ký tự rồi soi gương — vừa chắc chắn đúng 56 cột,
// vừa tự đối xứng. '#' tường, '.' hạt đậu, 'o' hạt to.

const W = (n) => "#".repeat(n);
const D = (n) => ".".repeat(n);

const HALF = [
  W(28), // r0  viền trên
  "#" + "o" + D(26), // r1  hành lang, hạt to ở góc
  "#" + D(1) + W(4) + D(1) + W(5) + D(1) + W(4) + D(1) + W(4) + D(1) + D(5), // r2
  "#" + D(27), // r3  hành lang
  "#" + D(1) + W(5) + D(1) + W(3) + D(1) + W(5) + D(1) + W(5) + D(5), // r4
  "#" + D(27), // r5  hành lang
  "#" + D(1) + W(5) + D(1) + W(3) + D(1) + W(5) + D(1) + W(5) + D(5), // r6
  "#" + D(27), // r7  hành lang
  "#" + D(1) + W(4) + D(1) + W(5) + D(1) + W(4) + D(1) + W(4) + D(1) + D(5), // r8
  "#" + "o" + D(26), // r9  hành lang, hạt to ở góc
  W(28), // r10 viền dưới
];

export const MAZE = HALF.map((h, i) => {
  if (h.length !== 28) throw new Error(`nửa trái dòng ${i} phải đúng 28 ký tự, đang là ${h.length}`);
  return h + [...h].reverse().join("");
});

const cxOf = (c) => MX + c * T + T / 2;
const cyOf = (r) => MY + r * T + T / 2;

// Đường chạy của pacman, theo ô [hàng, cột]. Mỗi đoạn phải đi dọc hành lang;
// đoạn dọc phải cắt qua cột đang mở của hàng tường ở giữa (có assert bên dưới).
const ROUTE = [
  [3, 1], [1, 1], [1, 17], [3, 17], [3, 32],
  [5, 32], [5, 48], [7, 48], [7, 54], [9, 54], [9, 40],
];

/* ----------------------------------------------------------------- tiện ích */

const n2 = (n) => Number(n.toFixed(2));

// Hình pacman: đường tròn bán kính PAC_R khuyết một góc mồm mở về bên phải.
// large-arc=1 sweep=0 để đi vòng dài, ngược chiều kim đồng hồ trên màn hình.
function pacPath(deg) {
  const a = (deg * Math.PI) / 180;
  const x = n2(PAC_R * Math.cos(a));
  const y = n2(PAC_R * Math.sin(a));
  return `M0,0L${x},${-y}A${PAC_R},${PAC_R} 0 1 0 ${x},${y}Z`;
}

function ghostDef(id, body, pupils) {
  const skirt = "q-2.25,5 -4.5,0".repeat(4);
  return (
    `<g id="${id}">` +
    `<path d="M-9,7V-1A9,9 0 0 1 9,-1V7${skirt}Z" fill="${body}"/>` +
    (pupils
      ? `<circle cx="-3.6" cy="-2" r="2.6" fill="${C.eye}"/><circle cx="3.6" cy="-2" r="2.6" fill="${C.eye}"/>` +
        `<circle cx="-2.7" cy="-2" r="1.3" fill="${C.pupil}"/><circle cx="4.5" cy="-2" r="1.3" fill="${C.pupil}"/>`
      : // ma đang sợ: mắt vuông và cái miệng răng cưa, đúng kiểu bản gốc
        `<rect x="-4.6" y="-3.4" width="2.6" height="2.8" fill="${C.eye}"/>` +
        `<rect x="2" y="-3.4" width="2.6" height="2.8" fill="${C.eye}"/>` +
        `<path d="M-5,3l2-2.2 2,2.2 2-2.2 2,2.2 2-2.2 2,2.2" fill="none" stroke="${C.eye}" stroke-width="1.2"/>`) +
    `</g>`
  );
}

export const DEFS = [
  `<path id="po" d="${pacPath(33)}" fill="${C.pac}"/>`,
  `<path id="pc" d="${pacPath(5)}" fill="${C.pac}"/>`,
  ...C.ghosts.map((c, i) => ghostDef(`g${i}`, c, true)),
  ghostDef("gf", C.fright, false),
].join("\n    ");

/* --------------------------------------------------------- tường và hạt đậu */

// Gộp các ô tường liền nhau trong một hàng thành một thanh -> vài chục <rect>
// thay vì vài trăm, và trông đúng kiểu thanh ngang của mê cung gốc.
export function mazeMarkup() {
  const bars = [];
  for (let r = 1; r < MAZE.length - 1; r++) {
    let run = 0;
    for (let c = 1; c <= COLS - 1; c++) {
      const wall = c < COLS - 1 && MAZE[r][c] === "#";
      if (wall) run++;
      else if (run) {
        bars.push(
          `<rect x="${MX + (c - run) * T + 2}" y="${MY + r * T + 4}" width="${run * T - 4}" height="${T - 8}" rx="5" fill="none" stroke="${C.wall}" stroke-width="2"/>`
        );
        run = 0;
      }
    }
  }
  return (
    `<rect x="${MX + 6}" y="${MY + 6}" width="${COLS * T - 12}" height="${MAZE.length * T - 12}" rx="12" fill="none" stroke="${C.wall}" stroke-width="2.5"/>\n    ` +
    bars.join("\n    ")
  );
}

/* ---------------------------------------------------- đường chạy của pacman */

function walk() {
  const segs = [];
  let total = 0;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const [r0, c0] = ROUTE[i];
    const [r1, c1] = ROUTE[i + 1];
    const x0 = cxOf(c0), y0 = cyOf(r0);
    const dx = cxOf(c1) - x0, dy = cyOf(r1) - y0;
    const len = Math.hypot(dx, dy);
    if (!len) continue;
    if (dx && dy) throw new Error(`đoạn ${i} đi chéo, mê cung chỉ có ngang và dọc`);
    segs.push({ x0, y0, ux: dx / len, uy: dy / len, len, at: total });
    total += len;
  }

  const pts = [];
  for (let d = 0; d <= total; d += STEP_PX) {
    const seg = segs.find((s) => d <= s.at + s.len) ?? segs[segs.length - 1];
    const k = d - seg.at;
    const x = seg.x0 + seg.ux * k;
    const y = seg.y0 + seg.uy * k;
    const deg = seg.ux > 0 ? 0 : seg.ux < 0 ? 180 : seg.uy > 0 ? 90 : 270;
    const c = Math.round((x - MX - T / 2) / T);
    const r = Math.round((y - MY - T / 2) / T);
    if (MAZE[r][c] === "#") throw new Error(`đường chạy đâm vào tường ở ô [${r},${c}]`);
    pts.push({ x: n2(x), y: n2(y), deg, r, c });
  }
  return pts;
}

/* ------------------------------------------------------------------- dựng */

// at      = slice mà màn game hiện hình (bắt đầu fade vào)
// visible = slice mà màn game đã hiện đủ, pacman bắt đầu chạy
// hold    = số slice giữ thêm sau bước cuối (để fade ra)
export function buildGame({ at, visible, hold }) {
  const pts = walk();
  const steps = pts.length;

  // Hạt nào bị ăn ở bước nào; hạt không nằm trên đường chạy thì ở lại tới hết màn.
  const eaten = new Map();
  pts.forEach((p, s) => {
    const key = `${p.r},${p.c}`;
    if (!eaten.has(key)) eaten.set(key, s);
  });

  // Ăn hạt to -> ma chuyển sang sợ trong FRIGHT bước.
  const frightFrom = [];
  for (const [key, s] of eaten) {
    const [r, c] = key.split(",").map(Number);
    if (MAZE[r][c] === "o") frightFrom.push(s);
  }
  const scared = (s) => frightFrom.some((f) => s >= f && s < f + FRIGHT);

  const lastAt = visible + steps - 1;
  const endAt = lastAt + hold;

  /* --- hạt đậu --- */
  // Hạt pacman không đi qua thì chẳng bao giờ tắt, nên không cần khung riêng —
  // để tĩnh trong lớp màn game là xong (lớp đó vốn đã ẩn ngoài màn). Chỉ hạt bị
  // ăn mới cần khung để tắt đúng lúc. Gần 270/346 hạt rơi vào diện tĩnh.
  const dots = [];
  const still = [];
  for (let r = 0; r < MAZE.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = MAZE[r][c];
      if (ch !== "." && ch !== "o") continue;
      const x = cxOf(c), y = cyOf(r);
      const big = ch === "o";
      const m = big
        ? `<circle class="pw" cx="${x}" cy="${y}" r="5.5" fill="${C.pellet}"/>`
        : `<circle cx="${x}" cy="${y}" r="2.5" fill="${C.pellet}"/>`;
      const hit = eaten.get(`${r},${c}`);
      if (hit === undefined) still.push(m);
      else if (visible + hit - at > 0) dots.push({ at, dur: visible + hit - at, m });
    }
  }

  /* --- pacman + ba con ma, mỗi bước một khung --- */
  const sprites = [];
  for (let s = 0; s < steps; s++) {
    const p = pts[s];
    const mouth = s % 4 < 2 ? "po" : "pc";
    const parts = [
      `<use href="#${mouth}" transform="translate(${p.x},${p.y}) rotate(${p.deg})"/>`,
    ];
    TRAILS.forEach((trail, i) => {
      const g = pts[s - trail];
      if (!g) return;
      const flip = g.deg === 180 ? " scale(-1,1)" : "";
      const id = scared(s) ? "gf" : `g${i}`;
      parts.push(`<use href="#${id}" transform="translate(${g.x},${g.y})${flip}"/>`);
    });
    sprites.push({
      at: visible + s,
      // Khung đầu kéo ngược về lúc màn ló ra, khung cuối giữ thêm để kịp fade ra.
      ...(s === 0 ? { at, dur: visible - at + 1 } : {}),
      dur: s === 0 ? visible - at + 1 : s === steps - 1 ? 1 + hold : 1,
      m: parts.join(""),
    });
  }

  // Nền tối phía sau để chữ không lẫn vào hàng hạt đậu.
  const ry = cyOf(5);
  const ready = {
    at,
    dur: Math.min(28, visible - at + 20),
    m:
      `<rect x="546" y="${ry - 14}" width="108" height="28" rx="6" fill="#09090b"/>` +
      `<text x="600" y="${ry + 7}" text-anchor="middle" font-size="20" font-weight="bold" fill="${C.ready}">READY!</text>`,
  };

  return { steps, dots, still, sprites, ready, endAt };
}
