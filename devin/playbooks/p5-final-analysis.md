Playbook: PRQE Final Analysis

> Mirror of the playbook stored in Devin, kept here for review and history.
> Editing this file changes nothing about a run — apply the change in Devin too.


## Overview
Reads every stage report from one PRQE run, attributes each failure to a root cause **and to the
remediation ticket that caused it**, and issues the run's verdict. Publishes one markdown document
to the CRaaS PR QE Impact API — the verdict report when everything is green, the failure analysis
when anything failed — and returns the verdict to the orchestrator. The document ends with a
machine-readable verdict block that CRaaS parses.

Repository-independent: the repo's `.prqe/config.yaml` supplies the report types.

## What's Needed From User
- `pr_id`, `repository`, `appname`
- The markdown of every stage that ran: PR analysis, heartbeat, impact analysis, functional,
  performance
- The heartbeat verdict and which stages were skipped, with reasons
- The **ticket map** from the orchestrator: `ticket -> commits -> changed files`, including the
  `_untracked` bucket for commits with no ticket id
- Optional: `commit`, `environment`, `run_id`

## Procedure
1. Read `.prqe/config.yaml` for the `verdict` and `failure` report types.
2. Build the stage table: every stage, its status (`passed` / `failed` / `skipped` / `error`),
   its key numbers and its CRaaS document id. A skipped stage must carry the reason it was
   skipped — an unexplained gap reads as a silent pass.
3. Attribute each failure to a cause rather than restating it:
   - **environment** — the heartbeat was unhealthy, or failures cluster on connectivity, 5xx,
     timeouts and missing assets;
   - **regression** — the heartbeat was healthy and the failures fall in code the diff touched;
   - **test defect or flake** — the failure is in the test rather than the product;
   - **unknown** — say so plainly instead of picking the most convenient cause.
4. Group failures that share a root cause. Twenty tests failing on one broken endpoint is one
   finding, not twenty.
5. **Attribute every failure to a ticket.** For each failing test, resolve the source files it
   exercises (the coverage map's `bySourceFile` and `byEndpoint`, or the config's
   `impact.path_conventions` where no map exists) and intersect them with each ticket's changed
   files.
   - One ticket matches → the failure belongs to it.
   - Several match → judge from the diff which change plausibly caused the failure. If the
     judgement is genuinely undecidable, attribute the failure to **all** matching tickets and
     mark each `failed`; never pick one arbitrarily to keep the table tidy.
   - None match → `non_ticket_related`, including anything traced to `_untracked` commits.
6. Set each ticket's status:
   - `failed` — at least one failure attributed to it;
   - `passed` — it has covering tests and none of them failed;
   - `no_coverage` — no test exercises any file it touched. Never report this as `passed`: for a
     security remediation, "nothing asserts this" and "this is verified" are opposite findings.
   Also record whether the fix's actual security property is asserted, rather than only that
   nothing else broke — a ticket whose tests would still pass if the fix were reverted is not
   verified, and the report must say so.
7. Carry forward the findings that survive a green run: defects the PR analysis named, and the
   coverage gaps the impact analysis reported. A change no test asserts is not validated by a
   green suite, and this is the last place anyone will read that.
8. Decide the verdict: green only when every stage that ran passed. A skipped stage does not
   block green, but must be visible in the table. Tickets marked `no_coverage` do not make the
   run red; they belong in the coverage gaps and the next action.
9. Write the markdown: verdict first with a one-line justification, stage table, **ticket table**,
   failure attribution, findings that survive, coverage gaps, and a single recommended next
   action.
