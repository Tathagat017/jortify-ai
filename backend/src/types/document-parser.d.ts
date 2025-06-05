declare module "pdf-parse" {
  interface PDFInfo {
    numpages: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PDFInfo>;
  export = pdfParse;
}

declare module "mammoth" {
  interface ExtractResult {
    value: string;
    messages: any[];
  }

  export function extractRawText(options: {
    buffer: Buffer;
  }): Promise<ExtractResult>;
}
