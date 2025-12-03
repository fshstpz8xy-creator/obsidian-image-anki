import { HighlightCoordinate } from '../anki/models';

/**
 * Maps highlight coordinates from full PDF to individual pages
 *
 * Problem: Coordinates are proportional to entire PDF (multi-page), but we need
 * them per-page for individual Anki cards.
 *
 * Example:
 * - PDF: 3 pages, each 1123px high (total 3369px)
 * - Coordinate at top=0.5 (50% = 1684.5px)
 * - Maps to: Page 2, top=0.5 (middle of page 2)
 */

export interface PageCoordinate extends HighlightCoordinate {
	pageNum: number;
}

export interface PageDimensions {
	width: number;
	height: number;
}

export class CoordinateMapper {
	/**
	 * Map coordinates from full PDF to individual pages
	 *
	 * Coordinates use a multi-page proportional system where:
	 * - Page 1: 0.0 - 1.0
	 * - Page 2: 1.0 - 2.0
	 * - Page 3: 2.0 - 3.0, etc.
	 *
	 * @param coordinates - Proportional coordinates relative to full multi-page PDF
	 * @param pdfDimensions - Unused (kept for API compatibility)
	 * @param pageDimensions - Unused (kept for API compatibility)
	 * @returns Map of pageNum → coordinates for that page
	 */
	mapCoordinatesToPages(
		coordinates: HighlightCoordinate[],
		pdfDimensions: PageDimensions,
		pageDimensions: PageDimensions
	): Map<number, PageCoordinate[]> {
		const pageMap = new Map<number, PageCoordinate[]>();

		console.log(`CoordinateMapper: Mapping ${coordinates.length} coordinates to pages`);

		for (const coord of coordinates) {
			// Extract page number from proportional coordinate
			// coord.top = 1.386 means page 2, 38.6% down
			const pageNum = Math.floor(coord.top) + 1;

			// Calculate position within the page (0-1)
			const topWithinPage = coord.top - (pageNum - 1);

			// Create page-relative coordinate
			const pageCoord: PageCoordinate = {
				pageNum,
				left: coord.left,      // Horizontal position unchanged
				top: topWithinPage,    // 0-1 within this page
				width: coord.width,    // Width unchanged
				height: coord.height   // Height unchanged (already proportional)
			};

			// Validate coordinate is within bounds
			if (pageCoord.top < 0 || pageCoord.top > 1) {
				console.warn(`CoordinateMapper: Invalid top coordinate ${pageCoord.top} for page ${pageNum}, clamping`);
				pageCoord.top = Math.max(0, Math.min(1, pageCoord.top));
			}

			if (pageCoord.top + pageCoord.height > 1) {
				console.warn(`CoordinateMapper: Coordinate extends beyond page ${pageNum}, clamping height`);
				pageCoord.height = 1 - pageCoord.top;
			}

			// Add to page map
			if (!pageMap.has(pageNum)) {
				pageMap.set(pageNum, []);
			}
			pageMap.get(pageNum)!.push(pageCoord);

			console.log(`CoordinateMapper: Mapped coord to page ${pageNum}: top=${pageCoord.top.toFixed(3)}, height=${pageCoord.height.toFixed(3)}`);
		}

		// Log summary
		for (const [pageNum, coords] of pageMap.entries()) {
			console.log(`CoordinateMapper: Page ${pageNum} has ${coords.length} coordinates`);
		}

		return pageMap;
	}

	/**
	 * Get coordinates for a specific page
	 */
	getCoordinatesForPage(
		pageNum: number,
		coordinateMap: Map<number, PageCoordinate[]>
	): PageCoordinate[] {
		return coordinateMap.get(pageNum) || [];
	}

	/**
	 * Get total pages with highlights
	 */
	getPageCount(coordinateMap: Map<number, PageCoordinate[]>): number {
		return coordinateMap.size;
	}
}
