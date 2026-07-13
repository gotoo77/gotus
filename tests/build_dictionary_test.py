import unittest

from scripts.build_dictionary import build_dictionary, normalize_word


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


if __name__ == "__main__":
    unittest.main()
