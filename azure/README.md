# Azure timer for POGOH

Deployment status: **deployed, enabled, and verified**.
The user approved resource creation on October 29, 2026. ARM verified the Azure
for Students subscription is enabled with its **spending limit On**.
Azure only dispatches the existing `log.yml` workflow on `main`; the logger,
data, concurrency group, and GitHub fallback schedule are unchanged.

The six-field UTC schedule `0 3-59/10 * * * *` runs at minutes 03, 13, 23, 33,
43, and 53 (144 times/day; 4,320 in 30 days). Startup does not dispatch. A late
timer makes one current snapshot rather than backfilling missed observations.
The storage-backed timer monitor coordinates instances. Network requests time
out after 30 seconds. No automatic retry is used: an ambiguous timeout might
already have queued a workflow. The next timer occurrence tries again.

## Approval and costs

Ask Siddharth before creating, changing, or deleting **any Azure resource or
GitHub token/setting**, including deploying code or changing app settings.
The commands below are a reviewable plan, not authorization to run them.

Proposed resources, all dedicated to this project:

| Resource | Proposed configuration |
| --- | --- |
| Resource group | `rg-pogoh-logger`, North Central US (allowed by subscription) |
| Storage account | `pogohlogger1426377395`, StorageV2, Standard_LRS, HTTPS/TLS 1.2, no public blobs |
| Function App | `pogoh-timer-1426377395`, Python 3.12, Functions v4 |
| Hosting plan created by Azure | Flex Consumption (`FC1`), 512 MB, max one instance, zero always-ready instances |
| Deployment container | Created by the Function App tooling in the same storage account |

Flex Consumption is the current serverless choice for Python. The handoff's
classic Linux Consumption instructions are legacy; do not substitute a
Dedicated/App Service tier or Premium plan. The `Microsoft.Web/serverfarms`
plan object that the CLI creates must be **FC1**, with no always-ready capacity.
It is required hosting metadata, not a continuously running dedicated server.
Review the final choice with Siddharth before resource creation. If the student
subscription disallows Flex or East US, stop and review another permitted region
or serverless option; never upgrade the subscription or choose a paid tier.

There are execution and storage meters. Do not promise a zero-dollar Azure bill:
student credit can be consumed, and free grants depend on subscription eligibility.
Keep the Azure for Students spending limit enabled, with no card or pay-as-you-go
upgrade. This preserves the no-out-of-pocket constraint. Do not add always-ready
instances, Application Insights, Log Analytics, VMs, or other services implicitly.

## Terminal setup and read-only preflight

On Windows, install Azure CLI and Functions Core Tools v4 if missing, then open
a new PowerShell terminal so PATH refreshes. GitHub CLI is optional for public
verification; its login is independent of the timer's dedicated token.

```powershell
winget install --exact --id Microsoft.AzureCLI --source winget
winget install --exact --id Microsoft.Azure.FunctionsCoreTools --source winget
az version
func --version
az login --use-device-code
az account list --query "[].{name:name,id:id,state:state}" --output table
```

If subscription discovery returns no subscriptions despite the portal showing
the student subscription, target it directly:

```powershell
az login --use-device-code --tenant d34675d2-14cc-4439-a694-5859d3071f43 --skip-subscription-discovery --subscription ea5f08ec-9e4c-4299-ae15-e4db4ec46e30
```

Choose the Azure for Students subscription, then inspect it without mutation:

```powershell
$subscription = '<Azure for Students subscription ID>'
az account show --subscription $subscription --query '{name:name,state:state,spendingLimit:subscriptionPolicies.spendingLimit}' --output json
az rest --method get --url "https://management.azure.com/subscriptions/${subscription}?api-version=2022-12-01" --query '{name:displayName,state:state,spendingLimit:subscriptionPolicies.spendingLimit}' --output json
az functionapp list-flexconsumption-locations --subscription $subscription --output table
az functionapp list-flexconsumption-runtimes --location northcentralus --runtime python --subscription $subscription --output table
az group list --subscription $subscription --query '[].{name:name,location:location}' --output table
az provider show --namespace Microsoft.Web --subscription $subscription --query registrationState --output tsv
az provider show --namespace Microsoft.Storage --subscription $subscription --query registrationState --output tsv
```

