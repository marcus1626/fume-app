# Fonts

Fume's typefaces are GT Canon (marketing titles) and GT Standard with GT Standard Mono (everything else), from
Grilli Type (DECIDED 5 Oct 2026, F-D043). They are on trial licences, which forbid font files on websites and in
published work, so they are not in this repository.

Until the licences are bought, these stand-ins are used everywhere (Marcus, 13 Oct 2026: "Erstatninger nå"):

| Fume face | Stand-in | Files |
|---|---|---|
| GT Canon | Newsreader 400, 400 italic, 500 | `Newsreader-*.woff2` |
| GT Standard | Geist 400, 500 | `Geist-*.woff2` |
| GT Standard Mono | Geist Mono 400, 500 | `GeistMono-*.woff2` |

Both are under the SIL Open Font License 1.1, free to use, embed and self-host.

- **Web pages:** the web kit (`kit/`, `fume_get_kit`) loads the same faces from Google Fonts, which works anywhere
  online, Claude's artifacts included.
- **Self-hosted or offline:** `fume-fonts.css` with these files beside it.
- **The brand book, the review board and the templates** embed these files when they build.

The token stacks (`tokens/fume-tokens.css`) name GT first, so a computer with GT installed shows GT. The day the
licences are bought, GT's web files come in here and the kit switches to them.
