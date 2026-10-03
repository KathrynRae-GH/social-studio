# Progress log

Newest entry at the top. Every session ends by adding one: what got done, what's next, and anything waiting on Katy.

## Oct 3, 2026: session 1 (stack, skeleton, the tab live inside Boutiqly)

- Done:
  - Starter kit unpacked into the repo. Stack and layout agreed and logged (`docs/decisions.md`). Katy's decisions: worker set up now (~$39/mo hosting), and **Boutiqly's team names each brand's owner** (scope updated).
  - Milestone 0 and 1 code merged (PR #1): web app + API, Python worker, database, health page, `render.yaml`, CI; sign-in from Boutiqly, roles, Team panel, audit log, encrypted install tokens, the five screens and the Ask Claude panel.
  - Fix merged (PR #2): Render's first deploy didn't see the app's port; it now starts `node` directly and logs crashes and shutdowns.
  - Accounts: Boutiqly developer account and private app (Paid, usage only, no plans), Claude API key ($50/mo limit), Render (live at https://social-studio-ohoa.onrender.com), app installed in sub-account **Test Boutique**.
  - **The tab loads inside Boutiqly and shows Katy's name and "Boutiqly team".** Boutiqly's address is `app.boutiqly.io` (needed in `BOUTIQLY_APP_DOMAINS`).
  - Learned: client keys and the Shared Secret live under Manage → Secrets; the Auth page won't save without a Redirect URL.
- Added after Katy's first look: a "Set up this shop" checklist, the shop's real name at the top, and an "Add someone" picker on Brand → Team that lists the sub-account's Boutiqly users, so agency admins can name owners and staff without them opening the tab first.
- Still to check for Milestone 1: a sub-account user who isn't on the Team list sees the request-access screen; whether the tab shows in the LeadConnector phone app.
- Next: those two checks, then Milestone 2 (Library, Calendar, posting through Boutiqly's social planner).
- Waiting on Katy: the two checks; update the live scope doc with the new owner rule; Make Space's content engine and brand docs before late October.
- Risks still open: private-app wallet billing and the platform's cut (0% vs 15%; the Pricing page shows no fee); whether the phone app shows custom tabs; whether the app needs publishing before installing in other sub-accounts.

## Oct 3, 2026: scope finished, starter kit added

- Done: v1 scope approved (`docs/scope.md`); this starter kit created in the Boutiqly project chat.
- Next: session 1, using `FIRST-SESSION-PROMPT.md`: confirm the stack, set up the accounts together, start M1 (the tab loading inside Boutiqly).
- Waiting on Katy: create the private `social-studio` repo and upload this kit (`docs/setup-accounts.md`, step 1).
