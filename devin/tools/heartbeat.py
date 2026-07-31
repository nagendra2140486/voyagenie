#!/usr/bin/env python3
"""Post-deploy availability gate for Voyagenie.

Verifies a deployed environment is actually serving before functional or performance
suites run, so their failures mean "the code is wrong" rather than "the deploy is broken".

Read-only: no request here mutates data, so the suites that follow start from a clean
baseline. Standard library only, so it runs anywhere Python 3.10+ exists.

    python3 devin/tools/heartbeat.py \
        --backend-url https://qa-api.example.com \
        --frontend-url https://qa.example.com \
        --ai-url https://qa-ai.example.com \
        --run-id craas-1234 --out-dir reports/craas-1234

Exit codes: 0 healthy (warnings allowed), 1 one or more checks failed, 2 never became ready.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urljoin, urlparse

DEFAULTS = json.loads((Path(__file__).parent / "heartbeat-expectations.json").read_text())

Status = Literal["pass", "fail", "warn", "skip"]


@dataclass
class Check:
    name: str
    category: str
    status: Status
    detail: str
    latency_ms: int | None = None
    url: str | None = None


@dataclass
class Response:
    status: int
    body: bytes
    headers: dict[str, str]
    latency_ms: int
    error: str | None = None

    def json(self) -> Any:
        return json.loads(self.body)


def fetch(url: str, method: str = "GET", headers: dict[str, str] | None = None, timeout: float = 15.0) -> Response:
    request = urllib.request.Request(url, method=method, headers=headers or {})
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read()
            elapsed = int((time.perf_counter() - started) * 1000)
            return Response(response.status, body, {k.lower(): v for k, v in response.headers.items()}, elapsed)
    except urllib.error.HTTPError as error:
        elapsed = int((time.perf_counter() - started) * 1000)
        return Response(error.code, error.read(), {k.lower(): v for k, v in error.headers.items()}, elapsed)
    except Exception as error:  # noqa: BLE001 - any transport failure is a check failure, not a crash
        elapsed = int((time.perf_counter() - started) * 1000)
        return Response(0, b"", {}, elapsed, error=f"{type(error).__name__}: {error}")


class AssetParser(HTMLParser):
    """Collects script/stylesheet URLs so a deploy with mismatched asset hashes is caught."""

    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "script" and attributes.get("src"):
            self.assets.append(attributes["src"])
        if tag == "link" and attributes.get("rel") in {"stylesheet", "modulepreload"} and attributes.get("href"):
            self.assets.append(attributes["href"])


@dataclass
class Heartbeat:
    backend_url: str
    frontend_url: str
    ai_url: str
    commit: str | None = None
    expect_provider: str | None = None
    expect_api_key: bool | None = None
    budget_ms: int = DEFAULTS["latencyBudgetMs"]
    checks: list[Check] = field(default_factory=list)

    def record(
        self,
        name: str,
        category: str,
        ok: bool,
        detail: str,
        latency_ms: int | None = None,
        url: str | None = None,
    ) -> bool:
        status: Status = "pass" if ok else "fail"
        # A response that is correct but over budget is degradation, not an outage: the
        # distinction is what stops a slow environment from being reported as down.
        if ok and latency_ms is not None and latency_ms > self.budget_ms:
            status = "warn"
            detail = f"{detail} (over {self.budget_ms}ms budget)"
        self.checks.append(Check(name, category, status, detail, latency_ms, url))
        return ok

    def skip(self, name: str, category: str, reason: str) -> None:
        self.checks.append(Check(name, category, "skip", reason))

    def wait_until_ready(self, deadline_seconds: int) -> bool:
        """Containers are often still warming right after a deploy; poll before judging."""
        targets = {"backend": f"{self.backend_url}/health", "ai-service": f"{self.ai_url}/health"}
        deadline = time.monotonic() + deadline_seconds
        pending = dict(targets)
        while pending and time.monotonic() < deadline:
            for service, url in list(pending.items()):
                if fetch(url, timeout=5).status == 200:
                    del pending[service]
            if pending:
                time.sleep(3)
        for service, url in targets.items():
            self.record(
                f"{service} reachable",
                "readiness",
                service not in pending,
                "responded to /health" if service not in pending else f"no 200 within {deadline_seconds}s",
                url=url,
            )
        return not pending

    def check_health(self) -> None:
        response = fetch(f"{self.backend_url}/health")
        ok = response.status == 200 and response.json().get("status") == "ok"
        self.record("backend /health", "system", ok, f"HTTP {response.status}", response.latency_ms)

        response = fetch(f"{self.ai_url}/health")
        self.record("ai-service /health", "system", response.status == 200, f"HTTP {response.status}", response.latency_ms)

    def check_deployed_commit(self) -> None:
        """Without this the gate can smoke-test a stale build and report it green."""
        if not self.commit:
            self.skip("deployed commit matches", "system", "no --commit supplied")
            return
        response = fetch(f"{self.backend_url}/health")
        deployed = str(response.json().get("commit", "")) if response.status == 200 else ""
        if not deployed:
            self.skip("deployed commit matches", "system", "/health does not report a commit")
            return
        matches = deployed.startswith(self.commit[:7]) or self.commit.startswith(deployed[:7])
        self.record("deployed commit matches", "system", matches, f"deployed={deployed or 'unknown'} expected={self.commit[:7]}")

    def check_api_surface(self) -> list[str]:
        """Probes every parameterless GET in the spec, so a new endpoint is covered for free."""
        response = fetch(f"{self.backend_url}/api/openapi.json")
        if not self.record("openapi spec served", "api", response.status == 200, f"HTTP {response.status}", response.latency_ms):
            return []

        paths = [
            path
            for path, operations in response.json().get("paths", {}).items()
            if "get" in operations and "{" not in path and path != "/api/openapi.json"
        ]
        for path in sorted(paths):
            probe = fetch(f"{self.backend_url}{path}")
            self.record(f"GET {path}", "api", probe.status == 200, f"HTTP {probe.status}", probe.latency_ms, path)
        return paths

    def check_seed_baseline(self) -> None:
        """Functional specs assert exact catalogue sizes; prove the data before blaming the UI."""
        for resource, expected in DEFAULTS["seedBaseline"].items():
            response = fetch(f"{self.backend_url}/api/{resource}")
            actual = response.json().get("count") if response.status == 200 else None
            self.record(
                f"{resource} seed baseline",
                "data",
                actual == expected,
                f"expected {expected}, found {actual}",
                response.latency_ms,
            )

    def check_configuration(self) -> None:
        response = fetch(f"{self.backend_url}/api/llm-audit")
        if not self.record("llm-audit reachable", "config", response.status == 200, f"HTTP {response.status}", response.latency_ms):
            return

        payload = response.json()
        llm_config = payload.get("llmConfig", {})
        if self.expect_provider:
            actual = llm_config.get("provider")
            self.record(
                "llm provider as expected",
                "config",
                actual == self.expect_provider,
                f"expected {self.expect_provider}, found {actual}",
            )
        if self.expect_api_key is not None:
            actual = bool(llm_config.get("apiKeyConfigured"))
            self.record(
                "llm api key configured",
                "config",
                actual == self.expect_api_key,
                f"expected {self.expect_api_key}, found {actual}",
            )

        body = response.body.decode("utf-8", "replace")
        # `apiKeyConfigured: false` is the intended, non-secret disclosure — match a field
        # that carries a value, not any field whose name contains "key".
        leaked = re.findall(r'"(\w*(?:api_?key|secret|token))"\s*:\s*"', body, re.IGNORECASE)
        if "LLM_API_KEY" in body:
            leaked.append("LLM_API_KEY")
        self.record("no secret in governance payload", "security", not leaked, f"leaked fields: {leaked}" if leaked else "clean")

    def check_frontend(self) -> None:
        response = fetch(self.frontend_url)
        served = self.record(
            "frontend index",
            "frontend",
            response.status == 200,
            f"HTTP {response.status}",
            response.latency_ms,
            self.frontend_url,
        )
        if not served:
            return

        parser = AssetParser()
        parser.feed(response.body.decode("utf-8", "replace"))
        # A SPA returns 200 for any route, so index.html alone proves nothing; broken or
        # mismatched asset hashes after a deploy are the failure this actually catches.
        for asset in parser.assets[: DEFAULTS["maxAssetsProbed"]]:
            url = urljoin(self.frontend_url, asset)
            probe = fetch(url)
            self.record(f"asset {asset}", "frontend", probe.status == 200, f"HTTP {probe.status}", probe.latency_ms, url)
        if not parser.assets:
            self.skip("frontend assets", "frontend", "index.html references no scripts or stylesheets")

    def check_cors(self) -> None:
        """A CORS_ORIGIN pointing at the wrong host breaks every browser test downstream."""
        origin = f"{urlparse(self.frontend_url).scheme}://{urlparse(self.frontend_url).netloc}"
        response = fetch(
            f"{self.backend_url}/api/destinations",
            method="OPTIONS",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
        )
        allowed = response.headers.get("access-control-allow-origin", "")
        self.record(
            "cors allows the frontend origin",
            "config",
            allowed in {origin, "*"},
            f"origin {origin} -> allow-origin '{allowed or 'missing'}'",
            response.latency_ms,
        )

    def run(self, ready_timeout: int) -> None:
        if not self.wait_until_ready(ready_timeout):
            return
        self.check_health()
        self.check_deployed_commit()
        self.check_api_surface()
        self.check_seed_baseline()
        self.check_configuration()
        self.check_frontend()
        self.check_cors()


def summarise(checks: list[Check]) -> dict[str, int]:
    return {status: sum(1 for check in checks if check.status == status) for status in ("pass", "fail", "warn", "skip")}


def to_markdown(report: dict[str, Any]) -> str:
    counts = report["summary"]
    icon = {"pass": "PASS", "fail": "FAIL", "warn": "WARN", "skip": "SKIP"}
    lines = [
        f"# Heartbeat Report — {report['appname']}",
        "",
        "| | |",
        "| --- | --- |",
        f"| Run id | `{report['runId']}` |",
        f"| Verdict | **{report['verdict'].upper()}** |",
        f"| Environment | {report['environment'] or 'unspecified'} |",
        f"| Backend | {report['urls']['backend']} |",
        f"| Frontend | {report['urls']['frontend']} |",
        f"| AI service | {report['urls']['ai']} |",
        f"| Checks | {counts['pass']} passed · {counts['fail']} failed · {counts['warn']} slow · {counts['skip']} skipped |",
        f"| Duration | {report['durationMs']} ms |",
        f"| Timestamp | {report['createdAt']} |",
        "",
    ]

    failures = [check for check in report["checks"] if check["status"] == "fail"]
    if failures:
        lines += ["## Failures", "", "| Check | Detail |", "| --- | --- |"]
        lines += [f"| {check['name']} | {check['detail']} |" for check in failures]
        lines.append("")

    lines += ["## All checks", "", "| Result | Category | Check | Detail | Latency |", "| --- | --- | --- | --- | --- |"]
    for check in report["checks"]:
        latency = f"{check['latencyMs']} ms" if check["latencyMs"] is not None else "—"
        lines.append(f"| {icon[check['status']]} | {check['category']} | {check['name']} | {check['detail']} | {latency} |")

    if report["verdict"] == "healthy":
        lines += ["", "Environment is serving; downstream suites may run."]
    else:
        lines += [
            "",
            "**Environment is not healthy.** Treat downstream functional or performance failures as",
            "environment problems until these checks pass.",
        ]
    return "\n".join(lines) + "\n"


def to_junit(report: dict[str, Any]) -> bytes:
    counts = report["summary"]
    suite = ET.Element(
        "testsuite",
        name="heartbeat",
        tests=str(len(report["checks"])),
        failures=str(counts["fail"]),
        skipped=str(counts["skip"]),
        time=f"{report['durationMs'] / 1000:.3f}",
    )
    for check in report["checks"]:
        case = ET.SubElement(suite, "testcase", classname=f"heartbeat.{check['category']}", name=check["name"])
        if check["status"] == "fail":
            ET.SubElement(case, "failure", message=check["detail"]).text = check["detail"]
        elif check["status"] == "skip":
            ET.SubElement(case, "skipped", message=check["detail"])
        elif check["status"] == "warn":
            ET.SubElement(case, "system-out").text = f"WARN: {check['detail']}"
    return ET.tostring(ET.ElementTree(suite).getroot(), encoding="utf-8", xml_declaration=True)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--backend-url", default=os.environ.get("VOYAGENIE_API_URL"))
    parser.add_argument("--frontend-url", default=os.environ.get("VOYAGENIE_BASE_URL"))
    parser.add_argument("--ai-url", default=os.environ.get("VOYAGENIE_AI_URL"))
    parser.add_argument("--run-id", default="local")
    parser.add_argument("--appname", default="voyagenie")
    parser.add_argument("--environment", default=os.environ.get("VOYAGENIE_ENV"))
    parser.add_argument("--commit", help="Expected deployed commit; compared against /health")
    parser.add_argument("--expect-provider", help="Fail if the deployed LLM provider differs, e.g. mock or openai")
    parser.add_argument("--expect-api-key", choices=["true", "false"], help="Fail if apiKeyConfigured differs")
    parser.add_argument("--ready-timeout", type=int, default=90, help="Seconds to wait for /health after a deploy")
    parser.add_argument("--budget-ms", type=int, default=DEFAULTS["latencyBudgetMs"])
    parser.add_argument("--strict", action="store_true", help="Treat slow responses as failures")
    parser.add_argument("--out-dir", default="reports/heartbeat")
    args = parser.parse_args(argv)

    missing = [name for name in ("backend_url", "frontend_url", "ai_url") if not getattr(args, name)]
    if missing:
        parser.error(f"missing target URLs: {', '.join(missing)} (pass --* or set VOYAGENIE_*_URL)")
    return args


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    started = time.perf_counter()

    heartbeat = Heartbeat(
        backend_url=args.backend_url.rstrip("/"),
        frontend_url=args.frontend_url.rstrip("/"),
        ai_url=args.ai_url.rstrip("/"),
        commit=args.commit,
        expect_provider=args.expect_provider,
        expect_api_key=None if args.expect_api_key is None else args.expect_api_key == "true",
        budget_ms=args.budget_ms,
    )
    heartbeat.run(args.ready_timeout)

    counts = summarise(heartbeat.checks)
    unhealthy = counts["fail"] > 0 or (args.strict and counts["warn"] > 0)
    report = {
        "schemaVersion": 1,
        "runId": args.run_id,
        "appname": args.appname,
        "environment": args.environment,
        "commit": args.commit,
        "verdict": "unhealthy" if unhealthy else "healthy",
        "urls": {"backend": heartbeat.backend_url, "frontend": heartbeat.frontend_url, "ai": heartbeat.ai_url},
        "summary": counts,
        "durationMs": int((time.perf_counter() - started) * 1000),
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "checks": [
            {
                "name": check.name,
                "category": check.category,
                "status": check.status,
                "detail": check.detail,
                "latencyMs": check.latency_ms,
                "url": check.url,
            }
            for check in heartbeat.checks
        ],
    }

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "heartbeat.json").write_text(json.dumps(report, indent=2) + "\n")
    (out_dir / "heartbeat.md").write_text(to_markdown(report))
    (out_dir / "heartbeat-junit.xml").write_bytes(to_junit(report))

    print(to_markdown(report))
    print(f"wrote {out_dir}/heartbeat.{{json,md}} and heartbeat-junit.xml")

    # A distinct code for "never came up", so a caller can retry a deploy rather than
    # treating it as a functional regression.
    if any(check.category == "readiness" and check.status == "fail" for check in heartbeat.checks):
        return 2
    return 1 if unhealthy else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
