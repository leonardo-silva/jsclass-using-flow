//import Point from './Point';

/**
 * The Point object represents a location in a two-dimensional coordinate system, where x represents
 * the horizontal axis and y represents the vertical axis.
 *
 * @class
 * @memberof PIXI
 */
class Point
{
    /**
     * @param {number} [x=0] - position of the point on the x axis
     * @param {number} [y=0] - position of the point on the y axis
     */
    constructor(x = 0, y = 0)
    {
        /**
         * @member {number}
         * @default 0
         */
        this.x = x;

        /**
         * @member {number}
         * @default 0
         */
        this.y = y;
    }

    /**
     * Creates a clone of this point
     *
     * @return {PIXI.Point} a copy of the point
     */
    clone()
    {
        return new Point(this.x, this.y);
    }

    /**
     * Copies x and y from the given point
     *
     * @param {PIXI.Point} p - The point to copy.
     */
    copy(p)
    {
        this.set(p.x, p.y);
    }

    /**
     * Returns true if the given point is equal to this point
     *
     * @param {PIXI.Point} p - The point to check
     * @returns {boolean} Whether the given point equal to this point
     */
    equals(p)
    {
        return (p.x === this.x) && (p.y === this.y);
    }

    /**
     * Sets the point to a new x and y position.
     * If y is omitted, both x and y will be set to x.
     *
     * @param {number} [x=0] - position of the point on the x axis
     * @param {number} [y=0] - position of the point on the y axis
     */
    set(x, y)
    {
        this.x = x || 0;
        this.y = y || ((y !== 0) ? this.x : 0);
    }

}

/**
 * The pixi Matrix class as an object, which makes it a lot faster,
 * here is a representation of it :
 * | a | b | tx|
 * | c | d | ty|
 * | 0 | 0 | 1 |
 *
 * @class
 * @memberof PIXI
 */
export default class Matrix
{
    /**
     *
     */
    constructor()
    {
        /**
         * @member {number}
         * @default 1
         */
        this.a = 1;

        /**
         * @member {number}
         * @default 0
         */
        this.b = 0;

        /**
         * @member {number}
         * @default 0
         */
        this.c = 0;

        /**
         * @member {number}
         * @default 1
         */
        this.d = 1;

        /**
         * @member {number}
         * @default 0
         */
        this.tx = 0;

        /**
         * @member {number}
         * @default 0
         */
        this.ty = 0;

        this.array = null;
    }

    /**
     * Creates a Matrix object based on the given array. The Element to Matrix mapping order is as follows:
     *
     * a = array[0]
     * b = array[1]
     * c = array[3]
     * d = array[4]
     * tx = array[2]
     * ty = array[5]
     *
     * @param {number[]} array - The array that the matrix will be populated from.
     */
    fromArray(array)
    {
        this.a = array[0];
        this.b = array[1];
        this.c = array[3];
        this.d = array[4];
        this.tx = array[2];
        this.ty = array[5];
    }

    /**
     * sets the matrix properties
     *
     * @param {number} a - Matrix component
     * @param {number} b - Matrix component
     * @param {number} c - Matrix component
     * @param {number} d - Matrix component
     * @param {number} tx - Matrix component
     * @param {number} ty - Matrix component
     *
     * @return {PIXI.Matrix} This matrix. Good for chaining method calls.
     */
    set(a, b, c, d, tx, ty)
    {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.tx = tx;
        this.ty = ty;

        return this;
    }

    /**
     * Creates an array from the current Matrix object.
     *
     * @param {boolean} transpose - Whether we need to transpose the matrix or not
     * @param {Float32Array} [out=new Float32Array(9)] - If provided the array will be assigned to out
     * @return {number[]} the newly created array which contains the matrix
     */
    toArray(transpose, out)
    {
        if (!this.array)
        {
            this.array = new Float32Array(9);
        }

        const array = out || this.array;

        if (transpose)
        {
            array[0] = this.a;
            array[1] = this.b;
            array[2] = 0;
            array[3] = this.c;
            array[4] = this.d;
            array[5] = 0;
            array[6] = this.tx;
            array[7] = this.ty;
            array[8] = 1;
        }
        else
        {
            array[0] = this.a;
            array[1] = this.c;
            array[2] = this.tx;
            array[3] = this.b;
            array[4] = this.d;
            array[5] = this.ty;
            array[6] = 0;
            array[7] = 0;
            array[8] = 1;
        }

        return array;
    }

    /**
     * Get a new position with the current transformation applied.
     * Can be used to go from a child's coordinate space to the world coordinate space. (e.g. rendering)
     *
     * @param {PIXI.Point} pos - The origin
     * @param {PIXI.Point} [newPos] - The point that the new position is assigned to (allowed to be same as input)
     * @return {PIXI.Point} The new point, transformed through this matrix
     */
    apply(pos, newPos)
    {
        newPos = newPos || new Point();

        const x = pos.x;
        const y = pos.y;

        newPos.x = (this.a * x) + (this.c * y) + this.tx;
        newPos.y = (this.b * x) + (this.d * y) + this.ty;

        return newPos;
    }

