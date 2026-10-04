# IdeaPrompt visual directions

Original keeps the existing workspace, typography, artwork, and layout. The floating Style dropdown selects four additional compositions. Selection is stored locally; changing style keeps the active idea, context, conversation, output tab, and project state mounted.

| Direction | Composition | Fonts | Palette | Motion |
| --- | --- | --- | --- | --- |
| Atelier | Horizontal project library; editorial cover with paper sculpture; right-hand mode index; writing desk and brief | Newsreader display + Manrope interface | Chalk `#f3f0e8`, forest `#26352d`, persimmon `#bd563c` | Paper fan sways slowly; cover rises on entry |
| Blueprint | Project library on the right; tools on the left; stacked central specification canvas | Space Grotesk display + Space Mono labels | Frost `#e7edf0`, navy `#19374b`, cobalt `#3159df` | Independent floating architectural blocks; tool hover translation |
| Terminal | Compact left project rail; command buttons; narrow input column and dominant output console | IBM Plex Sans interface + IBM Plex Mono display/output | Black `#0b0b0e`, soft red `#f0787e`, pearl `#e9e4e5` | Signal bars; finite heading decode; blinking caret |
| Poster | Horizontal project navigation; full-width red cover; giant arrow; mode strip; wide composer then brief | Barlow Condensed display + DM Mono interface | Paper `#f3f0e7`, ink `#191815`, signal red `#f05236` | Moving typography strip; rocking circular stamp; offset CTA hover |

Fonts are downloaded from Google Fonts and self-hosted as Latin WOFF2 assets in `public/fonts`, with `font-display: swap` and each family's OFL license included. The root layout links the local font stylesheet. All eight families are used explicitly; Newsreader includes true italic. Artwork is native CSS, so it stays crisp and needs no image requests, WebGL, or extra packages.

## Research

Components were reviewed online. The code uses original, lightweight adaptations of the visual concepts, rather than claiming to install or copy the libraries:

- [UI Layouts Blocks](https://www.ui-layouts.com/components/blocks): spatial blocks for Blueprint.
- [UI Layouts Clip-Path](https://www.ui-layouts.com/components/clip-path): composed/masked cover treatments.
- [UI Layouts Timeline Animation](https://www.ui-layouts.com/components/timeline-animation): ordered reveal reference for Atelier.
- [React Bits Decrypted Text](https://reactbits.dev/text-animations/decrypted-text): finite decode treatment for Terminal.
- [React Bits text animation catalog](https://reactbits.dev/c/text-animations): moving typography reference for Poster.
- [React Bits Magnet](https://reactbits.dev/animations/magnet): interaction reference; intentionally kept the final CTA as a simple transform hover.

Font research:

- [Manrope + Newsreader pairing](https://freebies.fluxes.com/blog/best-font-pairings-for-manrope/), [Manrope](https://fonts.google.com/specimen/Manrope), [Newsreader](https://fonts.google.com/specimen/Newsreader).
- [Space Grotesk pairing research](https://fontdash.com/pairings/Space%20Grotesk), [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [Space Mono](https://fonts.google.com/specimen/Space+Mono). The final same-family pairing is a design choice for the architectural direction.
- [IBM Plex design typography](https://www.ibm.com/design/event/files/IBM_iX_Brand_Guidelines_101218.pdf), [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans), [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono).
- [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed), [DM Mono](https://fonts.google.com/specimen/DM+Mono), [font pairing preview tool](https://www.typepeek.com/font-pairing-tool). The condensed/mono pairing was chosen for poster hierarchy and compact controls.

Palette collections reviewed: [green and orange](https://colorhunt.co/palettes/green-orange), [blue and grey](https://colorhunt.co/palettes/blue-grey), [green and black](https://colorhunt.co/palettes/green-black), [red and black and white](https://colorhunt.co/palettes/red-black-white). These are inspiration categories; the exact calibrated colors above are our own combinations, not attributed to a particular published palette.

## Accessibility and behavior

- All directions reflow on narrow screens; Blueprint and Terminal retain the mobile project drawer. Atelier and Poster have horizontal project navigation.
- Native details/summary style selector supports keyboard activation. Escape and outside clicks dismiss it; selecting a direction returns focus to its trigger.
- Reduced-motion disables decorative animation and the heading decode. The dropdown also offers a pause control for looping decorations.
- Storage failures do not prevent switching styles within the current session.

## Validation

- Production build, ESLint, TypeScript, and all nine existing tests pass.
- Browser checks at desktop and phone widths found no document-level horizontal overflow in any of the five directions.
- Typed input survived a full cycle through all five styles. Selected style survived reload. Escape dismissed the picker. The mobile project drawer and motion pause control were checked.
- Aikido scanning was not performed: automatic approval review rejected the tool call because it may transmit private source code to the external service without authorization.
