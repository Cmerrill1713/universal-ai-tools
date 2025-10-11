#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path


def load_entries(log_path: Path):
    if not log_path.exists():
        print(f"No self-correction log found at {log_path}")
        return []
    entries = []
    with log_path.open('r', encoding='utf-8') as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError as exc:
                print(f"Skipping malformed entry: {exc}")
    return entries


def summarize(entries):
    total = len(entries)
    if total == 0:
        return {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "passRate": 0.0,
            "averageConfidence": 0.0,
            "sources": {},
            "topIssues": [],
            "recent": [],
        }

    passed = sum(1 for entry in entries if entry.get("validation", {}).get("passed"))
    confidence_sum = sum(entry.get("confidence", 0.0) for entry in entries)

    sources = {}
    issues = {}
    for entry in entries:
        source = entry.get("source", "unknown")
        sources[source] = sources.get(source, 0) + 1
        for issue in entry.get("issues", []):
            issues[issue] = issues.get(issue, 0) + 1

    average_confidence = confidence_sum / total if total else 0.0

    top_issues = sorted(
        [{"issue": k, "count": v} for k, v in issues.items()],
        key=lambda item: (-item["count"], item["issue"]),
    )[:5]

    recent = entries[-5:][::-1]

    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "passRate": round(passed / total, 3) if total else 0.0,
        "averageConfidence": round(average_confidence, 3),
        "sources": sources,
        "topIssues": top_issues,
        "recent": recent,
    }


def main():
    project_root = Path(os.getenv("PROJECT_ROOT", Path.cwd()))
    log_path_env = os.getenv("SELF_CORRECTION_LOG_PATH")
    if log_path_env:
        log_path = Path(log_path_env)
    else:
        log_path = project_root / "knowledge" / "self_corrections.jsonl"

    entries = load_entries(log_path)
    summary = summarize(entries)
    json.dump(summary, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
