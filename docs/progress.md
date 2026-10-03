# Progress log

Newest entry at the top. Every session ends by adding one: what got done, what's next, and anything waiting on Katy.

## Oct 3, 2026: session 1 (stack, skeleton, the tab's sign-in)

- Done:
  - Unpacked the starter kit into the repo (it had been uploaded as a zip).
  - Stack and repo layout agreed and logged (`docs/decisions.md`). Two decisions from Katy: the worker is set up now (~$40/mo hosting from the start), and **Boutiqly's team names each brand's owner** (scope updated).
  - Milestone 0 code: web app + API (TypeScript), Python worker with heartbeat and jobs table, Postgres migrations, health page, `render.yaml`, GitHub CI.
  - Milestone 1 code: the tab asks Boutiqly who's looking and the server verifies it; roles (Boutiqly team, owner, team member, request access); Team panel on the Brand screen; audit log; app install with encrypted tokens; the five screens and the Ask Claude panel (empty for now), phone width.
  - Tested locally: 37 automated tests pass; every role's screens checked in Chromium through a local Boutiqly stand-in.
  - `docs/setup-accounts.md` rewritten in the order the steps depend on each other, with exact settings.
- Not done yet: neither milestone is "done" until it runs on Render and inside Boutiqly. That needs the accounts below.
- Next: Katy merges the pull request → Render blueprint → register the custom page and install in Social Studio Test → check Katy sees her name and role, a non-team user sees request access, and what the LeadConnector phone app shows. Then Milestone 2.
- Katy created the Boutiqly developer account and the Social Studio app; Pricing set to Paid, usage only (see `docs/platform-notes.md`).
- Waiting on Katy (in `docs/setup-accounts.md` order): Claude API key (step 3), merge the PR then Render (step 4), test sub-account and install (step 5). Also: update the live scope doc with the new owner rule, and tell Claude what the portal's Pricing page says about private-app billing.
- Risks still open: private-app wallet billing and the platform's cut (0% vs 15%); whether the phone app shows custom tabs; the user-context field names are taken from the official template and get confirmed on the first real sign-in.

## Oct 3, 2026: scope finished, starter kit added

- Done: v1 scope approved (`docs/scope.md`); this starter kit created in the Boutiqly project chat.
- Next: session 1, using `FIRST-SESSION-PROMPT.md`: confirm the stack, set up the accounts together, start M1 (the tab loading inside Boutiqly).
- Waiting on Katy: create the private `social-studio` repo and upload this kit (`docs/setup-accounts.md`, step 1).
