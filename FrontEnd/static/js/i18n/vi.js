// Every UI string lives here. To add a language, copy this file and swap the
// import in the modules (or re-export from an index).

const CASE_NAMES = {
  gallery: "Phòng tranh",
  harbor: "Bến cảng",
  market: "Khu chợ",
  museum: "Bảo tàng",
  observatory: "Đài thiên văn",
  theatre: "Nhà hát",
  syndicate: "Băng nhóm",
  demo: "Bản xem thử",
  case: "Vụ án",
};

const LEVELS = { easy: "Dễ", medium: "Vừa", hard: "Khó", expert: "Chuyên gia", demo: "Xem thử", case: "Xem thử" };

export const T = {
  appTitle: "Griductive — Bảng điều tra",

  // Verdicts
  innocent: "Vô tội",
  criminal: "Tội phạm",
  unknown: "chưa xác định",
  verdictName: (isCriminal) => (isCriminal ? "Tội phạm" : "Vô tội"),
  verdictLower: (isCriminal) => (isCriminal ? "là tội phạm" : "vô tội"),

  // Cases
  caseName: (slug) => CASE_NAMES[slug] ?? slug.replace(/(^|-)(\w)/g, (_, dash, ch) => (dash ? " " : "") + ch.toUpperCase()),
  levelName: (level) => LEVELS[level] ?? level,
  casePicker: "Chọn vụ án",
  caseLoaded: (name) => `Đã mở vụ án “${name}”.`,
  noPuzzles: "Backend chưa có vụ án nào.",
  solvedMark: "Đã phá án",

  // Top bar
  timer: "Thời gian",
  mistakes: "Lỗi",
  hints: "Gợi ý",
  offline: "Ngoại tuyến · chỉ xem",
  offlineTitle: "Không kết nối được backend. Bấm để thử lại.",
  needsLive: "Cần kết nối backend để dùng chức năng này.",
  themeToggle: "Đổi giao diện sáng / tối",
  help: "Cách chơi",
  settings: "Cài đặt",

  // Board
  boardLabel: "Bảng nghi phạm",
  progress: (done, total) => [`${done}/${total}`, " đã xác định"],
  cellLabel: (pos, name, job, status, clues) =>
    `${pos}, ${name}, ${job}, ${status}${clues ? `. Lời khai: ${clues}` : ""}`,
  verdictFor: (name) => `Phán quyết cho ${name}`,
  hintBtn: "Gợi ý",
  autoBtn: "AI tự giải",
  autoWorking: "AI đang giải…",
  restartBtn: "Chơi lại từ đầu",

  // Feedback
  correctTitle: "Chính xác!",
  correctBody: (name, isCriminal) => `${name} ${isCriminal ? "là tội phạm" : "vô tội"}.`,
  notProvableTitle: "Chưa đủ căn cứ (+1 lỗi)",
  notProvableBody: (name) => `Cả hai khả năng của ${name} vẫn hợp lệ với các manh mối đang mở.`,
  contradictedTitle: "Mâu thuẫn (+1 lỗi)",
  contradictedBody: (name) => `Manh mối buộc ${name} phải là điều ngược lại.`,
  alreadyProved: (name) => `${name} đã có phán quyết rồi.`,
  selectFirst: "Hãy chọn một nghi phạm chưa xác định trước.",
  restarted: "Đã đưa vụ án về trạng thái ban đầu.",
  retrying: "Đang thử kết nối lại…",
  reconnected: "Đã kết nối backend.",
  stillOffline: "Vẫn chưa kết nối được. Backend đã chạy chưa?",
  close: "Đóng",

  // Hint
  hintStage1Title: "Có thể chứng minh",
  hintStage1Body: (label) => `${label} đã kết luận được. Bấm Gợi ý lần nữa để xem phán quyết.`,
  hintStage2Title: (name, isCriminal) => `${name} ${isCriminal ? "là tội phạm" : "vô tội"}`,
  hintReason: (name, refuted) => `Nếu ${name} ${refuted ? "là tội phạm" : "vô tội"} thì mâu thuẫn với manh mối.`,
  hintSolved: "Không còn gì để chứng minh: mọi nghi phạm đã có phán quyết.",
  hintUnknown: "Chưa có phán quyết nào bị buộc bởi các manh mối đang mở.",
  inconsistentTitle: "Manh mối mâu thuẫn",
  inconsistentBody: "Các manh mối đang mở mâu thuẫn với nhau, nên vụ án này không có lời giải.",

  // Auto solve / playback
  aiTag: "AI",
  stuck: (n) => `AI dừng sau ${n} bước: chưa có phán quyết nào khác bị buộc.`,
  playbackStep: (i, n) => `Bước ${i}/${n}`,
  pbRestart: "Phát lại từ đầu",
  pbPause: "Tạm dừng",
  pbResume: "Tiếp tục",
  pbNext: "Bước tiếp theo",
  pbEnd: "Bỏ qua đến cuối",
  pbSpeed: "Tốc độ phát lại",
  takenOver: (n) => `Đã dừng AI sau ${n} bước. Bạn chơi tiếp từ đây.`,
  winAssisted: (n) => `Bạn phá án với AI giải giúp ${n} ô.`,

  // Rail
  tabClues: "Hồ sơ",
  tabAi: "AI",
  railLabel: "Hồ sơ vụ án và nhật ký AI",
  hideSpent: "Ẩn manh mối đã dùng hết",
  cluesCount: (open, total) => `${open}/${total} còn hiệu lực`,
  publicClue: "Manh mối công khai",
  tagNew: "Mới",
  tagSpent: "Đã dùng hết",
  tagPinned: "Đang ghim",
  noClues: ["Chưa có manh mối nào", "Kết luận đúng một nghi phạm để mở lời khai của họ."],
  noRefs: "Không nêu tên ô cụ thể",

  // Journal
  journalEmpty: ["Chưa có bước suy luận nào", "Bấm “AI tự giải” hoặc “Gợi ý” để xem bộ giải SAT (DPLL) kết luận từng ô như thế nào."],
  journalBase: "Các manh mối đang mở nhất quán với nhau.",
  stepNo: (n) => `Bước ${String(n).padStart(2, "0")}`,
  fromHint: "Gợi ý",
  fromAi: "AI",
  assume: (name, isCriminal) => `Giả sử ${name} ${isCriminal ? "là tội phạm" : "vô tội"}`,
  sat: "Hợp lệ",
  unsat: "Mâu thuẫn",
  conclusion: (isCriminal) => `⇒ Chỉ còn một khả năng: ${isCriminal ? "Tội phạm" : "Vô tội"}`,
  openClues: (n) => `Manh mối đang mở: ${n}`,
  unlocked: (names) => `Mở thêm lời khai của ${names}`,
  details: (n) => `Chi tiết: ${n} lần kiểm tra SAT`,
  baseline: "Không giả sử gì",
  satRaw: "SAT",
  unsatRaw: "UNSAT",

  // Win
  winStamp: "Vụ án khép lại",
  winByPlayer: "Mọi phán quyết đều được chứng minh, không hề đoán mò.",
  winByAi: "Giải bởi AI: mỗi phán quyết đều bị manh mối buộc phải thế.",
  winAgain: "Chơi lại",
  winNext: "Vụ án tiếp theo",
  stars: (n) => `${n} trên 3 sao`,

  // Errors
  errorTitle: "Có lỗi xảy ra",
  backendDown: "Không kết nối được backend",
  requestFailed: (status) => `Yêu cầu thất bại (${status})`,
  retry: "Thử lại",
  ok: "Đã hiểu",

  // Help
  helpTitle: "Cách chơi",
  rulesTitle: "Luật chơi",
  rules: [
    "Mỗi người trên bảng hoặc Vô tội, hoặc là Tội phạm.",
    "Mọi manh mối đều đúng, và chỉ có đúng một đáp án thoả tất cả.",
    "Chỉ được kết luận khi manh mối buộc điều đó. Bảng không nhận phán quyết đoán mò.",
    "Kết luận đúng thì thẻ lật và người đó khai thêm manh mối mới.",
    "Sai không mất mạng, chỉ bị tính lỗi.",
  ],
  tipsTitle: "Mẹo",
  tips: [
    "Bắt đầu từ manh mối nhắc tới ít người nhất.",
    "Sau mỗi phán quyết, đọc lại toàn bộ hồ sơ: giá trị mới thường nằm ở chỗ khác.",
    "Đọc kỹ từng chữ: “đúng một” khác “ít nhất một”.",
    "Tên và nghề nghiệp không phải manh mối, trừ khi lời khai nhắc tới.",
  ],
  keysTitle: "Phím tắt",
  keys: [
    [["←", "↑", "→", "↓"], "Di chuyển giữa các nghi phạm"],
    [["I"], "Phán quyết: Vô tội"],
    [["C"], "Phán quyết: Tội phạm"],
    [["H"], "Gợi ý (bấm hai lần để xem phán quyết)"],
    [["N"], "Vụ án tiếp theo"],
    [["Esc"], "Bỏ chọn / đóng hộp thoại"],
    [["?"], "Mở bảng này"],
  ],
  replayTutorial: "Xem lại hướng dẫn",

  // Settings
  settingsTitle: "Cài đặt",
  setSound: ["Âm thanh", "Tiếng lật thẻ, sai và thắng."],
  setMotion: ["Giảm chuyển động", "Tắt lật thẻ, rung và pháo giấy."],
  setLight: ["Giao diện sáng", "Tắt để dùng giao diện tối."],
  setSpeed: ["Tốc độ AI tự giải", "Áp dụng cho lần phát lại kế tiếp."],

  // Tutorial
  tutTitle: "Hướng dẫn nhanh",
  tutSkip: "Bỏ qua",
  tutNext: "Tiếp tục",
  tutStart: "Bắt đầu chơi",
  tutSteps: [
    "Mỗi người <strong>hoặc Vô tội, hoặc là Tội phạm</strong>. Mọi manh mối đều đúng. Lan đã được xác định vô tội nên cô ấy khai một manh mối.",
    "Chỉ được kết luận khi manh mối <strong>buộc</strong> điều đó. Lan nói Minh vô tội: hãy <strong>chọn Minh</strong> rồi bấm <strong>Vô tội</strong>.",
    "Thẻ lật và Minh khai thêm. Giờ đến lượt bạn: <strong>kết luận nốt Hà và Tuấn</strong>.",
    "Xuất sắc! Bạn đã phá án mà không cần đoán. Trong ván thật, bên phải là <strong>Hồ sơ</strong> manh mối và nhật ký <strong>AI</strong>.",
  ],
  tutPublic: "Trong 4 người có đúng 1 tội phạm.",
  tutLan: "Minh (B1) vô tội.",
  tutMinh: "Hà (A2) vô tội.",
  tutPickMinh: "Hãy chọn Minh (B1) trước.",
  tutNotYet: "Chưa đủ căn cứ: cả hai khả năng vẫn hợp lệ.",
  tutWrong: "Mâu thuẫn với manh mối. Thử đọc lại nhé.",
  tutRight: "Chính xác!",
};
