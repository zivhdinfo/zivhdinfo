// Màn pacman của header.svg — một màn hình game riêng, chiếm trọn card.
//
// Vẫn chỉ animate `opacity` như phần còn lại của card (xem ghi chú 1 trong
// build-assets.mjs): chuyển động = mỗi bước một khung đứng yên. Pacman và cả ba
// con ma của cùng một bước nằm CHUNG một khung — vừa gọn hơn bốn chuỗi khung
// riêng, vừa không đời nào lệch nhịp nhau.
//
// Hạt đậu KHÔNG nằm trong bản vẽ mê cung mà được rải theo đúng đường chạy. Nhờ
// vậy Pac-Man ăn hết 100% hạt, màn chơi kết thúc thật (mê cung nhấp nháy kiểu
// "level clear") thay vì bị fade cắt ngang giữa chừng.
//
// Màu hạt lấy từ lịch sử contribution nếu có tools/contributions.json, theo đúng
// 5 mức xanh của GitHub. Hạt xếp theo thứ tự đường chạy = thứ tự thời gian, nên
// Pac-Man ăn dần từ ngày cũ tới ngày mới.

const T = 20; // cạnh một ô mê cung
const COLS = 56;
const MX = 40; // mê cung đặt ở đâu trong card 1200x280
const MY = 30;

export const STEP_PX = 14; // mỗi bước pacman dịch bao nhiêu px
const FRIGHT = 45; // ăn một hạt to thì ma sợ bao nhiêu bước
const TRAILS = [16, 30, 44]; // ba con ma bám sau pacman bao nhiêu bước
const PAC_R = 9;
export const CLEAR_PAUSE = 8; // đứng lại một nhịp sau khi ăn hạt cuối
export const FLASH = 36; // mê cung nhấp nháy bao lâu để báo hết màn

// Bốn mức xanh của contribution graph (theme tối). Mức 0 KHÔNG có hạt — ngày
// không commit là một khoảng trống trên đường chạy, đúng như ô trắng trên graph.
const LEVELS = [null, "#0e4429", "#006d32", "#26a641", "#39d353"];
const FALLBACK = "#26a641"; // chưa có dữ liệu thì dùng một màu, không bịa mức

const C = {
  wall: "#2f4fd8",
  flash: "#dfe6ff",
  pac: "#f7df1e",
  ghosts: ["#ff4b4b", "#ffb8de", "#69e6ff"],
  fright: "#2b34d9",
  eye: "#ffffff",
  pupil: "#1b2559",
  ready: "#f7df1e",
  clear: "#39d353",
};

/* ------------------------------------------------------------------ mê cung */
// Mỗi dòng viết nửa trái 28 ký tự rồi soi gương — vừa chắc chắn đúng 56 cột,
// vừa tự đối xứng. Chỉ '#' có nghĩa (tường); ký tự khác đều là hành lang.

const W = (n) => "#".repeat(n);
const D = (n) => ".".repeat(n);

const HALF = [
  W(28), // r0  viền trên
  "#" + D(27), // r1  hành lang
  "#" + D(1) + W(4) + D(1) + W(5) + D(1) + W(4) + D(1) + W(4) + D(1) + D(5), // r2
  "#" + D(27), // r3  hành lang
  "#" + D(1) + W(5) + D(1) + W(3) + D(1) + W(5) + D(1) + W(5) + D(5), // r4
  "#" + D(27), // r5  hành lang
  "#" + D(1) + W(5) + D(1) + W(3) + D(1) + W(5) + D(1) + W(5) + D(5), // r6
  "#" + D(27), // r7  hành lang
  "#" + D(1) + W(4) + D(1) + W(5) + D(1) + W(4) + D(1) + W(4) + D(1) + D(5), // r8
  "#" + D(27), // r9  hành lang
  W(28), // r10 viền dưới
];

