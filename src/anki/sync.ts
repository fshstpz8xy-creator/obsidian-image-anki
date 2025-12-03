import { TFile } from 'obsidian';
import { AnkiConnectClient } from './client';
import { AnkiNote, ImageOcclusionFields, PageData } from './models';
import { generateHighlightHash } from '../utils/hash';

/**
 * Sync logic for creating and updating Anki cards
 */

export interface SyncResult {
	success: boolean;
	noteId?: number;
	wasUpdate: boolean;
	error?: string;
}

export class AnkiSyncManager {
	constructor(private client: AnkiConnectClient) {}

	/**
	 * Ensure deck exists (create if needed)
	 * Anki automatically creates parent decks for nested decks (e.g., "folder1::folder2")
	 */
	async ensureDeck(deckName: string): Promise<void> {
		try {
			const decks = await this.client.deckNames();

			if (!decks.includes(deckName)) {
				console.log(`Creating deck: ${deckName}`);
				await this.client.createDeck(deckName);
			}
		} catch (error) {
			console.error(`Error ensuring deck exists: ${deckName}`, error);
			throw error;
		}
	}

	/**
	 * Find existing note by file path
	 */
	async findNoteByFilePath(filePath: string): Promise<number | null> {
		try {
			// Query using Header field which contains file path
			const query = `"Header:${filePath}"`;
			const noteIds = await this.client.findNotes(query);

			if (noteIds.length === 0) {
				return null;
			}

			// Should only be one note per file
			if (noteIds.length > 1) {
				console.warn(`Multiple notes found for ${filePath}, using first one`);
			}

			return noteIds[0];
		} catch (error) {
			console.error('Error finding note:', error);
			return null;
		}
	}

	/**
	 * Create or update Anki card
	 */
	async syncCard(
		filePath: string,
		fields: ImageOcclusionFields,
		imageFilename: string,
		imageData: string,
		deckName: string,
		tags: string[]
	): Promise<SyncResult> {
		try {
			// Check available note types to find the correct Image Occlusion model
			const modelNames = await this.client.getModelNames();
			console.log('Available Anki note types:', modelNames);

			// Priority order: Try standard Image Occlusion first
			let imageOcclusionModel: string | undefined = modelNames.find(name =>
				name === 'Image Occlusion Enhanced' || name === 'Image Occlusion'
			);

			if (!imageOcclusionModel) {
				// Fall back to any Image Occlusion variant
				imageOcclusionModel = modelNames.find(name =>
					name.includes('Image Occlusion') || name.includes('image-occlusion')
				);
			}

			if (!imageOcclusionModel) {
				throw new Error(
					`Image Occlusion note type not found in Anki. Please install the Image Occlusion Enhanced add-on. Available types: ${modelNames.join(', ')}`
				);
			}

			console.log(`Using note type: "${imageOcclusionModel}"`);

			// Check what fields this model expects
			const expectedFields = await this.client.getModelFieldNames(imageOcclusionModel);
			console.log(`Expected fields for "${imageOcclusionModel}":`, expectedFields);
			console.log('Fields we are providing:', Object.keys(fields));

			// Compare fields
			const missingFields = expectedFields.filter(field => !(field in fields));
			const extraFields = Object.keys(fields).filter(field => !expectedFields.includes(field));

			if (missingFields.length > 0) {
				console.warn('Missing required fields:', missingFields);
			}
			if (extraFields.length > 0) {
				console.warn('Extra fields (not in model):', extraFields);
			}

			// Upload image first
			console.log(`Uploading image to Anki: ${imageFilename} (${imageData.length} bytes base64)`);

			// Validate base64 data
			if (!imageData || imageData.length === 0) {
				throw new Error('Image data is empty - cannot upload to Anki');
			}
			if (!/^[A-Za-z0-9+/=]+$/.test(imageData.substring(0, 100))) {
				throw new Error('Image data is not valid base64');
			}

			try {
				const mediaResult = await this.client.storeMediaFile(imageFilename, imageData);
				console.log(`✅ Image uploaded successfully. Result:`, mediaResult);

				// Verify the image was actually stored by checking if it exists
				// AnkiConnect storeMediaFile returns null on success, or throws on failure
				if (mediaResult === null) {
					console.log(`✅ storeMediaFile returned null (success)`);
				} else {
					console.log(`⚠️ storeMediaFile returned unexpected value:`, mediaResult);
				}
			} catch (mediaError) {
				console.error(`❌ Image upload FAILED:`, mediaError);
				console.error(`Error details:`, {
					message: mediaError.message,
					stack: mediaError.stack,
					imageFilename,
					imageDataLength: imageData.length
				});
				throw new Error(`Failed to upload image ${imageFilename}: ${mediaError.message}`);
			}

			// Check if note already exists
			const existingNoteId = await this.findNoteByFilePath(filePath);

			if (existingNoteId) {
				// Update existing note
				await this.client.updateNoteFields(existingNoteId, fields as Record<string, string>);

				// Update tags if needed
				if (tags.length > 0) {
					await this.client.updateNoteTags(existingNoteId, tags);
				}

				return {
					success: true,
					noteId: existingNoteId,
					wasUpdate: true
				};
			} else {
				// Create new note
				const note: AnkiNote = {
					deckName,
					modelName: imageOcclusionModel,
					fields: fields as Record<string, string>,
					tags,
					options: {
						allowDuplicate: true  // TEMPORARY: Allow duplicates to bypass duplicate detection
					}
				};

				// Debug: Log what we're sending to Anki
				console.log('Creating Anki note:', {
					modelName: note.modelName,
					deckName: note.deckName,
					fieldKeys: Object.keys(note.fields),
					fieldValues: Object.entries(note.fields).map(([k, v]) =>
						`${k}: ${v.substring(0, 100)}...`
					),
					tags: note.tags
				});

				// DETAILED: Log full note data for debugging "cannot create note" error
				console.log('FULL NOTE DATA FOR ANKI:', JSON.stringify({
					modelName: note.modelName,
					deckName: note.deckName,
					fields: note.fields,
					tags: note.tags
				}, null, 2));

				const noteId = await this.client.addNote(note);

				return {
					success: true,
					noteId,
					wasUpdate: false
				};
			}
		} catch (error) {
			console.error('Sync error:', error);
			return {
				success: false,
				wasUpdate: false,
				error: error.message
			};
		}
	}

