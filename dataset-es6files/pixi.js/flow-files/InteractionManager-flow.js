//import * as core from '../core';
//import InteractionData from './InteractionData';
//import InteractionEvent from './InteractionEvent';
//import EventEmitter from 'eventemitter3';
//import interactiveTarget from './interactiveTarget';
//import MobileDevice from 'ismobilejs';

/**
 * The base class for all objects that are rendered on the screen.
 * This is an abstract class and should not be used on its own rather it should be extended.
 *
 * @class
 * @extends EventEmitter
 * @mixes PIXI.interaction.interactiveTarget
 * @memberof PIXI
 */
class DisplayObject extends EventEmitter
{
    /**
     *
     */
    constructor()
    {
        super();

        const TransformClass = TRANSFORM_MODE.DEFAULT === TRANSFORM_MODE.STATIC ? TransformStatic : Transform;

        this.tempDisplayObjectParent = null;

        // TODO: need to create Transform from factory
        /**
         * World transform and local transform of this object.
         * This will become read-only later, please do not assign anything there unless you know what are you doing
         *
         * @member {PIXI.TransformBase}
         */
        this.transform = new TransformClass();

        /**
         * The opacity of the object.
         *
         * @member {number}
         */
        this.alpha = 1;

        /**
         * The visibility of the object. If false the object will not be drawn, and
         * the updateTransform function will not be called.
         *
         * Only affects recursive calls from parent. You can ask for bounds or call updateTransform manually
         *
         * @member {boolean}
         */
        this.visible = true;

        /**
         * Can this object be rendered, if false the object will not be drawn but the updateTransform
         * methods will still be called.
         *
         * Only affects recursive calls from parent. You can ask for bounds manually
         *
         * @member {boolean}
         */
        this.renderable = true;

        /**
         * The display object container that contains this display object.
         *
         * @member {PIXI.Container}
         * @readonly
         */
        this.parent = null;

        /**
         * The multiplied alpha of the displayObject
         *
         * @member {number}
         * @readonly
         */
        this.worldAlpha = 1;

        /**
         * The area the filter is applied to. This is used as more of an optimisation
         * rather than figuring out the dimensions of the displayObject each frame you can set this rectangle
         *
         * Also works as an interaction mask
         *
         * @member {PIXI.Rectangle}
         */
        this.filterArea = null;

        this._filters = null;
        this._enabledFilters = null;

        /**
         * The bounds object, this is used to calculate and store the bounds of the displayObject
         *
         * @member {PIXI.Rectangle}
         * @private
         */
        this._bounds = new Bounds();
        this._boundsID = 0;
        this._lastBoundsID = -1;
        this._boundsRect = null;
        this._localBoundsRect = null;

        /**
         * The original, cached mask of the object
         *
         * @member {PIXI.Rectangle}
         * @private
         */
        this._mask = null;
    }

    /**
     * @private
     * @member {PIXI.DisplayObject}
     */
    get _tempDisplayObjectParent()
    {
        if (this.tempDisplayObjectParent === null)
        {
            this.tempDisplayObjectParent = new DisplayObject();
        }

        return this.tempDisplayObjectParent;
    }

    /**
     * Updates the object transform for rendering
     *
     * TODO - Optimization pass!
     */
    updateTransform()
    {
        this.transform.updateTransform(this.parent.transform);
        // multiply the alphas..
        this.worldAlpha = this.alpha * this.parent.worldAlpha;

        this._bounds.updateID++;
    }

    /**
     * recursively updates transform of all objects from the root to this one
     * internal function for toLocal()
     */
    _recursivePostUpdateTransform()
    {
        if (this.parent)
        {
            this.parent._recursivePostUpdateTransform();
            this.transform.updateTransform(this.parent.transform);
        }
        else
        {
            this.transform.updateTransform(this._tempDisplayObjectParent.transform);
        }
    }

    /**
     * Retrieves the bounds of the displayObject as a rectangle object.
     *
     * @param {boolean} skipUpdate - setting to true will stop the transforms of the scene graph from
     *  being updated. This means the calculation returned MAY be out of date BUT will give you a
     *  nice performance boost
     * @param {PIXI.Rectangle} rect - Optional rectangle to store the result of the bounds calculation
     * @return {PIXI.Rectangle} the rectangular bounding area
     */
    getBounds(skipUpdate, rect)
    {
        if (!skipUpdate)
        {
            if (!this.parent)
            {
                this.parent = this._tempDisplayObjectParent;
                this.updateTransform();
                this.parent = null;
            }
            else
            {
                this._recursivePostUpdateTransform();
                this.updateTransform();
            }
        }

        if (this._boundsID !== this._lastBoundsID)
        {
            this.calculateBounds();
        }

        if (!rect)
        {
            if (!this._boundsRect)
            {
                this._boundsRect = new Rectangle();
            }

            rect = this._boundsRect;
        }

        return this._bounds.getRectangle(rect);
    }

    /**
     * Retrieves the local bounds of the displayObject as a rectangle object
     *
     * @param {PIXI.Rectangle} [rect] - Optional rectangle to store the result of the bounds calculation
     * @return {PIXI.Rectangle} the rectangular bounding area
     */
    getLocalBounds(rect)
    {
        const transformRef = this.transform;
        const parentRef = this.parent;

        this.parent = null;
        this.transform = this._tempDisplayObjectParent.transform;

        if (!rect)
        {
            if (!this._localBoundsRect)
            {
                this._localBoundsRect = new Rectangle();
            }

            rect = this._localBoundsRect;
        }

        const bounds = this.getBounds(false, rect);

        this.parent = parentRef;
        this.transform = transformRef;

        return bounds;
    }

    /**
     * Calculates the global position of the display object
     *
     * @param {PIXI.Point} position - The world origin to calculate from
     * @param {PIXI.Point} [point] - A Point object in which to store the value, optional
     *  (otherwise will create a new Point)
     * @param {boolean} [skipUpdate=false] - Should we skip the update transform.
     * @return {PIXI.Point} A point object representing the position of this object
     */
    toGlobal(position, point, skipUpdate = false)
    {
        if (!skipUpdate)
        {
            this._recursivePostUpdateTransform();

            // this parent check is for just in case the item is a root object.
            // If it is we need to give it a temporary parent so that displayObjectUpdateTransform works correctly
            // this is mainly to avoid a parent check in the main loop. Every little helps for performance :)
            if (!this.parent)
            {
                this.parent = this._tempDisplayObjectParent;
                this.displayObjectUpdateTransform();
                this.parent = null;
            }
            else
            {
                this.displayObjectUpdateTransform();
            }
        }

        // don't need to update the lot
        return this.worldTransform.apply(position, point);
    }

    /**
     * Calculates the local position of the display object relative to another point
     *
     * @param {PIXI.Point} position - The world origin to calculate from
     * @param {PIXI.DisplayObject} [from] - The DisplayObject to calculate the global position from
     * @param {PIXI.Point} [point] - A Point object in which to store the value, optional
     *  (otherwise will create a new Point)
     * @param {boolean} [skipUpdate=false] - Should we skip the update transform
     * @return {PIXI.Point} A point object representing the position of this object
     */
    toLocal(position, from, point, skipUpdate)
    {
        if (from)
        {
            position = from.toGlobal(position, point, skipUpdate);
        }

        if (!skipUpdate)
        {
            this._recursivePostUpdateTransform();

            // this parent check is for just in case the item is a root object.
            // If it is we need to give it a temporary parent so that displayObjectUpdateTransform works correctly
            // this is mainly to avoid a parent check in the main loop. Every little helps for performance :)
            if (!this.parent)
            {
                this.parent = this._tempDisplayObjectParent;
                this.displayObjectUpdateTransform();
                this.parent = null;
            }
            else
            {
                this.displayObjectUpdateTransform();
            }
        }

        // simply apply the matrix..
        return this.worldTransform.applyInverse(position, point);
    }

    /**
     * Renders the object using the WebGL renderer
     *
     * @param {PIXI.WebGLRenderer} renderer - The renderer
     */
    renderWebGL(renderer) // eslint-disable-line no-unused-vars
    {
        // OVERWRITE;
    }

    /**
     * Renders the object using the Canvas renderer
     *
     * @param {PIXI.CanvasRenderer} renderer - The renderer
     */
    renderCanvas(renderer) // eslint-disable-line no-unused-vars
    {
        // OVERWRITE;
    }

    /**
     * Set the parent Container of this DisplayObject
     *
     * @param {PIXI.Container} container - The Container to add this DisplayObject to
     * @return {PIXI.Container} The Container that this DisplayObject was added to
     */
    setParent(container)
    {
        if (!container || !container.addChild)
        {
            throw new Error('setParent: Argument must be a Container');
        }

        container.addChild(this);

        return container;
    }

    /**
     * Convenience function to set the postion, scale, skew and pivot at once.
     *
     * @param {number} [x=0] - The X position
     * @param {number} [y=0] - The Y position
     * @param {number} [scaleX=1] - The X scale value
     * @param {number} [scaleY=1] - The Y scale value
     * @param {number} [rotation=0] - The rotation
     * @param {number} [skewX=0] - The X skew value
     * @param {number} [skewY=0] - The Y skew value
     * @param {number} [pivotX=0] - The X pivot value
     * @param {number} [pivotY=0] - The Y pivot value
     * @return {PIXI.DisplayObject} The DisplayObject instance
     */
    setTransform(x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0, skewX = 0, skewY = 0, pivotX = 0, pivotY = 0)
    {
        this.position.x = x;
        this.position.y = y;
        this.scale.x = !scaleX ? 1 : scaleX;
        this.scale.y = !scaleY ? 1 : scaleY;
        this.rotation = rotation;
        this.skew.x = skewX;
        this.skew.y = skewY;
        this.pivot.x = pivotX;
        this.pivot.y = pivotY;

        return this;
    }

