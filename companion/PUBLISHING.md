# Permanent phone access

Use GitHub Pages on the existing public repository. It serves the static site
over HTTPS without the laptop, a local server, Tailscale, Azure changes, a new
account, or paid hosting. Live URL:

https://venom2074.github.io/pogoh-logger/

GitHub Pages was enabled with approval and deployed successfully on October 30,
2026, with HTTPS enforced. The site is public. Rides,
imported tracks, and device-check records stay in browser storage and are not
included in the deployment.

## Reviewable build

```powershell
npm test
npm run build:routes
npm run package
```

The package is `.site/`, using the explicit runtime allowlist in
`tools/package-companion.mjs`. It excludes raw CSVs, Azure code/settings, local
files, and maintenance documents. All app URLs are relative so the project
subdirectory works. The summary is a derived public station dataset.

## Activation

Siddharth authorized GitHub Pages publication on October 30, 2026 after asking
whether Student Pack hosting or a dynamic backend would change the choice.
The current browser-based features do not require a backend, so Pages remains
the selected $0 host. No Azure changes, new accounts, or tokens are authorized
by this hosting decision. The deployment procedure is:

1. Review and commit the companion, tests, tools, package configuration, and
   independent `.github/workflows/pages.yml`; push to the existing main branch
   after incorporating any newer logger commits. Do not modify `log.yml`,
   `log_status.py`, raw data, Azure resources, secrets, or token settings.
2. Enable repository Settings → Pages → Source: GitHub Actions. The equivalent
   CLI command for the currently disabled site is:
   `gh api --method POST repos/Venom2074/pogoh-logger/pages -f build_type=workflow`
3. Dispatch `gh workflow run pages.yml --repo Venom2074/pogoh-logger --ref main`.
4. Verify the successful Pages deployment and HTTPS URL. Check the manifest,
   summary, three GPX URLs, Maps destinations, live feed/fallback, and narrow
   layout at `/pogoh-logger/`. The workflow uses current official Actions majors
   checked October 30: checkout/setup-node v7, upload/deploy-pages v5.

The build job only reads repository contents. The deploy job has `pages: write`
and `id-token: write`, using GitHub's built-in ephemeral token. No new PAT or
Azure service is needed. To pause future deployments, disable only `pages.yml`;
the logger is separate. Removing Pages is also a settings change requiring approval.

## Data refresh

App changes on main and manual dispatch rebuild the site. Successful existing
logger workflow runs started in minutes 00–09 trigger an hourly summary rebuild
when available. Other completions exit before checkout/build/deploy. The trusted
main branch is checked out after the logger completes so its new data commit is
included; no triggering-run code or artifacts are used. Forks are excluded.
The workflow never commits data. If a rebuild is delayed, charts keep their
timestamp and coverage; live counts refresh independently every minute while
the app is visible. This does not change Azure's timer or the logger schedule.

## On the iPhone after deployment

Open the verified URL in Safari → Share → Add to Home Screen. Export any rides
from the old preview and import that JSON on the published site; browser storage
belongs to each site and does not automatically move or sync. Back up important
records before switching browsers or clearing site data.

After a successful online visit, cached routes and dated counts are available
offline. Live status, street tiles, and navigation require connectivity. A new
shell version offers an Update button; save any unfinished form first. Physical
iPhone installation and offline behavior still need testing on the hosted URL.

Official reference: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).


## Deployment verification — October 30, 2026

Initial publication commit: `3f492fa`. [Build and deployment succeeded](https://github.com/Venom2074/pogoh-logger/actions/runs/41109930891).
All 41 tests passed in CI. The site root and 22 runtime assets returned HTTPS
200; all three GPX files used `application/gpx+xml`. The hosted summary contains
287 snapshots through 18:43:08 UTC, with 143/144 recent ten-minute slots covered.
The hosted browser fetched live GBFS successfully. At 390px the route library
and selected ride fit without page overflow; GPX and walking/cycling links
resolve correctly below the project subdirectory. Browser error log was empty.
Physical iPhone installation, native sharing, and remaining Watch behavior
still need device checks; the desktop browser checks do not establish those.
