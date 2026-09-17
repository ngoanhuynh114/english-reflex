/**
 * ENGLISH REFLEX – app.js  v4
 *
 * Startup flow (auto, không cần user làm gì):
 *   1. Nếu APP_CONFIG.SHEET_ID có → fetch Google Sheet → cache localStorage
 *   2. Nếu Sheet lỗi/offline     → dùng localStorage (cache cũ)
 *   3. Nếu localStorage rỗng     → fetch questions.json (HTTP server)
 *   4. Nếu tất cả thất bại       → dùng DEFAULT_QUESTIONS nhúng sẵn
 *
 * Người dùng không cần paste gì. Chỉ cần mở URL → học ngay.
 * Để đổi câu hỏi: sửa Google Sheet → mở lại app → tự cập nhật.
 *
 * Logic đếm ngược & TTS giữ nguyên từ v3.
 */

'use strict';

// ─── DEFAULT DATA ────────────────────────────────────────────────────────────
const DEFAULT_QUESTIONS = [
  { id:1,  category:"Daily Life",      question:"What did you do yesterday?",                       answer:"I went to the coffee shop with my friend yesterday. We sat there for about an hour and talked." },
  { id:2,  category:"Morning Routine", question:"What time do you usually get up?",                 answer:"I usually get up at six o'clock. I like to have some quiet time before the day gets busy." },
  { id:3,  category:"Coffee",          question:"How do you usually take your coffee?",              answer:"I usually drink it black with no sugar. I like the strong, bitter taste in the morning." },
  { id:4,  category:"Food",            question:"What did you have for breakfast today?",            answer:"I had a bowl of rice with some fried eggs and a cup of tea. It was simple but filling." },
  { id:5,  category:"Weekend",         question:"What do you usually do on weekends?",               answer:"I usually spend time with my family on weekends. Sometimes we go to the market together." },
  { id:6,  category:"Hobbies",         question:"What do you like to do in your free time?",        answer:"I enjoy listening to music and taking walks near the river. It helps me relax after a long day." },
  { id:7,  category:"Work",            question:"What do you do for work?",                          answer:"I work in public administration. My job involves handling documents and serving the community." },
  { id:8,  category:"Travel",          question:"Have you been to any interesting places recently?", answer:"Yes, I visited Hội An a few months ago. The old town is beautiful, especially at night." },
  { id:9,  category:"Small Talk",      question:"How are you feeling today?",                        answer:"I'm feeling pretty good today, thanks for asking. I had a good night's sleep and I'm ready for the day." },
  { id:10, category:"Food",            question:"What is your favourite Vietnamese dish?",           answer:"My favourite dish is phở. I love the rich broth and the fresh herbs. It's perfect for any time of day." },
  { id:11, category:"Morning Routine", question:"Do you exercise in the morning?",                   answer:"Yes, I try to go for a short walk every morning. It usually takes about thirty minutes." },
  { id:12, category:"Hobbies",         question:"Do you enjoy reading books?",                       answer:"Yes, I like reading, but I don't have as much time as I'd like. I usually read before bed." },
  { id:13, category:"Small Talk",      question:"What's the weather like in your area?",             answer:"It's quite hot here most of the year. In summer it can get very humid." },
  { id:14, category:"Daily Life",      question:"How do you usually get to work?",                   answer:"I usually ride my motorbike to work. It takes about fifteen minutes." },
  { id:15, category:"Weekend",         question:"Did you do anything fun last weekend?",             answer:"Yes, I went fishing with my brother last Saturday. We had a great time just being outside." },
  { id:16, category:"Coffee",          question:"Do you prefer coffee or tea?",                      answer:"I prefer coffee, especially Vietnamese iced coffee. It's strong and gives me energy for the morning." },
  { id:17, category:"Travel",          question:"What city in Vietnam would you like to visit?",     answer:"I would love to visit Đà Lạt. I've heard it's very cool and beautiful." },
  { id:18, category:"Work",            question:"What time do you usually start work?",              answer:"I usually start work at seven-thirty in the morning. We have a morning meeting first." },
  { id:19, category:"Food",            question:"Can you cook? What is your best dish?",             answer:"Yes, I can cook. I think my best dish is braised fish in caramel sauce. My family loves it." },
  { id:20, category:"Daily Life",      question:"What do you usually do in the evenings?",           answer:"In the evenings I usually watch the news, have dinner with my family, and then relax." },
  { id:21, category:"Hobbies",         question:"Do you play any sports?",                           answer:"I used to play badminton with friends. Now I go swimming when I have time." },
  { id:22, category:"Small Talk",      question:"What kind of music do you listen to?",              answer:"I like Vietnamese pop music and old ballads. They help me feel calm when I'm stressed." },
  { id:23, category:"Travel",          question:"Have you ever been outside of Vietnam?",            answer:"No, not yet. But I would really like to visit Japan one day." },
  { id:24, category:"Morning Routine", question:"What is the first thing you do when you wake up?",  answer:"The first thing I do is check my phone. Then I get up, wash my face, and make coffee." },
  { id:25, category:"Daily Life",      question:"How do you usually spend your lunch break?",        answer:"I usually eat lunch with my colleagues and then rest for a short while." }
];

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const STATES = {
  IDLE:'IDLE', QUESTION:'QUESTION', COUNTDOWN:'COUNTDOWN',
  RECORDING:'RECORDING', RECORDED:'RECORDED',
  MODEL_ANSWER:'MODEL_ANSWER', TIMEOUT:'TIMEOUT'
};
const COUNTDOWN_MS = 5000;
const RING_C       = 2 * Math.PI * 35;
const LS_KEY       = 'english_reflex_questions';
const LS_SYNCED_AT = 'english_reflex_synced_at';
// Re-fetch từ Sheet sau mỗi 6 tiếng (tính bằng ms)
const SYNC_TTL_MS  = 6 * 60 * 60 * 1000;

