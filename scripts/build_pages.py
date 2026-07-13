#!/usr/bin/env python3
"""Construit le site GitHub Pages multi-version de Gotus."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / ".pages"
TAG_PATTERN = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
ROOT_PUBLIC_FILES = {
    "index.html",
    "script.js",
    "logger.js",
    "style.css",
    "favicon.svg",
    # Compatibilite avec les premieres versions du depot.
    "config.json",
    "dictionnaire.json",
}


def git(*args: str, cwd: Path | None = None) -> str:
    """Retourne la sortie d'une commande Git ou une chaine vide."""
    try:
        return subprocess.check_output(
            ["git", *args],
            cwd=cwd or ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def parse_tag(tag: str) -> tuple[int, int, int] | None:
    """Extrait une version semantique stricte d'un tag vX.Y.Z."""
    match = TAG_PATTERN.fullmatch(tag)
    return tuple(map(int, match.groups())) if match else None


def release_tags() -> list[str]:
    """Liste les tags de release, du plus recent au plus ancien."""
    tags = git("tag", "--list", "v*.*.*").splitlines()
    return sorted(
        (tag for tag in tags if parse_tag(tag) is not None),
        key=lambda tag: parse_tag(tag) or (0, 0, 0),
        reverse=True,
    )


def copy_public(source: Path, destination: Path) -> None:
    """Copie uniquement les fichiers necessaires au jeu statique."""
    destination.mkdir(parents=True, exist_ok=True)

    for filename in ROOT_PUBLIC_FILES:
        path = source / filename
        if path.is_file() and not path.is_symlink():
            shutil.copy2(path, destination / filename)

    assets = source / "assets"
    if not assets.is_dir():
        return

    for path in assets.rglob("*"):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(source)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)


def copy_contents(source: Path, destination: Path) -> None:
    """Copie le contenu d'un snapshot vers la racine du site."""
    for path in source.iterdir():
        target = destination / path.name
        if path.is_dir():
            shutil.copytree(path, target, dirs_exist_ok=True)
        else:
            shutil.copy2(path, target)


