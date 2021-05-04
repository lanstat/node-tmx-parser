import { Layer } from './layer';
import { Map } from './map';

export class TileLayer extends Layer {
  public map: Map;
  public tiles: any[];
  public horizontalFlips: any[];
  public verticalFlips: any[];
  public diagonalFlips: any[];

  public constructor(map: Map) {
    super('tile');

    this.map = map;
    const tileCount = map.width * map.height;
    this.tiles = Array<any>(tileCount);
    this.horizontalFlips = Array<any>(tileCount);
    this.verticalFlips = Array<any>(tileCount);
    this.diagonalFlips = Array<any>(tileCount);
  }

  public tileAt(x: number, y: number): any {
    return this.tiles[y * this.map.width + x];
  }

  public setTileAt(x: number, y: number, tile: any) {
    this.tiles[y * this.map.width + x] = tile;
  }
}
