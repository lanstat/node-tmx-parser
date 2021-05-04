export declare abstract class Layer {
    type: string;
    name: string | null;
    opacity: number;
    visible: boolean;
    properties: {};
    constructor(type: string);
}
