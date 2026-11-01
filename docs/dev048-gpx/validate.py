#!/usr/bin/env python3
"""DEV-048 P0: bounded, read-only HTTP and GPX structural checks. Python 3.10+."""
import argparse
import copy
import hashlib
import ipaddress
import json
import math
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

HOSTS = frozenset({"www.knaptrail.si", "www.bagus.si", "www.ptrf.si",
                   "www.srd-kras.si", "www.viewgpx.com", "tracedetrail.fr",
                   "www.topografix.com", "stk-master-api.igor-kalsek.workers.dev"})
MAX_BYTES = 12 * 1024 * 1024
NS = {"1.0": "http://www.topografix.com/GPX/1/0", "1.1": "http://www.topografix.com/GPX/1/1"}


def check_url(url, resolve=True):
    p = urllib.parse.urlsplit(url)
    if (p.scheme != "https" or p.hostname not in HOSTS or p.username or p.password
            or p.port not in (None, 443) or p.fragment):
        raise ValueError("URL outside HTTPS allowlist")
    if resolve:
        addresses = socket.getaddrinfo(p.hostname, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(x[4][0]).is_global for x in addresses):
            raise ValueError("Non-public destination")
    return url


class Redirects(urllib.request.HTTPRedirectHandler):
    def __init__(self, chain):
        self.chain = chain

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl)
        if len(self.chain) >= 5:
            raise ValueError("Too many redirects")
        self.chain.append({"from": req.full_url, "status": code, "to": newurl})
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url):
    evidence = {"url": url, "checked_at": datetime.now(timezone.utc).isoformat(), "redirects": []}
    try:
        check_url(url)
        opener = urllib.request.build_opener(Redirects(evidence["redirects"]))
        req = urllib.request.Request(url, headers={"User-Agent": "STK-DEV048-P0/1.0", "Accept-Encoding": "identity"})
        try:
            response = opener.open(req, timeout=25)
        except urllib.error.HTTPError as error:
            response = error
        with response as r:
            evidence.update(status=r.code, final_url=r.geturl(), content_type=r.headers.get("Content-Type"),
                            content_disposition=r.headers.get("Content-Disposition"))
            body = r.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ValueError("Response exceeds 12 MiB")
            evidence.update(bytes=len(body), sha256=hashlib.sha256(body).hexdigest())
            return body, evidence
    except (OSError, ValueError, urllib.error.URLError) as error:
        evidence["error"] = str(error)
        return None, evidence


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []
        self.text = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "a" and d.get("href"):
            self.hrefs.append(d["href"])
        if tag in ("script", "style"):
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.text.append(data)


class NoDTD(ET.TreeBuilder):
    def doctype(self, name, pubid, system):
        raise ValueError("DTD is forbidden")


def haversine(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1, h)))