    /**
     * Get a new position with the inverse of the current transformation applied.
     * Can be used to go from the world coordinate space to a child's coordinate space. (e.g. input)
     *
     * @param {PIXI.Point} pos - The origin
     * @param {PIXI.Point} [newPos] - The point that the new position is assigned to (allowed to be same as input)
     * @return {PIXI.Point} The new point, inverse-transformed through this matrix
     */
    applyInverse(pos, newPos)
    {
        newPos = newPos || new Point();

        const id = 1 / ((this.a * this.d) + (this.c * -this.b));

        const x = pos.x;
        const y = pos.y;

        newPos.x = (this.d * id * x) + (-this.c * id * y) + (((this.ty * this.c) - (this.tx * this.d)) * id);
        newPos.y = (this.a * id * y) + (-this.b * id * x) + (((-this.ty * this.a) + (this.tx * this.b)) * id);

        return newPos;
    }

    /**
     * Translates the matrix on the x and y.
     *
     * @param {number} x How much to translate x by
     * @param {number} y How much to translate y by
     * @return {PIXI.Matrix} This matrix. Good for chaining method calls.
     */
    translate(x, y)
    {
        this.tx += x;
        this.ty += y;

        return this;
    }

    /**
     * Applies a scale transformation to the matrix.
     *
     * @param {number} x The amount to scale horizontally
     * @param {number} y The amount to scale vertically
     * @return {PIXI.Matrix} This matrix. Good for chaining method calls.
     */
    scale(x, y)
    {
        this.a *= x;
        this.d *= y;
        this.c *= x;
        this.b *= y;
        this.tx *= x;
        this.ty *= y;

        return this;
    }

    /**
     * Applies a rotation transformation to the matrix.
     *
     * @param {number} angle - The angle in radians.
     * @return {PIXI.Matrix} This matrix. Good for chaining method calls.
     */
    rotate(angle)
    {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const a1 = this.a;
        const c1 = this.c;
        const tx1 = this.tx;

        this.a = (a1 * cos) - (this.b * sin);
        this.b = (a1 * sin) + (this.b * cos);
        this.c = (c1 * cos) - (this.d * sin);
        this.d = (c1 * sin) + (this.d * cos);
        this.tx = (tx1 * cos) - (this.ty * sin);
        this.ty = (tx1 * sin) + (this.ty * cos);

        return this;
    }

    /**
     * Appends the given Matrix to this Matrix.
     *
     * @param {PIXI.Matrix} matrix - The matrix to append.
     * @return {PIXI.Matrix} This matrix. Good for chaining method calls.
     */
    append(matrix)
    {
        const a1 = this.a;
        const b1 = this.b;
        const c1 = this.c;
        const d1 = this.d;

        this.a = (matrix.a * a1) + (matrix.b * c1);
        this.b = (matrix.a * b1) + (matrix.b * d1);
        this.c = (matrix.c * a1) + (matrix.d * c1);
        this.d = (matrix.c * b1) + (matrix.d * d1);

        this.tx = (matrix.tx * a1) + (matrix.ty * c1) + this.tx;
        this.ty = (matrix.tx * b1) + (matrix.ty * d1) + this.ty;

        return this;
    }

    /**
     * Sets the matrix based on all the available properties
     *
     * @param {number} x - Position on the x axis
     * @param {number} y - Position on the y axis
     * @param {number} pivotX - Pivot on the x axis
     * @param {number} pivotY - Pivot on the y axis
     * @param {number} scaleX - Scale on the x axis
     * @param {number} scaleY - Scale on the y axis
     * @param {number} rotation - Rotation in radians
     * @param {number} skewX - Skew on the x axis
     * @param {number} skewY - Skew on the y axis
     * @return {PIXI.Matrix} This matrix. Good for chaining method calls.
     */
    setTransform(x, y, pivotX, pivotY, scaleX, scaleY, rotation, skewX, skewY)
    {
        const sr = Math.sin(rotation);
        const cr = Math.cos(rotation);
        const cy = Math.cos(skewY);
        const sy = Math.sin(skewY);
        const nsx = -Math.sin(skewX);
        const cx = Math.cos(skewX);

        const a = cr * scaleX;
        const b = sr * scaleX;
        const c = -sr * scaleY;
        const d = cr * scaleY;

        this.a = (cy * a) + (sy * c);
        this.b = (cy * b) + (sy * d);
        this.c = (nsx * a) + (cx * c);
        this.d = (nsx * b) + (cx * d);

        this.tx = x + ((pivotX * a) + (pivotY * c));
        this.ty = y + ((pivotX * b) + (pivotY * d));

        return this;
    }

