"""
Retrieve the last merged PR number and URL targeting a specific branch.

Requirements:
    pip install requests

Usage:
    set GITHUB_TOKEN=your_personal_access_token
    python pullrequest_retrieve.py timesheet-app
"""

import os
import sys
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ORG = "Cognizant-FrontierAICyberDefense"
TARGET_BRANCH = "craas-security-fixes"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN_VAL", "")

HEADERS = {
    "Accept": "application/vnd.github+json",
}
if GITHUB_TOKEN:
    HEADERS["Authorization"] = f"Bearer {GITHUB_TOKEN}"


def get_last_merged_pr(org: str, repo: str, base_branch: str) -> tuple | None:
    url = f"https://api.github.com/repos/{org}/{repo}/pulls"
    params = {
        "state": "closed",
        "sort": "updated",
        "direction": "desc",
        "per_page": 100,
    }
    response = requests.get(url, headers=HEADERS, params=params, verify=False)
    response.raise_for_status()
    prs = response.json()

    for pr in prs:
        if pr.get("merged_at"):
            pr_number = str(pr["number"])
            pr_url = f"https://github.com/{org}/{repo}/pull/{pr_number}"
            return pr_number, pr_url

    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python pullrequest_retrieve.py <project-name>", file=sys.stderr)
        sys.exit(1)

    project_name = sys.argv[1]
    result = get_last_merged_pr(ORG, project_name, TARGET_BRANCH)

    if result:
        pr_number, pr_url = result
       # print(pr_number)
        print(pr_url)
    else:
        print("", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
