Playbook: PRQE Functional

> Mirror of the playbook stored in Devin, kept here for review and history.
> Editing this file changes nothing about a run — apply the change in Devin too.


## Overview
Selects the tests a pull request's diff actually justifies, runs them against the deployed
environment, and reports both the selection reasoning and the result. Publishes two markdown
documents to the CRaaS PR QE Impact API — impact analysis and the functional result — and
returns both to the orchestrator.

Repository-independent: the repo's `.prqe/config.yaml` declares the test runner, the selection
inputs and the rails.

## What's Needed From User
- `pr_id`, `repository`, `appname`
- The deployed service URLs the config declares
- The heartbeat verdict, so results can be attributed correctly
- Optional: `commit`, `environment`, `run_id`

## Procedure
1. Clone the repository and read `.prqe/config.yaml`. If `functional.runner` is null, report the
   stage as unavailable, say what the repo would need, and stop.
2. Collect the change set: commit list, changed files and the full diff against the merge base.
3. Load the selection inputs the config names — `impact.spec_inventory` (the closed vocabulary of
   tests that exist) and `impact.coverage_map` (recorded evidence of what each test exercises).
   Where they are null, fall back to `impact.path_conventions` and lower your confidence
   accordingly.
4. Apply the deterministic rails first:
   - any changed path matching `impact.force_full` ⇒ full suite;
   - any changed path with no mapping and not in `impact.low_signal` ⇒ full suite;
   - `impact.mandatory_specs` are always included, whatever the diff touched;
   - paths under `impact.unmapped_paths` get a representative test **and** an explicit
     coverage-gap entry, never a pretended mapping.
5. Within those rails, select the tests the diff justifies: join changed backend files to the
   endpoints they own (via `impact.backend_mounts`) and then to the tests that called those
   endpoints; join changed frontend files through the coverage map's per-file evidence. Record
   *why* each test was selected.
6. Validate every selected test against the inventory before running anything. An unrecognised
   name means the inventory moved or the selection is wrong — fall back to the full suite rather
   than quietly testing less than you claim.
7. If the selection is empty, skip execution and report the reason. Never pass an empty selector:
   an empty `--grep` matches every test, turning "nothing to run" into "run everything".
8. Write and publish the impact analysis (`impact` report type): selection counts, the reasoning
   per test, rails that fired, and the coverage gaps — the changes the selected tests cannot
   validate.
9. Run the selection with `functional.command` and `functional.select_flag`, in
   `functional.working_dir`, with `functional.env` pointing at the deployed URLs.
10. Write and publish the functional report (`functional` report type): environment, heartbeat
    verdict, selection size, pass/fail/skip counts, duration, every failure with its error, and a
    short section on what a green run does *not* prove.
11. Return the structured output and both markdown documents to the orchestrator.

## Specifications
- Structured output: `selected`, `total`, `passed`, `failed`, `skipped`, `fallback_reason`,
  `coverage_gaps`, `impact_report_id`, `functional_report_id`, `impact_markdown`,
  `functional_markdown`.
- The number of tests executed must equal the number selected; report any discrepancy.
- Deliverable: two published documents and both markdowns returned in-session.
- Validation: every selected test exists in the inventory, and both publishes succeeded.

## Advice and Pointers
- Coverage gaps are often worth more than the pass result. A change no test asserts will pass a
  fully green suite — say so explicitly rather than implying the change was validated.
- Selection reasoning must name the evidence (endpoint, source file, rail), so a reviewer can
  challenge it. "Related to the diff" is not a reason.
- A test map only knows about code the suite already exercises. Absence from the map is a
  coverage gap to report, not permission to skip.
- Attribute failures with the heartbeat verdict: failures on an unhealthy environment are
  environment failures until proven otherwise.

## Forbidden Actions
- Do not run a selection that was not validated against the inventory.
- Do not pass an empty selector to the runner.
- Do not modify tests, application code or the deployed environment to make a run pass.
- Do not claim a change is validated when no test asserts it.
- Do not skip publishing the impact analysis when the functional stage fails — the selection
  reasoning is what makes the failure interpretable.
