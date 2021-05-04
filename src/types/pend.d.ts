declare module 'pend' {
  export default class Pend {
    go(fn: (callback: (error?: any) => void) => void): void;
    wait(fn: (error: any) => void): void;
  }
}