    /**
     * Base destroy method for generic display objects. This will automatically
     * remove the display object from its parent Container as well as remove
     * all current event listeners and internal references. Do not use a DisplayObject
     * after calling `destroy`.
     *
     */
    destroy()
    {
        this.removeAllListeners();
        if (this.parent)
        {
            this.parent.removeChild(this);
        }
        this.transform = null;

        this.parent = null;

        this._bounds = null;
        this._currentBounds = null;
        this._mask = null;

        this.filterArea = null;

        this.interactive = false;
        this.interactiveChildren = false;
    }

    /**
     * The position of the displayObject on the x axis relative to the local coordinates of the parent.
     * An alias to position.x
     *
     * @member {number}
     * @memberof PIXI.DisplayObject#
     */
    get x()
    {
        return this.position.x;
    }

    /**
     * Sets the X position of the object.
     *
     * @param {number} value - The value to set to.
     */
    set x(value)
    {
        this.transform.position.x = value;
    }

    /**
     * The position of the displayObject on the y axis relative to the local coordinates of the parent.
     * An alias to position.y
     *
     * @member {number}
     * @memberof PIXI.DisplayObject#
     */
    get y()
    {
        return this.position.y;
    }

    /**
     * Sets the Y position of the object.
     *
     * @param {number} value - The value to set to.
     */
    set y(value)
    {
        this.transform.position.y = value;
    }

    /**
     * Current transform of the object based on world (parent) factors
     *
     * @member {PIXI.Matrix}
     * @memberof PIXI.DisplayObject#
     * @readonly
     */
    get worldTransform()
    {
        return this.transform.worldTransform;
    }

    /**
     * Current transform of the object based on local factors: position, scale, other stuff
     *
     * @member {PIXI.Matrix}
     * @memberof PIXI.DisplayObject#
     * @readonly
     */
    get localTransform()
    {
        return this.transform.localTransform;
    }

    /**
     * The coordinate of the object relative to the local coordinates of the parent.
     * Assignment by value since pixi-v4.
     *
     * @member {PIXI.Point|PIXI.ObservablePoint}
     * @memberof PIXI.DisplayObject#
     */
    get position()
    {
        return this.transform.position;
    }

    /**
     * Copies the point to the position of the object.
     *
     * @param {PIXI.Point} value - The value to set to.
     */
    set position(value)
    {
        this.transform.position.copy(value);
    }

    /**
     * The scale factor of the object.
     * Assignment by value since pixi-v4.
     *
     * @member {PIXI.Point|PIXI.ObservablePoint}
     * @memberof PIXI.DisplayObject#
     */
    get scale()
    {
        return this.transform.scale;
    }

    /**
     * Copies the point to the scale of the object.
     *
     * @param {PIXI.Point} value - The value to set to.
     */
    set scale(value)
    {
        this.transform.scale.copy(value);
    }

    /**
     * The pivot point of the displayObject that it rotates around
     * Assignment by value since pixi-v4.
     *
     * @member {PIXI.Point|PIXI.ObservablePoint}
     * @memberof PIXI.DisplayObject#
     */
    get pivot()
    {
        return this.transform.pivot;
    }

    /**
     * Copies the point to the pivot of the object.
     *
     * @param {PIXI.Point} value - The value to set to.
     */
    set pivot(value)
    {
        this.transform.pivot.copy(value);
    }

    /**
     * The skew factor for the object in radians.
     * Assignment by value since pixi-v4.
     *
     * @member {PIXI.ObservablePoint}
     * @memberof PIXI.DisplayObject#
     */
    get skew()
    {
        return this.transform.skew;
    }

    /**
     * Copies the point to the skew of the object.
     *
     * @param {PIXI.Point} value - The value to set to.
     */
    set skew(value)
    {
        this.transform.skew.copy(value);
    }

    /**
     * The rotation of the object in radians.
     *
     * @member {number}
     * @memberof PIXI.DisplayObject#
     */
    get rotation()
    {
        return this.transform.rotation;
    }

    /**
     * Sets the rotation of the object.
     *
     * @param {number} value - The value to set to.
     */
    set rotation(value)
    {
        this.transform.rotation = value;
    }

    /**
     * Indicates if the sprite is globally visible.
     *
     * @member {boolean}
     * @memberof PIXI.DisplayObject#
     * @readonly
     */
    get worldVisible()
    {
        let item = this;

        do
        {
            if (!item.visible)
            {
                return false;
            }

            item = item.parent;
        } while (item);

        return true;
    }

    /**
     * Sets a mask for the displayObject. A mask is an object that limits the visibility of an
     * object to the shape of the mask applied to it. In PIXI a regular mask must be a
     * PIXI.Graphics or a PIXI.Sprite object. This allows for much faster masking in canvas as it
     * utilises shape clipping. To remove a mask, set this property to null.
     *
     * @todo For the moment, PIXI.CanvasRenderer doesn't support PIXI.Sprite as mask.
     *
     * @member {PIXI.Graphics|PIXI.Sprite}
     * @memberof PIXI.DisplayObject#
     */
    get mask()
    {
        return this._mask;
    }

    /**
     * Sets the mask.
     *
     * @param {PIXI.Graphics|PIXI.Sprite} value - The value to set to.
     */
    set mask(value)
    {
        if (this._mask)
        {
            this._mask.renderable = true;
        }

        this._mask = value;

        if (this._mask)
        {
            this._mask.renderable = false;
        }
    }

    /**
     * Sets the filters for the displayObject.
     * * IMPORTANT: This is a webGL only feature and will be ignored by the canvas renderer.
     * To remove filters simply set this property to 'null'
     *
     * @member {PIXI.AbstractFilter[]}
     * @memberof PIXI.DisplayObject#
     */
    get filters()
    {
        return this._filters && this._filters.slice();
    }

    /**
     * Shallow copies the array to the filters of the object.
     *
     * @param {PIXI.Filter[]} value - The filters to set.
     */
    set filters(value)
    {
        this._filters = value && value.slice();
    }
}

// performance increase to avoid using call.. (10x faster)
DisplayObject.prototype.displayObjectUpdateTransform = DisplayObject.prototype.updateTransform;

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
 * The WebGLRenderer draws the scene and all its content onto a webGL enabled canvas. This renderer
 * should be used for browsers that support webGL. This Render works by automatically managing webGLBatchs.
 * So no need for Sprite Batches or Sprite Clouds.
 * Don't forget to add the view to your DOM or you will not see anything :)
 *
 * @class
 * @memberof PIXI
 * @extends PIXI.SystemRenderer
 */
class WebGLRenderer extends SystemRenderer
{
    /**
     *
     * @param {number} [width=0] - the width of the canvas view
     * @param {number} [height=0] - the height of the canvas view
     * @param {object} [options] - The optional renderer parameters
     * @param {HTMLCanvasElement} [options.view] - the canvas to use as a view, optional
     * @param {boolean} [options.transparent=false] - If the render view is transparent, default false
     * @param {boolean} [options.autoResize=false] - If the render view is automatically resized, default false
     * @param {boolean} [options.antialias=false] - sets antialias. If not available natively then FXAA
     *  antialiasing is used
     * @param {boolean} [options.forceFXAA=false] - forces FXAA antialiasing to be used over native.
     *  FXAA is faster, but may not always look as great
     * @param {number} [options.resolution=1] - The resolution / device pixel ratio of the renderer.
     *  The resolution of the renderer retina would be 2.
     * @param {boolean} [options.clearBeforeRender=true] - This sets if the CanvasRenderer will clear
     *  the canvas or not before the new render pass. If you wish to set this to false, you *must* set
     *  preserveDrawingBuffer to `true`.
     * @param {boolean} [options.preserveDrawingBuffer=false] - enables drawing buffer preservation,
     *  enable this if you need to call toDataUrl on the webgl context.
     * @param {boolean} [options.roundPixels=false] - If true Pixi will Math.floor() x/y values when
     *  rendering, stopping pixel interpolation.
     */
    constructor(width, height, options = {})
    {
        super('WebGL', width, height, options);
        /**
         * The type of this renderer as a standardised const
         *
         * @member {number}
         * @see PIXI.RENDERER_TYPE
         */
        this.type = RENDERER_TYPE.WEBGL;

        this.handleContextLost = this.handleContextLost.bind(this);
        this.handleContextRestored = this.handleContextRestored.bind(this);

        this.view.addEventListener('webglcontextlost', this.handleContextLost, false);
        this.view.addEventListener('webglcontextrestored', this.handleContextRestored, false);

        /**
         * The options passed in to create a new webgl context.
         *
         * @member {object}
         * @private
         */
        this._contextOptions = {
            alpha: this.transparent,
            antialias: options.antialias,
            premultipliedAlpha: this.transparent && this.transparent !== 'notMultiplied',
            stencil: true,
            preserveDrawingBuffer: options.preserveDrawingBuffer,
        };

        this._backgroundColorRgba[3] = this.transparent ? 0 : 1;

        /**
         * Manages the masks using the stencil buffer.
         *
         * @member {PIXI.MaskManager}
         */
        this.maskManager = new MaskManager(this);

        /**
         * Manages the stencil buffer.
         *
         * @member {PIXI.StencilManager}
         */
        this.stencilManager = new StencilManager(this);

        /**
         * An empty renderer.
         *
         * @member {PIXI.ObjectRenderer}
         */
        this.emptyRenderer = new ObjectRenderer(this);

        /**
         * The currently active ObjectRenderer.
         *
         * @member {PIXI.ObjectRenderer}
         */
        this.currentRenderer = this.emptyRenderer;

        this.initPlugins();

        /**
         * The current WebGL rendering context, it is created here
         *
         * @member {WebGLRenderingContext}
         */
        // initialize the context so it is ready for the managers.
        if (options.context)
        {
            // checks to see if a context is valid..
            validateContext(options.context);
        }

        this.gl = options.context || glCore.createContext(this.view, this._contextOptions);

        this.CONTEXT_UID = CONTEXT_UID++;

        /**
         * The currently active ObjectRenderer.
         *
         * @member {PIXI.WebGLState}
         */
        this.state = new WebGLState(this.gl);

        this.renderingToScreen = true;

        this._initContext();

        /**
         * Manages the filters.
         *
         * @member {PIXI.FilterManager}
         */
        this.filterManager = new FilterManager(this);
        // map some webGL blend and drawmodes..
        this.drawModes = mapWebGLDrawModesToPixi(this.gl);

        /**
         * Holds the current shader
         *
         * @member {PIXI.Shader}
         */
        this._activeShader = null;

        /**
         * Holds the current render target
         *
         * @member {PIXI.RenderTarget}
         */
        this._activeRenderTarget = null;
        this._activeTextureLocation = 999;
        this._activeTexture = null;

        this.setBlendMode(0);
    }

