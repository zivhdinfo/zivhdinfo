# Lắp vào GitHub

1. Repo **public** tên `zivhdinfo` (trùng username) → GitHub lấy `README.md` của nó làm profile.

2. Copy nguyên cấu trúc:

   ```
   README.md
   assets/header-light.svg   assets/header-dark.svg
   assets/stack-light.svg    assets/stack-dark.svg
   .github/workflows/pulse.yml
   .github/scripts/pulse.mjs
   ```

3. **Settings → Actions → General → Workflow permissions → Read and write → Save**,
   rồi **Actions → pulse → Run workflow** cho chạy lần đầu. Nó ghi lại dòng cuối
   README mỗi 6 tiếng (last push + số repo). Không thích thì xoá luôn 2 file
   trong `.github/`, phần còn lại vẫn chạy bình thường.

## Sửa nội dung

Mở thẳng file SVG, chữ nằm trong `<text>`/`<tspan>`, sửa xong save là xong.
Nhớ sửa **cả hai bản** light và dark.

- Dòng mô tả: `rule: "types first, then the feature"` trong `header-*.svg`.
- Thêm/bớt tech: mỗi logo là một `<g transform="translate(...) scale(...)">`
  trong `stack-*.svg`. Bớt thì xoá `<g>` rồi chia lại toạ độ `translate` cho đều
  (khoảng cách hiện tại = 1182 / số logo). Thêm logo mới thì lấy path 24x24 ở
  simpleicons.com, dán vào `<path d="...">` và đặt `fill` bằng mã màu brand.

## Kỹ thuật

- README markdown của GitHub bị sanitize, không ăn `class` hay `<style>` — nên
  cái layout card-bọc-card được vẽ thẳng trong SVG: `rect` ngoài `rx=16` nền
  muted, `rect` trong `rx=12` nền background, cách nhau 8px đúng kiểu `p-1`.
- Đổi theme tự động bằng `<picture>` + `media="(prefers-color-scheme: dark)"` —
  GitHub hỗ trợ cái này trong README.
- Chỉ còn một animation duy nhất: con trỏ nháy cuối đoạn code. Ai bật
  `prefers-reduced-motion` thì nó đứng yên.
- Link ảnh phải tuyệt đối (`raw.githubusercontent.com`), README profile không
  ăn đường dẫn tương đối. GitHub cache qua camo: sửa ảnh mà chưa thấy đổi thì
  thêm `?v=2` vào cuối link.