Also check the subscription's allowed-region policies in the portal. A listed
region alone does not guarantee student access or quota. If a provider needs
registration, include that registration in the approved provisioning scope.

## Create and deploy (only after explicit approval)

Record the approved subscription and exact globally unique names first. Keep the
resource group dedicated so cleanup cannot remove unrelated projects.

```powershell
$subscription = '<approved student subscription ID>'
$group = 'rg-pogoh-logger'
$region = 'northcentralus'
$storage = 'pogohlogger1426377395'
$appName = 'pogoh-timer-1426377395'

az group create --name $group --location $region --subscription $subscription --output none
az storage account create --name $storage --resource-group $group --location $region --subscription $subscription --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 --allow-blob-public-access false --output none
az functionapp create --name $appName --resource-group $group --storage-account $storage --subscription $subscription --flexconsumption-location $region --runtime python --runtime-version 3.12 --functions-version 4 --instance-memory 512 --maximum-instance-count 1 --disable-app-insights true --https-only true --output none
```

Do not set any `--always-ready-instances`. Inspect the created hosting plan and
scale configuration before continuing; stop if they differ from approval:

```powershell
az functionapp show --name $appName --resource-group $group --subscription $subscription --query '{state:state,plan:serverFarmId,scale:functionAppConfig.scaleAndConcurrency}' --output json
az appservice plan list --resource-group $group --subscription $subscription --query '[].{name:name,sku:sku.name,tier:sku.tier}' --output table
```

### Dedicated token (Siddharth creates it after approval)

