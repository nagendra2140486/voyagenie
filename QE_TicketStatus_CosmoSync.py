"""
End-to-End Flow:

1. Fetch PR document from DB1 (agent_status)
2. Extract all ticketIds
3. Extract failedTicketIds from FinalVerdict agent
4. Build ticket status map (pass/fail)
5. Update ticket documents in DB2 (ticket-state)
"""

from azure.cosmos import CosmosClient, exceptions
import os
import json
import sys

# =========================================================
# CONFIG!!!1
# =========================================================

# ---- DB1 (Agent Status) ----
COSMOS_ENDPOINT_DB1 = "https://craas-dev-cosmos.documents.azure.com:443/"
COSMOS_KEY_DB1 = os.environ.get("COSMOS_KEY_DB", "")

DATABASE_NAME_DB1 = "craas_qea"
CONTAINER_NAME_DB1 = "agent_status"

# ---- DB2 (Ticket State) ----
COSMOS_ENDPOINT_DB2 = "https://craas-dev-cosmos.documents.azure.com:443/"
COSMOS_KEY_DB2 = os.environ.get("COSMOS_KEY_DB", "")

DATABASE_NAME_DB2 = "craas"
CONTAINER_NAME_DB2 = "ticket-state"

# ---- INPUT ----
PR_NUMBER = None

if len(sys.argv) > 1:
    PR_NUMBER = sys.argv[1]
if not PR_NUMBER:
    print("Provide PR number)", file=sys.stderr)
    sys.exit(1)

if not COSMOS_KEY_DB1:
    print("COSMOS_KEY_DB environment variable not set", file=sys.stderr)
    sys.exit(1)


# =========================================================
# CONNECTION!
# =========================================================

def get_container(endpoint, key, db_name, container):
    client = CosmosClient(endpoint, credential=key)
    db = client.get_database_client(db_name)
    return db.get_container_client(container)


# =========================================================
# STEP 1: FETCH PR DOCUMENT!!!!!!!!!!!!
# =========================================================

def get_pr_document(container, retries=20, delay=30):
    import time
    query = """
    SELECT * FROM c
    WHERE c.id = @id
    """
    params = [
        {"name": "@id", "value": PR_NUMBER},
    ]
    for attempt in range(1, retries + 1):
        results = list(
            container.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            )
        )
        if results:
            print(f"PR document found on attempt {attempt}")
            return results[0]
        print(f"Attempt {attempt}/{retries}: PR document not found yet, retrying in {delay}s...")
        time.sleep(delay)

    raise Exception(f"PR document not found after {retries} attempts -> id='{PR_NUMBER}'")


# =========================================================
# STEP 2: NORMALIZATION
# =========================================================

def normalize_list(value):
    if value is None:
        return []

    if isinstance(value, list):
        return [str(v).strip() for v in value]

    if isinstance(value, str):
        return [v.strip() for v in value.split(",")]

    return [str(value).strip()]


# =========================================================
# STEP 3: BUILD STATUS MAP
# =========================================================

def build_ticket_status_map(pr_doc):

    ticket_ids = pr_doc.get("ticketIds", [])

    print("DEBUG ticketIds ->", ticket_ids)

    if not isinstance(ticket_ids, list):
        ticket_ids = [str(ticket_ids)]

    ticket_ids = [str(t).strip() for t in ticket_ids]

    final_agent = None

    for agent in pr_doc.get("agents", []):
        if agent.get("agentName") == "FinalVerdict":
            final_agent = agent
            break

    if not final_agent:
        raise Exception("FinalVerdict agent not found")

    failed_ids = final_agent.get("details", {}).get("failedTicketIds", [])

    print("DEBUG failedTicketIds ->", failed_ids)

    if not isinstance(failed_ids, list):
        failed_ids = [str(failed_ids)]

    failed_ids = [str(f).strip() for f in failed_ids]

    failed_set = set(failed_ids)

    ticket_map = {}

    for tid in ticket_ids:
        if tid in failed_set:
            ticket_map[tid] = "fail"
        else:
            ticket_map[tid] = "pass"

    print("DEBUG final ticket_map ->", ticket_map)

    return ticket_map


# =========================================================
# STEP 4: GET + UPDATE TICKET
# =========================================================

def get_ticket_doc(container, ticket_id):
    query = "SELECT * FROM c WHERE c.ticket_id = @tid"

    results = list(
        container.query_items(
            query=query,
            parameters=[{"name": "@tid", "value": ticket_id}],
            enable_cross_partition_query=True
        )
    )

    return results[0] if results else None


def update_ticket(container, ticket_id, status):
    doc = get_ticket_doc(container, ticket_id)

    if not doc:
        print(f"Ticket not found: {ticket_id}")
        return

    doc["phase"] = "regression"
    doc["regressionstatus"] = "failed" if status == "fail" else "passed"

    container.replace_item(item=doc["id"], body=doc)

    print(f"Updated: {ticket_id} -> {doc['regressionstatus']}")


