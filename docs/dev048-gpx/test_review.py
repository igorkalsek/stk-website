"""Only the provenance layer added after the original 10/10 GPX checks."""
import copy
import unittest
from validate import apply_review


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.record = dict(id="x", source_url="https://www.ptrf.si/course/",
                           target_url="https://www.ptrf.si/historical.gpx", linked_from_live_source=True,
                           file_status="VALID", target_http=dict(sha256="abc", status=200))
        self.review = dict(classification="OFFICIAL_HISTORICAL", file_edition_year=2026,
                           edition_evidence_urls=["https://www.ptrf.si/course/"],
                           binding=dict(source_url=self.record["source_url"], target_url=self.record["target_url"],
                                        sha256="abc", http_status=200))
        self.manifest = dict(candidates=[dict(id="x", provenance_review=self.review)])
        self.evidence = dict(candidates=[self.record], summary={})

    def classified(self):
        return apply_review(self.manifest, self.evidence)["candidates"][0]

    def test_historical_is_not_2027(self):
        result = self.classified()
        self.assertEqual(result["classification"], "OFFICIAL_HISTORICAL")
        self.assertTrue(result["eligible_for_archival_link_review"])
        self.assertFalse(result["eligible_for_2027_ui"])

    def test_changed_bytes_or_source_requires_review(self):
        for key, value in [("sha256", "changed"), ("http_status", 404), ("source_url", "changed"), ("target_url", "changed")]:
            old = self.review["binding"][key]
            self.review["binding"][key] = value
            self.assertEqual(self.classified()["classification"], "REVIEW")
            self.review["binding"][key] = old

    def test_unlinked_or_invalid_file_cannot_be_official(self):
        self.record["linked_from_live_source"] = False
        self.assertEqual(self.classified()["classification"], "REVIEW")
        self.record["linked_from_live_source"] = True
        self.record["file_status"] = "INVALID"
        self.assertEqual(self.classified()["classification"], "REVIEW")

    def test_2027_needs_explicit_file_confirmation(self):
        self.review.update(classification="OFFICIAL_2027_CONFIRMED", file_edition_year=2027)
        self.assertEqual(self.classified()["classification"], "REVIEW")

    def test_unofficial_and_missing_are_distinct(self):
        for status in ("UNOFFICIAL", "NOT_AVAILABLE", "REVIEW"):
            self.review["classification"] = status
            self.assertEqual(self.classified()["classification"], status)

    def test_absent_review_and_invalid_category_fail_closed(self):
        self.review["classification"] = "guess"
        self.assertEqual(self.classified()["classification"], "REVIEW")
        self.manifest["candidates"][0].pop("provenance_review")
        self.assertEqual(self.classified()["classification"], "REVIEW")

    def test_does_not_mutate_technical_snapshot(self):
        original = copy.deepcopy(self.evidence)
        apply_review(self.manifest, self.evidence)
        self.assertEqual(self.evidence, original)


if __name__ == "__main__":
    unittest.main()
