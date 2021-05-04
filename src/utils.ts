export function parsePoints(str: string) {
  const points = str.split(' ');
  return points.map((pt) => {
    const xy = pt.split(',');
    return {
      x: xy[0],
      y: xy[1],
    };
  });
}

export function parseProperty(value: any, type: string) {
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

export function noop() {
  // do nothing
}

export function int(value: any, defaultValue: number|null = null): number|null {
  const tmp = defaultValue == null ? null : defaultValue;
  return value == null ? tmp : parseInt(value, 10);
}

export function bool(value: any, defaultValue: boolean|null): boolean {
  const tmp = defaultValue == null ? false : defaultValue;
  return value == null ? tmp : !!parseInt(value, 10);
}

export function float(value: any, defaultValue: number|null = null): number {
  const tmp = defaultValue == null ? 0 : defaultValue;
  return value == null ? tmp : parseFloat(value);
}
