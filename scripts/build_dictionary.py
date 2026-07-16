#!/usr/bin/env python3
"""Construit le dictionnaire Gotus à partir de la base académique Lexique 4."""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import unicodedata
import urllib.request
from pathlib import Path


SOURCE_URL = "https://lexique.org/databases/Lexique400/Lexique400.tsv"
SOURCE_NAME = "Lexique 4.00"
SOURCE_LICENSE = "CC BY-SA 4.0"
SOURCE_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"
WORD_LENGTH = 6
ACCEPTED_MIN_FREQUENCY = 0.05
ANSWER_MIN_FREQUENCY = 0.5
ANSWER_MIN_PREVALENCE = 60
ANSWER_CATEGORIES = {"ADJ", "ADV", "NOM", "VER"}
DEFAULT_ACCEPTED_OVERRIDES = Path("scripts/dictionary_overrides/accepted.txt")


def normalize_word(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.strip())
    return "".join(
        character for character in decomposed
        if unicodedata.category(character) != "Mn"
    ).upper()


def number(value: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def read_source(source: str) -> str:
    path = Path(source)
    if path.exists():
        return path.read_text(encoding="utf-8-sig")

    request = urllib.request.Request(
        source,
        headers={"User-Agent": "Gotus dictionary builder"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8-sig")


def read_word_overrides(path: Path) -> set[str]:
    if not path.exists():
        return set()

    words: set[str] = set()
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        value = line.split("#", 1)[0].strip()
        if not value:
            continue

        word = normalize_word(value)
        if not re.fullmatch(rf"[A-Z]{{{WORD_LENGTH}}}", word):
            raise ValueError(f"{path}:{line_number}: mot invalide pour Gotus : {value!r}")
        words.add(word)
    return words


def build_dictionary(
    source_text: str,
    *,
    accepted_overrides: set[str] | None = None,
) -> dict[str, object]:
    accepted: set[str] = set()
    answers: set[str] = set()
    reader = csv.DictReader(io.StringIO(source_text), delimiter="\t")

    for row in reader:
        original = row["1_Mot"].strip()
        normalized = normalize_word(original)
        frequency = number(row["11_FreqOrtho"])
        prevalence = number(row["33_Preval"])

        if original != original.lower():
            continue
        if not re.fullmatch(rf"[A-Z]{{{WORD_LENGTH}}}", normalized):
            continue
        if frequency < ACCEPTED_MIN_FREQUENCY:
            continue

        accepted.add(normalized)

        if (
            row["14_IsLem"] == "1"
            and row["5_Cgram"] in ANSWER_CATEGORIES
            and frequency >= ANSWER_MIN_FREQUENCY
            and prevalence >= ANSWER_MIN_PREVALENCE
        ):
            answers.add(normalized)

    accepted.update(accepted_overrides or set())

    if not answers or not answers.issubset(accepted):
        raise RuntimeError("La génération a produit un dictionnaire incohérent.")

    return {
        "formatVersion": 1,
        "lang": "fr",
        "length": WORD_LENGTH,
        "source": {
            "name": SOURCE_NAME,
            "url": SOURCE_URL,
            "license": SOURCE_LICENSE,
            "licenseUrl": SOURCE_LICENSE_URL,
            "attribution": "Boris New, Christophe Pallier et contributeurs de Lexique",
        },
        "filters": {
            "acceptedMinimumFrequency": ACCEPTED_MIN_FREQUENCY,
            "answerMinimumFrequency": ANSWER_MIN_FREQUENCY,
            "answerMinimumPrevalence": ANSWER_MIN_PREVALENCE,
            "answersAreLemmas": True,
            "acceptedOverrides": len(accepted_overrides or set()),
        },
        "answers": sorted(answers),
        "words": sorted(accepted),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default=SOURCE_URL,
        help="URL ou fichier TSV Lexique 4",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/data/dictionary.fr-6.json"),
        help="Fichier JSON à générer",
    )
    parser.add_argument(
        "--accepted-overrides",
        type=Path,
        default=DEFAULT_ACCEPTED_OVERRIDES,
        help="Fichier de mots à accepter en plus de Lexique 4",
    )
    args = parser.parse_args()

    accepted_overrides = read_word_overrides(args.accepted_overrides)
    dictionary = build_dictionary(
        read_source(args.source),
        accepted_overrides=accepted_overrides,
    )
    args.output.write_text(
        json.dumps(dictionary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"{len(dictionary['answers'])} réponses et "
        f"{len(dictionary['words'])} mots acceptés écrits dans {args.output}"
    )


if __name__ == "__main__":
    main()
