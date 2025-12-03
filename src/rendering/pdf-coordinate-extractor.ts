import * as pdfjsLib from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

/**
 * Extract highlight coordinates from PDF using text layer API
 * HYBRID APPROACH: This extracts POSITIONS (x/y) from PDF text layer
 * Dimensions (width/height) come from webview and are merged later
 */

export interface PDFHighlight {
	left: number;
	top: number;
	width: number;
	height: number;
	pageNum: number;
	text?: string;
}

export class PDFCoordinateExtractor {
	/**
	 * Extract highlighted text from markdown content
	 * Finds all ==text== patterns and returns clean text strings
	 */
	extractHighlightedTexts(markdown: string): string[] {
		const highlightRegex = /==([^=]+)==/g;
		const texts: string[] = [];
		let match;

		while ((match = highlightRegex.exec(markdown)) !== null) {
			// Get the text inside ==...==
			let text = match[1];

			// Normalize markdown syntax to match rendered PDF text
			text = this.normalizeMarkdownText(text);

			if (text.length > 0) {
				texts.push(text);
			}
		}

		console.log(`PDFCoordinateExtractor: Found ${texts.length} highlighted texts in markdown`);
		return texts;
	}

	/**
	 * Normalize markdown text to match rendered PDF output
	 * Converts markdown syntax to plain text as it appears in PDF
	 */
	private normalizeMarkdownText(text: string): string {
		// Convert markdown links [text](url) to just text
		text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

		// Convert bold **text** or __text__ to text
		text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
		text = text.replace(/__([^_]+)__/g, '$1');

		// Convert italic *text* or _text_ to text
		text = text.replace(/\*([^*]+)\*/g, '$1');
		text = text.replace(/_([^_]+)_/g, '$1');

		// Convert strikethrough ~~text~~ to text
		text = text.replace(/~~([^~]+)~~/g, '$1');

		// Normalize whitespace (multiple spaces to single space)
		text = text.replace(/\s+/g, ' ');

		// Trim
		text = text.trim();

		return text;
	}

	/**
	 * Extract highlight POSITIONS from PDF by matching highlighted text with PDF text layer
	 * Returns positions (left/top) which should be accurate
	 * Width/height from PDF may be less accurate, so webview dimensions are used instead
	 */
	async extractFromPDF(pdfData: Buffer, highlightedTexts: string[]): Promise<PDFHighlight[]> {
		console.log('PDFCoordinateExtractor: Loading PDF...');
		console.log(`PDFCoordinateExtractor: Searching for ${highlightedTexts.length} highlighted texts`);

		// Load PDF document
		const loadingTask = pdfjsLib.getDocument({ data: pdfData });
		const pdf = await loadingTask.promise;

		console.log(`PDFCoordinateExtractor: PDF has ${pdf.numPages} pages`);

		const highlights: PDFHighlight[] = [];

		// Process each page
		for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
			const page = await pdf.getPage(pageNum);
			const viewport = page.getViewport({ scale: 1.0 });
			const textContent = await page.getTextContent();

			console.log(`PDFCoordinateExtractor: Page ${pageNum} (${viewport.width}x${viewport.height}) has ${textContent.items.length} text items`);

			// Match highlighted texts with PDF text positions
			for (const highlightText of highlightedTexts) {
				const matches = this.findTextInPage(
					textContent.items as TextItem[],
					highlightText,
					viewport.width,
					viewport.height,
					pageNum
				);

				if (matches.length > 0) {
					console.log(`PDFCoordinateExtractor: Found ${matches.length} match(es) for "${highlightText.substring(0, 30)}..." on page ${pageNum}`);
				}

				highlights.push(...matches);
			}
		}

