# Wasserstein geodesic visualization on ℝ

A GitHub Pages site and a standalone Python GIF generator sharing the same SciPy numerical implementation. In the browser, Pyodide runs the Python package locally, so no web server/backend is needed after the static files are served.

## Project layout

```text
wasserstein-geodesic-visualization/
├── index.html                # Browser page
├── app.js                    # HTML forms, playback, canvas renderer
├── gif_encoder.js            # Browser-only GIF89a encoder
├── styles.css
├── wasserstein/
│   ├── __init__.py
│   └── geodesic.py            # Shared SciPy computation and GIF export
├── make_gif.py               # Editable MU, NU, duration, output filename
├── requirements.txt
└── README.md
```

## Use from a terminal

From the project root:

```bash
python -m pip install -r requirements.txt
```

Edit **`MU` and `NU` near the top of `make_gif.py`**, for example:

```python
from scipy.stats import norm, beta

MU = norm(loc=-2, scale=1)
NU = beta(a=2, b=5, loc=-2, scale=4)
```

Then run:

```bash
python make_gif.py
```

This saves `wasserstein_geodesic.gif` (or the name configured in the script). To use the library from another script:

```python
from scipy.stats import norm, gamma
from wasserstein import wasserstein_geodesic_gif

wasserstein_geodesic_gif(norm(-1, 1), gamma(a=3), "output.gif", duration_seconds=5)
```

## Run the webpage locally

Serve the repository root using an HTTP server:

```bash
python -m http.server 8000
```

Visit <http://localhost:8000/>. Opening `index.html` directly as a `file://` URL will not work reliably.

Each distribution uses a searchable **native HTML `<input list="families">`** with a `<datalist>` of SciPy family names. Selecting or typing a name generates empty fields for its shape parameters, `loc`, and `scale`; all parameters must be filled in. The page starts without selected distributions or a computed animation. Clicking Compute before selecting both families does nothing. The family documentation opens SciPy's reference pages; expandable **Python help** displays the distribution's `__doc__` string directly from the installed SciPy runtime.

The first visit needs internet access to fetch Pyodide, NumPy, and SciPy. **Compute geodesic** calculates the interpolation frames once using the shared Python package. **Export GIF** encodes those precomputed frames entirely in JavaScript, with no additional Python computation, package downloads, or Matplotlib/Pillow. The browser export uses a fixed 800 × 440 canvas and a 256-color RGB332 palette. The length is controlled by the Duration field; the 101 computed frames are reused independently of the duration. The standalone Python GIF command still uses Matplotlib and Pillow.

## Deploy on GitHub Pages

1. Create a repository named **`wasserstein-geodesic-visualization`** and commit all of the above files, including the `wasserstein/` directory.
2. In GitHub **Settings → Pages**, select **Deploy from a branch**, `main`, `/(root)`.
3. Open `https://YOUR-USERNAME.github.io/wasserstein-geodesic-visualization/`.

The header's repository link detects `YOUR-USERNAME` from a `*.github.io` hostname and points to `https://github.com/YOUR-USERNAME/wasserstein-geodesic-visualization`. On localhost or a custom domain the link uses the placeholder `YOUR-USERNAME` by default; edit it in `configureGithubLink()` in `app.js` if necessary.

## Numerical notes

The shared Python implementation uses SciPy's inverse CDF (`.ppf`) to construct the one-dimensional quadratic-Wasserstein interpolation. It approximates densities using Gaussian-smoothed histograms of 4,000 matched particles; smoothing only affects visualization. The chart viewport shows the central 99% of each endpoint's tails, while the displayed distance uses the full particle grid.

The distribution must have finite first and second moments; the computation validates inputs and rejects invalid parameters. A numerical quantile grid may need additional particles for heavy-tailed distributions.

Pyodide is pinned to `314.0.7` in `index.html`.
