"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TileSet = void 0;
class TileSet {
    constructor() {
        this.firstGid = 0;
        this.source = '';
        this.name = '';
        this.tileWidth = 0;
        this.tileHeight = 0;
        this.spacing = 0;
        this.margin = 0;
        this.tileOffset = {
            x: 0,
            y: 0,
        };
        this.properties = {};
        this.image = null;
        this.tiles = [];
        this.terrainTypes = [];
    }
    mergeTo(other) {
        other.firstGid = this.firstGid == null ? other.firstGid : this.firstGid;
        other.source = this.source == null ? other.source : this.source;
        other.name = this.name == null ? other.name : this.name;
        other.tileWidth = this.tileWidth == null ? other.tileWidth : this.tileWidth;
        other.tileHeight = this.tileHeight == null ? other.tileHeight : this.tileHeight;
        other.spacing = this.spacing == null ? other.spacing : this.spacing;
        other.margin = this.margin == null ? other.margin : this.margin;
        other.tileOffset = this.tileOffset == null ? other.tileOffset : this.tileOffset;
        other.properties = this.properties == null ? other.properties : this.properties;
        other.image = this.image == null ? other.image : this.image;
        other.tiles = this.tiles == null ? other.tiles : this.tiles;
        other.terrainTypes = this.terrainTypes == null ? other.terrainTypes : this.terrainTypes;
    }
}
exports.TileSet = TileSet;
