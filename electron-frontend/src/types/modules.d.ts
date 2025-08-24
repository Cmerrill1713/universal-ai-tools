declare module 'node-fetch' {
  const fetch: any;
  export default fetch;
}

declare module 'xml2js' {
  export function parseString(xml: string, callback: (err: any, result: any) => void): void;
  export const Parser: any;
}

declare module 'react-window' {
  export const FixedSizeList: any;
  export const VariableSizeList: any;
}
