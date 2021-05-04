import { Layer } from './layer';
import { TmxObject } from './tmx-object';
export declare class ObjectLayer extends Layer {
    color: string | null;
    objects: TmxObject[];
    constructor();
}
