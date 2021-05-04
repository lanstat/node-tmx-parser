"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tile = void 0;
class Tile {
    constructor() {
        this.gid = 0;
        this.id = 0;
        this.terrain = [];
        this.probability = null;
        this.properties = {};
        this.animations = [];
        this.objectGroups = [];
        this.image = null;
    }
}
exports.Tile = Tile;
