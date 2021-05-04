declare module 'sax' {
  class SAXParser {
    onerror(error: any): void;
    onopentag(tag: any): void;
    onclosetag(name: string): void;
    ontext(text: string): void;
    onend(): void;
    write(content: string): SAXParser;
    close(): void;
  }
  function parser(): SAXParser;
}
