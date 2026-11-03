import unittest
from unittest.mock import MagicMock, patch
from validate import fetch


class FetchEncodingTests(unittest.TestCase):
    def test_unicode_download_link_encoded_without_double_encoding(self):
        url='https://velenjetrail.si/GPX/Družinski%20trail.gpx'
        response=MagicMock()
        response.__enter__.return_value=response
        response.code=200
        response.headers={}
        response.geturl.return_value='https://velenjetrail.si/GPX/Dru%C5%BEinski%20trail.gpx'
        response.read.return_value=b'bounded payload'
        opener=MagicMock();opener.open.return_value=response
        with patch('validate.check_url') as boundary, patch('validate.throttle'), patch('validate.urllib.request.build_opener',return_value=opener):
            body,http=fetch(url)
        boundary.assert_called_once_with(url)
        request=opener.open.call_args.args[0]
        self.assertEqual(request.full_url,response.geturl.return_value)
        self.assertNotIn('%2520',request.full_url)
        self.assertEqual(http['url'],url)
        self.assertEqual(http['request_url'],request.full_url)
        self.assertEqual(body,b'bounded payload')
