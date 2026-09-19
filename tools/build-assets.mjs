// Sinh assets/header.svg và assets/stack.svg.
//   node tools/build-assets.mjs
//
// Chỉ có một tông màu duy nhất (dark). README nhúng thẳng bằng <img>, không còn
// <picture> light/dark nữa.
//
// header: mô phỏng thao tác sửa code trong editor. Lần lượt từng dòng (web, api,
//   rule) được bôi đen giá trị, xoá, gõ lại giá trị mới, rồi nghỉ một nhịp dài.
//   Hết một vòng sửa thì có màn pacman chạy ngang chân card, rồi lặp lại.
// stack : mỗi ô icon fade qua lại giữa hai công nghệ.
//
// ---------------------------------------------------------------------------
// NHỮNG CHỖ ĐÃ TỪNG LÀM VỠ HÌNH — đọc trước khi sửa
// ---------------------------------------------------------------------------
// 1. Chỉ animate `opacity`. SVG này được nhúng bằng <img> qua camo của GitHub,
//    nên tránh SMIL lẫn animate thuộc tính hình học; `opacity` là thứ chắc ăn
//    nhất ở mọi trình duyệt. Chuyển động = nhiều khung đứng yên, mỗi khung hiện
//    đúng lượt của mình.
// 2. `animation-delay` phải DƯƠNG. Delay âm tua animation tới trước, khung có
//    `at` lớn lại hiện sớm -> cả chuỗi chạy ngược.
// 3. Mỗi độ dài hiển thị cần CẢ `@keyframes` LẪN một rule gán `animation-name`.
//    Thiếu rule gán thì shorthand ở `.f` chạy với `animation-name:none` và không
//    có gì nhúc nhích.
// 4. Keyframe dùng `step-end`, không nội suy. Nếu dùng `linear` thì mốc tắt phải
//    luôn lớn hơn mốc bật, mà làm tròn hai mốc ở hai độ chính xác khác nhau rất
//    dễ cho ra mốc tắt SỚM hơn — lúc đó CSS sắp xếp lại các mốc và opacity giảm
//    dần suốt chu kỳ thay vì tắt hẳn, làm mọi khung cùng hiện chồng lên nhau.
// 5. Mọi dòng code bị ghim bằng `textLength` = số ký tự × CH. Đây là điều kiện
//    để vẽ được khối bôi đen: không ghim thì bề ngang chữ phụ thuộc font máy
//    người xem (Consolas trên Windows hẹp hơn SF Mono khoảng 9%) và khối bôi đen
//    lệch hẳn so với chữ. Ghim rồi thì ký tự thứ k luôn nằm ở x + k × CH.
// 6. Đã ghim `textLength` thì KHÔNG dùng ký tự space ở rìa chuỗi. Trình duyệt
//    gom mất khoảng trắng đầu và cuối một chuỗi text kể cả khi có
//    xml:space="preserve", nhưng textLength vẫn ghim đủ số ô -> chữ bị kéo giãn
//    (`w e b :`). Thụt đầu dòng và dấu cách sau dấu hai chấm đẩy bằng toạ độ x.
// 7. Link ảnh trong README phải tuyệt đối (raw.githubusercontent.com) và dùng
//    `HEAD` thay cho tên branch — raw tự resolve HEAD về default branch, đổi tên
//    branch cũng không gãy ảnh. GitHub cache qua camo: sửa ảnh mà chưa thấy đổi
//    thì thêm `?v=2` vào cuối link.

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
const INDENT = 2; // thụt đầu dòng tính bằng ô, đẩy bằng toạ độ x (xem ghi chú 6)
const CARET = "█"; // con trỏ là ký tự trong chính dòng text, không phải rect toạ độ cố định

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

// Màn pacman chạy sau khi sửa xong cả ba dòng.
const PAC_Y = 253; // tâm làn chạy, nằm dưới dòng `}`
const PAC_R = 9;
const PAC_X0 = 20;
const PAC_X1 = 1180;
const PAC_DX = 12; // mỗi bước dịch bao nhiêu px
const PAC_STEP = 1; // mỗi bước kéo dài bao nhiêu slice
const PAC_TRAIL = 9; // con ma bám sau pacman bao nhiêu bước
const PAC_TAIL = 16; // nghỉ sau khi cả hai chạy khuất
const DOT_X0 = 68;
const DOT_GAP = 37;
const DOT_R = 2.5;

