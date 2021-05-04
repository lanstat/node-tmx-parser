import { Image } from './image';
import { Layer } from './layer';

export class ImageLayer extends Layer {
  public x = 0;
  public y = 0;
  public image: Image|null = null;

  public constructor() {
    super('image');
  }
}
