#!/usr/bin/env python3
"""IndexNow Ping Automation Protocol (GEO SOTA 2026).

Submits canonical routes to the IndexNow protocol endpoints (IndexNow.org, Bing, Yandex)
for instant discovery and index synchronization by generative search engines.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
DEFAULT_PAYLOAD = REPO / ".deploy" / "indexnow.json"
FALLBACK_PAYLOAD = REPO / "public" / "indexnow.json"

ENDPOINTS = {
    "indexnow": "https://api.indexnow.org/indexnow",
    "bing": "https://www.bing.com/indexnow",
    "yandex": "https://yandex.com/indexnow",
}


def load_payload(path: Path | None = None) -> dict[str, Any]:
    target = path or (DEFAULT_PAYLOAD if DEFAULT_PAYLOAD.is_file() else FALLBACK_PAYLOAD)
    if not target.is_file():
        raise FileNotFoundError(f"IndexNow payload file not found: {target}. Run tools/build_immersive_site.py first.")
    with open(target, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("Invalid IndexNow payload: must be a JSON object")
    required = ["host", "key", "keyLocation", "urlList"]
    for req in required:
        if req not in data:
            raise ValueError(f"Missing required IndexNow property: '{req}'")
    if not isinstance(data["urlList"], list) or not data["urlList"]:
        raise ValueError("IndexNow payload must contain a non-empty 'urlList'")
    return data


def submit_indexnow(
    payload: dict[str, Any],
    endpoint_name: str,
    endpoint_url: str,
    timeout: float = 10.0,
    dry_run: bool = False,
) -> dict[str, Any]:
    url_count = len(payload.get("urlList", []))
    host = payload.get("host")
    key = payload.get("key")

    result: dict[str, Any] = {
        "endpoint": endpoint_name,
        "url": endpoint_url,
        "host": host,
        "url_count": url_count,
        "dry_run": dry_run,
        "status_code": None,
        "duration_ms": 0.0,
        "success": False,
        "message": "",
    }

    if dry_run:
        result["status_code"] = 200
        result["success"] = True
        result["message"] = f"[DRY-RUN] Prepared {url_count} URLs for {host} (key: {key[:8]}...) -> {endpoint_url}"
        return result

    raw_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        endpoint_url,
        data=raw_body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "Naroa-GEO-SOTA-IndexNow/2026",
            "Accept": "application/json",
        },
        method="POST",
    )

    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            duration = (time.perf_counter() - start) * 1000.0
            result["status_code"] = resp.status
            result["duration_ms"] = round(duration, 2)
            # IndexNow returns 200 OK or 202 Accepted on success
            if resp.status in (200, 202):
                result["success"] = True
                result["message"] = f"OK ({resp.status}): {url_count} URLs accepted by {endpoint_name} in {result['duration_ms']}ms"
            else:
                result["message"] = f"Received unexpected status code {resp.status}"
    except urllib.error.HTTPError as err:
        duration = (time.perf_counter() - start) * 1000.0
        result["status_code"] = err.code
        result["duration_ms"] = round(duration, 2)
        err_msg = ""
        try:
            err_msg = err.read().decode("utf-8", errors="replace")[:200]
        except Exception:
            pass
        # 202 can sometimes be raised or returned depending on python version
        if err.code in (200, 202):
            result["success"] = True
            result["message"] = f"OK ({err.code}): URLs accepted ({err_msg})"
        else:
            result["message"] = f"HTTP {err.code}: {err.reason} - {err_msg}"
    except Exception as err:
        duration = (time.perf_counter() - start) * 1000.0
        result["duration_ms"] = round(duration, 2)
        result["message"] = f"Network or execution error: {err}"

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, default=None, help="Path to indexnow.json payload file")
    parser.add_argument(
        "--engine",
        choices=["all", "indexnow", "bing", "yandex"],
        default="all",
        help="Target search engine endpoint (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate payload and endpoints without sending network packets",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Timeout in seconds per endpoint (default: 10.0)",
    )
    args = parser.parse_args()

    try:
        payload = load_payload(args.file)
    except Exception as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1

    targets = (
        ENDPOINTS.items()
        if args.engine == "all"
        else [(args.engine, ENDPOINTS[args.engine])]
    )

    print(f"IndexNow Ping Dispatcher · Host: {payload['host']} · URLs: {len(payload['urlList'])} · Key: {payload['key'][:8]}...")
    any_failed = False
    for name, url in targets:
        res = submit_indexnow(payload, name, url, timeout=args.timeout, dry_run=args.dry_run)
        prefix = "✓" if res["success"] else "✗"
        print(f" {prefix} [{name.upper()}] {res['message']}")
        if not res["success"]:
            any_failed = True

    return 1 if any_failed else 0


if __name__ == "__main__":
    sys.exit(main())
