/*
 * class POINT
*/
class Point {
  constructor(x, y, z) {
    if (this instanceof Point) {
      this.x = (typeof x === 'number') ? x : 0;
      this.y = (typeof y === 'number') ? y : 0;
      this.z = (typeof z === 'number') ? z : 0;
    } else {
      return new Point(x, y, z);
    }
  }


  /**
   * Translate a point from a given dx, dy, and dz
   */
  translate(dx, dy, dz) {

    dx = (typeof dx === 'number') ? dx : 0;
    dy = (typeof dy === 'number') ? dy : 0;
    dz = (typeof dz === 'number') ? dz : 0;

    return new Point(
      this.x + dx,
      this.y + dy,
      this.z + dz);
  }


  /**
   * Scale a point about a given origin
   */
  scale(origin, dx, dy, dz) {
    var p = this.translate(-origin.x, -origin.y, -origin.z);

    if (dy === undefined && dz === undefined) {
      /* If both dy and dz are left out, scale all coordinates equally */
      dy = dz = dx;
      /* If just dz is missing, set it equal to 1 */
    } else {
      dz = (typeof dz === 'number') ? dz : 1;
    }

    p.x *= dx;
    p.y *= dy;
    p.z *= dz;

    return p.translate(origin.x, origin.y, origin.z);
  }

  /**
   * Rotate about origin on the X axis
   */
  rotateX(origin, angle) {
    var p = this.translate(-origin.x, -origin.y, -origin.z);

    var z = p.z * Math.cos(angle) - p.y * Math.sin(angle);
    var y = p.z * Math.sin(angle) + p.y * Math.cos(angle);
    p.z = z;
    p.y = y;

    return p.translate(origin.x, origin.y, origin.z);
  }

  /**
   * Rotate about origin on the Y axis
   */
  rotateY(origin, angle) {
    var p = this.translate(-origin.x, -origin.y, -origin.z);

    var x = p.x * Math.cos(angle) - p.z * Math.sin(angle);
    var z = p.x * Math.sin(angle) + p.z * Math.cos(angle);
    p.x = x;
    p.z = z;

    return p.translate(origin.x, origin.y, origin.z);
  }

  /**
   * Rotate about origin on the Z axis
   */
  rotateZ(origin, angle) {
    var p = this.translate(-origin.x, -origin.y, -origin.z);

    var x = p.x * Math.cos(angle) - p.y * Math.sin(angle);
    var y = p.x * Math.sin(angle) + p.y * Math.cos(angle);
    p.x = x;
    p.y = y;

    return p.translate(origin.x, origin.y, origin.z);
  }


  /**
   * The depth of a point in the isometric plane
   */
  depth() {
    /* z is weighted slightly to accomodate |_ arrangements */
    return this.x + this.y - 2 * this.z;
  }


  /**
   * Distance between two points
   */
  static distance(p1, p2) {
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    var dz = p2.z - p1.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

}

Point.ORIGIN = new Point(0, 0, 0);


//module.exports = Point;

/*
 * class PATH
*/
//var Point = require('./point');

/**
 * Path utility class
 *
 * An Isomer.Path consists of a list of Isomer.Point's
 */
class Path {
  constructor(points) {
    if (Object.prototype.toString.call(points) === '[object Array]') {
      this.points = points;
    } else {
      this.points = Array.prototype.slice.call(arguments);
    }
  }	


  /**
   * Pushes a point onto the end of the path
   */
  push(point) {
    this.points.push(point);
  }


  /**
   * Returns a new path with the points in reverse order
   */
  reverse() {
    var points = Array.prototype.slice.call(this.points);

    return new Path(points.reverse());
  }


  /**
   * Translates a given path
   *
   * Simply a forward to Point#translate
   */
  translate() {
    var args = arguments;

    return new Path(this.points.map(function(point) {
      return point.translate.apply(point, args);
    }));
  }

