declare module 'zstd-codec' {
  class Zstd {
  }
  class ZstdCodec {
    static run(fn: (zstd: any) => void): void;
  }
}
