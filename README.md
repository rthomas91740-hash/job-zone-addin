# Job Zones (Fleet Wolf)

A MyGeotab add-in. Add a job, drop a square or house zone on the map, and (in later steps) track every vehicle and driver that enters the zone while the job is open: man-hours first, then inventory cost.

## Two ways to run it

**1. Map add-in (main version).** Opens as a panel on the right side of MyGeotab's real Map page, like Vehicle Info. Files: `map-addin.js`, `map-addin.css`, `map-config.json`.
- Install: Administration > System > System Settings > Add-Ins > New Add-In, paste `map-config.json`.
- Right-click the map > **Add job here (Fleet Wolf)** to start a job at that spot, or use **Add job** and search an address.
- Click a job's zone on the map to open that job in the panel.
- **Use existing zone**: turn a zone you already have in Geotab into a job. Pick it from the list or click it on the map. Its shape stays as drawn (resize it in Geotab Zones).

**2. Activity page (fallback).** `index.html` + `config.json`: a full page under the Activity menu with its own map. Jobs save in the browser when opened standalone.

Both need GitHub Pages turned on (Settings > Pages > branch `main`, folder `/`).

## Build steps

1. **Add jobs and zones** (done): add a job, zone on the map, edit zone size, close job. Each job is a real Geotab zone; job details are saved in the add-in's AddInData.
2. Tracking: vehicles and drivers inside the zone, man-hours per job.
3. Inventory assigned to a job and job cost.

Add-in id used for saved jobs: `aJz4Qm8RkT1uWv3Xn6YcP2g`.

Designed by Fleet Wolf · randy@fleetwolf.com · 626-384-9013 · www.fleetwolf.com