// ─── APP STATE ────────────────────────────────────────────────────────────────
let state             = STATES.IDLE;
let questions         = [];
let currentIndex      = 0;
let voiceOn           = true;
let questionShownAt   = 0;
let sessionToken      = 0;
let countdownInterval = null;
let mediaRecorder     = null;
let audioChunks       = [];
let recordingBlob     = null;
let audioURL          = null;
let ttsVoice          = null;
let currentTTSHandle  = null;
let answerTTSPlaying  = false;

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  btnVoice:           $('btn-voice'),
  progressFill:       $('progress-fill'),
  progressLabel:      $('progress-label'),
  categoryTag:        $('category-tag'),
  questionText:       $('question-text'),
  btnReplay:          $('btn-replay'),
  countdownSection:   $('countdown-section'),
  countdownNumber:    $('countdown-number'),
  ringProgress:       $('ring-progress'),
  countdownLabel:     $('countdown-label'),
  micSection:         $('mic-section'),
  btnMic:             $('btn-mic'),
  recordingSection:   $('recording-section'),
  btnStop:            $('btn-stop'),
  recordedSection:    $('recorded-section'),
  audioPlayer:        $('audio-player'),
  btnShowAnswer:      $('btn-show-answer'),
  modelAnswerSection: $('model-answer-section'),
  modelAnswerText:    $('model-answer-text'),
  btnListenAnswer:    $('btn-listen-answer'),
  btnTryAgain:        $('btn-try-again'),
  btnNext:            $('btn-next'),
  timeoutSection:     $('timeout-section'),
  btnTryAgainTimeout: $('btn-try-again-timeout'),
  fileInput:          $('file-input'),
  btnReset:           $('btn-reset'),
  flashMsg:           $('flash-msg'),
  dataSourceInfo:     $('data-source-info'),
  syncRow:            $('sync-row'),
  btnSync:            $('btn-sync'),
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  loadVoices();
  applyVoiceUI();
  bindEvents();
  loadData();
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
function loadVoices() {
  function pick() {
    const v = speechSynthesis.getVoices();
    ttsVoice = v.find(x => x.lang === 'en-US') || v.find(x => x.lang.startsWith('en-')) || null;
  }
  pick();
  if (typeof speechSynthesis.onvoiceschanged !== 'undefined')
    speechSynthesis.onvoiceschanged = pick;
}

