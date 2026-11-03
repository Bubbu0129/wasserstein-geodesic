"""Shared numerical core for browser and terminal Wasserstein geodesics."""

import json

import numpy as np
from scipy import stats


N_PARTICLES = 4000
N_BINS = 240
N_FRAMES = 101
SMOOTHING = 2.0


def distribution_catalog_json():
    """List continuous scipy.stats families and their shape parameters."""
    catalog = {}
    for name in dir(stats):
        family = getattr(stats, name)
        if isinstance(family, stats.rv_continuous) and family.name == name:
            shapes = [] if family.shapes is None else [
                item.strip() for item in family.shapes.split(",")
            ]
            catalog[name] = shapes
    return json.dumps(catalog)


def distribution_help(name):
    """Return the selected SciPy distribution's Python docstring."""
    family = getattr(stats, name, None)
    if not isinstance(family, stats.rv_continuous) or family.name != name:
        raise ValueError(f"Unknown continuous scipy.stats distribution: {name!r}")
    return family.__doc__ or "No Python documentation available."


def make_distribution(spec):
    """Build a frozen scipy.stats distribution from JSON-safe input."""
    if isinstance(spec, str):
        spec = json.loads(spec)

    name = spec["name"]
    family = getattr(stats, name, None)
    if not isinstance(family, stats.rv_continuous) or family.name != name:
        raise ValueError(f"Unknown continuous scipy.stats distribution: {name!r}")

    values = spec["params"]
    shapes = [] if family.shapes is None else [
        item.strip() for item in family.shapes.split(",")
    ]
    shape_args = [float(values[item]) for item in shapes]
    loc = float(values.get("loc", 0))
    scale = float(values.get("scale", 1))
    if not np.isfinite(loc) or not np.isfinite(scale) or scale <= 0:
        raise ValueError("loc must be finite and scale must be positive and finite")
    if not np.all(np.isfinite(shape_args)):
        raise ValueError("Shape parameters must be finite")

    dist = family(*shape_args, loc=loc, scale=scale)
    # W2, as opposed to Wp for p<2, requires finite second moments.
    variance = float(dist.var())
    mean = float(dist.mean())
    if not np.isfinite(variance) or not np.isfinite(mean):
        raise ValueError(f"{name} does not have a finite second moment")
    return dist


def _quantile_function(measure):
    """Turn a frozen SciPy distribution, quantile function, or sample into q(s)."""
    if hasattr(measure, "ppf"):
        return lambda s: np.asarray(measure.ppf(s), dtype=float)
    if callable(measure):
        return lambda s: np.asarray(measure(s), dtype=float)
    samples = np.asarray(measure, dtype=float).ravel()
    if len(samples) == 0:
        raise ValueError("A sample measure cannot be empty")
    return lambda s: np.quantile(samples, s)


def _smooth_histogram(x, edges, smoothing=SMOOTHING):
    """Return a density estimate; Gaussian smoothing is display-only."""
    hist, _ = np.histogram(x, bins=edges, density=True)
    radius = max(1, int(np.ceil(4 * smoothing)))
    k = np.arange(-radius, radius + 1)
    kernel = np.exp(-0.5 * (k / smoothing) ** 2)
    kernel /= kernel.sum()
    return np.convolve(hist, kernel, mode="same")


def _geodesic_data(mu, nu, *, n_particles=N_PARTICLES,
                   n_bins=N_BINS, n_frames=N_FRAMES, smoothing=SMOOTHING):
    """Compute the displacement geodesic using matched quantile particles."""
    if n_particles < 100 or n_bins < 10 or n_frames < 2:
        raise ValueError("Not enough particles, bins, or frames")
    s = (np.arange(n_particles) + 0.5) / n_particles
    x0 = _quantile_function(mu)(s)
    x1 = _quantile_function(nu)(s)
    if not np.all(np.isfinite(x0)) or not np.all(np.isfinite(x1)):
        raise ValueError("The selected distribution returned non-finite quantiles")

    # The fixed viewport contains the central 99% of both marginals.
    # This avoids pathological zoom-out for heavy-tailed laws.
    i0 = int(0.005 * n_particles)
    i1 = min(n_particles - 1, int(0.995 * n_particles))
    xmin = min(x0[i0], x1[i0])
    xmax = max(x0[i1], x1[i1])
    width = max(xmax - xmin, 1e-6)
    edges = np.linspace(xmin - 0.07 * width, xmax + 0.07 * width,
                        n_bins + 1)
    centers = (edges[:-1] + edges[1:]) / 2

    times = np.linspace(0, 1, n_frames)
    frames = []
    for t in times:
        xt = (1 - t) * x0 + t * x1
        frames.append(_smooth_histogram(xt, edges, smoothing))
    frames = np.asarray(frames)

    return {
        "x": centers,
        "times": times,
        "frames": frames,
        "w2": float(np.sqrt(np.mean((x1 - x0) ** 2))),
        "ymax": float(frames.max() * 1.12),
        "x0": x0,
        "x1": x1,
    }


def compute_geodesic_json(source_spec, target_spec):
    """JSON interface used by the browser; the numerical work runs in Python."""
    data = _geodesic_data(
        make_distribution(source_spec), make_distribution(target_spec)
    )
    return json.dumps({
        "x": data["x"].tolist(),
        "times": data["times"].tolist(),
        "frames": data["frames"].tolist(),
        "w2": data["w2"],
        "ymax": data["ymax"],
    })


def wasserstein_geodesic_gif(
    mu,
    nu,
    filename="wasserstein_geodesic.gif",
    duration_seconds=5,
    fps=20,
    n_particles=N_PARTICLES,
    n_bins=N_BINS,
    smoothing=SMOOTHING,
):
    """Create the same geodesic GIF as the original standalone script."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.animation import FuncAnimation, PillowWriter

    n_frames = max(2, int(round(duration_seconds * fps)))
    data = _geodesic_data(mu, nu, n_particles=n_particles,
                          n_bins=n_bins, n_frames=n_frames,
                          smoothing=smoothing)
    x = data["x"]
    frames = data["frames"]
    times = data["times"]

    fig, ax = plt.subplots(figsize=(8, 4.5))
    fig.patch.set_facecolor("white")
    ax.plot(x, frames[0], "--", alpha=0.45, label=r"$\mu$")
    ax.plot(x, frames[-1], "--", alpha=0.45, label=r"$\nu$")
    line, = ax.plot([], [], linewidth=2.5, label=r"$\mu_t$")
    ax.set_xlim(x[0], x[-1])
    ax.set_ylim(0, data["ymax"])
    ax.set_xlabel(r"$x$")
    ax.set_ylabel("density")
    ax.legend()
    title = ax.set_title("")

    def update(frame):
        line.set_data(x, frames[frame])
        title.set_text(rf"$W_2$ displacement geodesic, $t={times[frame]:.3f}$")
        return line, title

    animation = FuncAnimation(fig, update, frames=n_frames,
                              interval=1000 / fps, blit=False)
    animation.save(filename, writer=PillowWriter(fps=fps))
    plt.close(fig)
    return filename


def render_gif_json(source_spec, target_spec, filename="geodesic.gif",
                    duration_seconds=5):
    return wasserstein_geodesic_gif(
        make_distribution(source_spec), make_distribution(target_spec),
        filename=filename, duration_seconds=duration_seconds,
    )
