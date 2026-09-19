// Ghi lại dòng cuối README (giữa PULSE:START / PULSE:END): last push + số repo.
// Chạy bằng Node 20+ (fetch có sẵn), không cần dependency.

import { readFile, writeFile } from "node:fs/promises";

const OWNER = process.env.GITHUB_REPOSITORY?.split("/")[0] ?? "zivhdinfo";
const TOKEN = process.env.GITHUB_TOKEN;
const README = "README.md";

const headers = {
  accept: "application/vnd.github+json",
  "user-agent": `${OWNER}-pulse`,
  ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

function ago(iso) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

const user = await api(`/users/${OWNER}`);

// Lấy tối đa 300 repo public gần nhất để tìm lần push cuối.
let pushedAt = null;
for (let page = 1; page <= 3; page++) {
  const repos = await api(`/users/${OWNER}/repos?per_page=100&sort=pushed&page=${page}`);
  for (const repo of repos) {
    if (repo.fork) continue;
    if (!pushedAt || Date.parse(repo.pushed_at) > Date.parse(pushedAt)) pushedAt = repo.pushed_at;
  }
  if (repos.length < 100) break;
}

const parts = [
  pushedAt ? `last push ${ago(pushedAt)}` : null,
  `${user.public_repos} public repos`,
];
const line = `<sub>${parts.filter(Boolean).join(" · ")}</sub>`;

const src = await readFile(README, "utf8");
const block = /(<!--PULSE:START-->)[\s\S]*?(<!--PULSE:END-->)/;
if (!block.test(src)) {
  console.error("Không tìm thấy marker PULSE:START / PULSE:END trong README.md");
  process.exit(1);
}

const out = src.replace(block, `$1\n${line}\n$2`);
if (out === src) {
  console.log("pulse: không có gì thay đổi");
} else {
  await writeFile(README, out);
  console.log(`pulse: ${line}`);
}