function cancelTTS() {
  try { speechSynthesis.cancel(); } catch(_) {}
  answerTTSPlaying = false;
  updateListenBtn();
}

function speakQuestionWithCallback(text, onDone) {
  let done = false, timer = null;
  function finish() { if(done) return; done=true; clearTimeout(timer); onDone(); }
  function cancel() { done=true; clearTimeout(timer); try{speechSynthesis.cancel();}catch(_){} }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (ttsVoice) u.voice = ttsVoice;
    u.lang='en-US'; u.rate=0.92;
    u.onend=finish; u.onerror=finish;
    speechSynthesis.speak(u);
    timer = setTimeout(finish, 8000);
  } catch(e) { console.warn('TTS q error:',e); onDone(); }
  return { cancel };
}

function speakQuestionReplay(text) {
  if (!voiceOn) return;
  cancelTTS();
  try {
    const u = new SpeechSynthesisUtterance(text);
    if (ttsVoice) u.voice = ttsVoice;
    u.lang='en-US'; u.rate=0.92;
    speechSynthesis.speak(u);
  } catch(e) { console.warn('TTS replay:',e); }
}

function toggleAnswerTTS() {
  if (answerTTSPlaying) { cancelTTS(); return; }
  const text = el.modelAnswerText.textContent;
  if (!text) return;
  answerTTSPlaying = true;
  updateListenBtn();
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (ttsVoice) u.voice = ttsVoice;
    u.lang='en-US'; u.rate=0.9;
    u.onend = u.onerror = () => { answerTTSPlaying=false; updateListenBtn(); };
    speechSynthesis.speak(u);
  } catch(e) { answerTTSPlaying=false; updateListenBtn(); }
}

function updateListenBtn() {
  el.btnListenAnswer.textContent    = answerTTSPlaying ? '⏹ Stop' : '🔊 Listen';
  el.btnListenAnswer.classList.toggle('playing', answerTTSPlaying);
}

// ─── DATA LOADING (AUTO) ──────────────────────────────────────────────────────
/**
 * Thứ tự:
 *   1. Sheet ID được cấu hình → cache còn mới (< TTL) → dùng cache
 *   2. Sheet ID được cấu hình → fetch Sheet mới
 *   3. fallback localStorage → questions.json → DEFAULT
 */
async function loadData() {
  const cfg = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : {};
  const sheetId = (cfg.SHEET_ID || '').trim();

  el.questionText.textContent = 'Loading questions…';

  if (sheetId) {
    // Hiển thị nút Sync để người dùng có thể force refresh
    el.syncRow.classList.remove('hidden');

    // Kiểm tra cache còn tươi không
    const cachedAt  = Number(localStorage.getItem(LS_SYNCED_AT) || 0);
    const cacheAge  = Date.now() - cachedAt;
    const cacheOK   = cacheAge < SYNC_TTL_MS;
    const cached    = tryLoadCache();

    if (cacheOK && cached) {
      questions = cached;
      updateSourceInfo(`${questions.length} câu hỏi (Google Sheet · cập nhật ${formatAge(cacheAge)} trước)`);
      startApp();
      // Fetch ngầm để cập nhật cache cho lần sau
      silentSyncSheet(sheetId, cfg.SHEET_GID || '0');
      return;
    }

    // Cache cũ hoặc không có → fetch ngay, hiện loading
    try {
      const fetched = await fetchSheet(sheetId, cfg.SHEET_GID || '0');
      questions = fetched;
      saveCache(fetched);
      updateSourceInfo(`${questions.length} câu hỏi (Google Sheet · vừa cập nhật)`);
      startApp();
      return;
    } catch(err) {
      console.warn('Sheet fetch failed:', err);
      // Fallback sang cache cũ nếu có
      if (cached) {
        questions = cached;
        updateSourceInfo(`${questions.length} câu hỏi (cache · không kết nối được Sheet)`);
        startApp();
        return;
      }
    }
  }

  // Không có Sheet ID hoặc mọi fetch thất bại → fallback chain
  await fallbackLoad();
}

