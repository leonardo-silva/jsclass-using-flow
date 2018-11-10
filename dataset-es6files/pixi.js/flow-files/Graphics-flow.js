//import Container from '../display/Container';
//import RenderTexture from '../textures/RenderTexture';
//import Texture from '../textures/Texture';
//import GraphicsData from './GraphicsData';
//import Sprite from '../sprites/Sprite';
//import { Matrix, Point, Rectangle, RoundedRectangle, Ellipse, Polygon, Circle } from '../math';
//import { hex2rgb, rgb2hex } from '../utils';
//import { SHAPES, BLEND_MODES } from '../const';
//import Bounds from '../display/Bounds';
//import bezierCurveTo from './utils/bezierCurveTo';
//import CanvasRenderer from '../renderers/canvas/CanvasRenderer';

/**
 * @class DisplayObject
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
 * @class Container
 * @extends PIXI.DisplayObject
 * @memberof PIXI
 */
class Container extends DisplayObject
{
    /**
     *
     */
    constructor()
    {
        super();

        /**
         * The array of children of this container.
         *
         * @member {PIXI.DisplayObject[]}
         * @readonly
         */
        this.children = [];
    }

    /**
     * Overridable method that can be used by Container subclasses whenever the children array is modified
     *
     * @private
     */
    onChildrenChange()
    {
        /* empty */
    }

    /**
     * Adds a child or multiple children to the container.
     *
     * Multple items can be added like so: `myContainer.addChild(thinkOne, thingTwo, thingThree)`
     *
     * @param {...PIXI.DisplayObject} child - The DisplayObject(s) to add to the container
     * @return {PIXI.DisplayObject} The first child that was added.
     */
    addChild(...childs)
    {
        for (let i = 0; i < childs.length; ++i)
        {
            const child = childs[i];

            // if the child has a parent then lets remove it as Pixi objects can only exist in one place
            if (child.parent)
            {
                child.parent.removeChild(child);
            }

            child.parent = this;

            // ensure a transform will be recalculated..
            this.transform._parentID = -1;
            this._boundsID++;

            this.children.push(child);

            // TODO - lets either do all callbacks or all events.. not both!
            this.onChildrenChange(this.children.length - 1);
            child.emit('added', this);
        }

        return childs[0];
    }

    /**
     * Adds a child to the container at a specified index. If the index is out of bounds an error will be thrown
     *
     * @param {PIXI.DisplayObject} child - The child to add
     * @param {number} index - The index to place the child in
     * @return {PIXI.DisplayObject} The child that was added.
     */
    addChildAt(child, index)
    {
        if (index < 0 || index > this.children.length)
        {
            throw new Error(`${child}addChildAt: The index ${index} supplied is out of bounds ${this.children.length}`);
        }

        if (child.parent)
        {
            child.parent.removeChild(child);
        }

        child.parent = this;

        this.children.splice(index, 0, child);

        // TODO - lets either do all callbacks or all events.. not both!
        this.onChildrenChange(index);
        child.emit('added', this);

        return child;
    }

    /**
     * Swaps the position of 2 Display Objects within this container.
     *
     * @param {PIXI.DisplayObject} child - First display object to swap
     * @param {PIXI.DisplayObject} child2 - Second display object to swap
     */
    swapChildren(child, child2)
    {
        if (child === child2)
        {
            return;
        }

        const index1 = this.getChildIndex(child);
        const index2 = this.getChildIndex(child2);

        if (index1 < 0 || index2 < 0)
        {
            throw new Error('swapChildren: Both the supplied DisplayObjects must be children of the caller.');
        }

        this.children[index1] = child2;
        this.children[index2] = child;
        this.onChildrenChange(index1 < index2 ? index1 : index2);
    }

    /**
     * Returns the index position of a child DisplayObject instance
     *
     * @param {PIXI.DisplayObject} child - The DisplayObject instance to identify
     * @return {number} The index position of the child display object to identify
     */
    getChildIndex(child)
    {
        const index = this.children.indexOf(child);

        if (index === -1)
        {
            throw new Error('The supplied DisplayObject must be a child of the caller');
        }

        return index;
    }

    /**
     * Changes the position of an existing child in the display object container
     *
     * @param {PIXI.DisplayObject} child - The child DisplayObject instance for which you want to change the index number
     * @param {number} index - The resulting index number for the child display object
     */
    setChildIndex(child, index)
    {
        if (index < 0 || index >= this.children.length)
        {
            throw new Error('The supplied index is out of bounds');
        }

        const currentIndex = this.getChildIndex(child);

        removeItems(this.children, currentIndex, 1); // remove from old position
        this.children.splice(index, 0, child); // add at new position
        this.onChildrenChange(index);
    }

    /**
     * Returns the child at the specified index
     *
     * @param {number} index - The index to get the child at
     * @return {PIXI.DisplayObject} The child at the given index, if any.
     */
    getChildAt(index)
    {
        if (index < 0 || index >= this.children.length)
        {
            throw new Error(`getChildAt: Index (${index}) does not exist.`);
        }

        return this.children[index];
    }

    /**
     * Removes a child from the container.
     *
     * @param {...PIXI.DisplayObject} childs - The DisplayObject(s) to remove
     * @return {PIXI.DisplayObject} The first child that was removed.
     */
    removeChild(...childs)
    {
        for (let i = 0; i < childs.length; ++i)
        {
            const child = childs[i];
            const index = this.children.indexOf(child);

            if (index === -1) continue;

            child.parent = null;
            removeItems(this.children, index, 1);

            // TODO - lets either do all callbacks or all events.. not both!
            this.onChildrenChange(index);
            child.emit('removed', this);
        }

        return childs[0];
    }

    /**
     * Removes a child from the specified index position.
     *
     * @param {number} index - The index to get the child from
     * @return {PIXI.DisplayObject} The child that was removed.
     */
    removeChildAt(index)
    {
        const child = this.getChildAt(index);

        child.parent = null;
        removeItems(this.children, index, 1);

        // TODO - lets either do all callbacks or all events.. not both!
        this.onChildrenChange(index);
        child.emit('removed', this);

        return child;
    }

    /**
     * Removes all children from this container that are within the begin and end indexes.
     *
     * @param {number} [beginIndex=0] - The beginning position.
     * @param {number} [endIndex=this.children.length] - The ending position. Default value is size of the container.
     * @returns {DisplayObject[]} List of removed children
     */
    removeChildren(beginIndex = 0, endIndex)
    {
        const begin = beginIndex;
        const end = typeof endIndex === 'number' ? endIndex : this.children.length;
        const range = end - begin;
        let removed;

        if (range > 0 && range <= end)
        {
            removed = this.children.splice(begin, range);

            for (let i = 0; i < removed.length; ++i)
            {
                removed[i].parent = null;
            }

            this.onChildrenChange(beginIndex);

            for (let i = 0; i < removed.length; ++i)
            {
                removed[i].emit('removed', this);
            }

            return removed;
        }
        else if (range === 0 && this.children.length === 0)
        {
            return [];
        }

        throw new RangeError('removeChildren: numeric values are outside the acceptable range.');
    }

    /**
     * Updates the transform on all children of this container for rendering
     *
     * @private
     */
    updateTransform()
    {
        this._boundsID++;

        this.transform.updateTransform(this.parent.transform);

        // TODO: check render flags, how to process stuff here
        this.worldAlpha = this.alpha * this.parent.worldAlpha;

        for (let i = 0, j = this.children.length; i < j; ++i)
        {
            const child = this.children[i];

            if (child.visible)
            {
                child.updateTransform();
            }
        }
    }

    /**
     * Recalculates the bounds of the container.
     *
     */
    calculateBounds()
    {
        this._bounds.clear();

        this._calculateBounds();

        for (let i = 0; i < this.children.length; i++)
        {
            const child = this.children[i];

            if (!child.visible || !child.renderable)
            {
                continue;
            }

            child.calculateBounds();

            // TODO: filter+mask, need to mask both somehow
            if (child._mask)
            {
                child._mask.calculateBounds();
                this._bounds.addBoundsMask(child._bounds, child._mask._bounds);
            }
            else if (child.filterArea)
            {
                this._bounds.addBoundsArea(child._bounds, child.filterArea);
            }
            else
            {
                this._bounds.addBounds(child._bounds);
            }
        }

        this._lastBoundsID = this._boundsID;
    }

    /**
     * Recalculates the bounds of the object. Override this to
     * calculate the bounds of the specific object (not including children).
     *
     */
    _calculateBounds()
    {
        // FILL IN//
    }

    /**
     * Renders the object using the WebGL renderer
     *
     * @param {PIXI.WebGLRenderer} renderer - The renderer
     */
    renderWebGL(renderer)
    {
        // if the object is not visible or the alpha is 0 then no need to render this element
        if (!this.visible || this.worldAlpha <= 0 || !this.renderable)
        {
            return;
        }

        // do a quick check to see if this element has a mask or a filter.
        if (this._mask || this._filters)
        {
            this.renderAdvancedWebGL(renderer);
        }
        else
        {
            this._renderWebGL(renderer);

            // simple render children!
            for (let i = 0, j = this.children.length; i < j; ++i)
            {
                this.children[i].renderWebGL(renderer);
            }
        }
    }

    /**
     * Render the object using the WebGL renderer and advanced features.
     *
     * @private
     * @param {PIXI.WebGLRenderer} renderer - The renderer
     */
    renderAdvancedWebGL(renderer)
    {
        renderer.currentRenderer.flush();

        const filters = this._filters;
        const mask = this._mask;

        // push filter first as we need to ensure the stencil buffer is correct for any masking
        if (filters)
        {
            if (!this._enabledFilters)
            {
                this._enabledFilters = [];
            }

            this._enabledFilters.length = 0;

            for (let i = 0; i < filters.length; i++)
            {
                if (filters[i].enabled)
                {
                    this._enabledFilters.push(filters[i]);
                }
            }

            if (this._enabledFilters.length)
            {
                renderer.filterManager.pushFilter(this, this._enabledFilters);
            }
        }

        if (mask)
        {
            renderer.maskManager.pushMask(this, this._mask);
        }

        renderer.currentRenderer.start();

        // add this object to the batch, only rendered if it has a texture.
        this._renderWebGL(renderer);

        // now loop through the children and make sure they get rendered
        for (let i = 0, j = this.children.length; i < j; i++)
        {
            this.children[i].renderWebGL(renderer);
        }

        renderer.currentRenderer.flush();

        if (mask)
        {
            renderer.maskManager.popMask(this, this._mask);
        }

        if (filters && this._enabledFilters && this._enabledFilters.length)
        {
            renderer.filterManager.popFilter();
        }

        renderer.currentRenderer.start();
    }

    /**
     * To be overridden by the subclasses.
     *
     * @private
     * @param {PIXI.WebGLRenderer} renderer - The renderer
     */
    _renderWebGL(renderer) // eslint-disable-line no-unused-vars
    {
        // this is where content itself gets rendered...
    }

    /**
     * To be overridden by the subclass
     *
     * @private
     * @param {PIXI.CanvasRenderer} renderer - The renderer
     */
    _renderCanvas(renderer) // eslint-disable-line no-unused-vars
    {
        // this is where content itself gets rendered...
    }

    /**
     * Renders the object using the Canvas renderer
     *
     * @param {PIXI.CanvasRenderer} renderer - The renderer
     */
    renderCanvas(renderer)
    {
        // if not visible or the alpha is 0 then no need to render this
        if (!this.visible || this.alpha <= 0 || !this.renderable)
        {
            return;
        }

        if (this._mask)
        {
            renderer.maskManager.pushMask(this._mask);
        }

        this._renderCanvas(renderer);
        for (let i = 0, j = this.children.length; i < j; ++i)
        {
            this.children[i].renderCanvas(renderer);
        }

        if (this._mask)
        {
            renderer.maskManager.popMask(renderer);
        }
    }