# =========================================================
# MAIN
# =========================================================

def main():
    try:
        print("Connecting to DB1...")
        db1 = get_container(
            COSMOS_ENDPOINT_DB1,
            COSMOS_KEY_DB1,
            DATABASE_NAME_DB1,
            CONTAINER_NAME_DB1
        )

        print("Connecting to DB2...")
        db2 = get_container(
            COSMOS_ENDPOINT_DB2,
            COSMOS_KEY_DB2,
            DATABASE_NAME_DB2,
            CONTAINER_NAME_DB2
        )

        print(f"\nFetching PR document: {PR_NUMBER}")
        pr_doc = get_pr_document(db1)

        print("PR retrieved")

        print("\nParsing PR data...")
        ticket_map = build_ticket_status_map(pr_doc)

        print("\nTicket Status Map:")
        print(ticket_map)

        print("\nUpdating tickets...\n")

        for ticket_id, status in ticket_map.items():
            update_ticket(db2, ticket_id, status)

        print("\nExecution Completed")

    except Exception as e:
        print(f"\nError occurred: {str(e)}")




# =========================================================
# TICKET-WISE SORT: Fetch agent_status → generate UI JSON → insert into ticket_teststatus
# =========================================================

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)
logging.getLogger("azure.cosmos._cosmos_http_logging_policy").setLevel(logging.WARNING)
logging.getLogger("azure.cosmos").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

SOURCE_CONTAINER = "agent_status"
TARGET_CONTAINER = "ticket_teststatus"


def fetch_agent_json(pr_id: str) -> dict:
    try:
        container = get_container(COSMOS_ENDPOINT_DB1, COSMOS_KEY_DB1, DATABASE_NAME_DB1, SOURCE_CONTAINER)
        query = "SELECT * FROM c WHERE c.id = @pr_id"
        parameters = [{"name": "@pr_id", "value": pr_id}]
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        if not items:
            logger.error(f"No document found for pr_id={pr_id}")
            return {}
        logger.info(f"Fetched document for pr_id={pr_id}")
        return items[0]
    except exceptions.CosmosHttpResponseError as e:
        logger.error(f"Cosmos DB fetch error: {e.message}")
        return {}


def insert_tickets(pr_id: str, ui_json: dict) -> bool:
    try:
        container = get_container(COSMOS_ENDPOINT_DB1, COSMOS_KEY_DB1, DATABASE_NAME_DB1, TARGET_CONTAINER)
        tickets = ui_json.get("tickets", [])

        if not tickets:
            logger.warning(f"No tickets found in ui_json for pr_id={pr_id}. Nothing to insert.")
            return False

        for bug in tickets:
            bug_doc = {
                "id": bug["ticket_id"],
                "pr_id": pr_id,
                "pr_url": ui_json.get("prUrl"),
                "appname": ui_json.get("appname"),
                "regression_summary": bug.get("regression_summary", ui_json.get("regression_summary")),
                "ticket_id": bug["ticket_id"],
                "repo": bug.get("repo"),
                "committed_files": bug.get("committed_files", []),
                "test_case_summary": bug.get("test_case_summary", {}),
                "failed_test_cases": bug.get("failed_test_cases", []),
                "defect_ids": bug.get("defect_ids", [])
            }
            container.upsert_item(bug_doc)
            logger.info(f"Upserted: id={bug['ticket_id']} | failed_tcs={len(bug.get('failed_test_cases', []))}")

        logger.info(f"Total {len(tickets)} bug document(s) upserted into {TARGET_CONTAINER}")
        return True

    except exceptions.CosmosHttpResponseError as e:
        logger.error(f"Cosmos DB insert error: {e.message}")
        return False


def get_agent(agent_json: dict, name: str) -> dict:
    for agent in agent_json.get("agents", []):
        if agent["agentName"] == name:
            return agent.get("details", {})
    return {}


