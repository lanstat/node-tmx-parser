export abstract class Layer {
  public type: string;
  public name: string|null = null;
  public opacity = 1;
  public visible = true;
  public properties: {[id: string]: any} = {};

  public constructor(type: string) {
    this.type = type;
  }
}
