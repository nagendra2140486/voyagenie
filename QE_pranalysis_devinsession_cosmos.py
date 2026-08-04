"""
PR Impact Analysis — Devin Session + Cosmos DB Integration

This script:
1. Creates a Devin session with the PR Impact Analysis playbook
2. Polls until analysis completes
3. Extracts the structured markdown report
4. Saves to Cosmos DB (partitioned by appname)
5. Saves a local .md file as backup

Prerequisites:
    pip install requests azure-cosmos
"""

import os
import requests
import time
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from azure.cosmos import CosmosClient
from datetime import datetime, timezone

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============ DEVIN API CONFIGURATION ============
DEVIN_API_V1 = "https://api.devin.ai/v1"
DEVIN_API_KEY = os.environ.get("DEVIN_API_KEY", "")
PLAYBOOK_ID = "playbook-44fd4b3050a24a59800662df3deb7ec9"

# ============ COSMOS DB CONFIGURATION ============
COSMOS_ENDPOINT = "https://craas-dev-cosmos.documents.azure.com:443/"
COSMOS_KEY = os.environ.get("COSMOS_KEY_DB", "")
COSMOS_DB_NAME = "craas_qea"
COSMOS_CONTAINER_NAME = "prqeimpact"

# ============ STATIC CONFIG ============
GITHUB_ORG = "Cognizant-FrontierAICyberDefense"  # Static org prefix
 
# ============ DYNAMIC INPUTS ============
import sys as _sys
if len(_sys.argv) >= 3:
    APP_NAME = _sys.argv[1]
    PULL_REQUEST_ID = _sys.argv[2]
elif len(_sys.argv) == 2:
    APP_NAME = _sys.argv[1]
    PULL_REQUEST_ID = input("Enter PR ID: ").strip()
else:
    APP_NAME = input("Enter App Name: ").strip()
    PULL_REQUEST_ID = input("Enter PR ID: ").strip()
 
# ============ HTTP SESSION WITH RETRY + SSL FIX ============
http = requests.Session()
http.verify = False
 
retry_strategy = Retry(
    total=5,
    backoff_factor=2,
    status_forcelist=[502, 503, 504],
    allowed_methods=["GET", "POST"],
    raise_on_status=False,
)
adapter = HTTPAdapter(max_retries=retry_strategy)
http.mount("https://", adapter)
http.mount("http://", adapter)
 
http.headers.update({
    "Authorization": f"Bearer {DEVIN_API_KEY}",
    "Content-Type": "application/json"
})
 
 
def build_repository(appname: str) -> str:
    """Build full repository path from static org + dynamic app name."""
    return f"{GITHUB_ORG}/{appname}"
 
 
# ============ DEVIN: Create Session ============
def create_session(repository: str, pr_id: str) -> str:
    """Create a Devin session with the PR Impact Analysis playbook."""
    prompt = (
        f"Follow the playbook to analyze this PR.\n\n"
        f"Repository: {repository}\n"
        f"Pull Request ID: {pr_id}\n\n"
        f"Clone the repo https://github.com/{repository}.git, "
        f"analyze PR #{pr_id}, and provide the full structured markdown report "
        f"covering functional impact, performance impact, accessibility (WCAG) assessment, "
        f"and risks/anomalies as defined in the playbook."
    )
 
    payload = {
        "prompt": prompt,
        "playbook_id": PLAYBOOK_ID
    }
 
    response = http.post(f"{DEVIN_API_V1}/sessions", json=payload)
    print(f"Create Status: {response.status_code}")
    print(f"Create Response: {response.text}")
    response.raise_for_status()
 
    session_data = response.json()
    session_id = session_data["session_id"]
    print(f"Session created: {session_id}")
    print(f"Monitor at: {session_data.get('url', 'N/A')}")
    return session_id
 
 
# ============ DEVIN: Poll Until Complete ============
def wait_for_completion(session_id: str, timeout_minutes: int = 15, poll_interval: int = 30) -> dict:
    """
    Poll session status using v1 API.
    v1 returns status_enum: working, blocked, expired, finished.
    'blocked' = waiting for user (analysis done).
    """
    url = f"{DEVIN_API_V1}/sessions/{session_id}"
    start_time = time.time()
    timeout_seconds = timeout_minutes * 60
 
    while True:
        elapsed = time.time() - start_time
        if elapsed > timeout_seconds:
            raise TimeoutError(f"Session did not complete within {timeout_minutes} minutes")
 
        try:
            response = http.get(url)
            response.raise_for_status()
        except requests.exceptions.ConnectionError as e:
            print(f"  Connection error (retrying in {poll_interval}s): {e}")
            time.sleep(poll_interval)
            continue
 
        session_data = response.json()
        status = session_data.get("status", "")
        status_enum = session_data.get("status_enum", "")
 
        print(f"  status: {status} | status_enum: {status_enum} ({int(elapsed)}s elapsed)")
 
        if status_enum in ("finished", "blocked"):
            print("Session completed analysis.")
            return session_data
 
        if status_enum in ("expired",):
            raise RuntimeError(f"Session expired: {status}")
 
        time.sleep(poll_interval)
 
 
