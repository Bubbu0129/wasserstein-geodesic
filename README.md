# Wasserstein Geodesic Visualizer

An interactive visualization of displacement interpolation between probability distributions on $\mathbb R$, using the quadratic Wasserstein distance $W_2$.

**[Launch the visualizer](https://Bubbu0129.github.io/wasserstein-geodesic/)**

## Web interface

1. Choose a source distribution $\mu$ and a target distribution $\nu$ from the available continuous [`scipy.stats`](https://docs.scipy.org/doc/scipy/reference/stats.html) families. Edit their shape parameters, `loc`, and `scale`. The distribution notes and the linked SciPy documentation explain the parameters.
2. Click **Compute geodesic**. Use the time slider or playback controls to inspect the interpolating densities. The page also reports an approximation of $W_2(\mu,\nu)$.
3. Set the animation duration and click **Export GIF** to download the animation. Export reuses the frames computed in the previous step.

The page runs Python and SciPy locally in the browser using [Pyodide](https://pyodide.org/). There is no remote computation service. An internet connection is needed to load Pyodide and its packages on the initial visit.

## Terminal usage

Clone the repository and install its Python dependencies:

```bash
git clone https://github.com/Bubbu0129/wasserstein-geodesic.git
cd wasserstein-geodesic
python -m pip install -r requirements.txt
```

Edit `MU` and `NU` at the beginning of `make_gif.py`. For instance:

```python
from scipy.stats import norm, beta

MU = norm(loc=-2, scale=1)
NU = beta(a=2, b=5, loc=-2, scale=4)
```

Run `python make_gif.py` to generate a GIF. The script also lets you change the filename, duration, and frame rate. The terminal program and website use the same Python computation in `wasserstein/geodesic.py`.

## Mathematical formulation

### Quantile functions and optimal transport in one dimension

Let $\mu,\nu\in\mathcal P_2(\mathbb R)$, the Borel probability measures with finite second moments. Write

$$
F_\mu(x)=\mu(({-\infty},x]),\qquad
Q_\mu(s)=F_\mu^{-1}(s):=\inf\{x:F_\mu(x)\ge s\},\quad 0<s<1,
$$

and similarly for $\nu$. These generalized inverses are nondecreasing and satisfy

$$
(Q_\mu)_\#\lambda=\mu,\qquad (Q_\nu)_\#\lambda=\nu,
$$

where $\lambda$ is Lebesgue measure restricted to $(0,1)$, a probability measure. Thus

$$
\pi=(Q_\mu,Q_\nu)_\#\lambda
$$

is a transport plan with marginals $\mu$ and $\nu$. It is the monotone coupling. For quadratic cost, matching ordered points is optimal: if $x_1\le x_2$ and $y_1\le y_2$, then

$$
\begin{aligned}
&(x_1-y_2)^2+(x_2-y_1)^2\\
&\qquad -(x_1-y_1)^2-(x_2-y_2)^2
=2(x_2-x_1)(y_2-y_1)\ge0.
\end{aligned}
$$

Consequently, uncrossing assignments cannot increase the transport cost. The rearrangement inequality (first for finite ordered samples, then by approximation) establishes the optimality of $\pi$. In particular,

$$
\boxed{W_2(\mu,\nu)^2
=\int_0^1\lvert Q_\mu(s)-Q_\nu(s)\rvert^2\,ds.}
$$

### Equivalence with Brenier displacement interpolation

In $\mathbb R^d$, if the source $\mu\in\mathcal P_2(\mathbb R^d)$ is absolutely continuous, Brenier's theorem gives an optimal map $T=\nabla u$, with $u$ convex, satisfying $T_\#\mu=\nu$. The quadratic Wasserstein geodesic is

$$
\mu_t=\bigl((1-t)\operatorname{id}+t\nabla u\bigr)_\#\mu,
\qquad 0\le t\le1.
$$

In one dimension, the optimal map is exactly the monotone rearrangement

$$
T(x)=Q_\nu(F_\mu(x))\qquad\text{for }\mu\text{-almost every }x.
$$

A nondecreasing map is the derivative of a convex function wherever that derivative exists, so this is the one-dimensional Brenier map. Since $\mu$ is absolutely continuous, $F_\mu(Q_\mu(s))=s$ for almost every $s\in(0,1)$; hence

$$
T(Q_\mu(s))=Q_\nu(s)\qquad\text{for almost every }s.
$$

Using $\mu=(Q_\mu)_\#\lambda$, we obtain

$$
\begin{aligned}
\bigl((1-t)\operatorname{id}+tT\bigr)_\#\mu
&=\bigl((1-t)Q_\mu+t(T\circ Q_\mu)\bigr)_\#\lambda\\
&=\bigl((1-t)Q_\mu+tQ_\nu\bigr)_\#\lambda.
\end{aligned}
$$

Therefore interpolating quantiles is precisely Brenier displacement interpolation in dimension one. Define

$$
Q_t(s)=(1-t)Q_\mu(s)+tQ_\nu(s),
\qquad \mu_t=(Q_t)_\#\lambda.
$$

As $Q_t$ is nondecreasing, it is the quantile function of $\mu_t$ up to almost-everywhere equality. Applying the one-dimensional distance formula gives, for any $s,t\in[0,1]$,

$$
\begin{aligned}
W_2(\mu_s,\mu_t)^2
&=\int_0^1|Q_s(r)-Q_t(r)|^2\,dr\\
&=|s-t|^2 W_2(\mu,\nu)^2.
\end{aligned}
$$

Thus $(\mu_t)_{0\le t\le1}$ is the $W_2$-geodesic between $\mu$ and $\nu$.

The quantile formula also works when the source has atoms. In that case an optimal transport *map* need not exist, but the monotone optimal *plan* $\pi$ always does, and

$$
\mu_t=\bigl((1-t)x+ty\bigr)_\#\pi
$$

still defines the geodesic. This is the general displacement interpolation formula expressed through an optimal coupling.

### Numerical implementation

SciPy provides $Q_\mu$ and $Q_\nu$ through each frozen distribution's `.ppf` method. The implementation evaluates them at $N$ equally weighted quantile levels

$$
s_i=\frac{i+\tfrac12}{N},\qquad i=0,\ldots,N-1,
$$

then moves matched particles along straight lines:

$$
x_i(t)=(1-t)\,\operatorname{ppf}_\mu(s_i)
+t\,\operatorname{ppf}_\nu(s_i).
$$

These particles represent the discrete approximation

$$
\mu_t^{(N)}=\frac1N\sum_{i=0}^{N-1}\delta_{x_i(t)}.
$$

The reported distance is approximated by

$$
W_2(\mu,\nu)^2\approx\frac1N\sum_{i=0}^{N-1}
\left|\operatorname{ppf}_\mu(s_i)-\operatorname{ppf}_\nu(s_i)\right|^2.
$$

The animation displays Gaussian-smoothed histograms of these particles. The computation uses 4,000 quantile particles by default; heavy tails or sharply concentrated densities may require finer resolution. Both input distributions must have finite second moments.
