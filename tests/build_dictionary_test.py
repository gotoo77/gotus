import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.build_dictionary import build_dictionary, normalize_word, read_word_overrides


HEADER = "\t".join([
    "1_Mot", "5_Cgram", "11_FreqOrtho", "14_IsLem", "33_Preval"
])


class DictionaryBuilderTest(unittest.TestCase):
    def test_normalizes_accents(self):
        self.assertEqual(normalize_word("Écrire"), "ECRIRE")

    def test_separates_accepted_words_from_possible_answers(self):
        source = "\n".join([
            HEADER,
            "écrire\tVER\t12.5\t1\t100",
            "écrive\tVER\t0.1\t0\t90",
            "Rarete\tNOM\t3\t1\t100",
        ])

        result = build_dictionary(source)

        self.assertEqual(result["answers"], ["ECRIRE"])
        self.assertEqual(result["words"], ["ECRIRE", "ECRIVE"])

    def test_adds_accepted_overrides_only_to_playable_words(self):
        source = "\n".join([
            HEADER,
            "écrire\tVER\t12.5\t1\t100",
        ])

        result = build_dictionary(source, accepted_overrides={"CONFIS"})

        self.assertEqual(result["answers"], ["ECRIRE"])
        self.assertEqual(result["words"], ["CONFIS", "ECRIRE"])
        self.assertEqual(result["filters"]["acceptedOverrides"], 1)

    def test_reads_and_validates_accepted_overrides(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "accepted.txt"
            path.write_text("confit\n# commentaire\nécales  # forme accentuée\n", encoding="utf-8")

            self.assertEqual(read_word_overrides(path), {"CONFIT", "ECALES"})

    def test_rejects_invalid_accepted_overrides(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "accepted.txt"
            path.write_text("trop-long\n", encoding="utf-8")

            with self.assertRaises(ValueError):
                read_word_overrides(path)


if __name__ == "__main__":
    unittest.main()