  /**
   * Returns a new path rotated along the X axis by a given origin
   *
   * Simply a forward to Point#rotateX
   */
  rotateX() {
    var args = arguments;

    return new Path(this.points.map(function(point) {
      return point.rotateX.apply(point, args);
    }));
  }

  /**
   * Returns a new path rotated along the Y axis by a given origin
   *
   * Simply a forward to Point#rotateY
   */
  rotateY() {
    var args = arguments;

    return new Path(this.points.map(function(point) {
      return point.rotateY.apply(point, args);
    }));
  }

  /**
   * Returns a new path rotated along the Z axis by a given origin
   *
   * Simply a forward to Point#rotateZ
   */
  rotateZ() {
    var args = arguments;

    return new Path(this.points.map(function(point) {
      return point.rotateZ.apply(point, args);
    }));
  }


  /**
   * Scales a path about a given origin
   *
   * Simply a forward to Point#scale
   */
  scale() {
    var args = arguments;

    return new Path(this.points.map(function(point) {
      return point.scale.apply(point, args);
    }));
  }


  /**
   * The estimated depth of a path as defined by the average depth
   * of its points
   */
  depth() {
    var i, total = 0;
    for (i = 0; i < this.points.length; i++) {
      total += this.points[i].depth();
    }

    return total / (this.points.length || 1);
  }


  /**
   * Some paths to play with
   */

  /**
   * A rectangle with the bottom-left corner in the origin
   */
  static Rectangle(origin, width, height) {
    if (width === undefined) width = 1;
    if (height === undefined) height = 1;

    var path = new Path([
      origin,
      new Point(origin.x + width, origin.y, origin.z),
      new Point(origin.x + width, origin.y + height, origin.z),
      new Point(origin.x, origin.y + height, origin.z)
    ]);

    return path;
  }


  /**
   * A circle centered at origin with a given radius and number of vertices
   */
  static Circle(origin, radius, vertices) {
    vertices = vertices || 20;
    var i, path = new Path();

    for (i = 0; i < vertices; i++) {
      path.push(new Point(
        radius * Math.cos(i * 2 * Math.PI / vertices),
        radius * Math.sin(i * 2 * Math.PI / vertices),
        0));
    }

    return path.translate(origin.x, origin.y, origin.z);
  }


  /**
   * A star centered at origin with a given outer radius, inner
   * radius, and number of points
   *
   * Buggy - concave polygons are difficult to draw with our method
   */
  static Star(origin, outerRadius, innerRadius, points) {
    var i, r, path = new Path();

    for (i = 0; i < points * 2; i++) {
      r = (i % 2 === 0) ? outerRadius : innerRadius;

      path.push(new Point(
        r * Math.cos(i * Math.PI / points),
        r * Math.sin(i * Math.PI / points),
        0));
    }

    return path.translate(origin.x, origin.y, origin.z);
  }

}


/* Expose the Path constructor */
//module.exports = Path;

/*
 * class SHAPE
*/

//var Path = require('./path');
var Point = require('./point');

/**
 * Shape utility class
 *
 * An Isomer.Shape consists of a list of Isomer.Path's
 */
class Shape {
  constructor(paths) {
    if (Object.prototype.toString.call(paths) === '[object Array]') {
      this.paths = paths;
    } else {
      this.paths = Array.prototype.slice.call(arguments);
    }
  }

  /**
   * Pushes a path onto the end of the Shape
   */
  push(path) {
    this.paths.push(path);
  }


  /**
   * Translates a given shape
   *
   * Simply a forward to Path#translate
   */
  translate() {
    var args = arguments;

    return new Shape(this.paths.map(function(path) {
      return path.translate.apply(path, args);
    }));
  }

  /**
   * Rotates a given shape along the X axis around a given origin
   *
   * Simply a forward to Path#rotateX
   */
  rotateX() {
    var args = arguments;

    return new Shape(this.paths.map(function(path) {
      return path.rotateX.apply(path, args);
    }));
  }

