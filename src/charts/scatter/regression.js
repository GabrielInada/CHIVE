/**
 * Scatter-plot regression math.
 *
 * Pure utilities for OLS linear regression with 95% confidence-band
 * sampling. Hooks into the analytics section of `renderers/svg.js`.
 *
 * Log scales are honored by fitting the regression in `log(x)`/`log(y)`
 * space and exponentiating the sample line/band on output.
 */

/**
 * Critical t-values for a 95% two-tailed confidence interval, df 1 to 30.
 * Lookup falls back to `1.96` for df > 30 (large-sample approximation).
 */
export const T_CRIT_95 = {
	1: 12.706,
	2: 4.303,
	3: 3.182,
	4: 2.776,
	5: 2.571,
	6: 2.447,
	7: 2.365,
	8: 2.306,
	9: 2.262,
	10: 2.228,
	11: 2.201,
	12: 2.179,
	13: 2.16,
	14: 2.145,
	15: 2.131,
	16: 2.12,
	17: 2.11,
	18: 2.101,
	19: 2.093,
	20: 2.086,
	21: 2.08,
	22: 2.074,
	23: 2.069,
	24: 2.064,
	25: 2.06,
	26: 2.056,
	27: 2.052,
	28: 2.048,
	29: 2.045,
	30: 2.042,
};

/**
 * Critical t-value (95% two-tailed) for `df` degrees of freedom. Returns
 * `NaN` for `df < 1`; `1.96` for `df > 30`; otherwise the table entry.
 *
 * @param {number} df
 * @returns {number}
 */
export function tCrit95(df) {
	if (!Number.isFinite(df) || df < 1) return NaN;
	if (df > 30) return 1.96;
	return T_CRIT_95[df];
}

/**
 * Fit a least-squares regression `y = slope·x + intercept` over the given
 * `(x, y)` pairs. Returns the fit plus the moments needed for the
 * confidence-band math (`xMean`, `sxx`, residual standard error).
 *
 * Failure modes: fewer than 2 points → `'too-few-points'`; all x values
 * equal → `'zero-variance'`.
 *
 * @param {Array<{ x: number, y: number }>} pairs
 * @returns {{ ok: true, slope: number, intercept: number, r2: number, n: number, xMean: number, sxx: number, ssRes: number, seResidual: number } | { ok: false, reason: 'too-few-points' | 'zero-variance' }}
 */
export function fitLinearRegression(pairs) {
	const n = pairs.length;
	if (n < 2) return { ok: false, reason: 'too-few-points' };

	let sumX = 0;
	let sumY = 0;
	for (let i = 0; i < n; i++) {
		sumX += pairs[i].x;
		sumY += pairs[i].y;
	}
	const xMean = sumX / n;
	const yMean = sumY / n;

	let sxx = 0;
	let sxy = 0;
	let syy = 0;
	for (let i = 0; i < n; i++) {
		const dx = pairs[i].x - xMean;
		const dy = pairs[i].y - yMean;
		sxx += dx * dx;
		sxy += dx * dy;
		syy += dy * dy;
	}

	if (sxx === 0) return { ok: false, reason: 'zero-variance' };

	const slope = sxy / sxx;
	const intercept = yMean - slope * xMean;
	const ssRes = Math.max(0, syy - slope * sxy);
	const r2 = syy === 0 ? 1 : 1 - ssRes / syy;
	const seResidual = n >= 3 ? Math.sqrt(ssRes / (n - 2)) : NaN;

	return { ok: true, slope, intercept, r2, n, xMean, sxx, ssRes, seResidual };
}

/**
 * Apply the configured log transforms to a single point. Returns `null`
 * when either coordinate becomes non-finite (e.g. log of zero or
 * negative).
 *
 * @private
 * @param {{ x: number, y: number }} point
 * @param {boolean} xLog
 * @param {boolean} yLog
 * @returns {{ x: number, y: number } | null}
 */
function transformPoint(point, xLog, yLog) {
	const xFit = xLog ? Math.log(point.x) : point.x;
	const yFit = yLog ? Math.log(point.y) : point.y;
	if (!Number.isFinite(xFit) || !Number.isFinite(yFit)) return null;
	return { x: xFit, y: yFit };
}

/**
 * Compute one or more regression lines + 95% CI bands sampled across
 * `xDomain`. When `groupBy` is provided, fits a separate regression per
 * group; otherwise returns a single overall fit (keyed as `'__overall__'`).
 *
 * Sample line is always produced when the fit succeeds. Sample band is
 * `null` when `n < 3` or residual SE is non-finite/zero (CI undefined).
 *
 * @param {Object} args
 * @param {Array<Object<string, *>>} args.points - Each must have numeric `x`/`y`.
 * @param {'linear' | 'log'} [args.xScale]
 * @param {'linear' | 'log'} [args.yScale]
 * @param {[number, number]} args.xDomain - X-axis extent in raw (non-log) units.
 * @param {(point: Object) => string} [args.groupBy] - Returns a group key per point.
 * @param {number} [args.sampleCount=80] - Number of evenly-spaced sample points along the line.
 * @returns {Array<{ groupKey: string, fit: Object, sampleLine: Array<{x: number, y: number}> | null, sampleBand: Array<{x: number, yLow: number, yHigh: number}> | null }>}
 */
