import { Layer } from './layer';
import { TileSet } from './tileset';
export declare class Map {
    version: string | null;
    orientation: string;
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    backgroundColor: string | null;
    layers: Layer[];
    properties: {};
    tileSets: TileSet[];
}
