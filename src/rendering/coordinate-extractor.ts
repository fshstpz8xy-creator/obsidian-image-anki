import { HighlightCoordinate } from '../anki/models';

/**
 * Extract bounding box coordinates from highlighted elements
 */

export interface PixelCoordinate {
	left: number;
	top: number;
	width: number;
	height: number;
}

export class CoordinateExtractor {
	/**
	 * Extract coordinates from all <mark> elements in container
	 */
	extractHighlightCoordinates(container: HTMLElement): PixelCoordinate[] {
		const marks = container.querySelectorAll('mark');
		const coordinates: PixelCoordinate[] = [];

		// Get container's bounding rect for offset calculations
		const containerRect = container.getBoundingClientRect();

		marks.forEach(mark => {
			// Get all rects (handles multi-line highlights)
			const rects = mark.getClientRects();

			// Process each rect (for multi-line highlights)
			for (let i = 0; i < rects.length; i++) {
				const rect = rects[i];

				// Calculate relative coordinates
				const coord: PixelCoordinate = {
					left: rect.left - containerRect.left,
					top: rect.top - containerRect.top,
					width: rect.width,
					height: rect.height
				};

				// Only add non-zero sized rectangles
				if (coord.width > 0 && coord.height > 0) {
					coordinates.push(coord);
				}
			}
		});

		return coordinates;
	}

	/**
	 * Convert pixel coordinates to proportional (0-1 range)
	 */
	toProportional(
		pixelCoords: PixelCoordinate[],
		containerWidth: number,
		containerHeight: number
	): HighlightCoordinate[] {
		return pixelCoords.map(coord => ({
			left: coord.left / containerWidth,
			top: coord.top / containerHeight,
			width: coord.width / containerWidth,
			height: coord.height / containerHeight
		}));
	}

	/**
	 * Validate proportional coordinates are in valid range
	 */
	validateCoordinates(coords: HighlightCoordinate[]): boolean {
		return coords.every(coord => {
			return (
				coord.left >= 0 && coord.left <= 1 &&
				coord.top >= 0 && coord.top <= 1 &&
				coord.width >= 0 && coord.width <= 1 &&
				coord.height >= 0 && coord.height <= 1 &&
				(coord.left + coord.width) <= 1.01 && // Allow tiny rounding error
				(coord.top + coord.height) <= 1.01
			);
		});
	}

	/**
	 * Apply device pixel ratio scaling
	 */
	applyDPRScaling(coords: PixelCoordinate[], dpr: number): PixelCoordinate[] {
		return coords.map(coord => ({
			left: coord.left * dpr,
			top: coord.top * dpr,
			width: coord.width * dpr,
			height: coord.height * dpr
		}));
	}

	/**
	 * Merge overlapping or very close rectangles (optional optimization)
	 */
	mergeCloseRectangles(
		coords: PixelCoordinate[],
		threshold: number = 5
	): PixelCoordinate[] {
		if (coords.length <= 1) return coords;

		const merged: PixelCoordinate[] = [];
		const used = new Set<number>();

		for (let i = 0; i < coords.length; i++) {
			if (used.has(i)) continue;

			let current = coords[i];

			// Try to merge with nearby rectangles
			for (let j = i + 1; j < coords.length; j++) {
				if (used.has(j)) continue;

				const other = coords[j];

				// Check if rectangles are close (same line, small gap)
				if (
					Math.abs(current.top - other.top) < threshold &&
					Math.abs(current.height - other.height) < threshold
				) {
					const gap = Math.min(
						Math.abs(current.left + current.width - other.left),
						Math.abs(other.left + other.width - current.left)
					);

					if (gap < threshold) {
						// Merge rectangles
						const left = Math.min(current.left, other.left);
						const right = Math.max(
							current.left + current.width,
							other.left + other.width
						);
						current = {
							left,
							top: Math.min(current.top, other.top),
							width: right - left,
							height: Math.max(current.height, other.height)
						};
						used.add(j);
					}
				}
			}

			merged.push(current);
		}

		return merged;
	}
}
