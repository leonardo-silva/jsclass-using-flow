//import { GLTexture } from 'pixi-gl-core';
//import { WRAP_MODES, SCALE_MODES } from '../../const';
//import RenderTarget from './utils/RenderTarget';
//import { removeItems } from '../../utils';

/**
 * @class
 * @memberof PIXI
 */
class RenderTarget
{
    /**
     * @param {WebGLRenderingContext} gl - The current WebGL drawing context
     * @param {number} [width=0] - the horizontal range of the filter
     * @param {number} [height=0] - the vertical range of the filter
     * @param {number} [scaleMode=PIXI.SCALE_MODES.DEFAULT] - See {@link PIXI.SCALE_MODES} for possible values
     * @param {number} [resolution=1] - The current resolution / device pixel ratio
     * @param {boolean} [root=false] - Whether this object is the root element or not
     */
    constructor(gl, width, height, scaleMode, resolution, root)
    {
        // TODO Resolution could go here ( eg low res blurs )

        /**
         * The current WebGL drawing context.
         *
         * @member {WebGLRenderingContext}
         */
        this.gl = gl;

        // next time to create a frame buffer and texture

        /**
         * A frame buffer
         *
         * @member {PIXI.glCore.GLFramebuffer}
         */
        this.frameBuffer = null;

        /**
         * The texture
         *
         * @member {PIXI.glCore.GLTexture}
         */
        this.texture = null;

        /**
         * The background colour of this render target, as an array of [r,g,b,a] values
         *
         * @member {number[]}
         */
        this.clearColor = [0, 0, 0, 0];

        /**
         * The size of the object as a rectangle
         *
         * @member {PIXI.Rectangle}
         */
        this.size = new Rectangle(0, 0, 1, 1);

        /**
         * The current resolution / device pixel ratio
         *
         * @member {number}
         * @default 1
         */
        this.resolution = resolution || RESOLUTION;

        /**
         * The projection matrix
         *
         * @member {PIXI.Matrix}
         */
        this.projectionMatrix = new Matrix();

        /**
         * The object's transform
         *
         * @member {PIXI.Matrix}
         */
        this.transform = null;

        /**
         * The frame.
         *
         * @member {PIXI.Rectangle}
         */
        this.frame = null;

        /**
         * The stencil buffer stores masking data for the render target
         *
         * @member {glCore.GLBuffer}
         */
        this.defaultFrame = new Rectangle();
        this.destinationFrame = null;
        this.sourceFrame = null;

        /**
         * The stencil buffer stores masking data for the render target
         *
         * @member {glCore.GLBuffer}
         */
        this.stencilBuffer = null;

        /**
         * The data structure for the stencil masks
         *
         * @member {PIXI.Graphics[]}
         */
        this.stencilMaskStack = [];

        /**
         * Stores filter data for the render target
         *
         * @member {object[]}
         */
        this.filterData = null;

        /**
         * The scale mode.
         *
         * @member {number}
         * @default PIXI.SCALE_MODES.DEFAULT
         * @see PIXI.SCALE_MODES
         */
        this.scaleMode = scaleMode || SCALE_MODES.DEFAULT;

        /**
         * Whether this object is the root element or not
         *
         * @member {boolean}
         */
        this.root = root;

        if (!this.root)
        {
            this.frameBuffer = GLFramebuffer.createRGBA(gl, 100, 100);

            if (this.scaleMode === SCALE_MODES.NEAREST)
            {
                this.frameBuffer.texture.enableNearestScaling();
            }
            else
            {
                this.frameBuffer.texture.enableLinearScaling();
            }
            /*
                A frame buffer needs a target to render to..
                create a texture and bind it attach it to the framebuffer..
             */

            // this is used by the base texture
            this.texture = this.frameBuffer.texture;
        }
        else
        {
            // make it a null framebuffer..
            this.frameBuffer = new GLFramebuffer(gl, 100, 100);
            this.frameBuffer.framebuffer = null;
        }

        this.setFrame();

        this.resize(width, height);
    }

    /**
     * Clears the filter texture.
     *
     * @param {number[]} [clearColor=this.clearColor] - Array of [r,g,b,a] to clear the framebuffer
     */
    clear(clearColor)
    {
        const cc = clearColor || this.clearColor;

        this.frameBuffer.clear(cc[0], cc[1], cc[2], cc[3]);// r,g,b,a);
    }

