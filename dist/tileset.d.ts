import { Image } from './image';
import { Terrain } from './terrain';
import { Tile } from './tile';
export declare class TileSet {
    firstGid: number | null;
    source: string;
    name: string;
    tileWidth: number;
    tileHeight: number;
    spacing: number;
    margin: number;
    tileOffset: {
        x: number;
        y: number;
    };
    properties: {};
    image: Image | null;
    tiles: Tile[];
    terrainTypes: Terrain[];
    mergeTo(other: TileSet): void;
}
