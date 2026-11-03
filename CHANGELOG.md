# Changelog

## 1.0.3

- Docs: a dedicated credit section for [ascii-sharks](https://github.com/stackedlol/ascii-sharks)
  (zh + en), install tarball URL points at v1.0.3.

## 1.0.2

- Docs: preview assets renamed (`docs/preview.png`, `docs/preview-motion.gif`) so CDN caches
  cannot serve the earlier, non-blank screenshots; install tarball URL points at v1.0.2.

## 1.0.1

- Docs only: README screenshots replaced with a blank session (no project content),
  added an animated preview, npm install listed first, dynamic npm badge.

## 1.0.0

First public release.

- Whole-page, transparent ASCII ocean behind the DeepSeek Harness UI: boid schools,
  hunting sharks, wake diffusion, pointer startle and click splashes.
- Theme-aware ink: dark glyphs on paper, light glyphs in the dark, swapped on
  `theme/change`.
- Frosted conversation column (`backdrop-filter`) with a four-sided Gaussian edge
  mask so the blur falls off instead of ending on a hard line.
- Torus ocean: sharks wrap across the frame with wrapped body rendering; fish wrap
  and fade over the last two cells.
- Rate-limited, low-pass filtered fish steering plus direction glyphs
  (`-`, `\`, `|`, `/`) so turns read as curves.
- Settings page (Settings → ASCII Sharks) with live, persisted parameters:
  visibility, water density, cell grid, content-glass blur, glyph size, shark
  species and count, school density, swim speed, pointer startle, click splash.
- Bilingual UI copy (zh / en), Plugin Manager metadata and icon.