export const MAZE = HALF.map((h, i) => {
  if (h.length !== 28) throw new Error(`nửa trái dòng ${i} phải đúng 28 ký tự, đang là ${h.length}`);
  return h + [...h].reverse().join("");
});

const cxOf = (c) => MX + c * T + T / 2;
const cyOf = (r) => MY + r * T + T / 2;

// Đường chạy rắn bò: quét hết năm hành lang ngang, nối bằng bốn đoạn dọc. Hạt
// rải đúng theo đường này nên ăn hết là sạch màn.
const ROUTE = [
  [1, 1], [1, 54], [3, 54], [3, 1], [5, 1],
  [5, 54], [7, 54], [7, 1], [9, 1], [9, 54],
];

// Hạt to ở bốn góc — cả bốn đều nằm trên đường chạy nên đều được ăn.
const POWER = new Set(["1,1", "1,54", "9,1", "9,54"]);

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

/* --------------------------------------------------------------- vẽ tường */

// Gộp các ô tường liền nhau trong một hàng thành một thanh -> vài chục <rect>
// thay vì vài trăm, và trông đúng kiểu thanh ngang của mê cung gốc.
function bars(stroke) {
  const out = [];
  for (let r = 1; r < MAZE.length - 1; r++) {
    let run = 0;
    for (let c = 1; c <= COLS - 1; c++) {
      const wall = c < COLS - 1 && MAZE[r][c] === "#";
      if (wall) run++;
      else if (run) {
        out.push(
          `<rect x="${MX + (c - run) * T + 2}" y="${MY + r * T + 4}" width="${run * T - 4}" height="${T - 8}" rx="5" fill="none" stroke="${stroke}" stroke-width="2"/>`
        );
        run = 0;
      }
    }
  }
  return (
    `<rect x="${MX + 6}" y="${MY + 6}" width="${COLS * T - 12}" height="${MAZE.length * T - 12}" rx="12" fill="none" stroke="${stroke}" stroke-width="2.5"/>` +
    out.join("")
  );
}

export const mazeMarkup = () => bars(C.wall);
export const mazeFlash = () => bars(C.flash);

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

