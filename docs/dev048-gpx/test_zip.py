import io
import stat
import unittest
import warnings
import zipfile
from unittest.mock import patch

import validate
from test_validate import gpx


def archive(entries, compression=zipfile.ZIP_DEFLATED):
    buffer = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', UserWarning)
        with zipfile.ZipFile(buffer, 'w', compression=compression) as z:
            for name, body in entries:
                z.writestr(name, body)
    return buffer.getvalue()


class ZipTests(unittest.TestCase):
    def test_valid_archive_hashes_members_and_distance(self):
        body = archive([('folder/route.gpx', gpx()), ('readme.txt', b'public route')])
        result = validate.validate_zip(body)
        self.assertEqual(result['member_count'], 2)
        self.assertEqual(result['files'][0]['file_status'], 'FILE_VALID')
        self.assertEqual(result['files'][0]['sha256'], validate.hashlib.sha256(gpx()).hexdigest())
        self.assertEqual(result['archive_sha256'], validate.hashlib.sha256(body).hexdigest())

    def test_zip_slip_and_windows_paths(self):
        for name in ('../a.gpx', '/a.gpx', 'a/../../b.gpx', 'C:/a.gpx', 'a\\b.gpx'):
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'Unsafe ZIP path'):
                validate.validate_zip(archive([(name, gpx())]))

    def test_symlink(self):
        entry = zipfile.ZipInfo('link.gpx')
        entry.create_system = 3
        entry.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.assertRaisesRegex(ValueError, 'symlink'):
            validate.validate_zip(archive([(entry, b'../target')]))

    def test_nested_archive(self):
        with self.assertRaisesRegex(ValueError, 'Nested archive'):
            validate.validate_zip(archive([('inner.ZIP', archive([('a.gpx', gpx())]))]))

    def test_disguised_nested_archive(self):
        with self.assertRaisesRegex(ValueError, 'Nested archive signature'):
            validate.validate_zip(archive([('readme.txt', archive([('a.gpx', gpx())])), ('route.gpx', gpx())]))

    def test_ratio_bomb(self):
        with self.assertRaisesRegex(ValueError, 'compression ratio'):
            validate.validate_zip(archive([('bomb.gpx', b'x' * 100000)]))

    def test_expanded_total_bound(self):
        body = archive([('a.gpx', gpx()), ('b.gpx', gpx())], zipfile.ZIP_STORED)
        with patch.object(validate, 'MAX_EXPANDED_BYTES', len(gpx()) + 1):
            with self.assertRaisesRegex(ValueError, 'expansion'):
                validate.validate_zip(body)

    def test_member_count(self):
        with self.assertRaisesRegex(ValueError, 'member count'):
            validate.validate_zip(archive([(f'{i}.txt', b'x') for i in range(101)]))

    def test_duplicate_names_casefold(self):
        for names in [('a.gpx', 'a.gpx'), ('a.gpx', 'A.GPX')]:
            with self.assertRaisesRegex(ValueError, 'Duplicate ZIP member'):
                validate.validate_zip(archive([(n, gpx()) for n in names]))

    def test_duplicate_payloads_are_not_two_unique_files(self):
        files = validate.validate_zip(archive([('a.gpx', gpx()), ('b.gpx', gpx())]))['files']
        self.assertEqual(len({f['sha256'] for f in files}), 1)

    def test_dtd_in_zip(self):
        body = b'<!DOCTYPE gpx [<!ENTITY x "unsafe">]>' + gpx()
        result = validate.validate_zip(archive([('a.gpx', body)]))
        self.assertEqual(result['files'][0]['file_status'], 'INVALID')
        self.assertIn('DTD', result['files'][0]['error'])

    def test_misleading_html(self):
        result = validate.validate_zip(archive([('route.gpx', b'<html>Download GPX</html>')]))
        self.assertEqual(result['files'][0]['file_status'], 'INVALID')
        with self.assertRaises(zipfile.BadZipFile):
            validate.validate_zip(b'<html>ZIP download</html>')

    def test_no_gpx(self):
        with self.assertRaisesRegex(ValueError, 'no GPX'):
            validate.validate_zip(archive([('readme.txt', b'x')]))

    def test_corrupt_archive(self):
        with self.assertRaises(zipfile.BadZipFile):
            validate.validate_zip(archive([('a.gpx', gpx())])[:-30])

    def test_geometry_ignores_metadata_and_direction_not_segments(self):
        body = gpx()
        same = body.replace(b'creator="test"', b'creator="other"')
        self.assertEqual(validate.validate_gpx(body)['geometry_sha256_6dp'], validate.validate_gpx(same)['geometry_sha256_6dp'])
        self.assertNotEqual(validate.hashlib.sha256(body).hexdigest(), validate.hashlib.sha256(same).hexdigest())


if __name__ == '__main__':
    unittest.main()
