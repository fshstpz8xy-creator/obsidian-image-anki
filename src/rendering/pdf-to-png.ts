import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker (use unpkg CDN which auto-matches package version)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs';

/**
 * PDF-to-PNG converter using pdf.js and HTML canvas
 *
 * Strategy:
 * 1. Use pdf-lib to split PDF into individual pages
 * 2. Use pdf.js to render each page PDF to HTML canvas
 * 3. Convert canvas to PNG buffer
 */

export interface PagePNGData {
	pageNum: number;
	pngData: Buffer;
	width: number;
	height: number;
}

export class PDFToPNGConverter {
	/**
	 * Convert PDF to array of PNG images (one per page)
	 */
	async convertPDFToPages(pdfData: Buffer): Promise<PagePNGData[]> {
		console.log('PDFToPNGConverter: Starting PDF page extraction');

		// Load PDF with pdf-lib
		const pdfDoc = await PDFDocument.load(pdfData);
		const pageCount = pdfDoc.getPageCount();

		console.log(`PDFToPNGConverter: Found ${pageCount} pages`);

		const pageImages: PagePNGData[] = [];

		// Extract each page
		for (let i = 0; i < pageCount; i++) {
			const pageNum = i + 1;
			console.log(`PDFToPNGConverter: Extracting page ${pageNum}/${pageCount}`);

			// Create new PDF with single page
			const singlePagePDF = await PDFDocument.create();
			const [copiedPage] = await singlePagePDF.copyPages(pdfDoc, [i]);
			singlePagePDF.addPage(copiedPage);

			// Get page dimensions
			const page = copiedPage;
			const { width, height } = page.getSize();

			// Convert single page to PNG using pdf.js + canvas
			const pngData = await this.renderPageToPNG(await singlePagePDF.save(), width, height);

			pageImages.push({
				pageNum,
				pngData,
				width: Math.round(width),
				height: Math.round(height)
			});
		}

		console.log(`PDFToPNGConverter: Extracted ${pageImages.length} pages`);
		return pageImages;
	}

	/**
	 * Render single-page PDF to PNG using pdf.js and HTML canvas
	 */
	private async renderPageToPNG(pdfData: Uint8Array, width: number, height: number): Promise<Buffer> {
		try {
			console.log('PDFToPNGConverter: Loading PDF with pdf.js');

			// Load PDF with pdf.js
			const loadingTask = pdfjsLib.getDocument({
				data: pdfData,
				// Disable font loading to avoid CORS issues
				disableFontFace: false,
				// Use standard fonts from unpkg
				standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.4.449/standard_fonts/'
			});

			const pdf = await loadingTask.promise;
			console.log('PDFToPNGConverter: PDF loaded, getting first page');

			// Get first (and only) page
			const page = await pdf.getPage(1);

			// Calculate scale for high-quality output
			// PDF dimensions are in points (72 DPI), so scale up significantly
			// Use 2.0x scale for high quality (equivalent to 144 DPI)
			const viewport = page.getViewport({ scale: 1.0 });
			const baseScale = Math.min(width / viewport.width, height / viewport.height);
			const scale = baseScale * 2.0; // 2x multiplier for quality
			const scaledViewport = page.getViewport({ scale });

			console.log('PDFToPNGConverter: Rendering to canvas', {
				width: scaledViewport.width,
				height: scaledViewport.height,
				scale
			});

			// Create canvas
			const canvas = document.createElement('canvas');
			canvas.width = scaledViewport.width;
			canvas.height = scaledViewport.height;

			const context = canvas.getContext('2d');
			if (!context) {
				throw new Error('Failed to get 2D context from canvas');
			}

			// Render PDF page to canvas
			const renderContext = {
				canvasContext: context,
				viewport: scaledViewport,
				canvas: canvas
			};

			await page.render(renderContext).promise;

			console.log('PDFToPNGConverter: Rendering complete, converting to PNG');

			// Convert canvas to PNG blob
			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Canvas toBlob returned null'));
					}
				}, 'image/png');
			});

			// Convert blob to buffer
			const arrayBuffer = await blob.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			console.log('PDFToPNGConverter: PNG conversion complete', {
				bufferType: typeof buffer,
				bufferLength: buffer.length,
				isBuffer: Buffer.isBuffer(buffer)
			});

			return buffer;

		} catch (error) {
			console.error('PDFToPNGConverter: Error rendering page:', error);
			throw error;
		}
	}
}
