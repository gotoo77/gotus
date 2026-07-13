import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.build_pages import build, copy_public, gallery_html, parse_tag


class PagesBuilderTest(unittest.TestCase):
    @staticmethod
    def git(repository, *args):
        subprocess.run(
            ["git", *args],
            cwd=repository,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def test_accepts_only_strict_release_tags(self):
        self.assertEqual(parse_tag("v2.10.3"), (2, 10, 3))
        self.assertIsNone(parse_tag("2.10.3"))
        self.assertIsNone(parse_tag("v2.10"))
        self.assertIsNone(parse_tag("v2.10.3-beta"))

    def test_copies_current_and_legacy_public_files_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            destination = root / "site"
            (source / "assets/js").mkdir(parents=True)
            (source / "scripts").mkdir()
            (source / "index.html").write_text("jeu", encoding="utf-8")
            (source / "config.json").write_text("{}", encoding="utf-8")
            (source / "assets/js/gotus.js").write_text("", encoding="utf-8")
            (source / "package.json").write_text("{}", encoding="utf-8")
            (source / "scripts/private.py").write_text("", encoding="utf-8")

            copy_public(source, destination)

            self.assertTrue((destination / "index.html").exists())
            self.assertTrue((destination / "config.json").exists())
            self.assertTrue((destination / "assets/js/gotus.js").exists())
            self.assertFalse((destination / "package.json").exists())
            self.assertFalse((destination / "scripts/private.py").exists())

    def test_gallery_links_to_stable_dev_and_snapshots(self):
        page = gallery_html(
            [{
                "version": "2.2.0",
                "tag": "v2.2.0",
                "release": "Lexique & accessibilite",
                "date": "2026-07-13T12:00:00Z",
                "url": "./2.2.0/",
            }],
            "2026-07-13T12:00:00Z",
        )

        self.assertIn('href="../dev/"', page)
        self.assertIn('href="./2.2.0/"', page)
        self.assertIn("Dernière version stable", page)

    def test_builds_stable_root_dev_channel_and_tag_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary:
            repository = Path(temporary) / "repository"
            repository.mkdir()
            self.git(repository, "init", "-b", "main")
            self.git(repository, "config", "user.name", "Test")
            self.git(repository, "config", "user.email", "test@example.test")

            (repository / "assets").mkdir()
            (repository / "index.html").write_text("stable", encoding="utf-8")
            (repository / "package.json").write_text(
                json.dumps({
                    "version": "1.0.0",
                    "gotus": {"release": "Premiere release"},
                }),
                encoding="utf-8",
            )
            self.git(repository, "add", ".")
            self.git(repository, "commit", "-m", "release")
            self.git(repository, "tag", "v1.0.0")

            (repository / "index.html").write_text("development", encoding="utf-8")
            (repository / "package.json").write_text(
                json.dumps({
                    "version": "1.1.0",
                    "gotus": {"release": "Prochaine release"},
                }),
                encoding="utf-8",
            )
            self.git(repository, "add", ".")
            self.git(repository, "commit", "-m", "development")

            output = repository / ".pages"
            with patch("scripts.build_pages.ROOT", repository):
                manifest = build(output)

            self.assertEqual(manifest["latest"], "1.0.0")
            self.assertEqual((output / "index.html").read_text(), "stable")
            self.assertEqual((output / "dev/index.html").read_text(), "development")
            self.assertEqual(
                (output / "versions/1.0.0/index.html").read_text(), "stable"
            )
            build_info = json.loads(
                (output / "versions/1.0.0/assets/data/build-info.json").read_text()
            )
            self.assertEqual(build_info["channel"], "stable")
            self.assertEqual(build_info["version"], "1.0.0")


if __name__ == "__main__":
    unittest.main()