    /**
     * Creates the WebGL context
     *
     * @private
     */
    _initContext()
    {
        const gl = this.gl;

        // create a texture manager...
        this.textureManager = new TextureManager(this);
        this.textureGC = new TextureGarbageCollector(this);

        this.state.resetToDefault();

        this.rootRenderTarget = new RenderTarget(gl, this.width, this.height, null, this.resolution, true);
        this.rootRenderTarget.clearColor = this._backgroundColorRgba;

        this.bindRenderTarget(this.rootRenderTarget);

        this.emit('context', gl);

        // setup the width/height properties and gl viewport
        this.resize(this.width, this.height);
    }

    /**
     * Renders the object to its webGL view
     *
     * @param {PIXI.DisplayObject} displayObject - the object to be rendered
     * @param {PIXI.RenderTexture} renderTexture - The render texture to render to.
     * @param {boolean} [clear] - Should the canvas be cleared before the new render
     * @param {PIXI.Transform} [transform] - A transform to apply to the render texture before rendering.
     * @param {boolean} [skipUpdateTransform] - Should we skip the update transform pass?
     */
    render(displayObject, renderTexture, clear, transform, skipUpdateTransform)
    {
        // can be handy to know!
        this.renderingToScreen = !renderTexture;

        this.emit('prerender');

        // no point rendering if our context has been blown up!
        if (!this.gl || this.gl.isContextLost())
        {
            return;
        }

        if (!renderTexture)
        {
            this._lastObjectRendered = displayObject;
        }

        if (!skipUpdateTransform)
        {
            // update the scene graph
            const cacheParent = displayObject.parent;

            displayObject.parent = this._tempDisplayObjectParent;
            displayObject.updateTransform();
            displayObject.parent = cacheParent;
           // displayObject.hitArea = //TODO add a temp hit area
        }

        this.bindRenderTexture(renderTexture, transform);

        this.currentRenderer.start();

        if (clear !== undefined ? clear : this.clearBeforeRender)
        {
            this._activeRenderTarget.clear();
        }

        displayObject.renderWebGL(this);

        // apply transform..
        this.currentRenderer.flush();

        // this.setObjectRenderer(this.emptyRenderer);

        this.textureGC.update();

        this.emit('postrender');
    }

    /**
     * Changes the current renderer to the one given in parameter
     *
     * @param {PIXI.ObjectRenderer} objectRenderer - The object renderer to use.
     */
    setObjectRenderer(objectRenderer)
    {
        if (this.currentRenderer === objectRenderer)
        {
            return;
        }

        this.currentRenderer.stop();
        this.currentRenderer = objectRenderer;
        this.currentRenderer.start();
    }

    /**
     * This shoudl be called if you wish to do some custom rendering
     * It will basically render anything that may be batched up such as sprites
     *
     */
    flush()
    {
        this.setObjectRenderer(this.emptyRenderer);
    }

    /**
     * Resizes the webGL view to the specified width and height.
     *
     * @param {number} width - the new width of the webGL view
     * @param {number} height - the new height of the webGL view
     */
    resize(width, height)
    {
      //  if(width * this.resolution === this.width && height * this.resolution === this.height)return;

        SystemRenderer.prototype.resize.call(this, width, height);

        this.rootRenderTarget.resize(width, height);

        if (this._activeRenderTarget === this.rootRenderTarget)
        {
            this.rootRenderTarget.activate();

            if (this._activeShader)
            {
                this._activeShader.uniforms.projectionMatrix = this.rootRenderTarget.projectionMatrix.toArray(true);
            }
        }
    }

    /**
     * Resizes the webGL view to the specified width and height.
     *
     * @param {number} blendMode - the desired blend mode
     */
    setBlendMode(blendMode)
    {
        this.state.setBlendMode(blendMode);
    }

    /**
     * Erases the active render target and fills the drawing area with a colour
     *
     * @param {number} [clearColor] - The colour
     */
    clear(clearColor)
    {
        this._activeRenderTarget.clear(clearColor);
    }

    /**
     * Sets the transform of the active render target to the given matrix
     *
     * @param {PIXI.Matrix} matrix - The transformation matrix
     */
    setTransform(matrix)
    {
        this._activeRenderTarget.transform = matrix;
    }

    /**
     * Binds a render texture for rendering
     *
     * @param {PIXI.RenderTexture} renderTexture - The render texture to render
     * @param {PIXI.Transform} transform - The transform to be applied to the render texture
     * @return {PIXI.WebGLRenderer} Returns itself.
     */
    bindRenderTexture(renderTexture, transform)
    {
        let renderTarget;

        if (renderTexture)
        {
            const baseTexture = renderTexture.baseTexture;
            const gl = this.gl;

            if (!baseTexture._glRenderTargets[this.CONTEXT_UID])
            {
                this.textureManager.updateTexture(baseTexture);
                gl.bindTexture(gl.TEXTURE_2D, null);
            }
            else
            {
                // the texture needs to be unbound if its being rendererd too..
                this._activeTextureLocation = baseTexture._id;
                gl.activeTexture(gl.TEXTURE0 + baseTexture._id);
                gl.bindTexture(gl.TEXTURE_2D, null);
            }

            renderTarget = baseTexture._glRenderTargets[this.CONTEXT_UID];
            renderTarget.setFrame(renderTexture.frame);
        }
        else
        {
            renderTarget = this.rootRenderTarget;
        }

        renderTarget.transform = transform;
        this.bindRenderTarget(renderTarget);

        return this;
    }

    /**
     * Changes the current render target to the one given in parameter
     *
     * @param {PIXI.RenderTarget} renderTarget - the new render target
     * @return {PIXI.WebGLRenderer} Returns itself.
     */
    bindRenderTarget(renderTarget)
    {
        if (renderTarget !== this._activeRenderTarget)
        {
            this._activeRenderTarget = renderTarget;
            renderTarget.activate();

            if (this._activeShader)
            {
                this._activeShader.uniforms.projectionMatrix = renderTarget.projectionMatrix.toArray(true);
            }

            this.stencilManager.setMaskStack(renderTarget.stencilMaskStack);
        }

        return this;
    }

    /**
     * Changes the current shader to the one given in parameter
     *
     * @param {PIXI.Shader} shader - the new shader
     * @return {PIXI.WebGLRenderer} Returns itself.
     */
    bindShader(shader)
    {
        // TODO cache
        if (this._activeShader !== shader)
        {
            this._activeShader = shader;
            shader.bind();

            // automatically set the projection matrix
            shader.uniforms.projectionMatrix = this._activeRenderTarget.projectionMatrix.toArray(true);
        }

        return this;
    }

    /**
     * Binds the texture ... @mat
     *
     * @param {PIXI.Texture} texture - the new texture
     * @param {number} location - the texture location
     * @return {PIXI.WebGLRenderer} Returns itself.
     */
    bindTexture(texture, location = 0)
    {
        texture = texture.baseTexture || texture;

        const gl = this.gl;

        // TODO test perf of cache?

        if (this._activeTextureLocation !== location)//
        {
            this._activeTextureLocation = location;
            gl.activeTexture(gl.TEXTURE0 + location);
        }

        // TODO - can we cache this texture too?
        this._activeTexture = texture;

        if (!texture._glTextures[this.CONTEXT_UID])
        {
            // this will also bind the texture..
            this.textureManager.updateTexture(texture);
        }
        else
        {
            texture.touched = this.textureGC.count;
            // bind the current texture
            texture._glTextures[this.CONTEXT_UID].bind();
        }

        return this;
    }

    /**
     * Creates a new VAO from this renderer's context and state.
     *
     * @return {VertexArrayObject} The new VAO.
     */
    createVao()
    {
        return new glCore.VertexArrayObject(this.gl, this.state.attribState);
    }

    /**
     * Resets the WebGL state so you can render things however you fancy!
     *
     * @return {PIXI.WebGLRenderer} Returns itself.
     */
    reset()
    {
        this.setObjectRenderer(this.emptyRenderer);

        this._activeShader = null;
        this._activeRenderTarget = this.rootRenderTarget;
        this._activeTextureLocation = 999;
        this._activeTexture = null;

        // bind the main frame buffer (the screen);
        this.rootRenderTarget.activate();

        this.state.resetToDefault();

        return this;
    }

    /**
     * Handles a lost webgl context
     *
     * @private
     * @param {WebGLContextEvent} event - The context lost event.
     */
    handleContextLost(event)
    {
        event.preventDefault();
    }

    /**
     * Handles a restored webgl context
     *
     * @private
     */
    handleContextRestored()
    {
        this._initContext();
        this.textureManager.removeAll();
    }

    /**
     * Removes everything from the renderer (event listeners, spritebatch, etc...)
     *
     * @param {boolean} [removeView=false] - Removes the Canvas element from the DOM.
     *  See: https://github.com/pixijs/pixi.js/issues/2233
     */
    destroy(removeView)
    {
        this.destroyPlugins();

        // remove listeners
        this.view.removeEventListener('webglcontextlost', this.handleContextLost);
        this.view.removeEventListener('webglcontextrestored', this.handleContextRestored);

        this.textureManager.destroy();

        // call base destroy
        super.destroy(removeView);

        this.uid = 0;

        // destroy the managers
        this.maskManager.destroy();
        this.stencilManager.destroy();
        this.filterManager.destroy();

        this.maskManager = null;
        this.filterManager = null;
        this.textureManager = null;
        this.currentRenderer = null;

        this.handleContextLost = null;
        this.handleContextRestored = null;

        this._contextOptions = null;
        this.gl.useProgram(null);

        if (this.gl.getExtension('WEBGL_lose_context'))
        {
            this.gl.getExtension('WEBGL_lose_context').loseContext();
        }

        this.gl = null;

        // this = null;
    }
}

