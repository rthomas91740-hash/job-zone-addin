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
2. **Tracking** (done, first version): vehicles and drivers on site now, man-hours since the job opened (time inside the zone × crew size), refreshed every minute. Reads DeviceStatusInfo and Trips. Auto co-driver count still to test.
3. **Inventory cost** (done, first version): on a job press **Add item**, fill in name, quantity and cost per unit. Tap an item to edit or delete it. The total feeds the Inventory cost tile. Items are saved with the job. 
4. **Labor cost and job total** (done, first version): set a labor rate per man-hour on the job. Labor cost = man-hours × rate, and Job total = labor + inventory. 
5. **Overview tab** (done, first version): Jobs / Overview switch at the top of the panel. Overview shows total jobs, man-hours, labor, inventory and total cost for Today, This week (Monday start), This month, This year or All time, with a by-job breakdown. Tap a row to open that job. Next: shared item list.

Add-in id used for saved jobs: `aJz4Qm8RkT1uWv3Xn6YcP2g`.

Designed by Fleet Wolf · randy@fleetwolf.com · 626-384-9013 · www.fleetwolf.com
