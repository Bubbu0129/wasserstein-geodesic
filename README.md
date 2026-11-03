# Wasserstein Geodesic Visualizer

An interactive visualization of displacement interpolation between probability distributions on \(\mathbb{R}\), using the quadratic Wasserstein distance \(W_2\).

**[Launch the visualizer](https://Bubbu0129.github.io/wasserstein-geodesic/)**

## Using the web interface

1. **Choose distributions.** Select source \(\mu\) and target \(\nu\) from the available `scipy.stats` continuous distributions. Enter their parameters, including `loc` and `scale`. Refer to the [SciPy documentation](https://docs.scipy.org/doc/scipy/reference/stats.html) for details.

2. **Compute the geodesic.** Click **Compute geodesic** to visualize the interpolating probability densities. Use the time slider or playback controls to explore the evolution from \(\mu\) to \(\nu\). The Wasserstein distance between the distributions is also displayed.

3. **Export the animation.** Adjust the playback duration and click **Export GIF** to save the animation.

All numerical computations run locally in your browser using SciPy through Pyodide. No installation is required. The initial page load requires an internet connection and may take some time while Python and SciPy are initialized.

## Using the terminal

The project also provides a standalone Python script for generating GIF animations.

Clone the repository and install the dependencies:

`git clone https://github.com/Bubbu0129/wasserstein-geodesic.git`

`cd wasserstein-geodesic-visualization`

`python -m pip install -r requirements.txt`

Open `make_gif.py` and configure the source and target distributions using SciPy's standard API:

- `MU`: source probability distribution
- `NU`: target probability distribution

You can also change the output filename, animation duration, and frame rate.

Run:

`python make_gif.py`

The resulting GIF is saved to the configured output path.

## Notes

The visualizer supports continuous SciPy distributions with finite second moments.

The geodesic is computed using one-dimensional optimal transport. Probability densities are approximated from transported quantile samples, with smoothing applied for visualization.

## References

- [SciPy statistical distributions](https://docs.scipy.org/doc/scipy/reference/stats.html)
- [Pyodide — Python in the browser](https://pyodide.org/)
