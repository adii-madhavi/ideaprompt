# IdeaPrompt Terminal design

The website uses one permanent Terminal design. The other themes and style selector have been removed. Previously saved theme preferences are ignored.

- Palette: black `#0b0b0e`, soft red `#f0787e`, pearl text `#e9e4e5`.
- Fonts: self-hosted IBM Plex Sans and IBM Plex Mono. Their WOFF2 files and OFL licenses remain in `public/fonts`; unused theme fonts were removed.
- Layout: compact project sidebar, command buttons, input column, and dominant output console; single-column layout on mobile.
- Motion: signal bars, a finite heading decode, and a blinking caret. Reduced-motion is respected; the header includes a Pause motion control.
- Project data, generation, conversation, settings, and output controls retain their existing behavior.

The heading decode is an original lightweight adaptation inspired by [React Bits Decrypted Text](https://reactbits.dev/text-animations/decrypted-text).

Earlier multi-theme versions remain recoverable from Git history.
