# SacTech Design System

This document records the visual, interaction, content, and implementation patterns for the SacTech website. It is the reference for the landing page, events experience, Code of Conduct, and future community pages.

## Design intent

SacTech should feel like Sacramento: warm, practical, civic-minded, and connected. The system uses the Tower Bridge as an architectural idea rather than a mascot or a literal photograph.

The bridge contributes:

- tall gold pillars for emphasis and wayfinding;
- X-bracing for dividers, grids, and small identity details;
- horizontal spans for connecting sections;
- river lines for movement and softer transitions.

The identity must remain distinct from Playful Programming. Do not reuse its pale-blue monochrome treatment, mist fade, birds, composition, assets, or illustration style. SacTech uses a warmer civic palette, heavier editorial typography, visible structure, and original CSS geometry.

## Principles

1. **Civic, not corporate.** Favor an approachable community-poster character over SaaS gradients, glass panels, or futuristic decoration.
2. **Local, not literal.** Abstract Sacramento landmarks into useful layout structure. Do not turn every surface into bridge artwork.
3. **Welcoming, not childish.** Use warm color, plain language, and generous spacing while keeping information credible and direct.
4. **Useful before decorative.** Calendars, filters, reporting information, and calls to action must remain obvious and accessible.
5. **Honest content.** Never present sample schedules, imported Playful content, or unverified contact routes as SacTech facts.

## Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `--color-navy` | `#062a53` | Primary ink, navigation, dark panels |
| `--color-navy-deep` | `#031f3f` | Footer and high-contrast surfaces |
| `--color-river` | `#05636a` | Secondary actions, icons, river motifs |
| `--color-river-deep` | `#00474e` | Hero backgrounds |
| `--color-bridge` | `#f2ab18` | Structural rules, towers, selected dates |
| `--color-bridge-deep` | `#9a5c00` | Gold text or borders on light surfaces |
| `--color-cream` | `#fff5e5` | Primary canvas |
| `--color-paper` | `#fffdf8` | Cards and reading surfaces |
| `--color-poppy` | `#e8562f` | Sparing emphasis and calls to action |
| `--color-poppy-deep` | `#b93619` | Accessible coral button background |
| `--color-ink-muted` | `#4d5c67` | Supporting copy |
| `--color-line` | `#dfc07a` | Quiet borders on light surfaces |

Rules:

- Navy or deep river with cream text is the default dark pairing.
- Navy on cream or paper is the default reading pairing.
- Gold is structural and selective; it is not body-copy color.
- Poppy is reserved for the most important action or a small moment of warmth.
- State must never be communicated by color alone.

## Typography

- Headlines use a heavy humanist sans stack: `Avenir Next`, `Trebuchet MS`, then the system sans stack.
- Body copy uses the system UI sans stack for speed and readability.
- Headlines are compact, with slightly negative letter spacing and line-height near `1`.
- Body text stays between 16–19px with line-height between `1.55–1.7`.
- Reading columns should not exceed roughly 70 characters.
- Eyebrows are short, bold, uppercase labels with measured letter spacing. They are not used for paragraphs.

## Layout and spacing

- Main content width: `72rem` / `1152px`.
- Page gutters: `clamp(1rem, 4vw, 3rem)`.
- Section spacing: `clamp(4rem, 8vw, 7rem)`.
- Use strong one- or two-column editorial grids. Avoid dense dashboard grids.
- Corners are restrained: 4px for controls, 8px for cards, 12px only for larger callouts.
- Borders and gold rules define hierarchy more often than shadows.
- Use shadow only to lift interactive or layered content.

## Responsive behavior

- `72rem+`: full desktop composition.
- Below `60rem`: three-month calendars become two months; supporting grids reduce columns.
- Below `48rem`: navigation wraps, two-column page layouts become one column, and event cards stack.
- Below `42.5rem`: calendars show one month and Code of Conduct navigation becomes a normal document section.
- Interactive targets remain at least 44×44px at every size.
- Decorative bridge art may crop or simplify, but must never introduce horizontal scrolling.

## Shared components

### Header

- Cream surface with a gold bottom rule.
- Wordmark is always visibly spelled **SAC TECH**; bridge geometry may accompany it but must not make the name ambiguous.
- Primary navigation: Community, Events, Code of Conduct.
- “Join the community” is the single persistent header action.
- The current route is shown with both weight and a gold underline, plus `aria-current="page"`.

### Bridge illustration

