#!/usr/bin/env python3
"""Edit MU and NU, then run `python make_gif.py` to generate a GIF."""

from scipy.stats import norm, gamma, beta, uniform
from wasserstein import wasserstein_geodesic_gif

# ============================================================
# USER CONFIGURATION
# ============================================================

MU = norm(loc=-2.0, scale=0.7)
NU = norm(loc=2.0, scale=0.9)

FILENAME = "wasserstein_geodesic.gif"
DURATION = 5  # seconds
FPS = 20

# ============================================================

if __name__ == "__main__":
    wasserstein_geodesic_gif(
        MU,
        NU,
        filename=FILENAME,
        duration_seconds=DURATION,
        fps=FPS,
    )
