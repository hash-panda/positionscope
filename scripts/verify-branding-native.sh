#!/bin/bash
set -euo pipefail
./node_modules/.bin/electron scripts/verify-branding-native.cjs
