"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Layer = void 0;
class Layer {
    constructor(type) {
        this.name = null;
        this.opacity = 1;
        this.visible = true;
        this.properties = {};
        this.type = type;
    }
}
exports.Layer = Layer;