def validate_gpx(body, expected_km=None):
    if len(body) > MAX_BYTES:
        raise ValueError("GPX exceeds 12 MiB")
    root = ET.fromstring(body, parser=ET.XMLParser(target=NoDTD()))
    version = root.get("version")
    if version not in NS or root.tag != "{" + NS[version] + "}gpx" or not root.get("creator", "").strip():
        raise ValueError("Expected GPX 1.0/1.1 namespace, version and creator")
    q = lambda tag: "{" + NS[version] + "}" + tag
    tracks = [seg.findall(q("trkpt")) for trk in root.findall(q("trk")) for seg in trk.findall(q("trkseg"))]
    routes = [r.findall(q("rtept")) for r in root.findall(q("rte"))]
    paths = tracks if any(tracks) else routes
    if not paths or not any(len(p) >= 2 for p in paths):
        raise ValueError("At least two track or route points in one segment are required")
    # Validate all standard coordinate points, including waypoints and unused route geometry.
    coords = {}
    for p in root.iter():
        if p.tag in {q("trkpt"), q("rtept"), q("wpt")}:
            values = [p.get(k, "") for k in ("lat", "lon")]
            if not all(re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", v) for v in values):
                raise ValueError("Invalid decimal coordinate")
            lat, lon = map(float, values)
            if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon < 180):
                raise ValueError("Coordinate outside WGS84 limits")
            coords[id(p)] = (lat, lon)
    distance, jumps = 0, 0
    for segment in paths:
        for a, b in zip(segment, segment[1:]):
            step = haversine(coords[id(a)], coords[id(b)])
            distance += step
            jumps += step > 1
    selected = [coords[id(p)] for seg in paths for p in seg]
    names = [(e.text or "").strip()[:500] for e in root.iter() if e.tag in {q("name"), q("desc")} and e.text]
    times = [(e.text or "")[:60] for e in root.iter() if e.tag == q("time") and e.text]
    warnings = []
    if jumps:
        warnings.append("JUMPS_OVER_1_KM")
    if expected_km and abs(distance - expected_km) > max(2, expected_km * .25):
        warnings.append("DISTANCE_MISMATCH")
    if not all(45 <= lat <= 47 and 13 <= lon <= 17 for lat, lon in selected):
        warnings.append("OUTSIDE_BROAD_SLOVENIA_BOUNDS")
    if tracks and routes:
        warnings.append("TRACK_AND_ROUTE_PRESENT_DISTANCE_USES_TRACKS")
    copyrights = [ET.tostring(e, encoding="unicode")[:1000] for e in root.iter() if e.tag == q("copyright")]
    return {"structural_check": "PASS", "xsd_validation": "NOT_PERFORMED", "version": version,
            "creator": root.get("creator"), "track_points": sum(map(len, tracks)),
            "route_points": sum(map(len, routes)), "segments": len(paths),
            "distance_km": round(distance, 3), "jumps_over_1km": jumps,
            "bbox": [min(x[0] for x in selected), min(x[1] for x in selected),
                     max(x[0] for x in selected), max(x[1] for x in selected)],
            "names_and_descriptions": names[:20], "first_time": times[0] if times else None,
            "last_time": times[-1] if times else None, "copyright_metadata": copyrights,
            "warnings": warnings}


CLASSIFICATIONS = frozenset({"OFFICIAL_HISTORICAL", "OFFICIAL_2027_CONFIRMED",
                            "UNOFFICIAL", "REVIEW", "NOT_AVAILABLE"})


def apply_review(manifest, evidence):
    """Attach human provenance findings to the exact previously checked response.

    This is a research assessment, never authorization to publish a route.
    A new response/hash or a changed source requires a new provenance review.
    """
    result = copy.deepcopy(evidence)
    candidates = {c["id"]: c for c in manifest["candidates"]}
    for record in result["candidates"]:
        candidate = candidates.get(record["id"], {})
        review = candidate.get("provenance_review", {})
        classification = review.get("classification", "REVIEW")
        binding = review.get("binding", {})
        bound = bool(binding) and all([
            binding.get("source_url") == record.get("source_url"),
            binding.get("target_url") == record.get("target_url"),
            binding.get("sha256") == record.get("target_http", {}).get("sha256"),
            binding.get("http_status") == record.get("target_http", {}).get("status"),
            record.get("linked_from_live_source") is True,
        ])
        if classification not in CLASSIFICATIONS or not bound:
            classification = "REVIEW"
        if classification in {"OFFICIAL_HISTORICAL", "OFFICIAL_2027_CONFIRMED"}:
            if record.get("file_status") != "VALID" or not review.get("edition_evidence_urls"):
                classification = "REVIEW"
        year = review.get("file_edition_year")
        if classification == "OFFICIAL_HISTORICAL" and not (
            isinstance(year, int) and not isinstance(year, bool) and 2000 <= year < 2027
        ):
            classification = "REVIEW"
        if classification == "OFFICIAL_2027_CONFIRMED" and (
            review.get("file_edition_year") != 2027 or not review.get("explicit_2027_file_confirmation")
        ):
            classification = "REVIEW"
        record["classification"] = classification
        record["provenance_review"] = copy.deepcopy(review)
        record["review_binding_matches"] = bound
        record["registry_reference"] = copy.deepcopy(candidate.get("registry_reference"))
        record["registry_identity_status"] = candidate.get("registry_identity_status", "NOT_VERIFIED")
        record["eligible_for_2027_ui"] = False
        record["eligible_for_archival_link_review"] = classification == "OFFICIAL_HISTORICAL"
    counts = {status: sum(r["classification"] == status for r in result["candidates"])
              for status in sorted(CLASSIFICATIONS)}
    result["provenance_reviewed_at"] = manifest.get("provenance_reviewed_at")
    result["summary"].update(
        classifications=counts,
        registry_identity=manifest.get("registry_review_status", "NOT_VERIFIED"),
        edition_2027_confirmed=counts["OFFICIAL_2027_CONFIRMED"],
        p0_gate="NO_GO",
        reason="Research validator does not authorize publication; resolve edition and registry findings in README",
        archival_pilot_assessment=("FEASIBLE_WITH_HISTORICAL_LABELS_AND_ORGANIZER_LINKS"
                                   if counts["OFFICIAL_HISTORICAL"] else "REVIEW"),
    )
    return result