async function fallbackLoad() {
  // localStorage
  const cached = tryLoadCache();
  if (cached) {
    questions = cached;
    updateSourceInfo(`${questions.length} câu hỏi (đã lưu trước đó)`);
    startApp();
    return;
  }
  // questions.json
  try {
    const r = await fetch('questions.json');
    const d = await r.json();
    const arr = d.questions || d;
    if (validateQ(arr)) {
      questions = arr;
      updateSourceInfo(`${questions.length} câu hỏi (questions.json)`);
      startApp();
      return;
    }
  } catch(_) {}
  // DEFAULT
  questions = DEFAULT_QUESTIONS;
  updateSourceInfo(`${questions.length} câu hỏi (mặc định)`);
  startApp();
}

// Fetch silent (không block UI, không hiện lỗi)
async function silentSyncSheet(sheetId, gid) {
  try {
    const fetched = await fetchSheet(sheetId, gid);
    saveCache(fetched);
    // Không reload questions đang chạy – áp dụng lần sau
    console.log('Background sync done:', fetched.length, 'questions cached');
  } catch(_) {}
}

// Fetch có thể throw
async function fetchSheet(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const csv = await res.text();
  const arr  = parseCSV(csv);
  if (!validateQ(arr)) throw new Error('Invalid sheet structure. Check column order: id, category, question, answer.');
  return arr;
}

function tryLoadCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return validateQ(arr) ? arr : null;
  } catch(_) { return null; }
}

function saveCache(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
  localStorage.setItem(LS_SYNCED_AT, String(Date.now()));
}

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line, i) => {
    const cols = splitCSVLine(line);
    return {
      id:       Number(cols[0]) || (i + 1),
      category: (cols[1] || '').trim(),
      question: (cols[2] || '').trim(),
      answer:   (cols[3] || '').trim(),
    };
  }).filter(q => q.question && q.answer);
}

function splitCSVLine(line) {
  const cols = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
    else if (c===',' && !inQ) { cols.push(cur); cur=''; }
    else cur += c;
  }
  cols.push(cur);
  return cols;
}

