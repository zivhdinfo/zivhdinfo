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

- `LINES` — ba dòng `web`, `api`, `rule` và danh sách giá trị của mỗi dòng.
  Animation chạy vòng: bôi đen giá trị đang có, xoá, gõ giá trị kế tiếp, nghỉ,
  rồi sang dòng dưới. **Cả ba dòng phải có số values bằng nhau**, hết một vòng
  mới quay đúng về giá trị đầu (generator tự chặn nếu lệch).
- `PAIRS` — 6 ô icon, mỗi ô fade qua lại giữa hai công nghệ. Giá trị là key
  trong `tools/icons.json`. Muốn dùng icon mới thì thêm một entry vào file đó
  (`label`, `title`, `hex`, `path` — lấy path 24x24 ở simpleicons.com).
- Nhóm hằng số nhịp — `SLICE` (một đơn vị thời gian), `SWEEP_STEPS`/`SWEEP_DUR`
  (quét khối bôi đen), `SEL_HOLD` (giữ khối bôi đen), `GONE` (dòng trống),
  `TYPE_DUR` (mỗi ký tự), `DONE_HOLD` (giữ sau khi gõ xong), `IDLE` (nghỉ giữa
  hai lần sửa), `FADE` (một vòng fade icon). Muốn chậm hơn thì tăng `IDLE` và
  `DONE_HOLD` trước.

## Kỹ thuật

- README markdown của GitHub bị sanitize, không ăn `class` hay `<style>` — nên
  cái layout card-bọc-card được vẽ thẳng trong SVG: `rect` ngoài `rx=16` nền
  muted, `rect` trong `rx=12` nền background, cách nhau 8px đúng kiểu `p-1`.
- Đổi theme tự động bằng `<picture>` + `media="(prefers-color-scheme: dark)"` —
  GitHub hỗ trợ cái này trong README.
- Cả hai card chỉ animate **`opacity`**. Cố tình không dùng SMIL hay animate
  thuộc tính hình học: SVG này được nhúng bằng `<img>` qua camo, `opacity` là
  thứ chắc ăn nhất ở mọi trình duyệt.
- Mỗi dòng code là mấy trăm phần tử `<text>`, mỗi cái là một trạng thái của
  dòng, chỉ hiện đúng lượt của mình. Tất cả dùng chung một vòng lặp và phân biệt
  nhau bằng `animation-delay`. Ba điều kiện để nó không vỡ:
  1. Delay phải **dương**. Delay âm tua animation tới trước làm cả chuỗi chạy
     ngược.
  2. Mỗi độ dài hiển thị cần **cả** `@keyframes` **lẫn** một rule gán
     `animation-name`. Thiếu rule gán thì shorthand ở `.f` chạy với
     `animation-name:none` và không có gì nhúc nhích.
  3. Keyframe dùng **`step-end`**, không nội suy. Nếu dùng `linear` thì mốc tắt
     phải luôn lớn hơn mốc bật, mà làm tròn hai mốc ở hai độ chính xác khác nhau
     rất dễ cho ra mốc tắt sớm hơn — lúc đó CSS sắp xếp lại các mốc và opacity
     giảm dần suốt chu kỳ thay vì tắt hẳn, làm mọi khung cùng hiện chồng lên nhau.
- Mọi dòng code đều bị ghim bằng `textLength` = số ký tự × `CH`. Đây là điều
  kiện để vẽ được khối bôi đen: không ghim thì bề ngang chữ phụ thuộc font máy
  người xem (Consolas trên Windows hẹp hơn SF Mono khoảng 9%) và khối bôi đen sẽ
  lệch hẳn so với chữ. Ghim rồi thì ký tự thứ k luôn nằm ở `x + k × CH`.
- Đã ghim `textLength` thì **không được dùng ký tự space ở rìa chuỗi**. Trình
  duyệt gom mất khoảng trắng đầu và cuối một chuỗi text kể cả khi có
  `xml:space="preserve"`, nhưng `textLength` vẫn ghim đủ số ô, kết quả là chữ bị
  kéo giãn ra (`w e b :`). Thụt đầu dòng và dấu cách sau dấu hai chấm đều đẩy
  bằng toạ độ `x`.
- Con trỏ là ký tự `█` nằm trong chính dòng text. Lúc đang gõ nó đứng ngay sau
  chữ vừa gõ và không nháy; gõ xong mới nháy và lúc đó bị đẩy ra sau dấu phẩy —
  để nó giữa giá trị và dấu phẩy thì mỗi nhịp nháy tắt sẽ hở một ô ngay giữa dòng.
- Ai bật `prefers-reduced-motion` thì cả hai card đứng yên: header giữ giá trị
  đầu của cả ba dòng, stack giữ 6 icon đầu của mỗi cặp.
- simple-icons để `#000000` cho vài brand (Next.js, Fastify) — generator tự lật
  sang màu sáng khi dựng bản dark.
- Link ảnh phải tuyệt đối (`raw.githubusercontent.com`), README profile không
  ăn đường dẫn tương đối. Dùng `HEAD` trong link thay vì tên branch —
  `raw.githubusercontent.com` tự resolve về default branch, nên đổi tên branch
  hay đặt default branch khác cũng không gãy ảnh. GitHub cache qua camo: sửa
  ảnh mà chưa thấy đổi thì thêm `?v=2` vào cuối link.
