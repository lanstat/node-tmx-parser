import { Image } from './image';
interface IPoint {
    x: string;
    y: string;
}
export declare class TmxObject {
    name: string | null;
    type: any;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    properties: {};
    gid: number | null;
    visible: boolean;
    ellipse: boolean;
    polygon: IPoint[] | null;
    polyline: IPoint[] | null;
    image: Image | null;
}
export {};
