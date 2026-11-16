// Client-side filters for listing pages + lead form handling. No dependencies.
(function () {
  var box = document.querySelector("[data-filters]");
  var list = document.querySelector("[data-list]");
  if (box && list) {
    var cards = Array.prototype.slice.call(list.querySelectorAll(".card"));
    var ads = Array.prototype.slice.call(list.querySelectorAll(".ad"));
    var on = {}, city = "", guests = 0, sort = "flex", q = "";
    var countEl = document.querySelector("[data-count]");
    var clearBtn = document.querySelector("[data-clear]");
    var empty = document.querySelector("[data-empty]");
    function pass(c) {
      var d = c.dataset;
      if (q && d.text.indexOf(q) === -1) return false;
      if (city && d.city !== city) return false;
      if (guests && !(+d.seated >= guests)) return false;
      if (on.any && d.caterer !== "any") return false;
      if (on.self && d.self !== "true") return false;
      if (on.nofee && d.fee !== "none") return false;
      if (on.alcohol && !(d.alcohol === "yes" || d.alcohol === "fee")) return false;
      if (on.kitchen && d.kitchen !== "true") return false;
      if (on.city && d.cityowned !== "true") return false;
      if (on.verified && d.conf !== "official") return false;
      return true;
    }
    function render() {
      var shown = cards.filter(pass);
      shown.sort(function (a, b) {
        if (sort === "cap") return (+b.dataset.seated) - (+a.dataset.seated);
        if (sort === "name") return a.dataset.name.localeCompare(b.dataset.name);
        return (+b.dataset.score) - (+a.dataset.score) || (+a.dataset.rank) - (+b.dataset.rank) || a.dataset.name.localeCompare(b.dataset.name);
      });
      cards.forEach(function (c) { c.hidden = true; });
      ads.forEach(function (a) { a.remove(); });
      shown.forEach(function (c, i) {
        c.hidden = false; list.appendChild(c);
        if (i === 3 && ads[0]) list.appendChild(ads[0]);
        if (i === 11 && ads[1]) list.appendChild(ads[1]);
      });
      var n = shown.length;
      if (countEl) countEl.textContent = n === 1 ? countEl.dataset.one : countEl.dataset.many.replace("{n}", n);
      if (empty) empty.hidden = n > 0;
      var active = Object.keys(on).some(function (k) { return on[k]; }) || city || guests || q;
      if (clearBtn) clearBtn.hidden = !active;
    }
    box.querySelectorAll(".chip").forEach(function (b) {
      b.addEventListener("click", function () { var k = b.dataset.f; on[k] = !on[k]; b.setAttribute("aria-pressed", on[k] ? "true" : "false"); render(); });
    });
    var cs = box.querySelector("[data-city]"), gs = box.querySelector("[data-guests]"), ss = box.querySelector("[data-sort]"), qs = box.querySelector("[data-q]");
    if (cs) cs.addEventListener("change", function () { city = cs.value; render(); });
    if (gs) gs.addEventListener("change", function () { guests = +gs.value; render(); });
    if (ss) ss.addEventListener("change", function () { sort = ss.value; render(); });
    if (qs) qs.addEventListener("input", function () { q = qs.value.trim().toLowerCase(); render(); });
    if (clearBtn) clearBtn.addEventListener("click", function () {
      on = {}; city = ""; guests = 0; q = "";
      box.querySelectorAll(".chip").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      if (cs) cs.value = ""; if (gs) gs.value = "0"; if (qs) qs.value = "";
      render();
    });
  }

  // Lead and venue forms. Saves submissions to Supabase via data-endpoint.
  var form = document.getElementById("leadform");
  if (form) {
    var t0 = Date.now();
    // No event dates in the past (uses the visitor's local date).
    var dt = form.querySelector('input[type="date"]');
    if (dt) { var now = new Date(); dt.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
    var vf = document.getElementById("venueField");
    try { var v = new URLSearchParams(location.search).get("venue"); if (v && vf) { vf.value = v; var c = document.getElementById("f-city"); if (c && !c.value) c.value = v.replace(/-/g, " ").replace(/\b\w/g, function (x) { return x.toUpperCase(); }); } } catch (e) {}
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var es = form.dataset.lang === "es";
      var ok = document.getElementById("leadok");
      var btn = form.querySelector('button[type="submit"]');
      var data = {}; new FormData(form).forEach(function (val, key) { data[key] = val; });
      function show(msg, bad) { ok.textContent = msg; ok.hidden = false; ok.classList.toggle("error", !!bad); }
      var thanks = form.dataset.type === "listing"
        ? (es ? "¡Gracias! Revisaremos su información y le escribiremos pronto." : "Thanks! We'll review your listing and get back to you soon.")
        : (es ? "¡Listo! Recibirá cotizaciones en 1–2 días hábiles." : "Done! Expect quotes within 1–2 business days.");
      // Spam traps: hidden honeypot field, or a form sent faster than a person can fill it.
      if (data.company_website || Date.now() - t0 < 2500) { form.reset(); show(thanks); return; }
      if (!form.dataset.endpoint) { show(es ? "Gracias. Esta es una vista previa: el formulario se activará al publicar el sitio." : "Thanks. This is a preview: the form goes live when the site launches."); return; }
      // Saves the submission to Supabase (insert-only public key; visitors can't read entries).
      var skip = { company_website: 1, name: 1, email: 1, phone: 1, date: 1, lang: 1, site: 1 };
      var details = {}; Object.keys(data).forEach(function (k) { if (!skip[k] && data[k] !== "") details[k] = data[k]; });
      var row = { site: form.dataset.site, form_type: form.dataset.type, language: es ? "es" : "en", name: data.name || null, email: data.email, phone: data.phone || null, event_date: data.date || null, details: details };
      if (btn) btn.disabled = true;
      fetch(form.dataset.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "apikey": form.dataset.key, "Prefer": "return=minimal" }, body: JSON.stringify(row) })
        .then(function (r) { if (!r.ok) throw 0; form.reset(); show(thanks); if (window.gtag) gtag("event", "generate_lead", { form: data.form }); })
        .catch(function () { show(es ? "No se pudo enviar. Intente de nuevo." : "Couldn't send. Please try again.", true); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }
})();
