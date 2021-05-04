import { Layer } from './layer';
import { TmxObject } from './tmx-object';

export class ObjectLayer extends Layer {
  public color: string|null = null;
  public objects: TmxObject[] = [];

  public constructor() {
    super('object');
  }
}