Open [GitHub fine-grained tokens](https://github.com/settings/personal-access-tokens/new).
Choose owner **Venom2074**, **Only select repositories: pogoh-logger**, and
**Actions: Read and write**. Metadata read access is implicit; add no other
permissions. Choose a finite expiration date and record that date (never the
token) in the deployment record below. Do not reuse a broad `gh` login token.

In the Function App's Azure portal **Settings > Environment variables > App
settings**, add `GITHUB_TOKEN` with the token value, then apply. Keep the token
only in this app setting; do not paste it into chat, source, local.settings.json,
shell command arguments/history, or GitHub repository secrets. Do not print all
app settings: they include this token and storage credentials.

With an approved deployment and the correct Azure CLI subscription selected,
publish **from this `azure` directory**, not the repository root:

```powershell
az account set --subscription $subscription
Push-Location azure
try {
    func azure functionapp publish $appName --python --subscription $subscription
} finally {
    Pop-Location
}
```

Do not use `--publish-local-settings` or `--no-build`. Remote build installs
requirements for Linux. No GitHub repository setting or workflow change is needed.

## Verify

1. Confirm `dispatch_logger` is indexed with a `timerTrigger` binding:
   `az functionapp function list --name $appName --resource-group $group --subscription $subscription --output table`.
2. Watch at least two consecutive expected UTC slots. In PowerShell, the public API needs
   no login and does not expose the dispatch token:

   ```powershell
   $runs = Invoke-RestMethod 'https://api.github.com/repos/Venom2074/pogoh-logger/actions/workflows/log.yml/runs?event=workflow_dispatch&per_page=10'
   $runs.workflow_runs | Select-Object created_at,status,conclusion,html_url
   ```

   Alternatively, after signing in to `gh`:
   `gh api 'repos/Venom2074/pogoh-logger/actions/runs?per_page=10'`.
   Confirm `workflow_dispatch`, successful completion, and about ten minutes
   between runs. GitHub can still queue runners after Azure dispatches.
3. Inspect the corresponding `Snapshot` commits and latest monthly CSV on GitHub.
   For October 2026 use `data/2026-10.csv`; after November begins in UTC use
   `data/2026-11.csv`. Distinct `snapshot_utc` values should keep increasing,
   including station 59. Do not run the logger locally as a deployment test:
   that would edit the checked-out data files.
4. The function emits `GitHub workflow dispatch accepted: HTTP 204` (or 200).
   Errors fail the invocation without logging credentials. **Durable invocation
   logs are not configured in this minimal deployment**, because Application
   Insights is disabled. The handoff's cloud invocation-log check remains open
   unless separately approved telemetry is available; successful workflow runs
   and CSV commits verify the end-to-end path. Ask before adding any monitoring
   resources, and review their ingestion costs first.

Offline tests (from the repository root; the SDK is needed only for the Azure
function, and `log_status.py` remains standard-library only):

```powershell
uv venv .venv --python 3.12
uv pip install --python .venv/Scripts/python.exe -r azure/requirements.txt
.venv/Scripts/python.exe -m unittest discover -s azure/tests -v
```

`local.settings.example.json` disables the timer for accidental local host runs.
Its development-storage setting needs Azurite if you explicitly run `func start`;
offline tests need neither Azurite nor Azure. A local host run is not proof of
successful cloud deployment.

## Rotate, inspect credit, and stop

Before expiration, obtain approval, create a replacement with the same repository
scope and permission, update `GITHUB_TOKEN` in the Azure portal, confirm the next
dispatch and CSV commit, and revoke the old token. Record the new expiration.

Check **Azure portal > Cost Management + Billing**, scoped to the student
subscription, and the [Azure Sponsorships balance portal](https://www.microsoftazuresponsorships.com/Balance).
Keep its spending limit enabled; credit exhaustion/expiry can stop collection.

After approval, stop the clock with:
`az functionapp stop --name $appName --resource-group $group --subscription $subscription`.
Storage can still consume credit while the app is stopped. For complete cleanup,
review `az resource list --resource-group $group --subscription $subscription --output table`,
then, **only with explicit deletion approval**, use
`az group delete --name $group --subscription $subscription`.
The existing GitHub schedule remains the fallback.

## Deployment record

- Subscription: `ea5f08ec-9e4c-4299-ae15-e4db4ec46e30`, Azure for Students,
  Enabled, spendingLimit **On** (verified by ARM).
- Directory: `d34675d2-14cc-4439-a694-5859d3071f43`.
- Region: **northcentralus**; East US is prohibited by subscription policy.
- Group: **rg-pogoh-logger**.
- Storage: **pogohlogger1426377395**.
- Function App: **pogoh-timer-1426377395**.
- Plan: **ASP-rgpogohlogger-b117**, FC1 / FlexConsumption, 512 MB,
  maximum one instance, zero always-ready instances.
- Resource creation approved October 29, 2026; deployment completed
  **2026-10-29T04:42:33Z**. Timer enabled and synchronized.
- `GITHUB_TOKEN` is configured. Recommended expiry: January 27, 2027 (90 days);
  actual selected date needs confirmation.
- First verified run: [04:53:01 UTC](https://github.com/Venom2074/pogoh-logger/actions/runs/40820215183),
  successful; station 59 CSV snapshot at **04:53:07 UTC**.
- Second verified run: [05:03:01 UTC](https://github.com/Venom2074/pogoh-logger/actions/runs/40821133949),
  successful; station 59 CSV snapshot at **05:03:08 UTC**. Dispatch timestamps
  are exactly ten minutes apart. Both runs used workflow_dispatch.
- Cloud HTTP-status invocation logs: not retained; no extra telemetry resources.

References: [timer trigger](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer),
[Flex Consumption setup](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-how-to),
[pricing](https://learn.microsoft.com/azure/azure-functions/pricing),
[student spending limit](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit),
[workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).
