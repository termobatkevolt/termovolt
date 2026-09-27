(function () {
  const CFG = window.TV_CONFIG || {};
  const DICT = window.TV_I18N;
  const LANGS = ["sr-Latn", "sr-Cyrl", "de", "en"];
  let lang = pickLanguage();
  let projects = [];

  /* ---------------- jezik ---------------- */
  function pickLanguage() {
    try {
      const saved = localStorage.getItem("tv-lang");
      if (LANGS.includes(saved)) return saved;
    } catch (e) {}
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("de")) return "de";
    if (nav.startsWith("en")) return "en";
    if (nav.startsWith("sr")) return nav.includes("cyrl") ? "sr-Cyrl" : "sr-Latn";
    return CFG.defaultLanguage || "sr-Latn";
  }

  function base() { return lang.startsWith("sr") ? "sr" : lang; }

  // prevod po ključu
  function t(key) {
    const text = (DICT[base()] && DICT[base()][key]) || DICT.sr[key] || "";
    return lang === "sr-Cyrl" ? window.toCyrillic(text) : text;
  }

  // prevod teksta projekta ({sr, de, en})
  function tp(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return lang === "sr-Cyrl" ? window.toCyrillic(obj) : obj;
    const text = obj[base()] || obj.sr || obj.de || obj.en || "";
    return lang === "sr-Cyrl" ? window.toCyrillic(text) : text;
  }

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.title = t("meta.title");
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", t("meta.description"));

    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    document.querySelectorAll(".lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));

    const area = (CFG.areaTranslations && CFG.areaTranslations[base()]) || CFG.area || "";
    document.querySelectorAll(".js-area").forEach(el => { el.textContent = lang === "sr-Cyrl" ? window.toCyrillic(area) : area; });

    buildServiceSelect();
    renderProjects();
  }

  document.querySelectorAll(".lang button").forEach(btn => {
    btn.addEventListener("click", () => {
      lang = btn.dataset.lang;
      try { localStorage.setItem("tv-lang", lang); } catch (e) {}
      applyLanguage();
    });
  });

  /* ---------------- kontakt podaci ---------------- */
  document.querySelectorAll(".js-phone-link").forEach(a => { a.href = "tel:" + (CFG.phoneLink || ""); });
  document.querySelectorAll(".js-phone-text").forEach(a => { a.textContent = CFG.phone || ""; });
  document.querySelectorAll(".js-email-link").forEach(a => { a.href = "mailto:" + CFG.email; a.textContent = CFG.email || ""; });
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------------- mobilni meni ---------------- */
  const menuBtn = document.querySelector(".menu-btn");
  const nav = document.getElementById("main-nav");
  menuBtn.addEventListener("click", () => {
    const open = menuBtn.getAttribute("aria-expanded") !== "true";
    menuBtn.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("open", open);
  });
  nav.addEventListener("click", e => {
    if (e.target.tagName === "A") { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  });

  /* ---------------- razvodna tabla ---------------- */
  const breakers = [...document.querySelectorAll(".breaker")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Pri učitavanju osigurači se uključuju jedan po jedan
  breakers.forEach((b, i) => {
    b.setAttribute("aria-pressed", "false");
    setTimeout(() => { b.classList.add("on"); b.setAttribute("aria-pressed", "true"); }, reduced ? 0 : 500 + i * 140);
  });

  breakers.forEach(b => {
    b.addEventListener("click", () => {
      b.classList.remove("on");
      setTimeout(() => b.classList.add("on"), 260);
      const target = document.getElementById(b.dataset.target);
      if (!target) return;
      setTimeout(() => {
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
        target.classList.add("flash");
        setTimeout(() => target.classList.remove("flash"), 1600);
      }, 420);
    });
  });

  /* ---------------- izbor usluge u formi ---------------- */
  function buildServiceSelect() {
    const sel = document.getElementById("service-select");
    const current = sel.value;
    sel.innerHTML = "";
    const add = (value, label) => { const o = document.createElement("option"); o.value = value; o.textContent = label; sel.appendChild(o); };
    add("", t("form.service.any"));
    for (let i = 1; i <= 9; i++) add("s" + i, t("s" + i + ".title"));
    add("other", t("form.service.other"));
    sel.value = current;
  }

  /* ---------------- projekti ---------------- */
  function loadProjects() {
    fetch("projects.json?v=" + Date.now())
      .then(r => (r.ok ? r.json() : []))
      .then(data => { projects = Array.isArray(data) ? data : []; renderProjects(); })
      .catch(() => { projects = []; renderProjects(); });
  }

  function formatDate(d) {
    if (!d) return "";
    const [y, m] = d.split("-");
    if (!m) return y;
    const locale = { sr: "sr-Latn-RS", de: "de-AT", en: "en-GB" }[base()];
    const s = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(lang === "sr-Cyrl" ? "sr-Cyrl-RS" : locale, { month: "long", year: "numeric" });
    return s;
  }

  function renderProjects() {
    const grid = document.getElementById("project-grid");
    const empty = document.getElementById("projects-empty");
    grid.innerHTML = "";
    const list = projects.filter(p => p.images && p.images.length);
    empty.hidden = list.length > 0;

    list.forEach((p, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "project";
      const cover = p.images[0];
      const meta = [tp(p.location), formatDate(p.date)].filter(Boolean).join(", ");
      const desc = tp(p.description);
      btn.innerHTML = `
        <div class="project-img">
          <img loading="lazy" alt="">
          ${p.images.length > 1 ? `<span class="project-count"></span>` : ""}
        </div>
        <div class="project-body">
          <h3></h3>
          ${meta ? `<p class="project-meta"></p>` : ""}
          ${desc ? `<p class="project-desc"></p>` : ""}
        </div>`;
      btn.querySelector("img").src = cover.thumb || cover.full;
      btn.querySelector("img").alt = tp(p.title);
      btn.querySelector("h3").textContent = tp(p.title);
      if (meta) btn.querySelector(".project-meta").textContent = meta;
      if (desc) btn.querySelector(".project-desc").textContent = desc.length > 160 ? desc.slice(0, 157) + "…" : desc;
      const cnt = btn.querySelector(".project-count");
      if (cnt) {
        const n = p.images.length, few = base() === "sr" && n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
        cnt.textContent = n + " " + t(few ? "projects.photos24" : "projects.photos");
      }
      btn.addEventListener("click", () => openLightbox(idx, 0, list));
      grid.appendChild(btn);
    });
  }

  /* ---------------- pregled slika ---------------- */
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbCap = document.getElementById("lb-caption");
  let lbList = [], lbP = 0, lbI = 0;

  function openLightbox(p, i, list) {
    lbList = list; lbP = p; lbI = i;
    showLb();
    if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
  }
  function showLb() {
    const pr = lbList[lbP];
    const img = pr.images[lbI];
    lbImg.src = img.full;
    lbImg.alt = tp(pr.title);
    lbCap.textContent = tp(pr.title) + (pr.images.length > 1 ? `  (${lbI + 1}/${pr.images.length})` : "");
    const multi = pr.images.length > 1;
    lb.querySelectorAll(".lb-nav").forEach(b => { b.style.visibility = multi ? "visible" : "hidden"; });
  }
  function step(d) {
    const n = lbList[lbP].images.length;
    lbI = (lbI + d + n) % n;
    showLb();
  }
  lb.querySelector(".lb-prev").addEventListener("click", () => step(-1));
  lb.querySelector(".lb-next").addEventListener("click", () => step(1));
  lb.querySelector(".lb-close").addEventListener("click", () => lb.close());
  lb.addEventListener("click", e => { if (e.target === lb) lb.close(); });
  lb.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  let touchX = null;
  lb.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  });

  /* ---------------- kontakt forma ---------------- */
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    if (fd.get("botcheck")) return;
    const name = (fd.get("name") || "").trim();
    const email = (fd.get("email") || "").trim();
    const message = (fd.get("message") || "").trim();
    if (!name || !email || !message || !form.email.checkValidity()) {
      status.className = "form-status err"; status.textContent = t("form.required"); return;
    }
    const serviceLabel = fd.get("service") ? form.service.options[form.service.selectedIndex].text : "-";
    const phone = (fd.get("phone") || "").trim() || "-";

    // Ako ključ za formu još nije upisan, otvara se e-mail program posetioca
    if (!CFG.web3formsKey || CFG.web3formsKey.startsWith("UPISITE")) {
      const body = `${message}\n\n${name}\n${email}\n${phone}\n${serviceLabel}`;
      location.href = `mailto:${CFG.email}?subject=${encodeURIComponent("Upit sa sajta – " + name)}&body=${encodeURIComponent(body)}`;
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = t("form.sending");
    status.className = "form-status"; status.textContent = "";
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: CFG.web3formsKey,
          subject: "Novi upit sa sajta TermoVolt – " + name,
          from_name: "TermoVolt sajt",
          name, email, phone,
          usluga: serviceLabel,
          jezik: lang,
          message
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      form.reset();
      status.className = "form-status ok"; status.textContent = t("form.ok");
    } catch (err) {
      status.className = "form-status err"; status.textContent = t("form.err");
    } finally {
      btn.disabled = false; btn.textContent = t("form.send");
    }
  });

  /* ---------------- start ---------------- */
  applyLanguage();
  loadProjects();
})();
