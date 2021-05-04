import { Image } from './image';
export declare class Tile {
    gid: number;
    id: number;
    terrain: any[];
    probability: number | null;
    properties: {};
    animations: any[];
    objectGroups: any[];
    image: Image | null;
}
