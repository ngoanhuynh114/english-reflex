/**
 * ENGLISH REFLEX – config.js
 *
 * Chỉ cần sửa file này khi muốn đổi nguồn dữ liệu.
 * Không cần động đến app.js hay index.html.
 *
 * Cách lấy SHEET_ID:
 *   URL Google Sheet: https://docs.google.com/spreadsheets/d/SHEET_ID/edit
 *   Copy phần SHEET_ID (chuỗi dài ~44 ký tự giữa /d/ và /edit).
 *
 * Sheet phải được Publish CSV công khai:
 *   File → Share → Publish to web → chọn sheet → CSV → Publish
 */
const APP_CONFIG = {

  // ── Paste Sheet ID của bạn vào đây ──────────────────────────────────────
  SHEET_ID: '1Rx8bLjQIjYtKXDIVcCH8beo4euuyM-2bL6oYVqIX998',
  // ────────────────────────────────────────────────────────────────────────

  // Sheet tab cần lấy (gid=0 là tab đầu tiên).
  // Nếu câu hỏi nằm ở tab khác, đổi số này theo gid trong URL của tab đó.
  SHEET_GID: '0',

  // Thứ tự ưu tiên load dữ liệu:
  //   1. Google Sheet (nếu SHEET_ID được điền và có mạng)
  //   2. localStorage (cache từ lần sync trước)
  //   3. questions.json (nếu chạy qua HTTP server)
  //   4. Dữ liệu mặc định nhúng sẵn (25 câu)
};
