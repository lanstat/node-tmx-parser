import { Map } from './map';
import { TileSet } from './tileset';
export declare function parse(content: string, filePath: string, cb: (err: any, content?: Map) => void): void;
export declare function parseFile(name: string, cb: (err: any, content?: Map | TileSet) => void): void;
