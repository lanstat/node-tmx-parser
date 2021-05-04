"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TileLayer = void 0;
const layer_1 = require("./layer");
class TileLayer extends layer_1.Layer {
    constructor(map) {
        super('tile');
        this.map = map;
        const tileCount = map.width * map.height;
        this.tiles = Array(tileCount);
        this.horizontalFlips = Array(tileCount);
        this.verticalFlips = Array(tileCount);
        this.diagonalFlips = Array(tileCount);
    }
    tileAt(x, y) {
        return this.tiles[y * this.map.width + x];
    }
    setTileAt(x, y, tile) {
        this.tiles[y * this.map.width + x] = tile;
    }
}
exports.TileLayer = TileLayer;
