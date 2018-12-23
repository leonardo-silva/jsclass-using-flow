'use strict';

/**
 * 2D bezier-curve, https://en.wikipedia.org/wiki/B%C3%A9zier_curve
 * Usage:
 *   var b = new BezierCurve([{x: 0, y: 0}, {x: 10, y: 3}]);
 *   b.get(0.5); // {x: 5, y: 1.5}
 */

/**
 * Generates a bezier-curve from a series of points
 * @param Array array of control points ([{x: x0, y: y0}, {x: x1, y: y1}])
 */
class BezierCurve {
  constructor(points) {
    this.n = points.length;
    this.p = [];

    // The binomial coefficient
    var c = [1];
    var i;
    var j;
    for (i = 1; i < this.n; ++i) {
      c.push(0);
      for (j = i; j >= 1; --j) {
        c[j] += c[j - 1];
      }
    }

    // the i-th control point times the coefficient
    for (i = 0; i < this.n; ++i) {
      this.p.push({x: c[i] * points[i].x, y: c[i] * points[i].y});
    }
  };
  	
  /**
   * @param Number float variable from 0 to 1
   */
  get(t) {
    var res = {x: 0, y: 0};
    var i;
    var a = 1;
    var b = 1;

    // The coefficient
    var c = [];
    for (i = 0; i < this.n; ++i) {
      c.push(a);
      a *= t;
    }

    for (i = this.n - 1; i >= 0; --i) {
      res.x += this.p[i].x * c[i] * b;
      res.y += this.p[i].y * c[i] * b;
      b *= 1 - t;
    }
    return res;
  };

};

//module.exports = BezierCurve;

//'use strict';

//var root = require('../../../');
//var BezierCurve = root.Geometry.BezierCurve;
var assert = require('assert');

// Testing with http://pomax.github.io/bezierjs/

describe('Bézier-Curve Algorithm', function() {
  it('should get a linear Bézier-curve', function() {
    var b = new BezierCurve([{x: 0, y: 0}, {x: 10, y: 3}]);

    // Ends
    assert.deepEqual(b.get(0), {x: 0, y: 0});
    assert.deepEqual(b.get(1), {x: 10, y: 3});

    // Middle
    assert.deepEqual(b.get(0.5), {x: 5, y: 1.5});

    // 1/4 and 3/4
    assert.deepEqual(b.get(0.25), {x: 2.5, y: 0.75});
    assert.deepEqual(b.get(0.75), {x: 7.5, y: 2.25});
  });
  it('should get a quadratic Bézier-curve', function() {
    var b = new BezierCurve([{x: 150, y: 40},
                             {x: 80, y: 30},
                             {x: 105, y: 150}]);

    assert.deepEqual(b.get(0.5), {x: 103.75, y: 62.5});
    assert.deepEqual(b.get(0.25), {x: 120.9375, y: 43.125});
  });
  it('should get a cubic Bézier-curve', function() {
    var b = new BezierCurve([{x: 150, y: 40},
                             {x: 80, y: 30},
                             {x: 105, y: 150},
                             {x: 100, y: 100}]);

    assert.deepEqual(b.get(0.5), {x: 100.625, y: 85});
  });
});
