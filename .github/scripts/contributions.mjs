// Lấy lịch sử contribution một năm gần nhất và ghi ra tools/contributions.json,
// để build-assets.mjs tô màu hạt đậu trong màn pacman theo đúng 5 mức xanh.
//
// Hai nguồn, thử lần lượt — cả hai đều không cần token (GITHUB_TOKEN của Actions
// là token của repo, không đọc được contributions của user, còn xin PAT chỉ để
// tô màu thì không đáng):
//
//   1. github-contributions-api.jogruber.de — JSON có sẵn `level` 0..4, contract
//      rõ ràng. Cache 1 tiếng, giới hạn 10 request/10 giây mỗi IP; ta gọi 1 lần
//      mỗi lần workflow chạy nên thoải mái.
//   2. Trang public github.com/users/<login>/contributions — đọc `data-level`
//      thẳng từ HTML. Chậm và dễ gãy hơn nếu GitHub đổi markup, nhưng không phụ
//      thuộc bên thứ ba.
//
// Nguồn nào cũng phải trả đủ ít nhất MIN_DAYS ngày mới được nhận. Thà hỏng ồn ào
// còn hơn lặng lẽ ghi đè bằng mảng rỗng rồi mất sạch màu.

import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const OUT = "tools/contributions.json";
const MIN_DAYS = 300;

export function parseApi(json) {
  const rows = Array.isArray(json?.contributions) ? json.contributions : [];
  return rows
    .filter((d) => typeof d?.date === "string" && Number.isInteger(d?.level))
    .map((d) => ({ date: d.date, level: d.level, count: d.count ?? 0 }));
}

export function parseHtml(html) {
  // Mỗi ô là một <td> mang data-date và data-level. Đọc rời từng thuộc tính chứ
  // không khoá thứ tự, để GitHub đảo thuộc tính cũng không gãy.
  const byDate = new Map();
  for (const [tag] of html.matchAll(/<td\b[^>]*>/g)) {
    const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const level = tag.match(/data-level="(\d+)"/)?.[1];
    if (date && level !== undefined) byDate.set(date, Number(level));
  }
  return [...byDate.entries()].map(([date, level]) => ({ date, level, count: 0 }));
}

const sortDays = (days) => days.sort((a, b) => (a.date < b.date ? -1 : 1));

export async function collect(owner, fetchImpl = fetch) {
  const ua = { "user-agent": `${owner}-pacman` };
  const sources = [
    {
      name: "jogruber API",
      url: `https://github-contributions-api.jogruber.de/v4/${owner}?y=last`,
      headers: { ...ua, accept: "application/json" },
      read: async (res) => parseApi(await res.json()),
    },
    {
      name: "trang GitHub",
      url: `https://github.com/users/${owner}/contributions`,
      headers: { ...ua, accept: "text/html" },
      read: async (res) => parseHtml(await res.text()),
    },
  ];

  const failures = [];
  for (const src of sources) {
    try {
      const res = await fetchImpl(src.url, { headers: src.headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const days = sortDays(await src.read(res));
      if (days.length < MIN_DAYS) throw new Error(`chỉ có ${days.length} ngày`);
      return { days, source: src.name };
    } catch (err) {
      failures.push(`${src.name}: ${err.message}`);
    }
  }
  throw new Error(`không nguồn nào dùng được -> ${failures.join(" | ")}`);
}

// argv[1] không phải lúc nào cũng có (ví dụ `node -e`), thiếu guard này thì
// chỉ import module để test cũng nổ.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const owner = process.env.GITHUB_REPOSITORY?.split("/")[0] ?? "zivhdinfo";
  const { days, source } = await collect(owner);
  await writeFile(
    OUT,
    JSON.stringify({ user: owner, source, fetchedAt: new Date().toISOString(), days }) + "\n"
  );
  const total = days.reduce((a, d) => a + d.count, 0);
  console.log(`${OUT}: ${days.length} ngày từ ${source}, mới nhất ${days.at(-1).date}${total ? `, tổng ${total} contribution` : ""}`);
}
