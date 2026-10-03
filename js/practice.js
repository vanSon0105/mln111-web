/* ============================================================
   MLN111 – Chương 3 · Trang luyện tập flashcard
   - Nguồn câu hỏi: ques.md (fetch + parse ngay trên trình duyệt)
   - Tiến độ học thuộc: localStorage
   ============================================================ */
(function () {
  "use strict";

  var SOURCE = "ques.md";
  var STORAGE_KEY = "mln111-c3-practice-v1";

  var STATUS_KNOWN = "known";
  var STATUS_LEARNING = "learning";

  // Câu chúc mừng khi trả lời đúng (bốc ngẫu nhiên cho đỡ nhàm)
  var CONGRATS = [
    "Chính xác! 🎉",
    "Tuyệt vời! 🎉",
    "Chuẩn không cần chỉnh! 🎉",
    "Quá đỉnh! 🎉",
    "Xuất sắc! 🎉",
    "Đúng rồi, giỏi lắm! 🎉"
  ];

  /* ------------------------------------------------------------
     DOM helper
     ------------------------------------------------------------ */
  function $(id) {
    return document.getElementById(id);
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function statusLabel(status) {
    if (status === STATUS_KNOWN) return "đã thuộc";
    if (status === STATUS_LEARNING) return "cần học lại";
    return "chưa học";
  }

  /* ------------------------------------------------------------
     Trạng thái
     ------------------------------------------------------------ */
  var state = {
    questions: [],
    order: [], // vị trí trong state.questions, theo thứ tự hiển thị
    pos: 0,
    answered: null, // { picked, correct } của câu đang hiện — null khi chưa trả lời
    onlyUnlearned: false,
    shuffle: false,
    ranks: {}, // num -> điểm xáo trộn (giữ ổn định giữa các lần render)
    progress: {} // num -> { s: "known"|"learning", n: số lần ôn, t: thời điểm }
  };

  /* ------------------------------------------------------------
     PARSE ques.md

     Định dạng được hỗ trợ:
       Câu 1. Nội dung câu hỏi?
       A. Lựa chọn
       B. Lựa chọn
       Đáp án: B                (tuỳ chọn – có thể nằm ở khối ĐÁP ÁN cuối file)
       Giải thích: ...          (tuỳ chọn)

     Khối cuối file:
       ĐÁP ÁN
       1.B
       2.D
     ------------------------------------------------------------ */
  var RE_QUESTION = /^\s*C[âa]u\s+(\d+)\s*[.:)]\s*(.+)$/;
  var RE_OPTION = /^\s*([A-Da-d])\s*[.)]\s+(\S.*)$/;
  var RE_INLINE_ANSWER =
    /^\s*[Đđ][áÁaA]p\s+[áÁaA]n(?:\s+[đĐ][úÚuU]ng)?\s*:\s*([A-Da-d])\b/;
  var RE_EXPLAIN = /^\s*Gi[ảa]i\s+th[íi]ch\s*:\s*(.*)$/;
  var RE_KEY_HEADING = /^\s*[Đđ][áÁaA]p\s+[áÁaA]n\s*$/;
  var RE_KEY_LINE = /^\s*(\d+)\s*[.:]\s*([A-Da-d])\s*$/;

  function parseQuestions(md) {
    var lines = String(md).replace(/\r\n?/g, "\n").split("\n");
    var questions = [];
    var answerKey = {};
    var current = null;
    var paragraph = null; // "question" | "explanation" | null

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();

      if (!line) {
        paragraph = null;
        continue;
      }

      var mQ = line.match(RE_QUESTION);
      if (mQ) {
        current = {
          num: parseInt(mQ[1], 10),
          text: mQ[2].trim(),
          options: [],
          answer: null,
          explanation: ""
        };
        questions.push(current);
        paragraph = "question";
        continue;
      }

      if (RE_KEY_HEADING.test(line)) {
        current = null; // từ đây là khối đáp án, không thuộc câu hỏi nào
        paragraph = null;
        continue;
      }

      var mK = line.match(RE_KEY_LINE);
      if (mK) {
        answerKey[parseInt(mK[1], 10)] = mK[2].toUpperCase();
        paragraph = null;
        continue;
      }

      if (!current) continue;

      var mA = line.match(RE_INLINE_ANSWER);
      if (mA) {
        current.answer = mA[1].toUpperCase();
        paragraph = null;
        continue;
      }

      var mE = line.match(RE_EXPLAIN);
      if (mE) {
        current.explanation = mE[1].trim();
        paragraph = "explanation";
        continue;
      }

      var mO = line.match(RE_OPTION);
      if (mO) {
        current.options.push({
          letter: mO[1].toUpperCase(),
          text: mO[2].trim()
        });
        paragraph = null;
        continue;
      }

      // Dòng nối tiếp của câu hỏi / giải thích (khi bị xuống hàng)
      if (paragraph === "question") {
        current.text += " " + line;
        continue;
      }
      if (paragraph === "explanation") {
        current.explanation += " " + line;
        continue;
      }
      // Còn lại là văn xuôi ngoài lề trong file → bỏ qua
    }

    questions.forEach(function (q) {
      if (!q.answer && answerKey[q.num]) q.answer = answerKey[q.num];
      q.valid = q.options.length >= 2 && !!q.answer;
    });

    return questions;
  }

  /* ------------------------------------------------------------
     Tiến độ (localStorage)
     ------------------------------------------------------------ */
  function loadProgress() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      if (data && typeof data === "object" && data.items) return data.items;
    } catch (err) {
      /* localStorage bị chặn hoặc JSON hỏng → coi như chưa có tiến độ */
    }
    return {};
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: 1, at: new Date().toISOString(), items: state.progress })
      );
    } catch (err) {
      /* chế độ riêng tư có thể chặn ghi → bỏ qua, trang vẫn chạy */
    }
  }

  function statusOf(num) {
    var rec = state.progress[num];
    if (!rec) return null;
    return rec.s === STATUS_KNOWN || rec.s === STATUS_LEARNING ? rec.s : null;
  }

  function mark(num, status) {
    var rec = state.progress[num] || { n: 0 };
    rec.s = status;
    rec.n = (rec.n || 0) + 1;
    rec.t = Date.now();
    state.progress[num] = rec;
    saveProgress();
  }

  function stats() {
    var known = 0;
    var learning = 0;
    state.questions.forEach(function (q) {
      var s = statusOf(q.num);
      if (s === STATUS_KNOWN) known++;
      else if (s === STATUS_LEARNING) learning++;
    });
    return {
      known: known,
      learning: learning,
      idle: state.questions.length - known - learning,
      total: state.questions.length
    };
  }

  /* ------------------------------------------------------------
     Thứ tự hiển thị
     ------------------------------------------------------------ */
  function indexOfNum(num) {
    for (var i = 0; i < state.questions.length; i++) {
      if (state.questions[i].num === num) return i;
    }
    return -1;
  }

  function reshuffleRanks() {
    state.ranks = {};
    state.questions.forEach(function (q) {
      state.ranks[q.num] = Math.random();
    });
  }

  function buildOrder() {
    var list = [];
    state.questions.forEach(function (q, i) {
      if (state.onlyUnlearned && statusOf(q.num) === STATUS_KNOWN) return;
      list.push(i);
    });
    if (state.shuffle) {
      list.sort(function (a, b) {
        return state.ranks[state.questions[a].num] - state.ranks[state.questions[b].num];
      });
    }
    state.order = list;
  }

  function currentQuestion() {
    if (!state.order.length) return null;
    return state.questions[state.order[state.pos]] || null;
  }

  /* ------------------------------------------------------------
     Render
     ------------------------------------------------------------ */
  function renderStats() {
    var s = stats();
    var pct = s.total ? Math.round((s.known / s.total) * 100) : 0;

    $("statPct").textContent = pct + "%";
    $("statKnown").textContent = s.known;
    $("statTotal").textContent = s.total;
    $("statKnownBox").textContent = s.known;
    $("statLearning").textContent = s.learning;
    $("statIdle").textContent = s.idle;

    $("progressFill").style.width = pct + "%";
    $("progressBar").setAttribute("aria-valuenow", String(pct));
  }

  function renderChips() {
    var grid = $("chipGrid");
    var q = currentQuestion();
    grid.innerHTML = "";

    state.questions.forEach(function (item) {
      var status = statusOf(item.num);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      if (status === STATUS_KNOWN) btn.classList.add("chip--known");
      else if (status === STATUS_LEARNING) btn.classList.add("chip--learning");
      if (q && q.num === item.num) btn.classList.add("is-current");
      btn.textContent = item.num;
      btn.title = "Câu " + item.num + " – " + statusLabel(status);
      btn.setAttribute("aria-label", btn.title);
      btn.addEventListener("click", function () {
        goToQuestion(item.num);
      });
      grid.appendChild(btn);
    });
  }

  function renderCard() {
    var q = currentQuestion();

    if (!q) {
      $("cardZone").hidden = true;
      $("doneZone").hidden = false;

      var s = stats();
      var allKnown = s.total > 0 && s.known === s.total;
      $("doneTitle").textContent = allKnown
        ? "Bạn đã thuộc cả " + s.total + " câu!"
        : "Không còn câu nào trong bộ lọc";
      $("doneText").textContent = allKnown
        ? "Tiến độ đã được lưu trên trình duyệt. Bạn có thể đặt lại và học lại từ đầu bất cứ lúc nào."
        : 'Bộ lọc "Chỉ câu chưa thuộc" hiện không còn câu nào. Xem lại tất cả hoặc đặt lại tiến độ để học lại.';

      renderStats();
      renderChips();
      return;
    }

    $("doneZone").hidden = true;
    $("cardZone").hidden = false;

    $("cardCounter").textContent =
      "Thẻ " + (state.pos + 1) + " / " + state.order.length;
    $("cardNum").textContent = "CÂU " + pad2(q.num);
    $("cardQuestion").textContent = q.text;

    // Nhãn trạng thái của câu đang xem
    var status = statusOf(q.num);
    var badge = $("cardStatus");
    badge.className = "card-status card-status--" + (status || "idle");
    badge.textContent = statusLabel(status);

    // Bốn lựa chọn — bấm để trả lời
    var list = $("cardOptions");
    list.innerHTML = "";
    q.options.forEach(function (o) {
      var li = document.createElement("li");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz__option";
      btn.setAttribute("data-letter", o.letter);

      var letter = document.createElement("span");
      letter.className = "quiz__option-letter";
      letter.textContent = o.letter;

      var text = document.createElement("span");
      text.textContent = o.text;

      var mark = document.createElement("span");
      mark.className = "quiz__option-mark";
      mark.setAttribute("aria-hidden", "true");

      btn.appendChild(letter);
      btn.appendChild(text);
      btn.appendChild(mark);
      btn.addEventListener("click", function () {
        selectOption(o.letter);
      });

      li.appendChild(btn);
      list.appendChild(li);
    });

    // Đặt lại khu vực phản hồi cho câu mới
    state.answered = null;
    $("card").classList.remove("is-correct", "is-wrong");
    $("feedback").hidden = true;
    $("verdict").textContent = "";
    $("verdictSub").textContent = "";
    $("cardExplainWrap").hidden = true;
    $("cardExplain").textContent = "";

    renderChips();
  }

  /* ------------------------------------------------------------
     Tương tác
     ------------------------------------------------------------ */
  /* Người dùng bấm chọn một đáp án */
  function selectOption(letter) {
    var q = currentQuestion();
    if (!q || state.answered) return; // mỗi câu chỉ trả lời một lần

    var isCorrect = letter === q.answer;
    state.answered = { picked: letter, correct: isCorrect };

    // Đúng → đã thuộc · Sai → cần học lại
    var newStatus = isCorrect ? STATUS_KNOWN : STATUS_LEARNING;
    mark(q.num, newStatus);

    var badge = $("cardStatus");
    badge.className = "card-status card-status--" + newStatus;
    badge.textContent = statusLabel(newStatus);

    // Tô màu: đáp án đúng luôn xanh, đáp án chọn sai hiện đỏ
    var nodes = $("cardOptions").querySelectorAll(".quiz__option");
    Array.prototype.forEach.call(nodes, function (node) {
      var l = node.getAttribute("data-letter");
      var tick = node.querySelector(".quiz__option-mark");
      if (l === q.answer) {
        node.classList.add("is-correct");
        if (tick) tick.textContent = "✓";
      } else if (l === letter) {
        node.classList.add("is-wrong");
        if (tick) tick.textContent = "✗";
      } else {
        node.classList.add("is-dimmed");
      }
      node.setAttribute("aria-disabled", "true");
    });

    // Viền + hiệu ứng cho cả thẻ
    var card = $("card");
    card.classList.remove("is-correct", "is-wrong");
    card.classList.add(isCorrect ? "is-correct" : "is-wrong");

    // Lời nhắn
    $("verdict").textContent = isCorrect
      ? CONGRATS[Math.floor(Math.random() * CONGRATS.length)]
      : "Chưa đúng rồi!";

    var answerText = "";
    q.options.forEach(function (o) {
      if (o.letter === q.answer) answerText = o.text;
    });

    var sub = $("verdictSub");
    sub.textContent = "";
    sub.appendChild(
      document.createTextNode(
        isCorrect ? "Bạn chọn chính xác " : "Bạn chọn " + letter + ". Đáp án đúng là "
      )
    );
    var strong = document.createElement("strong");
    strong.textContent = q.answer + ". " + answerText;
    sub.appendChild(strong);

    // Giải thích (chỉ một số câu có trong ques.md)
    if (q.explanation) {
      $("cardExplain").textContent = q.explanation;
      $("cardExplainWrap").hidden = false;
    }
    $("feedback").hidden = false;

    renderStats();
    renderChips();
  }

  function go(delta) {
    if (!state.order.length) return;

    var cur = currentQuestion();
    var curNum = cur ? cur.num : null;

    if (state.onlyUnlearned) {
      // Câu vừa trả lời đúng đã rời danh sách → dựng lại thứ tự trước khi đi tiếp
      buildOrder();
      var at = curNum === null ? -1 : state.order.indexOf(indexOfNum(curNum));
      if (at === -1) {
        // Câu hiện tại không còn trong danh sách: câu kế trôi lên đúng vị trí cũ
        if (state.pos >= state.order.length) state.pos = 0;
      } else {
        state.pos = (at + delta + state.order.length) % state.order.length;
      }
    } else {
      state.pos = (state.pos + delta + state.order.length) % state.order.length;
    }

    renderCard();
  }

  function goToQuestion(num) {
    var idx = indexOfNum(num);
    if (idx === -1) return;

    var at = state.order.indexOf(idx);
    if (at === -1) {
      // Câu này đang bị bộ lọc ẩn đi → tắt bộ lọc rồi tìm lại
      state.onlyUnlearned = false;
      syncToggles();
      buildOrder();
      at = state.order.indexOf(idx);
    }
    if (at === -1) return;

    state.pos = at;
    renderCard();
  }

  function syncToggles() {
    $("filterBtn").setAttribute("aria-pressed", String(state.onlyUnlearned));
    $("shuffleBtn").setAttribute("aria-pressed", String(state.shuffle));
  }

  function resetProgress() {
    if (!window.confirm("Xoá toàn bộ tiến độ học thuộc đã lưu?")) return;
    state.progress = {};
    saveProgress();
    state.pos = 0;
    buildOrder();
    renderStats();
    renderCard();
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    // Nút đang focus tự xử lý Enter / Space
    if (tag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
      return;
    }
    if (e.key === "Enter") {
      go(1);
      return;
    }

    // A–D hoặc 1–4 để chọn đáp án
    if (e.key.length !== 1) return;
    var idx = "ABCD".indexOf(e.key.toUpperCase());
    if (idx === -1) idx = "1234".indexOf(e.key);
    if (idx === -1) return;

    var q = currentQuestion();
    if (q && q.options[idx]) selectOption(q.options[idx].letter);
  }

  function bindUI() {
    $("filterBtn").addEventListener("click", function () {
      state.onlyUnlearned = !state.onlyUnlearned;
      state.pos = 0;
      syncToggles();
      buildOrder();
      renderStats();
      renderCard();
    });

    $("shuffleBtn").addEventListener("click", function () {
      state.shuffle = !state.shuffle;
      if (state.shuffle) reshuffleRanks();
      state.pos = 0;
      syncToggles();
      buildOrder();
      renderCard();
    });

    $("resetBtn").addEventListener("click", resetProgress);
    $("doneResetBtn").addEventListener("click", resetProgress);

    $("doneShowAllBtn").addEventListener("click", function () {
      state.onlyUnlearned = false;
      state.pos = 0;
      syncToggles();
      buildOrder();
      renderStats();
      renderCard();
    });

    $("prevBtn").addEventListener("click", function () {
      go(-1);
    });
    $("nextBtn").addEventListener("click", function () {
      go(1);
    });

    document.addEventListener("keydown", onKey);
  }

  /* ------------------------------------------------------------
     Thông báo lỗi khi không đọc được ques.md
     ------------------------------------------------------------ */
  function showError(err) {
    var box = $("loadMsg");
    box.className = "practice-msg practice-msg--error";
    box.innerHTML = "";

    var title = document.createElement("p");
    title.className = "practice-msg__title";
    title.textContent = "Không đọc được ques.md";
    box.appendChild(title);

    var p1 = document.createElement("p");
    p1.textContent =
      "Trang này đọc câu hỏi trực tiếp từ file ques.md, nên cần được mở qua một web server. Mở bằng cách double-click file sẽ bị trình duyệt chặn (lỗi CORS).";
    box.appendChild(p1);

    var p2 = document.createElement("p");
    p2.style.marginTop = "10px";
    p2.textContent = "Cách chạy: mở thư mục project bằng Live Server / Live Preview trong VS Code, hoặc chạy lệnh:";
    box.appendChild(p2);

    var code = document.createElement("p");
    code.style.marginTop = "8px";
    var codeEl = document.createElement("code");
    codeEl.textContent = "python -m http.server 8000";
    code.appendChild(codeEl);
    box.appendChild(code);

    var p3 = document.createElement("p");
    p3.style.marginTop = "10px";
    p3.textContent = "rồi mở http://localhost:8000/practice.html";
    box.appendChild(p3);

    if (err && err.message) {
      var detail = document.createElement("p");
      detail.style.marginTop = "12px";
      detail.style.opacity = "0.7";
      detail.textContent = "Chi tiết kỹ thuật: " + err.message;
      box.appendChild(detail);
    }
  }

  /* ------------------------------------------------------------
     Khởi động
     ------------------------------------------------------------ */
  function init(questions) {
    if (!questions.length) {
      showError(new Error("ques.md không chứa câu hỏi nào theo định dạng «Câu N. …»"));
      return;
    }

    state.questions = questions;
    state.progress = loadProgress();

    var invalid = questions.filter(function (q) {
      return !q.valid;
    });
    if (invalid.length) {
      console.warn(
        "[practice] Câu thiếu lựa chọn hoặc thiếu đáp án:",
        invalid.map(function (q) {
          return q.num;
        })
      );
    }

    reshuffleRanks();
    buildOrder();
    state.pos = 0;

    $("loadMsg").hidden = true;
    $("practiceApp").hidden = false;

    bindUI();
    syncToggles();
    renderStats();
    renderCard();
  }

  function boot() {
    fetch(SOURCE, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
        return res.text();
      })
      .then(function (md) {
        init(parseQuestions(md));
      })
      .catch(showError);
  }

  boot();
})();
