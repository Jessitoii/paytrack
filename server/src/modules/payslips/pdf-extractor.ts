import * as pdfModule from 'pdf-parse';

export interface ExtractedPdfDocument {
  text: string;
  totalPages: number;
  info?: any;
}

export class PdfExtractor {
  /**
   * Extracts text content and metadata from a PDF buffer.
   */
  static async extractText(buffer: Buffer): Promise<ExtractedPdfDocument> {
    if (!buffer || buffer.length === 0) {
      throw new Error('Cannot extract text from empty file buffer');
    }

    try {
      // 1. Support modern PDFParse class (pdf-parse v2)
      const PDFParseClass = (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse;
      if (PDFParseClass && typeof PDFParseClass === 'function') {
        const parser = new PDFParseClass({ data: buffer });
        const result = await parser.getText();
        const text = result?.text ? result.text.trim() : '';

        if (!text) {
          throw new Error('No readable text content could be extracted from the PDF');
        }

        return {
          text,
          totalPages: result?.total || 1,
        };
      }

      // 2. Support classic function signature (pdf-parse v1)
      const parseFn = typeof pdfModule === 'function' ? pdfModule : (pdfModule as any).default;
      if (typeof parseFn === 'function') {
        const data = await parseFn(buffer);
        const text = data.text ? data.text.trim() : '';
        if (!text) {
          throw new Error('No readable text content could be extracted from the PDF');
        }
        return {
          text,
          totalPages: data.numpages || 1,
          info: data.info,
        };
      }

      throw new Error('Could not find compatible PDF parsing function or class');
    } catch (err: any) {
      throw new Error(`Failed to parse PDF document: ${err.message}`);
    }
  }
}