10. Append the verdict block last: an HTML comment marker `<!-- prqe-verdict -->` followed by one
    fenced ```json block, in the schema below. Emit exactly one such block per report and strip
    backticks from any embedded test name or error message, or the fence closes early.
11. Publish with the `verdict` report type when green, the `failure` type otherwise. Where those
    types collide with another stage's document id, note it — the later write wins.
12. Return the structured output plus the markdown to the orchestrator.

## Verdict block schema

```json
{
  "schema_version": 1,
  "pr_id": "18", "appname": "voyagenie", "commit": "558db74", "verdict": "green",
  "tickets": [
    {"ticket_id": "VIT0016042", "status": "passed", "commits": ["1885c73"],
     "files": ["backend/src/routes/contact.ts"],
     "tests_covering": 1, "tests_passed": 1, "tests_failed": 0, "failed_tests": [],
     "security_property_asserted": false,
     "note": "Covering test asserts POST still works; nothing asserts the removed GET is gone."}
  ],
  "non_ticket_failures": {"count": 0, "tests": []},
  "regression_summary": {"availability": "Pass", "functional_regression": "Pass",
                         "performance_regression": "NA"},
  "test_case_summary": {"total_impacted": 35, "total_passed": 35, "total_failed": 0,
                        "selection_mode": "full_suite", "selection_reason": "...",
                        "rail_added_tests": 0},
  "failed_tests": [{"test": "...", "error": "...", "ticket_id": "VIT0016042",
                    "attribution": "regression"}],
  "coverage_gaps": ["..."],
  "heartbeat": {"verdict": "healthy", "passed": 22, "failed": 0, "skipped": 1},
  "performance": {"verdict": "pass", "p95_ms": 10.56, "failed_requests": 0}
}
```

`regression_summary` values are `Pass`, `Fail` or `NA`: `availability` from the heartbeat
(unhealthy ⇒ `Fail`, and ticket statuses stay as measured so a deploy fault is never read as an
unfixed vulnerability), `functional_regression` from the functional stage, and
`performance_regression` `NA` when performance did not run.

`test_case_summary.total_impacted` counts only the tests the diff selected. Tests added by a rail
(mandatory security or guardrail specs that run on every PR) are reported in `rail_added_tests`,
because counting them as impacted overstates what the change actually touched.

## Specifications
- Structured output: `verdict` (`green` / `red`), `root_causes`, `stages`, `tickets`,
  `coverage_gaps`, `next_action`, `report_id`, `final_markdown`.
- Every failed stage has exactly one attributed cause; every failing test has a ticket id or
  `non_ticket_related`.
- Every ticket in the map appears in the table and the JSON, including ones with no coverage.
- Deliverable: one published document, ending in exactly one verdict block, and the markdown
  returned in-session.
- Validation: the stage table accounts for all five stages, including the skipped ones, and the
  verdict block parses as JSON.

## Advice and Pointers
- The verdict must be readable in five seconds: state it before the detail.
- Environment failures and regressions demand different actions — retry the deploy versus fix the
  code. Getting that attribution wrong wastes the most time of anything in this chain.
- Do not soften a green verdict into a warning, or a red one into "mostly fine". Report the
  verdict, then the caveats.
- The most valuable line in this report is usually the next action. Make it specific: which file,
  which change, which stage to re-run.
- For vulnerability remediations the coverage gap *is* the finding. A green run against a ticket
  with no covering test says only that nothing else broke; say that in those words rather than
  letting `passed` imply the vulnerability is closed.
- Attribution is only as good as the coverage map. Where a repo has none, path conventions resolve
  backend files and resolve nothing for frontend ones — state which mechanism produced each
  attribution so a wrong one can be challenged.

## Forbidden Actions
- Do not re-run tests or start services; this stage reasons over reports only.
- Do not report green when a stage errored — an error is not a skip.
- Do not attribute a failure to flake without evidence.
- Do not report a ticket as `passed` when no test exercises the files it changed.
- Do not drop a failure that maps to no ticket; report it as non-ticket-related.
- Do not emit more than one fenced `json` block, or place the verdict block anywhere but last.
- Do not omit a stage from the table because it was skipped.
- Do not comment on the pull request.
