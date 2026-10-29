# Handoff: make the logger actually run every 10 minutes (Azure)

## Background

This repo logs live availability for every POGOH bikeshare station in Pittsburgh. It records e-bikes, pedal bikes and open docks. The point is to learn when Siddharth's home station runs out of bikes. That station is **"Forbes Ave at TCS Hall (CMU Campus)", station_id 59**, next to CMU.

- `log_status.py`: standard-library Python. It reads POGOH's public GBFS v3 feed (`https://pittsburgh.publicbikesystem.net/customer/gbfs/v3.0/`), appends one row per station to `data/YYYY-MM.csv`, and refreshes `data/stations.csv`. Column definitions are in the README.
- `.github/workflows/log.yml`: runs the script and commits `data/`. It has two triggers: `schedule` (`3-59/10 * * * *`) and `workflow_dispatch`.
- The repo is public, so Actions minutes are unlimited.

## The problem

GitHub's scheduler throttles this repo badly. From Oct 20 to Oct 29 2026 there were only **54 runs total, about 6 a day**, against a target of about 144 a day. The script and the workflow both work. Every run succeeds. The only problem is how often runs fire.

## The decided fix

Use an **Azure Function with a timer trigger** that fires every 10 minutes. Each time, it calls GitHub's REST API to dispatch the workflow:

```
POST https://api.github.com/repos/Venom2074/pogoh-logger/actions/workflows/log.yml/dispatches
Authorization: Bearer <token>
Accept: application/vnd.github+json
{"ref": "main"}
```

Keep the existing script, workflow and data as they are. Azure only acts as the clock.

### Constraints

- **Do not spend money.** Siddharth has an Azure for Students account ($100 credit, no credit card) from the GitHub Student Developer Pack. Use the Consumption (serverless) plan. Do not create anything that bills continuously, such as App Service plans, Premium plans, VMs or Logic App Standard. A timer every 10 minutes is about 4,300 executions a month, which is well inside the Functions free grant. The storage account the Function requires costs pennies, which the credit covers.
- **Token:** use a **fine-grained personal access token** scoped to `Venom2074/pogoh-logger` only, with the **Actions: Read and write** permission and nothing else. Siddharth has to create it in GitHub (Settings → Developer settings → Fine-grained tokens). Store it as a Function **app setting** such as `GITHUB_TOKEN`. Never commit it. Note when it expires, because he will need to rotate it.
- **Timer:** NCRONTAB, which has six fields including seconds, and runs in UTC. For example, use `0 3-59/10 * * * *` to stay offset from the top of the hour.
- **Keep the GitHub `schedule` trigger** as a fallback. The workflow's `concurrency` group means overlapping runs queue instead of conflicting. You can remove it later if the Azure runs prove reliable.
- Pick any language for the function. Python matches the repo. Put the function code in the repo, for example under `azure/`, with a short README on how to deploy and rotate the token.

## Steps

1. Ask Siddharth whether the Azure CLI (`az`), Azure Functions Core Tools (`func`) and `gh` are installed and signed in. If they aren't, ask whether he'd rather use VS Code with the Azure Functions extension. Choose the deploy path from his answer. He is comfortable with the terminal. These commands need network access. If the sandbox blocks them, ask for approval or hand him the exact command to run himself.
2. Write the timer function and its `requirements.txt`/`host.json`.
3. Have him create the fine-grained token, then set it as an app setting.
4. Create the resource group, storage account and Function App on the Consumption plan, then deploy. A US East region is fine.
5. **Verify:** watch `gh api "repos/Venom2074/pogoh-logger/actions/runs?per_page=10"` for `workflow_dispatch` runs arriving about every 10 minutes. Then confirm that new rows appear in `data/2026-10.csv`, or in `2026-11.csv` once November starts in UTC. Also check Function invocation logs for 204 responses from GitHub.
6. Tell him how to check his remaining credit in the Azure portal, and how to stop or delete the Function App if he ever wants to.

## Later ideas (not part of this task)