/* ------------------------------------------------------------------ bảng màu */

const C = {
  cardBg: "#141417", cardStroke: "#27272a", inner: "#09090b", innerStroke: "#232326",
  comment: "#6e7681", keyword: "#ff7b72", ident: "#e6edf3", punct: "#8b949e",
  prop: "#79c0ff", str: "#a5d6ff", meta: "#a1a1aa", sel: "#1f3d63", onBlack: "#e6edf3",
  pac: "#f7df1e", ghost: "#ff7b72", dot: "#3f4654", eye: "#e6edf3", pupil: "#09090b",
};

/* ----------------------------------------------------------------- tiện ích */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (n) => Number(n.toFixed(2));
const n3 = (n) => Number(n.toFixed(3));
const inkOf = (icon) => (icon.hex.toLowerCase() === "#000000" ? C.onBlack : icon.hex);

// Tô màu một chuỗi giá trị: phần trong ngoặc kép là string, còn lại là dấu câu.
function colorize(text) {
  const runs = [];
  let inStr = false;
  for (const ch of text) {
    const kind = ch === '"' || inStr ? "str" : "punct";
    if (ch === '"') inStr = !inStr;
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else runs.push({ kind, text: ch });
  }
  return runs.map((r) => `<tspan fill="${C[r.kind]}">${esc(r.text)}</tspan>`).join("");
}

// Hình pacman: đường tròn bán kính PAC_R khuyết một góc mồm mở về bên phải.
function pacPath(deg) {
  const a = (deg * Math.PI) / 180;
  const x = n2(PAC_R * Math.cos(a));
  const y = n2(PAC_R * Math.sin(a));
  // large-arc=1 sweep=0: đi vòng dài, ngược chiều kim đồng hồ trên màn hình.
  return `M0,0L${x},${-y}A${PAC_R},${PAC_R} 0 1 0 ${x},${y}Z`;
}

/* ------------------------------------------------- header: dựng dòng thời gian */

// Trả về danh sách bước; mỗi bước mô tả trạng thái đầy đủ của cả ba dòng.
// pacAt = vị trí (slice) màn pacman bắt đầu.
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

  // Sửa xong cả ba dòng thì tới màn pacman; code đứng yên ở giá trị đầu.
  const pacAt = steps.reduce((a, s) => a + s.dur, 0);
  const lastStep = Math.round((PAC_X1 - PAC_X0) / PAC_DX) + PAC_TRAIL;
  snap(lastStep * PAC_STEP + PAC_TAIL, null);

  return { steps, pacAt, lastStep };
}

