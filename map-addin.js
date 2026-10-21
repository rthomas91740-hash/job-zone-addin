// Fleet Wolf Job Zones — MyGeotab Map add-in (runs in the right-hand panel of the real Map page).
// Jobs are real Geotab zones; job details live in AddInData.
geotab.addin.request = function (elt, service) {
  "use strict";
  var ADDIN_ID = "aJz4Qm8RkT1uWv3Xn6YcP2g";
  var jobs = [], filter = "active", selectedId = null, view = "list";
  var draft = null, lastMapLoc = null, shapeEl = null, adoptPre = null, timer = null;

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
  function jobPts(j) { return j.points && j.points.length ? j.points : zonePoints(j.center, j.shape, j.widthFt); }
  function pointsOf(z) { return (z.points || []).map(function (p) { return { lat: p.y, lng: p.x }; }); }
  function geomOf(pts) {
    var la = pts.map(function (p) { return p.lat; }), ln = pts.map(function (p) { return p.lng; });
    var minLa = Math.min.apply(null, la), maxLa = Math.max.apply(null, la), minLn = Math.min.apply(null, ln), maxLn = Math.max.apply(null, ln);
    var c = { lat: (minLa + maxLa) / 2, lng: (minLn + maxLn) / 2 };
    var ft = Math.max((maxLa - minLa) * 111320, (maxLn - minLn) * 111320 * Math.cos(c.lat * Math.PI / 180)) / 0.3048;
    return { center: c, widthFt: Math.max(30, Math.round(ft)) };
  }
  function whereText(j) { return j.address || (j.existingZone ? "Existing Geotab zone" : "Placed on map"); }
  function shapeText(j) { return j.shape === "custom" ? "Existing zone · custom shape · about " + j.widthFt + " ft across" : (j.shape === "house" ? "House" : "Square") + " · " + j.widthFt + " ft wide"; }


  /* ---------- tracking: who is in the zone, and for how long ---------- */
  function inPoly(p, poly) {
    var ins = false;
    for (var i = 0, k = poly.length - 1; i < poly.length; k = i++) {
      if (((poly[i].lat > p.lat) !== (poly[k].lat > p.lat)) &&
          (p.lng < (poly[k].lng - poly[i].lng) * (p.lat - poly[i].lat) / (poly[k].lat - poly[i].lat) + poly[i].lng)) ins = !ins;
    }
    return ins;
  }
  function idOf(v) { return v && typeof v === "object" ? v.id : v; }
  function isKnown(d) { return !!d && d !== "UnknownDriverId" && d !== "NoDriverId"; }
  function track(job) {
    var start = new Date(job.createdAt), end = (job.status === "closed" && job.closedAt) ? new Date(job.closedAt) : new Date(), poly = jobPts(job);
    return service.api.multiCall([
      ["Get", { typeName: "DeviceStatusInfo" }],
      ["Get", { typeName: "Device" }],
      ["Get", { typeName: "User", search: { isDriver: true } }],
      ["Get", { typeName: "Trip", search: { fromDate: start.toISOString(), toDate: end.toISOString() }, resultsLimit: 5000 }]
    ]).then(function (r) {
      var dn = {}, un = {}, rawHours = 0, seenV = {}, seenD = {}, openAt = {}, hasStop = {}, now = [], nowDrv = {};
      r[1].forEach(function (d) { dn[d.id] = d.name; });
      r[2].forEach(function (u) { un[u.id] = ((u.firstName || "") + " " + (u.lastName || "")).trim() || u.name; });
      r[3].forEach(function (t) {
        if (!t.stopPoint || !inPoly({ lat: t.stopPoint.y, lng: t.stopPoint.x }, poly)) return;
        var did = idOf(t.device), dr = idOf(t.driver), arr = new Date(t.stop);
        var nx = t.nextTripStart ? new Date(t.nextTripStart) : null, open = !nx || nx.getFullYear() > 2040 || nx > end;
        if (open) nx = end;
        var a = arr < start ? start : arr; if (nx > a) rawHours += (nx - a) / 3600000;
        seenV[did] = 1; if (isKnown(dr)) seenD[dr] = 1; hasStop[did] = 1; if (open) openAt[did] = a;
      });
      if (job.status === "active") r[0].forEach(function (s) {
        if (s.latitude == null || s.longitude == null || !inPoly({ lat: s.latitude, lng: s.longitude }, poly)) return;
        var did = idOf(s.device), dr = idOf(s.driver);
        if (!hasStop[did]) { rawHours += (end - start) / 3600000; seenV[did] = 1; }   // was already here when the job opened
        if (isKnown(dr)) { nowDrv[dr] = 1; seenD[dr] = 1; }
        now.push({ vehicle: dn[did] || did, driver: isKnown(dr) ? (un[dr] || dr) : "No driver assigned", since: openAt[did] || start });
      });
      return { now: now, nowDrivers: Object.keys(nowDrv).length, rawHours: rawHours, visitedVeh: Object.keys(seenV).length, visitedDrv: Object.keys(seenD).length };
    });
  }

  /* ---------- views ---------- */
  var SQ = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="16" height="16" rx="2"/></svg>';
  var HO = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l8-7 8 7v9H3z"/></svg>';
  var PL = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 7l7-4 7 5-2 9-8 2z"/></svg>';
  function iconFor(j) { return j.shape === "house" ? HO : (j.shape === "custom" ? PL : SQ); }
  function frame(title) {
    if (timer) { clearInterval(timer); timer = null; }
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
    if (view === "adopt") return renderAdopt();
    if (view === "detail" && byId(selectedId)) return renderDetail(byId(selectedId));
    view = "list"; renderList();
  }

  function renderList() {
    clearShape();
    var root = frame("Job Zones");
    var add = el("button", "fwjz-btn", "+ Add job"); add.type = "button"; add.style.flex = "1 1 auto";
    add.addEventListener("click", function () { draft = draft || lastMapLoc; view = "add"; render(); });
    var ex = el("button", "fwjz-btn ghost", "Use existing zone"); ex.type = "button"; ex.style.flex = "1 1 auto";
    ex.addEventListener("click", function () { adoptPre = null; view = "adopt"; render(); });
    var arow = el("div", "fwjz-row"); arow.appendChild(add); arow.appendChild(ex); root.appendChild(arow);
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
      var ic = el("span", "fwjz-ico" + (j.status === "closed" ? " off" : "")); ic.innerHTML = iconFor(j); c.appendChild(ic);
      var m = el("span", "fwjz-meta"); m.appendChild(el("strong", null, j.name)); m.appendChild(el("span", "sub", whereText(j))); c.appendChild(m);
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
    root.appendChild(st); root.appendChild(el("div", "sub", whereText(j)));

    var vals = {}, tiles = el("div", "fwjz-tiles");
    [["veh", "Vehicles on site", "…"], ["drv", "Drivers on site", "…"], ["mh", "Man-hours", "…", 1], ["inv", "Inventory cost", "—"]].forEach(function (t) {
      var d = el("div", "fwjz-tile" + (t[3] ? " hi" : "")); d.appendChild(el("div", "l", t[1])); vals[t[0]] = el("div", "v", t[2]); d.appendChild(vals[t[0]]); tiles.appendChild(d);
    });
    root.appendChild(tiles);
    var nowBox = el("div"); nowBox.style.cssText = "display:flex;flex-direction:column;gap:8px"; root.appendChild(nowBox);
    var upd = el("p", "fwjz-note", "Loading activity…"); root.appendChild(upd);
    var rf = el("button", "fwjz-btn ghost", "Refresh"); rf.type = "button"; root.appendChild(rf);
    var cf = el("div", "fwjz-field"), cLb = el("label", null, "Crew size per vehicle"); cLb.htmlFor = "fwjz-crew";
    var cIn = el("input"); cIn.type = "number"; cIn.id = "fwjz-crew"; cIn.min = 1; cIn.max = 20; cIn.value = j.crewSize || 1;
    var cRow = el("div", "fwjz-row"), cSv = el("button", "fwjz-btn ghost", "Update crew"); cSv.type = "button";
    cRow.appendChild(cIn); cRow.appendChild(cSv); cf.appendChild(cLb); cf.appendChild(cRow); root.appendChild(cf);
    root.appendChild(el("p", "fwjz-note", "Man-hours = time vehicles are inside the zone × crew size. Geotab only knows the driver, so set how many people ride in each vehicle."));
    var last = null;
    function fill() {
      if (!last) return;
      var active = j.status === "active";
      vals.veh.textContent = active ? String(last.now.length) : "—";
      vals.drv.textContent = active ? String(last.nowDrivers) : "—";
      vals.mh.textContent = (last.rawHours * (j.crewSize || 1)).toFixed(1);
      nowBox.textContent = "";
      if (active && last.now.length) {
        nowBox.appendChild(el("h2", null, "On site now"));
        last.now.forEach(function (n) {
          var rw = el("div", "fwjz-card"); rw.style.cssText = "cursor:default;align-items:center";
          var mt = el("span", "fwjz-meta"); mt.appendChild(el("strong", null, n.vehicle)); mt.appendChild(el("span", "sub", n.driver)); rw.appendChild(mt);
          rw.appendChild(el("span", "fwjz-stat", "since " + n.since.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })));
          nowBox.appendChild(rw);
        });
      }
      upd.textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " · " + last.visitedVeh + " vehicle(s) and " + last.visitedDrv + " driver(s) have been in the zone since the job opened.";
    }
    function refreshStats() {
      track(j).then(function (r) { last = r; fill(); }).catch(function (e) { upd.textContent = ""; msg("Could not load activity: " + errText(e), true); });
    }
    rf.addEventListener("click", refreshStats);
    cSv.addEventListener("click", function () {
      var n = Math.round(Number(cIn.value));
      if (!(n >= 1 && n <= 20)) { msg("Crew size must be between 1 and 20.", true); return; }
      var old = j.crewSize; j.crewSize = n; cSv.disabled = true;
      saveJob(j).then(function () { cSv.disabled = false; msg(""); fill(); })
        .catch(function (e) { j.crewSize = old; cSv.disabled = false; msg("Could not save crew size: " + errText(e), true); });
    });
    refreshStats();
    if (j.status === "active") timer = setInterval(refreshStats, 60000);

    root.appendChild(el("h2", null, "Zone"));
    root.appendChild(el("div", "sub", shapeText(j)));
    drawShape(jobPts(j));

    if (j.status === "active" && j.shape !== "custom") {
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
    }
    if (j.status === "active") {
      var cl = el("button", "fwjz-btn", "Close job"); cl.type = "button";
      cl.addEventListener("click", function () {
        j.status = "closed"; j.closedAt = new Date().toISOString();
        saveJob(j).then(function () { render(); }).catch(function (e) { j.status = "active"; msg("Could not close the job: " + errText(e), true); });
      });
      root.appendChild(cl);
    }
    root.appendChild(signature());
  }

  function renderAdopt() {
    clearShape();
    var root = frame("Use existing zone");
    var back = el("button", "fwjz-btn ghost", "‹ All jobs"); back.type = "button";
    back.addEventListener("click", function () { view = "list"; adoptPre = null; render(); });
    root.appendChild(back);
    root.appendChild(el("p", "fwjz-note", "Pick a zone you already have in Geotab to track as a job, or click it on the map. Its shape stays as drawn."));
    var f = el("div", "fwjz-field"), lb = el("label", null, "Search your zones"); lb.htmlFor = "fwjz-zq";
    var q = el("input"); q.type = "text"; q.id = "fwjz-zq"; q.placeholder = "Zone name";
    f.appendChild(lb); f.appendChild(q); root.appendChild(f);
    var info = el("p", "fwjz-note", "Loading zones…"); root.appendChild(info);
    var box = el("div"); box.style.cssText = "display:flex;flex-direction:column;gap:8px"; root.appendChild(box);
    var confirm = el("div", "fwjz-form"); root.appendChild(confirm);
    root.appendChild(signature());
    var all = [], picked = null;

    function draw() {
      var t = q.value.trim().toLowerCase();
      var m = all.filter(function (z) { return !t || (z.name || "").toLowerCase().indexOf(t) !== -1; });
      info.textContent = m.length ? (m.length > 50 ? "Showing the first 50 of " + m.length + ". Search to narrow." : m.length + (m.length === 1 ? " zone" : " zones")) : "No matching zones.";
      box.textContent = "";
      m.slice(0, 50).forEach(function (z) {
        var c = el("button", "fwjz-card" + (picked && picked.id === z.id ? " sel" : "")); c.type = "button";
        var ic = el("span", "fwjz-ico off"); ic.innerHTML = PL; c.appendChild(ic);
        var mm = el("span", "fwjz-meta"); mm.appendChild(el("strong", null, z.name || "(unnamed zone)")); c.appendChild(mm);
        c.addEventListener("click", function () { pick(z.id); });
        box.appendChild(c);
      });
    }
    function pick(id) {
      var z = all.filter(function (x) { return x.id === id; })[0];
      if (!z) { msg("That zone is already a job or could not be found.", true); return; }
      msg(""); picked = z; draw();
      var pts = pointsOf(z), g = geomOf(pts); drawShape(pts); zoomTo(g.center, g.widthFt);
      confirm.textContent = "";
      var nf = el("div", "fwjz-field"), nl = el("label", null, "Job name"); nl.htmlFor = "fwjz-jn";
      var ni = el("input"); ni.type = "text"; ni.id = "fwjz-jn"; ni.value = z.name || "";
      nf.appendChild(nl); nf.appendChild(ni);
      var go = el("button", "fwjz-btn", "Make this a job"); go.type = "button";
      go.addEventListener("click", function () {
        var name = ni.value.trim(); if (!name) { msg("Give the job a name.", true); return; }
        go.disabled = true;
        var job = { name: name, address: "", shape: "custom", widthFt: g.widthFt, center: g.center, points: pts, zoneId: z.id,
          status: "active", createdAt: new Date().toISOString(), existingZone: true };
        api("Add", { typeName: "AddInData", entity: { addInId: ADDIN_ID, details: job } })
          .then(function (newId) { job.id = newId; jobs.push(job); filter = "active"; open(job.id); })
          .catch(function (err) { go.disabled = false; msg("Could not save the job: " + errText(err), true); });
      });
      confirm.appendChild(nf); confirm.appendChild(go);
    }
    renderAdopt.pick = pick;
    q.addEventListener("input", draw);
    api("Get", { typeName: "Zone", resultsLimit: 500 }).then(function (zs) {
      all = zs.filter(function (z) { return z.points && z.points.length > 2 && !jobs.some(function (j) { return j.zoneId === z.id; }); })
        .sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
      draw();
      if (adoptPre) { var id = adoptPre; adoptPre = null; pick(id); }
    }).catch(function (e) { info.textContent = ""; msg("Could not load zones: " + errText(e), true); });
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
      else if (view === "adopt" && renderAdopt.pick) renderAdopt.pick(e.entity.id);
    } else {
      var loc = findLatLng(e);
      if (loc) { lastMapLoc = loc; if (view === "add" && renderAdd.setLoc) renderAdd.setLoc(loc); }
    }
  });
  service.page.attach("focus", function () { load(); });

  elt.textContent = "";
  load();
};
