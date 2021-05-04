"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFile = exports.parse = void 0;
const map_1 = require("./map");
const tileset_1 = require("./tileset");
const tmx_object_1 = require("./tmx-object");
const utils_1 = require("./utils");
const tile_1 = require("./tile");
const terrain_1 = require("./terrain");
const tilelayer_1 = require("./tilelayer");
const object_layer_1 = require("./object-layer");
const image_layer_1 = require("./image-layer");
const image_1 = require("./image");
const fs_1 = require("fs");
const path_1 = require("path");
const zlib_1 = require("zlib");
const Pend = __importStar(require("pend"));
const sax_1 = require("sax");
const zstd_codec_1 = require("zstd-codec");
const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG = 0x20000000;
let STATE_COUNT = 0;
const STATE_START = STATE_COUNT++;
const STATE_MAP = STATE_COUNT++;
const STATE_COLLECT_PROPS = STATE_COUNT++;
const STATE_COLLECT_ANIMATIONS = STATE_COUNT++;
const STATE_COLLECT_OBJECT_GROUPS = STATE_COUNT++;
const STATE_WAIT_FOR_CLOSE = STATE_COUNT++;
const STATE_TILESET = STATE_COUNT++;
const STATE_TILE = STATE_COUNT++;
const STATE_TILE_LAYER = STATE_COUNT++;
const STATE_OBJECT_LAYER = STATE_COUNT++;
const STATE_OBJECT = STATE_COUNT++;
const STATE_TILE_OBJECT = STATE_COUNT++;
const STATE_IMAGE_LAYER = STATE_COUNT++;
const STATE_TILE_DATA_XML = STATE_COUNT++;
const STATE_TILE_DATA_CSV = STATE_COUNT++;
const STATE_TILE_DATA_B64_RAW = STATE_COUNT++;
const STATE_TILE_DATA_B64_GZIP = STATE_COUNT++;
const STATE_TILE_DATA_B64_ZLIB = STATE_COUNT++;
const STATE_TILE_DATA_B64_ZSTD = STATE_COUNT++;
const STATE_TERRAIN_TYPES = STATE_COUNT++;
const STATE_TERRAIN = STATE_COUNT++;
function defaultReadFile(name, cb) {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) {
        fetch(name)
            .then((response) => response.text())
            .then((data) => {
            cb(undefined, data);
        })
            .catch((e) => cb(e, null));
    }
    else {
        fs_1.readFile(name, { encoding: 'utf8' }, cb);
    }
}
class Tmx {
    constructor() {
        this.topLevelObject = null;
        this.state = STATE_START;
        this.states = Array(STATE_COUNT);
        this.waitForCloseNextState = 0;
        this.waitForCloseOpenCount = 0;
        this.propertiesObject = null;
        this.propertiesNextState = 0;
        this.animationsObject = null;
        this.animationsNextState = 0;
        this.objectGroupsObject = null;
        this.objectGroupsNextState = 0;
        this.tileIndex = 0;
        this.tileSet = null;
        this.tileSetNextState = 0;
        this.pend = new Pend.default();
        // this holds the numerical tile ids
        // later we use it to resolve the real tiles
        this.unresolvedLayers = [];
        this.unresolvedLayer = null;
        this.initialize();
    }
    parse(content, pathToFile, cb) {
        this.callback = cb;
        this.pathToDir = path_1.dirname(pathToFile);
        this.parser = sax_1.parser();
        this.parser.onerror = this.callback;
        this.parser.onopentag = (tag) => {
            this.states[this.state].opentag(tag);
        };
        this.parser.onclosetag = (name) => {
            this.states[this.state].closetag(name);
        };
        this.parser.ontext = (text) => {
            this.states[this.state].text(text);
        };
        this.parser.onend = () => {
            // wait until async stuff has finished
            this.pend.wait((err) => {
                if (err) {
                    this.callback(err);
                    return;
                }
                // now all tilesets are resolved and all data is decoded
                this.unresolvedLayers.forEach((unresolvedLayer) => {
                    if (this.map == null) {
                        return;
                    }
                    for (let i = 0; i < unresolvedLayer.tiles.length; i += 1) {
                        const globalTileId = unresolvedLayer.tiles[i];
                        for (let tileSetIndex = this.map.tileSets.length - 1; tileSetIndex >= 0; tileSetIndex -= 1) {
                            const tileSet = this.map.tileSets[tileSetIndex];
                            if (tileSet.firstGid <= globalTileId) {
                                const tileId = globalTileId - tileSet.firstGid;
                                let tile = tileSet.tiles[tileId];
                                if (!tile) {
                                    // implicit tile
                                    tile = new tile_1.Tile();
                                    tile.id = tileId;
                                    tileSet.tiles[tileId] = tile;
                                }
                                tile.gid = globalTileId;
                                unresolvedLayer.layer.tiles[i] = tile;
                                break;
                            }
                        }
                    }
                });
                this.callback(null, this.topLevelObject);
            });
        };
        this.parser.write(content).close();
    }
    initialize() {
        this.states[STATE_START] = {
            closetag: utils_1.noop,
            opentag: (tag) => {
                if (tag.name === 'MAP') {
                    this.map = new map_1.Map();
                    this.topLevelObject = this.map;
                    this.map.version = tag.attributes.VERSION;
                    this.map.orientation = tag.attributes.ORIENTATION;
                    this.map.width = utils_1.int(tag.attributes.WIDTH);
                    this.map.height = utils_1.int(tag.attributes.HEIGHT);
                    this.map.tileWidth = utils_1.int(tag.attributes.TILEWIDTH);
                    this.map.tileHeight = utils_1.int(tag.attributes.TILEHEIGHT);
                    this.map.backgroundColor = tag.attributes.BACKGROUNDCOLOR;
                    this.state = STATE_MAP;
                }
                else if (tag.name === 'TILESET') {
                    this.collectTileSet(tag, STATE_START);
                    this.topLevelObject = this.tileSet;
                }
                else {
                    this.waitForClose();
                }
            },
            text: utils_1.noop,
        };
        this.states[STATE_MAP] = {
            closetag: utils_1.noop,
            opentag: (tag) => {
                if (this.map == null)
                    return;
                switch (tag.name) {
                    case 'PROPERTIES':
                        this.collectProperties(this.map.properties);
                        break;
                    case 'TILESET':
                        this.collectTileSet(tag, STATE_MAP);
                        this.map.tileSets.push(this.tileSet);
                        break;
                    case 'LAYER':
                        this.layer = new tilelayer_1.TileLayer(this.map);
                        this.tileIndex = 0;
                        this.layer.name = tag.attributes.NAME;
                        this.layer.opacity = utils_1.float(tag.attributes.OPACITY, 1);
                        this.layer.visible = utils_1.bool(tag.attributes.VISIBLE, true);
                        this.map.layers.push(this.layer);
                        this.unresolvedLayer = {
                            layer: this.layer,
                            tiles: Array(this.map.width * this.map.height),
                        };
                        this.unresolvedLayers.push(this.unresolvedLayer);
                        this.state = STATE_TILE_LAYER;
                        break;
                    case 'OBJECTGROUP':
                        this.layer = new object_layer_1.ObjectLayer();
                        const ol = this.layer;
                        ol.name = tag.attributes.NAME;
                        ol.color = tag.attributes.COLOR;
                        ol.opacity = utils_1.float(tag.attributes.OPACITY, 1);
                        ol.visible = utils_1.bool(tag.attributes.VISIBLE, true);
                        this.map.layers.push(ol);
                        this.state = STATE_OBJECT_LAYER;
                        break;
                    case 'IMAGELAYER':
                        this.layer = new image_layer_1.ImageLayer();
                        const il = this.layer;
                        il.name = tag.attributes.NAME;
                        il.x = utils_1.int(tag.attributes.X);
                        il.y = utils_1.int(tag.attributes.Y);
                        il.opacity = utils_1.float(tag.attributes.OPACITY, 1);
                        il.visible = utils_1.bool(tag.attributes.VISIBLE, true);
                        this.map.layers.push(il);
                        this.state = STATE_IMAGE_LAYER;
                        break;
                    default:
                        this.waitForClose();
                }
            },
            text: utils_1.noop,
        };
        this.states[STATE_TILESET] = {
            closetag: () => {
                this.state = this.tileSetNextState;
            },
            opentag: (tag) => {
                if (this.tileSet == null)
                    return;
                switch (tag.name) {
                    case 'TILEOFFSET':
                        this.tileSet.tileOffset.x = utils_1.int(tag.attributes.X);
                        this.tileSet.tileOffset.y = utils_1.int(tag.attributes.Y);
                        this.waitForClose();
                        break;
                    case 'PROPERTIES':
                        this.collectProperties(this.tileSet.properties);
                        break;
                    case 'IMAGE':
                        this.tileSet.image = this.collectImage(tag);
                        break;
                    case 'TERRAINTYPES':
                        this.state = STATE_TERRAIN_TYPES;
                        break;
                    case 'TILE':
                        this.tile = new tile_1.Tile();
                        this.tile.id = utils_1.int(tag.attributes.ID);
                        if (tag.attributes.TERRAIN) {
                            const indexes = tag.attributes.TERRAIN.split(',');
                            this.tile.terrain = indexes.map((terrainIndexStr) => {
                                var _a;
                                return (_a = this.tileSet) === null || _a === void 0 ? void 0 : _a.terrainTypes[parseInt(terrainIndexStr, 10)];
                            });
                        }
                        this.tile.probability = utils_1.float(tag.attributes.PROBABILITY);
                        this.tileSet.tiles[this.tile.id] = this.tile;
                        this.state = STATE_TILE;
                        break;
                    default:
                        this.waitForClose();
                }
            },
            text: utils_1.noop,
        };
        this.states[STATE_COLLECT_PROPS] = {
            closetag: () => {
                this.state = this.propertiesNextState;
            },
            opentag: (tag) => {
                if (this.propertiesObject == null)
                    return;
                if (tag.name === 'PROPERTY') {
                    this.propertiesObject[tag.attributes.NAME] = utils_1.parseProperty(tag.attributes.VALUE, tag.attributes.TYPE);
                }
                this.waitForClose();
            },
            text: utils_1.noop,
        };
        this.states[STATE_COLLECT_ANIMATIONS] = {
            closetag: () => {
                this.state = this.animationsNextState;
            },
            opentag: (tag) => {
                if (tag.name === 'FRAME') {
                    if (this.animationsObject == null) {
                        return;
                    }
                    this.animationsObject.push({
                        duration: tag.attributes.DURATION,
                        tileId: tag.attributes.TILEID,
                    });
                }
                this.waitForClose();
            },
            text: utils_1.noop,
        };
        this.states[STATE_COLLECT_OBJECT_GROUPS] = {
            closetag: () => {
                this.state = this.objectGroupsNextState;
            },
            opentag: (tag) => {
                var _a;
                if (tag.name === 'OBJECT') {
                    this.object = new tmx_object_1.TmxObject();
                    this.object.name = tag.attributes.NAME;
                    this.object.type = tag.attributes.TYPE;
                    this.object.x = utils_1.int(tag.attributes.X);
                    this.object.y = utils_1.int(tag.attributes.Y);
                    this.object.width = utils_1.int(tag.attributes.WIDTH, 0);
                    this.object.height = utils_1.int(tag.attributes.HEIGHT, 0);
                    this.object.rotation = utils_1.float(tag.attributes.ROTATION, 0);
                    this.object.gid = utils_1.int(tag.attributes.GID);
                    this.object.visible = utils_1.bool(tag.attributes.VISIBLE, true);
                    (_a = this.objectGroupsObject) === null || _a === void 0 ? void 0 : _a.push(this.object);
                    this.state = STATE_TILE_OBJECT;
                }
                else {
                    this.waitForClose();
                }
            },
            text: utils_1.noop
        };
        this.states[STATE_WAIT_FOR_CLOSE] = {
            closetag: () => {
                this.waitForCloseOpenCount -= 1;
                if (this.waitForCloseOpenCount === 0)
                    this.state = this.waitForCloseNextState;
            },
            opentag: () => {
                this.waitForCloseOpenCount += 1;
            },
            text: utils_1.noop,
        };
        this.states[STATE_TILE] = {
            closetag: () => {
                this.state = STATE_TILESET;
            },
            opentag: (tag) => {
                if (this.tile == null) {
                    return;
                }
                if (tag.name === 'PROPERTIES') {
                    this.collectProperties(this.tile.properties);
                }
                else if (tag.name === 'IMAGE') {
                    this.tile.image = this.collectImage(tag);
                }
                else if (tag.name === 'ANIMATION') {
                    this.collectAnimations(this.tile.animations);
                }
                else if (tag.name === 'OBJECTGROUP') {
                    this.collectObjectGroups(this.tile.objectGroups);
                }
                else {
                    this.waitForClose();
                }
            },
            text: utils_1.noop,
        };
        this.states[STATE_TILE_LAYER] = {
            closetag: () => {
                this.state = STATE_MAP;
            },
            opentag: (tag) => {
                var _a;
                if (tag.name === 'PROPERTIES') {
                    this.collectProperties((_a = this.layer) === null || _a === void 0 ? void 0 : _a.properties);
                }
                else if (tag.name === 'DATA') {
                    const dataEncoding = tag.attributes.ENCODING;
                    const dataCompression = tag.attributes.COMPRESSION;
                    switch (dataEncoding) {
                        case undefined:
                        case null:
                            this.state = STATE_TILE_DATA_XML;
                            break;
                        case 'csv':
                            this.state = STATE_TILE_DATA_CSV;
                            break;
                        case 'base64':
                            switch (dataCompression) {
                                case undefined:
                                case null:
                                    this.state = STATE_TILE_DATA_B64_RAW;
                                    break;
                                case 'gzip':
                                    this.state = STATE_TILE_DATA_B64_GZIP;
                                    break;
                                case 'zlib':
                                    this.state = STATE_TILE_DATA_B64_ZLIB;
                                    break;
                                case 'zstd':
                                    this.state = STATE_TILE_DATA_B64_ZSTD;
                                    break;
                                default:
                                    this.error(new Error(`unsupported data compression: ${dataCompression}`));
                                    return;
                            }
                            break;
                        default:
                            this.error(new Error(`unsupported data encoding: ${dataEncoding}`));
                            return;
                    }
                }
                else {
                    this.waitForClose();
                }
            },
            text: utils_1.noop,
        };
        this.states[STATE_OBJECT_LAYER] = {
            opentag: (tag) => {
                if (tag.name === 'PROPERTIES') {
                    this.collectProperties(this.layer.properties);
                }
                else if (tag.name === 'OBJECT') {
                    this.object = new tmx_object_1.TmxObject();
                    this.object.name = tag.attributes.NAME;
                    this.object.type = tag.attributes.TYPE;
                    this.object.x = utils_1.int(tag.attributes.X);
                    this.object.y = utils_1.int(tag.attributes.Y);
                    this.object.width = utils_1.int(tag.attributes.WIDTH, 0);
                    this.object.height = utils_1.int(tag.attributes.HEIGHT, 0);
                    this.object.rotation = utils_1.float(tag.attributes.ROTATION, 0);
                    this.object.gid = utils_1.int(tag.attributes.GID);
                    this.object.visible = utils_1.bool(tag.attributes.VISIBLE, true);
                    this.layer.objects.push(this.object);
                    this.state = STATE_OBJECT;
                }
                else {
                    this.waitForClose();
                }
            },
            closetag: () => {
                this.state = STATE_MAP;
            },
            text: utils_1.noop,
        };
        this.states[STATE_IMAGE_LAYER] = {
            opentag: (tag) => {
                if (tag.name === 'PROPERTIES') {
                    this.collectProperties(this.layer.properties);
                }
                else if (tag.name === 'IMAGE') {
                    this.layer.image = this.collectImage(tag);
                }
                else {
                    this.waitForClose();
                }
            },
            closetag: () => {
                this.state = STATE_MAP;
            },
            text: utils_1.noop,
        };
        this.states[STATE_OBJECT] = {
            opentag: (tag) => {
                switch (tag.name) {
                    case 'PROPERTIES':
                        this.collectProperties(this.object.properties);
                        break;
                    case 'ELLIPSE':
                        this.object.ellipse = true;
                        this.waitForClose();
                        break;
                    case 'POLYGON':
                        this.object.polygon = utils_1.parsePoints(tag.attributes.POINTS);
                        this.waitForClose();
                        break;
                    case 'POLYLINE':
                        this.object.polyline = utils_1.parsePoints(tag.attributes.POINTS);
                        this.waitForClose();
                        break;
                    case 'IMAGE':
                        this.object.image = this.collectImage(tag);
                        break;
                    default:
                        this.waitForClose();
                }
            },
            closetag: () => {
                this.state = STATE_OBJECT_LAYER;
            },
            text: utils_1.noop,
        };
        this.states[STATE_TILE_OBJECT] = {
            opentag: (tag) => {
                switch (tag.name) {
                    case 'PROPERTIES':
                        this.collectProperties(this.object.properties);
                        break;
                    case 'ELLIPSE':
                        this.object.ellipse = true;
                        this.waitForClose();
                        break;
                    case 'POLYGON':
                        this.object.polygon = utils_1.parsePoints(tag.attributes.POINTS);
                        this.waitForClose();
                        break;
                    case 'POLYLINE':
                        this.object.polyline = utils_1.parsePoints(tag.attributes.POINTS);
                        this.waitForClose();
                        break;
                    case 'IMAGE':
                        this.object.image = this.collectImage(tag);
                        break;
                    default:
                        this.waitForClose();
                }
            },
            closetag: () => {
                this.state = STATE_COLLECT_OBJECT_GROUPS;
            },
            text: utils_1.noop
        };
        this.states[STATE_TILE_DATA_XML] = {
            opentag: (tag) => {
                if (tag.name === 'TILE') {
                    this.saveTile(utils_1.int(tag.attributes.GID, 0));
                }
                this.waitForClose();
            },
            closetag: () => {
                this.state = STATE_TILE_LAYER;
            },
            text: utils_1.noop,
        };
        this.states[STATE_TILE_DATA_CSV] = {
            opentag: () => {
                this.waitForClose();
            },
            closetag: () => {
                this.state = STATE_TILE_LAYER;
            },
            text: (text) => {
                text.split(',').forEach((c) => {
                    this.saveTile(parseInt(c, 10));
                });
            },
        };
        this.states[STATE_TILE_DATA_B64_RAW] = {
            opentag: () => {
                this.waitForClose();
            },
            closetag: () => {
                this.state = STATE_TILE_LAYER;
            },
            text: (text) => {
                this.unpackTileBytes(Buffer.from(text.trim(), 'base64'));
            },
        };
        this.states[STATE_TILE_DATA_B64_GZIP] = {
            opentag: () => {
                this.waitForClose();
            },
            closetag: () => {
                this.state = STATE_TILE_LAYER;
            },
            text: (text) => {
                const zipped = Buffer.from(text.trim(), 'base64');
                const oldUnresolvedLayer = this.unresolvedLayer;
                const oldLayer = this.layer;
                this.pend.go((cb) => {
                    zlib_1.gunzip(zipped, (err, buf) => {
                        if (err) {
                            cb(err);
                            return;
                        }
                        this.unresolvedLayer = oldUnresolvedLayer;
                        this.layer = oldLayer;
                        this.unpackTileBytes(buf);
                        cb();
                    });
                });
            },
        };
        this.states[STATE_TILE_DATA_B64_ZLIB] = {
            opentag: () => {
                this.waitForClose();
            },
            closetag: () => {
                this.state = STATE_TILE_LAYER;
            },
            text: (text) => {
                const zipped = Buffer.from(text.trim(), 'base64');
                const oldUnresolvedLayer = this.unresolvedLayer;
                const oldLayer = this.layer;
                this.pend.go((cb) => {
                    zlib_1.inflate(zipped, (err, buf) => {
                        if (err) {
                            cb(err);
                            return;
                        }
                        this.layer = oldLayer;
                        this.unresolvedLayer = oldUnresolvedLayer;
                        this.unpackTileBytes(buf);
                        cb();
                    });
                });
            },
        };
        this.states[STATE_TILE_DATA_B64_ZSTD] = {
            opentag: () => {
                this.waitForClose();
            },
            closetag: () => {
                this.state = STATE_TILE_LAYER;
            },
            text: (text) => {
                const zipped = Buffer.from(text.trim(), 'base64');
                const oldUnresolvedLayer = this.unresolvedLayer;
                const oldLayer = this.layer;
                this.pend.go((cb) => {
                    zstd_codec_1.ZstdCodec.run(zstd => {
                        const simple = new zstd.Simple();
                        const buf = simple.decompress(zipped);
                        this.layer = oldLayer;
                        this.unresolvedLayer = oldUnresolvedLayer;
                        this.unpackTileBytes(ArrayBuffer.isView(buf) ? Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength) : Buffer.from(buf));
                        cb();
                    });
                });
            },
        };
        this.states[STATE_TERRAIN_TYPES] = {
            opentag: (tag) => {
                if (tag.name === 'TERRAIN') {
                    this.terrain = new terrain_1.Terrain();
                    this.terrain.name = tag.attributes.NAME;
                    this.terrain.tile = utils_1.int(tag.attributes.TILE);
                    this.tileSet.terrainTypes.push(this.terrain);
                    this.state = STATE_TERRAIN;
                }
                else {
                    this.waitForClose();
                }
            },
            closetag: () => {
                this.state = STATE_TILESET;
            },
            text: utils_1.noop,
        };
        this.states[STATE_TERRAIN] = {
            opentag: (tag) => {
                if (tag.name === 'PROPERTIES') {
                    this.collectProperties(this.terrain.properties);
                }
                else {
                    this.waitForClose();
                }
            },
            closetag: () => {
                this.state = STATE_TERRAIN_TYPES;
            },
            text: utils_1.noop,
        };
    }
    waitForClose() {
        this.waitForCloseNextState = this.state;
        this.state = STATE_WAIT_FOR_CLOSE;
        this.waitForCloseOpenCount = 1;
    }
    collectTileSet(tag, nextState) {
        this.tileSet = new tileset_1.TileSet();
        this.tileSet.firstGid = utils_1.int(tag.attributes.FIRSTGID);
        this.tileSet.source = tag.attributes.SOURCE;
        this.tileSet.name = tag.attributes.NAME;
        this.tileSet.tileWidth = utils_1.int(tag.attributes.TILEWIDTH);
        this.tileSet.tileHeight = utils_1.int(tag.attributes.TILEHEIGHT);
        this.tileSet.spacing = utils_1.int(tag.attributes.SPACING);
        this.tileSet.margin = utils_1.int(tag.attributes.MARGIN);
        if (this.tileSet.source) {
            this.pend.go((cb) => {
                this.resolveTileSet(this.tileSet, cb);
            });
        }
        this.state = STATE_TILESET;
        this.tileSetNextState = nextState;
    }
    collectProperties(obj) {
        this.propertiesObject = obj;
        this.propertiesNextState = this.state;
        this.state = STATE_COLLECT_PROPS;
    }
    resolveTileSet(unresolvedTileSet, cb) {
        const target = path_1.join(this.pathToDir, unresolvedTileSet.source);
        parseFile(target, (err, resolvedTileSet) => {
            if (err) {
                cb(err);
                return;
            }
            resolvedTileSet.mergeTo(unresolvedTileSet);
            cb();
        });
    }
    collectImage(tag) {
        const img = new image_1.Image();
        img.format = tag.attributes.FORMAT;
        img.source = tag.attributes.SOURCE;
        img.trans = tag.attributes.TRANS;
        img.width = utils_1.int(tag.attributes.WIDTH);
        img.height = utils_1.int(tag.attributes.HEIGHT);
        // TODO: read possible <data>
        this.waitForClose();
        return img;
    }
    /* tslint:disable:no-bitwise */
    /* tslint:disable:no-parameter-reassignment */
    saveTile(gid) {
        const tmp = this.layer;
        tmp.horizontalFlips[this.tileIndex] = !!(gid & FLIPPED_HORIZONTALLY_FLAG);
        tmp.verticalFlips[this.tileIndex] = !!(gid & FLIPPED_VERTICALLY_FLAG);
        tmp.diagonalFlips[this.tileIndex] = !!(gid & FLIPPED_DIAGONALLY_FLAG);
        gid &= ~(FLIPPED_HORIZONTALLY_FLAG |
            FLIPPED_VERTICALLY_FLAG |
            FLIPPED_DIAGONALLY_FLAG);
        if (this.unresolvedLayer == null)
            return;
        this.unresolvedLayer.tiles[this.tileIndex] = gid;
        this.tileIndex += 1;
    }
    /* tslint:enable:no-bitwise */
    collectAnimations(obj) {
        this.animationsObject = obj;
        this.animationsNextState = this.state;
        this.state = STATE_COLLECT_ANIMATIONS;
    }
    collectObjectGroups(obj) {
        this.objectGroupsObject = obj;
        this.objectGroupsNextState = this.state;
        this.state = STATE_COLLECT_OBJECT_GROUPS;
    }
    error(err) {
        this.parser.onerror = null;
        this.parser.onopentag = null;
        this.parser.onclosetag = null;
        this.parser.ontext = null;
        this.parser.onend = null;
        this.callback(err);
    }
    unpackTileBytes(buf) {
        if (this.map == null) {
            return;
        }
        const expectedCount = this.map.width * this.map.height * 4;
        if (buf.length !== expectedCount) {
            this.error(new Error(`Expected ${expectedCount} bytes of tile data; received ${buf.length}`));
            return;
        }
        this.tileIndex = 0;
        for (let i = 0; i < expectedCount; i += 4) {
            this.saveTile(buf.readUInt32LE(i));
        }
    }
}
function parse(content, filePath, cb) {
    const tmx = new Tmx();
    tmx.parse(content, filePath, cb);
}
exports.parse = parse;
function parseFile(name, cb) {
    defaultReadFile(name, (err, content) => {
        if (err) {
            cb(err);
        }
        else {
            const tmx = new Tmx();
            tmx.parse(content, name, cb);
        }
    });
}
exports.parseFile = parseFile;