    /**
     * Prepends the given Matrix to this Matrix.
     *
     * @param {PIXI.Matrix} matrix - The matrix to prepend
     * @return {PIXI.Matrix} This matrix. Good for chaining method calls.
     */
    prepend(matrix)
    {
        const tx1 = this.tx;

        if (matrix.a !== 1 || matrix.b !== 0 || matrix.c !== 0 || matrix.d !== 1)
        {
            const a1 = this.a;
            const c1 = this.c;

            this.a = (a1 * matrix.a) + (this.b * matrix.c);
            this.b = (a1 * matrix.b) + (this.b * matrix.d);
            this.c = (c1 * matrix.a) + (this.d * matrix.c);
            this.d = (c1 * matrix.b) + (this.d * matrix.d);
        }

        this.tx = (tx1 * matrix.a) + (this.ty * matrix.c) + matrix.tx;
        this.ty = (tx1 * matrix.b) + (this.ty * matrix.d) + matrix.ty;

        return this;
    }

    /**
     * Decomposes the matrix (x, y, scaleX, scaleY, and rotation) and sets the properties on to a transform.
     *
     * @param {PIXI.Transform|PIXI.TransformStatic} transform - The transform to apply the properties to.
     * @return {PIXI.Transform|PIXI.TransformStatic} The transform with the newly applied properies
     */
    decompose(transform)
    {
        // sort out rotation / skew..
        const a = this.a;
        const b = this.b;
        const c = this.c;
        const d = this.d;

        const skewX = Math.atan2(-c, d);
        const skewY = Math.atan2(b, a);

        const delta = Math.abs(1 - (skewX / skewY));

        if (delta < 0.00001)
        {
            transform.rotation = skewY;

            if (a < 0 && d >= 0)
            {
                transform.rotation += (transform.rotation <= 0) ? Math.PI : -Math.PI;
            }

            transform.skew.x = transform.skew.y = 0;
        }
        else
        {
            transform.skew.x = skewX;
            transform.skew.y = skewY;
        }

        // next set scale
        transform.scale.x = Math.sqrt((a * a) + (b * b));
        transform.scale.y = Math.sqrt((c * c) + (d * d));

        // next set position
        transform.position.x = this.tx;
        transform.position.y = this.ty;

        return transform;
    }

    /**
     * Inverts this matrix
     *
     * @return {PIXI.Matrix} This matrix. Good for chaining method calls.
     */
    invert()
    {
        const a1 = this.a;
        const b1 = this.b;
        const c1 = this.c;
        const d1 = this.d;
        const tx1 = this.tx;
        const n = (a1 * d1) - (b1 * c1);

        this.a = d1 / n;
        this.b = -b1 / n;
        this.c = -c1 / n;
        this.d = a1 / n;
        this.tx = ((c1 * this.ty) - (d1 * tx1)) / n;
        this.ty = -((a1 * this.ty) - (b1 * tx1)) / n;

        return this;
    }

    /**
     * Resets this Matix to an identity (default) matrix.
     *
     * @return {PIXI.Matrix} This matrix. Good for chaining method calls.
     */
    identity()
    {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.tx = 0;
        this.ty = 0;

        return this;
    }

    /**
     * Creates a new Matrix object with the same values as this one.
     *
     * @return {PIXI.Matrix} A copy of this matrix. Good for chaining method calls.
     */
    clone()
    {
        const matrix = new Matrix();

        matrix.a = this.a;
        matrix.b = this.b;
        matrix.c = this.c;
        matrix.d = this.d;
        matrix.tx = this.tx;
        matrix.ty = this.ty;

        return matrix;
    }

    /**
     * Changes the values of the given matrix to be the same as the ones in this matrix
     *
     * @param {PIXI.Matrix} matrix - The matrix to copy from.
     * @return {PIXI.Matrix} The matrix given in parameter with its values updated.
     */
    copy(matrix)
    {
        matrix.a = this.a;
        matrix.b = this.b;
        matrix.c = this.c;
        matrix.d = this.d;
        matrix.tx = this.tx;
        matrix.ty = this.ty;

        return matrix;
    }

    /**
     * A default (identity) matrix
     *
     * @static
     * @const
     */
    static get IDENTITY()
    {
        return new Matrix();
    }

    /**
     * A temp matrix
     *
     * @static
     * @const
     */
    static get TEMP_MATRIX()
    {
        return new Matrix();
    }
}

/*
* TESTS for all classes in PIXI
*/

/*
* InteractionData.js
*/
//'use strict';

describe('interaction.InteractionData', function ()
{
    describe('getLocalPosition', function ()
    {
        it('should populate second parameter with result', function ()
        {
            var data = new InteractionData();
            var stage = new DisplayObject();
            var displayObject = new DisplayObject();
            var point = new Point();

            data.global.set(10, 10);
            displayObject.position.set(5, 3);
            displayObject.parent = stage;
            displayObject.displayObjectUpdateTransform();
            data.getLocalPosition(displayObject, point);
            expect(point.x).to.equal(5);
            expect(point.y).to.equal(7);
        });
    });
});

/*
* util.js
*/
//'use strict';