function validateQ(arr) {
  return Array.isArray(arr) && arr.length > 0 &&
    arr.every(q => q.id !== undefined &&
      typeof q.category === 'string' &&
      typeof q.question === 'string' && q.question.trim() &&
      typeof q.answer   === 'string' && q.answer.trim());
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatAge(ms) {
  if (ms < 60000) return 'vài giây';
  if (ms < 3600000) return `${Math.floor(ms/60000)} phút`;
  return `${Math.floor(ms/3600000)} giờ`;
}

function updateSourceInfo(msg) { el.dataSourceInfo.textContent = msg; }

// ─── QUESTION FLOW ────────────────────────────────────────────────────────────
function startApp() {
  if (questions.length === 0) {
    showFlash('Không có câu hỏi. Kiểm tra lại cấu hình Sheet hoặc import file JSON.', 'error');
    return;
  }
  currentIndex = 0;
  showQuestion();
}

function showQuestion() {
  cancelTTS();
  if (currentTTSHandle) { currentTTSHandle.cancel(); currentTTSHandle = null; }
  stopCountdown();
  resetRecording();

  sessionToken++;
  const myToken = sessionToken;
  const q = questions[currentIndex];

  el.categoryTag.textContent   = q.category;
  el.questionText.textContent  = q.question;
  el.progressFill.style.width  = `${((currentIndex + 1) / questions.length) * 100}%`;
  el.progressLabel.textContent = `${currentIndex + 1} / ${questions.length}`;

  setState(STATES.QUESTION);

  if (voiceOn) {
    el.btnMic.disabled = true;
    currentTTSHandle = speakQuestionWithCallback(q.question, () => {
      if (sessionToken !== myToken) return;
      currentTTSHandle = null;
      el.btnMic.disabled = false;
      startCountdown();
    });
  } else {
    el.btnMic.disabled = false;
    startCountdown();
  }
}

// ─── COUNTDOWN ────────────────────────────────────────────────────────────────
function startCountdown() {
  questionShownAt = performance.now();
  setState(STATES.COUNTDOWN);
  renderCountdown(COUNTDOWN_MS);
  countdownInterval = setInterval(() => {
    const rem = Math.max(0, COUNTDOWN_MS - (performance.now() - questionShownAt));
    renderCountdown(rem);
    if (rem <= 0) { stopCountdown(); onTimeout(); }
  }, 80);
}

function stopCountdown() {
  if (countdownInterval !== null) { clearInterval(countdownInterval); countdownInterval = null; }
}

function renderCountdown(ms) {
  el.countdownNumber.textContent = Math.max(0, Math.ceil(ms / 1000));
  el.ringProgress.style.strokeDashoffset = RING_C * (1 - ms / COUNTDOWN_MS);
  const urgent = ms <= 2000;
  el.countdownNumber.classList.toggle('urgent', urgent);
  el.ringProgress.classList.toggle('urgent', urgent);
}

function onTimeout() { setState(STATES.TIMEOUT); }

// ─── RECORDING ────────────────────────────────────────────────────────────────
async function startRecording() {
  if (state !== STATES.COUNTDOWN) return;
  if ((performance.now() - questionShownAt) > COUNTDOWN_MS) { onTimeout(); return; }
  stopCountdown();
  cancelTTS();

  if (!navigator.mediaDevices?.getUserMedia) {
    showFlash('Trình duyệt không hỗ trợ ghi âm. Dùng Chrome hoặc Firefox.', 'error');
    setState(STATES.TIMEOUT); return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch(err) {
    const msg = err.name === 'NotAllowedError' ? 'Cần cấp quyền microphone để ghi âm.'
              : err.name === 'NotFoundError'   ? 'Không tìm thấy microphone.'
              : 'Lỗi microphone: ' + err.message;
    showFlash(msg, 'error'); setState(STATES.TIMEOUT); return;
  }
  if (!window.MediaRecorder) {
    showFlash('Trình duyệt không hỗ trợ ghi âm.', 'error');
    setState(STATES.TIMEOUT); return;
  }
  audioChunks = [];
  try { mediaRecorder = new MediaRecorder(stream); }
  catch(e) { showFlash('Lỗi ghi âm: ' + e.message, 'error'); setState(STATES.TIMEOUT); return; }

  mediaRecorder.ondataavailable = e => { if (e.data?.size > 0) audioChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    recordingBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioURL = URL.createObjectURL(recordingBlob);
    el.audioPlayer.src = audioURL;
    stream.getTracks().forEach(t => t.stop());
    setState(STATES.RECORDED);
  };
  mediaRecorder.start();
  setState(STATES.RECORDING);
}

function stopRecording() {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
}

function resetRecording() {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  mediaRecorder = null; audioChunks = [];
  if (audioURL) { URL.revokeObjectURL(audioURL); audioURL = null; }
  recordingBlob = null;
  el.audioPlayer.src = ''; el.audioPlayer.load();
}

// ─── STATE MACHINE ────────────────────────────────────────────────────────────
function setState(s) {
  state = s;
  hide(el.countdownSection); hide(el.micSection);
  hide(el.recordingSection); hide(el.recordedSection);
  hide(el.modelAnswerSection); hide(el.timeoutSection);

  switch(s) {
    case STATES.QUESTION:
      show(el.countdownSection); show(el.micSection);
      renderCountdown(COUNTDOWN_MS);
      el.countdownLabel.textContent = 'listening to question…';
      break;
    case STATES.COUNTDOWN:
      show(el.countdownSection); show(el.micSection);
      el.btnMic.disabled = false;
      el.countdownLabel.textContent = 'seconds to start speaking';
      break;
    case STATES.RECORDING:
      show(el.recordingSection); break;
    case STATES.RECORDED:
      show(el.recordedSection); break;
    case STATES.MODEL_ANSWER:
      show(el.recordedSection); show(el.modelAnswerSection);
      el.modelAnswerText.textContent = questions[currentIndex].answer;
      answerTTSPlaying = false; updateListenBtn();
      if (voiceOn) setTimeout(() => { if(state===STATES.MODEL_ANSWER) toggleAnswerTTS(); }, 300);
      break;
    case STATES.TIMEOUT:
      show(el.timeoutSection); break;
  }
}

function show(e) { e.classList.remove('hidden'); }
function hide(e) { e.classList.add('hidden'); }

// ─── EVENTS ───────────────────────────────────────────────────────────────────
function bindEvents() {
  el.btnVoice.addEventListener('click', () => {
    voiceOn = !voiceOn; applyVoiceUI();
    if (!voiceOn) cancelTTS();
  });
  el.btnReplay.addEventListener('click',        () => speakQuestionReplay(questions[currentIndex].question));
  el.btnMic.addEventListener('click',           startRecording);
  el.btnStop.addEventListener('click',          stopRecording);
  el.btnShowAnswer.addEventListener('click',    () => setState(STATES.MODEL_ANSWER));
  el.btnListenAnswer.addEventListener('click',  toggleAnswerTTS);
  el.btnTryAgain.addEventListener('click',      showQuestion);
  el.btnTryAgainTimeout.addEventListener('click', showQuestion);
  el.btnNext.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % questions.length;
    showQuestion();
  });
  el.fileInput.addEventListener('change', handleFileImport);
  el.btnReset.addEventListener('click', () => {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_SYNCED_AT);
    questions = DEFAULT_QUESTIONS;
    updateSourceInfo(`${questions.length} câu hỏi (mặc định)`);
    showFlash('Đã reset về câu hỏi mặc định.', 'success');
    currentIndex = 0; showQuestion();
  });
  // Nút Sync thủ công
  el.btnSync.addEventListener('click', async () => {
    const cfg = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : {};
    const sheetId = (cfg.SHEET_ID || '').trim();
    if (!sheetId) return;
    el.btnSync.disabled = true;
    el.btnSync.textContent = '⏳ Đang tải…';
    try {
      const fetched = await fetchSheet(sheetId, cfg.SHEET_GID || '0');
      questions = fetched;
      saveCache(fetched);
      updateSourceInfo(`${questions.length} câu hỏi (Google Sheet · vừa cập nhật)`);
      showFlash(`✓ Đã sync ${questions.length} câu hỏi.`, 'success');
      currentIndex = 0; showQuestion();
    } catch(err) {
      showFlash('Sync thất bại: ' + err.message, 'error');
    } finally {
      el.btnSync.disabled = false;
      el.btnSync.textContent = '⟳ Sync từ Google Sheet';
    }
  });
}

function applyVoiceUI() {
  el.btnVoice.textContent = voiceOn ? '🔊 Voice ON' : '🔇 Voice OFF';
  el.btnVoice.classList.toggle('on', voiceOn);
}

// ─── FILE IMPORT ──────────────────────────────────────────────────────────────
function handleFileImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      const arr  = Array.isArray(data) ? data : data.questions;
      if (!arr || !validateQ(arr)) throw new Error('Cần có fields: id, category, question, answer.');
      questions = arr;
      saveCache(arr);
      updateSourceInfo(`${questions.length} câu hỏi (import file)`);
      showFlash(`✓ Import ${questions.length} câu hỏi thành công.`, 'success');
      currentIndex = 0; showQuestion();
    } catch(err) { showFlash('File không hợp lệ: ' + err.message, 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ─── FLASH ────────────────────────────────────────────────────────────────────
let flashTimer = null;
function showFlash(msg, type='error') {
  el.flashMsg.textContent = msg;
  el.flashMsg.className   = type==='success' ? 'success-msg' : 'error-msg';
  el.flashMsg.classList.remove('hidden');
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.flashMsg.classList.add('hidden'), 6000);
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