def read_package(source: Path) -> dict[str, object]:
    try:
        return json.loads((source / "package.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def utc_now() -> str:
    return (
        dt.datetime.now(dt.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def write_build_info(
    destination: Path,
    *,
    version: str,
    release: str,
    channel: str,
    build_date: str,
    commit: str,
) -> None:
    path = destination / "assets/data/build-info.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "product": "Gotus",
                "version": version,
                "release": release,
                "channel": channel,
                "buildDate": build_date,
                "commit": commit or "indisponible",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def extract_tag(tag: str, destination: Path) -> None:
    """Extrait un tag Git en refusant liens et traversees de repertoire."""
    archive_path = destination.parent / f"{tag}.tar"
    subprocess.run(
        ["git", "archive", "--format=tar", "--output", str(archive_path), tag],
        cwd=ROOT,
        check=True,
    )
    destination.mkdir(parents=True, exist_ok=True)
    destination_root = destination.resolve()
    try:
        with tarfile.open(archive_path) as archive:
            for member in archive.getmembers():
                member_path = (destination / member.name).resolve()
                if (
                    member_path != destination_root
                    and destination_root not in member_path.parents
                ) or member.issym() or member.islnk():
                    raise ValueError(f"Entree d'archive refusee : {member.name}")
            archive.extractall(destination)
    finally:
        archive_path.unlink(missing_ok=True)


def gallery_html(versions: list[dict[str, str]], generated_at: str) -> str:
    cards = []
    for item in versions:
        version = html.escape(item["version"])
        release = html.escape(item["release"])
        date = html.escape(item["date"][:10])
        cards.append(
            f'''<li class="card">
              <h2><a href="./{version}/">Gotus {version}</a></h2>
              <p>{release}</p>
              <p class="meta">Publiée le <time datetime="{html.escape(item['date'])}">{date}</time> · <code>{html.escape(item['tag'])}</code></p>
            </li>'''
        )

    releases = "\n".join(cards) or (
        '<li class="empty">Aucune release taguée pour le moment. '
        "Le canal de développement reste disponible.</li>"
    )
    return f'''<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Versions de Gotus</title>
  <style>
    :root {{ color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5; }}
    body {{ max-width: 58rem; margin: 0 auto; padding: clamp(1rem, 4vw, 3rem); background: Canvas; color: CanvasText; }}
    a {{ color: LinkText; text-underline-offset: .18em; }}
    a:focus-visible {{ outline: .2rem solid Highlight; outline-offset: .2rem; }}
    nav ul, .versions {{ list-style: none; padding: 0; }}
    nav ul {{ display: flex; flex-wrap: wrap; gap: .75rem 1.5rem; }}
    .versions {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1rem; }}
    .card, .empty {{ padding: 1rem 1.25rem; border: 1px solid GrayText; border-radius: .75rem; }}
    .card h2 {{ margin-top: 0; }}
    .meta, footer {{ color: GrayText; }}
  </style>
</head>
<body>
  <header>
    <p><a href="../">Gotus</a></p>
    <h1>Parcourir les versions</h1>
    <p>Chaque release reste jouable à sa propre adresse.</p>
    <nav aria-label="Canaux de publication">
      <ul>
        <li><a href="../">Dernière version stable</a></li>
        <li><a href="../dev/">Version de développement</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <ul class="versions">
      {releases}
    </ul>
  </main>
  <footer><p>Index régénéré le <time datetime="{generated_at}">{generated_at}</time>.</p></footer>
</body>
</html>
'''


def build(output: Path = DEFAULT_OUTPUT) -> dict[str, object]:
    output = output.resolve()
    if (
        output.name != ".pages"
        or output == ROOT.resolve()
        or ROOT.resolve() not in output.parents
    ):
        raise ValueError("La sortie doit être un sous-répertoire .pages du projet")
    shutil.rmtree(output, ignore_errors=True)
    output.mkdir(parents=True)

    generated_at = utc_now()
    package = read_package(ROOT)
    metadata = package.get("gotus", {})
    if not isinstance(metadata, dict):
        metadata = {}

    dev = output / "dev"
    copy_public(ROOT, dev)
    commit = git("rev-parse", "--short=8", "HEAD")
    if commit and git("status", "--porcelain"):
        commit += "-dirty"
    write_build_info(
        dev,
        version=str(package.get("version", "development")),
        release=str(metadata.get("release", "Développement")),
        channel="development",
        build_date=generated_at,
        commit=commit,
    )

    versions: list[dict[str, str]] = []
    versions_root = output / "versions"
    versions_root.mkdir()
    tags = release_tags()

    with tempfile.TemporaryDirectory(prefix="gotus-pages-") as temporary:
        temporary_root = Path(temporary)
        for tag in tags:
            version = tag.removeprefix("v")
            snapshot = temporary_root / version
            extract_tag(tag, snapshot)
            package_at_tag = read_package(snapshot)
            tag_metadata = package_at_tag.get("gotus", {})
            if not isinstance(tag_metadata, dict):
                tag_metadata = {}
            release = str(tag_metadata.get("release", f"Version {version}"))
            date = git(
                "for-each-ref",
                "--format=%(creatordate:iso-strict)",
                f"refs/tags/{tag}",
            ) or generated_at
            destination = versions_root / version
            copy_public(snapshot, destination)
            write_build_info(
                destination,
                version=version,
                release=release,
                channel="stable",
                build_date=date,
                commit=git("rev-list", "-n", "1", tag)[:8],
            )
            versions.append(
                {
                    "version": version,
                    "tag": tag,
                    "release": release,
                    "date": date,
                    "url": f"./{version}/",
                }
            )

    stable_source = versions_root / versions[0]["version"] if versions else dev
    copy_contents(stable_source, output)
    (output / ".nojekyll").touch()

    manifest = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "latest": versions[0]["version"] if versions else None,
        "development": {"url": "../dev/", "commit": commit or "indisponible"},
        "versions": versions,
    }
    (versions_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (versions_root / "index.html").write_text(
        gallery_html(versions, generated_at), encoding="utf-8"
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    manifest = build(args.output)
    latest = manifest["latest"] or "dev (aucun tag de release)"
    print(
        f"Site Pages construit dans {args.output}: {len(manifest['versions'])} "
        f"release(s), racine = {latest}"
    )


if __name__ == "__main__":
    main()