function header() {
  const { steps, pacAt, lastStep } = timeline();
  const total = steps.reduce((a, s) => a + s.dur, 0);
  const dur = n2(total * SLICE);

  // Gộp các bước liên tiếp mà một dòng không đổi gì -> mỗi dòng chỉ còn vài chục khung.
  const perLine = new Map(LINES.map((l) => [l.key, []]));
  for (const step of steps) {
    for (const line of LINES) {
      const s = step.state[line.key];
      const id = `${s.text}\u0000${s.caret}\u0000${s.sel}\u0000${s.blink}`;
      const frames = perLine.get(line.key);
      const last = frames[frames.length - 1];
      if (last && last.id === id) last.dur += step.dur;
      else frames.push({ id, dur: step.dur, ...s });
    }
  }
  for (const frames of perLine.values()) {
    let acc = 0;
    for (const f of frames) {
      f.at = acc;
      acc += f.dur;
    }
  }

  /* --- màn pacman: mỗi bước là một khung đứng yên, dịch bằng x/y của <use> --- */

  const pac = [];
  const ghost = [];
  for (let s = 0; s <= lastStep; s++) {
    const at = pacAt + s * PAC_STEP;
    if (s <= lastStep - PAC_TRAIL) {
      const x = PAC_X0 + s * PAC_DX;
      const shape = s % 4 < 2 ? "po" : "pc"; // mồm nhai
      pac.push({ at, dur: PAC_STEP, m: `<use href="#${shape}" x="${x}" y="${PAC_Y}"/>` });
    }
    if (s >= PAC_TRAIL) {
      const x = PAC_X0 + (s - PAC_TRAIL) * PAC_DX;
      ghost.push({ at, dur: PAC_STEP, m: `<use href="#gh" x="${x}" y="${PAC_Y}"/>` });
    }
  }

  // Hạt đậu biến mất đúng lúc pacman đi qua -> mỗi hạt một độ dài hiển thị riêng.
  const dots = [];
  for (let x = DOT_X0; x <= PAC_X1 - 40; x += DOT_GAP) {
    const eaten = Math.max(1, Math.ceil((x - PAC_X0) / PAC_DX)) * PAC_STEP;
    dots.push({
      at: pacAt,
      dur: eaten,
      m: `<circle cx="${x}" cy="${PAC_Y}" r="${DOT_R}" fill="${C.dot}"/>`,
    });
  }

  /* ------------------------------- CSS: một @keyframes cho mỗi độ dài hiển thị */

  const all = [...perLine.values()].flat().concat(pac, ghost, dots);
  const spans = [...new Set(all.map((f) => f.dur))].sort((a, b) => a - b);
  const pctOf = (d) => Number(((d / total) * 100).toFixed(4));
  const keyframes = spans
    .map(
      (d) =>
        `    .t${d} { animation-name:t${d} }\n` +
        `    @keyframes t${d} { 0% { opacity:1 } ${pctOf(d)}% { opacity:0 } }`
    )
    .join("\n");

  const cls = (f, extra) => `class="f t${f.dur}${extra ? " " + extra : ""}" style="animation-delay:${n3(f.at * SLICE)}s"`;

  const txt = (x, y, body, chars, attrs) =>
    `<text x="${n2(x)}" y="${y}" textLength="${n2(chars * CH)}"${attrs ? " " + attrs : ""}>${body}</text>`;

  /* ---------------------------------------------------------------- các dòng */

  const out = [];
  for (const line of LINES) {
    const prefix = `${line.label}:`; // dấu cách sau dấu hai chấm tính vào vx, không render
    const px = X0 + INDENT * CH;
    const vx = px + (prefix.length + 1) * CH;

    out.push(`  <g data-line="${line.key}">`);
    // Nhãn dòng đứng yên, chỉ phần giá trị mới hoạt hình.
    out.push(
      "    " +
        txt(
          px,
          line.y,
          `<tspan fill="${C.prop}">${esc(line.label)}</tspan><tspan fill="${C.punct}">:</tspan>`,
          prefix.length
        )
    );

    const frames = perLine.get(line.key);
    // Khung dùng làm ảnh tĩnh khi người xem bật prefers-reduced-motion.
    const still = frames.findIndex(
      (f) => f.text === line.values[0] && f.caret === null && f.sel === null
    );

    frames.forEach((f, i) => {
      const extra = [f.blink ? "bl" : null, i === still ? "still" : null].filter(Boolean).join(" ");
      const caret = f.caret === null ? "" : `<tspan class="c" fill="${C.punct}">${CARET}</tspan>`;
      const chars = f.text.length + (f.caret === null ? 0 : 1) + 1; // + con trỏ + dấu phẩy
      // Lúc đang gõ, con trỏ đứng ngay sau chữ vừa gõ (và đặc, không nháy) nên không
      // để lại khe. Gõ xong thì nó nháy, phải đẩy ra sau dấu phẩy — để giữa giá trị
      // và dấu phẩy thì mỗi nhịp nháy tắt sẽ hở một ô trống ngay giữa dòng.
      const comma = `<tspan fill="${C.punct}">,</tspan>`;
      const body = colorize(f.text) + (f.blink ? comma + caret : caret + comma);

      if (f.sel === null) {
        out.push("    " + txt(vx, line.y, body, chars, cls(f, extra)));
      } else {
        // Khối bôi đen nằm dưới chữ, cùng một khung nên hiện/tắt cùng nhau.
        const rect = `<rect x="${n2(vx)}" y="${line.y - 15.5}" width="${n2(f.sel * CH)}" height="21" fill="${C.sel}"/>`;
        out.push(`    <g ${cls(f, extra)}>${rect}${txt(vx, line.y, body, chars)}</g>`);
      }
    });
    out.push("  </g>", "");
  }

  const game = [
    `  <g data-line="dots">`,
    ...dots.map((f) => `    <g ${cls(f)}>${f.m}</g>`),
    `  </g>`,
    `  <g data-line="pac">`,
    ...pac.map((f) => `    <g ${cls(f)}>${f.m}</g>`),
    `  </g>`,
    `  <g data-line="ghost">`,
    ...ghost.map((f) => `    <g ${cls(f)}>${f.m}</g>`),
    `  </g>`,
  ].join("\n");

  const label = LINES.map((l) => `${l.key}: ${l.values[0]}`).join("; ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 280" width="1200" height="280" role="img" aria-label="const zivhd = { ${esc(label)} }">
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
  <defs>
    <path id="po" d="${pacPath(33)}" fill="${C.pac}"/>
    <path id="pc" d="${pacPath(4)}" fill="${C.pac}"/>
    <g id="gh">
      <path d="M-8,7V-1A8,8 0 0 1 8,-1V7q-2,4.5 -4,0q-2,4.5 -4,0q-2,4.5 -4,0q-2,4.5 -4,0Z" fill="${C.ghost}"/>
      <circle cx="-3.4" cy="-2" r="2.4" fill="${C.eye}"/>
      <circle cx="3.4" cy="-2" r="2.4" fill="${C.eye}"/>
      <circle cx="-2.6" cy="-2" r="1.2" fill="${C.pupil}"/>
      <circle cx="4.2" cy="-2" r="1.2" fill="${C.pupil}"/>
    </g>
  </defs>

  <rect x="0.75" y="0.75" width="1198.5" height="278.5" rx="16" fill="${C.cardBg}" stroke="${C.cardStroke}"/>
  <rect x="8.75" y="8.75" width="1182.5" height="262.5" rx="12" fill="${C.inner}" stroke="${C.innerStroke}"/>

${game}

  <g font-family="${MONO}" font-size="${FONT}" xml:space="preserve">
  <text x="1156" y="44" text-anchor="end" font-size="14" fill="${C.meta}">zivhdinfo</text>

  ${txt(X0, 62, `<tspan fill="${C.comment}">// the stack I reach for</tspan>`, 23)}
  ${txt(X0, 96, `<tspan fill="${C.keyword}">const </tspan><tspan fill="${C.ident}">zivhd</tspan><tspan fill="${C.punct}"> = {</tspan>`, 15)}

${out.join("\n")}  ${txt(X0, 232, `<tspan fill="${C.punct}">}</tspan>`, 1)}
  </g>
</svg>
`;
}

/* ------------------------------------------------------------- stack: fade */

function stack() {
  const step = 1182.5 / PAIRS.length;

  const slots = PAIRS.map(([aKey, bKey], i) => {
    const cx = n2(8.75 + step * (i + 0.5));
    const delay = n3((FADE / PAIRS.length) * i);

    const side = (key, klass) => {
      const icon = ICONS[key];
      if (!icon) throw new Error(`icons.json thiếu "${key}"`);
      return (
        `    <g class="${klass}" style="animation-delay:${delay}s">` +
        `<g transform="translate(${n2(cx - 20)},38) scale(1.66667)" fill="${inkOf(icon)}">` +
        `<title>${esc(icon.title)}</title><path d="${icon.path}"/></g>` +
        `<text x="${cx}" y="100" text-anchor="middle" fill="${C.meta}">${esc(icon.label)}</text>` +
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

  <rect x="0.75" y="0.75" width="1198.5" height="138.5" rx="16" fill="${C.cardBg}" stroke="${C.cardStroke}"/>
  <rect x="8.75" y="8.75" width="1182.5" height="122.5" rx="12" fill="${C.inner}" stroke="${C.innerStroke}"/>

  <g font-family="${MONO}" font-size="13">
${slots}
  </g>
</svg>
`;
}

/* -------------------------------------------------------------------- ghi */

for (const [name, svg] of [["header", header()], ["stack", stack()]]) {
  await writeFile(join(ROOT, "assets", `${name}.svg`), svg);
  console.log(`${name}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
}
