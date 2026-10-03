# Prompts for Claude Code

## Session 1 (paste this into the first Claude Code session on this repo)

```
Hi Claude. This is session 1 of building Social Studio, a social media studio that lives as a tab inside every Boutiqly sub-account. I'm Katy, Boutiqly's cofounder. I'm not a developer, so explain things plainly and tell me exactly what to click when I need to do something.

Before anything else, read CLAUDE.md, then docs/scope.md, docs/platform-notes.md, docs/build-plan.md and docs/decisions.md. Skim reference/README.md and reference/studio-template/guide.md (the prototype's data model).

Then, in this order:
1. Tell me in a few plain sentences what you understand we're building, and anything in the docs that looks unclear, risky or contradictory.
2. Propose the tech stack and repo layout (CLAUDE.md has a starting suggestion). Explain the choice in plain words. Once I say OK, record it in docs/decisions.md.
3. Walk me through the accounts in docs/setup-accounts.md one at a time: the Boutiqly developer account and private app, Render, and the Claude API key. Tell me exactly where to click and what to choose. Secret keys go straight into Render, never into this chat.
4. Start Milestone 0, then Milestone 1: the tab loading inside Boutiqly for the test sub-account and showing who I am and my role.

Ground rules: always call the platform Boutiqly; ask me before anything that posts, charges, deletes or costs money; end the session by updating docs/progress.md.
```

## Any later session

```
Let's keep building Social Studio. Read CLAUDE.md and the latest entry in docs/progress.md, tell me where we are and what's next, then let's go.
```

## When something changes

```
Change of plan: [what changed]. Update docs/scope.md and docs/decisions.md, tell me what this affects in the build plan, then carry on.
```
