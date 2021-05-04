"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageLayer = void 0;
const layer_1 = require("./layer");
class ImageLayer extends layer_1.Layer {
    constructor() {
        super('image');
        this.x = 0;
        this.y = 0;
        this.image = null;
    }
}
exports.ImageLayer = ImageLayer;