	/**
	 * Generate occlusion string in custom format for Sequential Image Occlusion template
	 * Uses proportional coordinates (0-1) that the template expects
	 */
	generateOcclusionString(
		coordinates: Array<{ left: number; top: number; width: number; height: number }>,
		sequential: boolean = true
	): string {
		if (coordinates.length === 0) {
			return '';
		}

		const occlusions = coordinates.map((coord, index) => {
			// Use c1 for all occlusions - template handles sequential reveal
			const clozeNum = 1;
			// Keep as proportional (0-1) coordinates
			const left = coord.left.toFixed(4);
			const top = coord.top.toFixed(4);
			const width = coord.width.toFixed(4);
			const height = coord.height.toFixed(4);
			// Custom format that template parses
			return `{{c${clozeNum}::image-occlusion:rect:left=${left}:top=${top}:width=${width}:height=${height}:fill=#55aaff}}`;
		});

		return occlusions.join('\n');
	}

	/**
	 * Generate unique filename for image
	 */
	generateImageFilename(file: TFile, timestamp?: number, pageNum?: number): string {
		const time = timestamp || Date.now();
		const basename = file.basename.replace(/[^a-zA-Z0-9-_]/g, '_');
		const pageSuffix = pageNum ? `_page${pageNum}` : '';
		return `${basename}${pageSuffix}_${time}.png`;
	}

