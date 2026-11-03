# Third-party notices

## ascii-sharks

`src/ocean/*` is a vendored, lightly adapted copy of the simulation and ASCII
renderer from **ascii-sharks** by stackedlol:

- Source: https://github.com/stackedlol/ascii-sharks
- License: MIT (see `LICENSE.ascii-sharks`)

Adaptations made here: translucent canvas and per-scheme ink palette, configurable
cell size, torus (wrap-around) world with wrapped body rendering, seam fading for
fish, turn-rate limited steering, and shallow/wide layout tuning.

Everything else in this package is MIT-licensed original work; see `LICENSE`.
