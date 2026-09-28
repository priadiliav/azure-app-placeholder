# azure-app-placeholder

Minimal placeholder app: a React UI with buttons that call a .NET API and show the response. Some buttons cause known errors on purpose. Used as a target for a future self-healing/monitoring project.

- `api/` — .NET 10 minimal Web API (`api.csproj`, `api.slnx`) with Application Insights logging.
- `ui/` — React + TypeScript (Vite), one button for each API endpoint below.
- `infra/` — Bicep to deploy both to Azure (App Service for the API, Static Web App for the UI).

## API endpoints

| Endpoint | Result | Log level |
| --- | --- | --- |
| `GET /api/status` | `200 OK` | Information |
| `GET /api/simulate/bad-request` | `400 Bad Request` (ProblemDetails) | Warning |
| `GET /api/simulate/not-found` | `404 Not Found` (ProblemDetails) | Warning |
| `GET /api/simulate/server-error` | `500` from an unhandled `InvalidOperationException` | Error + exception |
| `GET /api/simulate/slow?delayMs=5000` | `200 OK` after a delay (0–30000 ms, default 5000) | Warning |

## Logging (Application Insights)

The API uses the Azure Monitor OpenTelemetry distro (`Azure.Monitor.OpenTelemetry.AspNetCore`). It sends requests, dependencies, exceptions and `ILogger` logs to Application Insights.

It is enabled only when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set. `infra/main.bicep` sets this on the App Service. Locally, nothing is sent unless you set the variable yourself.

Useful queries in Application Insights → Logs:

```kusto
// Failed requests by endpoint
requests
| where success == false
| summarize count() by name, resultCode

// Exceptions from the 500 endpoint
exceptions
| where outerMessage has "Simulated"

// Warning and error logs
traces
| where severityLevel >= 2
```

## Run locally

API (from `api/`):

```
dotnet run --launch-profile https
```

Runs on `https://localhost:7085`.

UI (from `ui/`):

```
npm install
npm run dev
```

Runs on `http://localhost:5173` and reads the API URL from `ui/.env` (`VITE_API_BASE_URL`).

## Deploy to Azure

```
az group create -n <resource-group> -l westeurope
az deployment group create -g <resource-group> -f infra/main.bicep -p infra/main.bicepparam
```

Then:

1. Publish the API to the App Service named in the deployment output (`apiAppName`), e.g. `dotnet publish -c Release` + zip deploy, or `az webapp deploy`.
2. Build the UI with `VITE_API_BASE_URL` set to the deployment's `apiUrl` output, then deploy `ui/dist` to the Static Web App (`staticWebAppName`), e.g. via the [SWA CLI](https://azure.github.io/static-web-apps-cli/) or GitHub Actions.