- Built from original CSS geometry, not copied artwork.
- Uses two towers, one horizontal truss, and three restrained river lines.
- Decorative instances are hidden from assistive technology.
- Never place the motif behind body copy.

### Buttons and links

- Primary: deep poppy or navy background with cream text.
- Secondary: transparent with a cream or navy border, depending on the surface.
- Text links use a visible underline on hover and preserve a strong focus ring.
- Controls use direct labels. Prefer “Explore events” over vague “Learn more.”

### Cards

- Paper surface, navy text, quiet border, and a bridge-gold top rule.
- Use a small X-brace corner or divider only when it improves grouping.
- Avoid whole-card click targets. Keep a real, visibly focused link.
- Avoid excessive pill badges; badges are reserved for short event modes and statuses.

### Filters

- Use a semantic `fieldset` and `legend` for related filters.
- Native radio inputs may be visually hidden only when the styled label retains a clear focus state.
- Selected state combines fill, text contrast, and checked semantics.
- Filters wrap instead of scrolling off-screen.

### Calendar

- Month arrows are high-contrast 44px+ buttons with explicit accessible names.
- The visible month range uses `aria-live="polite"`.
- Event days use an outline and a dot, not color alone.
- Calendar tables retain captions and real weekday headers.
- Desktop shows three months, tablet two, and mobile one.
- Selecting an event day reveals a nearby list with the title, time, and a specifically labeled details link.

### Code of Conduct

- Treat the policy as a readable document, not a legal modal.
- Desktop uses a section index beside a single readable policy column; mobile follows normal document order.
- A friendly summary is explicitly labeled non-exhaustive and links readers to the full policy.
- Reporting guidance is visually prominent but must not invent an email, form, response time, or confidentiality promise.

### Forms

- Labels remain visible.
- Error and success messages use polite live regions.
- Agreeing to the Code of Conduct links to the canonical policy page.
- If an external invite URL is not configured, say the invite is being refreshed instead of rendering a broken link.

## Page blueprints

### Landing page

1. Shared header.
2. Split hero: “Sacramento tech, built together.” plus bridge scene.
3. Mission and three values: inclusive, practical, civic-minded.
4. Honest upcoming-events preview.
5. Community invitation and Code of Conduct agreement.
6. Shared footer.

### Events page

1. Compact events hero with bridge motif.
2. Event-mode filters.
3. Calendar with working previous/next navigation.
4. Recurring and special event listings, or an honest schedule-update state.
5. Community call to action.

The copied Playful Programming schedule has been removed and must not be restored as SacTech programming. Add listings only from a verified SacTech event source.

### Code of Conduct page

1. Compact “Build community with care” hero.
2. At-a-glance summary that points to the binding full policy.
3. Section index and full policy.
4. Reporting guidance using the current verified route: SacTech organizers/moderators in the Slack Team Directory.
5. Transparent note that a public reporting path is still needed for people outside Slack.

The current policy governs the SacTech Slack workspace. Expanding it to in-person events, sponsors, social media, or other spaces is a governance decision, not a design or copy edit.

## Accessibility and interaction baseline

- One `<main id="main-content">` per page and a skip link in the shared layout.
- Logical heading levels and labelled page sections.
- Visible `:focus-visible` treatment on every interactive element.
- No suppressed outlines.
- Minimum 4.5:1 contrast for normal text.
- Minimum 44px touch targets for primary controls.
- Reduced-motion preferences disable smooth scrolling and nonessential transitions.
- Decorative art uses `aria-hidden="true"`.
- Status, filter counts, errors, and calendar changes are announced without stealing focus.

## Content voice

- Friendly, plainspoken, and specific.
- Prefer “people” and “community” over “users” or “network.”
- Avoid startup language such as “ecosystem,” “disruption,” and “thought leadership.”
- State uncertainty directly: “The schedule is being updated” is better than invented event details.
- Make belonging explicit without turning inclusion into marketing copy.

## Implementation conventions

- Global CSS contains resets, tokens, typography, shared focus behavior, and page-wide utilities only.
- Components and routes use CSS Modules.
- Prefer Server Components; add a client boundary only for real interaction such as navigation state, filters, calendars, and forms.
- Prefer CSS geometry and typography over decorative image assets.
- Keep event times formatted through the deterministic Sacramento timezone helpers.
- Verify every change with lint, TypeScript, a production build, keyboard navigation, and desktop/mobile layouts.
