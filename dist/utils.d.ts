export declare function parsePoints(str: string): {
    x: string;
    y: string;
}[];
export declare function parseProperty(value: any, type: string): any;
export declare function noop(): void;
export declare function int(value: any, defaultValue?: number | null): number | null;
export declare function bool(value: any, defaultValue: boolean | null): boolean;
export declare function float(value: any, defaultValue?: number | null): number;
