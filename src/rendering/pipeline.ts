import { App, TFile } from 'obsidian';
import { MarkdownToHtmlRenderer } from './markdown-renderer';
import { CoordinateExtractor } from './coordinate-extractor';
import { ScreenshotCapture, ScreenshotOptions } from './screenshot';
import { PDFExporter } from './pdf-exporter';
import { PDFToImageConverter } from './pdf-to-images';
import { BetterPDFIntegration } from './better-pdf-integration';
import { PDFToPNGConverter } from './pdf-to-png';
import { CoordinateMapper } from './coordinate-mapper';
import { ProcessedDocument, HighlightCoordinate, PageData } from '../anki/models';
import { generateContentHash } from '../utils/hash';

// File-based logging
const fs = require('fs').promises;
const path = require('path');
let pipelineLogPath: string | null = null;

async function logToFile(message: string) {
	try {
		if (!pipelineLogPath) {
			const pluginDir = (window as any).app.vault.adapter.basePath + '/.obsidian/plugins/new-pdf-anki';
			pipelineLogPath = path.join(pluginDir, 'debug.log');
		}
		const timestamp = new Date().toISOString();
		await fs.appendFile(pipelineLogPath, `[${timestamp}] ${message}\n`);
	} catch (error) {
		console.error('Failed to write to pipeline log:', error);
	}
}

/**
 * Orchestrate the complete rendering pipeline
 */

export interface PipelineOptions {
	includeFrontmatter: boolean;
	imageQuality: number;
	maxImageWidth: number;
	maxImageHeight: number;
	imageFormat: 'png' | 'jpeg';
	usePDFPipeline?: boolean; // NEW: Enable PDF-first workflow
	coordinateOffsetX?: number; // Horizontal offset adjustment in pixels
	coordinateOffsetY?: number; // Vertical offset adjustment in pixels
	fileMarginLeft?: number;   // Left margin correction in pixels (default: 103)
	fileMarginTop?: number;    // Top margin correction in pixels (default: 0)
	fileMarginRight?: number;  // Right margin correction in pixels (reserved for future use)
	fileMarginBottom?: number; // Bottom margin correction in pixels (reserved for future use)
	pdfMarginType?: '0' | '1' | '2' | '3'; // PDF page margin type
	pdfMarginTop?: number;     // PDF top margin in mm (for custom margins)
	pdfMarginBottom?: number;  // PDF bottom margin in mm
	pdfMarginLeft?: number;    // PDF left margin in mm
	pdfMarginRight?: number;   // PDF right margin in mm
}

export class RenderingPipeline {
	private app: App;
	private markdownRenderer: MarkdownToHtmlRenderer;
	private coordinateExtractor: CoordinateExtractor;
	private screenshotCapture: ScreenshotCapture;
	private pdfExporter: PDFExporter;
	private pdfToImageConverter: PDFToImageConverter;
	private betterPDFIntegration: BetterPDFIntegration;
	private pdfToPNGConverter: PDFToPNGConverter;
	private coordinateMapper: CoordinateMapper;

	constructor(app: App) {
		this.app = app;
		this.markdownRenderer = new MarkdownToHtmlRenderer(app);
		this.coordinateExtractor = new CoordinateExtractor();
		this.screenshotCapture = new ScreenshotCapture();
		this.pdfExporter = new PDFExporter(app);
		this.pdfToImageConverter = new PDFToImageConverter();
		this.betterPDFIntegration = new BetterPDFIntegration(app);
		this.pdfToPNGConverter = new PDFToPNGConverter();
		this.coordinateMapper = new CoordinateMapper();
	}

