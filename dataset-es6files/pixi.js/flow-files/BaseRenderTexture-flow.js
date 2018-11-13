import BaseTexture from './BaseTexture';
import { RESOLUTION, SCALE_MODES } from '../const';

/**
 * A BaseRenderTexture is a special texture that allows any Pixi display object to be rendered to it.
 *
 * @class
 * @extends PIXI.BaseTexture
 * @memberof PIXI
 */
class BaseRenderTexture extends BaseTexture
{
    /**
     * @param {number} [width=100] - The width of the base render texture
     * @param {number} [height=100] - The height of the base render texture
     * @param {number} [scaleMode=PIXI.SCALE_MODES.DEFAULT] - See {@link PIXI.SCALE_MODES} for possible values
     * @param {number} [resolution=1] - The resolution / device pixel ratio of the texture being generated
     */
    constructor(width = 100, height = 100, scaleMode, resolution)
    {
        super(null, scaleMode);

        this.resolution = resolution || RESOLUTION;

        this.width = width;
        this.height = height;

        this.realWidth = this.width * this.resolution;
        this.realHeight = this.height * this.resolution;

        this.scaleMode = scaleMode || SCALE_MODES.DEFAULT;
        this.hasLoaded = true;

        /**
         * A map of renderer IDs to webgl renderTargets
         *
         * @member {object<number, WebGLTexture>}
         * @private
         */
        this._glRenderTargets = [];

        /**
         * A reference to the canvas render target (we only need one as this can be shared accross renderers)
         *
         * @member {object<number, WebGLTexture>}
         * @private
         */
        this._canvasRenderTarget = null;

        /**
         * This will let the renderer know if the texture is valid. If it's not then it cannot be rendered.
         *
         * @member {boolean}
         */
        this.valid = false;
    }

    /**
     * Resizes the BaseRenderTexture.
     *
     * @param {number} width - The width to resize to.
     * @param {number} height - The height to resize to.
     */
    resize(width, height)
    {
        if (width === this.width && height === this.height)
        {
            return;
        }

        this.valid = (width > 0 && height > 0);

        this.width = width;
        this.height = height;

        this.realWidth = this.width * this.resolution;
        this.realHeight = this.height * this.resolution;

        if (!this.valid)
        {
            return;
        }

        this.emit('update', this);
    }

    /**
     * Destroys this texture
     *
     */
    destroy()
    {
        super.destroy(true);
        this.renderer = null;
    }
}
