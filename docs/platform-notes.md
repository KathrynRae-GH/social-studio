# Platform notes: what Boutiqly allows, and what we learned

Facts the app has to respect. Sources: Make Space's real posts through Boutiqly's social planner (54 posts set up Oct 2, 2026, going out Oct 2–10), and the platform's developer docs and help center as checked on Oct 3, 2026. Re-check anything marked "confirm" before building on it.

Naming: in this repo the platform is always "Boutiqly" (see `CLAUDE.md`). The developer docs live on the vendor's own domains; links are at the bottom.

## Boutiqly's own setup

- Boutiqly is a white-labeled agency account on the platform's top agency plan, in SaaS mode with Stripe. That plan is what allows usage to be rebilled to sub-accounts with a markup.
- Boutiqly's tiers (Lite, Boutiqly, Plus) are SaaS plans built in the SaaS Configurator, each with a snapshot attached.
- Each shop is a sub-account (the API calls it a "location"). Boutiqly's own brand lives in sub-account `oc1walt6ptDcULYFs7oO`. Make Space has its own sub-account.
- The phone app Boutiqly users have today is the LeadConnector app.
- Lesson from Boutiqly's history: the platform's built-in AI features can wipe out margin on lower tiers. Social Studio meters its own Claude use and bills it; don't switch on the platform's paid AI features for this.

## The app itself

