import { Map } from './map';
import { TileSet } from './tileset';
import {TmxObject} from './tmx-object';
import { bool, float, int, noop, parseProperty, parsePoints } from './utils';
import {Layer} from './layer';
import {Tile} from './tile';
import {Terrain} from './terrain';
import {TileLayer} from './tilelayer';
import {ObjectLayer} from './object-layer';
import {ImageLayer} from './image-layer';
import {Image} from './image';
import {readFile} from 'fs';
import {dirname, join} from 'path';
import {gunzip, inflate} from 'zlib';
import * as Pend from 'pend';
import {parser, SAXParser} from 'sax';
import {ZstdCodec} from 'zstd-codec';

declare var window: any;
declare var fetch: any;

const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG   = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG   = 0x20000000;

let STATE_COUNT = 0;
const STATE_START                = STATE_COUNT++;
const STATE_MAP                  = STATE_COUNT++;
const STATE_COLLECT_PROPS        = STATE_COUNT++;
const STATE_COLLECT_ANIMATIONS   = STATE_COUNT++;
const STATE_COLLECT_OBJECT_GROUPS = STATE_COUNT++;
const STATE_WAIT_FOR_CLOSE       = STATE_COUNT++;
const STATE_TILESET              = STATE_COUNT++;
const STATE_TILE                 = STATE_COUNT++;
const STATE_TILE_LAYER           = STATE_COUNT++;
const STATE_OBJECT_LAYER         = STATE_COUNT++;
const STATE_OBJECT               = STATE_COUNT++;
const STATE_TILE_OBJECT          = STATE_COUNT++;
const STATE_IMAGE_LAYER          = STATE_COUNT++;
const STATE_TILE_DATA_XML        = STATE_COUNT++;
const STATE_TILE_DATA_CSV        = STATE_COUNT++;
const STATE_TILE_DATA_B64_RAW    = STATE_COUNT++;
const STATE_TILE_DATA_B64_GZIP   = STATE_COUNT++;
const STATE_TILE_DATA_B64_ZLIB   = STATE_COUNT++;
const STATE_TILE_DATA_B64_ZSTD   = STATE_COUNT++;
const STATE_TERRAIN_TYPES        = STATE_COUNT++;
const STATE_TERRAIN              = STATE_COUNT++;

interface ISaxTag {
  attributes: any;
  name: string;
}

interface IState {
  closetag: (name?: string) => void;
  opentag: (tag: ISaxTag) => void;
  text: (text?: string) => void;
}

interface IUnresolveLayer {
  layer: TileLayer;
  tiles: number[];
}

interface IAnimationObject {
  tileId: number;
  duration: number;
}

function defaultReadFile(name: string, cb: (err: any, content: any) => void) {
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    fetch(name)
      .then((response: any) => response.text())
      .then((data: any) => {
        cb(undefined, data);
      })
      .catch((e: any) => cb(e, null));
  } else {
    readFile(name, { encoding: 'utf8' }, cb);
  }
}

class Tmx {
  private pathToDir: string;
  private map: Map|null;
  private topLevelObject: Map|TileSet|null = null;
  private state = STATE_START;
  private states: IState[] = Array<IState>(STATE_COUNT);
  private waitForCloseNextState = 0;
  private waitForCloseOpenCount = 0;
  private propertiesObject: any = null;
  private propertiesNextState = 0;
  private animationsObject: IAnimationObject[]|null = null;
  private animationsNextState = 0;
  private objectGroupsObject: TmxObject[]|null = null;
  private objectGroupsNextState = 0;
  private tileIndex = 0;
  private tileSet: TileSet|null = null;
  private tileSetNextState = 0;
  private tile: Tile|null;
  private layer: Layer|null;
  private object: TmxObject|null;
  private terrain: Terrain|null;
  private pend = new Pend.default();
  // this holds the numerical tile ids
  // later we use it to resolve the real tiles
  private unresolvedLayers: IUnresolveLayer[] = [];
  private unresolvedLayer: IUnresolveLayer|null = null;
  private parser: SAXParser;
  private callback: (error: any, parsed?: Map) => void;

