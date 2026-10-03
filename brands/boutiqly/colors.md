# Boutiqly brand colors

Copied from the Boutiqly project (`claude/brand-colors.md`) on Oct 3, 2026: the palette and readability rules only. The same palette drives the tab's own look (see `CLAUDE.md`) and the default fallback look for brands without an approved board (palette and type only, no logo). Font: Proxima Nova; Montserrat is the free stand-in.

## Brand palette
| Name | Hex | Main use |
|---|---|---|
| Deep Forest | #1d3c34 | Headings, body text, dark sections, button hover |
| Green | #276f3d | Secondary buttons, text links, success states, green sections |
| Orange | #de771f | Primary buttons (CTA), icons, highlights, active underline |
| Sage | #99cc99 | Chips, charts, soft accents |
| Light Blue | #a1cfd6 | Hero gradient start, chips, charts |
| Pale Mint | #c4e5e2 | Section backgrounds, hero gradient end, text on Deep Forest |
| Pink | #e9c0d1 | Chips, accents, section tint |

## Supporting neutrals
- White #ffffff: cards and main background
- Cream #fbf8f3: warm page and section background
- Pink tint #f4e0e8: light section background (Pink mixed 50/50 with white)
- Muted text #5b6f69: secondary text
- Border #e8eeeb: card borders and dividers
- Video-only small accents: Peach #f6d9bd, Butter #f3d38b (not official palette)

## Readability (WCAG contrast)
- White on Orange: 3.1:1. Only OK for bold text 18px+ (buttons). Don't use Orange for small text on white or cream.
- White on Green 6.1:1, Deep Forest on white 12:1, Muted #5b6f69 on white 5.4:1: all good.
- Deep Forest on Light Blue 7.1:1, on Pink 7.4:1; Pale Mint on Deep Forest 9:1: all good.
