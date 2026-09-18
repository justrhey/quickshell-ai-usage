#!/usr/bin/env python3
"""Emit Codex and Claude usage as JSON for the Quickshell widgets."""

import glob
import json
import os
import time
import urllib.request
from datetime import datetime

HOME = os.path.expanduser("~")
CLAUDE_CREDS = os.path.join(HOME, ".claude", ".credentials.json")
CACHE_FILE = os.path.join(
    os.environ.get("XDG_CACHE_HOME", os.path.join(HOME, ".cache")),
    "quickshell-ai-usage.json",
)
CLAUDE_IN_USE_WINDOW = 180


def _human_window(minutes):
    if minutes <= 0:
        return ""
    if minutes == 10080:
        return "weekly"
    if minutes % 1440 == 0:
        return f"{minutes // 1440}d"
    if minutes % 60 == 0:
        return f"{minutes // 60}h"
    return f"{minutes}m"


def _human_reset(seconds):
    if not seconds or seconds <= 0:
        return ""
    if seconds >= 86400:
        return f"resets in {seconds // 86400}d"
    if seconds >= 3600:
        return f"resets in {seconds // 3600}h"
    return f"resets in {max(1, seconds // 60)}m"


def _find_windows(value, output):
    if isinstance(value, dict):
        if "used_percent" in value and "window_minutes" in value:
            output.append(value)
        for child in value.values():
            _find_windows(child, output)
    elif isinstance(value, list):
        for child in value:
            _find_windows(child, output)


def _usage_result(windows, now, preferred=None, highest=False):
    results = {}
    for window in windows:
        try:
            minutes = int(window.get("window_minutes", 0))
            label = _human_window(minutes)
            if not label:
                continue
            percent = float(window.get("used_percent", 0))
            resets_at = int(window.get("resets_at", 0) or 0)
            reset = ""
            if resets_at:
                if now >= resets_at:
                    percent = 0.0
                    resets_at = 0
                else:
                    reset = _human_reset(int(resets_at - now))
            results[label] = {
                "percent": round(percent, 1),
                "window": label,
                "reset": reset,
                "resets_at": resets_at,
            }
        except (TypeError, ValueError):
            continue
    if not results:
        return None
    chosen = max(results.values(), key=lambda item: item["percent"]) if highest else results.get(preferred)
    chosen = chosen or next(iter(results.values()))
    return {"available": True, **chosen, "windows": results}


def codex_usage():
    files = glob.glob(os.path.join(HOME, ".codex", "sessions", "**", "*.jsonl"), recursive=True)
    files.sort(key=os.path.getmtime, reverse=True)
    now = time.time()
    for path in files[:15]:
        try:
            latest = None
            with open(path, encoding="utf-8", errors="ignore") as handle:
                for line in handle:
                    if "used_percent" not in line:
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    windows = []
                    _find_windows(event, windows)
                    if windows:
                        latest = windows
            if latest:
                preferred = _human_window(int(latest[-1].get("window_minutes", 0)))
                result = _usage_result(latest, now, preferred=preferred)
                if result:
                    return result
        except OSError:
            continue
    return {"available": False}


def _cache_read():
    try:
        with open(CACHE_FILE, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}


def _cache_write(data):
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as handle:
            json.dump(data, handle)
    except OSError:
        pass


def _claude_in_use(now):
    pattern = os.path.join(HOME, ".claude", "projects", "**", "*.jsonl")
    for path in glob.glob(pattern, recursive=True):
        try:
            if os.path.getmtime(path) >= now - CLAUDE_IN_USE_WINDOW:
                return True
        except OSError:
            pass
    return False


def _claude_fetch():
    try:
        with open(CLAUDE_CREDS, encoding="utf-8") as handle:
            credentials = json.load(handle).get("claudeAiOauth", {})
        token = credentials.get("accessToken")
        if not token:
            return None
        request = urllib.request.Request(
            "https://api.anthropic.com/api/oauth/usage",
            headers={
                "Authorization": "Bearer " + token,
                "anthropic-beta": "oauth-2025-04-20",
                "anthropic-version": "2023-06-01",
                "User-Agent": "claude-cli/1.0",
            },
        )
        with urllib.request.urlopen(request, timeout=8) as response:
            data = json.load(response)
        windows = []
        for key, minutes in (("five_hour", 300), ("seven_day", 10080)):
            window = data.get(key)
            if isinstance(window, dict) and window.get("utilization") is not None:
                resets_at = 0
                if window.get("resets_at"):
                    resets_at = int(datetime.fromisoformat(
                        window["resets_at"].replace("Z", "+00:00")
                    ).timestamp())
                windows.append({
                    "used_percent": window["utilization"],
                    "window_minutes": minutes,
                    "resets_at": resets_at,
                })
        if not windows:
            return None
        return _usage_result(windows, time.time(), highest=True)
    except (OSError, ValueError, urllib.error.URLError):
        return None


def claude_usage():
    now = time.time()
    cache = _cache_read()
    if _claude_in_use(now) or "claude" not in cache:
        fresh = _claude_fetch()
        if fresh:
            cache["claude"] = fresh
            _cache_write(cache)
            return fresh
    return cache.get("claude", {"available": False})


def main():
    print(json.dumps({"codex": codex_usage(), "claude": claude_usage()}))


if __name__ == "__main__":
    main()