/**
 * The CanvasRenderer draws the scene and all its content onto a 2d canvas. This renderer should
 * be used for browsers that do not support WebGL. Don't forget to add the CanvasRenderer.view to
 * your DOM or you will not see anything :)
 *
 * @class
 * @memberof PIXI
 * @extends PIXI.SystemRenderer
 */
class CanvasRenderer extends SystemRenderer
{
    /**
     * @param {number} [width=800] - the width of the canvas view
     * @param {number} [height=600] - the height of the canvas view
     * @param {object} [options] - The optional renderer parameters
     * @param {HTMLCanvasElement} [options.view] - the canvas to use as a view, optional
     * @param {boolean} [options.transparent=false] - If the render view is transparent, default false
     * @param {boolean} [options.autoResize=false] - If the render view is automatically resized, default false
     * @param {boolean} [options.antialias=false] - sets antialias (only applicable in chrome at the moment)
     * @param {number} [options.resolution=1] - The resolution / device pixel ratio of the renderer. The
     *  resolution of the renderer retina would be 2.
     * @param {boolean} [options.clearBeforeRender=true] - This sets if the CanvasRenderer will clear the canvas or
     *      not before the new render pass.
     * @param {number} [options.backgroundColor=0x000000] - The background color of the rendered area
     *  (shown if not transparent).
     * @param {boolean} [options.roundPixels=false] - If true Pixi will Math.floor() x/y values when rendering,
     *  stopping pixel interpolation.
     */
    constructor(width, height, options = {})
    {
        super('Canvas', width, height, options);

        this.type = RENDERER_TYPE.CANVAS;

        /**
         * The canvas 2d context that everything is drawn with.
         *
         * @member {CanvasRenderingContext2D}
         */
        this.rootContext = this.view.getContext('2d', { alpha: this.transparent });

        /**
         * Boolean flag controlling canvas refresh.
         *
         * @member {boolean}
         */
        this.refresh = true;

        /**
         * Instance of a CanvasMaskManager, handles masking when using the canvas renderer.
         *
         * @member {PIXI.CanvasMaskManager}
         */
        this.maskManager = new CanvasMaskManager(this);

        /**
         * The canvas property used to set the canvas smoothing property.
         *
         * @member {string}
         */
        this.smoothProperty = 'imageSmoothingEnabled';

        if (!this.rootContext.imageSmoothingEnabled)
        {
            if (this.rootContext.webkitImageSmoothingEnabled)
            {
                this.smoothProperty = 'webkitImageSmoothingEnabled';
            }
            else if (this.rootContext.mozImageSmoothingEnabled)
            {
                this.smoothProperty = 'mozImageSmoothingEnabled';
            }
            else if (this.rootContext.oImageSmoothingEnabled)
            {
                this.smoothProperty = 'oImageSmoothingEnabled';
            }
            else if (this.rootContext.msImageSmoothingEnabled)
            {
                this.smoothProperty = 'msImageSmoothingEnabled';
            }
        }

        this.initPlugins();

        this.blendModes = mapCanvasBlendModesToPixi();
        this._activeBlendMode = null;

        this.context = null;
        this.renderingToScreen = false;

        this.resize(width, height);
    }

    /**
     * Renders the object to this canvas view
     *
     * @param {PIXI.DisplayObject} displayObject - The object to be rendered
     * @param {PIXI.RenderTexture} [renderTexture] - A render texture to be rendered to.
     *  If unset, it will render to the root context.
     * @param {boolean} [clear=false] - Whether to clear the canvas before drawing
     * @param {PIXI.Transform} [transform] - A transformation to be applied
     * @param {boolean} [skipUpdateTransform=false] - Whether to skip the update transform
     */
    render(displayObject, renderTexture, clear, transform, skipUpdateTransform)
    {
        if (!this.view)
        {
            return;
        }

        // can be handy to know!
        this.renderingToScreen = !renderTexture;

        this.emit('prerender');

        if (renderTexture)
        {
            renderTexture = renderTexture.baseTexture || renderTexture;

            if (!renderTexture._canvasRenderTarget)
            {
                renderTexture._canvasRenderTarget = new CanvasRenderTarget(
                    renderTexture.width,
                    renderTexture.height,
                    renderTexture.resolution
                );
                renderTexture.source = renderTexture._canvasRenderTarget.canvas;
                renderTexture.valid = true;
            }

            this.context = renderTexture._canvasRenderTarget.context;
            this.resolution = renderTexture._canvasRenderTarget.resolution;
        }
        else
        {
            this.context = this.rootContext;
        }

        const context = this.context;

        if (!renderTexture)
        {
            this._lastObjectRendered = displayObject;
        }

        if (!skipUpdateTransform)
        {
            // update the scene graph
            const cacheParent = displayObject.parent;
            const tempWt = this._tempDisplayObjectParent.transform.worldTransform;

            if (transform)
            {
                transform.copy(tempWt);
            }
            else
            {
                tempWt.identity();
            }

            displayObject.parent = this._tempDisplayObjectParent;
            displayObject.updateTransform();
            displayObject.parent = cacheParent;
            // displayObject.hitArea = //TODO add a temp hit area
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        context.globalCompositeOperation = this.blendModes[BLEND_MODES.NORMAL];

        if (navigator.isCocoonJS && this.view.screencanvas)
        {
            context.fillStyle = 'black';
            context.clear();
        }

        if (clear !== undefined ? clear : this.clearBeforeRender)
        {
            if (this.renderingToScreen)
            {
                if (this.transparent)
                {
                    context.clearRect(0, 0, this.width, this.height);
                }
                else
                {
                    context.fillStyle = this._backgroundColorString;
                    context.fillRect(0, 0, this.width, this.height);
                }
            } // else {
            // TODO: implement background for CanvasRenderTarget or RenderTexture?
            // }
        }

        // TODO RENDER TARGET STUFF HERE..
        const tempContext = this.context;

        this.context = context;
        displayObject.renderCanvas(this);
        this.context = tempContext;

        this.emit('postrender');
    }

    /**
     * Sets the blend mode of the renderer.
     *
     * @param {number} blendMode - See {@link PIXI.BLEND_MODES} for valid values.
     */
    setBlendMode(blendMode)
    {
        if (this._activeBlendMode === blendMode)
        {
            return;
        }

        this.context.globalCompositeOperation = this.blendModes[blendMode];
    }

    /**
     * Removes everything from the renderer and optionally removes the Canvas DOM element.
     *
     * @param {boolean} [removeView=false] - Removes the Canvas element from the DOM.
     */
    destroy(removeView)
    {
        this.destroyPlugins();

        // call the base destroy
        super.destroy(removeView);

        this.context = null;

        this.refresh = true;

        this.maskManager.destroy();
        this.maskManager = null;

        this.smoothProperty = null;
    }

    /**
     * Resizes the canvas view to the specified width and height.
     *
     * @extends PIXI.SystemRenderer#resize
     *
     * @param {number} width - The new width of the canvas view
     * @param {number} height - The new height of the canvas view
     */
    resize(width, height)
    {
        super.resize(width, height);

        // reset the scale mode.. oddly this seems to be reset when the canvas is resized.
        // surely a browser bug?? Let pixi fix that for you..
        if (this.smoothProperty)
        {
            this.rootContext[this.smoothProperty] = (SCALE_MODES.DEFAULT === SCALE_MODES.LINEAR);
        }
    }
}

/**
 * Holds all information related to an Interaction event
 *
 * @class
 * @memberof PIXI.interaction
 */
class InteractionData
{
    /**
     *
     */
    constructor()
    {
        /**
         * This point stores the global coords of where the touch/mouse event happened
         *
         * @member {PIXI.Point}
         */
        this.global = new core.Point();

        /**
         * The target Sprite that was interacted with
         *
         * @member {PIXI.Sprite}
         */
        this.target = null;

        /**
         * When passed to an event handler, this will be the original DOM Event that was captured
         *
         * @member {Event}
         */
        this.originalEvent = null;
    }

    /**
     * This will return the local coordinates of the specified displayObject for this InteractionData
     *
     * @param {PIXI.DisplayObject} displayObject - The DisplayObject that you would like the local
     *  coords off
     * @param {PIXI.Point} [point] - A Point object in which to store the value, optional (otherwise
     *  will create a new point)
     * @param {PIXI.Point} [globalPos] - A Point object containing your custom global coords, optional
     *  (otherwise will use the current global coords)
     * @return {PIXI.Point} A point containing the coordinates of the InteractionData position relative
     *  to the DisplayObject
     */
    getLocalPosition(displayObject, point, globalPos)
    {
        return displayObject.worldTransform.applyInverse(globalPos || this.global, point);
    }
}

/**
 * Event class that mimics native DOM events.
 *
 * @class
 * @memberof PIXI.interaction
 */
class InteractionEvent
{
    /**
     *
     */
    constructor()
    {
        /**
         * Which this event will continue propagating in the tree
         *
         * @member {boolean}
         */
        this.stopped = false;

        /**
         * The object to which event is dispatched.
         *
         * @member {PIXI.DisplayObject}
         */
        this.target = null;

        /**
         * The object whose event listener’s callback is currently being invoked.
         *
         * @member {PIXI.DisplayObject}
         */
        this.currentTarget = null;

        /*
         * Type of the event
         *
         * @member {string}
         */
        this.type = null;

        /*
         * InteractionData related to this event
         *
         * @member {PIXI.interaction.InteractionData}
         */
        this.data = null;
    }

    /**
     * Prevents event from reaching any objects other than the current object.
     *
     */
    stopPropagation()
    {
        this.stopped = true;
    }