		console.log(`PDFCoordinateExtractor: Found ${highlights.length} total highlights across ${pdf.numPages} pages`);
		return highlights;
	}

	/**
	 * Find text in page and extract coordinates from PDF text layer
	 */
	private findTextInPage(
		items: TextItem[],
		searchText: string,
		pageWidth: number,
		pageHeight: number,
		pageNum: number
	): PDFHighlight[] {
		const highlights: PDFHighlight[] = [];
		const normalizedSearch = searchText.toLowerCase().trim();

		// Build full page text to handle multi-item matches
		let fullText = '';
		const itemPositions: number[] = [];

		items.forEach((item) => {
			itemPositions.push(fullText.length);
			fullText += item.str + ' ';
		});

		const normalizedFullText = fullText.toLowerCase();

		// Find all occurrences of search text
		let searchIndex = 0;
		while ((searchIndex = normalizedFullText.indexOf(normalizedSearch, searchIndex)) !== -1) {
			// Find which text items contain this match
			const matchStart = searchIndex;
			const matchEnd = searchIndex + normalizedSearch.length;

			// Find items that overlap with this match
			const matchingItems: TextItem[] = [];
			for (let i = 0; i < items.length; i++) {
				const itemStart = itemPositions[i];
				const itemEnd = i < items.length - 1 ? itemPositions[i + 1] : fullText.length;

				if (itemStart <= matchEnd && itemEnd >= matchStart) {
					matchingItems.push(items[i]);
				}
			}

			if (matchingItems.length > 0) {
				// Calculate bounding boxes (one per line for multi-line highlights)
				const boundingBoxes = this.calculateBoundingBoxes(
					matchingItems,
					pageWidth,
					pageHeight,
					pageNum,
					searchText
				);

				highlights.push(...boundingBoxes);
			}

			searchIndex++;
		}

		return highlights;
	}

	/**
	 * Calculate bounding boxes from text items (one box per line for multi-line highlights)
	 * Groups items by Y position to handle multi-line text correctly
	 */
	private calculateBoundingBoxes(
		items: TextItem[],
		pageWidth: number,
		pageHeight: number,
		pageNum: number,
		text: string
	): PDFHighlight[] {
		if (items.length === 0) {
			console.warn('calculateBoundingBoxes: No items provided');
			return [];
		}

		console.log(`Calculating bounding boxes for "${text.substring(0, 30)}..." from ${items.length} items`);

		// Convert items to normalized coordinates with Y from top
		interface ItemCoords {
			item: TextItem;
			x: number;
			y: number;  // Top Y (converted from bottom-origin)
			width: number;
			height: number;
		}

		const itemCoords: ItemCoords[] = items.map(item => {
			const transform = item.transform;
			const x = transform[4];  // translateX
			const y = transform[5];  // translateY (from bottom)
			const topY = pageHeight - y;  // Convert to top-origin

			return {
				item,
				x,
				y: topY - item.height,  // Top edge of text
				width: item.width,
				height: item.height
			};
		});

		// Group items by line based on Y position
		// Items with Y within 5px are considered same line
		const LINE_THRESHOLD = 5;
		const lines: ItemCoords[][] = [];

		itemCoords.sort((a, b) => a.y - b.y);  // Sort top to bottom

		for (const coord of itemCoords) {
			// Find existing line or create new one
			let foundLine = false;
			for (const line of lines) {
				const lineY = line[0].y;
				if (Math.abs(coord.y - lineY) <= LINE_THRESHOLD) {
					line.push(coord);
					foundLine = true;
					break;
				}
			}

			if (!foundLine) {
				lines.push([coord]);
			}
		}

		console.log(`  Grouped into ${lines.length} line(s)`);

		// Create one bounding box per line
		const boxes: PDFHighlight[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Sort line items left to right
			line.sort((a, b) => a.x - b.x);

			// Calculate bounding box for this line
			const minX = Math.min(...line.map(c => c.x));
			const maxX = Math.max(...line.map(c => c.x + c.width));
			const minY = Math.min(...line.map(c => c.y));
			const maxY = Math.max(...line.map(c => c.y + c.height));

			// Convert to proportional coordinates (0-1 for single page)
			const left = minX / pageWidth;
			const top = minY / pageHeight;
			const width = (maxX - minX) / pageWidth;
			const height = (maxY - minY) / pageHeight;

			console.log(`  Line ${i + 1}: left=${left.toFixed(3)}, top=${top.toFixed(3)}, width=${width.toFixed(3)}, height=${height.toFixed(3)}`);

			boxes.push({
				left,
				top,
				width,
				height,
				pageNum,
				text
			});
		}

		return boxes;
	}
}
