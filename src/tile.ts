import { Image } from './image';

export class Tile {
  public gid = 0;
  public id = 0;
  public terrain = [];
  public probability: number|null = null;
  public properties = {};
  public animations = [];
  public objectGroups = [];
  public image: Image|null = null;
}
