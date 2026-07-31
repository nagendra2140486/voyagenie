Playbook: PRQE Orchestrator (P0)

> Mirror of the playbook stored in Devin, kept here for review and history.
> Editing this file changes nothing about a run — apply the change in Devin too.


## Overview
Runs the post-deploy quality chain for a pull request that has already been deployed to an
environment. Calls the PR analysis sub-agent, decides which suites to run from its
recommendation, dispatches the heartbeat, functional and performance sub-agents sequentially,
then commissions a final analysis over everything. Every stage publishes its own markdown to
the CRaaS PR QE Impact API and returns it to this session; this playbook decides and delegates,
it does not write reports itself.

Repository-independent: everything repo-specific is declared in that repository's
`devin/config.yaml`.

## What's Needed From User
- `pr_id` — pull request number, e.g. `12`
- `repository` — e.g. `https://github.com/Cognizant-FrontierAICyberDefense/voyagenie/`
- `appname` — e.g. `voyagenie`
- Deployed environment URLs for the services the repo's config declares, typically
  `backend_url`, `frontend_url` and (where present) `ai_url`
- Optional: `environment` label (e.g. `qa2`), `commit` (the SHA that was deployed)

Reject the run and ask for the missing values if a URL required by the config is absent — the
heartbeat and functional stages cannot target an environment that was not supplied.

## Sub-agent playbooks
Start each child session with the matching playbook id:

| Stage | Playbook | Id |
| --- | --- | --- |
| 1 PR analysis | PRQE PR Analysis (P1) | `playbook-0e757ba5b9b94820842c30bd5e75a8f2` |
| 2 Heartbeat | PRQE Heartbeat | `playbook-d10456a91e6c4157a1396e8fc496fcea` |
| 3 Functional | PRQE Functional | `playbook-f0cdc4ec4d484cd890fa4c1016237c97` |
| 4 Performance | PRQE Performance | `playbook-470ed71b5ba74b898e2409d1e56a5509` |
| 5 Final analysis | PRQE Final Analysis | `playbook-0ed4bea7941b4dc9af330668815b5659` |

Each returns structured output, so read the fields (`recommend`, `verdict`, `passed`, `failed`,
`coverage_gaps`) rather than parsing the child's prose.

## Procedure
1. Clone the repository and read `devin/config.yaml`. If it is missing, stop and tell the user
   which capabilities cannot be resolved without it rather than guessing the repo's layout.
2. Build the ticket map with `python3 devin/tools/tickets.py --repo . --base <base> --head <head>
   --out tickets.json`, or equivalently by reading `git log --no-merges` over the merge-base
   range yourself. It matches `\bVIT\d{5,}\b` in each commit's **title and body** and produces
   `ticket -> commits -> changed files`. Commits carrying no id are collected under `_untracked`.
   Do not parse the `fix(...)` scope: CRaaS writes `fix(VIT0015739): ...` in some repos and
   `fix(security): VIT0016042 - ...` in others, and scope-parsing yields `security` for the
   second form.
3. Record the run context in a scratch file `run-context.md`: pr_id, repository, appname,
   environment, commit, the service URLs, the config path, and the ticket map. Every sub-agent
   prompt must carry all of it, because child sessions run on their own machines and share
   nothing with this one.
4. Start the **PR Analysis** sub-agent as a child session with the run context. Wait for it to
   finish and capture its structured output and markdown.
5. Read the recommendation. Heartbeat always runs. Functional and performance run only if
   recommended **and** the config declares them available (`functional.runner` /
   `performance.runner` non-null). Record an unavailable stage as `skipped` with that reason.
   State the resulting plan in one line before proceeding.
6. Run the **Heartbeat** sub-agent. Capture its verdict (`healthy` / `unhealthy`) and markdown.
   Do not abort on `unhealthy` — continue with the recommended suites, but carry the verdict
   forward so downstream failures can be attributed to the environment.
7. If functional is in the plan, run the **Functional** sub-agent, including the heartbeat
   verdict in its prompt. Capture its markdown and pass/fail counts.
8. If performance is in the plan, run the **Performance** sub-agent after functional has
   finished — never in parallel, because load against the same environment distorts functional
   timings.
9. Run the **Final Analysis** sub-agent with the full markdown of every stage that ran, the
   heartbeat verdict, and the ticket map — it cannot attribute failures to tickets without it.
   It publishes the config's `verdict` report type when everything is green
   and the `failure` type otherwise.
10. Verify every expected report was published: each sub-agent's output must show a successful
    POST. A publish failure means the report is lost, so re-run that stage's publish step rather
    than reporting success. Every stage publishes both `analysis_markdown` and a populated
    `analysis_json`; a stage that published `{}` has thrown its structured result away and must
    republish.
11. Summarise the run for the user: plan chosen, heartbeat verdict, per-stage outcome, per-ticket
    status, the CRaaS document ids, and the single most actionable finding.

## Specifications
- Stages run strictly sequentially: PR analysis → heartbeat → functional → performance → final.
- The ticket map is built once, before any stage runs, and passed unchanged to every sub-agent.
- A PR with no recognisable ticket id is not an error: the run proceeds with every failure
  reported as non-ticket-related.
- Heartbeat always runs, even when the PR analysis recommends nothing else.
- A heartbeat failure never cancels the remaining stages, but must appear in the final report.
- Every stage that runs produces exactly one CRaaS document, using the report types in
  `reports.types` from the config.
- Deliverable: a summary to the user plus the CRaaS document ids for the run.
- Validation: each sub-agent reported a successful publish for its stage, with a non-empty
  `analysis_json`.

## Advice and Pointers
- Sub-agents are child Devin sessions with their own VMs. They cannot reach a `localhost`
  environment on this machine — the URLs must be network-reachable, or the whole chain has to run
  in a single session instead.
- The CRaaS API is POST-only, so reports cannot be read back. Keep each sub-agent's markdown in
  this session; the final analysis depends on it.
- Document ids are `{appname}_{reporttype}_{pr_id}`, so re-running a PR overwrites its previous
  reports, and two stages sharing a report type overwrite each other. Mention this when the user
  expects history.
- If a sub-agent fails outright, record the stage as `error` and continue; a missing stage beats
  an aborted run with no reports at all.
- The ticket pattern is deliberately loose about position but strict about shape. If a repository
  uses a different prefix, change the pattern rather than falling back to reading PR titles or
  branch names — one ticket per PR is exactly what per-ticket attribution is meant to avoid.

## Forbidden Actions
- Do not run functional and performance concurrently.
- Do not skip the heartbeat, whatever the PR analysis recommends.
- Do not write or publish stage reports from this session — each sub-agent owns its own.
- Do not hardcode repository paths, test commands or report types that the config declares.
- Do not infer ticket ids from the PR title or branch name; commits are the only source, because
  attribution needs to know which commit touched which file.
- Do not modify application code, tests or the deployed environment.