  public constructor() {
    this.initialize();
  }

  public parse(content: string, pathToFile: string, cb: (error: any, parsed?: Map) => void): void {
    this.callback = cb;
    this.pathToDir = dirname(pathToFile);
    this.parser = parser();
    this.parser.onerror = this.callback;
    this.parser.onopentag = (tag: any) => {
      this.states[this.state].opentag(tag);
    };
    this.parser.onclosetag = (name: string) => {
      this.states[this.state].closetag(name);
    };
    this.parser.ontext = (text: string) => {
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
        this.unresolvedLayers.forEach((unresolvedLayer: IUnresolveLayer) => {
          if (this.map == null) { return; }
          for (let i = 0; i < unresolvedLayer.tiles.length; i += 1) {
            const globalTileId = unresolvedLayer.tiles[i];
            for (let tileSetIndex = this.map.tileSets.length - 1;
                tileSetIndex >= 0; tileSetIndex -= 1) {
              const tileSet = this.map.tileSets[tileSetIndex];
              if (tileSet.firstGid <= globalTileId) {
                const tileId = globalTileId - tileSet.firstGid;
                let tile = tileSet.tiles[tileId];
                if (!tile) {
                  // implicit tile
                  tile = new Tile();
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
        this.callback(null, this.topLevelObject as Map);
      });
    };
    this.parser.write(content).close();
  }

  private initialize(): void {
    this.states[STATE_START] = {
      closetag: noop,
      opentag: (tag) => {
        if (tag.name === 'MAP') {
          this.map = new Map();
          this.topLevelObject = this.map;
          this.map.version = tag.attributes.VERSION;
          this.map.orientation = tag.attributes.ORIENTATION;
          this.map.width = int(tag.attributes.WIDTH);
          this.map.height = int(tag.attributes.HEIGHT);
          this.map.tileWidth = int(tag.attributes.TILEWIDTH);
          this.map.tileHeight = int(tag.attributes.TILEHEIGHT);
          this.map.backgroundColor = tag.attributes.BACKGROUNDCOLOR;

          this.state = STATE_MAP;
        } else if (tag.name === 'TILESET') {
          this.collectTileSet(tag, STATE_START);
          this.topLevelObject = this.tileSet;
        } else {
          this.waitForClose();
        }
      },
      text: noop,
    };
    this.states[STATE_MAP] = {
      closetag: noop,
      opentag: (tag) => {
        if (this.map == null) return;
        switch (tag.name) {
          case 'PROPERTIES':
            this.collectProperties(this.map.properties);
            break;
          case 'TILESET':
            this.collectTileSet(tag, STATE_MAP);
            this.map.tileSets.push(this.tileSet as TileSet);
            break;
          case 'LAYER':
            this.layer = new TileLayer(this.map);
            this.tileIndex = 0;
            this.layer.name = tag.attributes.NAME;
            this.layer.opacity = float(tag.attributes.OPACITY, 1);
            this.layer.visible = bool(tag.attributes.VISIBLE, true);
            this.map.layers.push(this.layer);
            this.unresolvedLayer = {
              layer: this.layer as TileLayer,
              tiles: Array(this.map.width * this.map.height),
            };
            this.unresolvedLayers.push(this.unresolvedLayer);
            this.state = STATE_TILE_LAYER;
            break;
          case 'OBJECTGROUP':
            this.layer = new ObjectLayer();
            const ol = this.layer as ObjectLayer;
            ol.name = tag.attributes.NAME;
            ol.color = tag.attributes.COLOR;
            ol.opacity = float(tag.attributes.OPACITY, 1);
            ol.visible = bool(tag.attributes.VISIBLE, true);
            this.map.layers.push(ol);
            this.state = STATE_OBJECT_LAYER;
            break;
          case 'IMAGELAYER':
            this.layer = new ImageLayer();
            const il = this.layer as ImageLayer;
            il.name = tag.attributes.NAME;
            il.x = int(tag.attributes.X);
            il.y = int(tag.attributes.Y);
            il.opacity = float(tag.attributes.OPACITY, 1);
            il.visible = bool(tag.attributes.VISIBLE, true);
            this.map.layers.push(il);
            this.state = STATE_IMAGE_LAYER;
            break;
          default:
            this.waitForClose();
        }
      },
      text: noop,
    };
    this.states[STATE_TILESET] = {
      closetag: () => {
        this.state = this.tileSetNextState;
      },
      opentag: (tag) => {
        if (this.tileSet == null) return;
        switch (tag.name) {
          case 'TILEOFFSET':
            this.tileSet.tileOffset.x = int(tag.attributes.X);
            this.tileSet.tileOffset.y = int(tag.attributes.Y);
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
            this.tile = new Tile();
            this.tile.id = int(tag.attributes.ID);
            if (tag.attributes.TERRAIN) {
              const indexes = tag.attributes.TERRAIN.split(',');
              this.tile.terrain = indexes.map((terrainIndexStr: string) => {
                return this.tileSet?.terrainTypes[parseInt(terrainIndexStr, 10)];
              });
            }
            this.tile.probability = float(tag.attributes.PROBABILITY);
            this.tileSet.tiles[this.tile.id] = this.tile;
            this.state = STATE_TILE;
            break;
          default:
            this.waitForClose();
        }
      },
      text: noop,
    };
    this.states[STATE_COLLECT_PROPS] = {
      closetag: () => {
        this.state = this.propertiesNextState;
      },
      opentag: (tag) => {
        if (this.propertiesObject == null) return;
        if (tag.name === 'PROPERTY') {
          this.propertiesObject[tag.attributes.NAME] = parseProperty(
            tag.attributes.VALUE,
            tag.attributes.TYPE
          );
        }
        this.waitForClose();
      },
      text: noop,
    };
    this.states[STATE_COLLECT_ANIMATIONS] = {
      closetag: () => {
        this.state = this.animationsNextState;
      },
      opentag: (tag) => {
        if (tag.name === 'FRAME') {
          if (this.animationsObject == null) { return; }
          this.animationsObject.push({
            duration: tag.attributes.DURATION,
            tileId: tag.attributes.TILEID,
          });
        }
        this.waitForClose();
      },
      text: noop,
    };
    this.states[STATE_COLLECT_OBJECT_GROUPS] = {
      closetag: () => {
        this.state = this.objectGroupsNextState;
      },
      opentag: (tag) => {
        if (tag.name === 'OBJECT') {
          this.object = new TmxObject();
          this.object.name = tag.attributes.NAME;
          this.object.type = tag.attributes.TYPE;
          this.object.x = int(tag.attributes.X);
          this.object.y = int(tag.attributes.Y);
          this.object.width = int(tag.attributes.WIDTH, 0);
          this.object.height = int(tag.attributes.HEIGHT, 0);
          this.object.rotation = float(tag.attributes.ROTATION, 0);
          this.object.gid = int(tag.attributes.GID);
          this.object.visible = bool(tag.attributes.VISIBLE, true);
          this.objectGroupsObject?.push(this.object);
          this.state = STATE_TILE_OBJECT;
        } else {
          this.waitForClose();
        }
      },
      text: noop
    };
    this.states[STATE_WAIT_FOR_CLOSE] = {
      closetag: () => {
        this.waitForCloseOpenCount -= 1;
        if (this.waitForCloseOpenCount === 0) this.state = this.waitForCloseNextState;
      },
      opentag: () => {
        this.waitForCloseOpenCount += 1;
      },
      text: noop,
    };
    this.states[STATE_TILE] = {
      closetag: () => {
        this.state = STATE_TILESET
      },
      opentag: (tag) => {
        if (this.tile == null) { return; }
        if (tag.name === 'PROPERTIES') {
          this.collectProperties(this.tile.properties);
        } else if (tag.name === 'IMAGE') {
          this.tile.image = this.collectImage(tag);
        } else if (tag.name === 'ANIMATION') {
          this.collectAnimations(this.tile.animations);
        } else if (tag.name === 'OBJECTGROUP') {
          this.collectObjectGroups(this.tile.objectGroups);
        } else {
          this.waitForClose();
        }
      },
      text: noop,
    };
    this.states[STATE_TILE_LAYER] = {
      closetag: () => {
        this.state = STATE_MAP;
      },
      opentag: (tag) => {
        if (tag.name === 'PROPERTIES') {
          this.collectProperties(this.layer?.properties);
        } else if (tag.name === 'DATA') {
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
        } else {
          this.waitForClose();
        }
      },
      text: noop,
    };
    this.states[STATE_OBJECT_LAYER] = {
      opentag: (tag) => {
        if (tag.name === 'PROPERTIES') {
          this.collectProperties(this.layer.properties);
        } else if (tag.name === 'OBJECT') {
          this.object = new TmxObject();
          this.object.name = tag.attributes.NAME;
          this.object.type = tag.attributes.TYPE;
          this.object.x = int(tag.attributes.X);
          this.object.y = int(tag.attributes.Y);
          this.object.width = int(tag.attributes.WIDTH, 0);
          this.object.height = int(tag.attributes.HEIGHT, 0);
          this.object.rotation = float(tag.attributes.ROTATION, 0);
          this.object.gid = int(tag.attributes.GID);
          this.object.visible = bool(tag.attributes.VISIBLE, true);
          (this.layer as ObjectLayer).objects.push(this.object);
          this.state = STATE_OBJECT;
        } else {
          this.waitForClose();
        }
      },
      closetag: () => {
        this.state = STATE_MAP;
      },
      text: noop,
    };
    this.states[STATE_IMAGE_LAYER] = {
      opentag: (tag) => {
        if (tag.name === 'PROPERTIES') {
          this.collectProperties(this.layer.properties);
        } else if (tag.name === 'IMAGE') {
          (this.layer as ImageLayer).image = this.collectImage(tag);
        } else {
          this.waitForClose();
        }
      },
      closetag: () => {
        this.state = STATE_MAP;
      },
      text: noop,
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
            this.object.polygon = parsePoints(tag.attributes.POINTS);
            this.waitForClose();
            break;
          case 'POLYLINE':
            this.object.polyline = parsePoints(tag.attributes.POINTS);
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
      text: noop,
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
            this.object.polygon = parsePoints(tag.attributes.POINTS);
            this.waitForClose();
            break;
          case 'POLYLINE':
            this.object.polyline = parsePoints(tag.attributes.POINTS);
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
      text: noop
    };
    this.states[STATE_TILE_DATA_XML] = {
      opentag: (tag) => {
        if (tag.name === 'TILE') {
          this.saveTile(int(tag.attributes.GID, 0));
        }
        this.waitForClose();
      },
      closetag: () => {
        this.state = STATE_TILE_LAYER;
      },
      text: noop,
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
          gunzip(zipped, (err, buf) => {
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
          inflate(zipped, (err, buf) => {
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
          ZstdCodec.run(zstd => {
            const simple = new zstd.Simple();
            const buf = simple.decompress(zipped);
            this.layer = oldLayer;
            this.unresolvedLayer = oldUnresolvedLayer;
            this.unpackTileBytes(ArrayBuffer.isView(buf)? Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength): Buffer.from(buf));
            cb();
          });
        });
      },
    };
    this.states[STATE_TERRAIN_TYPES] = {
      opentag: (tag) => {
        if (tag.name === 'TERRAIN') {
          this.terrain = new Terrain();
          this.terrain.name = tag.attributes.NAME;
          this.terrain.tile = int(tag.attributes.TILE);
          this.tileSet.terrainTypes.push(this.terrain);
          this.state = STATE_TERRAIN;
        } else {
          this.waitForClose();
        }
      },
      closetag: () => {
        this.state = STATE_TILESET;
      },
      text: noop,
    };
    this.states[STATE_TERRAIN] = {
      opentag: (tag) => {
        if (tag.name === 'PROPERTIES') {
          this.collectProperties(this.terrain.properties);
        } else {
          this.waitForClose();
        }
      },
      closetag: () => {
        this.state = STATE_TERRAIN_TYPES;
      },
      text: noop,
    };
  }

  private waitForClose(): void {
    this.waitForCloseNextState = this.state;
    this.state = STATE_WAIT_FOR_CLOSE;
    this.waitForCloseOpenCount = 1;
  }

  private collectTileSet(tag: ISaxTag, nextState: number): void {
    this.tileSet = new TileSet();
    this.tileSet.firstGid = int(tag.attributes.FIRSTGID);
    this.tileSet.source = tag.attributes.SOURCE;
    this.tileSet.name = tag.attributes.NAME;
    this.tileSet.tileWidth = int(tag.attributes.TILEWIDTH);
    this.tileSet.tileHeight = int(tag.attributes.TILEHEIGHT);
    this.tileSet.spacing = int(tag.attributes.SPACING);
    this.tileSet.margin = int(tag.attributes.MARGIN);

    if (this.tileSet.source) {
      this.pend.go((cb) => {
        this.resolveTileSet(this.tileSet as TileSet, cb);
      });
    }

    this.state = STATE_TILESET;
    this.tileSetNextState = nextState;
  }

  private collectProperties(obj: any) {
    this.propertiesObject = obj;
    this.propertiesNextState = this.state;
    this.state = STATE_COLLECT_PROPS;
  }

  private resolveTileSet(unresolvedTileSet: TileSet, cb: (error?: any) => void) {
    const target = join(this.pathToDir, unresolvedTileSet.source);
    parseFile(target, (err: any, resolvedTileSet: TileSet) => {
      if (err) {
        cb(err);
        return;
      }
      resolvedTileSet.mergeTo(unresolvedTileSet);
      cb();
    });
  }

  private collectImage(tag: ISaxTag): Image {
    const img = new Image();
    img.format = tag.attributes.FORMAT;
    img.source = tag.attributes.SOURCE;
    img.trans = tag.attributes.TRANS;
    img.width = int(tag.attributes.WIDTH);
    img.height = int(tag.attributes.HEIGHT);

    // TODO: read possible <data>
    this.waitForClose();
    return img;
  }

  /* tslint:disable:no-bitwise */
  /* tslint:disable:no-parameter-reassignment */
  private saveTile(gid: number) {
    const tmp = this.layer as TileLayer;
    tmp.horizontalFlips[this.tileIndex] = !!(gid & FLIPPED_HORIZONTALLY_FLAG);
    tmp.verticalFlips[this.tileIndex]   = !!(gid & FLIPPED_VERTICALLY_FLAG);
    tmp.diagonalFlips[this.tileIndex]   = !!(gid & FLIPPED_DIAGONALLY_FLAG);

    gid &= ~(FLIPPED_HORIZONTALLY_FLAG |
             FLIPPED_VERTICALLY_FLAG |
             FLIPPED_DIAGONALLY_FLAG);

    if (this.unresolvedLayer == null) return;
    this.unresolvedLayer.tiles[this.tileIndex] = gid;

    this.tileIndex += 1;
  }
  /* tslint:enable:no-bitwise */

  private collectAnimations(obj: IAnimationObject[]) {
    this.animationsObject = obj;
    this.animationsNextState = this.state;
    this.state = STATE_COLLECT_ANIMATIONS;
  }

  private collectObjectGroups(obj: any) {
    this.objectGroupsObject = obj;
    this.objectGroupsNextState = this.state;
    this.state = STATE_COLLECT_OBJECT_GROUPS;
  }

  private error(err: any) {
    this.parser.onerror = null;
    this.parser.onopentag = null;
    this.parser.onclosetag = null;
    this.parser.ontext = null;
    this.parser.onend = null;
    this.callback(err);
  }

  private unpackTileBytes(buf: Buffer) {
    if (this.map == null) { return; }
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

export function parse(content: string, filePath: string, cb: (err: any, content?: Map) => void) {
  const tmx = new Tmx();
  tmx.parse(content, filePath, cb);
}

export function parseFile(name: string, cb: (err: any, content?: Map|TileSet) => void) {
  defaultReadFile(name, (err: any, content: any) => {
    if (err) {
      cb(err);
    } else {
      const tmx = new Tmx();
      tmx.parse(content, name, cb);
    }
  });
}
