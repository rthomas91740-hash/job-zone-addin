# Job Zones (Fleet Wolf)

A MyGeotab add-in. Add a job, drop a square or house zone on the map, and (in later steps) track every vehicle and driver that enters the zone while the job is open: man-hours first, then inventory cost.

## Build steps

1. **Add jobs and zones** (this commit): Add job form, zone drawn on the map, jobs listed, close job. Each job is created as a Geotab zone, and the job details are saved in the add-in's AddInData.
2. Tracking: vehicles and drivers inside the zone, man-hours per job.
3. Inventory assigned to a job and job cost.

## Run it

- **Standalone:** open `index.html` from GitHub Pages. Jobs save in the browser (localStorage) for testing.
- **In MyGeotab:** Administration > System > System Settings > Add-Ins > New Add-In, paste `config.json`.

Add-in id used for saved jobs: `aJz4Qm8RkT1uWv3Xn6YcP2g`.

Designed by Fleet Wolf · randy@fleetwolf.com · 626-384-9013 · www.fleetwolf.com
