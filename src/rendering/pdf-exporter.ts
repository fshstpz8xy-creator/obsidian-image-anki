import { App, Notice } from 'obsidian';

/**
 * PDF Export using Electron's printToPDF API
 * Based on better-export-pdf methodology
 */

export interface PDFExportOptions {
	pageSize?: 'A4' | 'Letter' | 'Legal';
	landscape?: boolean;
	printBackground?: boolean;
	marginTop?: number;    // in mm
	marginBottom?: number; // in mm
	marginLeft?: number;   // in mm
	marginRight?: number;  // in mm
}

export class PDFExporter {
	constructor(private app: App) {}

	/**
	 * Export HTML container to PDF using Electron's printToPDF
	 * Returns PDF as Buffer
	 */
	async exportToPDF(
		container: HTMLElement,
		options: PDFExportOptions = {}
	): Promise<Buffer> {
		console.log('PDFExporter.exportToPDF called with:', { options });

		// Get BrowserWindow webContents via Electron remote
		// @ts-ignore - Electron remote is available in Obsidian
		const win = require('electron').remote.getCurrentWindow();
		const webContents = win.webContents;

		if (!webContents) {
			throw new Error('Cannot access webContents for PDF export');
		}

		// Prepare container for printing
		const originalParent = container.parentNode;
		const originalDisplay = container.style.display;

		// Temporarily attach to document for printing
		document.body.appendChild(container);
		container.style.display = 'block';

		try {
			// Build print options matching better-export-pdf format
			const printOptions = {
				pageSize: options.pageSize || 'A4',
				landscape: options.landscape || false,
				printBackground: options.printBackground !== false, // Default true
				margins: {
					marginType: 'custom' as const,
					top: (options.marginTop || 10) / 25.4,    // Convert mm to inches
					bottom: (options.marginBottom || 10) / 25.4,
					left: (options.marginLeft || 10) / 25.4,
					right: (options.marginRight || 10) / 25.4
				}
			};

			console.log('Calling webContents.printToPDF with options:', printOptions);

			// Export to PDF
			const pdfData = await webContents.printToPDF(printOptions);

			console.log('PDF generated successfully:', {
				size: pdfData.length,
				sizeKB: (pdfData.length / 1024).toFixed(1)
			});

			return pdfData;

		} finally {
			// Restore container
			container.style.display = originalDisplay;
			if (originalParent) {
				originalParent.appendChild(container);
			} else {
				document.body.removeChild(container);
			}
		}
	}

	/**
	 * Save PDF to file (for debugging)
	 */
	async savePDFToFile(pdfData: Buffer, filePath: string): Promise<void> {
		const fs = require('fs').promises;
		await fs.writeFile(filePath, pdfData);
		console.log('PDF saved to:', filePath);
	}
}