- Analyze when station 59 and nearby stations sit empty, by weekday and hour, once a couple of weeks of dense data exist. Nearby stations: 33 Schenley Dr, 49 Technology Dr & Bates, 50 Atwood & Bates, 51 Coltart & Forbes.
- Pull POGOH historical trip data (monthly XLSX on WPRDC, https://data.wprdc.org/dataset/pogoh-trip-data) to estimate demand before his own data builds up.
- A personal map and ride-log page for his bike routes from CMU (the Schenley Overlook loop, the Eliza Furnace Trail, and the Mon River loop).

## Local continuation, October 29, 2026

- Repository cloned into `C:\Users\sidds\Documents\Programming\Projects\POGOH Logger`.
- Added `azure/function_app.py`, host configuration, deployment instructions,
  and six passing offline tests (Python 3.12, azure-functions 1.24.0).
  The logger, workflow, fallback schedule, and data files remain unchanged.
- Installed Azure CLI 2.91.0 and Functions Core Tools 4.15.2.
- User explicitly approved provisioning the proposed serverless resources.
  Approval persists; do not ask again for changes necessary within that scope.
- CLI subscription discovery failed. Targeted login succeeded with
  `az login --use-device-code --tenant d34675d2-14cc-4439-a694-5859d3071f43 --skip-subscription-discovery --subscription ea5f08ec-9e4c-4299-ae15-e4db4ec46e30`.
- Verified by ARM: subscription **Azure for Students**, Enabled,
  quotaId AzureForStudents_2018-01-01, **spendingLimit On**. Keep it enabled;
  do not add a card, upgrade the subscription, or assume free-grant eligibility.
- East US is prohibited by subscription policy. Used permitted North Central US.
  Registered Microsoft.Storage and Microsoft.Web for the approved deployment.
- Created these dedicated resources:
  - Group: `rg-pogoh-logger`
  - Storage: `pogohlogger1426377395`, StorageV2, Standard_LRS, TLS 1.2,
    HTTPS only, no public blob access.
  - App: `pogoh-timer-1426377395`, Python 3.12 / Functions v4.
  - Plan: `ASP-rgpogohlogger-b117`, verified **FC1 / FlexConsumption**,
    **512 MB, maximum one instance, alwaysReady []**.
  - Deployment blob container in that storage account.
  No Application Insights or Log Analytics resources were created.
- Deployment succeeded at 2026-10-29T04:42:33Z using Core Tools with an explicit
  `--subscription` argument. Host reports Running and indexes `dispatch_logger`.
  The schedule is `0 3-59/10 * * * *`, runOnStartup false, useMonitor true.
- User created the dedicated token and saved it to the Function App setting
  `GITHUB_TOKEN`. Verified only its nonempty presence; never print settings or
  token values. Suggested token name POGOH Azure Timer and 90-day expiration
  (January 27, 2027); actual selected expiry still needs confirmation.
- Enabled timer by setting `AzureWebJobs.dispatch_logger.Disabled=false`.
  Verified isDisabled false and synchronized triggers with ARM syncfunctiontriggers.
- **Live cadence verification passed.** Two naturally scheduled workflow_dispatch
  runs succeeded exactly ten minutes apart on October 29, 2026:
  - 04:53:01 UTC: https://github.com/Venom2074/pogoh-logger/actions/runs/40820215183
    CSV snapshot (including station 59): 04:53:07 UTC.
  - 05:03:01 UTC: https://github.com/Venom2074/pogoh-logger/actions/runs/40821133949
    CSV snapshot (including station 59): 05:03:08 UTC.
  Azure's timer status also recorded Last 04:53:00 / Next 05:03:00 UTC.
  The temporary read-only monitor (session 10304) has been stopped.
- No durable invocation logs are configured. Azure's timer-monitor blob confirms
  the 04:53 execution. Execution metrics were inconsistent/unavailable; use the
  timer status blob plus successful GitHub runs and CSV rows as verification.
  The handoff's HTTP-status invocation-log check is unavailable without
  separately approved telemetry. End-to-end scheduling and data updates were
  verified successfully; no extra monitoring resources were created.
- Function source, tests, and setup documentation are maintained in this
  repository under `azure/`. Deployment is live and verification passed. The
  GitHub workflow owns snapshot commits; pull subsequent data updates with
  git pull --ff-only.