export function computeRegression({
	points,
	xScale,
	yScale,
	xDomain,
	groupBy,
	sampleCount = 80,
}) {
	const xLog = xScale === 'log';
	const yLog = yScale === 'log';

	if (!Array.isArray(xDomain) || xDomain.length !== 2) return [];
	const [xDomainLo, xDomainHi] = xDomain;
	const xFitLo = xLog ? Math.log(xDomainLo) : xDomainLo;
	const xFitHi = xLog ? Math.log(xDomainHi) : xDomainHi;
	if (!Number.isFinite(xFitLo) || !Number.isFinite(xFitHi) || xFitLo === xFitHi) return [];

	const groupOrder = [];
	const groups = new Map();
	for (let i = 0; i < points.length; i++) {
		const point = points[i];
		const pair = transformPoint(point, xLog, yLog);
		if (!pair) continue;
		const key = groupBy ? groupBy(point) : '__overall__';
		if (!groups.has(key)) {
			groups.set(key, []);
			groupOrder.push(key);
		}
		groups.get(key).push(pair);
	}

	const results = [];
	for (const groupKey of groupOrder) {
		const pairs = groups.get(groupKey);
		const fit = fitLinearRegression(pairs);
		if (!fit.ok) {
			results.push({ groupKey, fit, sampleLine: null, sampleBand: null });
			continue;
		}

		const hasBand = fit.n >= 3 && Number.isFinite(fit.seResidual) && fit.seResidual > 0;
		const tCritical = hasBand ? tCrit95(fit.n - 2) : NaN;
		const sampleLine = [];
		const sampleBand = hasBand ? [] : null;

		const steps = Math.max(2, sampleCount);
		for (let i = 0; i < steps; i++) {
			const ratio = i / (steps - 1);
			const xFit = xFitLo + (xFitHi - xFitLo) * ratio;
			const yFit = fit.slope * xFit + fit.intercept;
			const x = xLog ? Math.exp(xFit) : xFit;
			const y = yLog ? Math.exp(yFit) : yFit;
			sampleLine.push({ x, y });

			if (sampleBand) {
				const dxFromMean = xFit - fit.xMean;
				const halfWidth =
					tCritical *
					fit.seResidual *
					Math.sqrt(1 / fit.n + (dxFromMean * dxFromMean) / fit.sxx);
				const yLowFit = yFit - halfWidth;
				const yHighFit = yFit + halfWidth;
				const yLow = yLog ? Math.exp(yLowFit) : yLowFit;
				const yHigh = yLog ? Math.exp(yHighFit) : yHighFit;
				sampleBand.push({ x, yLow, yHigh });
			}
		}

		results.push({ groupKey, fit, sampleLine, sampleBand });
	}

	return results;
}

/**
 * Display-format a regression coefficient. Falls back to exponential
 * notation outside `[0.001, 10000)`.
 *
 * @private
 * @param {number} value
 * @returns {string}
 */
function formatCoefficient(value) {
	if (!Number.isFinite(value)) return 'NaN';
	const abs = Math.abs(value);
	if (abs === 0) return '0';
	if (abs >= 10000 || abs < 0.001) return value.toExponential(2);
	const precision = abs >= 1 ? 4 : 3;
	return Number(value.toPrecision(precision)).toString();
}

/**
 * Format a regression equation for display, e.g.
 * `'y = 0.42·x + 1.2'` or `'log(y) = 1.3·log(x) − 0.6'` when the
 * corresponding scales are logarithmic.
 *
 * @param {{ slope: number, intercept: number, xScale: 'linear' | 'log', yScale: 'linear' | 'log' }} args
 * @returns {string}
 */
export function formatRegressionEquation({ slope, intercept, xScale, yScale }) {
	const xLog = xScale === 'log';
	const yLog = yScale === 'log';
	const xTerm = xLog ? 'log(x)' : 'x';
	const yTerm = yLog ? 'log(y)' : 'y';
	const slopeStr = formatCoefficient(slope);
	const interceptSign = intercept >= 0 ? '+' : '−';
	const interceptStr = formatCoefficient(Math.abs(intercept));
	return `${yTerm} = ${slopeStr}·${xTerm} ${interceptSign} ${interceptStr}`;
}

/**
 * Format an R² value for display (3 decimals; `'NaN'` for non-finite).
 *
 * @param {number} r2
 * @returns {string}
 */
export function formatR2(r2) {
	if (!Number.isFinite(r2)) return 'NaN';
	return r2.toFixed(3);
}