  /**
   * Rotates a given shape along the Y axis around a given origin
   *
   * Simply a forward to Path#rotateY
   */
  rotateY() {
    var args = arguments;

    return new Shape(this.paths.map(function(path) {
      return path.rotateY.apply(path, args);
    }));
  }

  /**
   * Rotates a given shape along the Z axis around a given origin
   *
   * Simply a forward to Path#rotateZ
   */
  rotateZ() {
    var args = arguments;

    return new Shape(this.paths.map(function(path) {
      return path.rotateZ.apply(path, args);
    }));
  }

  /**
   * Scales a path about a given origin
   *
   * Simply a forward to Point#scale
   */
  scale() {
    var args = arguments;

    return new Shape(this.paths.map(function(path) {
      return path.scale.apply(path, args);
    }));
  }


  /**
   * Produces a list of the shape's paths ordered by distance to
   * prevent overlaps when drawing
   */
  orderedPaths() {
    var paths = this.paths.slice();

    /**
     * Sort the list of faces by distance then map the entries, returning
     * only the path and not the added "further point" from earlier.
     */
    return paths.sort(function(pathA, pathB) {
      return pathB.depth() - pathA.depth();
    });
  }


  /**
   * Utility function to create a 3D object by raising a 2D path
   * along the z-axis
   */
  static extrude(path, height) {
    height = (typeof height === 'number') ? height : 1;

    var i, topPath = path.translate(0, 0, height);
    var shape = new Shape();

    /* Push the top and bottom faces, top face must be oriented correctly */
    shape.push(path.reverse());
    shape.push(topPath);

    /* Push each side face */
    for (i = 0; i < path.points.length; i++) {
      shape.push(new Path([
        topPath.points[i],
        path.points[i],
        path.points[(i + 1) % path.points.length],
        topPath.points[(i + 1) % topPath.points.length]
      ]));
    }

    return shape;
  }


  /**
   * Some shapes to play with
   */

  /**
   * A prism located at origin with dimensions dx, dy, dz
   */
  static Prism(origin, dx, dy, dz) {
    dx = (typeof dx === 'number') ? dx : 1;
    dy = (typeof dy === 'number') ? dy : 1;
    dz = (typeof dz === 'number') ? dz : 1;

    /* The shape we will return */
    var prism = new Shape();

    /* Squares parallel to the x-axis */
    var face1 = new Path([
      origin,
      new Point(origin.x + dx, origin.y, origin.z),
      new Point(origin.x + dx, origin.y, origin.z + dz),
      new Point(origin.x, origin.y, origin.z + dz)
    ]);

    /* Push this face and its opposite */
    prism.push(face1);
    prism.push(face1.reverse().translate(0, dy, 0));

    /* Square parallel to the y-axis */
    var face2 = new Path([
      origin,
      new Point(origin.x, origin.y, origin.z + dz),
      new Point(origin.x, origin.y + dy, origin.z + dz),
      new Point(origin.x, origin.y + dy, origin.z)
    ]);
    prism.push(face2);
    prism.push(face2.reverse().translate(dx, 0, 0));

    /* Square parallel to the xy-plane */
    var face3 = new Path([
      origin,
      new Point(origin.x + dx, origin.y, origin.z),
      new Point(origin.x + dx, origin.y + dy, origin.z),
      new Point(origin.x, origin.y + dy, origin.z)
    ]);
    /* This surface is oriented backwards, so we need to reverse the points */
    prism.push(face3.reverse());
    prism.push(face3.translate(0, 0, dz));

    return prism;
  }


