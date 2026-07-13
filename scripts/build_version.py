#!/usr/bin/env python3
"""Génère les informations de version affichées par Gotus."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PACKAGE_PATH = ROOT / "package.json"
DEFAULT_OUTPUT = ROOT / "assets/data/build-info.json"
VERSIONED_SOURCES = (
    ROOT / "index.html",
    ROOT / "assets/css/gotus.css",
    ROOT / "assets/js/gotus.js",
    ROOT / "assets/js/game-logic.js",
    ROOT / "assets/js/logger.js",
    ROOT / "assets/images/favicon.svg",
)
VERSION_PATTERNS = (
    re.compile(r"(?<=@version )\d+\.\d+\.\d+"),
    re.compile(r"(?<=\?v=)\d+\.\d+\.\d+"),
    re.compile(r'(?<=content="Gotus )\d+\.\d+\.\d+(?=")'),
)


def git_value(*args: str) -> str:
    try:
        return subprocess.check_output(
            ["git", *args],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "indisponible"


def build_info() -> dict[str, object]:
    package = json.loads(PACKAGE_PATH.read_text(encoding="utf-8"))
    metadata = package.get("gotus", {})
    commit = git_value("rev-parse", "--short=8", "HEAD")
    if commit != "indisponible" and git_value("status", "--porcelain"):
        commit += "-dirty"

    return {
        "schemaVersion": 1,
        "product": "Gotus",
        "version": package["version"],
        "release": metadata.get("release", "Développement"),
        "channel": metadata.get("channel", "development"),
        "buildDate": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "commit": commit,
    }


def synchronize_source_versions(version: str) -> list[Path]:
    """Synchronise les en-têtes et les clés anti-cache des fichiers publics."""
    changed = []
    for path in VERSIONED_SOURCES:
        content = path.read_text(encoding="utf-8")
        updated = content
        for pattern in VERSION_PATTERNS:
            updated = pattern.sub(version, updated)
        if updated != content:
            path.write_text(updated, encoding="utf-8")
            changed.append(path)
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    info = build_info()
    changed_sources = synchronize_source_versions(str(info["version"]))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(info, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Gotus {info['version']} — {info['release']} "
        f"({info['buildDate']}, {info['commit']})"
    )
    if changed_sources:
        print(f"Version synchronisée dans {len(changed_sources)} fichier(s) public(s).")


if __name__ == "__main__":
    main()