    /**
     * Removes all internal references and listeners as well as removes children from the display list.
     * Do not use a Container after calling `destroy`.
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
     *  have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have their destroy
     *  method called as well. 'options' will be passed on to those calls.
     */
    destroy(options)
    {
        super.destroy();

        const destroyChildren = typeof options === 'boolean' ? options : options && options.children;

        const oldChildren = this.removeChildren(0, this.children.length);

        if (destroyChildren)
        {
            for (let i = 0; i < oldChildren.length; ++i)
            {
                oldChildren[i].destroy(options);
            }
        }
    }

    /**
     * The width of the Container, setting this will actually modify the scale to achieve the value set
     *
     * @member {number}
     * @memberof PIXI.Container#
     */
    get width()
    {
        return this.scale.x * this.getLocalBounds().width;
    }

    /**
     * Sets the width of the container by modifying the scale.
     *
     * @param {number} value - The value to set to.
     */
    set width(value)
    {
        const width = this.getLocalBounds().width;

        if (width !== 0)
        {
            this.scale.x = value / width;
        }
        else
        {
            this.scale.x = 1;
        }

        this._width = value;
    }

    /**
     * The height of the Container, setting this will actually modify the scale to achieve the value set
     *
     * @member {number}
     * @memberof PIXI.Container#
     */
    get height()
    {
        return this.scale.y * this.getLocalBounds().height;
    }

    /**
     * Sets the height of the container by modifying the scale.
     *
     * @param {number} value - The value to set to.
     */
    set height(value)
    {
        const height = this.getLocalBounds().height;

        if (height !== 0)
        {
            this.scale.y = value / height;
        }
        else
        {
            this.scale.y = 1;
        }

        this._height = value;
    }
}

// performance increase to avoid using call.. (10x faster)
Container.prototype.containerUpdateTransform = Container.prototype.updateTransform;

/**
 * @class Texture
 * @extends EventEmitter
 * @memberof PIXI
 */
class Texture extends EventEmitter
{
    /**
     * @param {PIXI.BaseTexture} baseTexture - The base texture source to create the texture from
     * @param {PIXI.Rectangle} [frame] - The rectangle frame of the texture to show
     * @param {PIXI.Rectangle} [orig] - The area of original texture
     * @param {PIXI.Rectangle} [trim] - Trimmed rectangle of original texture
     * @param {number} [rotate] - indicates how the texture was rotated by texture packer. See {@link PIXI.GroupD8}
     */
    constructor(baseTexture, frame, orig, trim, rotate)
    {
        super();

        /**
         * Does this Texture have any frame data assigned to it?
         *
         * @member {boolean}
         */
        this.noFrame = false;

        if (!frame)
        {
            this.noFrame = true;
            frame = new Rectangle(0, 0, 1, 1);
        }

        if (baseTexture instanceof Texture)
        {
            baseTexture = baseTexture.baseTexture;
        }

        /**
         * The base texture that this texture uses.
         *
         * @member {PIXI.BaseTexture}
         */
        this.baseTexture = baseTexture;

        /**
         * This is the area of the BaseTexture image to actually copy to the Canvas / WebGL when rendering,
         * irrespective of the actual frame size or placement (which can be influenced by trimmed texture atlases)
         *
         * @member {PIXI.Rectangle}
         */
        this._frame = frame;

        /**
         * This is the trimmed area of original texture, before it was put in atlas
         *
         * @member {PIXI.Rectangle}
         */
        this.trim = trim;

        /**
         * This will let the renderer know if the texture is valid. If it's not then it cannot be rendered.
         *
         * @member {boolean}
         */
        this.valid = false;

        /**
         * This will let a renderer know that a texture has been updated (used mainly for webGL uv updates)
         *
         * @member {boolean}
         */
        this.requiresUpdate = false;

        /**
         * The WebGL UV data cache.
         *
         * @member {PIXI.TextureUvs}
         * @private
         */
        this._uvs = null;

        /**
         * This is the area of original texture, before it was put in atlas
         *
         * @member {PIXI.Rectangle}
         */
        this.orig = orig || frame;// new Rectangle(0, 0, 1, 1);

        this._rotate = Number(rotate || 0);

        if (rotate === true)
        {
            // this is old texturepacker legacy, some games/libraries are passing "true" for rotated textures
            this._rotate = 2;
        }
        else if (this._rotate % 2 !== 0)
        {
            throw new Error('attempt to use diamond-shaped UVs. If you are sure, set rotation manually');
        }

        if (baseTexture.hasLoaded)
        {
            if (this.noFrame)
            {
                frame = new Rectangle(0, 0, baseTexture.width, baseTexture.height);

                // if there is no frame we should monitor for any base texture changes..
                baseTexture.on('update', this.onBaseTextureUpdated, this);
            }
            this.frame = frame;
        }
        else
        {
            baseTexture.once('loaded', this.onBaseTextureLoaded, this);
        }

        /**
         * Fired when the texture is updated. This happens if the frame or the baseTexture is updated.
         *
         * @event update
         * @memberof PIXI.Texture#
         * @protected
         */

        this._updateID = 0;
    }

    /**
     * Updates this texture on the gpu.
     *
     */
    update()
    {
        this.baseTexture.update();
    }

    /**
     * Called when the base texture is loaded
     *
     * @private
     * @param {PIXI.BaseTexture} baseTexture - The base texture.
     */
    onBaseTextureLoaded(baseTexture)
    {
        this._updateID++;

        // TODO this code looks confusing.. boo to abusing getters and setterss!
        if (this.noFrame)
        {
            this.frame = new Rectangle(0, 0, baseTexture.width, baseTexture.height);
        }
        else
        {
            this.frame = this._frame;
        }

        this.baseTexture.on('update', this.onBaseTextureUpdated, this);
        this.emit('update', this);
    }

    /**
     * Called when the base texture is updated
     *
     * @private
     * @param {PIXI.BaseTexture} baseTexture - The base texture.
     */
    onBaseTextureUpdated(baseTexture)
    {
        this._updateID++;

        this._frame.width = baseTexture.width;
        this._frame.height = baseTexture.height;

        this.emit('update', this);
    }

    /**
     * Destroys this texture
     *
     * @param {boolean} [destroyBase=false] Whether to destroy the base texture as well
     */
    destroy(destroyBase)
    {
        if (this.baseTexture)
        {
            if (destroyBase)
            {
                // delete the texture if it exists in the texture cache..
                // this only needs to be removed if the base texture is actually destoryed too..
                if (TextureCache[this.baseTexture.imageUrl])
                {
                    delete TextureCache[this.baseTexture.imageUrl];
                }

                this.baseTexture.destroy();
            }

            this.baseTexture.off('update', this.onBaseTextureUpdated, this);
            this.baseTexture.off('loaded', this.onBaseTextureLoaded, this);

            this.baseTexture = null;
        }

        this._frame = null;
        this._uvs = null;
        this.trim = null;
        this.orig = null;

        this.valid = false;

        this.off('dispose', this.dispose, this);
        this.off('update', this.update, this);
    }

    /**
     * Creates a new texture object that acts the same as this one.
     *
     * @return {PIXI.Texture} The new texture
     */
    clone()
    {
        return new Texture(this.baseTexture, this.frame, this.orig, this.trim, this.rotate);
    }

    /**
     * Updates the internal WebGL UV cache.
     *
     * @protected
     */
    _updateUvs()
    {
        if (!this._uvs)
        {
            this._uvs = new TextureUvs();
        }

        this._uvs.set(this._frame, this.baseTexture, this.rotate);

        this._updateID++;
    }

    /**
     * Helper function that creates a Texture object from the given image url.
     * If the image is not in the texture cache it will be  created and loaded.
     *
     * @static
     * @param {string} imageUrl - The image url of the texture
     * @param {boolean} [crossorigin] - Whether requests should be treated as crossorigin
     * @param {number} [scaleMode=PIXI.SCALE_MODES.DEFAULT] - See {@link PIXI.SCALE_MODES} for possible values
     * @param {number} [sourceScale=(auto)] - Scale for the original image, used with SVG images.
     * @return {PIXI.Texture} The newly created texture
     */
    static fromImage(imageUrl, crossorigin, scaleMode, sourceScale)
    {
        let texture = TextureCache[imageUrl];

        if (!texture)
        {
            texture = new Texture(BaseTexture.fromImage(imageUrl, crossorigin, scaleMode, sourceScale));
            TextureCache[imageUrl] = texture;
        }

        return texture;
    }

    /**
     * Helper function that creates a sprite that will contain a texture from the TextureCache based on the frameId
     * The frame ids are created when a Texture packer file has been loaded
     *
     * @static
     * @param {string} frameId - The frame Id of the texture in the cache
     * @return {PIXI.Texture} The newly created texture
     */
    static fromFrame(frameId)
    {
        const texture = TextureCache[frameId];

        if (!texture)
        {
            throw new Error(`The frameId "${frameId}" does not exist in the texture cache`);
        }

        return texture;
    }

    /**
     * Helper function that creates a new Texture based on the given canvas element.
     *
     * @static
     * @param {HTMLCanvasElement} canvas - The canvas element source of the texture
     * @param {number} [scaleMode=PIXI.SCALE_MODES.DEFAULT] - See {@link PIXI.SCALE_MODES} for possible values
     * @return {PIXI.Texture} The newly created texture
     */
    static fromCanvas(canvas, scaleMode)
    {
        return new Texture(BaseTexture.fromCanvas(canvas, scaleMode));
    }

    /**
     * Helper function that creates a new Texture based on the given video element.
     *
     * @static
     * @param {HTMLVideoElement|string} video - The URL or actual element of the video
     * @param {number} [scaleMode=PIXI.SCALE_MODES.DEFAULT] - See {@link PIXI.SCALE_MODES} for possible values
     * @return {PIXI.Texture} The newly created texture
     */
    static fromVideo(video, scaleMode)
    {
        if (typeof video === 'string')
        {
            return Texture.fromVideoUrl(video, scaleMode);
        }

        return new Texture(VideoBaseTexture.fromVideo(video, scaleMode));
    }

    /**
     * Helper function that creates a new Texture based on the video url.
     *
     * @static
     * @param {string} videoUrl - URL of the video
     * @param {number} [scaleMode=PIXI.SCALE_MODES.DEFAULT] - See {@link PIXI.SCALE_MODES} for possible values
     * @return {PIXI.Texture} The newly created texture
     */
    static fromVideoUrl(videoUrl, scaleMode)
    {
        return new Texture(VideoBaseTexture.fromUrl(videoUrl, scaleMode));
    }

    /**
     * Helper function that creates a new Texture based on the source you provide.
     * The soucre can be - frame id, image url, video url, canvae element, video element, base texture
     *
     * @static
     * @param {number|string|PIXI.BaseTexture|HTMLCanvasElement|HTMLVideoElement} source - Source to create texture from
     * @return {PIXI.Texture} The newly created texture
     */
    static from(source)
    {
        // TODO auto detect cross origin..
        // TODO pass in scale mode?
        if (typeof source === 'string')
        {
            const texture = TextureCache[source];

            if (!texture)
            {
                // check if its a video..
                const isVideo = source.match(/\.(mp4|webm|ogg|h264|avi|mov)$/) !== null;

                if (isVideo)
                {
                    return Texture.fromVideoUrl(source);
                }

                return Texture.fromImage(source);
            }

            return texture;
        }
        else if (source instanceof HTMLCanvasElement)
        {
            return Texture.fromCanvas(source);
        }
        else if (source instanceof HTMLVideoElement)
        {
            return Texture.fromVideo(source);
        }
        else if (source instanceof BaseTexture)
        {
            return new Texture(BaseTexture);
        }

        // lets assume its a texture!
        return source;
    }

