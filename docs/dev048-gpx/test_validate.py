import unittest
from unittest.mock import patch
from validate import validate_gpx, check_url, Redirects
from urllib.request import Request


def gpx(points='<trkpt lat="46" lon="14"/><trkpt lat="46.001" lon="14.001"/>', version="1.1"):
    return (f'<gpx xmlns="http://www.topografix.com/GPX/{version.replace(".", "/")}" version="{version}" creator="test">'
            f'<trk><trkseg>{points}</trkseg></trk></gpx>').encode()


class GPXTests(unittest.TestCase):
    def test_versions(self):
        for version in ("1.0", "1.1"):
            self.assertEqual(validate_gpx(gpx(version=version))["structural_check"], "PASS")

    def test_route(self):
        body = gpx().replace(b'trkseg', b'rte').replace(b'<trk>', b'').replace(b'</trk>', b'').replace(b'trkpt', b'rtept')
        self.assertEqual(validate_gpx(body)["route_points"], 2)

    def test_segments_not_joined(self):
        body = gpx().replace(b'</trkseg>', b'</trkseg><trkseg><trkpt lat="46.1" lon="14.1"/><trkpt lat="46.101" lon="14.101"/></trkseg>')
        self.assertLess(validate_gpx(body)["distance_km"], .3)

    def test_unsafe_xml_including_utf16(self):
        text = '<!DOCTYPE gpx [<!ENTITY bad "expanded">]>' + gpx().decode()
        for encoding in ("utf-8", "utf-16"):
            with self.assertRaises(ValueError):
                validate_gpx(text.encode(encoding))

    def test_coordinate_bounds_and_nan(self):
        for lat, lon in [("NaN", "14"), ("91", "14"), ("46", "180"), ("1e2", "14"), ("46", "Infinity")]:
            with self.assertRaises(ValueError):
                validate_gpx(gpx(f'<trkpt lat="{lat}" lon="{lon}"/><trkpt lat="46" lon="14"/>'))

    def test_empty_waypoints_and_wrong_namespace(self):
        for body in [gpx(''), gpx().replace(b'trkpt', b'wpt'), gpx().replace(b'GPX/1/1', b'GPX/1/0')]:
            with self.assertRaises(ValueError):
                validate_gpx(body)

    def test_distance_and_jump_review(self):
        result = validate_gpx(gpx('<trkpt lat="46" lon="14"/><trkpt lat="46.5" lon="14"/>'), 10)
        self.assertIn('DISTANCE_MISMATCH', result['warnings'])
        self.assertIn('JUMPS_OVER_1_KM', result['warnings'])

    def test_url_boundary(self):
        for url in ['http://www.ptrf.si/a.gpx', 'https://www.ptrf.si.evil.test/a.gpx',
                    'https://user:secret@www.ptrf.si/a', 'https://www.ptrf.si:444/a', 'https://127.0.0.1/a']:
            with self.assertRaises(ValueError):
                check_url(url, resolve=False)

    def test_private_dns(self):
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('127.0.0.1', 443))]):
            with self.assertRaises(ValueError):
                check_url('https://www.ptrf.si/a')

    def test_redirect_boundary(self):
        with self.assertRaises(ValueError):
            Redirects([]).redirect_request(Request('https://www.ptrf.si/a'), None, 302, '', {}, 'https://evil.test/a')


if __name__ == '__main__':
    unittest.main()
