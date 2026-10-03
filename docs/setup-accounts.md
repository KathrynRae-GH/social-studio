# Accounts to set up (Katy)

In this order, because each step needs something from the one before. The one rule: **secret keys go straight into Render's Environment settings, never into chat, a document or an email.** If one ever lands in chat by accident, make a new one and delete the old one.

Screen labels in the Boutiqly developer portal and Render change from time to time. If a button isn't where these steps say, tell Claude what you see instead.

## 1. GitHub repository ✅ done Oct 3

Private repo `social-studio` with the starter kit in it.

## 2. Boutiqly developer account and the private app (part 1)

1. Open the developer portal (link in `docs/platform-notes.md`) and sign up with the **Boutiqly agency login**.
2. **My Apps → Create App.** Name: `Social Studio`. App type: **Private**. Target user / distribution: **Sub-account**. Who can install: **Agency only** (only the agency can install it into sub-accounts).
3. **Scopes** (Advanced Settings → Auth, or the Scopes section). Tick these:
   - `locations.readonly` (the shop's name and time zone)
   - `users.readonly` (names for the Team list)
   - `socialplanner/account.readonly` (which social accounts are connected)
   - `socialplanner/post.readonly` and `socialplanner/post.write` (create and track posts)
   - `medias.readonly` and `medias.write` (Boutiqly media storage)
   - `charges.readonly` and `charges.write` (wallet billing, Milestone 6)

   If a name is slightly different in the list, tick the closest match and tell Claude. Scopes can be added later, but each change means reinstalling.
4. **Shared Secret** (Advanced Settings → Auth → Shared Secret → Generate). Leave the tab open; it goes into Render in step 4.
5. **Client keys** (Advanced Settings → Auth → Client Keys → Add). You get a **Client ID** and a **Client Secret**. The secret may only be shown once: leave the tab open or come back and make a new one when Render is ready.
6. **Billing check** (App → Pricing): note whether a private app can turn on usage-based pricing and set up payouts, and what fee it shows. Tell Claude what you see (that's not secret).
7. Leave the **Redirect URL** and the **Custom Page URL** empty for now. They need Render's web address (step 5).

## 3. Claude API key

1. Go to platform.claude.com → sign in → **Settings → Workspaces → Create workspace**: `Social Studio`.
2. **Settings → Billing**: add a card and buy starting credits if asked.
3. **Settings → Limits**: set a **monthly spend limit** on the Social Studio workspace. Suggest $50 while we build.
4. **API Keys → Create Key**, workspace Social Studio, name `render`. Copy it into Render in step 4, not anywhere else.

## 4. Render (hosting): about $39 a month

Do this after Claude's first pull request is merged into `main` (the blueprint file has to be on `main`).

1. render.com → sign up **with GitHub** → add a card (Account → Billing).
2. Let Render see the repo: **New → Blueprint** → **Configure GitHub** → give it access to `social-studio` only.
3. Pick `social-studio`, branch `main`. Render reads `render.yaml` and lists three things: `social-studio` (web, Starter $7), `social-studio-worker` (worker, Standard $25), `social-studio-db` (Postgres basic, about $7).
4. Render asks for the secret values. Paste each from its own tab:
   - `BOUTIQLY_CLIENT_ID`, `BOUTIQLY_CLIENT_SECRET`, `BOUTIQLY_SHARED_SECRET` (step 2)
   - `BOUTIQLY_APP_ID`: the app's id from the portal (in the app's address bar or settings page)
   - `BOUTIQLY_APP_DOMAINS`: the address you open Boutiqly at, e.g. `app.boutiqly.io` (no secret; Claude can fill this in with you)
   - `ANTHROPIC_API_KEY` (step 3)
   - Anything you don't have yet can stay empty and be added later under the service → **Environment**.
5. **Apply.** The first build takes a few minutes. Then open `https://<your web address>.onrender.com/health`: it should say **Social Studio is up**, with Database **Connected** and Worker **Running**.

## 5. Boutiqly private app (part 2) and the test sub-account

1. In the Boutiqly agency, make a sub-account called **Social Studio Test**. Connect a throwaway Instagram (or a spare page) for later posting tests.
2. Back in the developer portal, on the Social Studio app:
   - **Redirect URL**: `https://<your web address>.onrender.com/oauth/callback`
   - **Custom Page** (Modules → Custom Pages → Add): Title `Social Studio`, URL `https://<your web address>.onrender.com/`
3. Install the app into **Social Studio Test** (the portal's install link, or the agency's marketplace → Social Studio → Install → pick the sub-account). You land on a page saying "Social Studio is installed".
4. Switch into Social Studio Test. **Social Studio** should be in the left menu. Open it: you should see your name and **Boutiqly team**.
5. On your phone, open the LeadConnector app, switch to Social Studio Test, and look for Social Studio in the menu. Tell Claude what you see.

## Before the content engine milestone (late October)

- Bring Make Space's content engine (the Python and video scripts behind its 16 Reel styles, 8 post styles and Story templates) and its brand docs (voice and copy rules, visual brand and video guide, Reel and post styles, content library doc) from the Make Space project into this repo: engine code into `reference/engine/`, brand docs into `brands/make-space/`. Claude in the Make Space project can export them for you.
