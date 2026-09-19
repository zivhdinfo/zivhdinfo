// Sinh 4 file trong assets/ từ một nguồn duy nhất — light và dark không bao giờ lệch nhau.
//   node tools/build-assets.mjs
//
// Hai hiệu ứng, cả hai đều chỉ animate `opacity` bằng CSS thuần:
//   - header: dòng `rule:` gõ từng ký tự rồi xoá, lặp qua nhiều câu (PHRASES).
//   - stack : mỗi ô icon fade qua lại giữa hai công nghệ (PAIRS).
// Cố tình không dùng SMIL hay animate thuộc tính hình học: SVG này được nhúng
// bằng <img> qua camo của GitHub, `opacity` là thứ chắc ăn nhất ở mọi trình duyệt.
// Con trỏ là một ký tự nằm trong chính dòng text, nên nó luôn dính đúng cuối
// chữ dù máy người xem resolve ra font monospace nào.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS = JSON.parse(await readFile(join(ROOT, "tools/icons.json"), "utf8"));

const MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/* ---------------------------------------------------------------- nội dung */

// Dòng `rule:` sẽ gõ rồi xoá lần lượt từng câu này. Thêm/bớt thoải mái.
const PHRASES = [
  "types first, then the feature",
  "readable beats clever",
  "ship small, review smaller",
  "if it isn't typed, it isn't done",
  "boring tech, interesting product",
  "measure first, optimize second",
];

// Mỗi ô trong card stack fade qua lại giữa hai icon. Key là tên trong icons.json.
const PAIRS = [
  ["vuedotjs", "nuxtdotjs"],
  ["react", "nextdotjs"],
  ["javascript", "typescript"],
  ["laravel", "adonisjs"],
  ["fastify", "nestjs"],
  ["python", "go"],
];

/* ------------------------------------------------------------------- nhịp */

const SLICE = 0.045; // giây cho mỗi bước gõ
const HOLD = 40; // số slice giữ nguyên câu đã gõ xong
const GAP = 7; // số slice nghỉ khi dòng trống
const DEL = 3; // số ký tự xoá mỗi bước
const FADE = 12; // giây cho trọn một vòng fade icon

/* ------------------------------------------------------------------ bảng màu */

const THEMES = {
  light: {
    cardBg: "#f4f4f5", cardStroke: "#e4e4e7", inner: "#ffffff", innerStroke: "#e9e9ec",
    comment: "#8b8b93", keyword: "#cf222e", ident: "#09090b", punct: "#71717a",
    prop: "#0550ae", str: "#0a3069", meta: "#71717a", onBlack: "#09090b",
  },
  dark: {
    cardBg: "#141417", cardStroke: "#27272a", inner: "#09090b", innerStroke: "#232326",
    comment: "#6e7681", keyword: "#ff7b72", ident: "#e6edf3", punct: "#8b949e",
    prop: "#79c0ff", str: "#a5d6ff", meta: "#a1a1aa", onBlack: "#e6edf3",
  },
};

/* ----------------------------------------------------------------- tiện ích */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const round = (n) => Number(n.toFixed(2));
// at * SLICE luôn gọn trong 3 chữ số thập phân, giữ nguyên để các khung không đè nhau.
// Lưu ý: animation-delay phải DƯƠNG. Delay âm tua animation tới trước, khung có `at`
// lớn lại hiện sớm -> cả chuỗi chạy ngược. Delay dương thì trước lượt của mình khung
// chưa start, và vì không đặt fill-mode nên nó rơi về opacity:0 của .f — đúng ý.
const secs = (n) => Number(n.toFixed(3));

// simple-icons để #000000 cho vài brand; trên nền tối thì phải lật lại.
const inkOf = (icon, t) => (icon.hex.toLowerCase() === "#000000" ? t.onBlack : icon.hex);

/* ------------------------------------------------------- header: các khung hình */

