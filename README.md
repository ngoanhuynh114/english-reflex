# English Reflex – Luyện Phản Xạ Nói Tiếng Anh

Web app luyện phản xạ nói tiếng Anh. Chạy hoàn toàn trên trình duyệt, tự động đồng bộ câu hỏi từ Google Sheet.

---

## Tính năng

| Tính năng | Mô tả |
|---|---|
| 🤖 Auto-fetch | Tự động lấy câu hỏi từ Google Sheet khi vào app |
| 🎤 Ghi âm | Bấm mic, nói, nghe lại |
| ⏱ Đếm ngược 5s | Bắt đầu sau khi TTS đọc xong câu hỏi |
| 🔊 Voice ON/OFF | Tự động đọc câu hỏi và câu trả lời mẫu |
| 🔊 Listen Model Answer | Đọc/dừng câu trả lời mẫu theo yêu cầu |
| 💾 Offline cache | Hoạt động không cần mạng sau lần fetch đầu (cache 6 tiếng) |
| 📂 Import JSON | Import file câu hỏi offline nếu cần |

---

## Cách đổi nguồn câu hỏi (thường xuyên nhất)

Chỉ sửa **1 dòng** trong `config.js`:

```js
SHEET_ID: 'PASTE_SHEET_ID_CỦA_BẠN_VÀO_ĐÂY',
```

Không cần động đến `app.js` hay `index.html`.

---

## Lấy Sheet ID từ Google Sheet

**Bước 1 – Tạo Google Sheet đúng cấu trúc**

| A | B | C | D |
|---|---|---|---|
| id | category | question | answer |
| 1 | Daily Life | What did you do yesterday? | I went to the coffee shop… |

Hàng đầu là header – app tự bỏ qua.

**Bước 2 – Publish Sheet dưới dạng CSV công khai**

```
File → Share → Publish to web
→ Chọn sheet cần publish
→ Format: Comma-separated values (.csv)
→ Bấm Publish → OK
```

> ⚠️ Bắt buộc phải Publish. Nếu không, app không fetch được.

**Bước 3 – Lấy Sheet ID**

Trong URL của Google Sheet:
```
https://docs.google.com/spreadsheets/d/SHEET_ID/edit
```
Copy chuỗi dài ~44 ký tự giữa `/d/` và `/edit`.

**Bước 4 – Paste vào config.js**

```js
const APP_CONFIG = {
  SHEET_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
  SHEET_GID: '0',
};
```

---

## Cách app load dữ liệu (tự động)

```
Khởi động
    │
    ├─ SHEET_ID có trong config.js?
    │       │
    │       ├─ Cache còn mới (< 6 tiếng) ──→ Dùng cache + fetch ngầm
    │       │
    │       └─ Cache cũ / không có ──────→ Fetch Sheet ngay
    │               │
    │               └─ Fetch thất bại ──→ Dùng cache cũ (nếu có)
    │
    └─ Không có SHEET_ID
            │
            ├─ localStorage có dữ liệu ──→ Dùng cache
            ├─ questions.json tồn tại  ──→ Đọc file
            └─ Tất cả thất bại         ──→ 25 câu hỏi mặc định
```

---

## Logic đếm ngược & TTS

```
Voice ON  → TTS đọc câu hỏi → onend → Countdown 5s bắt đầu
Voice OFF → Countdown 5s bắt đầu ngay khi câu hỏi xuất hiện
Replay    → Đọc lại câu hỏi, KHÔNG reset countdown

Model Answer:
  Voice ON  → Tự động đọc khi "Show Model Answer" được bấm
  Voice OFF → Chỉ đọc khi bấm nút 🔊 Listen
  Next / Try Again → Dừng TTS ngay lập tức
```

---

## Cấu trúc file

```
english-reflex/
├── index.html       – Giao diện
├── style.css        – CSS responsive (dark mode)
├── app.js           – Logic chính (không cần sửa)
├── config.js        – ← CHỈ CẦN SỬA FILE NÀY để đổi Sheet
├── questions.json   – Câu hỏi mẫu (fallback offline)
└── README.md        – Tài liệu này
```

---

## Deploy lên Vercel

**Lần đầu:**
```bash
git init
git add .
git commit -m "Initial commit: English Reflex"
# Lên GitHub → New repository → tạo repo → copy lệnh remote add
git remote add origin https://github.com/TÊN_BẠN/english-reflex.git
git branch -M main
git push -u origin main
```
Vào [vercel.com](https://vercel.com) → Add New Project → chọn repo → Deploy.

**Cập nhật sau này (ví dụ đổi Sheet ID):**
```bash
# Sửa config.js, rồi:
git add config.js
git commit -m "Update Sheet ID"
git push
# Vercel tự động redeploy trong ~30 giây
```

**Chỉ muốn đổi câu hỏi mà không deploy lại?**
Sửa nội dung trực tiếp trong Google Sheet → vào app → bấm **⟳ Sync từ Google Sheet**.
