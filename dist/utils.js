"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.float = exports.bool = exports.int = exports.noop = exports.parseProperty = exports.parsePoints = void 0;
function parsePoints(str) {
    const points = str.split(' ');
    return points.map((pt) => {
        const xy = pt.split(',');
        return {
            x: xy[0],
            y: xy[1],
        };
    });
}
exports.parsePoints = parsePoints;
function parseProperty(value, type) {
    switch (type) {
        case 'int':
            return parseInt(value, 10);
        case 'float':
            return parseFloat(value);
        case 'bool':
            return value === 'true';
        default:
            return value;
    }
}
exports.parseProperty = parseProperty;
function noop() {
    // do nothing
}
exports.noop = noop;
function int(value, defaultValue = null) {
    const tmp = defaultValue == null ? null : defaultValue;
    return value == null ? tmp : parseInt(value, 10);
}
exports.int = int;
function bool(value, defaultValue) {
    const tmp = defaultValue == null ? false : defaultValue;
    return value == null ? tmp : !!parseInt(value, 10);
}
exports.bool = bool;
function float(value, defaultValue = null) {
    const tmp = defaultValue == null ? 0 : defaultValue;
    return value == null ? tmp : parseFloat(value);
}
exports.float = float;