	/**
	 * Sync multi-page document to Anki (one card per page)
	 */
	async syncPages(
		file: TFile,
		pages: PageData[],
		deckName: string,
		tags: string[],
		sequential: boolean = true
	): Promise<SyncResult[]> {
		const results: SyncResult[] = [];
		const timestamp = Date.now();

		console.log(`AnkiSyncManager: Syncing ${pages.length} pages for ${file.path}`);

		for (const page of pages) {
			try {
				// Add filler occlusion for pages without highlights
				// This ensures ALL pages are exported as cards
				let coordinates = page.coordinates;
				if (coordinates.length === 0) {
					console.log(`AnkiSyncManager: Page ${page.pageNum} has no highlights, adding filler occlusion`);
					// Small occlusion in top-left corner, offset by page number to avoid duplicates
					// Each page gets a slightly different position so Anki sees them as unique
					const offset = page.pageNum * 0.001;  // 0.1% offset per page
					coordinates = [{
						left: 0.01 + offset,
						top: 0.01 + offset,
						width: 0.05,
						height: 0.02
					}];
				}

				// Generate filename for this page
				const imageFilename = this.generateImageFilename(file, timestamp, page.pageNum);

				// Convert PNG buffer to base64
				const imageData = page.pngData.toString('base64');

				// Debug: Check if base64 data is valid
				console.log(`AnkiSyncManager: Page ${page.pageNum} PNG data size: ${page.pngData.length} bytes`);
				console.log(`AnkiSyncManager: Page ${page.pageNum} base64 size: ${imageData.length} chars`);

				if (!imageData || imageData.length === 0) {
					throw new Error(`Failed to convert PNG to base64 for page ${page.pageNum}`);
				}

				// Sort coordinates by reading order (top-to-bottom, left-to-right)
				// This ensures clozes reveal in the order they appear on the page
				const sortedCoordinates = [...coordinates].sort((a, b) => {
					// Primary sort: Y-direction (top position, ascending)
					if (a.top !== b.top) {
						return a.top - b.top;
					}
					// Secondary sort: X-direction (left position, ascending) for same line
					return a.left - b.left;
				});

				console.log(`AnkiSyncManager: Page ${page.pageNum} sorted ${sortedCoordinates.length} coordinates by reading order`);

				// Generate occlusion string for Sequential Image Occlusion note type
				// All occlusions use c1 - the card template's JavaScript handles sequential reveals
				// Sorted order ensures they reveal in reading order (top-to-bottom, left-to-right)
				const occlusionString = this.generateOcclusionString(sortedCoordinates, sequential);

				// Create header with page number for multi-page documents
				const header = pages.length > 1
					? `${file.path}::Page${page.pageNum}`
					: file.path;

				// Build fields
				const fields: ImageOcclusionFields = {
					Image: `<img src="${imageFilename}">`,  // HTML img tag for template
					Occlusions: occlusionString,
					Header: header,
					'Back Extra': `File: ${file.basename}\nPage: ${page.pageNum} of ${pages.length}\nHighlights: ${page.coordinates.length}\nCreated: ${new Date().toISOString()}`
				};

				const highlightCount = page.coordinates.length > 0 ? page.coordinates.length : 0;
				const syncType = highlightCount > 0 ? `${highlightCount} highlights` : 'filler occlusion';
				console.log(`AnkiSyncManager: Syncing page ${page.pageNum}/${pages.length} with ${syncType}`);

				// Sync this page's card
				const result = await this.syncCard(
					header,  // Use page-specific header for lookup
					fields,
					imageFilename,
					imageData,
					deckName,
					tags
				);

				results.push(result);

				if (result.success) {
					console.log(`AnkiSyncManager: Page ${page.pageNum} synced successfully (${result.wasUpdate ? 'updated' : 'created'})`);
				} else {
					console.error(`AnkiSyncManager: Page ${page.pageNum} failed: ${result.error}`);
				}

			} catch (error) {
				console.error(`AnkiSyncManager: Error syncing page ${page.pageNum}:`, error);
				results.push({
					success: false,
					wasUpdate: false,
					error: error.message
				});
			}
		}

		// Summary
		const successful = results.filter(r => r.success).length;
		const updated = results.filter(r => r.success && r.wasUpdate).length;
		const created = results.filter(r => r.success && !r.wasUpdate).length;

		console.log(`AnkiSyncManager: Sync complete: ${successful}/${pages.length} successful (${created} created, ${updated} updated)`);

		return results;
	}
}