def generate_ui_json(agent_json: dict) -> dict:
    fr = get_agent(agent_json, "FunctionalRegression")
    functional_regression_status = "Pass" if fr.get("failed", 0) == 0 else "Fail"

    ui_json = {
        "id": agent_json.get("id"),
        "runId": agent_json.get("runId"),
        "prUrl": agent_json.get("prUrl"),
        "appname": agent_json.get("appname"),
        "regression_summary": {
            "availability": "Pass",
            "functional_regression": functional_regression_status,
            "functional_coverage_impact":"100%",
            "performance_regression": "NA"
        },
        "buildId": agent_json.get("buildId"),
        "releaseId": agent_json.get("releaseId"),
        "triggerType": agent_json.get("triggerType"),
        "tickets": []
    }

    cbr = get_agent(agent_json, "CommitBlastRadius")
    commits = cbr.get("commits", [])

    fa = get_agent(agent_json, "FailureAnalysis")
    analyses = fa.get("analyses", [])

    # All failed TC IDs from regression (includes TCs outside blast radius)
    fr = get_agent(agent_json, "FunctionalRegression")
    all_regression_failed_tc_ids = {
        tc["testCaseId"] for tc in fr.get("failedTestCases", [])
    }

    bug_to_failed_tcs = {}
    for analysis in analyses:
        tc_id = analysis.get("tc_id")
        tc_title = analysis.get("tc_title", "")
        for bug in analysis.get("tickets", []):
            bid = bug["ticket_id"]
            if bid not in bug_to_failed_tcs:
                bug_to_failed_tcs[bid] = []
            if not any(t["testcase_id"] == tc_id for t in bug_to_failed_tcs[bid]):
                bug_to_failed_tcs[bid].append({
                    "testcase_id": tc_id,
                    "testcase_description": tc_title
                })

    rd = get_agent(agent_json, "RaiseDefect")
    bug_to_defects = {}
    if rd and rd.get("defects"):
        for defect in rd.get("defects", []):
            bid = defect.get("ticket_id")
            defect_id = defect.get("defect_id")
            if bid and defect_id:
                if bid not in bug_to_defects:
                    bug_to_defects[bid] = []
                bug_to_defects[bid].append(defect_id)

    for commit in commits:
        ticket_id = commit.get("ticket_id")
        impacted_tcs = commit.get("impacted_test_cases", [])
        impacted_tc_ids = {tc["tc_id"] for tc in impacted_tcs}

        failed_tcs = bug_to_failed_tcs.get(ticket_id, [])
        failed_tc_ids = {t["testcase_id"] for t in failed_tcs}

        # Only TCs failed within this ticket's blast radius
        blast_failed_ids = impacted_tc_ids.intersection(failed_tc_ids)
        scoped_failed_tcs = [
            t for t in failed_tcs if t["testcase_id"] in blast_failed_ids
        ]

        total_impacted = len(impacted_tc_ids)
        total_failed = len(blast_failed_ids)
        total_passed = total_impacted - total_failed

        ticket_functional_regression = "Pass" if total_failed == 0 else "Fail"

        ui_json["tickets"].append({
            "ticket_id": ticket_id,
            "repo": commit.get("repo"),
            "committed_files": commit.get("committed_files", []),
            "regression_summary": {
                "availability": "Pass",
                "functional_regression": ticket_functional_regression,
                "functional_coverage_impact": "100%",
                "performance_regression": "NA"
            },
            "test_case_summary": {
                "total_impacted": total_impacted,
                "total_passed": total_passed,
                "total_failed": total_failed
            },
            "failed_test_cases": scoped_failed_tcs,
            "defect_ids": bug_to_defects.get(ticket_id, [])
        })

    # Handle ticketIds that had no commits in blast radius (e.g. commits list is empty)
    covered_ticket_ids = {t["ticket_id"] for t in ui_json["tickets"]}
    for tid in agent_json.get("ticketIds", []):
        if tid in covered_ticket_ids:
            continue
        ticket_functional_regression = "Pass" if fr.get("failed", 0) == 0 else "Fail"
        total_impacted = fr.get("totalTests", 0)
        total_failed   = fr.get("failed", 0)
        total_passed   = fr.get("passed", 0)
        failed_tcs = [
            {"testcase_id": tc["testCaseId"], "testcase_description": tc.get("testName", tc["testCaseId"])}
            for tc in fr.get("failedTestCases", [])
        ]
        ui_json["tickets"].append({
            "ticket_id": tid,
            "repo": agent_json.get("appname"),
            "committed_files": [],
            "regression_summary": {
                "availability": "Pass",
                "functional_regression": ticket_functional_regression,
                "functional_coverage_impact": "100%",
                "performance_regression": "NA"
            },
            "test_case_summary": {
                "total_impacted": total_impacted,
                "total_passed": total_passed,
                "total_failed": total_failed
            },
            "failed_test_cases": failed_tcs,
            "defect_ids": bug_to_defects.get(tid, [])
        })

    return ui_json


def run_ticket_wise_sort(pr_id: str):
    logger.info(f"Fetching agent JSON for pr_id={pr_id}...")
    agent_json = fetch_agent_json(pr_id)

    if not agent_json:
        logger.error("Failed to fetch agent JSON. Exiting.")
        return

    logger.info("Generating UI JSON...")
    ui_json = generate_ui_json(agent_json)

    print(json.dumps(ui_json, indent=2))

    with open("ui_output.json", "w") as f:
        json.dump(ui_json, f, indent=2)
    logger.info("UI JSON saved to ui_output.json")

    logger.info(f"Inserting bug documents into {TARGET_CONTAINER}...")
    success = insert_tickets(pr_id, ui_json)
    if success:
        logger.info("Done.")
    else:
        logger.error("Insert failed.")


if __name__ == "__main__":
    main()
    run_ticket_wise_sort(PR_NUMBER)