    /**
     * Prevents event from reaching any objects other than the current object.
     *
     * @private
     */
    _reset()
    {
        this.stopped = false;
        this.currentTarget = null;
        this.target = null;
    }
}


// Mix interactiveTarget into DisplayObject.prototype
Object.assign(
    DisplayObject.prototype,
    interactiveTarget
);

/**
 * The interaction manager deals with mouse and touch events. Any DisplayObject can be interactive
 * if its interactive parameter is set to true
 * This manager also supports multitouch.
 *
 * @class
 * @extends EventEmitter
 * @memberof PIXI.interaction
 */
class InteractionManager extends EventEmitter
{
    /**
     * @param {PIXI.CanvasRenderer|PIXI.WebGLRenderer} renderer - A reference to the current renderer
     * @param {object} [options] - The options for the manager.
     * @param {boolean} [options.autoPreventDefault=true] - Should the manager automatically prevent default browser actions.
     * @param {number} [options.interactionFrequency=10] - Frequency increases the interaction events will be checked.
     */
    constructor(renderer, options)
    {
        super();

        options = options || {};

        /**
         * The renderer this interaction manager works for.
         *
         * @member {PIXI.SystemRenderer}
         */
        this.renderer = renderer;

        /**
         * Should default browser actions automatically be prevented.
         *
         * @member {boolean}
         * @default true
         */
        this.autoPreventDefault = options.autoPreventDefault !== undefined ? options.autoPreventDefault : true;

        /**
         * As this frequency increases the interaction events will be checked more often.
         *
         * @member {number}
         * @default 10
         */
        this.interactionFrequency = options.interactionFrequency || 10;

        /**
         * The mouse data
         *
         * @member {PIXI.interaction.InteractionData}
         */
        this.mouse = new InteractionData();

        // setting the mouse to start off far off screen will mean that mouse over does
        //  not get called before we even move the mouse.
        this.mouse.global.set(-999999);

        /**
         * The pointer data
         *
         * @member {PIXI.interaction.InteractionData}
         */
        this.pointer = new InteractionData();

        // setting the pointer to start off far off screen will mean that pointer over does
        //  not get called before we even move the pointer.
        this.pointer.global.set(-999999);

        /**
         * An event data object to handle all the event tracking/dispatching
         *
         * @member {object}
         */
        this.eventData = new InteractionEvent();

        /**
         * Tiny little interactiveData pool !
         *
         * @member {PIXI.interaction.InteractionData[]}
         */
        this.interactiveDataPool = [];

        /**
         * The DOM element to bind to.
         *
         * @private
         * @member {HTMLElement}
         */
        this.interactionDOMElement = null;

        /**
         * This property determins if mousemove and touchmove events are fired only when the cursror
         * is over the object.
         * Setting to true will make things work more in line with how the DOM verison works.
         * Setting to false can make things easier for things like dragging
         * It is currently set to false as this is how pixi used to work. This will be set to true in
         * future versions of pixi.
         *
         * @private
         * @member {boolean}
         */
        this.moveWhenInside = false;

        /**
         * Have events been attached to the dom element?
         *
         * @private
         * @member {boolean}
         */
        this.eventsAdded = false;

        /**
         * Is the mouse hovering over the renderer?
         *
         * @private
         * @member {boolean}
         */
        this.mouseOverRenderer = false;

        /**
         * Does the device support touch events
         * https://www.w3.org/TR/touch-events/
         *
         * @readonly
         * @member {boolean}
         */
        this.supportsTouchEvents = 'ontouchstart' in window;

        /**
         * Does the device support pointer events
         * https://www.w3.org/Submission/pointer-events/
         *
         * @readonly
         * @member {boolean}
         */
        this.supportsPointerEvents = !!window.PointerEvent;

        /**
         * Are touch events being 'normalized' and converted into pointer events if pointer events are not supported
         * For example, on a touch screen mobile device, a touchstart would also be emitted as a pointerdown
         *
         * @private
         * @readonly
         * @member {boolean}
         */
        this.normalizeTouchEvents = !this.supportsPointerEvents && this.supportsTouchEvents;

        /**
         * Are mouse events being 'normalized' and converted into pointer events if pointer events are not supported
         * For example, on a desktop pc, a mousedown would also be emitted as a pointerdown
         *
         * @private
         * @readonly
         * @member {boolean}
         */
        this.normalizeMouseEvents = !this.supportsPointerEvents && !MobileDevice.any;

        // this will make it so that you don't have to call bind all the time

        /**
         * @private
         * @member {Function}
         */
        this.onMouseUp = this.onMouseUp.bind(this);
        this.processMouseUp = this.processMouseUp.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onMouseDown = this.onMouseDown.bind(this);
        this.processMouseDown = this.processMouseDown.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onMouseMove = this.onMouseMove.bind(this);
        this.processMouseMove = this.processMouseMove.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onMouseOut = this.onMouseOut.bind(this);
        this.processMouseOverOut = this.processMouseOverOut.bind(this);

        /**
        * @private
        * @member {Function}
        */
        this.onMouseOver = this.onMouseOver.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onPointerUp = this.onPointerUp.bind(this);
        this.processPointerUp = this.processPointerUp.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onPointerDown = this.onPointerDown.bind(this);
        this.processPointerDown = this.processPointerDown.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onPointerMove = this.onPointerMove.bind(this);
        this.processPointerMove = this.processPointerMove.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onPointerOut = this.onPointerOut.bind(this);
        this.processPointerOverOut = this.processPointerOverOut.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onPointerOver = this.onPointerOver.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onTouchStart = this.onTouchStart.bind(this);
        this.processTouchStart = this.processTouchStart.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.processTouchEnd = this.processTouchEnd.bind(this);

        /**
         * @private
         * @member {Function}
         */
        this.onTouchMove = this.onTouchMove.bind(this);
        this.processTouchMove = this.processTouchMove.bind(this);

        /**
         * Every update cursor will be reset to this value, if some element wont override it in
         * its hitTest.
         *
         * @member {string}
         * @default 'inherit'
         */
        this.defaultCursorStyle = 'inherit';

        /**
         * The css style of the cursor that is being used.
         *
         * @member {string}
         */
        this.currentCursorStyle = 'inherit';

        /**
         * Internal cached let.
         *
         * @private
         * @member {PIXI.Point}
         */
        this._tempPoint = new Point();

        /**
         * The current resolution / device pixel ratio.
         *
         * @member {number}
         * @default 1
         */
        this.resolution = 1;

        this.setTargetElement(this.renderer.view, this.renderer.resolution);

        /**
         * Fired when a pointer device button (usually a mouse button) is pressed on the display
         * object.
         *
         * @event mousedown
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is pressed
         * on the display object.
         *
         * @event rightdown
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device button (usually a mouse button) is released over the display
         * object.
         *
         * @event mouseup
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is released
         * over the display object.
         *
         * @event rightup
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device button (usually a mouse button) is pressed and released on
         * the display object.
         *
         * @event click
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is pressed
         * and released on the display object.
         *
         * @event rightclick
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device button (usually a mouse button) is released outside the
         * display object that initially registered a
         * [mousedown]{@link PIXI.interaction.InteractionManager#event:mousedown}.
         *
         * @event mouseupoutside
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is released
         * outside the display object that initially registered a
         * [rightdown]{@link PIXI.interaction.InteractionManager#event:rightdown}.
         *
         * @event rightupoutside
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device (usually a mouse) is moved while over the display object
         *
         * @event mousemove
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device (usually a mouse) is moved onto the display object
         *
         * @event mouseover
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device (usually a mouse) is moved off the display object
         *
         * @event mouseout
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device button is pressed on the display object.
         *
         * @event pointerdown
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device button is released over the display object.
         *
         * @event pointerup
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device button is pressed and released on the display object.
         *
         * @event pointertap
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device button is released outside the display object that initially
         * registered a [pointerdown]{@link PIXI.interaction.InteractionManager#event:pointerdown}.
         *
         * @event pointerupoutside
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device is moved while over the display object
         *
         * @event pointermove
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device is moved onto the display object
         *
         * @event pointerover
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a pointer device is moved off the display object
         *
         * @event pointerout
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a touch point is placed on the display object.
         *
         * @event touchstart
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a touch point is removed from the display object.
         *
         * @event touchend
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a touch point is placed and removed from the display object.
         *
         * @event tap
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a touch point is removed outside of the display object that initially
         * registered a [touchstart]{@link PIXI.interaction.InteractionManager#event:touchstart}.
         *
         * @event touchendoutside
         * @memberof PIXI.interaction.InteractionManager#
         */

        /**
         * Fired when a touch point is moved along the display object.
         *
         * @event touchmove
         * @memberof PIXI.interaction.InteractionManager#
         */
    }

    /**
     * Sets the DOM element which will receive mouse/touch events. This is useful for when you have
     * other DOM elements on top of the renderers Canvas element. With this you'll be bale to deletegate
     * another DOM element to receive those events.
     *
     * @param {HTMLCanvasElement} element - the DOM element which will receive mouse and touch events.
     * @param {number} [resolution=1] - The resolution / device pixel ratio of the new element (relative to the canvas).
     * @private
     */
    setTargetElement(element, resolution = 1)
    {
        this.removeEvents();

        this.interactionDOMElement = element;

        this.resolution = resolution;

        this.addEvents();
    }

