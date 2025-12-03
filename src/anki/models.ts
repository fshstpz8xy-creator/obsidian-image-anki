/**
 * AnkiConnect API types and interfaces
 */

export interface AnkiConnectRequest {
	action: string;
	version: number;
	params?: Record<string, any>;
}

export interface AnkiConnectResponse<T = any> {
	result: T;
	error: string | null;
}

export interface AnkiNote {
	deckName: string;
	modelName: string;
	fields: Record<string, string>;
	tags: string[];
	options?: {
		allowDuplicate?: boolean;
		duplicateScope?: string;
		duplicateScopeOptions?: {
			deckName?: string;
			checkChildren?: boolean;
			checkAllModels?: boolean;
		};
	};
}

export interface AnkiMediaFile {
	filename: string;
	data: string; // base64 encoded
}

export interface ImageOcclusionFields {
	[key: string]: string | undefined;   // Index signature for Record<string, string> compatibility
	Image: string;           // <img src="filename.png"> (Anki HTML media format)
	Occlusion: string;       // Cloze occlusion syntax (singular!)
	Header?: string;         // Optional: File path (unique identifier)
	'Back Extra'?: string;   // Optional: Additional notes/metadata
	Comments?: string;       // Required by built-in Image Occlusion
}

export interface HighlightCoordinate {
	left: number;    // proportional (0-1)
	top: number;     // proportional (0-1)
	width: number;   // proportional (0-1)
	height: number;  // proportional (0-1)
}

export interface PageData {
	pageNum: number;
	pngData: Buffer;
	coordinates: HighlightCoordinate[];
	width: number;
	height: number;
}

export interface ProcessedDocument {
	filePath: string;
	content: string;
	contentHash: string;
	highlights: HighlightCoordinate[];
	pdfPath: string;        // Path to generated PDF
	pdfDimensions: {
		width: number;      // PDF page width in pixels
		height: number;     // PDF page height in pixels
	};
	pages?: PageData[];     // Optional: PNG pages with per-page coordinates
}

export class AnkiConnectError extends Error {
	constructor(message: string, public readonly originalError?: any) {
		super(message);
		this.name = 'AnkiConnectError';
	}
}