- **Private marketplace app**, installed under the Boutiqly agency. Private apps install in up to 5 agencies, and all sub-accounts under one agency count as one, so Boutiqly needs no review to start. A public listing (with the platform's security review) comes later, only if Social Studio is sold beyond Boutiqly.
- **Custom page:** the tab is our own web app, loaded inside Boutiqly in an iframe and shown in each sub-account's left menu. It must be served over HTTPS and allow being embedded by the platform's domains (CSP `frame-ancestors`).
- **Who's looking:** the custom page can request signed user context from the parent app (user, role, agency or sub-account user, active sub-account). Decrypt and verify it server-side with the app's shared secret on every session. URL placeholder variables also exist, but never trust IDs from the URL or browser on their own.
- **OAuth:** the app gets an access token per install (agency or sub-account) and refreshes it. Store tokens encrypted.
- **Menu visibility:** custom menu links can be limited by user role and by sub-account. The app also enforces its own Team list.

## Social planner

- **Channels** (help center, updated Aug 18, 2026): Facebook, Instagram, Threads, Google Business Profile, LinkedIn, TikTok, YouTube, Pinterest, communities and Bluesky. **X is not on the list**, though some third-party guides still show it; check the connect screen on day one. Post types, media options and analytics vary by channel.
- **Accounts:** the planner lists each connected account (Instagram, Facebook page, Threads, TikTok and so on) with its own id. Every post names the accounts it goes to and the Boutiqly user it belongs to. When an account loses authorization, Boutiqly shows an alert and scheduled posts to it fail until it's reconnected, so the app should surface "needs reconnecting" notices.
- **App pings (push-notification posts):** Instagram Stories and Reels can be scheduled with "publish via push notification" and a note. At the time, the Boutiqly phone app pings; tapping saves the media, copies the caption and note, and opens Instagram. Instagram won't let outside apps post Stories with stickers, so this is the only way to schedule them.
- **TikTok:** Boutiqly can only post TikToks directly, with no sound, so TikToks go out by hand from the phone (ready-to-post pack).
- **Facebook copy of a Reel:** goes out from Instagram with Share to Facebook. There's no app ping for Facebook.
- **Story frames:** a Story post can hold several images, but Katy chose one ping per frame, a minute apart, each with a "frame N of M" note. Boutiqly's read endpoints only return the first image of a post, so the app keeps its own record of every frame instead of reading counts back.
- **Text-only Threads posts** need an empty media list, or Boutiqly rejects them.
- **Time zone:** the sub-account's time zone (Make Space: Central) decides what "9 am" means. Store times in that zone; send UTC.
- **Planner extras** that exist but aren't part of v1: bulk CSV/XLSX upload (up to 90 posts), evergreen queues, recurring posts, RSS posts, its own approval flow, a statistics tab per channel.

## Media storage

- There's an upload endpoint for Boutiqly media storage, so the app pushes rendered files itself. (Katy drags packs in by hand today only because the connector Claude used lacked that endpoint.)
- Put Social Studio files in a "Social Studio" folder per sub-account.

## Wallet billing (usage-based pricing)

- **Meters:** in the developer portal, App → Pricing → Billing Meters, create a meter with module type Custom Event (API). Price type can be fixed or dynamic (min/max range plus a default price per unit).
- **Charging:** `POST /marketplace/billing/charges` with `appId`, `meterId`, `eventId` (our job id, for idempotency), `locationId` (sub-account to charge), `companyId` (the agency), `description`, `units`, optional `price` per unit (dynamic meters), optional `userId` and `eventTime`. Related endpoints: list charges, get one charge, delete a charge, and check whether an account has sufficient funds.
- **Who pays:** with usage reselling (rebilling) on, the sub-account's wallet is charged the base price plus the agency's markup; with it off, the agency wallet pays. For marketplace apps the agency markup is a flat amount per unit, set by the agency. Agencies can also set daily usage limits per app; billable use pauses at the cap until the next day.
- **Our plan:** one Studio credit = one cent of Claude cost at base price, and Boutiqly's markup doubles it (2x total). Wallets need funds; auto-recharge is set per sub-account.
- **Payouts:** developer earnings are paid monthly on the 15th, through Tipalti, for the previous month.
- **Confirm on day one:**
  - whether a private app can take paid usage charges and receive payouts;
  - the platform's cut: its help center (updated Jun 2026) says it takes no commission, while its marketplace page mentions 15%;
  - a developer reported (Jul 2026) that every usage charge from their private app failed with "Billing Usage Failed" on the platform's side. Test billing early with a test charge.
- Paid marketplace apps get a 30-day grace period with retries when a charge fails.

## Phone

- Boutiqly users are on the LeadConnector app. Nothing public confirms whether custom pages or marketplace app pages show in it. Test on day one in a sub-account. The fallback is a phone-friendly link with its own sign-in, which is extra work.

## Developer reference (vendor URLs)

- Developer portal and API docs: https://marketplace.gohighlevel.com/docs
- Custom Pages: https://marketplace.gohighlevel.com/docs/marketplace-modules/CustomPages
- OAuth 2.0 for marketplace apps: https://marketplace.gohighlevel.com/docs/Authorization/OAuth2.0
- Create Custom Menu Link: https://marketplace.gohighlevel.com/docs/ghl/custom-menus/create-custom-menu/
- Social Planner API: https://marketplace.gohighlevel.com/docs/ghl/social-planner/social-planner-api-v-3
- Media Storage API: https://marketplace.gohighlevel.com/docs/ghl/medias/media-storage-api
- Wallet charges: https://marketplace.gohighlevel.com/docs/ghl/marketplace/charge/ (and the other pages under "Wallet Charges")
- App billing management (rebilling config): https://marketplace.gohighlevel.com/docs/ghl/marketplace/app-billing-management/
- Marketplace CLI (`npm install -g @gohighlevel/marketplace-cli`): https://marketplace.gohighlevel.com/docs/sdk/marketplace-cli
- Help center, social planner setup and channel list: https://help.gohighlevel.com/support/solutions/articles/155000005063-getting-started-setup-social-planner
- Help center, usage-based pricing and rebilling: https://help.gohighlevel.com/support/solutions/articles/155000005111-usage-based-pricing-on-app-markeptlace
- Help center, app pricing and payouts: https://help.gohighlevel.com/support/solutions/articles/155000001217-set-up-your-marketplacapp-pricing
- Help center, app distribution and private install limits: https://help.gohighlevel.com/support/solutions/articles/155000002141-marketplace-app-distribution-type
- Also search the developer docs for: "User context for marketplace apps", "Upload File into Media Storage", "Schedule Instagram Stories via push notifications", and the official marketplace app template.
