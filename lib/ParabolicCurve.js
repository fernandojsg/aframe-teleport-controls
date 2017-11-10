/* global THREE */
// Parabolic motion equation, y = p0 + v0*t + 1/2at^2
function parabolicCurveScalar (p0, v0, a, t) {
  return p0 + v0 * t + 0.5 * a * t * t;
}

// Parabolic motion equation applied to 3 dimensions
function parabolicCurve (p0, v0, a, t, out) {
  out.x = parabolicCurveScalar(p0.x, v0.x, a.x, t);
  out.y = parabolicCurveScalar(p0.y, v0.y, a.y, t);
  out.z = parabolicCurveScalar(p0.z, v0.z, a.z, t);
  return out;
}

module.exports = parabolicCurve;
