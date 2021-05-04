"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Map = void 0;
class Map {
    constructor() {
        this.version = null;
        this.orientation = 'orthogonal';
        this.width = 0;
        this.height = 0;
        this.tileWidth = 0;
        this.tileHeight = 0;
        this.backgroundColor = null;
        this.layers = [];
        this.properties = {};
        this.tileSets = [];
    }
}
exports.Map = Map;
