# Accounts to set up (Katy)

Five things, in this order. Claude walks you through each one in session 1, so you don't need to do them ahead of time. The one rule: **secret keys go straight into Render's Environment settings, never into chat, a document or an email.** If one ever lands in chat by accident, make a new one and delete the old one.

## 1. GitHub repository ✅ account exists

- Make a **private** repository called `social-studio` (no README, no template).
- Add this starter kit to it. Easiest: on the new repo's page, choose "uploading an existing file", drag in everything inside the unzipped `social-studio-starter` folder (the files and folders, not the folder itself), and commit. A Mac hides the two files whose names start with a dot (`.gitignore`, `.env.example`); if they don't come along, Claude adds them in session 1.
- Then open Claude Code (web or desktop), pick the `social-studio` repository, and paste the prompt from `FIRST-SESSION-PROMPT.md`.

## 2. Boutiqly developer account and the private app

- Sign up for the developer portal with the **Boutiqly agency login** (the portal link is in `docs/platform-notes.md`).
- Create the app as **Private**, for sub-accounts, installed by the agency only. Claude gives you the exact settings and permission scopes when you get here.
- The portal shows a Client ID, a Client Secret and a Shared Secret (for the custom page). They go into Render (step 3), not chat.
- Check two billing questions while you're in the portal (Claude will point to where): whether the private app can take usage charges, and the payout setup.

## 3. Render (hosting)

- Make an account at render.com and add a card.
- Claude writes a `render.yaml` blueprint that sets up the three pieces at once: the web app, the worker and the database. You connect the GitHub repo and approve it.
- Expected cost to start: about $40 a month. The free workspace covers one login; it's $25 a month more once the reviewing developer needs access.
- Every secret from steps 2 and 4 is pasted into Render → the service → Environment. The names are in `.env.example`.

## 4. Claude API key

- In the Claude Console (platform.claude.com), make a workspace called "Social Studio", add billing, and **set a monthly spend limit** so nothing runs away while we build.
- Create an API key and paste it straight into Render as `ANTHROPIC_API_KEY`.
- This is billed per use, separately from your Claude plan.

## 5. A test sub-account

- In the Boutiqly agency, make a sub-account called "Social Studio Test". Connect a throwaway Instagram (or a spare page) so we can post for real without touching a live brand.
- Make Space comes next, once posting through the test sub-account works.

## Before the content engine milestone (late October)

- Bring Make Space's content engine (the Python and video scripts behind its 16 Reel styles, 8 post styles and Story templates) and its brand docs (voice and copy rules, visual brand and video guide, Reel and post styles, content library doc) from the Make Space project into this repo: engine code into `reference/engine/`, brand docs into `brands/make-space/`. Claude in the Make Space project can export them for you.