    /**
     * Binds the stencil buffer.
     *
     */
    attachStencilBuffer()
    {
        // TODO check if stencil is done?
        /**
         * The stencil buffer is used for masking in pixi
         * lets create one and then add attach it to the framebuffer..
         */
        if (!this.root)
        {
            this.frameBuffer.enableStencil();
        }
    }

    /**
     * Sets the frame of the render target.
     *
     * @param {Rectangle} destinationFrame - The destination frame.
     * @param {Rectangle} sourceFrame - The source frame.
     */
    setFrame(destinationFrame, sourceFrame)
    {
        this.destinationFrame = destinationFrame || this.destinationFrame || this.defaultFrame;
        this.sourceFrame = sourceFrame || this.sourceFrame || destinationFrame;
    }

    /**
     * Binds the buffers and initialises the viewport.
     *
     */
    activate()
    {
        // TOOD refactor usage of frame..
        const gl = this.gl;

        // make surethe texture is unbound!
        this.frameBuffer.bind();

        this.calculateProjection(this.destinationFrame, this.sourceFrame);

        if (this.transform)
        {
            this.projectionMatrix.append(this.transform);
        }

        // TODO add a check as them may be the same!
        if (this.destinationFrame !== this.sourceFrame)
        {
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(
                this.destinationFrame.x | 0,
                this.destinationFrame.y | 0,
                (this.destinationFrame.width * this.resolution) | 0,
                (this.destinationFrame.height * this.resolution) | 0
            );
        }
        else
        {
            gl.disable(gl.SCISSOR_TEST);
        }

        // TODO - does not need to be updated all the time??
        gl.viewport(
            this.destinationFrame.x | 0,
            this.destinationFrame.y | 0,
            (this.destinationFrame.width * this.resolution) | 0,
            (this.destinationFrame.height * this.resolution) | 0
        );
    }

    /**
     * Updates the projection matrix based on a projection frame (which is a rectangle)
     *
     * @param {Rectangle} destinationFrame - The destination frame.
     * @param {Rectangle} sourceFrame - The source frame.
     */
    calculateProjection(destinationFrame, sourceFrame)
    {
        const pm = this.projectionMatrix;

        sourceFrame = sourceFrame || destinationFrame;

        pm.identity();

        // TODO: make dest scale source
        if (!this.root)
        {
            pm.a = 1 / destinationFrame.width * 2;
            pm.d = 1 / destinationFrame.height * 2;

            pm.tx = -1 - (sourceFrame.x * pm.a);
            pm.ty = -1 - (sourceFrame.y * pm.d);
        }
        else
        {
            pm.a = 1 / destinationFrame.width * 2;
            pm.d = -1 / destinationFrame.height * 2;

            pm.tx = -1 - (sourceFrame.x * pm.a);
            pm.ty = 1 - (sourceFrame.y * pm.d);
        }
    }

    /**
     * Resizes the texture to the specified width and height
     *
     * @param {number} width - the new width of the texture
     * @param {number} height - the new height of the texture
     */
    resize(width, height)
    {
        width = width | 0;
        height = height | 0;

        if (this.size.width === width && this.size.height === height)
        {
            return;
        }

        this.size.width = width;
        this.size.height = height;

        this.defaultFrame.width = width;
        this.defaultFrame.height = height;

        this.frameBuffer.resize(width * this.resolution, height * this.resolution);

        const projectionFrame = this.frame || this.size;

        this.calculateProjection(projectionFrame);
    }

    /**
     * Destroys the render target.
     *
     */
    destroy()
    {
        this.frameBuffer.destroy();

        this.frameBuffer = null;
        this.texture = null;
    }
}

/**
 * Helper class to create a webGL Texture
 *
 * @class
 * @memberof PIXI
 */
class TextureManager
{
    /**
     * @param {PIXI.WebGLRenderer} renderer - A reference to the current renderer
     */
    constructor(renderer)
    {
        /**
         * A reference to the current renderer
         *
         * @member {PIXI.WebGLRenderer}
         */
        this.renderer = renderer;

        /**
         * The current WebGL rendering context
         *
         * @member {WebGLRenderingContext}
         */
        this.gl = renderer.gl;

        /**
         * Track textures in the renderer so we can no longer listen to them on destruction.
         *
         * @member {Array<*>}
         * @private
         */
        this._managedTextures = [];
    }

