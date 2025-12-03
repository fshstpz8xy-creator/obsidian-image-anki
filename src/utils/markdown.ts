import { TFile, App } from 'obsidian';

/**
 * Markdown processing utilities
 */

export interface MarkdownContent {
	fullContent: string;
	contentWithoutFrontmatter: string;
	frontmatter: string | null;
	highlights: string[];
}

/**
 * Read and parse markdown file
 */
export async function readMarkdownFile(app: App, file: TFile): Promise<MarkdownContent> {
	const fullContent = await app.vault.read(file);

	// Extract frontmatter
	const frontmatterMatch = fullContent.match(/^---\n([\s\S]*?)\n---\n/);
	const frontmatter = frontmatterMatch ? frontmatterMatch[1] : null;
	const contentWithoutFrontmatter = frontmatterMatch
		? fullContent.slice(frontmatterMatch[0].length)
		: fullContent;

	// Extract highlights
	const highlights = extractHighlights(fullContent);

	return {
		fullContent,
		contentWithoutFrontmatter,
		frontmatter,
		highlights
	};
}

/**
 * Extract all highlights (==marked text==) from markdown content
 */
export function extractHighlights(content: string): string[] {
	const highlightRegex = /==([^=]+)==/g;
	const highlights: string[] = [];
	let match: RegExpExecArray | null;

	while ((match = highlightRegex.exec(content)) !== null) {
		highlights.push(match[1].trim());
	}

	return highlights;
}

/**
 * Count highlights in markdown content
 */
export function countHighlights(content: string): number {
	return extractHighlights(content).length;
}

/**
 * Check if markdown file has any highlights
 */
export function hasHighlights(content: string): boolean {
	return /==([^=]+)==/.test(content);
}

/**
 * Extract frontmatter tags
 */
export function extractFrontmatterTags(frontmatter: string | null): string[] {
	if (!frontmatter) return [];

	const tagsMatch = frontmatter.match(/tags:\s*\[([^\]]+)\]/);
	if (tagsMatch) {
		return tagsMatch[1].split(',').map(tag => tag.trim().replace(/["']/g, ''));
	}

	const tagMatch = frontmatter.match(/tags?:\s*(.+)/);
	if (tagMatch) {
		return tagMatch[1].split(',').map(tag => tag.trim().replace(/["']/g, ''));
	}

	return [];
}

/**
 * Get content for rendering (with or without frontmatter)
 */
export function getContentForRendering(
	markdownContent: MarkdownContent,
	includeFrontmatter: boolean
): string {
	if (includeFrontmatter) {
		return markdownContent.fullContent;
	}
	return markdownContent.contentWithoutFrontmatter;
}
