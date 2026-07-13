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


def build_dictionary(source_text: str) -> dict[str, object]:
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
    args = parser.parse_args()

    dictionary = build_dictionary(read_source(args.source))
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
