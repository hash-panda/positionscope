#!/usr/bin/env bash
set -euo pipefail
export POSITIONSCOPE_STORAGE_TEST=1
export POSITIONSCOPE_STORAGE_TEST_PROFILE
POSITIONSCOPE_STORAGE_TEST_PROFILE=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/positionscope-storage-XXXXXX")
trap 'rm -rf "$POSITIONSCOPE_STORAGE_TEST_PROFILE"' EXIT
pnpm exec electron scripts/verify-secure-settings-native.cjs --phase=save
pnpm exec electron scripts/verify-secure-settings-native.cjs --phase=reload
