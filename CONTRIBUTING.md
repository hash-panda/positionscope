# Contributing to PositionScope

Start with an existing Issue or a small proposal describing the user scenario, observed behavior and expected result. Do not include API keys, passphrases, private keys, real balances or identifying screenshots. Use synthetic fixtures. Do not place live trades to test a contribution.

Use a focused branch and PR. Describe the final behavior, relevant tests and known limits. Run `pnpm typecheck`, `pnpm test`, `pnpm build`; UI changes also run `pnpm test:ui`. Signing input tests: `python3 -m unittest discover -s tests -p 'test_*.py'`. Website: `node scripts/build-site.cjs && node scripts/verify-site.cjs`. Generated website pages are committed; publish through the maintained Sites workflow after review.

Changes to exchange normalization need source links, units, precision, hedged/zero/error fixtures and explicit unsupported shapes. AI changes need reproducible facts and evidence against hallucination, not a subjective intelligence claim. No trading or withdrawal capability is accepted without a separately reviewed product scope decision. See docs/OPERATING-PLAN.md and docs/release-signing.md.

PR checks must pass before merge. Releases use new versions and verified artifacts; never overwrite a released binary. Native macOS, real exchange and notarization checks must be recorded separately from browser fixtures. Report security-sensitive issues privately through the repository security reporting surface when available; do not publish secrets or exploitable account details in an Issue.