  static Pyramid(origin, dx, dy, dz) {
    dx = (typeof dx === 'number') ? dx : 1;
    dy = (typeof dy === 'number') ? dy : 1;
    dz = (typeof dz === 'number') ? dz : 1;

    var pyramid = new Shape();

    /* Path parallel to the x-axis */
    var face1 = new Path([
      origin,
      new Point(origin.x + dx, origin.y, origin.z),
      new Point(origin.x + dx / 2, origin.y + dy / 2, origin.z + dz)
    ]);
    /* Push the face, and its opposite face, by rotating around the Z-axis */
    pyramid.push(face1);
    pyramid.push(face1.rotateZ(origin.translate(dx / 2, dy / 2), Math.PI));

    /* Path parallel to the y-axis */
    var face2 = new Path([
      origin,
      new Point(origin.x + dx / 2, origin.y + dy / 2, origin.z + dz),
      new Point(origin.x, origin.y + dy, origin.z)
    ]);
    pyramid.push(face2);
    pyramid.push(face2.rotateZ(origin.translate(dx / 2, dy / 2), Math.PI));

    return pyramid;
  }


  static Cylinder(origin, radius, vertices, height) {
    radius = (typeof radius === 'number') ? radius : 1;

    var circle = Path.Circle(origin, radius, vertices);
    var cylinder = Shape.extrude(circle, height);

    return cylinder;
  }

}


//module.exports = Shape;

/**
 * TESTS - Draws a castle!
 */

var iso = new Isomer(document.getElementById("canvas"));
var Point = Isomer.Point;
var Path = Isomer.Path;
var Shape = Isomer.Shape;
var Color = Isomer.Color;

function TestSuite() {}

function Stairs(origin) {
  var STEP_COUNT = 10;

  /* Create a zig-zag */
  var zigzag = new Path(origin);
  var steps = [], i;

  /* Shape to return */
  var stairs = new Shape();

  for (i = 0; i < STEP_COUNT; i++) {
    /**
     *  2
     * __
     *   | 1
     */

    var stepCorner = origin.translate(0, i / STEP_COUNT, (i + 1) / STEP_COUNT);
    /* Draw two planes */
    steps.push(new Path([
      stepCorner,
      stepCorner.translate(0, 0, -1 / STEP_COUNT),
      stepCorner.translate(1, 0, -1 / STEP_COUNT),
      stepCorner.translate(1, 0, 0)
    ]));

    steps.push(new Path([
      stepCorner,
      stepCorner.translate(1, 0, 0),
      stepCorner.translate(1, 1 / STEP_COUNT, 0),
      stepCorner.translate(0, 1 / STEP_COUNT, 0)
    ]));

    zigzag.push(stepCorner);
    zigzag.push(stepCorner.translate(0, 1 / STEP_COUNT, 0));
  }

  zigzag.push(origin.translate(0, 1, 0));


  for (i = 0; i < steps.length; i++) {
    stairs.push(steps[i]);
  }
  stairs.push(zigzag);
  stairs.push(zigzag.reverse().translate(1, 0, 0));

  return stairs;
}

function Knot(origin) {
  var knot = new Shape();

  knot.paths = knot.paths.concat(Shape.Prism(Point.ORIGIN, 5, 1, 1).paths);
  knot.paths = knot.paths.concat(Shape.Prism(new Point(4, 1, 0), 1, 4, 1).paths);
  knot.paths = knot.paths.concat(Shape.Prism(new Point(4, 4, -2), 1, 1, 3).paths);

  knot.push(new Path([
    new Point(0, 0, 2),
    new Point(0, 0, 1),
    new Point(1, 0, 1),
    new Point(1, 0, 2)
  ]));

  knot.push(new Path([
    new Point(0, 0, 2),
    new Point(0, 1, 2),
    new Point(0, 1, 1),
    new Point(0, 0, 1)
  ]));

  return knot.scale(Point.ORIGIN, 1/5).translate(-0.1, 0.15, 0.4).translate(origin.x, origin.y, origin.z);
}

function randomColor() {
  return new Color(
    parseInt(Math.random() * 256),
    parseInt(Math.random() * 256),
    parseInt(Math.random() * 256));
}

TestSuite['draw structure'] = function () {
  iso.add(Shape.Prism(new Point(1, 0, 0), 4, 4, 2));
  iso.add(Shape.Prism(new Point(0, 0, 0), 1, 4, 1));
  iso.add(Shape.Prism(new Point(-1, 1, 0), 1, 3, 1));

  iso.add(Stairs(new Point(-1, 0, 0)));
  iso.add(Stairs(new Point(0, 3, 1)).rotateZ(new Point(0.5, 3.5, 1), -Math.PI / 2));

  iso.add(Shape.Prism(new Point(3, 0, 2), 2, 4, 1));
  iso.add(Shape.Prism(new Point(2, 1, 2), 1, 3, 1));

  iso.add(Stairs(new Point(2, 0, 2)).rotateZ(new Point(2.5, 0.5, 0), -Math.PI / 2));

  iso.add(Shape.Pyramid(new Point(2, 3, 3))
    .scale(new Point(2, 4, 3), 0.5),
    new Color(180, 180, 0));
  iso.add(Shape.Pyramid(new Point(4, 3, 3))
    .scale(new Point(5, 4, 3), 0.5),
    new Color(180, 0, 180));
  iso.add(Shape.Pyramid(new Point(4, 1, 3))
    .scale(new Point(5, 1, 3), 0.5),
    new Color(0, 180, 180));
  iso.add(Shape.Pyramid(new Point(2, 1, 3))
    .scale(new Point(2, 1, 3), 0.5),
    new Color(40, 180, 40));

  iso.add(Shape.Prism(new Point(3, 2, 3), 1, 1, 0.2), new Color(50, 50, 50));
  iso.add(Knot(new Point(3, 2, 3.2)), new Color(0, 180, 180));;
};

TestSuite['test scales'] = function () {
  var cube = Shape.Prism(new Point(5, 5), 1, 1, 1);

  for (var i = 0; i < 20; i++) {
    iso.add(cube
      .scale(new Point(5.5, 5.5), 10 - i/2, 10 - i/2, 1/3)
      .translate(0, 0, i/3)
      .rotateZ(new Point(5.5, 5.5), -Math.PI/20 * i),
           randomColor());
  }
};

TestSuite['test extrude'] = function () {
  var s = Shape.extrude(new Path([
    Point(1, 1, 1),
    Point(2, 1, 1),
    Point(2, 3, 1)
  ]), 0.3).scale(Point.ORIGIN, 5);

  iso.add(s, new Color(50, 160, 60));
};

TestSuite['test cylinder'] = function () {
  iso.add(Shape.Cylinder(new Point(8, 8, 0), 6));
  iso.add(Shape.Cylinder(new Point(11, 11, 1), 2.5, 20, 6), randomColor());
  iso.add(Shape.Cylinder(new Point(5, 9, 1), 0.75, 20, 12), randomColor());
  iso.add(Shape.Cylinder(new Point(4.5, 8, 1), 1.5, 20, 3), randomColor());
  iso.add(Shape.Cylinder(new Point(10, 6, 1), 2.5, 20, 5), randomColor());
  iso.add(Shape.Cylinder(new Point(6, 5, 1), 2, 20, 4), randomColor());
};

TestSuite['test star'] = function () {
  iso.add(Shape.extrude(Path.Star(Point.ORIGIN, 1, 2, 4).rotateZ(Point.ORIGIN, Math.PI/6)));
};

TestSuite['draw logo'] = function () {
  iso.add(Shape.Prism(new Point(1, 1), 1, 1, 2), new Color(0, 180, 180));
  iso.add(Shape.Prism(new Point(0, 1), 1, 1, 1.5), new Color(50, 60, 180));
  iso.add(Shape.Prism(new Point(1, 0), 1, 1, 1), new Color(50, 180, 60));
  iso.add(Shape.Prism(new Point(0, 0), 1, 1, 0.5), new Color(180, 50, 60));
};

TestSuite['red light'] = function () {
  iso.lightColor = new Color(160, 50, 60);
  iso.add(Shape.Prism(new Point(1, 1), 1, 1, 2), new Color(0, 180, 180));
  iso.add(Shape.Prism(new Point(0, 1), 1, 1, 1.5), new Color(50, 60, 180));
  iso.add(Shape.Prism(new Point(1, 0), 1, 1, 1), new Color(50, 180, 60));
  iso.add(Shape.Prism(new Point(0, 0), 1, 1, 0.5), new Color(180, 50, 60));
  iso.lightColor = new Color(255, 255, 255);
};

TestSuite['draw logo transparent'] = function () {
  var transparency = Math.random();

  iso.add(Shape.Prism(new Point(1, 1), 1, 1, 2), new Color(0, 180, 180, transparency));
  iso.add(Shape.Prism(new Point(0, 1), 1, 1, 1.5), new Color(50, 60, 180, transparency));
  iso.add(Shape.Prism(new Point(1, 0), 1, 1, 1), new Color(50, 180, 60, transparency));
  iso.add(Shape.Prism(new Point(0, 0), 1, 1, 0.5), new Color(180, 50, 60, transparency));
};

TestSuite['red light transparent'] = function () {
  var transparency = Math.random();

  iso.lightColor = new Color(160, 50, 60);
  iso.add(Shape.Prism(new Point(1, 1), 1, 1, 2), new Color(0, 180, 180, transparency));
  iso.add(Shape.Prism(new Point(0, 1), 1, 1, 1.5), new Color(50, 60, 180, transparency));
  iso.add(Shape.Prism(new Point(1, 0), 1, 1, 1), new Color(50, 180, 60, transparency));
  iso.add(Shape.Prism(new Point(0, 0), 1, 1, 0.5), new Color(180, 50, 60, transparency));
  iso.lightColor = new Color(255, 255, 255);
};

TestSuite['test rotation'] = function() {
  var cube = Shape.Prism(new Point(5, 5), 1, 1, 1);
  var angle = 0;

  return function() {
    // Plane, so we don't smear the background
    iso.add(Shape.Prism(new Point(4, 4, -0.1), 12, 12, 0.1), new Color(195, 195, 195));

    // Build X & Y inwards so they aren't occluded
    for (var i = 6; i > 0; i--) {
      iso.add(cube
        .translate(i + 1, 0, 0)
        .rotateX(new Point(5.5, 5.5, 0.5), -Math.PI/10 * (i+4) - angle),
          new Color(100 + i * 15, 0, 0, 0.5));
    }
    for (var i = 6; i > 0; i--) {
      iso.add(cube
        .translate(0, i + 1, 0)
        .rotateY(new Point(5.5, 5.5, 0.5), -Math.PI/5 * (i+4) - angle),
          new Color(0, 100 + i * 20, 0, 0.5));
    }
    for (var i = 0; i < 6; i++) {
      iso.add(cube
        .translate(0, 0, i + 1)
        .rotateZ(new Point(5.5, 5.5), -Math.PI/5 * i - angle),
          new Color(0, 0, 100 + i * 20, 0.5));
    }
    angle += 2 * Math.PI / 60;
  }
};

/**
 * Add testing buttons
 */
(function () {
  var fn;
  var panel = document.getElementById("control");
  var button;
  var animationTimer;

  for (fn in TestSuite) {
    button = document.createElement("div");
    button.classList.add("test-btn");
    button.innerHTML = fn;
    button.onclick = (function (fn) {
      return function () {
        /* Clear the canvas, animation callback and execute the test function */
        clearInterval(animationTimer);
        iso.canvas.clear();
        var f = fn();

        // If the test function returns a function, animate this
        if (Object.prototype.toString.call(f) == '[object Function]') {
          animationTimer = setInterval(f, 1000/30);
        }
      };
    })(TestSuite[fn]);

    panel.appendChild(button);
  }
})();

