import importlib.util
import io
import json
import pathlib
import unittest
import urllib.error


spec = importlib.util.spec_from_file_location("release_policy", pathlib.Path(__file__).parents[1] / "scripts/check-release-version.py")
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class ReleasePolicyTests(unittest.TestCase):
    def check(self, version, opener):
        return policy.release_required(version, "https://api.github.com", "example/project", "synthetic-not-a-token", opener)

    def missing(self, request, timeout):
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(timeout, 30)
        raise urllib.error.HTTPError(request.full_url, 404, "synthetic", {}, None)

    def test_published_preview_and_numeric_version_skip_before_new_version_policy(self):
        for version in ["0.2.0-beta.16", "0.2.1"]:
            with self.subTest(version=version):
                def published(request, timeout):
                    self.assertTrue(request.full_url.endswith("/releases/tags/v" + version))
                    return io.StringIO(json.dumps({"tag_name": "v" + version, "prerelease": "beta" in version}))
                self.assertFalse(self.check(version, published))

    def test_new_numeric_release_is_allowed_only_after_absent_tag(self):
        for version in ["0.2.1", "0.2.2", "0.3.0", "1.0.0"]:
            with self.subTest(version=version):
                self.assertTrue(self.check(version, self.missing))

    def test_unpublished_preview_metadata_and_noncanonical_versions_are_rejected(self):
        for version in ["0.2.0-beta.17", "0.2.1-rc.1", "0.2.1+build.3", "v0.2.1", "0.02.1", "0.2", "0.2.1\n", "0.2.0", "0.1.99", "０.２.１"]:
            with self.subTest(version=version), self.assertRaises(ValueError):
                self.check(version, self.missing)

    def test_lookup_failures_never_enable_signing_or_assume_a_tag_is_absent(self):
        for status in [401, 403, 429, 500]:
            def failed(request, timeout):
                raise urllib.error.HTTPError(request.full_url, status, "synthetic private response", {}, None)
            with self.subTest(status=status), self.assertRaises(urllib.error.HTTPError):
                self.check("0.2.1", failed)
        with self.assertRaises(ValueError):
            self.check("0.2.1", lambda *args, **kwargs: io.StringIO('{"tag_name":"v0.2.2"}'))
        with self.assertRaises(ValueError):
            self.check("0.2.1", lambda *args, **kwargs: io.StringIO('[]'))
        with self.assertRaises(json.JSONDecodeError):
            self.check("0.2.1", lambda *args, **kwargs: io.StringIO('invalid synthetic JSON'))


if __name__ == "__main__":
    unittest.main()
