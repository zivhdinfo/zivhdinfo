// Sinh 4 file trong assets/ từ một nguồn duy nhất — light và dark không bao giờ lệch nhau.
//   node tools/build-assets.mjs
//
// header: mô phỏng thao tác sửa code trong editor. Lần lượt từng dòng (web, api,
//   rule) được bôi đen giá trị, xoá, gõ lại giá trị mới, rồi nghỉ một nhịp dài.
// stack : mỗi ô icon fade qua lại giữa hai công nghệ.
//
// Cả hai chỉ animate `opacity`. SVG này được nhúng bằng <img> qua camo của
// GitHub, nên cố tình tránh SMIL lẫn animate thuộc tính hình học — `opacity` là
// thứ chắc ăn nhất ở mọi trình duyệt.
//
// Mọi dòng code đều bị ghim bằng `textLength` = số ký tự × CH. Đây là điều kiện
// để vẽ được khối bôi đen: không ghim thì chiều rộng chữ phụ thuộc font máy
// người xem (Consolas trên Windows hẹp hơn SF Mono ~9%) và khối bôi đen sẽ lệch
// hẳn so với chữ. Ghim rồi thì toạ độ ký tự thứ k luôn là x + k × CH.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS = JSON.parse(await readFile(join(ROOT, "tools/icons.json"), "utf8"));

const MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
const FONT = 19;
const CH = FONT * 0.6; // bề ngang một ô ký tự, đã ghim bằng textLength
const X0 = 44;
const CARET = "█"; // con trỏ là ký tự trong chính dòng text, không phải rect toạ độ cố định
// Khoảng trắng ở ĐẦU và CUỐI một chuỗi text đều bị trình duyệt gom mất, kể cả khi
// có xml:space="preserve". Mà textLength thì vẫn ghim đủ số ô, nên chữ bị kéo giãn
// ra. Vì vậy mọi khoảng trắng ở rìa đều đẩy bằng toạ độ x, không dùng ký tự space.
const INDENT = 2;

/* ---------------------------------------------------------------- nội dung */