    /**
     * Adds a texture to the global TextureCache. This cache is shared across the whole PIXI object.
     *
     * @static
     * @param {PIXI.Texture} texture - The Texture to add to the cache.
     * @param {string} id - The id that the texture will be stored against.
     */
    static addTextureToCache(texture, id)
    {
        TextureCache[id] = texture;
    }

    /**
     * Remove a texture from the global TextureCache.
     *
     * @static
     * @param {string} id - The id of the texture to be removed
     * @return {PIXI.Texture} The texture that was removed
     */
    static removeTextureFromCache(id)
    {
        const texture = TextureCache[id];

        delete TextureCache[id];
        delete BaseTextureCache[id];

        return texture;
    }

    /**
     * The frame specifies the region of the base texture that this texture uses.
     *
     * @member {PIXI.Rectangle}
     * @memberof PIXI.Texture#
     */
    get frame()
    {
        return this._frame;
    }

    /**
     * Set the frame.
     *
     * @param {Rectangle} frame - The new frame to set.
     */
    set frame(frame)
    {
        this._frame = frame;

        this.noFrame = false;

        if (frame.x + frame.width > this.baseTexture.width || frame.y + frame.height > this.baseTexture.height)
        {
            throw new Error(`Texture Error: frame does not fit inside the base Texture dimensions ${this}`);
        }

        // this.valid = frame && frame.width && frame.height && this.baseTexture.source && this.baseTexture.hasLoaded;
        this.valid = frame && frame.width && frame.height && this.baseTexture.hasLoaded;

        if (!this.trim && !this.rotate)
        {
            this.orig = frame;
        }

        if (this.valid)
        {
            this._updateUvs();
        }
    }

    /**
     * Indicates whether the texture is rotated inside the atlas
     * set to 2 to compensate for texture packer rotation
     * set to 6 to compensate for spine packer rotation
     * can be used to rotate or mirror sprites
     * See {@link PIXI.GroupD8} for explanation
     *
     * @member {number}
     */
    get rotate()
    {
        return this._rotate;
    }

    /**
     * Set the rotation
     *
     * @param {number} rotate - The new rotation to set.
     */
    set rotate(rotate)
    {
        this._rotate = rotate;
        if (this.valid)
        {
            this._updateUvs();
        }
    }

    /**
     * The width of the Texture in pixels.
     *
     * @member {number}
     */
    get width()
    {
        return this.orig ? this.orig.width : 0;
    }

    /**
     * The height of the Texture in pixels.
     *
     * @member {number}
     */
    get height()
    {
        return this.orig ? this.orig.height : 0;
    }
}

/**
 * An empty texture, used often to not have to create multiple empty textures.
 * Can not be destroyed.
 *
 * @static
 * @constant
 */
Texture.EMPTY = new Texture(new BaseTexture());
Texture.EMPTY.destroy = function _emptyDestroy() { /* empty */ };
Texture.EMPTY.on = function _emptyOn() { /* empty */ };
Texture.EMPTY.once = function _emptyOnce() { /* empty */ };
Texture.EMPTY.emit = function _emptyEmit() { /* empty */ };

/**
 * @class RenderTexture
 * @extends PIXI.Texture
 * @memberof PIXI
 */
class RenderTexture extends Texture
{
    /**
     * @param {PIXI.BaseRenderTexture} baseRenderTexture - The renderer used for this RenderTexture
     * @param {PIXI.Rectangle} [frame] - The rectangle frame of the texture to show
     */
    constructor(baseRenderTexture, frame)
    {
        // suport for legacy..
        let _legacyRenderer = null;

        if (!(baseRenderTexture instanceof BaseRenderTexture))
        {
            /* eslint-disable prefer-rest-params, no-console */
            const width = arguments[1];
            const height = arguments[2];
            const scaleMode = arguments[3] || 0;
            const resolution = arguments[4] || 1;

            // we have an old render texture..
            console.warn(`Please use RenderTexture.create(${width}, ${height}) instead of the ctor directly.`);
            _legacyRenderer = arguments[0];
            /* eslint-enable prefer-rest-params, no-console */

            frame = null;
            baseRenderTexture = new BaseRenderTexture(width, height, scaleMode, resolution);
        }

        /**
         * The base texture object that this texture uses
         *
         * @member {BaseTexture}
         */
        super(
            baseRenderTexture,
            frame
        );

        this.legacyRenderer = _legacyRenderer;

        /**
         * This will let the renderer know if the texture is valid. If it's not then it cannot be rendered.
         *
         * @member {boolean}
         */
        this.valid = true;

        this._updateUvs();
    }

    /**
     * Resizes the RenderTexture.
     *
     * @param {number} width - The width to resize to.
     * @param {number} height - The height to resize to.
     * @param {boolean} doNotResizeBaseTexture - Should the baseTexture.width and height values be resized as well?
     */
    resize(width, height, doNotResizeBaseTexture)
    {
        // TODO - could be not required..
        this.valid = (width > 0 && height > 0);

        this._frame.width = this.orig.width = width;
        this._frame.height = this.orig.height = height;

        if (!doNotResizeBaseTexture)
        {
            this.baseTexture.resize(width, height);
        }

        this._updateUvs();
    }

    /**
     * A short hand way of creating a render texture.
     *
     * @param {number} [width=100] - The width of the render texture
     * @param {number} [height=100] - The height of the render texture
     * @param {number} [scaleMode=PIXI.SCALE_MODES.DEFAULT] - See {@link PIXI.SCALE_MODES} for possible values
     * @param {number} [resolution=1] - The resolution / device pixel ratio of the texture being generated
     * @return {PIXI.RenderTexture} The new render texture
     */
    static create(width, height, scaleMode, resolution)
    {
        return new RenderTexture(new BaseRenderTexture(width, height, scaleMode, resolution));
    }
}

/**
 * A GraphicsData object.
 *
 * @class
 * @memberof PIXI
 */
class GraphicsData
{
    /**
     *
     * @param {number} lineWidth - the width of the line to draw
     * @param {number} lineColor - the color of the line to draw
     * @param {number} lineAlpha - the alpha of the line to draw
     * @param {number} fillColor - the color of the fill
     * @param {number} fillAlpha - the alpha of the fill
     * @param {boolean} fill - whether or not the shape is filled with a colour
     * @param {PIXI.Circle|PIXI.Rectangle|PIXI.Ellipse|PIXI.Polygon} shape - The shape object to draw.
     */
    constructor(lineWidth, lineColor, lineAlpha, fillColor, fillAlpha, fill, shape)
    {
        /**
         * @member {number} the width of the line to draw
         */
        this.lineWidth = lineWidth;

        /**
         * @member {number} the color of the line to draw
         */
        this.lineColor = lineColor;

        /**
         * @member {number} the alpha of the line to draw
         */
        this.lineAlpha = lineAlpha;

        /**
         * @member {number} cached tint of the line to draw
         */
        this._lineTint = lineColor;

        /**
         * @member {number} the color of the fill
         */
        this.fillColor = fillColor;

        /**
         * @member {number} the alpha of the fill
         */
        this.fillAlpha = fillAlpha;

        /**
         * @member {number} cached tint of the fill
         */
        this._fillTint = fillColor;

        /**
         * @member {boolean} whether or not the shape is filled with a colour
         */
        this.fill = fill;

        this.holes = [];

        /**
         * @member {PIXI.Circle|PIXI.Ellipse|PIXI.Polygon|PIXI.Rectangle|PIXI.RoundedRectangle} The shape object to draw.
         */
        this.shape = shape;

        /**
         * @member {number} The type of the shape, see the Const.Shapes file for all the existing types,
         */
        this.type = shape.type;
    }

    /**
     * Creates a new GraphicsData object with the same values as this one.
     *
     * @return {PIXI.GraphicsData} Cloned GraphicsData object
     */
    clone()
    {
        return new GraphicsData(
            this.lineWidth,
            this.lineColor,
            this.lineAlpha,
            this.fillColor,
            this.fillAlpha,
            this.fill,
            this.shape
        );
    }

    /**
     * Adds a hole to the shape.
     *
     * @param {PIXI.Rectangle|PIXI.Circle} shape - The shape of the hole.
     */
    addHole(shape)
    {
        this.holes.push(shape);
    }

    /**
     * Destroys the Graphics data.
     */
    destroy()
    {
        this.shape = null;
        this.holes = null;
    }
}

/**
 * The Point object represents a location in a two-dimensional coordinate system, where x represents
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
class Matrix
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

/**
 * Rectangle object is an area defined by its position, as indicated by its top-left corner
 * point (x, y) and by its width and its height.
 *
 * @class
 * @memberof PIXI
 */
class Rectangle
{
    /**
     * @param {number} [x=0] - The X coordinate of the upper-left corner of the rectangle
     * @param {number} [y=0] - The Y coordinate of the upper-left corner of the rectangle
     * @param {number} [width=0] - The overall width of this rectangle
     * @param {number} [height=0] - The overall height of this rectangle
     */
    constructor(x = 0, y = 0, width = 0, height = 0)
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

        /**
         * @member {number}
         * @default 0
         */
        this.width = width;

        /**
         * @member {number}
         * @default 0
         */
        this.height = height;

        /**
         * The type of the object, mainly used to avoid `instanceof` checks
         *
         * @member {number}
         * @readOnly
         * @default PIXI.SHAPES.RECT
         * @see PIXI.SHAPES
         */
        this.type = SHAPES.RECT;
    }

    /**
     * returns the left edge of the rectangle
     *
     * @member {number}
     * @memberof PIXI.Rectangle#
     */
    get left()
    {
        return this.x;
    }

    /**
     * returns the right edge of the rectangle
     *
     * @member {number}
     * @memberof PIXI.Rectangle
     */
    get right()
    {
        return this.x + this.width;
    }

    /**
     * returns the top edge of the rectangle
     *
     * @member {number}
     * @memberof PIXI.Rectangle
     */
    get top()
    {
        return this.y;
    }

    /**
     * returns the bottom edge of the rectangle
     *
     * @member {number}
     * @memberof PIXI.Rectangle
     */
    get bottom()
    {
        return this.y + this.height;
    }

    /**
     * A constant empty rectangle.
     *
     * @static
     * @constant
     */
    static get EMPTY()
    {
        return new Rectangle(0, 0, 0, 0);
    }

    /**
     * Creates a clone of this Rectangle
     *
     * @return {PIXI.Rectangle} a copy of the rectangle
     */
    clone()
    {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    /**
     * Copies another rectangle to this one.
     *
     * @param {PIXI.Rectangle} rectangle - The rectangle to copy.
     * @return {PIXI.Rectanle} Returns itself.
     */
    copy(rectangle)
    {
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;

        return this;
    }

    /**
     * Checks whether the x and y coordinates given are contained within this Rectangle
     *
     * @param {number} x - The X coordinate of the point to test
     * @param {number} y - The Y coordinate of the point to test
     * @return {boolean} Whether the x/y coordinates are within this Rectangle
     */
    contains(x, y)
    {
        if (this.width <= 0 || this.height <= 0)
        {
            return false;
        }

        if (x >= this.x && x < this.x + this.width)
        {
            if (y >= this.y && y < this.y + this.height)
            {
                return true;
            }
        }

        return false;
    }

    /**
     * Pads the rectangle making it grow in all directions.
     *
     * @param {number} paddingX - The horizontal padding amount.
     * @param {number} paddingY - The vertical padding amount.
     */
    pad(paddingX, paddingY)
    {
        paddingX = paddingX || 0;
        paddingY = paddingY || ((paddingY !== 0) ? paddingX : 0);

        this.x -= paddingX;
        this.y -= paddingY;

        this.width += paddingX * 2;
        this.height += paddingY * 2;
    }

    /**
     * Fits this rectangle around the passed one.
     *
     * @param {PIXI.Rectangle} rectangle - The rectangle to fit.
     */
    fit(rectangle)
    {
        if (this.x < rectangle.x)
        {
            this.width += this.x;
            if (this.width < 0)
            {
                this.width = 0;
            }

            this.x = rectangle.x;
        }

        if (this.y < rectangle.y)
        {
            this.height += this.y;
            if (this.height < 0)
            {
                this.height = 0;
            }
            this.y = rectangle.y;
        }

        if (this.x + this.width > rectangle.x + rectangle.width)
        {
            this.width = rectangle.width - this.x;
            if (this.width < 0)
            {
                this.width = 0;
            }
        }

        if (this.y + this.height > rectangle.y + rectangle.height)
        {
            this.height = rectangle.height - this.y;
            if (this.height < 0)
            {
                this.height = 0;
            }
        }
    }

    /**
     * Enlarges this rectangle to include the passed rectangle.
     *
     * @param {PIXI.Rectangle} rect - The rectangle to include.
     */
    enlarge(rect)
    {
        if (rect === Rectangle.EMPTY)
        {
            return;
        }

        const x1 = Math.min(this.x, rect.x);
        const x2 = Math.max(this.x + this.width, rect.x + rect.width);
        const y1 = Math.min(this.y, rect.y);
        const y2 = Math.max(this.y + this.height, rect.y + rect.height);

        this.x = x1;
        this.width = x2 - x1;
        this.y = y1;
        this.height = y2 - y1;
    }
}

