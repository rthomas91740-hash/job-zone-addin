// Fleet Wolf Job Zones — MyGeotab Map add-in (runs in the right-hand panel of the real Map page).
// Jobs are real Geotab zones; job details live in AddInData.
geotab.addin.request = function (elt, service) {
  "use strict";
  var ADDIN_ID = "aJz4Qm8RkT1uWv3Xn6YcP2g";
  var jobs = [], filter = "active", selectedId = null, view = "list";
  var draft = null, lastMapLoc = null, shapeEl = null;

  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var api = function (method, params) { return service.api.call(method, params); };
  var msg = function (t, isErr) { var m = elt.querySelector(".fwjz-msg"); if (!m) { frame("Job Zones"); m = elt.querySelector(".fwjz-msg"); } m.textContent = t || ""; m.className = "fwjz-msg" + (isErr ? " err" : ""); };
  var errText = function (e) { return e && e.message ? e.message : String(e); };

  /* ---------- geometry ---------- */
  function zonePoints(c, shape, widthFt) {
    var w = widthFt * 0.3048, h = w / 2;
    var pts = shape === "house"
      ? [[-h, -h], [h, -h], [h, w / 6], [0, h], [-h, w / 6]]
      : [[-h, -h], [h, -h], [h, h], [-h, h]];
    var mLat = 111320, mLng = 111320 * Math.cos(c.lat * Math.PI / 180);
    return pts.map(function (p) { return { lat: c.lat + p[1] / mLat, lng: c.lng + p[0] / mLng }; });
  }
  function findLatLng(o, depth) {
    if (!o || typeof o !== "object" || (depth || 0) > 4) return null;
    var lat = o.lat != null ? o.lat : o.latitude, lng = o.lng != null ? o.lng : (o.lon != null ? o.lon : o.longitude);
    if (typeof lat === "number" && typeof lng === "number") return { lat: lat, lng: lng };
    var keys = Object.keys(o);
    for (var i = 0; i < keys.length; i++) { var r = findLatLng(o[keys[i]], (depth || 0) + 1); if (r) return r; }
    return null;
  }

  /* ---------- drawing on the real map ---------- */
  function clearShape() { if (shapeEl) { try { shapeEl.remove(); } catch (e) {} shapeEl = null; } }
  function drawShape(pts) {
    clearShape();
    var coords = [{ type: "M", points: [pts[0]] }]
      .concat(pts.slice(1).map(function (p) { return { type: "L", points: [p] }; }), [{ type: "Z" }]);
    shapeEl = service.canvas.path(coords, 100).change({ fill: "#00a8e7", "fill-opacity": 0.25, stroke: "#00a8e7", "stroke-width": 4 });
  }
  function zoomTo(c, widthFt) {
    var w = widthFt * 0.3048 * 3, dLat = w / 111320, dLng = w / (111320 * Math.cos(c.lat * Math.PI / 180));
    service.map.setBounds({ ne: { lat: c.lat + dLat, lng: c.lng + dLng }, sw: { lat: c.lat - dLat, lng: c.lng - dLng } });
  }

  /* ---------- data ---------- */
  function load() {
    return api("Get", { typeName: "AddInData", search: { addInId: ADDIN_ID } }).then(function (rows) {
      jobs = rows.map(function (r) { var d = r.details || {}; d.id = r.id; return d; });
      render();
    }).catch(function (e) { msg("Could not load jobs: " + errText(e), true); });
  }
  function zoneEntity(name, c, shape, widthFt) {
    return { name: "Job: " + name, displayed: true, mustIdentifyStops: false,
      points: zonePoints(c, shape, widthFt).map(function (p) { return { x: p.lng, y: p.lat }; }),
      fillColor: { r: 0, g: 168, b: 231, a: 80 }, activeFrom: new Date().toISOString(), activeTo: "2050-01-01T00:00:00.000Z",
      zoneTypes: [{ id: "ZoneTypeCustomerId" }], groups: [{ id: "GroupCompanyId" }] };
  }
  function createJob(job) {
    return api("Add", { typeName: "Zone", entity: zoneEntity(job.name, job.center, job.shape, job.widthFt) }).then(function (zoneId) {
      job.zoneId = zoneId;
      return api("Add", { typeName: "AddInData", entity: { addInId: ADDIN_ID, details: job } });
    }).then(function (id) { job.id = id; return job; });
  }
  function saveJob(job) {
    var d = JSON.parse(JSON.stringify(job)); delete d.id;
    return api("Set", { typeName: "AddInData", entity: { id: job.id, addInId: ADDIN_ID, details: d } });
  }
  function resizeZone(job, widthFt) {
    var pts = zonePoints(job.center, job.shape, widthFt).map(function (p) { return { x: p.lng, y: p.lat }; });
    return api("Get", { typeName: "Zone", search: { id: job.zoneId } }).then(function (r) {
      if (!r.length) throw new Error("zone not found in MyGeotab");
      var z = r[0]; z.points = pts; return api("Set", { typeName: "Zone", entity: z });
    });
  }
  function byId(id) { return jobs.filter(function (j) { return j.id === id; })[0]; }

  /* ---------- views ---------- */
  var SQ = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="16" height="16" rx="2"/></svg>';
  var HO = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l8-7 8 7v9H3z"/></svg>';
  function frame(title) {
    elt.textContent = "";
    var root = el("div", "fwjz");
    var head = el("div", "fwjz-head");
    var wm = el("span", "fwjz-wm", "FLEET"); wm.appendChild(el("span", null, "WOLF")); head.appendChild(wm);
    head.appendChild(el("span", "fwjz-sep")); head.appendChild(el("h1", null, title));
    root.appendChild(head); root.appendChild(el("p", "fwjz-msg"));
    elt.appendChild(root); return root;
  }
  function render() {
    if (view === "add") return renderAdd();
    if (view === "detail" && byId(selectedId)) return renderDetail(byId(selectedId));
    view = "list"; renderList();
  }

  function renderList() {
    clearShape();
    var root = frame("Job Zones");
    var add = el("button", "fwjz-btn", "+ Add job"); add.type = "button";
    add.addEventListener("click", function () { draft = draft || lastMapLoc; view = "add"; render(); });
    root.appendChild(add);
    var tabs = el("div", "fwjz-tabs");
    [["active", "Active"], ["closed", "Closed"], ["all", "All"]].forEach(function (t) {
      var b = el("button", "fwjz-tab", t[1]); b.type = "button"; b.setAttribute("aria-pressed", String(filter === t[0]));
      b.addEventListener("click", function () { filter = t[0]; render(); }); tabs.appendChild(b);
    });
    root.appendChild(tabs);
    var vis = jobs.filter(function (j) { return filter === "all" || j.status === filter; });
    if (!vis.length) root.appendChild(el("div", "fwjz-empty", filter === "active" ? "No active jobs yet. Right-click the map and choose Add job here, or use Add job." : "Nothing here yet."));
    vis.forEach(function (j) {
      var c = el("button", "fwjz-card"); c.type = "button";
      var ic = el("span", "fwjz-ico" + (j.status === "closed" ? " off" : "")); ic.innerHTML = j.shape === "house" ? HO : SQ; c.appendChild(ic);
      var m = el("span", "fwjz-meta"); m.appendChild(el("strong", null, j.name)); m.appendChild(el("span", "sub", j.address || "Placed on map")); c.appendChild(m);
      var s = el("span", "fwjz-stat"); if (j.status === "active") s.appendChild(el("span", "dot")); s.appendChild(document.createTextNode(j.status === "active" ? "Active" : "Closed")); c.appendChild(s);
      c.addEventListener("click", function () { open(j.id); });
      root.appendChild(c);
    });
    root.appendChild(el("p", "fwjz-note", "Each job is a Geotab zone. Click a job zone on the map to open it here."));
    root.appendChild(signature());
  }
  function signature() { return el("p", "fwjz-note", "Designed by Fleet Wolf · randy@fleetwolf.com · 626-384-9013 · www.fleetwolf.com"); }

  function open(id) {
    selectedId = id; view = "detail"; render();
    var j = byId(id); if (j) zoomTo(j.center, j.widthFt);
  }

  function renderDetail(j) {
    var root = frame(j.name);
    var back = el("button", "fwjz-btn ghost", "‹ All jobs"); back.type = "button";
    back.addEventListener("click", function () { selectedId = null; view = "list"; render(); });
    root.appendChild(back);
    var st = el("div", "fwjz-stat"); if (j.status === "active") st.appendChild(el("span", "dot"));
    st.appendChild(document.createTextNode((j.status === "active" ? "Active since " : "Closed · opened ") + new Date(j.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })));
    root.appendChild(st); root.appendChild(el("div", "sub", j.address || "Placed on map"));

    var tiles = el("div", "fwjz-tiles");
    [["Vehicles on site", "—"], ["Drivers on site", "—"], ["Man-hours", "—", 1], ["Inventory cost", "—"]].forEach(function (t) {
      var d = el("div", "fwjz-tile" + (t[2] ? " hi" : "")); d.appendChild(el("div", "l", t[0])); d.appendChild(el("div", "v", t[1])); tiles.appendChild(d);
    });
    root.appendChild(tiles);
    root.appendChild(el("p", "fwjz-note", "Vehicle, driver, man-hour and inventory tracking come in the next build step."));

    root.appendChild(el("h2", null, "Zone"));
    root.appendChild(el("div", "sub", (j.shape === "house" ? "House" : "Square") + " · " + j.widthFt + " ft wide"));
    drawShape(zonePoints(j.center, j.shape, j.widthFt));

    if (j.status === "active") {
      var f = el("div", "fwjz-field"), lb = el("label", null, "Zone width (ft)"); lb.htmlFor = "fwjz-size";
      var inp = el("input"); inp.type = "number"; inp.id = "fwjz-size"; inp.min = 30; inp.max = 2000; inp.value = j.widthFt;
      var row = el("div", "fwjz-row"), sv = el("button", "fwjz-btn ghost", "Update size"); sv.type = "button";
      inp.addEventListener("input", function () { var w = Number(inp.value); if (w >= 30 && w <= 2000) drawShape(zonePoints(j.center, j.shape, w)); });
      sv.addEventListener("click", function () {
        var w = Number(inp.value);
        if (!(w >= 30 && w <= 2000)) { msg("Zone width must be between 30 and 2000 ft.", true); return; }
        sv.disabled = true; var old = j.widthFt;
        resizeZone(j, w).then(function () { j.widthFt = w; return saveJob(j); })
          .then(function () { render(); msg("Zone updated."); })
          .catch(function (e) { j.widthFt = old; sv.disabled = false; msg("Could not update the zone: " + errText(e), true); });
      });
      row.appendChild(inp); row.appendChild(sv); f.appendChild(lb); f.appendChild(row); root.appendChild(f);
      var cl = el("button", "fwjz-btn", "Close job"); cl.type = "button";
      cl.addEventListener("click", function () {
        j.status = "closed"; j.closedAt = new Date().toISOString();
        saveJob(j).then(function () { render(); }).catch(function (e) { j.status = "active"; msg("Could not close the job: " + errText(e), true); });
      });
      root.appendChild(cl);
    }
    root.appendChild(signature());
  }

  function renderAdd() {
    var root = frame("Add job");
    var form = el("form", "fwjz-form");
    function field(id, label, input) { var f = el("div", "fwjz-field"), l = el("label", null, label); l.htmlFor = id; input.id = id; f.appendChild(l); f.appendChild(input); return f; }
    var name = el("input"); name.type = "text"; name.placeholder = "e.g. Maple Ave re-roof"; name.required = true;
    form.appendChild(field("fwjz-name", "Job name", name));
    var addr = el("input"); addr.type = "text"; addr.placeholder = "Search an address";
    var arow = el("div", "fwjz-row"), find = el("button", "fwjz-btn ghost", "Find"); find.type = "button";
    var af = field("fwjz-addr", "Job address", addr); arow.appendChild(addr); arow.appendChild(find);
    af.appendChild(arow); form.appendChild(af);
    var loc = el("p", "fwjz-note"); form.appendChild(loc);
    var shapes = el("div", "fwjz-shapes"); shapes.setAttribute("role", "radiogroup"); shapes.setAttribute("aria-label", "Zone shape");
    [["square", "Square", SQ], ["house", "House", HO]].forEach(function (s, i) {
      var l = el("label", "fwjz-shape"), r = el("input"); r.type = "radio"; r.name = "fwjz-shape"; r.value = s[0]; r.checked = i === 0;
      var ic = el("span"); ic.innerHTML = s[2]; l.appendChild(r); l.appendChild(ic); l.appendChild(document.createTextNode(s[1]));
      r.addEventListener("change", preview); shapes.appendChild(l);
    });
    form.appendChild(shapes);
    var size = el("input"); size.type = "number"; size.min = 30; size.max = 2000; size.value = 150; size.addEventListener("input", preview);
    form.appendChild(field("fwjz-sz", "Zone width (ft)", size));
    var btns = el("div", "fwjz-row"), cancel = el("button", "fwjz-btn ghost", "Cancel"), save = el("button", "fwjz-btn", "Create job and start tracking");
    cancel.type = "button"; save.type = "submit"; btns.appendChild(cancel); btns.appendChild(save); form.appendChild(btns);
    root.appendChild(form); root.appendChild(signature());

    function shape() { return form.querySelector('input[name="fwjz-shape"]:checked').value; }
    function width() { return Math.max(30, Number(size.value) || 150); }
    function preview() { if (draft) drawShape(zonePoints(draft, shape(), width())); }
    function showLoc(note) {
      loc.textContent = note || (draft ? "Location set: " + draft.lat.toFixed(5) + ", " + draft.lng.toFixed(5) : "No location yet. Right-click the map and choose Add job here, or search an address.");
    }
    showLoc(); preview();
    renderAdd.setLoc = function (c, note) { draft = c; showLoc(note); preview(); zoomTo(c, width()); };

    find.addEventListener("click", function () {
      var q = addr.value.trim(); if (!q) { msg("Type an address first.", true); return; }
      msg(""); loc.textContent = "Searching…";
      fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (r) { if (!r.length) { loc.textContent = "No match. Try a fuller address."; return; } renderAdd.setLoc({ lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon) }, "Found: " + r[0].display_name); })
        .catch(function () { loc.textContent = "Address search is unavailable here. Use right-click on the map instead."; });
    });
    cancel.addEventListener("click", function () { draft = null; view = "list"; render(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var w = Number(size.value);
      if (!draft) { msg("Set a location first.", true); return; }
      if (!(w >= 30 && w <= 2000)) { msg("Zone width must be between 30 and 2000 ft.", true); return; }
      save.disabled = true;
      createJob({ name: name.value.trim(), address: addr.value.trim(), shape: shape(), widthFt: w, center: { lat: draft.lat, lng: draft.lng }, status: "active", createdAt: new Date().toISOString() })
        .then(function (job) { jobs.push(job); draft = null; filter = "active"; open(job.id); })
        .catch(function (err) { save.disabled = false; msg("Could not save the job: " + errText(err), true); });
    });
  }

  /* ---------- hooks into the real map ---------- */
  // Right-click on the map -> "Add job here"
  service.actionList.attachMenu("mapMenu", function () {
    var loc = findLatLng(Array.prototype.slice.call(arguments));
    if (loc) lastMapLoc = loc;
    return Promise.resolve([{ title: "Add job here (Fleet Wolf)", clickEvent: "fwjzAddHere", zIndex: 1, data: {} }]);
  });
  service.actionList.attach("fwjzAddHere", function () {
    if (lastMapLoc) draft = lastMapLoc;
    view = "add"; render();
    if (!lastMapLoc) msg("Could not read the map position. Search an address instead.", true);
  });
  // Click a job zone on the map -> open that job. Click the map -> remember its position if provided.
  service.events.attach("click", function (e) {
    if (!e) return;
    if (e.type === "zone" && e.entity) {
      var j = jobs.filter(function (x) { return x.zoneId === e.entity.id; })[0];
      if (j) open(j.id);
    } else {
      var loc = findLatLng(e);
      if (loc) { lastMapLoc = loc; if (view === "add" && renderAdd.setLoc) renderAdd.setLoc(loc); }
    }
  });
  service.page.attach("focus", function () { load(); });

  elt.textContent = "";
  load();
};