// Mỗi dòng lần lượt được bôi đen rồi gõ lại, chạy vòng qua danh sách values.
// Cả ba dòng phải có số values bằng nhau để hết một vòng thì quay về giá trị đầu.
const LINES = [
  {
    key: "web",
    y: 130,
    label: "web",
    values: [
      '["vue", "react", "typescript"]',
      '["nuxt", "next", "typescript"]',
      '["vue", "nuxt", "pinia"]',
    ],
  },
  {
    key: "api",
    y: 164,
    label: "api",
    values: [
      '["laravel", "adonis", "nestjs"]',
      '["fastify", "nestjs", "prisma"]',
      '["laravel", "python", "go"]',
    ],
  },
  {
    key: "rule",
    y: 198,
    label: "rule",
    values: [
      '"types first, then the feature"',
      '"readable beats clever"',
      '"ship small, review smaller"',
    ],
  },
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
// Tính bằng slice; một slice = SLICE giây. Chỉnh ở đây là đổi được cả tiết tấu.

const SLICE = 0.06;
const SWEEP_STEPS = 6; // số bước quét khối bôi đen từ trái sang phải
const SWEEP_DUR = 2; // mỗi bước quét
const SEL_HOLD = 9; // giữ nguyên khối bôi đen trước khi xoá
const GONE = 4; // dòng trống, chỉ còn con trỏ
const TYPE_DUR = 1; // mỗi ký tự gõ ra
const DONE_HOLD = 18; // giữ sau khi gõ xong, con trỏ nháy
const IDLE = 18; // nghỉ giữa hai lần sửa, không con trỏ không bôi đen
const FADE = 18; // giây cho trọn một vòng fade icon

/* ------------------------------------------------------------------ bảng màu */

const THEMES = {
  light: {
    cardBg: "#f4f4f5", cardStroke: "#e4e4e7", inner: "#ffffff", innerStroke: "#e9e9ec",
    comment: "#8b8b93", keyword: "#cf222e", ident: "#09090b", punct: "#71717a",
    prop: "#0550ae", str: "#0a3069", meta: "#71717a", sel: "#cfe3fd", onBlack: "#09090b",
  },
  dark: {
    cardBg: "#141417", cardStroke: "#27272a", inner: "#09090b", innerStroke: "#232326",
    comment: "#6e7681", keyword: "#ff7b72", ident: "#e6edf3", punct: "#8b949e",
    prop: "#79c0ff", str: "#a5d6ff", meta: "#a1a1aa", sel: "#1f3d63", onBlack: "#e6edf3",
  },
};

/* ----------------------------------------------------------------- tiện ích */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (n) => Number(n.toFixed(2));
const n3 = (n) => Number(n.toFixed(3));
const inkOf = (icon, t) => (icon.hex.toLowerCase() === "#000000" ? t.onBlack : icon.hex);

// Tô màu một chuỗi giá trị: phần trong ngoặc kép là string, còn lại là dấu câu.
function colorize(text, t) {
  const runs = [];
  let inStr = false;
  for (const ch of text) {
    const kind = ch === '"' || inStr ? "str" : "punct";
    if (ch === '"') inStr = !inStr;
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else runs.push({ kind, text: ch });
  }
  return runs.map((r) => `<tspan fill="${t[r.kind]}">${esc(r.text)}</tspan>`).join("");
}

/* ------------------------------------------------- header: dựng dòng thời gian */

// Trả về danh sách bước; mỗi bước mô tả trạng thái đầy đủ của cả ba dòng.
function timeline() {
  const rounds = LINES[0].values.length;
  if (LINES.some((l) => l.values.length !== rounds))
    throw new Error("mọi dòng phải có cùng số values thì hết vòng mới quay về giá trị đầu");

  const steps = [];
  const cur = Object.fromEntries(LINES.map((l) => [l.key, l.values[0]]));

  const snap = (dur, key, patch) => {
    const state = {};
    for (const l of LINES) state[l.key] = { text: cur[l.key], caret: null, sel: null, blink: false };
    if (key) state[key] = { text: cur[key], caret: null, sel: null, blink: false, ...patch };
    steps.push({ dur, state });
  };

  for (let round = 1; round <= rounds; round++) {
    for (const line of LINES) {
      const before = cur[line.key];
      const after = line.values[round % rounds];

      // bôi đen: khối quét dần từ trái sang phải
      for (let j = 1; j <= SWEEP_STEPS; j++)
        snap(SWEEP_DUR, line.key, { sel: Math.round((before.length * j) / SWEEP_STEPS) });
      snap(SEL_HOLD, line.key, { sel: before.length });

      // xoá rồi gõ lại
      snap(GONE, line.key, { text: "", caret: 0 });
      for (let k = 1; k <= after.length; k++) {
        const done = k === after.length;
        snap(done ? DONE_HOLD : TYPE_DUR, line.key, {
          text: after.slice(0, k),
          caret: k,
          blink: done,
        });
      }

      cur[line.key] = after;
      snap(IDLE, null); // nghỉ, không con trỏ không bôi đen
    }
  }
  return steps;
}

function header(themeName) {
  const t = THEMES[themeName];
  const steps = timeline();
  const total = steps.reduce((a, s) => a + s.dur, 0);
  const dur = n2(total * SLICE);

  // Gộp các bước liên tiếp mà một dòng không đổi gì -> mỗi dòng chỉ còn vài chục khung.
  const perLine = new Map(LINES.map((l) => [l.key, []]));
  let at = 0;
  for (const step of steps) {
    for (const line of LINES) {
      const s = step.state[line.key];
      const id = `${s.text}\u0000${s.caret}\u0000${s.sel}\u0000${s.blink}`;
      const frames = perLine.get(line.key);
      const last = frames[frames.length - 1];
      if (last && last.id === id) last.dur += step.dur;
      else frames.push({ id, at, dur: step.dur, ...s });
    }
    at += step.dur;
  }
  for (const frames of perLine.values()) {
    let acc = 0;
    for (const f of frames) {
      f.at = acc;
      acc += f.dur;
    }
  }

  // Mỗi độ dài hiển thị cần cả @keyframes lẫn một rule gán animation-name;
  // thiếu rule gán thì shorthand ở .f chạy với animation-name:none và không có gì nhúc nhích.
  // step-end: opacity nhảy thẳng 1 -> 0, không nội suy. Quan trọng — nếu dùng
  // linear thì mốc tắt phải luôn lớn hơn mốc bật, mà làm tròn hai mốc ở hai độ
  // chính xác khác nhau rất dễ cho ra mốc tắt SỚM hơn. Lúc đó CSS sắp xếp lại
  // các mốc và opacity giảm dần suốt chu kỳ thay vì tắt hẳn, làm mọi khung cùng
  // hiện mờ chồng lên nhau.
  const spans = [...new Set([...perLine.values()].flat().map((f) => f.dur))].sort((a, b) => a - b);
  const pctOf = (d) => Number(((d / total) * 100).toFixed(4));
  const keyframes = spans
    .map(
      (d) =>
        `    .t${d} { animation-name:t${d} }\n` +
        `    @keyframes t${d} { 0% { opacity:1 } ${pctOf(d)}% { opacity:0 } }`
    )
    .join("\n");

  const txt = (x, y, body, chars, cls, delay) =>
    `<text x="${n2(x)}" y="${y}" textLength="${n2(chars * CH)}"` +
    (cls ? ` class="${cls}" style="animation-delay:${n3(delay)}s"` : "") +
    `>${body}</text>`;

  const out = [];
  for (const line of LINES) {
    out.push(`  <g data-line="${line.key}">`);
    const prefix = `${line.label}:`; // dấu cách sau dấu hai chấm tính vào vx, không render
    const px = X0 + INDENT * CH;
    const vx = px + (prefix.length + 1) * CH;

    // Nhãn dòng đứng yên, chỉ phần giá trị mới hoạt hình.
    out.push(
      "  " +
        txt(
          px,
          line.y,
          `<tspan fill="${t.prop}">${esc(line.label)}</tspan><tspan fill="${t.punct}">:</tspan>`,
          prefix.length
        )
    );

    const frames = perLine.get(line.key);
    // Khung dùng làm ảnh tĩnh khi người xem bật prefers-reduced-motion.
    const still = frames.findIndex(
      (f) => f.text === line.values[0] && f.caret === null && f.sel === null
    );

    frames.forEach((f, i) => {
      const cls = ["f", `t${f.dur}`, f.blink ? "bl" : null, i === still ? "still" : null]
        .filter(Boolean)
        .join(" ");
      const caret = f.caret === null ? "" : `<tspan class="c" fill="${t.punct}">${CARET}</tspan>`;
      const chars = f.text.length + (f.caret === null ? 0 : 1) + 1; // + con trỏ + dấu phẩy
      // Lúc đang gõ, con trỏ đứng ngay sau chữ vừa gõ (và đặc, không nháy) nên không
      // để lại khe. Gõ xong thì nó nháy, phải đẩy ra sau dấu phẩy — để giữa giá trị
      // và dấu phẩy thì mỗi nhịp nháy tắt sẽ hở một ô trống ngay giữa dòng.
      const comma = `<tspan fill="${t.punct}">,</tspan>`;
      const body = colorize(f.text, t) + (f.blink ? comma + caret : caret + comma);
      const text = txt(vx, line.y, body, chars, cls, f.at * SLICE);

      if (f.sel === null) {
        out.push("    " + text);
      } else {
        // Khối bôi đen nằm dưới chữ, cùng một khung nên hiện/tắt cùng nhau.
        const rect = `<rect x="${n2(vx)}" y="${line.y - 15.5}" width="${n2(f.sel * CH)}" height="21" fill="${t.sel}"/>`;
        out.push(
          `    <g class="${cls}" style="animation-delay:${n3(f.at * SLICE)}s">${rect}${text.replace(
            ` class="${cls}" style="animation-delay:${n3(f.at * SLICE)}s"`,
            ""
          )}</g>`
        );
      }
    });
    out.push("  </g>", "");
  }

  const still = LINES.map((l) => `${l.key}: ${l.values[0]}`).join("; ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 280" width="1200" height="280" role="img" aria-label="const zivhd = { ${esc(still)} }">
  <title>zivhd — stack</title>
  <style>
    .f { opacity:0; animation:${dur}s step-end infinite }
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

  <g font-family="${MONO}" font-size="${FONT}" xml:space="preserve">
  <text x="1156" y="44" text-anchor="end" font-size="14" fill="${t.meta}">zivhdinfo</text>

  ${txt(X0, 62, `<tspan fill="${t.comment}">// the stack I reach for</tspan>`, 23)}
  ${txt(X0, 96, `<tspan fill="${t.keyword}">const </tspan><tspan fill="${t.ident}">zivhd</tspan><tspan fill="${t.punct}"> = {</tspan>`, 15)}

${out.join("\n")}  ${txt(X0, 232, `<tspan fill="${t.punct}">}</tspan>`, 1)}
  </g>
</svg>
`;
}

/* ------------------------------------------------------------- stack: fade */

function stack(themeName) {
  const t = THEMES[themeName];
  const step = 1182.5 / PAIRS.length;

  const slots = PAIRS.map(([aKey, bKey], i) => {
    const cx = n2(8.75 + step * (i + 0.5));
    const delay = n3((FADE / PAIRS.length) * i);

    const side = (key, cls) => {
      const icon = ICONS[key];
      if (!icon) throw new Error(`icons.json thiếu "${key}"`);
      return (
        `    <g class="${cls}" style="animation-delay:${delay}s">` +
        `<g transform="translate(${n2(cx - 20)},38) scale(1.66667)" fill="${inkOf(icon, t)}">` +
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
    @keyframes fa { 0%,45% { opacity:1 } 50%,95% { opacity:0 } 100% { opacity:1 } }
    @keyframes fb { 0%,45% { opacity:0 } 50%,95% { opacity:1 } 100% { opacity:0 } }
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
    await writeFile(join(ROOT, "assets", `${name}-${theme}.svg`), svg);
    console.log(`${name}-${theme}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
  }
}
