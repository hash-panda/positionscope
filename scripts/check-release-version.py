"""Immutable-release preflight; never reissue an existing preview or release."""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def validate_new_version(version):
    """New releases start at 0.2.1 and contain only canonical x.y.z digits."""
    if not isinstance(version, str) or not re.fullmatch(
        r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", version
    ):
        raise ValueError("New release version must be numeric x.y.z")
    if tuple(int(part) for part in version.split(".")) < (0, 2, 1):
        raise ValueError("New numeric releases start at 0.2.1")


def release_required(version, api_url, repository, token, opener=urllib.request.urlopen):
    # Read the existing tag first: the released beta.16 baseline must remain a
    # successful skip while staged feature PRs retain that immutable version.
    if not isinstance(version, str) or not version or len(version) > 100:
        raise ValueError("Invalid package version")
    tag = "v" + version
    url = api_url + "/repos/" + repository + "/releases/tags/" + urllib.parse.quote(tag, safe="")
    request = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "User-Agent": "PositionScope-release",
    })
    try:
        with opener(request, timeout=30) as response:
            existing = json.load(response)
        if not isinstance(existing, dict) or existing.get("tag_name") != tag:
            raise ValueError("Release lookup did not match the requested tag")
        return False
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
    # Only a verified absent tag can reach the policy for a NEW release.
    validate_new_version(version)
    return True


def main():
    version = json.loads(Path("package.json").read_text())["version"]
    required = release_required(version, os.environ["GITHUB_API_URL"],
                                os.environ["GITHUB_REPOSITORY"], os.environ["GH_TOKEN"])
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("required=" + str(required).lower() + "\n")
    print("New numeric version ready for signing" if required else
          "Version already released; skip signing. Change the version only in the final release PR.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Do not echo HTTP responses, request headers or environment values.
        print("Release preflight failed: verify release lookup and numeric version policy.", file=sys.stderr)
        raise SystemExit(1)
