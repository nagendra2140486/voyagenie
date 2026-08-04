# PRQE tooling

Everything the shared PRQE playbooks need from this repository lives here.

```
devin/
  config.yaml       what the playbooks read: paths, commands, report types
  tools/            stdlib-only scripts the stages invoke
    heartbeat.py                post-deploy availability gate
    heartbeat-expectations.json this repo's expected data, edited per repo
    publish_report.py           POSTs a markdown report to the CRaaS API
    agent_log.py                POSTs one run-stats row per stage
    tickets.py                  ticket -> commits -> files from commit messages
  playbooks/        mirrors of the live playbooks, for review and history
```

## Onboarding another repository

1. Copy `devin/tools/` across.
2. Copy `devin/config.yaml` and edit every path, command and report type to match that repo.
3. Rewrite `tools/heartbeat-expectations.json` — **every heartbeat check is declared there**, not
   in `heartbeat.py`, so this file is the whole port: services and their health paths, the API
   surface (an OpenAPI document to enumerate, or an explicit endpoint list with expected statuses),
   seed baselines, config assertions and the CORS probe. A copied file asserts the wrong things
   while still exiting 0.
4. Declare a capability as `null` in the config when the repo does not have it. A stage then
   reports itself unavailable with a reason instead of improvising a command that does not exist.

Nothing outside this folder is repo-specific to the playbooks, and the playbooks name no paths of
their own, so those four steps are the whole onboarding.

## The playbook mirrors are copies, not the source

The playbooks Devin runs are stored in Devin and edited in its UI. The files in `playbooks/` exist
so changes are reviewable in a PR and readable next to the config they depend on. **Editing them
changes nothing about a run** — apply the change in Devin as well, or the two will drift.

## Scripts

Each script is stdlib-only and takes its inputs as flags, so a stage can run it without knowing
anything about the repository:

```bash
python3 devin/tools/heartbeat.py --backend-url ... --frontend-url ... --out-dir reports/run \
  --expect provider=mock          # values for expectations the file declares as from_flag
python3 devin/tools/tickets.py --repo . --base origin/main --head HEAD --out tickets.json
python3 devin/tools/publish_report.py --file report.md --reporttype verdict-report \
  --pr-id 18 --appname voyagenie --repository https://github.com/.../voyagenie/
python3 devin/tools/agent_log.py --appname voyagenie --pr-id 18 --run-id 20260804T0410 \
  --stage functional --status passed --started-at <epoch> --acus 4.8
```

`publish_report.py` deliberately has no default `--appname` or `--repository`: CRaaS document ids
are `{appname}_{reporttype}_{pr_id}`, so a stale default in a copied script would file this repo's
reports over another's.

## Reports and run stats go to different places

`publish_report.py` writes what a stage **found**; `agent_log.py` writes what it **cost** — status,
duration, ACUs, the document ids it published. They are deliberately keyed the opposite way round:

| | Id | On a re-run |
| --- | --- | --- |
| Report | `{appname}_{reporttype}_{pr_id}` | overwrites |
| Agent log | `{appname}_{pr_id}_{stage}_{run_id}` | accumulates |

Overwriting is right for a report and fatal for cost data — the third run would erase the first
two, and a trend is the only thing that makes the number worth having. Every stage writes its own
row as its last action, and the orchestrator adds a run total; a failed write exits 0, so telemetry
cannot fail the stage that produced it.

The final report now uses **one type for every colour** (`verdict-report`), rather than switching to
`failure-analysis` on red: a PR whose verdict changed between runs used to leave its old document
behind under the other id, with nothing marking which was current. Read the colour from the
`verdict` field. Documents published before the change (`voyagenie_failure-analysis_25`,
`voyagenie_failure-analysis_18`) still resolve — the type remains valid in the API.