	/**
	 * Execute complete rendering pipeline
	 */
	async process(
		file: TFile,
		markdownContent: string,
		options: PipelineOptions
	): Promise<ProcessedDocument> {
		let renderResult: { container: HTMLElement; cleanup: () => void } | null = null;

		try {
			// Step 1: Render markdown to HTML
			renderResult = await this.markdownRenderer.render(
				markdownContent,
				file.path,
				options.maxImageWidth
			);

			const container = renderResult.container;

			// Basic container validation
			if (!container) {
				throw new Error('Rendered container is null. Rendering failed completely.');
			}

			// Log container state for debugging
			console.log('Container state:', {
				children: container.children.length,
				scrollHeight: container.scrollHeight,
				scrollWidth: container.scrollWidth,
				innerHTML: container.innerHTML.substring(0, 500) + '...'
			});

			// Step 2: Validate highlights exist in HTML
			// We'll get actual coordinates from the PDF webview rendering
			const marks = container.querySelectorAll('mark');
			if (marks.length === 0) {
				throw new Error(
					`No highlight elements (<mark> tags) found in rendered HTML. ` +
					`Container has ${container.children.length} children and ${container.scrollHeight}px height. ` +
					`This might mean highlights didn't render properly.`
				);
			}

			console.log(`Found ${marks.length} highlight elements in HTML (coordinates will be extracted from PDF rendering)`);

			// Validate container dimensions (after confirming highlights exist)
			if (container.scrollHeight === 0 || container.scrollWidth === 0) {
				console.warn('Container has zero dimensions but highlights were found. Proceeding anyway.');
			}

			// Check feasibility
			const feasibility = this.screenshotCapture.isFeasible(
				container.scrollHeight || 1000, // Default height if zero
				options.maxImageHeight
			);

			if (!feasibility.feasible) {
				throw new Error(feasibility.reason || 'Screenshot not feasible');
			}

			// Step 3: Export to PDF and extract coordinates from final rendering
			console.log('Exporting to PDF and extracting coordinates from webview...');
			const exportResult = await this.betterPDFIntegration.exportFileToPDF(
				file,
				options.coordinateOffsetX || 0,
				options.coordinateOffsetY || 0,
				options.fileMarginLeft || 103,
				options.fileMarginTop || 0,
				options.pdfMarginType || '0',
				options.pdfMarginTop || 10,
				options.pdfMarginBottom || 10,
				options.pdfMarginLeft || 10,
				options.pdfMarginRight || 10
			);

			// Save PDF for debugging
			const path = require('path');
			const pluginDir = (this.app.vault.adapter as any).basePath + '/.obsidian/plugins/new-pdf-anki';
			const pdfPath = path.join(pluginDir, 'debug-export.pdf');
			await this.betterPDFIntegration.savePDF(exportResult.pdfData, pdfPath);

			console.log(`PDF saved to ${pdfPath} (${(exportResult.pdfData.length / 1024).toFixed(1)}KB)`);

			// Use PDF dimensions
			const pdfDimensions = {
				width: exportResult.pdfWidth,
				height: exportResult.pdfHeight
			};

			console.log('PDF dimensions:', pdfDimensions);

			// Step 4: Use coordinates extracted from webview (already proportional)
			// These coordinates come from the EXACT HTML that became the PDF
			const proportionalCoords = exportResult.coordinates;
			console.log(`Using ${proportionalCoords.length} coordinates from webview rendering (already proportional)`);

			// DIAGNOSTIC: Save BOTH coordinate sets for comparison
			const coordsPath = path.join(pluginDir, 'coordinates.json');
			const fs = require('fs').promises;
			await fs.writeFile(
				coordsPath,
				JSON.stringify({
					filePath: file.path,
					pdfPath: pdfPath,
					coordinates: proportionalCoords,  // Used for actual rendering
					webviewCoordinates: exportResult.webviewCoordinates,  // Diagnostic
					pdfCoordinates: exportResult.pdfCoordinates,  // Diagnostic
					pdfDimensions: pdfDimensions,
					timestamp: new Date().toISOString(),
					diagnostic: {
						webviewCount: exportResult.webviewCoordinates.length,
						pdfCount: exportResult.pdfCoordinates.length,
						countMatch: exportResult.webviewCoordinates.length === exportResult.pdfCoordinates.length
					}
				}, null, 2)
			);
			console.log(`[DIAGNOSTIC] Coordinates saved to ${coordsPath}`);

			// Step 5: Convert PDF to PNG pages
			console.log('Converting PDF pages to PNG...');
			await logToFile('=== STEP 5: Converting PDF to PNG pages ===');
			console.log(`PDF data size: ${exportResult.pdfData.length} bytes`);
			await logToFile(`PDF data size: ${exportResult.pdfData.length} bytes`);

			let pageImages;
			try {
				await logToFile('Calling PDFToPNGConverter.convertPDFToPages()...');
				pageImages = await this.pdfToPNGConverter.convertPDFToPages(exportResult.pdfData);
				console.log(`✅ Converted ${pageImages.length} PDF pages to PNG`);
				await logToFile(`✅ Converted ${pageImages.length} PDF pages to PNG`);

				if (pageImages.length === 0) {
					await logToFile('ERROR: PDF-to-PNG conversion returned 0 pages');
					throw new Error('PDF-to-PNG conversion returned 0 pages - conversion failed');
				}
			} catch (pngError) {
				console.error('❌ PDF-to-PNG conversion failed:', pngError);
				console.error('Error stack:', pngError.stack);
				await logToFile(`❌ PDF-to-PNG conversion FAILED: ${pngError.message}`);
				await logToFile(`Error stack: ${pngError.stack}`);
				throw new Error(`Failed to convert PDF to PNG pages: ${pngError.message}`);
			}

			// Step 6: Map coordinates to pages
			console.log('Mapping coordinates to pages...');
			const coordinateMap = this.coordinateMapper.mapCoordinatesToPages(
				proportionalCoords,
				pdfDimensions,
				{
					width: pageImages[0]?.width || pdfDimensions.width,
					height: pageImages[0]?.height || pdfDimensions.height
				}
			);

			// Combine page images with their coordinates
			const pages: PageData[] = pageImages.map(pageImage => {
				const pageCoords = this.coordinateMapper.getCoordinatesForPage(
					pageImage.pageNum,
					coordinateMap
				);

				// Convert PageCoordinate[] to HighlightCoordinate[] (strip pageNum field)
				// This ensures coordinates are per-page (0-1) without multi-page encoding
				const normalizedCoords: HighlightCoordinate[] = pageCoords.map(coord => ({
					left: coord.left,
					top: coord.top,
					width: coord.width,
					height: coord.height
				}));

				return {
					pageNum: pageImage.pageNum,
					pngData: pageImage.pngData,
					coordinates: normalizedCoords,
					width: pageImage.width,
					height: pageImage.height
				};
			});

			console.log(`Created ${pages.length} pages with coordinates`);
			console.log('Page details:', pages.map(p => ({
				pageNum: p.pageNum,
				coordinateCount: p.coordinates.length,
				pngDataSize: p.pngData.length,
				dimensions: { width: p.width, height: p.height }
			})));

			// Step 7: Validate coordinates
			const valid = this.coordinateExtractor.validateCoordinates(proportionalCoords);
			if (!valid) {
				console.warn('Some coordinates are out of bounds, but continuing...');
			}

			// Step 7: Generate content hash
			const contentHash = await generateContentHash(
				markdownContent + JSON.stringify(proportionalCoords)
			);

			// Build result
			const result: ProcessedDocument = {
				filePath: file.path,
				content: markdownContent,
				contentHash,
				highlights: proportionalCoords,
				pdfPath: pdfPath,
				pdfDimensions: pdfDimensions,
				pages: pages  // Include page data for Anki sync
			};

			console.log('Rendering pipeline complete:', {
				filePath: file.path,
				highlightCount: proportionalCoords.length,
				pdfDimensions: pdfDimensions,
				pdfSize: `${(exportResult.pdfData.length / 1024).toFixed(1)}KB`,
				contentHash: contentHash.substring(0, 8)
			});

			return result;

		} finally {
			// Always cleanup
			if (renderResult) {
				renderResult.cleanup();
			}
		}
	}

	/**
	 * Validate pipeline prerequisites
	 */
	validatePrerequisites(markdownContent: string): { valid: boolean; error?: string } {
		// Check for highlights in markdown
		const hasHighlights = /==([^=]+)==/.test(markdownContent);
		if (!hasHighlights) {
			return {
				valid: false,
				error: 'No highlights found in markdown content. Use ==text== syntax.'
			};
		}

		return { valid: true };
	}
}