describe('utils', function ()
{
    describe('uid', function ()
    {
        it('should exist', function ()
        {
            expect(utils.uid)
                .to.be.a('function');
        });

        it('should return a number', function ()
        {
            expect(utils.uid())
                .to.be.a('number');
        });
    });

    describe('hex2rgb', function ()
    {
        it('should exist', function ()
        {
            expect(utils.hex2rgb)
                .to.be.a('function');
        });

        // it('should properly convert number to rgb array');
    });

    describe('hex2string', function ()
    {
        it('should exist', function ()
        {
            expect(utils.hex2string)
                .to.be.a('function');
        });

        // it('should properly convert number to hex color string');
    });

    describe('rgb2hex', function ()
    {
        it('should exist', function ()
        {
            expect(utils.rgb2hex)
                .to.be.a('function');
        });

        // it('should properly convert rgb array to hex color string');
    });

    describe('getResolutionOfUrl', function ()
    {
        it('should exist', function ()
        {
            expect(utils.getResolutionOfUrl)
                .to.be.a('function');
        });

        // it('should return the correct resolution based on a URL');
    });

    describe('decomposeDataUri', function ()
    {
        it('should exist', function ()
        {
            expect(utils.decomposeDataUri)
                .to.be.a('function');
        });

        it('should decompose a data URI', function ()
        {
            var dataUri = utils.decomposeDataUri('data:image/png;base64,94Z9RWUN77ZW');

            expect(dataUri)
                .to.be.an('object');
            expect(dataUri.mediaType)
                .to.equal('image');
            expect(dataUri.subType)
                .to.equal('png');
            expect(dataUri.encoding)
                .to.equal('base64');
            expect(dataUri.data)
                .to.equal('94Z9RWUN77ZW');
        });

        it('should return undefined for anything else', function ()
        {
            var dataUri = utils.decomposeDataUri('foo');

            expect(dataUri)
                .to.be.an('undefined');
        });
    });

    describe('getImageTypeOfUrl', function ()
    {
        it('should exist', function ()
        {
            expect(utils.getImageTypeOfUrl)
                .to.be.a('function');
        });

        it('should return image type of URL in lower case', function ()
        {
            var imageType = utils.getImageTypeOfUrl('http://foo.bar/baz.PNG');

            expect(imageType)
                .to.equal('png');
        });
    });

    describe('getSvgSize', function ()
    {
        it('should exist', function ()
        {
            expect(utils.getSvgSize)
                .to.be.a('function');
        });

        it('should return a size object with width and height from an SVG string', function ()
        {
            var svgSize = utils.getSvgSize('<svg height="32" width="64"></svg>');

            expect(svgSize)
                .to.be.an('object');
            expect(svgSize.width)
                .to.equal(64);
            expect(svgSize.height)
                .to.equal(32);
        });

        it('should work with px values', function ()
        {
            var svgSize = utils.getSvgSize('<svg height="32px" width="64px"></svg>');

            expect(svgSize)
                .to.be.an('object');
            expect(svgSize.width)
                .to.equal(64);
            expect(svgSize.height)
                .to.equal(32);
        });

        it('should return an empty object when width and/or height is missing', function ()
        {
            var svgSize = utils.getSvgSize('<svg width="64"></svg>');

            expect(Object.keys(svgSize).length)
                .to.equal(0);
        });
    });

    describe('sayHello', function ()
    {
        it('should exist', function ()
        {
            expect(utils.sayHello)
                .to.be.a('function');
        });
    });

    describe('isWebGLSupported', function ()
    {
        it('should exist', function ()
        {
            expect(utils.isWebGLSupported)
                .to.be.a('function');
        });
    });

    describe('sign', function ()
    {
        it('should return 0 for 0', function ()
        {
            expect(utils.sign(0))
                .to.be.equal(0);
        });

        it('should return -1 for negative numbers', function ()
        {
            for (var i = 0; i < 10; i += 1)
            {
                expect(utils.sign(-Math.random()))
                    .to.be.equal(-1);
            }
        });

        it('should return 1 for positive numbers', function ()
        {
            for (var i = 0; i < 10; i += 1)
            {
                expect(utils.sign(Math.random() + 0.000001))
                    .to.be.equal(1);
            }
        });
    });

    describe('.removeItems', function ()
    {
        var arr;

        beforeEach(function ()
        {
            arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        });

        it('should return if the start index is greater than or equal to the length of the array', function ()
        {
            utils.removeItems(arr, arr.length + 1, 5);
            expect(arr.length).to.be.equal(10);
        });

        it('should return if the remove count is 0', function ()
        {
            utils.removeItems(arr, 2, 0);
            expect(arr.length).to.be.equal(10);
        });

        it('should remove the number of elements specified from the array, starting from the start index', function ()
        {
            var res = [1, 2, 3, 8, 9, 10];

            utils.removeItems(arr, 3, 4);
            expect(arr).to.be.deep.equal(res);
        });

        it('should remove other elements if delete count is > than the number of elements after start index', function ()
        {
            var res = [1, 2, 3, 4, 5, 6, 7];

            utils.removeItems(arr, 7, 10);
            expect(arr).to.be.deep.equal(res);
        });
    });
});