def run(manifest):
    cache = {}

    def get(url):
        if url not in cache:
            cache[url] = fetch(url)
        return cache[url]

    results = []
    for candidate in manifest["candidates"]:
        record = dict(candidate)
        source_body, record["source_http"] = get(candidate["source_url"])
        if source_body and record["source_http"].get("status") == 200:
            parser = Links()
            parser.feed(source_body.decode("utf-8", errors="replace"))
            links = [urllib.parse.urljoin(record["source_http"]["final_url"], x) for x in parser.hrefs]
            record["linked_from_live_source"] = candidate["target_url"] in links
            record["discovered_gpx_hrefs"] = list(dict.fromkeys(x for x in links if ".gpx" in x.lower()))
            text = " ".join(parser.text)
            record["source_mentions_2027"] = bool(re.search(r"\b2027\b", text))
        else:
            record["linked_from_live_source"] = None
        body, record["target_http"] = get(candidate["target_url"])
        record["file_status"] = "HTTP_ERROR" if record["target_http"].get("status", 200) != 200 else "NOT_VERIFIED"
        if body is not None and record["target_http"].get("status") == 200:
            try:
                record["gpx"] = validate_gpx(body, candidate["expected_km"])
                record["file_status"] = "REVIEW" if record["gpx"]["warnings"] else "VALID"
            except (ValueError, ET.ParseError) as error:
                record["file_status"] = "MAP_PAGE_ONLY" if candidate["target_kind"] == "map_page" else "INVALID"
                record["gpx_error"] = str(error)
        years = sorted(set(re.findall(r"(?<!\d)20\d{2}(?!\d)", urllib.parse.unquote(candidate["target_url"]))))
        record["url_years"] = years
        metadata_years = sorted(set(re.findall(r"(?<!\d)20\d{2}(?!\d)", " ".join(record.get("gpx", {}).get("names_and_descriptions", [])))))
        record["metadata_name_years"] = metadata_years
        record["edition_status"] = "HISTORICAL_REFERENCE_REVIEW" if any(y != "2027" for y in years + metadata_years) else "UNCONFIRMED_2027"
        # Never promote edition or registry identity from HTTP, metadata time or URL heuristics.
        record["eligible_for_2027_ui"] = False
        results.append(record)
    valid = [r for r in results if r["file_status"] in ("VALID", "REVIEW")]
    evidence = {"checked_at": datetime.now(timezone.utc).isoformat(), "task": "DEV-048", "candidates": results,
            "summary": {"candidate_count": len(results), "unique_structurally_valid_files": len({r["target_http"]["sha256"] for r in valid}),
                        "edition_2027_confirmed": 0, "registry_identity": "NOT_VERIFIED",
                        "p0_gate": "NO_GO", "reason": "2027 edition and RACE_REGISTRY evidence remain required"}}
    return apply_review(manifest, evidence)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path(__file__).with_name("manifest.json"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--existing-evidence", type=Path,
                        help="Apply reviewed provenance to an existing technical snapshot without network requests")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    evidence = (apply_review(manifest, json.loads(args.existing_evidence.read_text()))
                if args.existing_evidence else run(manifest))
    args.output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
