# Lắp vào GitHub

1. Repo **public** tên `zivhdinfo` (trùng username) → GitHub lấy `README.md` của nó làm profile.

2. Copy nguyên cấu trúc:

   ```
   README.md
   assets/header-light.svg   assets/header-dark.svg
   assets/stack-light.svg    assets/stack-dark.svg
   tools/build-assets.mjs    tools/icons.json
   .github/workflows/pulse.yml
   .github/scripts/pulse.mjs
   ```

3. **Settings → Actions → General → Workflow permissions → Read and write → Save**,
   rồi **Actions → pulse → Run workflow** cho chạy lần đầu. Nó ghi lại dòng cuối
   README mỗi 6 tiếng (last push + số repo). Không thích thì xoá luôn 2 file
   trong `.github/`, phần còn lại vẫn chạy bình thường.

## Sửa nội dung

**Đừng sửa tay file SVG** — 4 file trong `assets/` là output, sinh ra từ
`tools/build-assets.mjs`. Sửa file đó rồi chạy:

```
node tools/build-assets.mjs
```

Không cần cài gì, chỉ cần Node 20+. Cả bản light lẫn dark ra cùng một lượt nên
không bao giờ lệch nhau.

Ba thứ hay sửa nhất, đều nằm ngay đầu file:

- `PHRASES` — danh sách câu mà dòng `rule:` sẽ gõ rồi xoá. Thêm bớt thoải mái,
  thời lượng vòng lặp tự tính lại.
- `PAIRS` — 6 ô icon, mỗi ô fade qua lại giữa hai công nghệ. Giá trị là key
  trong `tools/icons.json`. Muốn dùng icon mới thì thêm một entry vào file đó
  (`label`, `title`, `hex`, `path` — lấy path 24x24 ở simpleicons.com).
- `SLICE` / `HOLD` / `GAP` / `DEL` / `FADE` — nhịp gõ, thời gian giữ, tốc độ xoá
  và độ dài một vòng fade.

## Kỹ thuật

- README markdown của GitHub bị sanitize, không ăn `class` hay `<style>` — nên
  cái layout card-bọc-card được vẽ thẳng trong SVG: `rect` ngoài `rx=16` nền
  muted, `rect` trong `rx=12` nền background, cách nhau 8px đúng kiểu `p-1`.
- Đổi theme tự động bằng `<picture>` + `media="(prefers-color-scheme: dark)"` —
  GitHub hỗ trợ cái này trong README.
- Hai hiệu ứng (gõ chữ, fade icon) đều chỉ animate **`opacity`** bằng CSS thuần.
  Cố tình không dùng SMIL hay animate thuộc tính hình học: SVG này được nhúng
  bằng `<img>` qua camo, `opacity` là thứ chắc ăn nhất ở mọi trình duyệt.
- Dòng gõ chữ thực ra là ~250 phần tử `<text>`, mỗi cái là một trạng thái của
  dòng, chỉ hiện đúng lượt của mình. Tất cả dùng chung một vòng lặp và phân biệt
  nhau bằng `animation-delay`. Delay phải **dương**: delay âm tua animation tới
  trước làm cả chuỗi chạy ngược.
- Con trỏ là ký tự `▌` nằm trong chính dòng text, không phải `<rect>` toạ độ cố
  định — nhờ vậy nó luôn dính đúng cuối chữ dù máy người xem resolve ra font
  monospace nào. Nó chỉ nháy lúc câu đã gõ xong.
- Ai bật `prefers-reduced-motion` thì cả hai card đứng yên: header giữ một dòng
  hoàn chỉnh, stack giữ 6 icon đầu của mỗi cặp.
- simple-icons để `#000000` cho vài brand (Next.js, Fastify) — generator tự lật
  sang màu sáng khi dựng bản dark.
- Link ảnh phải tuyệt đối (`raw.githubusercontent.com`), README profile không
  ăn đường dẫn tương đối. Dùng `HEAD` trong link thay vì tên branch —
  `raw.githubusercontent.com` tự resolve về default branch, nên đổi tên branch
  hay đặt default branch khác cũng không gãy ảnh. GitHub cache qua camo: sửa
  ảnh mà chưa thấy đổi thì thêm `?v=2` vào cuối link.