    /**
     * Registers all the DOM events
     *
     * @private
     */
    addEvents()
    {
        if (!this.interactionDOMElement)
        {
            return;
        }

        ticker.shared.add(this.update, this);

        if (window.navigator.msPointerEnabled)
        {
            this.interactionDOMElement.style['-ms-content-zooming'] = 'none';
            this.interactionDOMElement.style['-ms-touch-action'] = 'none';
        }
        else if (this.supportsPointerEvents)
        {
            this.interactionDOMElement.style['touch-action'] = 'none';
        }

        window.document.addEventListener('mousemove', this.onMouseMove, true);
        this.interactionDOMElement.addEventListener('mousedown', this.onMouseDown, true);
        this.interactionDOMElement.addEventListener('mouseout', this.onMouseOut, true);
        this.interactionDOMElement.addEventListener('mouseover', this.onMouseOver, true);
        window.addEventListener('mouseup', this.onMouseUp, true);

        if (this.supportsTouchEvents)
        {
            this.interactionDOMElement.addEventListener('touchstart', this.onTouchStart, true);
            this.interactionDOMElement.addEventListener('touchend', this.onTouchEnd, true);
            this.interactionDOMElement.addEventListener('touchmove', this.onTouchMove, true);
        }

        if (this.supportsPointerEvents)
        {
            window.document.addEventListener('pointermove', this.onPointerMove, true);
            this.interactionDOMElement.addEventListener('pointerdown', this.onPointerDown, true);
            this.interactionDOMElement.addEventListener('pointerout', this.onPointerOut, true);
            this.interactionDOMElement.addEventListener('pointerover', this.onPointerOver, true);
            window.addEventListener('pointerup', this.onPointerUp, true);
        }
        else
        {
            /**
             * If pointer events aren't available on a device, this will turn either the touch or
             * mouse events into pointer events. This allows a developer to just listen for emitted
             * pointer events on interactive sprites
             */
            if (this.normalizeTouchEvents)
            {
                this.interactionDOMElement.addEventListener('touchstart', this.onPointerDown, true);
                this.interactionDOMElement.addEventListener('touchend', this.onPointerUp, true);
                this.interactionDOMElement.addEventListener('touchmove', this.onPointerMove, true);
            }

            if (this.normalizeMouseEvents)
            {
                window.document.addEventListener('mousemove', this.onPointerMove, true);
                this.interactionDOMElement.addEventListener('mousedown', this.onPointerDown, true);
                this.interactionDOMElement.addEventListener('mouseout', this.onPointerOut, true);
                this.interactionDOMElement.addEventListener('mouseover', this.onPointerOver, true);
                window.addEventListener('mouseup', this.onPointerUp, true);
            }
        }

        this.eventsAdded = true;
    }

    /**
     * Removes all the DOM events that were previously registered
     *
     * @private
     */
    removeEvents()
    {
        if (!this.interactionDOMElement)
        {
            return;
        }

        ticker.shared.remove(this.update);

        if (window.navigator.msPointerEnabled)
        {
            this.interactionDOMElement.style['-ms-content-zooming'] = '';
            this.interactionDOMElement.style['-ms-touch-action'] = '';
        }
        else if (this.supportsPointerEvents)
        {
            this.interactionDOMElement.style['touch-action'] = '';
        }

        window.document.removeEventListener('mousemove', this.onMouseMove, true);
        this.interactionDOMElement.removeEventListener('mousedown', this.onMouseDown, true);
        this.interactionDOMElement.removeEventListener('mouseout', this.onMouseOut, true);
        this.interactionDOMElement.removeEventListener('mouseover', this.onMouseOver, true);
        window.removeEventListener('mouseup', this.onMouseUp, true);

        if (this.supportsTouchEvents)
        {
            this.interactionDOMElement.removeEventListener('touchstart', this.onTouchStart, true);
            this.interactionDOMElement.removeEventListener('touchend', this.onTouchEnd, true);
            this.interactionDOMElement.removeEventListener('touchmove', this.onTouchMove, true);
        }

        if (this.supportsPointerEvents)
        {
            window.document.removeEventListener('pointermove', this.onPointerMove, true);
            this.interactionDOMElement.removeEventListener('pointerdown', this.onPointerDown, true);
            this.interactionDOMElement.removeEventListener('pointerout', this.onPointerOut, true);
            this.interactionDOMElement.removeEventListener('pointerover', this.onPointerOver, true);
            window.removeEventListener('pointerup', this.onPointerUp, true);
        }
        else
        {
            /**
             * If pointer events aren't available on a device, this will turn either the touch or
             * mouse events into pointer events. This allows a developer to just listen for emitted
             * pointer events on interactive sprites
             */
            if (this.normalizeTouchEvents)
            {
                this.interactionDOMElement.removeEventListener('touchstart', this.onPointerDown, true);
                this.interactionDOMElement.removeEventListener('touchend', this.onPointerUp, true);
                this.interactionDOMElement.removeEventListener('touchmove', this.onPointerMove, true);
            }

            if (this.normalizeMouseEvents)
            {
                window.document.removeEventListener('mousemove', this.onPointerMove, true);
                this.interactionDOMElement.removeEventListener('mousedown', this.onPointerDown, true);
                this.interactionDOMElement.removeEventListener('mouseout', this.onPointerOut, true);
                window.removeEventListener('mouseup', this.onPointerUp, true);
            }
        }

        this.interactionDOMElement = null;

        this.eventsAdded = false;
    }

    /**
     * Updates the state of interactive objects.
     * Invoked by a throttled ticker update from {@link PIXI.ticker.shared}.
     *
     * @param {number} deltaTime - time delta since last tick
     */
    update(deltaTime)
    {
        this._deltaTime += deltaTime;

        if (this._deltaTime < this.interactionFrequency)
        {
            return;
        }

        this._deltaTime = 0;

        if (!this.interactionDOMElement)
        {
            return;
        }

        // if the user move the mouse this check has already been dfone using the mouse move!
        if (this.didMove)
        {
            this.didMove = false;

            return;
        }

        this.cursor = this.defaultCursorStyle;

        // Resets the flag as set by a stopPropagation call. This flag is usually reset by a user interaction of any kind,
        // but there was a scenario of a display object moving under a static mouse cursor.
        // In this case, mouseover and mouseevents would not pass the flag test in dispatchEvent function
        this.eventData._reset();

        this.processInteractive(this.mouse.global, this.renderer._lastObjectRendered, this.processMouseOverOut, true);

        if (this.currentCursorStyle !== this.cursor)
        {
            this.currentCursorStyle = this.cursor;
            this.interactionDOMElement.style.cursor = this.cursor;
        }

        // TODO
    }

    /**
     * Dispatches an event on the display object that was interacted with
     *
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - the display object in question
     * @param {string} eventString - the name of the event (e.g, mousedown)
     * @param {object} eventData - the event data object
     * @private
     */
    dispatchEvent(displayObject, eventString, eventData)
    {
        if (!eventData.stopped)
        {
            eventData.currentTarget = displayObject;
            eventData.type = eventString;

            displayObject.emit(eventString, eventData);

            if (displayObject[eventString])
            {
                displayObject[eventString](eventData);
            }
        }
    }

    /**
     * Maps x and y coords from a DOM object and maps them correctly to the pixi view. The
     * resulting value is stored in the point. This takes into account the fact that the DOM
     * element could be scaled and positioned anywhere on the screen.
     *
     * @param  {PIXI.Point} point - the point that the result will be stored in
     * @param  {number} x - the x coord of the position to map
     * @param  {number} y - the y coord of the position to map
     */
    mapPositionToPoint(point, x, y)
    {
        let rect;

        // IE 11 fix
        if (!this.interactionDOMElement.parentElement)
        {
            rect = { x: 0, y: 0, width: 0, height: 0 };
        }
        else
        {
            rect = this.interactionDOMElement.getBoundingClientRect();
        }

        point.x = ((x - rect.left) * (this.interactionDOMElement.width / rect.width)) / this.resolution;
        point.y = ((y - rect.top) * (this.interactionDOMElement.height / rect.height)) / this.resolution;
    }

    /**
     * This function is provides a neat way of crawling through the scene graph and running a
     * specified function on all interactive objects it finds. It will also take care of hit
     * testing the interactive objects and passes the hit across in the function.
     *
     * @param {PIXI.Point} point - the point that is tested for collision
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - the displayObject
     *  that will be hit test (recurcsivly crawls its children)
     * @param {Function} [func] - the function that will be called on each interactive object. The
     *  displayObject and hit will be passed to the function
     * @param {boolean} [hitTest] - this indicates if the objects inside should be hit test against the point
     * @param {boolean} [interactive] - Whether the displayObject is interactive
     * @return {boolean} returns true if the displayObject hit the point
     */
    processInteractive(point, displayObject, func, hitTest, interactive)
    {
        if (!displayObject || !displayObject.visible)
        {
            return false;
        }

        // Took a little while to rework this function correctly! But now it is done and nice and optimised. ^_^
        //
        // This function will now loop through all objects and then only hit test the objects it HAS
        // to, not all of them. MUCH faster..
        // An object will be hit test if the following is true:
        //
        // 1: It is interactive.
        // 2: It belongs to a parent that is interactive AND one of the parents children have not already been hit.
        //
        // As another little optimisation once an interactive object has been hit we can carry on
        // through the scenegraph, but we know that there will be no more hits! So we can avoid extra hit tests
        // A final optimisation is that an object is not hit test directly if a child has already been hit.

        interactive = displayObject.interactive || interactive;

        let hit = false;
        let interactiveParent = interactive;

        // if the displayobject has a hitArea, then it does not need to hitTest children.
        if (displayObject.hitArea)
        {
            interactiveParent = false;
        }

        // it has a mask! Then lets hit test that before continuing..
        if (hitTest && displayObject._mask)
        {
            if (!displayObject._mask.containsPoint(point))
            {
                hitTest = false;
            }
        }

        // it has a filterArea! Same as mask but easier, its a rectangle
        if (hitTest && displayObject.filterArea)
        {
            if (!displayObject.filterArea.contains(point.x, point.y))
            {
                hitTest = false;
            }
        }

        // ** FREE TIP **! If an object is not interactive or has no buttons in it
        // (such as a game scene!) set interactiveChildren to false for that displayObject.
        // This will allow pixi to completly ignore and bypass checking the displayObjects children.
        if (displayObject.interactiveChildren)
        {
            const children = displayObject.children;

            for (let i = children.length - 1; i >= 0; i--)
            {
                const child = children[i];

                // time to get recursive.. if this function will return if somthing is hit..
                if (this.processInteractive(point, child, func, hitTest, interactiveParent))
                {
                    // its a good idea to check if a child has lost its parent.
                    // this means it has been removed whilst looping so its best
                    if (!child.parent)
                    {
                        continue;
                    }

                    hit = true;

                    // we no longer need to hit test any more objects in this container as we we
                    // now know the parent has been hit
                    interactiveParent = false;

                    // If the child is interactive , that means that the object hit was actually
                    // interactive and not just the child of an interactive object.
                    // This means we no longer need to hit test anything else. We still need to run
                    // through all objects, but we don't need to perform any hit tests.

                    // {
                    hitTest = false;
                    // }

                    // we can break now as we have hit an object.
                }
            }
        }

        // no point running this if the item is not interactive or does not have an interactive parent.
        if (interactive)
        {
            // if we are hit testing (as in we have no hit any objects yet)
            // We also don't need to worry about hit testing if once of the displayObjects children
            // has already been hit!
            if (hitTest && !hit)
            {
                if (displayObject.hitArea)
                {
                    displayObject.worldTransform.applyInverse(point, this._tempPoint);
                    hit = displayObject.hitArea.contains(this._tempPoint.x, this._tempPoint.y);
                }
                else if (displayObject.containsPoint)
                {
                    hit = displayObject.containsPoint(point);
                }
            }

            if (displayObject.interactive)
            {
                if (hit && !this.eventData.target)
                {
                    this.eventData.target = displayObject;
                    this.mouse.target = displayObject;
                    this.pointer.target = displayObject;
                }

                func(displayObject, hit);
            }
        }

        return hit;
    }