    /**
     * Binds a texture.
     *
     */
    bindTexture()
    {
        // empty
    }

    /**
     * Gets a texture.
     *
     */
    getTexture()
    {
        // empty
    }

    /**
     * Updates and/or Creates a WebGL texture for the renderer's context.
     *
     * @param {PIXI.BaseTexture|PIXI.Texture} texture - the texture to update
     * @return {GLTexture} The gl texture.
     */
    updateTexture(texture)
    {
        texture = texture.baseTexture || texture;

        const isRenderTexture = !!texture._glRenderTargets;

        if (!texture.hasLoaded)
        {
            return null;
        }

        let glTexture = texture._glTextures[this.renderer.CONTEXT_UID];

        if (!glTexture)
        {
            if (isRenderTexture)
            {
                const renderTarget = new RenderTarget(
                    this.gl,
                    texture.width,
                    texture.height,
                    texture.scaleMode,
                    texture.resolution
                );

                renderTarget.resize(texture.width, texture.height);
                texture._glRenderTargets[this.renderer.CONTEXT_UID] = renderTarget;
                glTexture = renderTarget.texture;
            }
            else
            {
                glTexture = new GLTexture(this.gl);
                glTexture.premultiplyAlpha = true;
                glTexture.upload(texture.source);
            }

            texture._glTextures[this.renderer.CONTEXT_UID] = glTexture;

            texture.on('update', this.updateTexture, this);
            texture.on('dispose', this.destroyTexture, this);

            this._managedTextures.push(texture);

            if (texture.isPowerOfTwo)
            {
                if (texture.mipmap)
                {
                    glTexture.enableMipmap();
                }

                if (texture.wrapMode === WRAP_MODES.CLAMP)
                {
                    glTexture.enableWrapClamp();
                }
                else if (texture.wrapMode === WRAP_MODES.REPEAT)
                {
                    glTexture.enableWrapRepeat();
                }
                else
                {
                    glTexture.enableWrapMirrorRepeat();
                }
            }
            else
            {
                glTexture.enableWrapClamp();
            }

            if (texture.scaleMode === SCALE_MODES.NEAREST)
            {
                glTexture.enableNearestScaling();
            }
            else
            {
                glTexture.enableLinearScaling();
            }
        }
        // the textur ealrady exists so we only need to update it..
        else if (isRenderTexture)
        {
            texture._glRenderTargets[this.renderer.CONTEXT_UID].resize(texture.width, texture.height);
        }
        else
        {
            glTexture.upload(texture.source);
        }

        return glTexture;
    }

    /**
     * Deletes the texture from WebGL
     *
     * @param {PIXI.BaseTexture|PIXI.Texture} texture - the texture to destroy
     * @param {boolean} [skipRemove=false] - Whether to skip removing the texture from the TextureManager.
     */
    destroyTexture(texture, skipRemove)
    {
        texture = texture.baseTexture || texture;

        if (!texture.hasLoaded)
        {
            return;
        }

        if (texture._glTextures[this.renderer.CONTEXT_UID])
        {
            texture._glTextures[this.renderer.CONTEXT_UID].destroy();
            texture.off('update', this.updateTexture, this);
            texture.off('dispose', this.destroyTexture, this);

            delete texture._glTextures[this.renderer.CONTEXT_UID];

            if (!skipRemove)
            {
                const i = this._managedTextures.indexOf(texture);

                if (i !== -1)
                {
                    removeItems(this._managedTextures, i, 1);
                }
            }
        }
    }

    /**
     * Deletes all the textures from WebGL
     */
    removeAll()
    {
        // empty all the old gl textures as they are useless now
        for (let i = 0; i < this._managedTextures.length; ++i)
        {
            const texture = this._managedTextures[i];

            if (texture._glTextures[this.renderer.CONTEXT_UID])
            {
                delete texture._glTextures[this.renderer.CONTEXT_UID];
            }
        }
    }

    /**
     * Destroys this manager and removes all its textures
     */
    destroy()
    {
        // destroy managed textures
        for (let i = 0; i < this._managedTextures.length; ++i)
        {
            const texture = this._managedTextures[i];

            this.destroyTexture(texture, true);

            texture.off('update', this.updateTexture, this);
            texture.off('dispose', this.destroyTexture, this);
        }

        this._managedTextures = null;
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