# ============ DEVIN: Extract Output ============
def get_session_output(session_data: dict) -> str:
    """Extract the analysis markdown from session messages."""
    messages = session_data.get("messages", [])
 
    print(f"\n--- Found {len(messages)} messages ---")
    for i, msg in enumerate(messages):
        print(f"  [{i}] type={msg.get('type')} | origin={msg.get('origin')} | len={len(msg.get('message', ''))}")
 
    # Find the longest non-user message (the analysis report)
    best_message = ""
    for msg in reversed(messages):
        msg_type = msg.get("type", "")
        origin = msg.get("origin", "")
        content = msg.get("message", "")
 
        if msg_type == "user_message" or origin == "user":
            continue
 
        if len(content) > len(best_message):
            best_message = content
 
    if not best_message:
        structured = session_data.get("structured_output")
        if structured:
            best_message = str(structured)
 
    return best_message
 
 
# ============ COSMOS DB: Save Analysis ============
def save_to_cosmos(repository: str, pr_id: str, analysis_md: str, session_id: str,
                  status: str = "success", error_message: str = "") -> str:
    """Save the PR analysis result (success or error) to Cosmos DB."""
    client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
    database = client.get_database_client(COSMOS_DB_NAME)
    container = database.get_container_client(COSMOS_CONTAINER_NAME)
 
    appname = repository.split("/")[-1]
    doc_id = f"{appname}-pr{pr_id}"
 
    document = {
        "id": doc_id,
        "appname": appname,
        "repository": repository,
        "pr_id": pr_id,
        "status": status,
        "analysis_markdown": analysis_md,
        "error_message": error_message,
        "devin_session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
 
    container.upsert_item(document)
    print(f"Saved to Cosmos DB: {doc_id} (partition: {appname}, status: {status})")
    return doc_id
 
 
# ============ COSMOS DB: Read Analysis ============
def read_from_cosmos(repository: str, pr_id: str) -> dict:
    """Read a PR analysis from Cosmos DB."""
    client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
    database = client.get_database_client(COSMOS_DB_NAME)
    container = database.get_container_client(COSMOS_CONTAINER_NAME)
 
    appname = repository.split("/")[-1]
    doc_id = f"{appname}-pr{pr_id}"
 
    doc = container.read_item(item=doc_id, partition_key=appname)
    return doc
 
 
# ============ MAIN PIPELINE ============
def run_pr_impact_analysis(repository: str, pr_id: str) -> str:
    """End-to-end: create Devin session, wait, retrieve output, save to Cosmos DB."""
    session_id = None
 
    try:
        # Step 1: Create Devin session
        print("\n[1/4] Creating Devin session...")
        session_id = create_session(repository, pr_id)
 
        # Step 2: Wait for completion
        print("\n[2/4] Waiting for analysis to complete...")
        session_data = wait_for_completion(session_id)
 
        # Step 3: Extract output
        print("\n[3/4] Extracting analysis output...")
        output = get_session_output(session_data)
 
        if not output:
            # No output found — log error to Cosmos DB
            print("WARNING: No analysis output found in messages.")
            save_error_to_cosmos(repository, pr_id, session_id,
                                "No analysis output found in session messages.")
            return ""
 
        # Step 4: Save success to Cosmos DB
        print("\n[4/4] Saving to Cosmos DB...")
        try:
            doc_id = save_to_cosmos(repository, pr_id, output, session_id,
                                   status="success")
            print(f"Successfully saved to Cosmos DB: {doc_id}")
        except Exception as e:
            print(f"WARNING: Failed to save to Cosmos DB: {e}")
            print("Analysis output is still available locally.")
 
        return output
 
    except TimeoutError as e:
        # Devin session timed out — log error to Cosmos DB
        print(f"ERROR: {e}")
        save_error_to_cosmos(repository, pr_id, session_id, str(e))
        return ""
 
    except RuntimeError as e:
        # Session expired or failed — log error to Cosmos DB
        print(f"ERROR: {e}")
        save_error_to_cosmos(repository, pr_id, session_id, str(e))
        return ""
 
    except Exception as e:
        # Any other unexpected error — log to Cosmos DB
        print(f"ERROR: Unexpected failure: {e}")
        save_error_to_cosmos(repository, pr_id, session_id, f"Unexpected error: {e}")
        return ""
 
 
def save_error_to_cosmos(repository: str, pr_id: str, session_id: str, error_msg: str):
    """Save an error record to Cosmos DB so failures are accounted for."""
    try:
        save_to_cosmos(
            repository=repository,
            pr_id=pr_id,
            analysis_md="",
            session_id=session_id or "unknown",
            status="error",
            error_message=error_msg
        )
        print(f"Error record saved to Cosmos DB.")
    except Exception as cosmos_err:
        print(f"CRITICAL: Failed to save error to Cosmos DB: {cosmos_err}")
 
 
if __name__ == "__main__":
    repository = build_repository(APP_NAME)
    print(f"Analyzing: {repository} PR #{PULL_REQUEST_ID}")
 
    result = run_pr_impact_analysis(repository, PULL_REQUEST_ID)
 
    # Save local backup
    output_file = f"pr_analysis_{APP_NAME}_{PULL_REQUEST_ID}.md"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(result)
 
    if result:
        print(f"\nLocal backup saved to: {output_file}")
        print(f"\n{'='*60}")
        print(result[:1000] + "..." if len(result) > 1000 else result)
 
        # Verify Cosmos DB read
        # print(f"\n{'='*60}")
        # print("Verifying Cosmos DB read...")
        # try:
          #   doc = read_from_cosmos(repository, PULL_REQUEST_ID)
            # print(f"Verified: id={doc['id']}, appname={doc['appname']}, "
              #     f"markdown_length={len(doc['analysis_markdown'])} chars")
        # except Exception as e:
          #   print(f"Could not verify Cosmos DB read: {e}")
    else:
        print("\nNo output to save.")
