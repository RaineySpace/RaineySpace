# Design QA

## Evidence

- Source visual truth: `/var/folders/cb/pydfwcws19v_y48f_nskvl_m0000gn/T/codex-clipboard-4ece07ae-11d2-4ec7-9104-dec628d623fc.png`
- Implementation screenshots:
  - `/private/tmp/rainey-home-static-desktop.png`
  - `/private/tmp/rainey-home-mobile-viewport.png`
  - `/private/tmp/rainey-photography-mobile.png`
  - `/private/tmp/rainey-home-dark-mobile.png`
  - `/private/tmp/rainey-image-lightbox.png`
- Combined comparison: `/private/tmp/rainey-design-comparison.png`
- Source pixels: 1878 × 2000.
- Desktop implementation: 1280 × 1782 full-page capture at a 1280 × 900 CSS viewport and device scale factor 1.
- Mobile implementation: 375 × 812 viewport captures at device scale factor 1.
- State: homepage light desktop, homepage light/dark mobile, photography grid light mobile, shared image lightbox from gallery and article content.
- Density normalization: images were scaled proportionally into the combined comparison; the reference is used for grouping and whitespace, not pixel-identical visual styling.

## Comparison

### Full view

- Information architecture matches the intended reference rhythm: clearly separated sections, compact metadata, and a photographic strip while preserving the existing 632 px content column.
- The implementation intentionally retains RaineySpace's Trade Winds gradient logo, pink article links, gray metadata chips, and system body font instead of adopting the reference site's neutral visual identity.
- The desktop and 375 px layouts have no document-level horizontal overflow.

### Focused regions

- Homepage article region: exactly three existing full article cards; long Chinese titles wrap without collision at 375 px.
- Homepage photography region: six real raster placeholder assets form a horizontally scrollable, overlapping strip; focus and hover lift a photo without changing surrounding layout.
- Photography list: six images form a two-column mobile and three-column desktop grid with consistent cropping.
- Lightbox: opens as a modal dialog, uses overlaid icon navigation, loops with ArrowLeft/ArrowRight, provides a five-image thumbnail viewport with active-item centering and edge gradients, closes with Escape, unlocks body scrolling, and restores focus to the triggering gallery or article image.
- Article content: all non-linked images receive button semantics and keyboard activation without changing Markdown layout; linked images retain their original navigation behavior.
- Dark mode: existing background, text, tag, link, and new photography-border tokens remain coherent.

## Findings

- No actionable P0, P1, or P2 findings remain.
- P3: the placeholder photo captions and project names deliberately include `（占位）`; remove those markers when real content is supplied.

## Browser verification

- Primary interactions tested: photography and article modal open, previous/next buttons and keyboard loops, thumbnail selection and auto-scroll, Escape close, body unlock, focus restoration, linked-image exclusion, and single-image navigation hiding.
- Responsive states tested: 1280 × 900 desktop and 375 × 812 mobile.
- Themes tested: light and emulated dark color scheme.
- Browser console errors: none on the final static homepage.

## Comparison history

- Initial implementation passed the main visual comparison without P0/P1/P2 differences.
- A later unstyled screenshot was traced to running `next build` beside an existing development server, which invalidated the dev server's `.next` CSS paths. Final evidence was recaptured from the generated static `out/` artifact and shows the intended styled page with no console errors.
- Shared-lightbox iteration fixed three interaction issues found during browser verification: explicit Escape handling, article image attributes being replaced by React rerenders, and focus restoration after article image nodes were recreated. Post-fix evidence confirms all three behaviors.

final result: passed