// Trả về danh sách khung: mỗi khung là một trạng thái của dòng đang gõ, kèm
// thời điểm bắt đầu (tính bằng slice) và số slice nó hiển thị.
function typingFrames() {
  const frames = [];
  let at = 0;

  for (const phrase of PHRASES) {
    const full = `"${phrase}",`;
    const quoted = phrase.length + 2; // hết dấu nháy đóng, phần còn lại là dấu phẩy

    for (let k = 1; k <= full.length; k++) {
      const last = k === full.length;
      frames.push({
        at,
        span: last ? HOLD + 1 : 1,
        str: full.slice(0, Math.min(k, quoted)),
        punct: full.slice(quoted, k),
        blink: last,
      });
      at += last ? HOLD + 1 : 1;
    }

    for (let k = full.length; k > 0; ) {
      k = Math.max(0, k - DEL);
      const empty = k === 0;
      frames.push({
        at,
        span: empty ? GAP : 1,
        str: full.slice(0, Math.min(k, quoted)),
        punct: full.slice(quoted, k),
        blink: empty,
      });
      at += empty ? GAP : 1;
    }
  }

  return { frames, total: at };
}

function header(themeName) {
  const t = THEMES[themeName];
  const { frames, total } = typingFrames();
  const dur = round(total * SLICE);

  // Ba độ dài hiển thị khác nhau -> ba @keyframes, phần còn lại phân biệt bằng
  // animation-delay âm trên cùng một vòng lặp.
  const spans = [...new Set(frames.map((f) => f.span))].sort((a, b) => a - b);
  const pct = (span) => Number(((span / total) * 100).toFixed(4));

  // Mỗi độ dài hiển thị cần cả @keyframes lẫn một rule gán animation-name;
  // thiếu rule gán thì shorthand ở .f chạy với animation-name:none và không có gì nhúc nhích.
  const keyframes = spans
    .map(
      (s) =>
        `    .t${s} { animation-name:t${s} }\n` +
        `    @keyframes t${s} { 0%,${pct(s)}% { opacity:1 } ${round(pct(s) + 0.001)}%,100% { opacity:0 } }`
    )
    .join("\n");

  const line = (y, ...spansHtml) =>
    `  <text x="44" y="${y}">${spansHtml.join("")}</text>`;
  const sp = (fill, text) => `<tspan fill="${fill}">${esc(text)}</tspan>`;

  // Khung đầu tiên đã gõ xong, dùng làm ảnh tĩnh cho prefers-reduced-motion.
  const still = frames.findIndex((f) => f.span === HOLD + 1);

  const typed = frames
    .map((f, i) => {
      const cls = ["f", `t${f.span}`, f.blink ? "bl" : null, i === still ? "still" : null]
        .filter(Boolean)
        .join(" ");
      const tail = f.punct ? sp(t.punct, f.punct) : "";
      return `    <text x="44" y="198" class="${cls}" style="animation-delay:${secs(f.at * SLICE)}s">` +
        sp(t.prop, "  rule") + sp(t.punct, ": ") +
        (f.str ? sp(t.str, f.str) : "") + tail +
        `<tspan class="c" fill="${t.punct}">&#9612;</tspan></text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 280" width="1200" height="280" role="img" aria-label="const zivhd = { web: vue, react, typescript; api: laravel, adonis, nestjs; rule: types first, then the feature }">
  <title>zivhd — stack</title>
  <style>
    .f { opacity:0; animation:${dur}s linear infinite }
${keyframes}
    .bl .c { animation: blink 1.06s steps(1,end) infinite }
    @keyframes blink { 0%,55% { opacity:1 } 56%,100% { opacity:0 } }
    @media (prefers-reduced-motion: reduce) {
      .f { animation:none }
      .f.still { opacity:1 }
      .bl .c { animation:none }
    }
  </style>

  <rect x="0.75" y="0.75" width="1198.5" height="278.5" rx="16" fill="${t.cardBg}" stroke="${t.cardStroke}"/>
  <rect x="8.75" y="8.75" width="1182.5" height="262.5" rx="12" fill="${t.inner}" stroke="${t.innerStroke}"/>

  <g font-family="${MONO}" font-size="19" xml:space="preserve">
  <text x="1156" y="44" text-anchor="end" font-size="14" fill="${t.meta}">zivhdinfo</text>

${line(62, sp(t.comment, "// the stack I reach for"))}
${line(96, sp(t.keyword, "const "), sp(t.ident, "zivhd"), sp(t.punct, " = "), sp(t.punct, "{"))}
${line(130, sp(t.prop, "  web"), sp(t.punct, ": ["), sp(t.str, '"vue"'), sp(t.punct, ", "), sp(t.str, '"react"'), sp(t.punct, ", "), sp(t.str, '"typescript"'), sp(t.punct, "],"))}
${line(164, sp(t.prop, "  api"), sp(t.punct, ": ["), sp(t.str, '"laravel"'), sp(t.punct, ", "), sp(t.str, '"adonis"'), sp(t.punct, ", "), sp(t.str, '"nestjs"'), sp(t.punct, "],"))}

${typed}

${line(232, sp(t.punct, "}"))}
  </g>
</svg>
`;
}

/* ------------------------------------------------------------- stack: fade */

function stack(themeName) {
  const t = THEMES[themeName];
  const step = 1182.5 / PAIRS.length;

  const slots = PAIRS.map(([aKey, bKey], i) => {
    const cx = round(8.75 + step * (i + 0.5));
    const delay = secs((FADE / PAIRS.length) * i);

    const side = (key, cls) => {
      const icon = ICONS[key];
      if (!icon) throw new Error(`icons.json thiếu "${key}"`);
      return (
        `    <g class="${cls}" style="animation-delay:${delay}s">` +
        `<g transform="translate(${round(cx - 20)},38) scale(1.66667)" fill="${inkOf(icon, t)}">` +
        `<title>${esc(icon.title)}</title><path d="${icon.path}"/></g>` +
        `<text x="${cx}" y="100" text-anchor="middle" fill="${t.meta}">${esc(icon.label)}</text>` +
        `</g>`
      );
    };

    return `${side(aKey, "a")}\n${side(bKey, "b")}`;
  }).join("\n");

  const label = PAIRS.map(([a, b]) => `${ICONS[a].title}/${ICONS[b].title}`).join(", ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 140" width="1200" height="140" role="img" aria-label="${esc(label)}">
  <title>stack</title>
  <style>
    .a, .b { animation-duration:${FADE}s; animation-timing-function:linear; animation-iteration-count:infinite }
    .a { animation-name:fa }
    .b { animation-name:fb; opacity:0 }
    @keyframes fa { 0%,42% { opacity:1 } 50%,92% { opacity:0 } 100% { opacity:1 } }
    @keyframes fb { 0%,42% { opacity:0 } 50%,92% { opacity:1 } 100% { opacity:0 } }
    @media (prefers-reduced-motion: reduce) {
      .a, .b { animation:none }
      .a { opacity:1 }
      .b { opacity:0 }
    }
  </style>

  <rect x="0.75" y="0.75" width="1198.5" height="138.5" rx="16" fill="${t.cardBg}" stroke="${t.cardStroke}"/>
  <rect x="8.75" y="8.75" width="1182.5" height="122.5" rx="12" fill="${t.inner}" stroke="${t.innerStroke}"/>

  <g font-family="${MONO}" font-size="13">
${slots}
  </g>
</svg>
`;
}

/* -------------------------------------------------------------------- ghi */

for (const theme of ["light", "dark"]) {
  for (const [name, svg] of [["header", header(theme)], ["stack", stack(theme)]]) {
    const file = join(ROOT, "assets", `${name}-${theme}.svg`);
    await writeFile(file, svg);
    console.log(`${name}-${theme}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
  }
}
