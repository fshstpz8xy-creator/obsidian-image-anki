/**
 * Content hashing utilities for update detection
 */

export async function generateContentHash(content: string): Promise<string> {
	// Use Web Crypto API for hashing
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

export async function generateHighlightHash(highlights: string[]): Promise<string> {
	// Generate hash from highlight positions and content
	const content = highlights.sort().join('|');
	return await generateContentHash(content);
}