    /**
     * Is called when the mouse button is pressed down on the renderer element
     *
     * @private
     * @param {MouseEvent} event - The DOM event of a mouse button being pressed down
     */
    onMouseDown(event)
    {
        this.mouse.originalEvent = event;
        this.eventData.data = this.mouse;
        this.eventData._reset();

        // Update internal mouse reference
        this.mapPositionToPoint(this.mouse.global, event.clientX, event.clientY);

        if (this.autoPreventDefault)
        {
            this.mouse.originalEvent.preventDefault();
        }

        this.processInteractive(this.mouse.global, this.renderer._lastObjectRendered, this.processMouseDown, true);

        const isRightButton = event.button === 2 || event.which === 3;

        this.emit(isRightButton ? 'rightdown' : 'mousedown', this.eventData);
    }

    /**
     * Processes the result of the mouse down check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processMouseDown(displayObject, hit)
    {
        const e = this.mouse.originalEvent;

        const isRightButton = e.button === 2 || e.which === 3;

        if (hit)
        {
            displayObject[isRightButton ? '_isRightDown' : '_isLeftDown'] = true;
            this.dispatchEvent(displayObject, isRightButton ? 'rightdown' : 'mousedown', this.eventData);
        }
    }

    /**
     * Is called when the mouse button is released on the renderer element
     *
     * @private
     * @param {MouseEvent} event - The DOM event of a mouse button being released
     */
    onMouseUp(event)
    {
        this.mouse.originalEvent = event;
        this.eventData.data = this.mouse;
        this.eventData._reset();

        // Update internal mouse reference
        this.mapPositionToPoint(this.mouse.global, event.clientX, event.clientY);

        this.processInteractive(this.mouse.global, this.renderer._lastObjectRendered, this.processMouseUp, true);

        const isRightButton = event.button === 2 || event.which === 3;

        this.emit(isRightButton ? 'rightup' : 'mouseup', this.eventData);
    }

    /**
     * Processes the result of the mouse up check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processMouseUp(displayObject, hit)
    {
        const e = this.mouse.originalEvent;

        const isRightButton = e.button === 2 || e.which === 3;
        const isDown = isRightButton ? '_isRightDown' : '_isLeftDown';

        if (hit)
        {
            this.dispatchEvent(displayObject, isRightButton ? 'rightup' : 'mouseup', this.eventData);

            if (displayObject[isDown])
            {
                displayObject[isDown] = false;
                this.dispatchEvent(displayObject, isRightButton ? 'rightclick' : 'click', this.eventData);
            }
        }
        else if (displayObject[isDown])
        {
            displayObject[isDown] = false;
            this.dispatchEvent(displayObject, isRightButton ? 'rightupoutside' : 'mouseupoutside', this.eventData);
        }
    }

    /**
     * Is called when the mouse moves across the renderer element
     *
     * @private
     * @param {MouseEvent} event - The DOM event of the mouse moving
     */
    onMouseMove(event)
    {
        this.mouse.originalEvent = event;
        this.eventData.data = this.mouse;
        this.eventData._reset();

        this.mapPositionToPoint(this.mouse.global, event.clientX, event.clientY);

        this.didMove = true;

        this.cursor = this.defaultCursorStyle;

        this.processInteractive(this.mouse.global, this.renderer._lastObjectRendered, this.processMouseMove, true);

        this.emit('mousemove', this.eventData);

        if (this.currentCursorStyle !== this.cursor)
        {
            this.currentCursorStyle = this.cursor;
            this.interactionDOMElement.style.cursor = this.cursor;
        }

        // TODO BUG for parents ineractive object (border order issue)
    }

    /**
     * Processes the result of the mouse move check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processMouseMove(displayObject, hit)
    {
        this.processMouseOverOut(displayObject, hit);

        // only display on mouse over
        if (!this.moveWhenInside || hit)
        {
            this.dispatchEvent(displayObject, 'mousemove', this.eventData);
        }
    }

    /**
     * Is called when the mouse is moved out of the renderer element
     *
     * @private
     * @param {MouseEvent} event - The DOM event of the mouse being moved out
     */
    onMouseOut(event)
    {
        this.mouseOverRenderer = false;

        this.mouse.originalEvent = event;
        this.eventData.data = this.mouse;
        this.eventData._reset();

        // Update internal mouse reference
        this.mapPositionToPoint(this.mouse.global, event.clientX, event.clientY);

        this.interactionDOMElement.style.cursor = this.defaultCursorStyle;

        // TODO optimize by not check EVERY TIME! maybe half as often? //
        this.mapPositionToPoint(this.mouse.global, event.clientX, event.clientY);

        this.processInteractive(this.mouse.global, this.renderer._lastObjectRendered, this.processMouseOverOut, false);

        this.emit('mouseout', this.eventData);
    }

    /**
     * Processes the result of the mouse over/out check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processMouseOverOut(displayObject, hit)
    {
        if (hit && this.mouseOverRenderer)
        {
            if (!displayObject._mouseOver)
            {
                displayObject._mouseOver = true;
                this.dispatchEvent(displayObject, 'mouseover', this.eventData);
            }

            if (displayObject.buttonMode)
            {
                this.cursor = displayObject.defaultCursor;
            }
        }
        else if (displayObject._mouseOver)
        {
            displayObject._mouseOver = false;
            this.dispatchEvent(displayObject, 'mouseout', this.eventData);
        }
    }

    /**
     * Is called when the mouse enters the renderer element area
     *
     * @private
     * @param {MouseEvent} event - The DOM event of the mouse moving into the renderer view
     */
    onMouseOver(event)
    {
        this.mouseOverRenderer = true;

        this.mouse.originalEvent = event;
        this.eventData.data = this.mouse;
        this.eventData._reset();

        this.emit('mouseover', this.eventData);
    }

    /**
     * Is called when the pointer button is pressed down on the renderer element
     *
     * @private
     * @param {PointerEvent} event - The DOM event of a pointer button being pressed down
     */
    onPointerDown(event)
    {
        this.normalizeToPointerData(event);
        this.pointer.originalEvent = event;
        this.eventData.data = this.pointer;
        this.eventData._reset();

        // Update internal pointer reference
        this.mapPositionToPoint(this.pointer.global, event.clientX, event.clientY);

        if (this.autoPreventDefault)
        {
            this.pointer.originalEvent.preventDefault();
        }

        this.processInteractive(this.pointer.global, this.renderer._lastObjectRendered, this.processPointerDown, true);

        this.emit('pointerdown', this.eventData);
    }

    /**
     * Processes the result of the pointer down check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processPointerDown(displayObject, hit)
    {
        if (hit)
        {
            displayObject._pointerDown = true;
            this.dispatchEvent(displayObject, 'pointerdown', this.eventData);
        }
    }

    /**
     * Is called when the pointer button is released on the renderer element
     *
     * @private
     * @param {PointerEvent} event - The DOM event of a pointer button being released
     */
    onPointerUp(event)
    {
        this.normalizeToPointerData(event);
        this.pointer.originalEvent = event;
        this.eventData.data = this.pointer;
        this.eventData._reset();

        // Update internal pointer reference
        this.mapPositionToPoint(this.pointer.global, event.clientX, event.clientY);

        this.processInteractive(this.pointer.global, this.renderer._lastObjectRendered, this.processPointerUp, true);

        this.emit('pointerup', this.eventData);
    }

    /**
     * Processes the result of the pointer up check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processPointerUp(displayObject, hit)
    {
        if (hit)
        {
            this.dispatchEvent(displayObject, 'pointerup', this.eventData);

            if (displayObject._pointerDown)
            {
                displayObject._pointerDown = false;
                this.dispatchEvent(displayObject, 'pointertap', this.eventData);
            }
        }
        else if (displayObject._pointerDown)
        {
            displayObject._pointerDown = false;
            this.dispatchEvent(displayObject, 'pointerupoutside', this.eventData);
        }
    }

    /**
     * Is called when the pointer moves across the renderer element
     *
     * @private
     * @param {PointerEvent} event - The DOM event of a pointer moving
     */
    onPointerMove(event)
    {
        this.normalizeToPointerData(event);
        this.pointer.originalEvent = event;
        this.eventData.data = this.pointer;
        this.eventData._reset();

        this.mapPositionToPoint(this.pointer.global, event.clientX, event.clientY);

        this.processInteractive(this.pointer.global, this.renderer._lastObjectRendered, this.processPointerMove, true);

        this.emit('pointermove', this.eventData);
    }

