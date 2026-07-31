Playbook: PRQE Heartbeat

> Mirror of the playbook stored in Devin, kept here for review and history.
> Editing this file changes nothing about a run — apply the change in Devin too.


## Overview
Proves a freshly deployed environment is actually up and correctly configured before any suite
runs, so later failures can be attributed to code rather than to the deploy. Publishes its
markdown to the CRaaS PR QE Impact API and returns its verdict to the orchestrator. Read-only:
it must not create, modify or delete application data.

Repository-independent: the repo's `devin/config.yaml` says whether a heartbeat script exists
and, if not, which checks to perform.

## What's Needed From User
- `pr_id`, `repository`, `appname`
- The deployed service URLs the config declares
- Optional: `commit` (deployed SHA), `environment`, `run_id`

Refuse to run without the URLs — there is nothing to check.

## Procedure
1. Clone the repository and read `devin/config.yaml`.
2. If `heartbeat.script` is set, run `heartbeat.command` with the run's URLs substituted, and
   interpret the exit code using `heartbeat.exit_codes`.
3. If `heartbeat.script` is null, perform `heartbeat.checks` yourself with plain HTTP requests,
   in this order:
   - poll each service's health path until it responds or `ready_timeout_seconds` elapses;
   - every declared check, recording status, latency and the reason on failure;
   - the frontend's landing page and the assets its HTML references, since an SPA returns 200
     for any path and a broken build only shows up in the assets;
   - the seed baseline, when `heartbeat.seed_baseline` is set;
   - configuration exposure — confirm no secret value appears in any public payload.
4. If `commit` was supplied and the backend reports a build SHA, confirm they match. If the
   endpoint reports no SHA, record the check as skipped and say so — a stale deploy would
   otherwise pass unnoticed.
5. Decide the verdict: `healthy` when nothing failed, `unhealthy` when any check failed, and
   `not_ready` when the environment never came up at all. Keep those distinct — `not_ready`
   means retry the deploy, not that the code regressed.
6. Write the markdown report: verdict, counts, a table of checks with latency, then a short
   section on what the result means for the later stages.
7. Publish it with the config's `heartbeat` report type, passing `--json-file` with the
   structured result — `heartbeat.json` from the script already has it, otherwise write the same
   fields yourself. The API requires `analysis_json`; sending `{}` throws away every check result
   CRaaS could otherwise query. Note in the report when the report type shares a document id with
   another stage, because the later write wins.
8. Return the structured output plus the markdown to the orchestrator.

## Specifications
- Structured output: `verdict` (`healthy` / `unhealthy` / `not_ready`), `passed`, `failed`,
  `skipped`, `failed_checks`, `report_id`, `heartbeat_markdown`.
- Every check records latency, so a slow-but-correct environment is visible before the suites
  blame the tests.
- Deliverable: one published heartbeat document carrying both the markdown and the JSON, and the
  markdown returned in-session.
- `analysis_json` mirrors the structured output; the two must not disagree.
- Validation: the number of checks reported matches the number executed.

## Advice and Pointers
- Poll rather than fail fast: the orchestrator is triggered on deploy, and a service that needs
  40 seconds to warm is normal.
- Derive GET checks from the API description (e.g. `/api/openapi.json`) when the repo publishes
  one — the check list then follows the API instead of going stale.
- A boolean like `apiKeyConfigured: false` is intended disclosure, not a leak. Scan for secret
  *values*, not for field names containing "key".
- Report an unhealthy environment plainly. The orchestrator continues either way, and the final
  analysis needs the verdict to separate environment failures from regressions.

## Forbidden Actions
- Do not POST, PUT, PATCH or DELETE application data unless the config declares that check as
  explicitly safe.
- Do not print secret values, tokens or API keys in the report.
- Do not fail the run when the environment is merely slow — record it and continue.
- Do not report `healthy` when a check was skipped for lack of information; say it was skipped.