// Mọi ô nằm trên đường chạy, theo đúng thứ tự đi qua. Đây vừa là chỗ đặt hạt,
// vừa là trục thời gian để gắn lịch sử contribution vào.
function routeCells(pts) {
  const seen = new Set();
  const cells = [];
  for (const p of pts) {
    const key = `${p.r},${p.c}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push({ ...p, key });
  }
  return cells;
}

/* ------------------------------------------------------------------- dựng */

// at      = slice màn game bắt đầu ló ra
// visible = slice màn game hiện đủ, pacman bắt đầu chạy
// hold    = số slice giữ thêm sau khi hết màn (để fade ra)
// levels  = mảng mức contribution 0..4 theo ngày, cũ -> mới; null thì dùng một màu
export function buildGame({ at, visible, hold, levels }) {
  const pts = walk();
  const steps = pts.length;
  const cells = routeCells(pts);

  // Ô nào bị đi qua ở bước nào.
  const firstAt = new Map();
  pts.forEach((p, s) => {
    const key = `${p.r},${p.c}`;
    if (!firstAt.has(key)) firstAt.set(key, s);
  });

  // Ăn hạt to -> ma chuyển sang sợ trong FRIGHT bước.
  const frightFrom = cells.filter((c) => POWER.has(c.key)).map((c) => firstAt.get(c.key));
  const scared = (s) => frightFrom.some((f) => s >= f && s < f + FRIGHT);

  const lastStep = visible + steps - 1;
  const clearAt = lastStep + CLEAR_PAUSE; // ăn xong, đứng một nhịp rồi nhấp nháy
  const endAt = clearAt + FLASH;

  /* --- hạt đậu: rải trên đường chạy nên hạt nào cũng sẽ bị ăn --- */
  // Bốn hạt to ở góc là đồ chơi của game, không phải dữ liệu, nên không chiếm
  // ngày. Các ô còn lại nhận lần lượt từng ngày tính ngược từ hôm nay, nên
  // pacman ăn từ ngày cũ tới ngày mới. Ngày mức 0 thì bỏ trống, không vẽ hạt.
  const dataCells = cells.filter((c) => !POWER.has(c.key));
  const tail = levels ? levels.slice(-dataCells.length) : null;
  const levelOf = new Map();
  if (tail) {
    const offset = dataCells.length - tail.length; // lịch sử ngắn hơn số ô thì chừa đầu đường
    dataCells.forEach((c, i) => i >= offset && levelOf.set(c.key, tail[i - offset]));
  }

  const dots = [];
  for (const cell of cells) {
    const big = POWER.has(cell.key);
    let fill = FALLBACK;
    if (big) fill = LEVELS[4];
    else if (tail) {
      const level = levelOf.get(cell.key);
      if (!level) continue; // mức 0, hoặc ô không ứng với ngày nào -> để trống
      fill = LEVELS[Math.min(4, level)];
    }
    const x = cxOf(cell.c), y = cyOf(cell.r);
    dots.push({
      at,
      dur: visible + firstAt.get(cell.key) - at,
      m: big
        ? `<circle class="pw" cx="${x}" cy="${y}" r="5.5" fill="${fill}"/>`
        : `<circle cx="${x}" cy="${y}" r="2.5" fill="${fill}"/>`,
    });
  }
  if (dots.some((d) => d.dur <= 0)) throw new Error("có hạt tắt trước khi màn game hiện ra");

  /* --- pacman + ba con ma, mỗi bước một khung --- */
  const sprites = [];
  for (let s = 0; s < steps; s++) {
    const p = pts[s];
    const parts = [
      `<use href="#${s % 4 < 2 ? "po" : "pc"}" transform="translate(${p.x},${p.y}) rotate(${p.deg})"/>`,
    ];
    TRAILS.forEach((trail, i) => {
      const g = pts[s - trail];
      if (!g) return;
      const flip = g.deg === 180 ? " scale(-1,1)" : "";
      parts.push(
        `<use href="#${scared(s) ? "gf" : `g${i}`}" transform="translate(${g.x},${g.y})${flip}"/>`
      );
    });
    sprites.push({
      at: s === 0 ? at : visible + s,
      // Khung đầu kéo ngược về lúc màn ló ra để fade vào đã có hình.
      dur: s === 0 ? visible - at + 1 : 1,
      m: parts.join(""),
    });
  }

  // Ăn xong: ma biến mất, chỉ còn pacman đứng giữa mê cung đang nhấp nháy.
  const last = pts[steps - 1];
  sprites.push({
    at: lastStep + 1,
    dur: CLEAR_PAUSE + FLASH + hold,
    m: `<use href="#pc" transform="translate(${last.x},${last.y}) rotate(${last.deg})"/>`,
  });

  // Mê cung trắng chồng lên bản xanh, nhấp nháy bằng animation riêng bên trong.
  const flash = {
    at: clearAt,
    dur: FLASH,
    m: `<g class="fl">${mazeFlash()}</g>`,
  };

  const ry = cyOf(5);
  const plate = (w) => `<rect x="${600 - w / 2}" y="${ry - 14}" width="${w}" height="28" rx="6" fill="#09090b"/>`;
  const ready = {
    at,
    dur: Math.min(28, visible - at + 20),
    m: plate(108) + `<text x="600" y="${ry + 7}" text-anchor="middle" font-size="20" font-weight="bold" fill="${C.ready}">READY!</text>`,
  };
  const clear = {
    at: clearAt,
    dur: FLASH + hold,
    m: plate(200) + `<text x="600" y="${ry + 7}" text-anchor="middle" font-size="20" font-weight="bold" fill="${C.clear}">LEVEL CLEAR</text>`,
  };

  return { steps, cells: cells.length, days: tail?.length ?? 0, dots, sprites, flash, ready, clear, endAt };
}
