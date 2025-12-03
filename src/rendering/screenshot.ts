import html2canvas from 'html2canvas';

/**
 * Screenshot capture using html2canvas
 */

export interface ScreenshotOptions {
	quality: number;       // DPI multiplier (1-4)
	maxWidth: number;
	maxHeight: number;
	format: 'png' | 'jpeg';
}

export interface ScreenshotResult {
	dataUrl: string;       // Base64 data URL
	base64Data: string;    // Pure base64 (without data: prefix)
	width: number;
	height: number;
}

export class ScreenshotCapture {
	/**
	 * Capture full-page screenshot of container
	 */
	async capture(
		container: HTMLElement,
		options: ScreenshotOptions
	): Promise<ScreenshotResult> {
		// Validate height
		const containerHeight = container.scrollHeight;
		if (containerHeight > options.maxHeight) {
			console.warn(
				`Container height (${containerHeight}px) exceeds max height (${options.maxHeight}px). ` +
				'This may cause performance issues or memory errors.'
			);
		}

		try {
			// Capture using html2canvas (fallback only - PDF pipeline preferred)
			const canvas = await html2canvas(container, {
				scale: options.quality,
				useCORS: true,
				logging: false,
				backgroundColor: getComputedStyle(container).backgroundColor || '#ffffff',
				windowWidth: container.scrollWidth,
				windowHeight: container.scrollHeight,
				width: container.scrollWidth,
				height: container.scrollHeight
			});

			// Convert to desired format
			const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
			const dataUrl = canvas.toDataURL(mimeType, 0.95);

			// Extract base64 data
			const base64Data = dataUrl.split(',')[1];

			return {
				dataUrl,
				base64Data,
				width: canvas.width,
				height: canvas.height
			};
		} catch (error) {
			console.error('Screenshot capture failed:', error);
			throw new Error(`Failed to capture screenshot: ${error.message}`);
		}
	}

	/**
	 * Estimate memory usage for screenshot
	 */
	estimateMemoryUsage(width: number, height: number, quality: number): number {
		// Rough estimate: width * height * quality^2 * 4 bytes per pixel
		const pixels = width * height * Math.pow(quality, 2);
		const bytes = pixels * 4; // RGBA
		return bytes;
	}

	/**
	 * Check if screenshot is feasible
	 */
	isFeasible(containerHeight: number, maxHeight: number): { feasible: boolean; reason?: string } {
		if (containerHeight > maxHeight) {
			return {
				feasible: false,
				reason: `Container height (${containerHeight}px) exceeds maximum (${maxHeight}px)`
			};
		}

		// Check estimated memory usage (rough limit: 100MB)
		const estimatedMB = this.estimateMemoryUsage(800, containerHeight, 2) / (1024 * 1024);
		if (estimatedMB > 100) {
			return {
				feasible: false,
				reason: `Estimated memory usage (${estimatedMB.toFixed(0)}MB) too high`
			};
		}

		return { feasible: true };
	}
}
