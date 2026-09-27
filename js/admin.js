/* TermoVolt – administracija projekata
   Slike i projects.json se upisuju direktno u GitHub repozitorijum
   (jedna izmena = jedan commit), a GitHub Pages zatim osveži sajt. */
(function () {
  const $ = id => document.getElementById(id);
  const STORE = "tv-admin";
  const API = "https://api.github.com";
  const FULL_MAX = 1800, THUMB_MAX = 640;

  let session = null;       // {owner, repo, token, branch}
  let projects = [];
  let editingId = null;
  let images = [];          // [{kind:"existing", full, thumb} | {kind:"new", file, url}]

  /* ---------- sesija ---------- */
  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE) || sessionStorage.getItem(STORE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveSession(s, remember) {
    const raw = JSON.stringify(s);
    try {
      localStorage.removeItem(STORE); sessionStorage.removeItem(STORE);
      (remember ? localStorage : sessionStorage).setItem(STORE, raw);
    } catch (e) {}
  }
  function clearSession() {
    try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch (e) {}
    session = null;
  }

  // Na github.io adresi popunjava korisnika i repozitorijum automatski
  function guessRepo() {
    const host = location.hostname;
    if (!host.endsWith(".github.io")) return {};
    const owner = host.split(".")[0];
    const seg = location.pathname.split("/").filter(Boolean)[0] || "";
    const repo = !seg || seg.endsWith(".html") ? host : seg;
    return { owner, repo };
  }

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: {
        Authorization: "Bearer " + session.token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.headers || {})
      }
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).message || ""; } catch (e) {}
      const err = new Error(detail || res.statusText);
      err.status = res.status;
      throw err;
    }
    const type = res.headers.get("content-type") || "";
    return type.includes("json") ? res.json() : res.text();
  }

  async function connect(s) {
    session = s;
    const repo = await gh(`/repos/${s.owner}/${s.repo}`);
    if (!repo.permissions || !repo.permissions.push) {
      const e = new Error("Token nema dozvolu za izmenu ovog repozitorijuma."); e.status = 403; throw e;
    }
    session.branch = repo.default_branch;
  }

  async function fetchProjects() {
    try {
      const txt = await gh(`/repos/${session.owner}/${session.repo}/contents/projects.json?ref=${session.branch}&t=${Date.now()}`, {
        headers: { Accept: "application/vnd.github.raw+json" }
      });
      const data = typeof txt === "string" ? JSON.parse(txt || "[]") : txt;
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (e.status === 404) return [];
      throw e;
    }
  }

  // Jedan commit sa više fajlova: files = [{path, base64 | text}], deletes = [path]
  async function commit(files, deletes, message, retry = true) {
    const R = `/repos/${session.owner}/${session.repo}`;
    const ref = await gh(`${R}/git/ref/heads/${session.branch}`);
    const parentSha = ref.object.sha;
    const parent = await gh(`${R}/git/commits/${parentSha}`);

    const tree = [];
    for (const f of files) {
      const blob = await gh(`${R}/git/blobs`, {
        method: "POST",
        body: JSON.stringify(f.base64 !== undefined ? { content: f.base64, encoding: "base64" } : { content: f.text, encoding: "utf-8" })
      });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    for (const p of deletes) tree.push({ path: p, mode: "100644", type: "blob", sha: null });

    const newTree = await gh(`${R}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
    const newCommit = await gh(`${R}/git/commits`, {
      method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] })
    });
    try {
      await gh(`${R}/git/refs/heads/${session.branch}`, { method: "PATCH", body: JSON.stringify({ sha: newCommit.sha }) });
    } catch (e) {
      if (retry && e.status === 422) return commit(files, deletes, message, false);
      throw e;
    }
  }

  function rawUrl(path) {
    return `https://raw.githubusercontent.com/${session.owner}/${session.repo}/${session.branch}/${path}`;
  }

  /* ---------- slike ---------- */
  async function loadBitmap(file) {
    if ("createImageBitmap" in window) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) {}
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Slika " + file.name + " ne može da se otvori."));
      img.src = URL.createObjectURL(file);
    });
  }
  function toJpegBase64(src, max, quality) {
    const w = src.width, h = src.height;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality).split(",")[1];
  }

  /* ---------- prikaz ---------- */
  function msg(el, text, kind) { el.textContent = text; el.className = "msg" + (kind ? " " + kind : ""); }

  function showLoggedIn(on) {
    $("connect-card").hidden = on;
    $("session-card").hidden = !on;
    $("editor-card").hidden = !on;
    $("list-card").hidden = !on;
    if (on) $("session-repo").textContent = `${session.owner}/${session.repo}`;
  }

  function renderThumbs() {
    const box = $("thumbs");
    box.innerHTML = "";
    images.forEach((im, i) => {
      const d = document.createElement("div");
      d.className = "thumb" + (i === 0 ? " is-cover" : "");
      const img = document.createElement("img");
      img.src = im.kind === "new" ? im.url : rawUrl(im.thumb || im.full);
      img.alt = "";
      const x = document.createElement("button");
      x.type = "button"; x.className = "x"; x.textContent = "×"; x.setAttribute("aria-label", "Ukloni sliku");
      x.onclick = () => { images.splice(i, 1); renderThumbs(); };
      const cv = document.createElement("button");
      cv.type = "button"; cv.className = "cover-btn";
      cv.textContent = i === 0 ? "Naslovna" : "Postavi kao naslovnu";
      cv.onclick = () => { if (i) { images.unshift(images.splice(i, 1)[0]); renderThumbs(); } };
      d.append(img, x, cv);
      box.appendChild(d);
    });
  }

  function renderList() {
    const ul = $("plist");
    ul.innerHTML = "";
    $("plist-empty").hidden = projects.length > 0;
    projects.forEach(p => {
      const li = document.createElement("li");
      const img = document.createElement("img");
      const c = p.images && p.images[0];
      if (c) img.src = rawUrl(c.thumb || c.full);
      img.alt = "";
      const info = document.createElement("div");
      const h = document.createElement("strong"); h.textContent = (p.title && p.title.sr) || "(bez naziva)";
      const m = document.createElement("div"); m.className = "meta";
      m.textContent = [p.location, p.date, (p.images || []).length + " slika"].filter(Boolean).join(", ");
      info.append(h, m);
      const btns = document.createElement("div"); btns.className = "btns";
      const e = document.createElement("button"); e.type = "button"; e.className = "btn btn-ghost btn-small"; e.textContent = "Izmeni";
      e.onclick = () => startEdit(p.id);
      const del = document.createElement("button"); del.type = "button"; del.className = "btn btn-danger btn-small"; del.textContent = "Obriši";
      del.onclick = () => removeProject(p.id);
      btns.append(e, del);
      li.append(img, info, btns);
      ul.appendChild(li);
    });
  }

  function resetForm() {
    editingId = null;
    images.forEach(im => im.url && URL.revokeObjectURL(im.url));
    images = [];
    $("project-form").reset();
    $("editor-title").textContent = "Novi projekat";
    $("save-btn").textContent = "Objavi projekat";
    $("cancel-edit").hidden = true;
    renderThumbs();
  }

  function startEdit(id) {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    resetForm();
    editingId = id;
    const f = $("project-form");
    f.title_sr.value = (p.title && p.title.sr) || "";
    f.title_de.value = (p.title && p.title.de) || "";
    f.title_en.value = (p.title && p.title.en) || "";
    f.desc_sr.value = (p.description && p.description.sr) || "";
    f.desc_de.value = (p.description && p.description.de) || "";
    f.desc_en.value = (p.description && p.description.en) || "";
    f.location.value = p.location || "";
    f.date.value = p.date || "";
    images = (p.images || []).map(im => ({ kind: "existing", full: im.full, thumb: im.thumb }));
    $("editor-title").textContent = "Izmena projekta";
    $("save-btn").textContent = "Sačuvaj izmene";
    $("cancel-edit").hidden = false;
    renderThumbs();
    $("editor-card").scrollIntoView({ behavior: "smooth" });
  }

  function addFiles(list) {
    [...list].filter(f => f.type.startsWith("image/")).forEach(file => {
      images.push({ kind: "new", file, url: URL.createObjectURL(file) });
    });
    renderThumbs();
  }

  /* ---------- čuvanje ---------- */
  function slug(s) {
    const map = { č: "c", ć: "c", š: "s", ž: "z", đ: "dj" };
    return (s || "projekat").toLowerCase().replace(/[čćšžđ]/g, c => map[c])
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "projekat";
  }

  async function saveProject(e) {
    e.preventDefault();
    const f = $("project-form");
    const out = $("save-msg");
    const titleSr = f.title_sr.value.trim();
    if (!titleSr) return msg(out, "Upišite naziv projekta na srpskom.", "err");
    if (!images.length) return msg(out, "Dodajte bar jednu sliku.", "err");

    const btn = $("save-btn");
    btn.disabled = true;
    try {
      const old = editingId ? projects.find(p => p.id === editingId) : null;
      const id = old ? old.id : `${new Date().toISOString().slice(0, 10)}-${slug(titleSr)}-${Math.random().toString(36).slice(2, 6)}`;
      const files = [];
      const finalImages = [];
      let n = 0;
      for (const im of images) {
        n++;
        if (im.kind === "existing") { finalImages.push({ full: im.full, thumb: im.thumb }); continue; }
        msg(out, `Pripremam sliku ${n} od ${images.length}…`);
        const bmp = await loadBitmap(im.file);
        const key = Math.random().toString(36).slice(2, 8);
        const full = `projects/${id}/${key}.jpg`, thumb = `projects/${id}/${key}-t.jpg`;
        files.push({ path: full, base64: toJpegBase64(bmp, FULL_MAX, 0.82) });
        files.push({ path: thumb, base64: toJpegBase64(bmp, THUMB_MAX, 0.78) });
        finalImages.push({ full, thumb });
      }

      const entry = {
        id,
        date: f.date.value || "",
        location: f.location.value.trim(),
        title: { sr: titleSr, de: f.title_de.value.trim(), en: f.title_en.value.trim() },
        description: { sr: f.desc_sr.value.trim(), de: f.desc_de.value.trim(), en: f.desc_en.value.trim() },
        images: finalImages
      };

      msg(out, "Učitavam na GitHub…");
      const current = await fetchProjects();          // najnovije stanje
      const idx = current.findIndex(p => p.id === id);
      let deletes = [];
      if (idx >= 0) {
        const keep = new Set(finalImages.flatMap(i => [i.full, i.thumb]));
        deletes = (current[idx].images || []).flatMap(i => [i.full, i.thumb]).filter(p => p && !keep.has(p));
        current[idx] = entry;
      } else {
        current.unshift(entry);
      }
      files.push({ path: "projects.json", text: JSON.stringify(current, null, 2) + "\n" });
      await commit(files, deletes, (idx >= 0 ? "Izmena projekta: " : "Novi projekat: ") + titleSr);

      projects = current;
      renderList();
      resetForm();
      msg(out, "Projekat je objavljen. Na sajtu će se pojaviti za 1 do 2 minuta.", "ok");
    } catch (err) {
      msg(out, explain(err), "err");
    } finally {
      btn.disabled = false;
    }
  }

  async function removeProject(id) {
    const p = projects.find(x => x.id === id);
    if (!p || !confirm(`Obrisati projekat „${p.title.sr}” i sve njegove slike?`)) return;
    const out = $("save-msg");
    try {
      msg(out, "Brišem projekat…");
      const current = await fetchProjects();
      const target = current.find(x => x.id === id);
      const rest = current.filter(x => x.id !== id);
      const deletes = target ? (target.images || []).flatMap(i => [i.full, i.thumb]).filter(Boolean) : [];
      await commit([{ path: "projects.json", text: JSON.stringify(rest, null, 2) + "\n" }], deletes, "Brisanje projekta: " + p.title.sr);
      projects = rest;
      if (editingId === id) resetForm();
      renderList();
      msg(out, "Projekat je obrisan. Sajt će se osvežiti za 1 do 2 minuta.", "ok");
    } catch (err) {
      msg(out, explain(err), "err");
    }
  }

  function explain(err) {
    if (err.status === 401) return "Token nije ispravan ili je istekao. Odjavite se i prijavite novim tokenom.";
    if (err.status === 403) return err.message.includes("dozvol") ? err.message : "Token nema dozvolu za izmenu sadržaja (Contents: Read and write).";
    if (err.status === 404) return "Repozitorijum nije pronađen. Proverite korisničko ime, naziv repozitorijuma i pristup tokena.";
    if (err instanceof TypeError) return "Nema veze sa GitHub-om. Proverite internet i pokušajte ponovo.";
    return "Greška: " + err.message;
  }

  /* ---------- događaji ---------- */
  $("connect-form").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const s = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), token: f.token.value.trim() };
    msg($("connect-msg"), "Proveravam…");
    try {
      await connect(s);
      saveSession(session, f.remember.checked);
      projects = await fetchProjects();
      msg($("connect-msg"), "");
      showLoggedIn(true);
      renderList();
    } catch (err) {
      session = null;
      msg($("connect-msg"), explain(err), "err");
    }
  });

  $("logout").onclick = () => { clearSession(); resetForm(); showLoggedIn(false); };
  $("project-form").addEventListener("submit", saveProject);
  $("cancel-edit").onclick = resetForm;

  const drop = $("drop"), input = $("file-input");
  drop.onclick = () => input.click();
  drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } };
  input.onchange = () => { addFiles(input.files); input.value = ""; };
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => addFiles(e.dataTransfer.files));

  /* ---------- start ---------- */
  (async function init() {
    const g = guessRepo();
    const f = $("connect-form");
    if (g.owner) f.owner.value = g.owner;
    if (g.repo) f.repo.value = g.repo;
    const saved = loadSession();
    if (!saved) return;
    try {
      await connect(saved);
      projects = await fetchProjects();
      showLoggedIn(true);
      renderList();
    } catch (err) {
      session = null;
      f.owner.value = saved.owner; f.repo.value = saved.repo;
      msg($("connect-msg"), explain(err), "err");
    }
  })();
})();
