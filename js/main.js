/* MLN111 – Chương 3 · tương tác chính */
(function () {
  "use strict";

  /* ---------- Menu mục lục ---------- */
  var menuBtn = document.getElementById("menuBtn");
  var menuPanel = document.getElementById("menuPanel");

  function closeMenu() {
    menuBtn.classList.remove("is-open");
    menuPanel.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
  }

  menuBtn.addEventListener("click", function () {
    var open = menuPanel.classList.toggle("is-open");
    menuBtn.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  });

  menuPanel.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  document.addEventListener("click", function (e) {
    if (
      menuPanel.classList.contains("is-open") &&
      !menuPanel.contains(e.target) &&
      !menuBtn.contains(e.target)
    ) {
      closeMenu();
    }
  });

  /* ---------- Scrollspy cho nav nhanh ---------- */
  var spyLinks = document.querySelectorAll(".top-nav__link[data-spy]");
  var spySections = [];
  spyLinks.forEach(function (link) {
    var sec = document.getElementById(link.getAttribute("data-spy"));
    if (sec)
      spySections.push({
        id: link.getAttribute("data-spy"),
        el: sec,
        link: link,
      });
  });

  function setActive(id) {
    spyLinks.forEach(function (l) {
      l.classList.remove("is-active");
    });
    var hit = spySections.find(function (s) {
      return s.id === id;
    });
    if (hit) hit.link.classList.add("is-active");
  }

  if ("IntersectionObserver" in window && spySections.length) {
    var spyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    spySections.forEach(function (s) {
      spyObserver.observe(s.el);
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  /* ---------- Nút "Vào phần Luyện Tập" (chưa có trang luyện tập) ---------- */
  var practiceBtn = document.getElementById("practiceBtn");
  if (practiceBtn) {
    practiceBtn.addEventListener("click", function (e) {
      e.preventDefault();
      practiceBtn.classList.add("is-wip");
      setTimeout(function () {
        practiceBtn.classList.remove("is-wip");
      }, 900);
    });
  }
})();

const backToTop = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
  if (window.scrollY > 400) {
    backToTop.classList.add("is-visible");
  } else {
    backToTop.classList.remove("is-visible");
  }
});

backToTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});