/*
* toLocal.js
*/
//'use strict';

describe('toLocal', function ()
{
    it('should return correct local cordinates of a displayObject', function ()
    {
        var parent = new Container();

        var container = new Container();

        parent.addChild(container);

        var point = new Point(100, 100);

        var localPoint;

        localPoint = container.toLocal(point);

        expect(localPoint.x).to.equal(100);
        expect(localPoint.y).to.equal(100);

        container.position.x = 20;
        container.position.y = 20;

        container.scale.x = 2;
        container.scale.y = 2;

        localPoint = container.toLocal(point);

        expect(localPoint.x).to.equal(40);
        expect(localPoint.y).to.equal(40);
    });

    it('should map the correct local cordinates of a displayObject to another', function ()
    {
        var parent = new Container();

        var container = new Container();
        var container2 = new Container();

        parent.addChild(container);
        parent.addChild(container2);

        container2.position.x = 100;
        container2.position.y = 100;

        var point = new Point(100, 100);

        container.scale.x = 2;
        container.scale.y = 2;

        var localPoint = container.toLocal(point, container2);

        expect(localPoint.x).to.equal(100);
        expect(localPoint.y).to.equal(100);
    });
});

/*
* toGlobal.js
*/
//'use strict';

describe('toGlobal', function ()
{
    it('should return correct global cordinates of a point from within a displayObject', function ()
    {
        var parent = new Container();

        var container = new Container();

        parent.addChild(container);

        var point = new Point(100, 100);

        var globalPoint;

        globalPoint = container.toGlobal(point);

        expect(globalPoint.x).to.equal(100);
        expect(globalPoint.y).to.equal(100);

        container.position.x = 20;
        container.position.y = 20;

        container.scale.x = 2;
        container.scale.y = 2;

        globalPoint = container.toGlobal(point);

        expect(globalPoint.x).to.equal(220);
        expect(globalPoint.y).to.equal(220);
    });
});

/*
* Text.js
*/
//'use strict';

describe('Text', function ()
{
    describe('destroy', function ()
    {
        it('should call through to Sprite.destroy', function ()
        {
            var text = new Text('foo');

            expect(text.anchor).to.not.equal(null);
            text.destroy();
            expect(text.anchor).to.equal(null);
        });

        it('should set context to null', function ()
        {
            var text = new Text('foo');

            expect(text.style).to.not.equal(null);
            text.destroy();
            expect(text.style).to.equal(null);
        });

        it('should destroy children if children flag is set', function ()
        {
            var text = new Text('foo');
            var child = new DisplayObject();

            text.addChild(child);
            text.destroy({ children: true });
            expect(text.transform).to.equal(null);
            expect(child.transform).to.equal(null);
        });

        it('should accept options correctly', function ()
        {
            var text = new Text('foo');
            var child = new DisplayObject();

            text.addChild(child);
            text.destroy(true);
            expect(text.transform).to.equal(null);
            expect(child.transform).to.equal(null);
        });

        it('should pass opts on to children if children flag is set', function ()
        {
            var text = new Text('foo');
            var child = new DisplayObject();
            var childDestroyOpts;

            child.destroy = function (opts)
            {
                childDestroyOpts = opts;
            };

            text.addChild(child);
            text.destroy({ children: true, texture: true });
            expect(childDestroyOpts).to.deep.equal({ children: true, texture: true, baseTexture: true });
        });

        it('should modify the height of the object when setting height', function ()
        {
            var text = new Text('foo');

            text.height = 300;

            expect(text.height).to.equal(300);
        });

        it('should modify the width of the object when setting width', function ()
        {
            var text = new Text('foo');

            text.width = 300;

            expect(text.width).to.equal(300);
        });
    });
});

/*
* Sprite.js
*/
//'use strict';

describe('Sprite', function ()
{
    describe('width', function ()
    {
        it('should not be negative for nagative scale.x', function ()
        {
            var sprite = new Sprite();

            sprite.width = 100;
            expect(sprite.width).to.be.at.least(0);
            sprite.scale.x = -1;
            expect(sprite.width).to.be.at.least(0);
        });

        it('should not change sign of scale.x', function ()
        {
            var texture = new Texture(new BaseTexture());
            var sprite = new Sprite();

            texture.orig.width = 100;
            sprite.scale.x = 1;
            sprite.width = 50;

            expect(sprite.scale.x).to.be.above(0);

            sprite.scale.x = -1;
            sprite.width = 75;

            expect(sprite.scale.x).to.be.below(0);
        });
    });

    describe('height', function ()
    {
        it('should not be negative for nagative scale.y', function ()
        {
            var sprite = new Sprite();

            sprite.height = 100;
            expect(sprite.height).to.be.at.least(0);
            sprite.scale.y = -1;
            expect(sprite.height).to.be.at.least(0);
        });

        it('should not change sign of scale.y', function ()
        {
            var texture = new Texture(new BaseTexture());
            var sprite = new Sprite();

            texture.orig.height = 100;
            sprite.scale.y = 1;
            sprite.height = 50;

            expect(sprite.scale.y).to.be.above(0);

            sprite.scale.y = -1;
            sprite.height = 75;

            expect(sprite.scale.y).to.be.below(0);
        });
    });
});

