import { App, Component, MarkdownRenderer } from 'obsidian';

/**
 * Render markdown to HTML with Obsidian styling
 */

export interface RenderResult {
	container: HTMLElement;
	cleanup: () => void;
}

export class MarkdownToHtmlRenderer {
	constructor(private app: App) {}

	/**
	 * Render markdown content to HTML in off-screen container
	 */
	async render(
		markdownContent: string,
		sourcePath: string,
		maxWidth: number = 800
	): Promise<RenderResult> {
		// Create off-screen container
		const container = document.createElement('div');
		container.className = 'markdown-preview-view markdown-rendered';
		container.style.position = 'absolute';
		container.style.left = '-9999px';
		container.style.top = '-9999px';
		container.style.width = `${maxWidth}px`;
		container.style.padding = '20px';
		container.style.backgroundColor = 'var(--background-primary)';
		container.style.color = 'var(--text-normal)';

		// Add to document for rendering
		document.body.appendChild(container);

		try {
			// Create a component for the renderer
			const component = new Component();
			component.load();

			// Render markdown using Obsidian's renderer
			await MarkdownRenderer.render(
				this.app,
				markdownContent,
				container,
				sourcePath,
				component
			);

			// Wait for rendering to complete
			await this.waitForRenderComplete(container);

			const cleanup = () => {
				component.unload();
				if (container.parentNode) {
					container.parentNode.removeChild(container);
				}
			};

			return { container, cleanup };
		} catch (error) {
			// Clean up on error
			if (container.parentNode) {
				container.parentNode.removeChild(container);
			}
			throw error;
		}
	}

	/**
	 * Wait for all images and content to load
	 */
	private async waitForRenderComplete(container: HTMLElement): Promise<void> {
		// Wait for images to load
		const images = container.querySelectorAll('img');
		const imagePromises = Array.from(images).map(img => {
			if (img.complete) return Promise.resolve();
			return new Promise((resolve, reject) => {
				img.addEventListener('load', resolve);
				img.addEventListener('error', resolve); // Resolve even on error
				setTimeout(resolve, 2000); // Timeout after 2s
			});
		});

		await Promise.all(imagePromises);

		// Small delay for CSS to apply
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	/**
	 * Apply inline styles from computed styles for better rendering
	 */
	inlineStyles(container: HTMLElement): void {
		const elements = container.querySelectorAll('*');
		elements.forEach(element => {
			const computedStyle = window.getComputedStyle(element as HTMLElement);
			const inlineStyles: string[] = [];

			// Copy important styles
			const stylesToCopy = [
				'color',
				'font-family',
				'font-size',
				'font-weight',
				'line-height',
				'margin',
				'padding',
				'background-color',
				'border',
				'text-align'
			];

			stylesToCopy.forEach(prop => {
				const value = computedStyle.getPropertyValue(prop);
				if (value) {
					inlineStyles.push(`${prop}: ${value}`);
				}
			});

			if (inlineStyles.length > 0) {
				(element as HTMLElement).style.cssText += '; ' + inlineStyles.join('; ');
			}
		});
	}
}
