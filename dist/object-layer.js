"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectLayer = void 0;
const layer_1 = require("./layer");
class ObjectLayer extends layer_1.Layer {
    constructor() {
        super('object');
        this.color = null;
        this.objects = [];
    }
}
exports.ObjectLayer = ObjectLayer;
