// mammoth's pre-bundled browser build and turndown's GFM plugin ship no type declarations of their own.
declare module 'mammoth/mammoth.browser' {
  interface Message { type: string; message: string }
  interface Image { read(encoding: string): Promise<string>; contentType: string }
  interface Result { value: string; messages: Message[] }
  interface Options {
    styleMap?: string | string[];
    convertImage?: unknown;
    ignoreEmptyParagraphs?: boolean;
  }
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: Options): Promise<Result>;
    images: { imgElement(fn: (image: Image) => Promise<{ src: string }>): unknown };
  };
  export default mammoth;
}

declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown';
  export const gfm: TurndownService.Plugin;
  export const tables: TurndownService.Plugin;
  export const strikethrough: TurndownService.Plugin;
  export const taskListItems: TurndownService.Plugin;
}
