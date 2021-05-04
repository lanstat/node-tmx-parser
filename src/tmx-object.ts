import { Image } from './image';

interface IPoint {
  x: string;
  y: string;
}

export class TmxObject {
  public name: string|null = null;
  public type: string|null = null;
  public x = 0;
  public y = 0;
  public width = 0;
  public height = 0;
  public rotation = 0;
  public properties: {[id:string]: any} = {};
  public gid: number|null = null;
  public visible = true;
  public ellipse = false;
  public polygon: IPoint[]|null = null;
  public polyline: IPoint[]|null = null;
  public image: Image|null = null;
}
