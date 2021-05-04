"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TmxObject = void 0;
class TmxObject {
    constructor() {
        this.name = null;
        this.type = null;
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.rotation = 0;
        this.properties = {};
        this.gid = null;
        this.visible = true;
        this.ellipse = false;
        this.polygon = null;
        this.polyline = null;
        this.image = null;
    }
}
exports.TmxObject = TmxObject;
