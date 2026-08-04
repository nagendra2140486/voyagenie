"""PRQE chain trigger — creates a Devin session and polls until it completes.

Only two steps: create the session with the PRQE playbook, then wait. Persisting the
results is the playbook's own job, so nothing is extracted or written here.

Everything except the PR id is hardcoded below — edit the STATIC CONFIG block per app.

Prerequisites:
    pip install requests
    export DEVIN_API_KEY=cog_...   # service user key, not a PAT

Usage:
    python scripts/trigger_prqe_chain_voyagenie.py 2 [<deployed sha>]
"""

import os
import sys
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============ DEVIN API CONFIGURATION ============
DEVIN_API = "https://api.devin.ai/v1"
DEVIN_API_KEY = os.environ.get("DEVIN_API_KEY", "")
PLAYBOOK_ID = "playbook-7126647262cf4d74bf7e00f1d7498c3b"

# ============ STATIC CONFIG ============
GITHUB_ORG = "Cognizant-FrontierAICyberDefense"
REPO_NAME = "voyagenie"
APP_NAME = "voyagenie"  # must match devin/config.yaml, not the Azure webapp name
ENVIRONMENT = "uat"
BACKEND_URL = "https://voyagenie-app.azurewebsites.net"
FRONTEND_URL = "https://voyagenie-app.azurewebsites.net"
AI_URL = "https://voyagenie-app.azurewebsites.net"  # ai_service declared in devin/config.yaml

TIMEOUT_MINUTES = 60
POLL_INTERVAL = 30

# ============ DYNAMIC INPUT ============
PULL_REQUEST_ID = sys.argv[1] if len(sys.argv) > 1 else input("Enter PR ID: ").strip()

# Deployed commit sha: 2nd argument, else $GITHUB_SHA, else the PR head from GitHub.
COMMIT = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("GITHUB_SHA", "")

# ============ HTTP SESSION WITH RETRY ============
http = requests.Session()
http.mount(
    "https://",
    HTTPAdapter(
        max_retries=Retry(
            total=5,
            backoff_factor=2,
            status_forcelist=[502, 503, 504],
            allowed_methods=["GET", "POST"],
            raise_on_status=False,
        )
    ),
)
http.headers.update(
    {"Authorization": f"Bearer {DEVIN_API_KEY}", "Content-Type": "application/json"}
)


def build_prompt(pr_id: str, commit: str) -> str:
    """Build the PRQE chain prompt for the deployed pull request."""
    return (
        "Run the PRQE chain for this deployed pull request.\n\n"
        f"pr_id: {pr_id}\n"
        f"repository: https://github.com/{GITHUB_ORG}/{REPO_NAME}\n"
        f"appname: {APP_NAME}\n"
        f"environment: {ENVIRONMENT}\n"
        f"commit: {commit}\n"
        f"backend_url: {BACKEND_URL}\n"
        f"frontend_url: {FRONTEND_URL}\n"
        f"ai_url: {AI_URL}"
    )


def resolve_commit(pr_id: str) -> str:
    """Return the deployed commit sha, falling back to the PR head sha from GitHub."""
    if COMMIT:
        return COMMIT

    response = requests.get(
        f"https://api.github.com/repos/{GITHUB_ORG}/{REPO_NAME}/pulls/{pr_id}",
        headers={"Accept": "application/vnd.github+json"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["head"]["sha"]


# ============ DEVIN: Create Session ============
def create_session(prompt: str) -> str:
    """Create a Devin session running the PRQE playbook."""
    payload = {"prompt": prompt, "playbook_id": PLAYBOOK_ID, "idempotent": True}

    response = http.post(f"{DEVIN_API}/sessions", json=payload)
    print(f"Create Status: {response.status_code}")
    response.raise_for_status()

    session_data = response.json()
    session_id = session_data["session_id"]
    print(f"Session created: {session_id}")
    print(f"Monitor at: {session_data.get('url', 'N/A')}")
    return session_id


# ============ DEVIN: Poll Until Complete ============
def wait_for_completion(session_id: str) -> dict:
    """Poll the session until it finishes, blocks on the user, or times out."""
    url = f"{DEVIN_API}/sessions/{session_id}"
    start_time = time.time()
    timeout_seconds = TIMEOUT_MINUTES * 60

    while True:
        elapsed = time.time() - start_time
        if elapsed > timeout_seconds:
            raise TimeoutError(
                f"Session did not complete within {TIMEOUT_MINUTES} minutes"
            )

        try:
            response = http.get(url)
            response.raise_for_status()
        except requests.exceptions.ConnectionError as e:
            print(f"  Connection error (retrying in {POLL_INTERVAL}s): {e}")
            time.sleep(POLL_INTERVAL)
            continue

        session_data = response.json()
        status = session_data.get("status", "")
        status_enum = session_data.get("status_enum", "")
        print(f"  status: {status} | status_enum: {status_enum} ({int(elapsed)}s)")

        if status_enum in ("finished", "blocked"):
            print("Session completed.")
            return session_data

        if status_enum == "expired":
            raise RuntimeError(f"Session expired: {status}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    if not DEVIN_API_KEY:
        sys.exit("DEVIN_API_KEY is not set.")

    commit = resolve_commit(PULL_REQUEST_ID)
    prompt = build_prompt(PULL_REQUEST_ID, commit)
    print(f"Triggering PRQE chain for {APP_NAME} PR #{PULL_REQUEST_ID}\n")
    print(prompt + "\n")

    session_id = create_session(prompt)
    session = wait_for_completion(session_id)
    print(f"\nFinal status: {session.get('status_enum')} — {session.get('status')}")
