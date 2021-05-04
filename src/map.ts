import { Layer } from './layer';
import { TileSet } from './tileset';

export class Map {
  public version: string|null = null;
  public orientation = 'orthogonal';
  public width = 0;
  public height = 0;
  public tileWidth = 0;
  public tileHeight = 0;
  public backgroundColor: string|null = null;

  public layers: Layer[] = [];
  public properties: {[id: string]: any} = {};
  public tileSets: TileSet[] = [];
}