    /**
     * Processes the result of the pointer move check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processPointerMove(displayObject, hit)
    {
        if (!this.pointer.originalEvent.changedTouches)
        {
            this.processPointerOverOut(displayObject, hit);
        }

        if (!this.moveWhenInside || hit)
        {
            this.dispatchEvent(displayObject, 'pointermove', this.eventData);
        }
    }

    /**
     * Is called when the pointer is moved out of the renderer element
     *
     * @private
     * @param {PointerEvent} event - The DOM event of a pointer being moved out
     */
    onPointerOut(event)
    {
        this.normalizeToPointerData(event);
        this.pointer.originalEvent = event;
        this.eventData.data = this.pointer;
        this.eventData._reset();

        // Update internal pointer reference
        this.mapPositionToPoint(this.pointer.global, event.clientX, event.clientY);

        this.processInteractive(this.pointer.global, this.renderer._lastObjectRendered, this.processPointerOverOut, false);

        this.emit('pointerout', this.eventData);
    }

    /**
     * Processes the result of the pointer over/out check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processPointerOverOut(displayObject, hit)
    {
        if (hit && this.mouseOverRenderer)
        {
            if (!displayObject._pointerOver)
            {
                displayObject._pointerOver = true;
                this.dispatchEvent(displayObject, 'pointerover', this.eventData);
            }
        }
        else if (displayObject._pointerOver)
        {
            displayObject._pointerOver = false;
            this.dispatchEvent(displayObject, 'pointerout', this.eventData);
        }
    }

    /**
     * Is called when the pointer is moved into the renderer element
     *
     * @private
     * @param {PointerEvent} event - The DOM event of a pointer button being moved into the renderer view
     */
    onPointerOver(event)
    {
        this.pointer.originalEvent = event;
        this.eventData.data = this.pointer;
        this.eventData._reset();

        this.emit('pointerover', this.eventData);
    }

    /**
     * Is called when a touch is started on the renderer element
     *
     * @private
     * @param {TouchEvent} event - The DOM event of a touch starting on the renderer view
     */
    onTouchStart(event)
    {
        if (this.autoPreventDefault)
        {
            event.preventDefault();
        }

        const changedTouches = event.changedTouches;
        const cLength = changedTouches.length;

        for (let i = 0; i < cLength; i++)
        {
            const touch = changedTouches[i];
            const touchData = this.getTouchData(touch);

            touchData.originalEvent = event;

            this.eventData.data = touchData;
            this.eventData._reset();

            this.processInteractive(touchData.global, this.renderer._lastObjectRendered, this.processTouchStart, true);

            this.emit('touchstart', this.eventData);

            this.returnTouchData(touchData);
        }
    }

    /**
     * Processes the result of a touch check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processTouchStart(displayObject, hit)
    {
        if (hit)
        {
            displayObject._touchDown = true;
            this.dispatchEvent(displayObject, 'touchstart', this.eventData);
        }
    }

    /**
     * Is called when a touch ends on the renderer element
     *
     * @private
     * @param {TouchEvent} event - The DOM event of a touch ending on the renderer view
     */
    onTouchEnd(event)
    {
        if (this.autoPreventDefault)
        {
            event.preventDefault();
        }

        const changedTouches = event.changedTouches;
        const cLength = changedTouches.length;

        for (let i = 0; i < cLength; i++)
        {
            const touchEvent = changedTouches[i];

            const touchData = this.getTouchData(touchEvent);

            touchData.originalEvent = event;

            // TODO this should be passed along.. no set
            this.eventData.data = touchData;
            this.eventData._reset();

            this.processInteractive(touchData.global, this.renderer._lastObjectRendered, this.processTouchEnd, true);

            this.emit('touchend', this.eventData);

            this.returnTouchData(touchData);
        }
    }

    /**
     * Processes the result of the end of a touch and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processTouchEnd(displayObject, hit)
    {
        if (hit)
        {
            this.dispatchEvent(displayObject, 'touchend', this.eventData);

            if (displayObject._touchDown)
            {
                displayObject._touchDown = false;
                this.dispatchEvent(displayObject, 'tap', this.eventData);
            }
        }
        else if (displayObject._touchDown)
        {
            displayObject._touchDown = false;
            this.dispatchEvent(displayObject, 'touchendoutside', this.eventData);
        }
    }

    /**
     * Is called when a touch is moved across the renderer element
     *
     * @private
     * @param {TouchEvent} event - The DOM event of a touch moving accross the renderer view
     */
    onTouchMove(event)
    {
        if (this.autoPreventDefault)
        {
            event.preventDefault();
        }

        const changedTouches = event.changedTouches;
        const cLength = changedTouches.length;

        for (let i = 0; i < cLength; i++)
        {
            const touchEvent = changedTouches[i];

            const touchData = this.getTouchData(touchEvent);

            touchData.originalEvent = event;

            this.eventData.data = touchData;
            this.eventData._reset();

            this.processInteractive(
                touchData.global,
                this.renderer._lastObjectRendered,
                this.processTouchMove,
                this.moveWhenInside
            );

            this.emit('touchmove', this.eventData);

            this.returnTouchData(touchData);
        }
    }

    /**
     * Processes the result of a touch move check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.Container|PIXI.Sprite|PIXI.extras.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    processTouchMove(displayObject, hit)
    {
        if (!this.moveWhenInside || hit)
        {
            this.dispatchEvent(displayObject, 'touchmove', this.eventData);
        }
    }

    /**
     * Grabs an interaction data object from the internal pool
     *
     * @private
     * @param {Touch} touch - The touch data we need to pair with an interactionData object
     * @return {PIXI.interaction.InteractionData} The built data object.
     */
    getTouchData(touch)
    {
        const touchData = this.interactiveDataPool.pop() || new InteractionData();

        touchData.identifier = touch.identifier;
        this.mapPositionToPoint(touchData.global, touch.clientX, touch.clientY);

        if (navigator.isCocoonJS)
        {
            touchData.global.x = touchData.global.x / this.resolution;
            touchData.global.y = touchData.global.y / this.resolution;
        }

        touch.globalX = touchData.global.x;
        touch.globalY = touchData.global.y;

        return touchData;
    }

    /**
     * Returns an interaction data object to the internal pool
     *
     * @private
     * @param {PIXI.interaction.InteractionData} touchData - The touch data object we want to return to the pool
     */
    returnTouchData(touchData)
    {
        this.interactiveDataPool.push(touchData);
    }

    /**
     * Ensures that the original event object contains all data that a regular pointer event would have
     *
     * @private
     * @param {TouchEvent|MouseEvent} event - The original event data from a touch or mouse event
     */
    normalizeToPointerData(event)
    {
        if (this.normalizeTouchEvents && event.changedTouches)
        {
            if (typeof event.button === 'undefined') event.button = event.touches.length ? 1 : 0;
            if (typeof event.buttons === 'undefined') event.buttons = event.touches.length ? 1 : 0;
            if (typeof event.isPrimary === 'undefined') event.isPrimary = event.touches.length === 1;
            if (typeof event.width === 'undefined') event.width = event.changedTouches[0].radiusX || 1;
            if (typeof event.height === 'undefined') event.height = event.changedTouches[0].radiusY || 1;
            if (typeof event.tiltX === 'undefined') event.tiltX = 0;
            if (typeof event.tiltY === 'undefined') event.tiltY = 0;
            if (typeof event.pointerType === 'undefined') event.pointerType = 'touch';
            if (typeof event.pointerId === 'undefined') event.pointerId = event.changedTouches[0].identifier || 0;
            if (typeof event.pressure === 'undefined') event.pressure = event.changedTouches[0].force || 0.5;
            if (typeof event.rotation === 'undefined') event.rotation = event.changedTouches[0].rotationAngle || 0;

            if (typeof event.clientX === 'undefined') event.clientX = event.changedTouches[0].clientX;
            if (typeof event.clientY === 'undefined') event.clientY = event.changedTouches[0].clientY;
            if (typeof event.pageX === 'undefined') event.pageX = event.changedTouches[0].pageX;
            if (typeof event.pageY === 'undefined') event.pageY = event.changedTouches[0].pageY;
            if (typeof event.screenX === 'undefined') event.screenX = event.changedTouches[0].screenX;
            if (typeof event.screenY === 'undefined') event.screenY = event.changedTouches[0].screenY;
            if (typeof event.layerX === 'undefined') event.layerX = event.offsetX = event.clientX;
            if (typeof event.layerY === 'undefined') event.layerY = event.offsetY = event.clientY;
        }
        else if (this.normalizeMouseEvents)
        {
            if (typeof event.isPrimary === 'undefined') event.isPrimary = true;
            if (typeof event.width === 'undefined') event.width = 1;
            if (typeof event.height === 'undefined') event.height = 1;
            if (typeof event.tiltX === 'undefined') event.tiltX = 0;
            if (typeof event.tiltY === 'undefined') event.tiltY = 0;
            if (typeof event.pointerType === 'undefined') event.pointerType = 'mouse';
            if (typeof event.pointerId === 'undefined') event.pointerId = 1;
            if (typeof event.pressure === 'undefined') event.pressure = 0.5;
            if (typeof event.rotation === 'undefined') event.rotation = 0;
        }
    }

    /**
     * Destroys the interaction manager
     *
     */
    destroy()
    {
        this.removeEvents();

        this.removeAllListeners();

        this.renderer = null;

        this.mouse = null;

        this.eventData = null;

        this.interactiveDataPool = null;

        this.interactionDOMElement = null;

        this.onMouseDown = null;
        this.processMouseDown = null;

        this.onMouseUp = null;
        this.processMouseUp = null;

        this.onMouseMove = null;
        this.processMouseMove = null;

        this.onMouseOut = null;
        this.processMouseOverOut = null;

        this.onMouseOver = null;

        this.onPointerDown = null;
        this.processPointerDown = null;

        this.onPointerUp = null;
        this.processPointerUp = null;

        this.onPointerMove = null;
        this.processPointerMove = null;

        this.onPointerOut = null;
        this.processPointerOverOut = null;

        this.onPointerOver = null;

        this.onTouchStart = null;
        this.processTouchStart = null;

        this.onTouchEnd = null;
        this.processTouchEnd = null;

        this.onTouchMove = null;
        this.processTouchMove = null;

        this._tempPoint = null;
    }
}

WebGLRenderer.registerPlugin('interaction', InteractionManager);
CanvasRenderer.registerPlugin('interaction', InteractionManager);

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