/**
 * The Rounded Rectangle object is an area that has nice rounded corners, as indicated by its
 * top-left corner point (x, y) and by its width and its height and its radius.
 *
 * @class
 * @memberof PIXI
 */
class RoundedRectangle
{
    /**
     * @param {number} [x=0] - The X coordinate of the upper-left corner of the rounded rectangle
     * @param {number} [y=0] - The Y coordinate of the upper-left corner of the rounded rectangle
     * @param {number} [width=0] - The overall width of this rounded rectangle
     * @param {number} [height=0] - The overall height of this rounded rectangle
     * @param {number} [radius=20] - Controls the radius of the rounded corners
     */
    constructor(x = 0, y = 0, width = 0, height = 0, radius = 20)
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

        /**
         * @member {number}
         * @default 0
         */
        this.width = width;

        /**
         * @member {number}
         * @default 0
         */
        this.height = height;

        /**
         * @member {number}
         * @default 20
         */
        this.radius = radius;

        /**
         * The type of the object, mainly used to avoid `instanceof` checks
         *
         * @member {number}
         * @readonly
         * @default PIXI.SHAPES.RREC
         * @see PIXI.SHAPES
         */
        this.type = SHAPES.RREC;
    }

    /**
     * Creates a clone of this Rounded Rectangle
     *
     * @return {PIXI.RoundedRectangle} a copy of the rounded rectangle
     */
    clone()
    {
        return new RoundedRectangle(this.x, this.y, this.width, this.height, this.radius);
    }

    /**
     * Checks whether the x and y coordinates given are contained within this Rounded Rectangle
     *
     * @param {number} x - The X coordinate of the point to test
     * @param {number} y - The Y coordinate of the point to test
     * @return {boolean} Whether the x/y coordinates are within this Rounded Rectangle
     */
    contains(x, y)
    {
        if (this.width <= 0 || this.height <= 0)
        {
            return false;
        }

        if (x >= this.x && x <= this.x + this.width)
        {
            if (y >= this.y && y <= this.y + this.height)
            {
                return true;
            }
        }

        return false;
    }
}

/**
 * The Ellipse object can be used to specify a hit area for displayObjects
 *
 * @class
 * @memberof PIXI
 */
class Ellipse
{
    /**
     * @param {number} [x=0] - The X coordinate of the center of this circle
     * @param {number} [y=0] - The Y coordinate of the center of this circle
     * @param {number} [width=0] - The half width of this ellipse
     * @param {number} [height=0] - The half height of this ellipse
     */
    constructor(x = 0, y = 0, width = 0, height = 0)
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

        /**
         * @member {number}
         * @default 0
         */
        this.width = width;

        /**
         * @member {number}
         * @default 0
         */
        this.height = height;

        /**
         * The type of the object, mainly used to avoid `instanceof` checks
         *
         * @member {number}
         * @readOnly
         * @default PIXI.SHAPES.ELIP
         * @see PIXI.SHAPES
         */
        this.type = SHAPES.ELIP;
    }

    /**
     * Creates a clone of this Ellipse instance
     *
     * @return {PIXI.Ellipse} a copy of the ellipse
     */
    clone()
    {
        return new Ellipse(this.x, this.y, this.width, this.height);
    }

    /**
     * Checks whether the x and y coordinates given are contained within this ellipse
     *
     * @param {number} x - The X coordinate of the point to test
     * @param {number} y - The Y coordinate of the point to test
     * @return {boolean} Whether the x/y coords are within this ellipse
     */
    contains(x, y)
    {
        if (this.width <= 0 || this.height <= 0)
        {
            return false;
        }

        // normalize the coords to an ellipse with center 0,0
        let normx = ((x - this.x) / this.width);
        let normy = ((y - this.y) / this.height);

        normx *= normx;
        normy *= normy;

        return (normx + normy <= 1);
    }

    /**
     * Returns the framing rectangle of the ellipse as a Rectangle object
     *
     * @return {PIXI.Rectangle} the framing rectangle
     */
    getBounds()
    {
        return new Rectangle(this.x - this.width, this.y - this.height, this.width, this.height);
    }
}

/**
 * @class
 * @memberof PIXI
 */
class Polygon
{
    /**
     * @param {PIXI.Point[]|number[]} points - This can be an array of Points
     *  that form the polygon, a flat array of numbers that will be interpreted as [x,y, x,y, ...], or
     *  the arguments passed can be all the points of the polygon e.g.
     *  `new PIXI.Polygon(new PIXI.Point(), new PIXI.Point(), ...)`, or the arguments passed can be flat
     *  x,y values e.g. `new Polygon(x,y, x,y, x,y, ...)` where `x` and `y` are Numbers.
     */
    constructor(...points)
    {
        if (Array.isArray(points[0]))
        {
            points = points[0];
        }

        // if this is an array of points, convert it to a flat array of numbers
        if (points[0] instanceof Point)
        {
            const p = [];

            for (let i = 0, il = points.length; i < il; i++)
            {
                p.push(points[i].x, points[i].y);
            }

            points = p;
        }

        this.closed = true;

        /**
         * An array of the points of this polygon
         *
         * @member {number[]}
         */
        this.points = points;

        /**
         * The type of the object, mainly used to avoid `instanceof` checks
         *
         * @member {number}
         * @readOnly
         * @default PIXI.SHAPES.POLY
         * @see PIXI.SHAPES
         */
        this.type = SHAPES.POLY;
    }

    /**
     * Creates a clone of this polygon
     *
     * @return {PIXI.Polygon} a copy of the polygon
     */
    clone()
    {
        return new Polygon(this.points.slice());
    }

    /**
     * Closes the polygon, adding points if necessary.
     *
     */
    close()
    {
        const points = this.points;

        // close the poly if the value is true!
        if (points[0] !== points[points.length - 2] || points[1] !== points[points.length - 1])
        {
            points.push(points[0], points[1]);
        }
    }

    /**
     * Checks whether the x and y coordinates passed to this function are contained within this polygon
     *
     * @param {number} x - The X coordinate of the point to test
     * @param {number} y - The Y coordinate of the point to test
     * @return {boolean} Whether the x/y coordinates are within this polygon
     */
    contains(x, y)
    {
        let inside = false;

        // use some raycasting to test hits
        // https://github.com/substack/point-in-polygon/blob/master/index.js
        const length = this.points.length / 2;

        for (let i = 0, j = length - 1; i < length; j = ++i)
        {
            const xi = this.points[i * 2];
            const yi = this.points[(i * 2) + 1];
            const xj = this.points[j * 2];
            const yj = this.points[(j * 2) + 1];
            const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * ((y - yi) / (yj - yi))) + xi);

            if (intersect)
            {
                inside = !inside;
            }
        }

        return inside;
    }
}

/**
 * The Circle object can be used to specify a hit area for displayObjects
 *
 * @class
 * @memberof PIXI
 */
class Circle
{
    /**
     * @param {number} [x=0] - The X coordinate of the center of this circle
     * @param {number} [y=0] - The Y coordinate of the center of this circle
     * @param {number} [radius=0] - The radius of the circle
     */
    constructor(x = 0, y = 0, radius = 0)
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

        /**
         * @member {number}
         * @default 0
         */
        this.radius = radius;