/*
* getLocalBounds.js
*/
//'use strict';

describe('getLocalBounds', function ()
{
    it('should register correct local-bounds with a LOADED Sprite', function ()
    {
        var parent = new Container();
        var texture = RenderTexture.create(10, 10);

        var sprite = new Sprite(texture);

        parent.addChild(sprite);

        var bounds;

        bounds = sprite.getLocalBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);

        sprite.position.x = 20;
        sprite.position.y = 20;

        sprite.scale.x = 2;
        sprite.scale.y = 2;

        bounds = sprite.getLocalBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);
    });

    it('should register correct local-bounds with Graphics', function ()
    {
        var parent = new Container();

        var graphics = new Graphics();

        graphics.beginFill(0xFF0000).drawCircle(0, 0, 10);// texture);

        graphics.scale.set(2);

        parent.addChild(graphics);

        var bounds = graphics.getLocalBounds();

        expect(bounds.x).to.equal(-10);
        expect(bounds.y).to.equal(-10);
        expect(bounds.width).to.equal(20);
        expect(bounds.height).to.equal(20);
    });

    it('should register correct local-bounds with an empty Container', function ()
    {
        var parent = new Container();

        var container = new Container();// Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        parent.addChild(container);

        var bounds = container.getLocalBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(0);
        expect(bounds.height).to.equal(0);
    });

    it('should register correct local-bounds with an item that has already had its parent Container transformed', function ()
    {
        var parent = new Container();

        var container = new Container();// Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        var graphics = new Graphics().beginFill(0xFF0000).drawRect(0, 0, 10, 10);// texture);

        parent.addChild(container);
        container.addChild(graphics);

        container.position.x = 100;
        container.position.y = 100;

        var bounds = container.getLocalBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);
    });

    it('should register correct local-bounds with a Mesh', function ()
    {
        var parent = new Container();

        var texture = RenderTexture.create(10, 10);

        var plane = new mesh.Plane(texture);

        parent.addChild(plane);

        plane.position.x = 20;
        plane.position.y = 20;

        var bounds = plane.getLocalBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);
    });

    it('should register correct local-bounds with a cachAsBitmap item inside after a render', function ()
    {
        var parent = new Container();

        var graphic = new Graphics();

        graphic.beginFill(0xffffff);
        graphic.drawRect(0, 0, 100, 100);
        graphic.endFill();
        graphic.cacheAsBitmap = true;

        parent.addChild(graphic);

        var renderer = new CanvasRenderer(100, 100);

        renderer.sayHello = function () { /* empty */ };
        renderer.render(parent);

        var bounds = parent.getLocalBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(100);
        expect(bounds.height).to.equal(100);
    });
});

/*
* DisplayObject.js
*/
//'use strict';

describe('DisplayObject', function ()
{
    it('should be able to add itself to a Container', function ()
    {
        var child = new DisplayObject();
        var container = new Container();

        expect(container.children.length).to.equal(0);
        child.setParent(container);
        expect(container.children.length).to.equal(1);
        expect(child.parent).to.equal(container);
    });
});

/*
* Container.js
*/
//'use strict';

describe('Container', function ()
{
    describe('parent', function ()
    {
        it('should be present when adding children to Container', function ()
        {
            var container = new Container();
            var child = new DisplayObject();

            expect(container.children.length).to.be.equals(0);
            container.addChild(child);
            expect(container.children.length).to.be.equals(1);
            expect(child.parent).to.be.equals(container);
        });
    });

    describe('events', function ()
    {
        it('should trigger "added" and "removed" events on it\'s children', function ()
        {
            var container = new Container();
            var child = new DisplayObject();
            var triggeredAdded = false;
            var triggeredRemoved = false;

            child.on('added', function (to)
            {
                triggeredAdded = true;
                expect(container.children.length).to.be.equals(1);
                expect(child.parent).to.be.equals(to);
            });
            child.on('removed', function (from)
            {
                triggeredRemoved = true;
                expect(container.children.length).to.be.equals(0);
                expect(child.parent).to.be.null;
                expect(container).to.be.equals(from);
            });

            container.addChild(child);
            expect(triggeredAdded).to.be.true;
            expect(triggeredRemoved).to.be.false;

            container.removeChild(child);
            expect(triggeredRemoved).to.be.true;
        });
    });
});

/*
* Bounds.js
*/
//'use strict';

