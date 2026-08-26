# Design

<!-- impeccable:design 1 -->

## World

**A printer's proof.** Not the finished book — the working sheet a press pulls before the
run, where the type is set on warm stock and an editor has gone over it in red.

The product's whole claim is that citations are assembled rather than written, and that
weak sources are named rather than hidden. A proof sheet is the artifact that already
behaves that way: it is a document plus the marks made against it. The citation marker in
the prose *is* an editor's annotation, and it is set as one.

Chosen by the owner over three alternatives. The pinned constraints were the name
**Sourcely** and a **warm paper ground**; the accent colours were explicitly released,
which is what let the palette move off the default warm-cream-plus-terracotta that this
kind of product usually lands on.

## Palette

Warm stock, dense warm black, and exactly one contrasting ink.

| Token | Value | Use |
| --- | --- | --- |
| `--color-paper` | `#f5f1e8` | The stock. Everything prints on it. |
| `--color-paper-sunk` | `#ebe5d6` | Panels, rails, citation blocks. |
| `--color-paper-raised` | `#fbf9f3` | The composer field. |
| `--color-ink` | `#16130d` | Type, primary buttons. Warm, never neutral black. |
| `--color-ink-prose` | `#241f16` | Set prose. |
| `--color-mark` | `#a32a18` | The correction mark. **The only accent in the system.** |

Strategy: **Restrained** — neutrals plus one accent, which is the Operate-mode floor.

**Ink acts, red annotates.** Primary buttons are solid ink; red is reserved for citation
markers, active state, and warnings. That split is why a red accent does not read as
danger everywhere.

**Status carries no second hue.** A strong source gets a filled ink mark, a questionable
one an outline, a missing field a struck rule. Green/amber/red would make a works-cited
list look like a monitoring dashboard, and it would collapse for anyone who cannot
separate red from green. This vocabulary survives greyscale and printing.

Rules are ink at low alpha, never gray — gray on warm stock reads as dirt.

## Type

| Role | Face | Why |
| --- | --- | --- |
| Display | Libre Caslon **Display** | Caslon is the English press face. The display cut is used only above ~28px. |
| Prose | Libre Caslon **Text** | The text cut, whose heavier hairlines survive 17px. |
| UI | Archivo | A workhorse grotesque for controls, labels and buttons. |
| Citations & metadata | JetBrains Mono | Mono means *assembled from extracted metadata* — the load-bearing signal. |

Two Caslon cuts, not one, is deliberate: a display Caslon's hairlines vanish at 17px and a
text Caslon looks timid at 44px. Using one for both is the compromise that makes most
editorial pages look almost right and never sharp.

Fixed rem scale, no `clamp()`. Product UI is read at consistent DPI, and a heading that
scales continuously lands on an arbitrary size at every width. The display step moves down
one fixed value at 40rem instead.

**Hierarchy is carried by size alone.** The question sits at 44px against 17px prose with
nothing between them — no rule, no box, no label stacked above it. That gap is the
signature move, borrowed from lineup-poster typography where billing is the only
structure.

Prose measure is 68ch, verified in the browser rather than assumed.

## Composition

- **Numerals live in a margin column.** Source entries and key points share one 2.1rem
  left column of numerals, so a single hard-left edge runs down the page and the eye has
  one place to look when matching a marker to its source.
- **Source entries are not cards.** They are entries in a ruled list. Cards are the lazy
  container, and a stack of identical bordered boxes is what this category always ships.
- **Sources open as a centred overlay** at two-thirds of the viewport. Pinned by the owner.

## Motion

**One authored moment: the answer arriving.** `answer-in` — 8px rise, 3px blur clearing,
420ms on an exponential ease-out. Everything else is state feedback, not choreography:
button press at 90ms, label swaps on copy, a 900ms wash when a marker strikes its entry.

No layout properties are animated anywhere. The sidebar collapse was originally a `width`
transition and was removed rather than reworked — it competed with the one authored moment
and reflowed on every frame.

`prefers-reduced-motion` collapses everything to 0.01ms.

## Browser surfaces

Themed from the palette, because the parts nobody draws still carry the design and leaving
them default is the clearest tell that a page was assembled rather than built: selection,
caret, scrollbars (both standards and WebKit), focus rings, underline offset, form
`accent-color`, and tabular numerals wherever figures sit in a column.

## Accessibility

WCAG AA, measured in the browser rather than eyeballed.

Every small-text tone was solved against **both** the paper and the sunk panel ground —
0.61 alpha is the floor that clears 4.5:1 on both, so the text hierarchy is built upward
from that number. Measured results: meta 5.67:1, meta-dim 4.84:1, placeholder 4.84:1,
body-secondary 7.04:1, prose 14.53:1, mark 6.42:1.

The source numeral is content, not ornament — it is how a marker is matched to its entry —
so it clears the 3:1 large-text floor at 3.4:1. Set in the rule tone it measured 2.2:1.