        /**
         * The type of the object, mainly used to avoid `instanceof` checks
         *
         * @member {number}
         * @readOnly
         * @default PIXI.SHAPES.CIRC
         * @see PIXI.SHAPES
         */
        this.type = SHAPES.CIRC;
    }

    /**
     * Creates a clone of this Circle instance
     *
     * @return {PIXI.Circle} a copy of the Circle
     */
    clone()
    {
        return new Circle(this.x, this.y, this.radius);
    }

    /**
     * Checks whether the x and y coordinates given are contained within this circle
     *
     * @param {number} x - The X coordinate of the point to test
     * @param {number} y - The Y coordinate of the point to test
     * @return {boolean} Whether the x/y coordinates are within this Circle
     */
    contains(x, y)
    {
        if (this.radius <= 0)
        {
            return false;
        }

        const r2 = this.radius * this.radius;
        let dx = (this.x - x);
        let dy = (this.y - y);

        dx *= dx;
        dy *= dy;

        return (dx + dy <= r2);
    }

    /**
    * Returns the framing rectangle of the circle as a Rectangle object
    *
    * @return {PIXI.Rectangle} the framing rectangle
    */
    getBounds()
    {
        return new Rectangle(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
}

/**
 * The Sprite object is the base for all textured objects that are rendered to the screen
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 */
const tempPoint = new Point();

class Sprite extends Container
{
    /**
     * @param {PIXI.Texture} texture - The texture for this sprite
     */
    constructor(texture)
    {
        super();

        /**
         * The anchor sets the origin point of the texture.
         * The default is 0,0 this means the texture's origin is the top left
         * Setting the anchor to 0.5,0.5 means the texture's origin is centered
         * Setting the anchor to 1,1 would mean the texture's origin point will be the bottom right corner
         *
         * @member {PIXI.ObservablePoint}
         * @private
         */
        this._anchor = new ObservablePoint(this._onAnchorUpdate, this);

        /**
         * The texture that the sprite is using
         *
         * @private
         * @member {PIXI.Texture}
         */
        this._texture = null;

        /**
         * The width of the sprite (this is initially set by the texture)
         *
         * @private
         * @member {number}
         */
        this._width = 0;

        /**
         * The height of the sprite (this is initially set by the texture)
         *
         * @private
         * @member {number}
         */
        this._height = 0;

        /**
         * The tint applied to the sprite. This is a hex value. A value of 0xFFFFFF will remove any tint effect.
         *
         * @private
         * @member {number}
         * @default 0xFFFFFF
         */
        this._tint = null;
        this._tintRGB = null;
        this.tint = 0xFFFFFF;

        /**
         * The blend mode to be applied to the sprite. Apply a value of `PIXI.BLEND_MODES.NORMAL` to reset the blend mode.
         *
         * @member {number}
         * @default PIXI.BLEND_MODES.NORMAL
         * @see PIXI.BLEND_MODES
         */
        this.blendMode = BLEND_MODES.NORMAL;

        /**
         * The shader that will be used to render the sprite. Set to null to remove a current shader.
         *
         * @member {PIXI.AbstractFilter|PIXI.Shader}
         */
        this.shader = null;

        /**
         * An internal cached value of the tint.
         *
         * @private
         * @member {number}
         * @default 0xFFFFFF
         */
        this.cachedTint = 0xFFFFFF;

        // call texture setter
        this.texture = texture || Texture.EMPTY;

        /**
         * this is used to store the vertex data of the sprite (basically a quad)
         *
         * @private
         * @member {Float32Array}
         */
        this.vertexData = new Float32Array(8);

        /**
         * This is used to calculate the bounds of the object IF it is a trimmed sprite
         *
         * @private
         * @member {Float32Array}
         */
        this.vertexTrimmedData = null;

        this._transformID = -1;
        this._textureID = -1;
    }

    /**
     * When the texture is updated, this event will fire to update the scale and frame
     *
     * @private
     */
    _onTextureUpdate()
    {
        this._textureID = -1;

        // so if _width is 0 then width was not set..
        if (this._width)
        {
            this.scale.x = sign(this.scale.x) * this._width / this.texture.orig.width;
        }

        if (this._height)
        {
            this.scale.y = sign(this.scale.y) * this._height / this.texture.orig.height;
        }
    }

    /**
     * Called when the anchor position updates.
     *
     * @private
     */
    _onAnchorUpdate()
    {
        this._transformID = -1;
    }

    /**
     * calculates worldTransform * vertices, store it in vertexData
     */
    calculateVertices()
    {
        if (this._transformID === this.transform._worldID && this._textureID === this._texture._updateID)
        {
            return;
        }

        this._transformID = this.transform._worldID;
        this._textureID = this._texture._updateID;

        // set the vertex data

        const texture = this._texture;
        const wt = this.transform.worldTransform;
        const a = wt.a;
        const b = wt.b;
        const c = wt.c;
        const d = wt.d;
        const tx = wt.tx;
        const ty = wt.ty;
        const vertexData = this.vertexData;
        const trim = texture.trim;
        const orig = texture.orig;
        let w0 = 0;
        let w1 = 0;
        let h0 = 0;
        let h1 = 0;

        if (trim)
        {
            // if the sprite is trimmed and is not a tilingsprite then we need to add the extra
            // space before transforming the sprite coords.
            w1 = trim.x - (this.anchor._x * orig.width);
            w0 = w1 + trim.width;

            h1 = trim.y - (this.anchor._y * orig.height);
            h0 = h1 + trim.height;
        }
        else
        {
            w0 = orig.width * (1 - this.anchor._x);
            w1 = orig.width * -this.anchor._x;

            h0 = orig.height * (1 - this.anchor._y);
            h1 = orig.height * -this.anchor._y;
        }

        // xy
        vertexData[0] = (a * w1) + (c * h1) + tx;
        vertexData[1] = (d * h1) + (b * w1) + ty;

        // xy
        vertexData[2] = (a * w0) + (c * h1) + tx;
        vertexData[3] = (d * h1) + (b * w0) + ty;

         // xy
        vertexData[4] = (a * w0) + (c * h0) + tx;
        vertexData[5] = (d * h0) + (b * w0) + ty;

        // xy
        vertexData[6] = (a * w1) + (c * h0) + tx;
        vertexData[7] = (d * h0) + (b * w1) + ty;
    }

    /**
     * calculates worldTransform * vertices for a non texture with a trim. store it in vertexTrimmedData
     * This is used to ensure that the true width and height of a trimmed texture is respected
     */
    calculateTrimmedVertices()
    {
        if (!this.vertexTrimmedData)
        {
            this.vertexTrimmedData = new Float32Array(8);
        }

        // lets do some special trim code!
        const texture = this._texture;
        const vertexData = this.vertexTrimmedData;
        const orig = texture.orig;

        // lets calculate the new untrimmed bounds..
        const wt = this.transform.worldTransform;
        const a = wt.a;
        const b = wt.b;
        const c = wt.c;
        const d = wt.d;
        const tx = wt.tx;
        const ty = wt.ty;

        const w0 = (orig.width) * (1 - this.anchor._x);
        const w1 = (orig.width) * -this.anchor._x;

        const h0 = orig.height * (1 - this.anchor._y);
        const h1 = orig.height * -this.anchor._y;

        // xy
        vertexData[0] = (a * w1) + (c * h1) + tx;
        vertexData[1] = (d * h1) + (b * w1) + ty;

        // xy
        vertexData[2] = (a * w0) + (c * h1) + tx;
        vertexData[3] = (d * h1) + (b * w0) + ty;

        // xy
        vertexData[4] = (a * w0) + (c * h0) + tx;
        vertexData[5] = (d * h0) + (b * w0) + ty;

        // xy
        vertexData[6] = (a * w1) + (c * h0) + tx;
        vertexData[7] = (d * h0) + (b * w1) + ty;
    }

    /**
    *
    * Renders the object using the WebGL renderer
    *
    * @private
    * @param {PIXI.WebGLRenderer} renderer - The webgl renderer to use.
    */
    _renderWebGL(renderer)
    {
        this.calculateVertices();

        renderer.setObjectRenderer(renderer.plugins.sprite);
        renderer.plugins.sprite.render(this);
    }

    /**
    * Renders the object using the Canvas renderer
    *
    * @private
    * @param {PIXI.CanvasRenderer} renderer - The renderer
    */
    _renderCanvas(renderer)
    {
        renderer.plugins.sprite.render(this);
    }

    /**
     * Updates the bounds of the sprite.
     *
     * @private
     */
    _calculateBounds()
    {
        const trim = this._texture.trim;
        const orig = this._texture.orig;

        // First lets check to see if the current texture has a trim..
        if (!trim || (trim.width === orig.width && trim.height === orig.height))
        {
            // no trim! lets use the usual calculations..
            this.calculateVertices();
            this._bounds.addQuad(this.vertexData);
        }
        else
        {
            // lets calculate a special trimmed bounds...
            this.calculateTrimmedVertices();
            this._bounds.addQuad(this.vertexTrimmedData);
        }
    }

    /**
     * Gets the local bounds of the sprite object.
     *
     * @param {Rectangle} rect - The output rectangle.
     * @return {Rectangle} The bounds.
     */
    getLocalBounds(rect)
    {
        // we can do a fast local bounds if the sprite has no children!
        if (this.children.length === 0)
        {
            this._bounds.minX = -this._texture.orig.width * this.anchor._x;
            this._bounds.minY = -this._texture.orig.height * this.anchor._y;
            this._bounds.maxX = this._texture.orig.width;
            this._bounds.maxY = this._texture.orig.height;

            if (!rect)
            {
                if (!this._localBoundsRect)
                {
                    this._localBoundsRect = new Rectangle();
                }

                rect = this._localBoundsRect;
            }

            return this._bounds.getRectangle(rect);
        }

        return super.getLocalBounds.call(this, rect);
    }

    /**
     * Tests if a point is inside this sprite
     *
     * @param {PIXI.Point} point - the point to test
     * @return {boolean} the result of the test
     */
    containsPoint(point)
    {
        this.worldTransform.applyInverse(point, tempPoint);

        const width = this._texture.orig.width;
        const height = this._texture.orig.height;
        const x1 = -width * this.anchor.x;
        let y1 = 0;

        if (tempPoint.x > x1 && tempPoint.x < x1 + width)
        {
            y1 = -height * this.anchor.y;

            if (tempPoint.y > y1 && tempPoint.y < y1 + height)
            {
                return true;
            }
        }

        return false;
    }

    /**
     * Destroys this sprite and optionally its texture and children
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
     *  have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have their destroy
     *      method called as well. 'options' will be passed on to those calls.
     * @param {boolean} [options.texture=false] - Should it destroy the current texture of the sprite as well
     * @param {boolean} [options.baseTexture=false] - Should it destroy the base texture of the sprite as well
     */
    destroy(options)
    {
        super.destroy(options);

        this._anchor = null;

        const destroyTexture = typeof options === 'boolean' ? options : options && options.texture;

        if (destroyTexture)
        {
            const destroyBaseTexture = typeof options === 'boolean' ? options : options && options.baseTexture;

            this._texture.destroy(!!destroyBaseTexture);
        }

        this._texture = null;
        this.shader = null;
    }

    // some helper functions..

    /**
     * Helper function that creates a new sprite based on the source you provide.
     * The source can be - frame id, image url, video url, canvas element, video element, base texture
     *
     * @static
     * @param {number|string|PIXI.BaseTexture|HTMLCanvasElement|HTMLVideoElement} source Source to create texture from
     * @return {PIXI.Texture} The newly created texture
     */
    static from(source)
    {
        return new Sprite(Texture.from(source));
    }

    /**
     * Helper function that creates a sprite that will contain a texture from the TextureCache based on the frameId
     * The frame ids are created when a Texture packer file has been loaded
     *
     * @static
     * @param {string} frameId - The frame Id of the texture in the cache
     * @return {PIXI.Sprite} A new Sprite using a texture from the texture cache matching the frameId
     */
    static fromFrame(frameId)
    {
        const texture = TextureCache[frameId];

        if (!texture)
        {
            throw new Error(`The frameId "${frameId}" does not exist in the texture cache`);
        }

        return new Sprite(texture);
    }

    /**
     * Helper function that creates a sprite that will contain a texture based on an image url
     * If the image is not in the texture cache it will be loaded
     *
     * @static
     * @param {string} imageId - The image url of the texture
     * @param {boolean} [crossorigin=(auto)] - if you want to specify the cross-origin parameter
     * @param {number} [scaleMode=PIXI.SCALE_MODES.DEFAULT] - if you want to specify the scale mode,
     *  see {@link PIXI.SCALE_MODES} for possible values
     * @return {PIXI.Sprite} A new Sprite using a texture from the texture cache matching the image id
     */
    static fromImage(imageId, crossorigin, scaleMode)
    {
        return new Sprite(Texture.fromImage(imageId, crossorigin, scaleMode));
    }

    /**
     * The width of the sprite, setting this will actually modify the scale to achieve the value set
     *
     * @member {number}
     * @memberof PIXI.Sprite#
     */
    get width()
    {
        return Math.abs(this.scale.x) * this.texture.orig.width;
    }

    /**
     * Sets the width of the sprite by modifying the scale.
     *
     * @param {number} value - The value to set to.
     */
    set width(value)
    {
        const s = sign(this.scale.x) || 1;

        this.scale.x = s * value / this.texture.orig.width;
        this._width = value;
    }

    /**
     * The height of the sprite, setting this will actually modify the scale to achieve the value set
     *
     * @member {number}
     * @memberof PIXI.Sprite#
     */
    get height()
    {
        return Math.abs(this.scale.y) * this.texture.orig.height;
    }

    /**
     * Sets the height of the sprite by modifying the scale.
     *
     * @param {number} value - The value to set to.
     */
    set height(value)
    {
        const s = sign(this.scale.y) || 1;

        this.scale.y = s * value / this.texture.orig.height;
        this._height = value;
    }

    /**
     * The anchor sets the origin point of the texture.
     * The default is 0,0 this means the texture's origin is the top left
     * Setting the anchor to 0.5,0.5 means the texture's origin is centered
     * Setting the anchor to 1,1 would mean the texture's origin point will be the bottom right corner
     *
     * @member {PIXI.ObservablePoint}
     * @memberof PIXI.Sprite#
     */
    get anchor()
    {
        return this._anchor;
    }

    /**
     * Copies the anchor to the sprite.
     *
     * @param {number} value - The value to set to.
     */
    set anchor(value)
    {
        this._anchor.copy(value);
    }

    /**
     * The tint applied to the sprite. This is a hex value. A value of
     * 0xFFFFFF will remove any tint effect.
     *
     * @member {number}
     * @memberof PIXI.Sprite#
     * @default 0xFFFFFF
     */
    get tint()
    {
        return this._tint;
    }

    /**
     * Sets the tint of the sprite.
     *
     * @param {number} value - The value to set to.
     */
    set tint(value)
    {
        this._tint = value;
        this._tintRGB = (value >> 16) + (value & 0xff00) + ((value & 0xff) << 16);
    }

    /**
     * The texture that the sprite is using
     *
     * @member {PIXI.Texture}
     * @memberof PIXI.Sprite#
     */
    get texture()
    {
        return this._texture;
    }

    /**
     * Sets the texture of the sprite.
     *
     * @param {PIXI.Texture} value - The value to set to.
     */
    set texture(value)
    {
        if (this._texture === value)
        {
            return;
        }

        this._texture = value;
        this.cachedTint = 0xFFFFFF;

        this._textureID = -1;

        if (value)
        {
            // wait for the texture to load
            if (value.baseTexture.hasLoaded)
            {
                this._onTextureUpdate();
            }
            else
            {
                value.once('update', this._onTextureUpdate, this);
            }
        }
    }
}

/**
 * @class Bounds
 * @memberof PIXI
 */
class Bounds
{
    /**
     *
     */
    constructor()
    {
        /**
         * @member {number}
         * @default 0
         */
        this.minX = Infinity;

        /**
         * @member {number}
         * @default 0
         */
        this.minY = Infinity;

        /**
         * @member {number}
         * @default 0
         */
        this.maxX = -Infinity;

        /**
         * @member {number}
         * @default 0
         */
        this.maxY = -Infinity;

        this.rect = null;
    }

    /**
     * Checks if bounds are empty.
     *
     * @return {boolean} True if empty.
     */
    isEmpty()
    {
        return this.minX > this.maxX || this.minY > this.maxY;
    }

    /**
     * Clears the bounds and resets.
     *
     */
    clear()
    {
        this.updateID++;

        this.minX = Infinity;
        this.minY = Infinity;
        this.maxX = -Infinity;
        this.maxY = -Infinity;
    }

    /**
     * Can return Rectangle.EMPTY constant, either construct new rectangle, either use your rectangle
     * It is not guaranteed that it will return tempRect
     *
     * @param {PIXI.Rectangle} rect - temporary object will be used if AABB is not empty
     * @returns {PIXI.Rectangle} A rectangle of the bounds
     */
    getRectangle(rect)
    {
        if (this.minX > this.maxX || this.minY > this.maxY)
        {
            return Rectangle.EMPTY;
        }

        rect = rect || new Rectangle(0, 0, 1, 1);

        rect.x = this.minX;
        rect.y = this.minY;
        rect.width = this.maxX - this.minX;
        rect.height = this.maxY - this.minY;

        return rect;
    }

    /**
     * This function should be inlined when its possible.
     *
     * @param {PIXI.Point} point - The point to add.
     */
    addPoint(point)
    {
        this.minX = Math.min(this.minX, point.x);
        this.maxX = Math.max(this.maxX, point.x);
        this.minY = Math.min(this.minY, point.y);
        this.maxY = Math.max(this.maxY, point.y);
    }

    /**
     * Adds a quad, not transformed
     *
     * @param {Float32Array} vertices - The verts to add.
     */
    addQuad(vertices)
    {
        let minX = this.minX;
        let minY = this.minY;
        let maxX = this.maxX;
        let maxY = this.maxY;

        let x = vertices[0];
        let y = vertices[1];

        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        x = vertices[2];
        y = vertices[3];
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        x = vertices[4];
        y = vertices[5];
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        x = vertices[6];
        y = vertices[7];
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
    }

    /**
     * Adds sprite frame, transformed.
     *
     * @param {PIXI.TransformBase} transform - TODO
     * @param {number} x0 - TODO
     * @param {number} y0 - TODO
     * @param {number} x1 - TODO
     * @param {number} y1 - TODO
     */
    addFrame(transform, x0, y0, x1, y1)
    {
        const matrix = transform.worldTransform;
        const a = matrix.a;
        const b = matrix.b;
        const c = matrix.c;
        const d = matrix.d;
        const tx = matrix.tx;
        const ty = matrix.ty;

        let minX = this.minX;
        let minY = this.minY;
        let maxX = this.maxX;
        let maxY = this.maxY;

        let x = (a * x0) + (c * y0) + tx;
        let y = (b * x0) + (d * y0) + ty;

        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        x = (a * x1) + (c * y0) + tx;
        y = (b * x1) + (d * y0) + ty;
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        x = (a * x0) + (c * y1) + tx;
        y = (b * x0) + (d * y1) + ty;
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        x = (a * x1) + (c * y1) + tx;
        y = (b * x1) + (d * y1) + ty;
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
    }

    /**
     * Add an array of vertices
     *
     * @param {PIXI.TransformBase} transform - TODO
     * @param {Float32Array} vertices - TODO
     * @param {number} beginOffset - TODO
     * @param {number} endOffset - TODO
     */
    addVertices(transform, vertices, beginOffset, endOffset)
    {
        const matrix = transform.worldTransform;
        const a = matrix.a;
        const b = matrix.b;
        const c = matrix.c;
        const d = matrix.d;
        const tx = matrix.tx;
        const ty = matrix.ty;

        let minX = this.minX;
        let minY = this.minY;
        let maxX = this.maxX;
        let maxY = this.maxY;

        for (let i = beginOffset; i < endOffset; i += 2)
        {
            const rawX = vertices[i];
            const rawY = vertices[i + 1];
            const x = (a * rawX) + (c * rawY) + tx;
            const y = (d * rawY) + (b * rawX) + ty;

            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
        }

        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;
    }

    /**
     * Adds other Bounds
     *
     * @param {PIXI.Bounds} bounds - TODO
     */
    addBounds(bounds)
    {
        const minX = this.minX;
        const minY = this.minY;
        const maxX = this.maxX;
        const maxY = this.maxY;

        this.minX = bounds.minX < minX ? bounds.minX : minX;
        this.minY = bounds.minY < minY ? bounds.minY : minY;
        this.maxX = bounds.maxX > maxX ? bounds.maxX : maxX;
        this.maxY = bounds.maxY > maxY ? bounds.maxY : maxY;
    }

    /**
     * Adds other Bounds, masked with Bounds
     *
     * @param {PIXI.Bounds} bounds - TODO
     * @param {PIXI.Bounds} mask - TODO
     */
    addBoundsMask(bounds, mask)
    {
        const _minX = bounds.minX > mask.minX ? bounds.minX : mask.minX;
        const _minY = bounds.minY > mask.minY ? bounds.minY : mask.minY;
        const _maxX = bounds.maxX < mask.maxX ? bounds.maxX : mask.maxX;
        const _maxY = bounds.maxY < mask.maxY ? bounds.maxY : mask.maxY;

        if (_minX <= _maxX && _minY <= _maxY)
        {
            const minX = this.minX;
            const minY = this.minY;
            const maxX = this.maxX;
            const maxY = this.maxY;

            this.minX = _minX < minX ? _minX : minX;
            this.minY = _minY < minY ? _minY : minY;
            this.maxX = _maxX > maxX ? _maxX : maxX;
            this.maxY = _maxY > maxY ? _maxY : maxY;
        }
    }

    /**
     * Adds other Bounds, masked with Rectangle
     *
     * @param {PIXI.Bounds} bounds - TODO
     * @param {PIXI.Rectangle} area - TODO
     */
    addBoundsArea(bounds, area)
    {
        const _minX = bounds.minX > area.x ? bounds.minX : area.x;
        const _minY = bounds.minY > area.y ? bounds.minY : area.y;
        const _maxX = bounds.maxX < area.x + area.width ? bounds.maxX : (area.x + area.width);
        const _maxY = bounds.maxY < area.y + area.height ? bounds.maxY : (area.y + area.height);

        if (_minX <= _maxX && _minY <= _maxY)
        {
            const minX = this.minX;
            const minY = this.minY;
            const maxX = this.maxX;
            const maxY = this.maxY;

            this.minX = _minX < minX ? _minX : minX;
            this.minY = _minY < minY ? _minY : minY;
            this.maxX = _maxX > maxX ? _maxX : maxX;
            this.maxY = _maxY > maxY ? _maxY : maxY;
        }
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
 * The Graphics class contains methods used to draw primitive shapes such as lines, circles and
 * rectangles to the display, and to color and fill them.
 *
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 */
let canvasRenderer;
const tempMatrix = new Matrix();
const tempPoint = new Point();
const tempColor1 = new Float32Array(4);
const tempColor2 = new Float32Array(4);

class Graphics extends Container
{
    /**
     *
     */
    constructor()
    {
        super();

        /**
         * The alpha value used when filling the Graphics object.
         *
         * @member {number}
         * @default 1
         */
        this.fillAlpha = 1;

        /**
         * The width (thickness) of any lines drawn.
         *
         * @member {number}
         * @default 0
         */
        this.lineWidth = 0;

        /**
         * The color of any lines drawn.
         *
         * @member {string}
         * @default 0
         */
        this.lineColor = 0;

        /**
         * Graphics data
         *
         * @member {PIXI.GraphicsData[]}
         * @private
         */
        this.graphicsData = [];

        /**
         * The tint applied to the graphic shape. This is a hex value. Apply a value of 0xFFFFFF to
         * reset the tint.
         *
         * @member {number}
         * @default 0xFFFFFF
         */
        this.tint = 0xFFFFFF;

        /**
         * The previous tint applied to the graphic shape. Used to compare to the current tint and
         * check if theres change.
         *
         * @member {number}
         * @private
         * @default 0xFFFFFF
         */
        this._prevTint = 0xFFFFFF;

        /**
         * The blend mode to be applied to the graphic shape. Apply a value of
         * `PIXI.BLEND_MODES.NORMAL` to reset the blend mode.
         *
         * @member {number}
         * @default PIXI.BLEND_MODES.NORMAL;
         * @see PIXI.BLEND_MODES
         */
        this.blendMode = BLEND_MODES.NORMAL;

        /**
         * Current path
         *
         * @member {PIXI.GraphicsData}
         * @private
         */
        this.currentPath = null;

        /**
         * Array containing some WebGL-related properties used by the WebGL renderer.
         *
         * @member {object<number, object>}
         * @private
         */
        // TODO - _webgl should use a prototype object, not a random undocumented object...
        this._webGL = {};

        /**
         * Whether this shape is being used as a mask.
         *
         * @member {boolean}
         */
        this.isMask = false;

        /**
         * The bounds' padding used for bounds calculation.
         *
         * @member {number}
         */
        this.boundsPadding = 0;

        /**
         * A cache of the local bounds to prevent recalculation.
         *
         * @member {PIXI.Rectangle}
         * @private
         */
        this._localBounds = new Bounds();

        /**
         * Used to detect if the graphics object has changed. If this is set to true then the graphics
         * object will be recalculated.
         *
         * @member {boolean}
         * @private
         */
        this.dirty = 0;

        /**
         * Used to detect if we need to do a fast rect check using the id compare method
         * @type {Number}
         */
        this.fastRectDirty = -1;

        /**
         * Used to detect if we clear the graphics webGL data
         * @type {Number}
         */
        this.clearDirty = 0;

        /**
         * Used to detect if we we need to recalculate local bounds
         * @type {Number}
         */
        this.boundsDirty = -1;

        /**
         * Used to detect if the cached sprite object needs to be updated.
         *
         * @member {boolean}
         * @private
         */
        this.cachedSpriteDirty = false;

        this._spriteRect = null;
        this._fastRect = false;

        /**
         * When cacheAsBitmap is set to true the graphics object will be rendered as if it was a sprite.
         * This is useful if your graphics element does not change often, as it will speed up the rendering
         * of the object in exchange for taking up texture memory. It is also useful if you need the graphics
         * object to be anti-aliased, because it will be rendered using canvas. This is not recommended if
         * you are constantly redrawing the graphics element.
         *
         * @name cacheAsBitmap
         * @member {boolean}
         * @memberof PIXI.Graphics#
         * @default false
         */
    }

    /**
     * Creates a new Graphics object with the same values as this one.
     * Note that the only the properties of the object are cloned, not its transform (position,scale,etc)
     *
     * @return {PIXI.Graphics} A clone of the graphics object
     */
    clone()
    {
        const clone = new Graphics();

        clone.renderable = this.renderable;
        clone.fillAlpha = this.fillAlpha;
        clone.lineWidth = this.lineWidth;
        clone.lineColor = this.lineColor;
        clone.tint = this.tint;
        clone.blendMode = this.blendMode;
        clone.isMask = this.isMask;
        clone.boundsPadding = this.boundsPadding;
        clone.dirty = 0;
        clone.cachedSpriteDirty = this.cachedSpriteDirty;

        // copy graphics data
        for (let i = 0; i < this.graphicsData.length; ++i)
        {
            clone.graphicsData.push(this.graphicsData[i].clone());
        }

        clone.currentPath = clone.graphicsData[clone.graphicsData.length - 1];

        clone.updateLocalBounds();

        return clone;
    }

    /**
     * Specifies the line style used for subsequent calls to Graphics methods such as the lineTo()
     * method or the drawCircle() method.
     *
     * @param {number} [lineWidth=0] - width of the line to draw, will update the objects stored style
     * @param {number} [color=0] - color of the line to draw, will update the objects stored style
     * @param {number} [alpha=1] - alpha of the line to draw, will update the objects stored style
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    lineStyle(lineWidth = 0, color = 0, alpha = 1)
    {
        this.lineWidth = lineWidth;
        this.lineColor = color;
        this.lineAlpha = alpha;

        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length)
            {
                // halfway through a line? start a new one!
                const shape = new Polygon(this.currentPath.shape.points.slice(-2));

                shape.closed = false;

                this.drawShape(shape);
            }
            else
            {
                // otherwise its empty so lets just set the line properties
                this.currentPath.lineWidth = this.lineWidth;
                this.currentPath.lineColor = this.lineColor;
                this.currentPath.lineAlpha = this.lineAlpha;
            }
        }

        return this;
    }

    /**
     * Moves the current drawing position to x, y.
     *
     * @param {number} x - the X coordinate to move to
     * @param {number} y - the Y coordinate to move to
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    moveTo(x, y)
    {
        const shape = new Polygon([x, y]);

        shape.closed = false;
        this.drawShape(shape);

        return this;
    }

    /**
     * Draws a line using the current line style from the current drawing position to (x, y);
     * The current drawing position is then set to (x, y).
     *
     * @param {number} x - the X coordinate to draw to
     * @param {number} y - the Y coordinate to draw to
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    lineTo(x, y)
    {
        this.currentPath.shape.points.push(x, y);
        this.dirty++;

        return this;
    }

    /**
     * Calculate the points for a quadratic bezier curve and then draws it.
     * Based on: https://stackoverflow.com/questions/785097/how-do-i-implement-a-bezier-curve-in-c
     *
     * @param {number} cpX - Control point x
     * @param {number} cpY - Control point y
     * @param {number} toX - Destination point x
     * @param {number} toY - Destination point y
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    quadraticCurveTo(cpX, cpY, toX, toY)
    {
        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length === 0)
            {
                this.currentPath.shape.points = [0, 0];
            }
        }
        else
        {
            this.moveTo(0, 0);
        }

        const n = 20;
        const points = this.currentPath.shape.points;
        let xa = 0;
        let ya = 0;

        if (points.length === 0)
        {
            this.moveTo(0, 0);
        }

        const fromX = points[points.length - 2];
        const fromY = points[points.length - 1];

        for (let i = 1; i <= n; ++i)
        {
            const j = i / n;

            xa = fromX + ((cpX - fromX) * j);
            ya = fromY + ((cpY - fromY) * j);

            points.push(xa + (((cpX + ((toX - cpX) * j)) - xa) * j),
                ya + (((cpY + ((toY - cpY) * j)) - ya) * j));
        }

        this.dirty++;

        return this;
    }

    /**
     * Calculate the points for a bezier curve and then draws it.
     *
     * @param {number} cpX - Control point x
     * @param {number} cpY - Control point y
     * @param {number} cpX2 - Second Control point x
     * @param {number} cpY2 - Second Control point y
     * @param {number} toX - Destination point x
     * @param {number} toY - Destination point y
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    bezierCurveTo(cpX, cpY, cpX2, cpY2, toX, toY)
    {
        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length === 0)
            {
                this.currentPath.shape.points = [0, 0];
            }
        }
        else
        {
            this.moveTo(0, 0);
        }

        const points = this.currentPath.shape.points;

        const fromX = points[points.length - 2];
        const fromY = points[points.length - 1];

        points.length -= 2;

        bezierCurveTo(fromX, fromY, cpX, cpY, cpX2, cpY2, toX, toY, points);

        this.dirty++;

        return this;
    }

    /**
     * The arcTo() method creates an arc/curve between two tangents on the canvas.
     *
     * "borrowed" from https://code.google.com/p/fxcanvas/ - thanks google!
     *
     * @param {number} x1 - The x-coordinate of the beginning of the arc
     * @param {number} y1 - The y-coordinate of the beginning of the arc
     * @param {number} x2 - The x-coordinate of the end of the arc
     * @param {number} y2 - The y-coordinate of the end of the arc
     * @param {number} radius - The radius of the arc
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    arcTo(x1, y1, x2, y2, radius)
    {
        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length === 0)
            {
                this.currentPath.shape.points.push(x1, y1);
            }
        }
        else
        {
            this.moveTo(x1, y1);
        }

        const points = this.currentPath.shape.points;
        const fromX = points[points.length - 2];
        const fromY = points[points.length - 1];
        const a1 = fromY - y1;
        const b1 = fromX - x1;
        const a2 = y2 - y1;
        const b2 = x2 - x1;
        const mm = Math.abs((a1 * b2) - (b1 * a2));

        if (mm < 1.0e-8 || radius === 0)
        {
            if (points[points.length - 2] !== x1 || points[points.length - 1] !== y1)
            {
                points.push(x1, y1);
            }
        }
        else
        {
            const dd = (a1 * a1) + (b1 * b1);
            const cc = (a2 * a2) + (b2 * b2);
            const tt = (a1 * a2) + (b1 * b2);
            const k1 = radius * Math.sqrt(dd) / mm;
            const k2 = radius * Math.sqrt(cc) / mm;
            const j1 = k1 * tt / dd;
            const j2 = k2 * tt / cc;
            const cx = (k1 * b2) + (k2 * b1);
            const cy = (k1 * a2) + (k2 * a1);
            const px = b1 * (k2 + j1);
            const py = a1 * (k2 + j1);
            const qx = b2 * (k1 + j2);
            const qy = a2 * (k1 + j2);
            const startAngle = Math.atan2(py - cy, px - cx);
            const endAngle = Math.atan2(qy - cy, qx - cx);

            this.arc(cx + x1, cy + y1, radius, startAngle, endAngle, b1 * a2 > b2 * a1);
        }

        this.dirty++;

        return this;
    }

    /**
     * The arc method creates an arc/curve (used to create circles, or parts of circles).
     *
     * @param {number} cx - The x-coordinate of the center of the circle
     * @param {number} cy - The y-coordinate of the center of the circle
     * @param {number} radius - The radius of the circle
     * @param {number} startAngle - The starting angle, in radians (0 is at the 3 o'clock position
     *  of the arc's circle)
     * @param {number} endAngle - The ending angle, in radians
     * @param {boolean} [anticlockwise=false] - Specifies whether the drawing should be
     *  counter-clockwise or clockwise. False is default, and indicates clockwise, while true
     *  indicates counter-clockwise.
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    arc(cx, cy, radius, startAngle, endAngle, anticlockwise = false)
    {
        if (startAngle === endAngle)
        {
            return this;
        }

        if (!anticlockwise && endAngle <= startAngle)
        {
            endAngle += Math.PI * 2;
        }
        else if (anticlockwise && startAngle <= endAngle)
        {
            startAngle += Math.PI * 2;
        }

        const sweep = anticlockwise ? (startAngle - endAngle) * -1 : (endAngle - startAngle);
        const segs = Math.ceil(Math.abs(sweep) / (Math.PI * 2)) * 40;

        if (sweep === 0)
        {
            return this;
        }

        const startX = cx + (Math.cos(startAngle) * radius);
        const startY = cy + (Math.sin(startAngle) * radius);

        if (this.currentPath)
        {
            this.currentPath.shape.points.push(startX, startY);
        }
        else
        {
            this.moveTo(startX, startY);
        }

        const points = this.currentPath.shape.points;

        const theta = sweep / (segs * 2);
        const theta2 = theta * 2;

        const cTheta = Math.cos(theta);
        const sTheta = Math.sin(theta);

        const segMinus = segs - 1;

        const remainder = (segMinus % 1) / segMinus;

        for (let i = 0; i <= segMinus; ++i)
        {
            const real = i + (remainder * i);

            const angle = ((theta) + startAngle + (theta2 * real));

            const c = Math.cos(angle);
            const s = -Math.sin(angle);

            points.push(
                (((cTheta * c) + (sTheta * s)) * radius) + cx,
                (((cTheta * -s) + (sTheta * c)) * radius) + cy
            );
        }

        this.dirty++;

        return this;
    }

    /**
     * Specifies a simple one-color fill that subsequent calls to other Graphics methods
     * (such as lineTo() or drawCircle()) use when drawing.
     *
     * @param {number} [color=0] - the color of the fill
     * @param {number} [alpha=1] - the alpha of the fill
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    beginFill(color = 0, alpha = 1)
    {
        this.filling = true;
        this.fillColor = color;
        this.fillAlpha = alpha;

        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length <= 2)
            {
                this.currentPath.fill = this.filling;
                this.currentPath.fillColor = this.fillColor;
                this.currentPath.fillAlpha = this.fillAlpha;
            }
        }

        return this;
    }

    /**
     * Applies a fill to the lines and shapes that were added since the last call to the beginFill() method.
     *
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    endFill()
    {
        this.filling = false;
        this.fillColor = null;
        this.fillAlpha = 1;

        return this;
    }

    /**
     *
     * @param {number} x - The X coord of the top-left of the rectangle
     * @param {number} y - The Y coord of the top-left of the rectangle
     * @param {number} width - The width of the rectangle
     * @param {number} height - The height of the rectangle
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    drawRect(x, y, width, height)
    {
        this.drawShape(new Rectangle(x, y, width, height));

        return this;
    }

    /**
     *
     * @param {number} x - The X coord of the top-left of the rectangle
     * @param {number} y - The Y coord of the top-left of the rectangle
     * @param {number} width - The width of the rectangle
     * @param {number} height - The height of the rectangle
     * @param {number} radius - Radius of the rectangle corners
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    drawRoundedRect(x, y, width, height, radius)
    {
        this.drawShape(new RoundedRectangle(x, y, width, height, radius));

        return this;
    }

    /**
     * Draws a circle.
     *
     * @param {number} x - The X coordinate of the center of the circle
     * @param {number} y - The Y coordinate of the center of the circle
     * @param {number} radius - The radius of the circle
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    drawCircle(x, y, radius)
    {
        this.drawShape(new Circle(x, y, radius));

        return this;
    }

    /**
     * Draws an ellipse.
     *
     * @param {number} x - The X coordinate of the center of the ellipse
     * @param {number} y - The Y coordinate of the center of the ellipse
     * @param {number} width - The half width of the ellipse
     * @param {number} height - The half height of the ellipse
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    drawEllipse(x, y, width, height)
    {
        this.drawShape(new Ellipse(x, y, width, height));

        return this;
    }

    /**
     * Draws a polygon using the given path.
     *
     * @param {number[]|PIXI.Point[]} path - The path data used to construct the polygon.
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    drawPolygon(path)
    {
        // prevents an argument assignment deopt
        // see section 3.1: https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
        let points = path;

        let closed = true;

        if (points instanceof Polygon)
        {
            closed = points.closed;
            points = points.points;
        }

        if (!Array.isArray(points))
        {
            // prevents an argument leak deopt
            // see section 3.2: https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
            points = new Array(arguments.length);

            for (let i = 0; i < points.length; ++i)
            {
                points[i] = arguments[i]; // eslint-disable-line prefer-rest-params
            }
        }

        const shape = new Polygon(points);

        shape.closed = closed;

        this.drawShape(shape);

        return this;
    }

    /**
     * Clears the graphics that were drawn to this Graphics object, and resets fill and line style settings.
     *
     * @return {PIXI.Graphics} This Graphics object. Good for chaining method calls
     */
    clear()
    {
        if (this.lineWidth || this.filling || this.graphicsData.length > 0)
        {
            this.lineWidth = 0;
            this.filling = false;

            this.dirty++;
            this.clearDirty++;
            this.graphicsData.length = 0;
        }

        return this;
    }

    /**
     * True if graphics consists of one rectangle, and thus, can be drawn like a Sprite and
     * masked with gl.scissor.
     *
     * @returns {boolean} True if only 1 rect.
     */
    isFastRect()
    {
        return this.graphicsData.length === 1
            && this.graphicsData[0].shape.type === SHAPES.RECT
            && !this.graphicsData[0].lineWidth;
    }

    /**
     * Renders the object using the WebGL renderer
     *
     * @private
     * @param {PIXI.WebGLRenderer} renderer - The renderer
     */
    _renderWebGL(renderer)
    {
        // if the sprite is not visible or the alpha is 0 then no need to render this element
        if (this.dirty !== this.fastRectDirty)
        {
            this.fastRectDirty = this.dirty;
            this._fastRect = this.isFastRect();
        }

        // TODO this check can be moved to dirty?
        if (this._fastRect)
        {
            this._renderSpriteRect(renderer);
        }
        else
        {
            renderer.setObjectRenderer(renderer.plugins.graphics);
            renderer.plugins.graphics.render(this);
        }
    }

    /**
     * Renders a sprite rectangle.
     *
     * @private
     * @param {PIXI.WebGLRenderer} renderer - The renderer
     */
    _renderSpriteRect(renderer)
    {
        const rect = this.graphicsData[0].shape;

        if (!this._spriteRect)
        {
            if (!Graphics._SPRITE_TEXTURE)
            {
                Graphics._SPRITE_TEXTURE = RenderTexture.create(10, 10);

                const canvas = document.createElement('canvas');

                canvas.width = 10;
                canvas.height = 10;

                const context = canvas.getContext('2d');

                context.fillStyle = 'white';
                context.fillRect(0, 0, 10, 10);

                Graphics._SPRITE_TEXTURE = Texture.fromCanvas(canvas);
            }

            this._spriteRect = new Sprite(Graphics._SPRITE_TEXTURE);
        }
        if (this.tint === 0xffffff)
        {
            this._spriteRect.tint = this.graphicsData[0].fillColor;
        }
        else
        {
            const t1 = tempColor1;
            const t2 = tempColor2;

            hex2rgb(this.graphicsData[0].fillColor, t1);
            hex2rgb(this.tint, t2);

            t1[0] *= t2[0];
            t1[1] *= t2[1];
            t1[2] *= t2[2];

            this._spriteRect.tint = rgb2hex(t1);
        }
        this._spriteRect.alpha = this.graphicsData[0].fillAlpha;
        this._spriteRect.worldAlpha = this.worldAlpha * this._spriteRect.alpha;

        Graphics._SPRITE_TEXTURE._frame.width = rect.width;
        Graphics._SPRITE_TEXTURE._frame.height = rect.height;

        this._spriteRect.transform.worldTransform = this.transform.worldTransform;

        this._spriteRect.anchor.set(-rect.x / rect.width, -rect.y / rect.height);
        this._spriteRect._onAnchorUpdate();

        this._spriteRect._renderWebGL(renderer);
    }

    /**
     * Renders the object using the Canvas renderer
     *
     * @private
     * @param {PIXI.CanvasRenderer} renderer - The renderer
     */
    _renderCanvas(renderer)
    {
        if (this.isMask === true)
        {
            return;
        }

        renderer.plugins.graphics.render(this);
    }

    /**
     * Retrieves the bounds of the graphic shape as a rectangle object
     *
     * @private
     */
    _calculateBounds()
    {
        if (this.boundsDirty !== this.dirty)
        {
            this.boundsDirty = this.dirty;
            this.updateLocalBounds();

            this.dirty++;
            this.cachedSpriteDirty = true;
        }

        const lb = this._localBounds;

        this._bounds.addFrame(this.transform, lb.minX, lb.minY, lb.maxX, lb.maxY);
    }

    /**
     * Tests if a point is inside this graphics object
     *
     * @param {PIXI.Point} point - the point to test
     * @return {boolean} the result of the test
     */
    containsPoint(point)
    {
        this.worldTransform.applyInverse(point, tempPoint);

        const graphicsData = this.graphicsData;

        for (let i = 0; i < graphicsData.length; ++i)
        {
            const data = graphicsData[i];

            if (!data.fill)
            {
                continue;
            }

            // only deal with fills..
            if (data.shape)
            {
                if (data.shape.contains(tempPoint.x, tempPoint.y))
                {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Update the bounds of the object
     *
     */
    updateLocalBounds()
    {
        let minX = Infinity;
        let maxX = -Infinity;

        let minY = Infinity;
        let maxY = -Infinity;

        if (this.graphicsData.length)
        {
            let shape = 0;
            let x = 0;
            let y = 0;
            let w = 0;
            let h = 0;

            for (let i = 0; i < this.graphicsData.length; i++)
            {
                const data = this.graphicsData[i];
                const type = data.type;
                const lineWidth = data.lineWidth;

                shape = data.shape;

                if (type === SHAPES.RECT || type === SHAPES.RREC)
                {
                    x = shape.x - (lineWidth / 2);
                    y = shape.y - (lineWidth / 2);
                    w = shape.width + lineWidth;
                    h = shape.height + lineWidth;

                    minX = x < minX ? x : minX;
                    maxX = x + w > maxX ? x + w : maxX;

                    minY = y < minY ? y : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                }
                else if (type === SHAPES.CIRC)
                {
                    x = shape.x;
                    y = shape.y;
                    w = shape.radius + (lineWidth / 2);
                    h = shape.radius + (lineWidth / 2);

                    minX = x - w < minX ? x - w : minX;
                    maxX = x + w > maxX ? x + w : maxX;

                    minY = y - h < minY ? y - h : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                }
                else if (type === SHAPES.ELIP)
                {
                    x = shape.x;
                    y = shape.y;
                    w = shape.width + (lineWidth / 2);
                    h = shape.height + (lineWidth / 2);

                    minX = x - w < minX ? x - w : minX;
                    maxX = x + w > maxX ? x + w : maxX;

                    minY = y - h < minY ? y - h : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                }
                else
                {
                    // POLY
                    const points = shape.points;

                    for (let j = 0; j < points.length; j += 2)
                    {
                        x = points[j];
                        y = points[j + 1];

                        minX = x - lineWidth < minX ? x - lineWidth : minX;
                        maxX = x + lineWidth > maxX ? x + lineWidth : maxX;

                        minY = y - lineWidth < minY ? y - lineWidth : minY;
                        maxY = y + lineWidth > maxY ? y + lineWidth : maxY;
                    }
                }
            }
        }
        else
        {
            minX = 0;
            maxX = 0;
            minY = 0;
            maxY = 0;
        }

        const padding = this.boundsPadding;

        this._localBounds.minX = minX - padding;
        this._localBounds.maxX = maxX + (padding * 2);

        this._localBounds.minY = minY - padding;
        this._localBounds.maxY = maxY + (padding * 2);
    }

    /**
     * Draws the given shape to this Graphics object. Can be any of Circle, Rectangle, Ellipse, Line or Polygon.
     *
     * @param {PIXI.Circle|PIXI.Ellipse|PIXI.Polygon|PIXI.Rectangle|PIXI.RoundedRectangle} shape - The shape object to draw.
     * @return {PIXI.GraphicsData} The generated GraphicsData object.
     */
    drawShape(shape)
    {
        if (this.currentPath)
        {
            // check current path!
            if (this.currentPath.shape.points.length <= 2)
            {
                this.graphicsData.pop();
            }
        }

        this.currentPath = null;

        const data = new GraphicsData(
            this.lineWidth,
            this.lineColor,
            this.lineAlpha,
            this.fillColor,
            this.fillAlpha,
            this.filling,
            shape
        );

        this.graphicsData.push(data);

        if (data.type === SHAPES.POLY)
        {
            data.shape.closed = data.shape.closed || this.filling;
            this.currentPath = data;
        }

        this.dirty++;

        return data;
    }

    /**
     * Generates a canvas texture.
     *
     * @param {number} scaleMode - The scale mode of the texture.
     * @param {number} resolution - The resolution of the texture.
     * @return {PIXI.Texture} The new texture.
     */
    generateCanvasTexture(scaleMode, resolution = 1)
    {
        const bounds = this.getLocalBounds();

        const canvasBuffer = RenderTexture.create(bounds.width, bounds.height, scaleMode, resolution);

        if (!canvasRenderer)
        {
            canvasRenderer = new CanvasRenderer();
        }

        tempMatrix.tx = -bounds.x;
        tempMatrix.ty = -bounds.y;

        canvasRenderer.render(this, canvasBuffer, false, tempMatrix);

        const texture = Texture.fromCanvas(canvasBuffer.baseTexture._canvasRenderTarget.canvas, scaleMode);

        texture.baseTexture.resolution = resolution;
        texture.baseTexture.update();

        return texture;
    }

    /**
     * Closes the current path.
     *
     * @return {PIXI.Graphics} Returns itself.
     */
    closePath()
    {
        // ok so close path assumes next one is a hole!
        const currentPath = this.currentPath;

        if (currentPath && currentPath.shape)
        {
            currentPath.shape.close();
        }

        return this;
    }

    /**
     * Adds a hole in the current path.
     *
     * @return {PIXI.Graphics} Returns itself.
     */
    addHole()
    {
        // this is a hole!
        const hole = this.graphicsData.pop();

        this.currentPath = this.graphicsData[this.graphicsData.length - 1];

        this.currentPath.addHole(hole.shape);
        this.currentPath = null;

        return this;
    }

    /**
     * Destroys the Graphics object.
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all
     *  options have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have
     *  their destroy method called as well. 'options' will be passed on to those calls.
     */
    destroy(options)
    {
        super.destroy(options);

        // destroy each of the GraphicsData objects
        for (let i = 0; i < this.graphicsData.length; ++i)
        {
            this.graphicsData[i].destroy();
        }

        // for each webgl data entry, destroy the WebGLGraphicsData
        for (const id in this._webgl)
        {
            for (let j = 0; j < this._webgl[id].data.length; ++j)
            {
                this._webgl[id].data[j].destroy();
            }
        }

        if (this._spriteRect)
        {
            this._spriteRect.destroy();
        }

        this.graphicsData = null;

        this.currentPath = null;
        this._webgl = null;
        this._localBounds = null;
    }

}

Graphics._SPRITE_TEXTURE = null;

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
