import { requestUrl, RequestUrlParam } from 'obsidian';
import {
	AnkiConnectRequest,
	AnkiConnectResponse,
	AnkiNote,
	AnkiMediaFile,
	AnkiConnectError
} from './models';

export class AnkiConnectClient {
	private baseUrl: string;
	private version = 6;

	constructor(host: string, port: number) {
		this.baseUrl = `${host}:${port}`;
	}

	/**
	 * Send request to AnkiConnect API
	 */
	private async request<T>(action: string, params?: Record<string, any>): Promise<T> {
		const payload: AnkiConnectRequest = {
			action,
			version: this.version,
			params: params || {}
		};

		try {
			const requestParams: RequestUrlParam = {
				url: this.baseUrl,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload),
				throw: false
			};

			const response = await requestUrl(requestParams);

			if (response.status !== 200) {
				throw new AnkiConnectError(
					`HTTP ${response.status}: Failed to connect to AnkiConnect`,
					response
				);
			}

			const data: AnkiConnectResponse<T> = response.json;

			if (data.error) {
				throw new AnkiConnectError(`AnkiConnect error: ${data.error}`);
			}

			return data.result;
		} catch (error) {
			if (error instanceof AnkiConnectError) {
				throw error;
			}

			// Handle network errors
			throw new AnkiConnectError(
				'Failed to connect to Anki. Make sure Anki is running with AnkiConnect installed.',
				error
			);
		}
	}

	/**
	 * Test connection to AnkiConnect
	 */
	async testConnection(): Promise<boolean> {
		try {
			const version = await this.request<number>('version');
			if (version < 6) {
				throw new AnkiConnectError(`AnkiConnect version ${version} is too old. Please update to version 6+.`);
			}
			return true;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get AnkiConnect version
	 */
	async getVersion(): Promise<number> {
		return await this.request<number>('version');
	}

	/**
	 * Get available model (note type) names
	 */
	async getModelNames(): Promise<string[]> {
		return await this.request<string[]>('modelNames');
	}

	/**
	 * Get field names for a specific model
	 */
	async getModelFieldNames(modelName: string): Promise<string[]> {
		return await this.request<string[]>('modelFieldNames', { modelName });
	}

	/**
	 * Find notes matching a query
	 */
	async findNotes(query: string): Promise<number[]> {
		return await this.request<number[]>('findNotes', { query });
	}

	/**
	 * Get note information by ID
	 */
	async notesInfo(noteIds: number[]): Promise<any[]> {
		return await this.request<any[]>('notesInfo', { notes: noteIds });
	}

	/**
	 * Store media file in Anki's media folder
	 */
	async storeMediaFile(filename: string, dataBase64: string): Promise<string> {
		console.log('AnkiConnect: storeMediaFile called', {
			filename,
			dataLength: dataBase64?.length || 0,
			dataType: typeof dataBase64,
			dataPreview: dataBase64?.substring(0, 50) || 'undefined'
		});

		const mediaFile: AnkiMediaFile = {
			filename,
			data: dataBase64
		};

		console.log('AnkiConnect: mediaFile object', {
			hasFilename: !!mediaFile.filename,
			hasData: !!mediaFile.data,
			dataLength: mediaFile.data?.length || 0
		});

		return await this.request<string>('storeMediaFile', mediaFile);
	}

	/**
	 * Add a new note to Anki
	 */
	async addNote(note: AnkiNote): Promise<number> {
		return await this.request<number>('addNote', { note });
	}

	/**
	 * Update note fields
	 */
	async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<null> {
		return await this.request<null>('updateNoteFields', {
			note: {
				id: noteId,
				fields
			}
		});
	}

	/**
	 * Update note tags
	 */
	async updateNoteTags(noteId: number, tags: string[]): Promise<null> {
		const note = {
			id: noteId,
			tags: tags
		};
		return await this.request<null>('updateNoteTags', {
			note: note.id,
			tags: tags.join(' ')
		});
	}

	/**
	 * Delete notes by ID
	 */
	async deleteNotes(noteIds: number[]): Promise<null> {
		return await this.request<null>('deleteNotes', { notes: noteIds });
	}

	/**
	 * Get all deck names
	 */
	async deckNames(): Promise<string[]> {
		return await this.request<string[]>('deckNames');
	}

	/**
	 * Create a new deck
	 */
	async createDeck(deckName: string): Promise<number> {
		return await this.request<number>('createDeck', { deck: deckName });
	}

	/**
	 * Get all model (note type) names
	 */
	async modelNames(): Promise<string[]> {
		return await this.request<string[]>('modelNames');
	}

	/**
	 * Get model field names
	 */
	async modelFieldNames(modelName: string): Promise<string[]> {
		return await this.request<string[]>('modelFieldNames', { modelName });
	}

	/**
	 * Check if Image Occlusion note type exists
	 */
	async hasImageOcclusionNoteType(): Promise<boolean> {
		const models = await this.modelNames();
		return models.includes('Image Occlusion');
	}
}