describe('getBounds', function ()
{
    it('should register correct width/height with a LOADED Sprite', function ()
    {
        var parent = new Container();
        var texture = RenderTexture.create(10, 10);

        var sprite = new Sprite(texture);

        parent.addChild(sprite);

        var bounds;

        bounds = sprite.getBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);

        sprite.position.x = 20;
        sprite.position.y = 20;

        sprite.scale.x = 2;
        sprite.scale.y = 2;

        bounds = sprite.getBounds();

        expect(bounds.x).to.equal(20);
        expect(bounds.y).to.equal(20);
        expect(bounds.width).to.equal(20);
        expect(bounds.height).to.equal(20);

        bounds = sprite.getBounds(true);

        expect(bounds.x).to.equal(20);
        expect(bounds.y).to.equal(20);
        expect(bounds.width).to.equal(20);
        expect(bounds.height).to.equal(20);
    });

    it('should register correct width/height with Graphics', function ()
    {
        var parent = new Container();

        var graphics = new Graphics();

        var bounds;

        bounds = graphics.getBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(0);
        expect(bounds.height).to.equal(0);

        graphics.beginFill(0xFF0000).drawCircle(0, 0, 10, 10);// texture);

        parent.addChild(graphics);

        bounds = graphics.getBounds();

        expect(bounds.x).to.equal(-10);
        expect(bounds.y).to.equal(-10);
        expect(bounds.width).to.equal(20);
        expect(bounds.height).to.equal(20);

        graphics.position.x = 20;
        graphics.position.y = 20;

        graphics.scale.x = 2;
        graphics.scale.y = 2;

        bounds = graphics.getBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(40);
        expect(bounds.height).to.equal(40);

        bounds = graphics.getBounds(true);

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(40);
        expect(bounds.height).to.equal(40);
    });

    it('should register correct width/height with an empty Container', function ()
    {
        var parent = new Container();

        var container = new Container();// Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        parent.addChild(container);

        var bounds;

        bounds = container.getBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(0);
        expect(bounds.height).to.equal(0);

        container.position.x = 20;
        container.position.y = 20;

        container.scale.x = 2;
        container.scale.y = 2;

        bounds = container.getBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(0);
        expect(bounds.height).to.equal(0);
    });

    it('should register correct width/height with a Container', function ()
    {
        var parent = new Container();

        var container = new Container(); // Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        var graphics = new Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10); // texture);

        var texture = RenderTexture.create(10, 10);
        var sprite = new Sprite(texture);

        container.addChild(sprite);
        container.addChild(graphics);

        parent.addChild(container);

        sprite.position.x = 30;
        sprite.position.y = 20;
        graphics.position.x = 100;
        graphics.position.y = 100;

        var bounds;

        bounds = container.getBounds();

        expect(bounds.x).to.equal(30);
        expect(bounds.y).to.equal(20);
        expect(bounds.width).to.equal(80);
        expect(bounds.height).to.equal(90);

        container.rotation = 0.1;

        bounds = container.getBounds();

        expect(bounds.x | 0).to.equal(26);
        expect(bounds.y | 0).to.equal(22);
        expect(bounds.width | 0).to.equal(73);
        expect(bounds.height | 0).to.equal(97);

        bounds = container.getBounds(true);

        expect(bounds.x | 0).to.equal(26);
        expect(bounds.y | 0).to.equal(22);
        expect(bounds.width | 0).to.equal(73);
        expect(bounds.height | 0).to.equal(97);
    });

    it('should register correct width/height with an item that has already had its parent Container transformed', function ()
    {
        var parent = new Container();

        var container = new Container();// Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        var graphics = new Graphics().beginFill(0xFF0000).drawRect(0, 0, 10, 10);// texture);

        parent.addChild(container);
        container.addChild(graphics);

        container.position.x = 100;
        container.position.y = 100;

        var bounds;

        bounds = container.getBounds();

        expect(bounds.x).to.equal(100);
        expect(bounds.y).to.equal(100);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);

        bounds = graphics.getBounds(true);

        expect(bounds.x).to.equal(100);
        expect(bounds.y).to.equal(100);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);
    });

    it('should register correct width/height with a Mesh', function ()
    {
        var parent = new Container();

        var texture = RenderTexture.create(10, 10);

        var plane = new mesh.Plane(texture);

        parent.addChild(plane);

        plane.position.x = 20;
        plane.position.y = 20;

        var bounds;

        bounds = plane.getBounds();

        expect(bounds.x).to.equal(20);
        expect(bounds.y).to.equal(20);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);

        plane.scale.x = 2;
        plane.scale.y = 2;

        bounds = plane.getBounds();

        expect(bounds.x).to.equal(20);
        expect(bounds.y).to.equal(20);
        expect(bounds.width).to.equal(20);
        expect(bounds.height).to.equal(20);
    });

    it('should register correct width/height with an a DisplayObject is visible false', function ()
    {
        var parent = new Container();

        var container = new Container();// Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        var graphics = new Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);// texture);

        var texture = RenderTexture.create(10, 10);
        var sprite = new Sprite(texture);

        container.addChild(sprite);
        container.addChild(graphics);

        parent.addChild(container);

        sprite.position.x = 30;
        sprite.position.y = 20;
        graphics.position.x = 100;
        graphics.position.y = 100;

        graphics.visible = false;

        var bounds;

        bounds = container.getBounds();

        expect(bounds.x).to.equal(30);
        expect(bounds.y).to.equal(20);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);

        sprite.renderable = false;

        bounds = container.getBounds();

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.equal(0);
        expect(bounds.height).to.equal(0);

        bounds = sprite.getBounds();

        expect(bounds.x).to.equal(30);
        expect(bounds.y).to.equal(20);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);
    });

    it('should register correct bounds of invisible Container', function ()
    {
        var parent = new Container();

        var container = new Container(); // Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        var texture = RenderTexture.create(10, 10);
        var sprite = new Sprite(texture);

        container.addChild(sprite);
        parent.addChild(container);

        sprite.position.set(30, 20);
        container.visible = false;
        container.position.set(100, 100);

        var bounds;

        bounds = container.getBounds();

        expect(bounds.x).to.equal(130);
        expect(bounds.y).to.equal(120);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);
    });

    it('should register correct width/height with Container masked child', function ()
    {
        var parent = new Container();

        var container = new Container();// Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        var graphics = new Graphics().beginFill(0xFF0000).drawRect(0, 0, 10, 10);// texture);

        var texture = RenderTexture.create(10, 10);
        var sprite = new Sprite(texture);

        container.addChild(sprite);
        container.addChild(graphics);
        sprite.mask = graphics;

        parent.addChild(container);

        sprite.position.x = 30;
        sprite.position.y = 20;
        graphics.position.x = 32;
        graphics.position.y = 23;

        var bounds;

        bounds = graphics.getBounds();

        expect(bounds.x).to.equal(32);
        expect(bounds.y).to.equal(23);
        expect(bounds.width).to.equal(10);
        expect(bounds.height).to.equal(10);

        bounds = container.getBounds();

        expect(bounds.x).to.equal(32);
        expect(bounds.y).to.equal(23);
        expect(bounds.width).to.equal(8);
        expect(bounds.height).to.equal(7);
    });

    it('should register correct width/height with an a DisplayObject parent has moved', function ()
    {
        var parent = new Container();

        var container = new Container();// Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        var graphics = new Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10);// texture);

        container.addChild(graphics);

        parent.addChild(container);

        //  graphics.position.x = 100;
        //  graphics.position.y = 100;
        container.position.x -= 100;
        container.position.y -= 100;

        var bounds = graphics.getBounds();

        expect(bounds.x).to.equal(-110);
        expect(bounds.y).to.equal(-110);
        expect(bounds.width).to.equal(20);
        expect(bounds.height).to.equal(20);
    });

    it('should register correct width/height with an a Text Object', function ()
    {
        var parent = new Container();

        var container = new Container();// Graphics().beginFill(0xFF0000).drawCircle(0, 0, 10, 10);//texture);

        var text = new Text('i am some text');

        container.addChild(text);

        parent.addChild(container);

        var bounds;

        bounds = text.getBounds();
        var bx = bounds.width;

        expect(bounds.x).to.equal(0);
        expect(bounds.y).to.equal(0);
        expect(bounds.width).to.be.greaterThan(0);
        expect(bounds.height).to.greaterThan(0);

        text.text = 'hello!';

        bounds = text.getBounds();

        // this variable seems to be different on different devices. a font thing?
        expect(bounds.width).to.not.equal(bx);
    });

    it('should return a different rectangle if getting local bounds after global bounds ', function ()
    {
        var parent = new Container();
        var texture = RenderTexture.create(10, 10);
        var sprite = new Sprite(texture);

        sprite.position.x = 20;
        sprite.position.y = 20;

        sprite.scale.x = 2;
        sprite.scale.y = 2;

        parent.addChild(sprite);

        var bounds = sprite.getBounds();

        expect(bounds.x).to.equal(20);
        expect(bounds.y).to.equal(20);
        expect(bounds.width).to.equal(20);
        expect(bounds.height).to.equal(20);

        var localBounds = sprite.getLocalBounds();

        expect(localBounds.x).to.equal(0);
        expect(localBounds.y).to.equal(0);
        expect(localBounds.width).to.equal(10);
        expect(localBounds.height).to.equal(10);
    });

    it('should ensure bounds respect the trim of a texture ', function ()
    {
        var parent = new Container();
        var baseTexture = new BaseRenderTexture(100, 100);

        var orig = new Rectangle(0, 0, 100, 50);
        var frame = new Rectangle(2, 2, 50, 50);
        var trim = new Rectangle(25, 0, 50, 50);

        var trimmedTexture = new Texture(baseTexture, frame, orig, trim);

        var sprite = new Sprite(trimmedTexture);

        sprite.position.x = 20;
        sprite.position.y = 20;

        parent.addChild(sprite);

        var bounds = sprite.getBounds();

        expect(bounds.x).to.equal(20);
        expect(bounds.y).to.equal(20);
        expect(bounds.width).to.equal(100);
        expect(bounds.height).to.equal(50);
    });
});
