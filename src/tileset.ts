import { Image } from './image';
import { Terrain } from './terrain';
import { Tile } from './tile';

export class TileSet {
  public firstGid: number|null = 0;
  public source = '';
  public name = '';
  public tileWidth = 0;
  public tileHeight = 0;
  public spacing = 0;
  public margin = 0;
  public tileOffset: {x: number, y: number} = {
    x: 0,
    y: 0,
  };
  public properties = {};
  public image: Image|null = null;
  public tiles: Tile[] = [];
  public terrainTypes: Terrain[] = [];

  public mergeTo(other: TileSet) {
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
