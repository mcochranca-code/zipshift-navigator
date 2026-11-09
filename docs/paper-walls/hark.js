/* Page behaviors for Hark's component library: the nav, the theme toggle, tables and images. style-gates: data */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  root.classList.add("js");
  var LOGO = '<svg width="SIZE" height="SIZE" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path fill="currentColor" d="M25.096 30c-.072 0-.12-.048-.168-.12-4.776-6.384-12.216-10.8-20.736-11.688C4.048 18.168 4 18.096 4 18s.048-.168.192-.192c8.52-.888 15.96-5.304 20.736-11.688.048-.072.096-.12.168-.12s.096.024.168.072A15.02 15.02 0 0 1 31.12 18a15.02 15.02 0 0 1-5.856 11.928c-.072.048-.096.072-.168.072"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function each(a, f) { return (a || []).map(f).join(""); }
  function autoNav() {
    var sections = [].slice.call(doc.querySelectorAll("section[data-nav]"));
    var header = doc.querySelector("header.nav[data-auto]");
    if (header) {
      header.innerHTML = '<nav class="seg" aria-label="Sections">' +
        each(sections, function (s) { return '<a href="#' + esc(s.id) + '">' + esc(s.getAttribute("data-nav")) + "</a>"; }) + "</nav>" +
        '<button class="theme-btn" id="theme-btn" type="button" aria-label="Switch to dark theme"></button>';
    }
    [].slice.call(doc.querySelectorAll(".foot nav[data-auto]")).forEach(function (n) {
      n.innerHTML = '<a href="#top">Top</a>' + each(sections, function (s) { return '<a href="#' + esc(s.id) + '">' + esc(s.getAttribute("data-nav")) + "</a>"; });
    });
    [].slice.call(doc.querySelectorAll(".table-wrap table")).forEach(function (t) {
      var names = [].map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      [].slice.call(t.querySelectorAll("tbody tr")).forEach(function (tr) {
        [].slice.call(tr.children).forEach(function (c, i) {
          if (c.tagName !== "TD") return;
          if (!c.textContent.trim() && !c.querySelector("img, svg")) c.classList.add("is-empty");
          else if (names[i] && !c.hasAttribute("data-label")) c.setAttribute("data-label", names[i]);
        });
      });
    });
    [].slice.call(doc.querySelectorAll(".compare table")).forEach(function (t) {
      t.parentNode.style.setProperty("--compare-cols", t.querySelectorAll("thead th").length);
      [].slice.call(t.querySelectorAll(".compare__media .chip")).forEach(function (chip) {
        chip.closest("th").appendChild(chip);
      });
      [].slice.call(t.querySelectorAll("tbody tr")).forEach(function (tr) {
        var head = tr.querySelector("th"), label = head ? head.textContent.trim() : "";
        [].slice.call(tr.querySelectorAll("td")).forEach(function (td) {
          if (label && !td.hasAttribute("data-label")) td.setAttribute("data-label", label);
        });
      });
    });
    [].slice.call(doc.querySelectorAll(".step__figure img, .band img")).forEach(function (im) {
      var mark = function () { if (im.naturalHeight > im.naturalWidth) im.parentNode.classList.add("is-portrait"); };
      if (im.complete) mark(); else im.addEventListener("load", mark);
    });
    [].slice.call(doc.querySelectorAll(".hark-mark:empty")).forEach(function (m) { m.innerHTML = LOGO.replace(/SIZE/g, m.getAttribute("data-size") || "20"); });
  }

  // Gives each day of plans a toggle and opens the first day. hark-trip.css shows the toggle, and
  // closes the other days, only on a phone.
  function dayToggles() {
    [].slice.call(doc.querySelectorAll(".timeline > li")).forEach(function (day, i) {
      var what = day.querySelector(".timeline__what");
      if (!what || !what.querySelector(".plan") || what.querySelector(".day__toggle")) return;
      var btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "day__toggle";
      var label = function () {
        var open = day.classList.contains("is-open");
        btn.textContent = open ? "Hide details" : "Show details";
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      };
      if (i === 0) day.classList.add("is-open");
      btn.addEventListener("click", function () { day.classList.toggle("is-open"); label(); });
      label();
      what.appendChild(btn);
    });
  }

  function behaviors() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var btn = doc.getElementById("theme-btn"), mq = window.matchMedia("(prefers-color-scheme: dark)");
    try { var saved = localStorage.getItem("hark-theme"); if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved); } catch (e) { /* storage blocked: follow the system theme */ }
    function current() { var t = root.getAttribute("data-theme"); return t === "light" || t === "dark" ? t : (mq.matches ? "dark" : "light"); }
    function label() { if (btn) btn.setAttribute("aria-label", current() === "dark" ? "Switch to light theme" : "Switch to dark theme"); }
    if (btn) btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("hark-theme", next); } catch (e) { /* storage blocked: the choice lasts this visit */ }
      label();
    });
    label();

    var seg = doc.querySelector(".seg");
    if (seg) {
      var links = [].slice.call(seg.querySelectorAll("a"));
      var targets = links.map(function (a) { return doc.getElementById(a.getAttribute("href").slice(1)); });
      var active = -2;
      var reveal = function (i) {
        if (i < 0) return;
        var a = links[i];
        var l = a.offsetLeft - 8, r = a.offsetLeft + a.offsetWidth + 8;
        if (l < seg.scrollLeft || r > seg.scrollLeft + seg.clientWidth) seg.scrollTo({ left: l, behavior: reduce ? "auto" : "smooth" });
      };
      var sync = function (force) {
        var line = window.innerHeight * 0.32, cur = -1;
        targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top <= line) cur = i; });
        if (cur === active && !force) return;
        active = cur;
        links.forEach(function (a, i) { if (i === cur) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
        reveal(cur);
      };
      var ticking = false;
      window.addEventListener("scroll", function () {
        if (ticking) return; ticking = true;
        window.requestAnimationFrame(function () { sync(false); ticking = false; });
      }, { passive: true });
      window.addEventListener("resize", function () { sync(true); }, { passive: true });
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { sync(true); });
      sync(true);
    }

  }

  function start() {
    autoNav();
    dayToggles();
    behaviors();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
  else start();
})();
