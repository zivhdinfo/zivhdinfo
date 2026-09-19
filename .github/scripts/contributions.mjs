// Lấy lịch sử contribution một năm gần nhất và ghi ra tools/contributions.json,
// để build-assets.mjs tô màu hạt đậu trong màn pacman theo đúng 5 mức xanh.
//
// Đọc thẳng trang public https://github.com/users/<login>/contributions — không
// cần token. GraphQL API thì đòi PAT riêng vì GITHUB_TOKEN của Actions là token
// của repo, không đọc được contributions của user.

import { writeFile } from "node:fs/promises";

const OWNER = process.env.GITHUB_REPOSITORY?.split("/")[0] ?? "zivhdinfo";
const OUT = "tools/contributions.json";

const res = await fetch(`https://github.com/users/${OWNER}/contributions`, {
  headers: { "user-agent": `${OWNER}-pacman`, accept: "text/html" },
});
if (!res.ok) throw new Error(`GET contributions → ${res.status} ${res.statusText}`);
const html = await res.text();

// Mỗi ô là một <td> mang data-date và data-level. Đọc rời từng thuộc tính chứ
// không khoá thứ tự, để GitHub đảo thuộc tính cũng không gãy.
const byDate = new Map();
for (const [tag] of html.matchAll(/<td\b[^>]*>/g)) {
  const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
  const level = tag.match(/data-level="(\d+)"/)?.[1];
  if (date && level !== undefined) byDate.set(date, Number(level));
}

const days = [...byDate.entries()]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([date, level]) => ({ date, level }));

// Nếu GitHub đổi cấu trúc trang thì thà hỏng ồn ào còn hơn lặng lẽ ghi đè bằng
// một mảng rỗng và làm mất hết màu.
if (days.length < 300)
  throw new Error(`chỉ đọc được ${days.length} ngày — nhiều khả năng trang đã đổi cấu trúc`);

await writeFile(
  OUT,
  JSON.stringify({ user: OWNER, fetchedAt: new Date().toISOString(), days }, null, 0) + "\n"
);

const total = days.reduce((a, d) => a + d.level, 0);
console.log(`${OUT}: ${days.length} ngày, ${days.at(-1).date} là ngày mới nhất, tổng mức ${total}`);
