<!--
Thanks for the contribution! Please skim CONTRIBUTING.md once before opening:
https://github.com/onchainattack/oak-mcp/blob/main/CONTRIBUTING.md

If this PR changes OAK content (Tactics, Techniques, Mitigations, Software,
worked examples), it's in the wrong repo — open it against
https://github.com/onchainattack/oak instead.
-->

## Summary

<!-- One or two sentences: what does this PR change and why? -->

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New tool / capability (non-breaking)
- [ ] Schema change to an existing tool (potentially breaking)
- [ ] Build / packaging / CI
- [ ] Tests only
- [ ] Docs only
- [ ] Refresh of `data/embedded.json` (run `npm run fetch-data`)

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] If a new tool was added, it's listed in `TOOLS`, has a handler, has at
      least one test in `tests/server.test.ts`, and is documented in the
      README's tool table
- [ ] If `inputSchema` changed, the corresponding `oak_get_*` / `oak_search`
      / etc. callers in the README and CHANGELOG reflect it
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`
- [ ] No new runtime dependency added without prior discussion
- [ ] PR title follows `<type>(<scope>): <subject>` (`feat(search): …`,
      `fix(fetch-data): …`, `chore: …`, `test: …`, `docs: …`)

## Notes for reviewers

<!-- Anything reviewers should pay extra attention to: tricky logic, perf
implications, behaviour on edge cases, deliberate trade-offs, etc. -->
