import { Layer } from './layer';
import { Map } from './map';
export declare class TileLayer extends Layer {
    map: Map;
    tiles: any[];
    horizontalFlips: any[];
    verticalFlips: any[];
    diagonalFlips: any[];
    constructor(map: Map);
    tileAt(x: number, y: number): any;
    setTileAt(x: number, y: number, tile: any): void;
}
