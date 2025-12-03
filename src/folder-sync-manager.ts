import { App, TFile, TFolder, Notice, normalizePath } from 'obsidian';
import { AnkiImageOcclusionSettings } from './settings';

/**
 * Manages folder-based sync for semi-manual batch processing
 *
 * Features:
 * - Scans configured folders for markdown files
 * - Tracks file modification times
 * - Creates mirrored folder structure for PDFs
 * - Determines which files need syncing based on mtime
 */

export interface SyncFileInfo {
	file: TFile;
	relativePath: string;      // Relative path from vault root
	pdfOutputPath: string;      // Where PDF should be saved
	coordinatesPath: string;    // Where coordinates JSON should be saved
	ankiDeck: string;           // Anki deck name (mirrors folder structure)
	needsSync: boolean;         // Whether file has changed since last sync
}

export class FolderSyncManager {
	constructor(
		private app: App,
		private settings: AnkiImageOcclusionSettings
	) {}

	/**
	 * Scan all configured folders and build list of files to sync
	 */
	async scanFolders(): Promise<SyncFileInfo[]> {
		const syncFiles: SyncFileInfo[] = [];

		for (const folderPath of this.settings.syncFolders) {
			const folder = this.app.vault.getAbstractFileByPath(folderPath);

			if (!folder || !(folder instanceof TFolder)) {
				console.warn(`Sync folder not found: ${folderPath}`);
				continue;
			}

			// Recursively scan folder for markdown files
			const files = await this.scanFolderRecursive(folder);
			syncFiles.push(...files);
		}

		return syncFiles;
	}

	/**
	 * Recursively scan a folder for markdown files
	 */
	private async scanFolderRecursive(folder: TFolder): Promise<SyncFileInfo[]> {
		const syncFiles: SyncFileInfo[] = [];

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === 'md') {
				const info = await this.createSyncFileInfo(child);
				syncFiles.push(info);
			} else if (child instanceof TFolder) {
				// Recursively scan subfolder
				const subFiles = await this.scanFolderRecursive(child);
				syncFiles.push(...subFiles);
			}
		}

		return syncFiles;
	}

	/**
	 * Create sync info for a single file
	 */
	private async createSyncFileInfo(file: TFile): Promise<SyncFileInfo> {
		// Calculate relative path from vault root
		const relativePath = file.path;

		// Extract folder structure
		const folderParts = this.getPathParts(file.path);

		// Build PDF output path (mirror folder structure)
		const pdfOutputPath = this.calculatePDFOutputPath(file);

		// Build coordinates output path (same location as PDF)
		const coordinatesPath = pdfOutputPath.replace(/\.pdf$/, '.json');

		// Build Anki deck name from folder structure
		const ankiDeck = this.calculateAnkiDeckName(file);

		// Check if file needs sync (based on modification time)
		const needsSync = await this.fileNeedsSync(file);

		return {
			file,
			relativePath,
			pdfOutputPath,
			coordinatesPath,
			ankiDeck,
			needsSync
		};
	}

	/**
	 * Calculate PDF output path with mirrored folder structure
	 */
	private calculatePDFOutputPath(file: TFile): string {
		// Get relative path parts
		const parts = this.getPathParts(file.path);

		// Build mirrored path in PDF output folder
		// Example: vault/folder1/folder2/file.md
		//       -> vault/PDF Exports/folder1/folder2/file.pdf

		const fileName = file.basename + '.pdf';

		if (parts.folder) {
			// Has folders, mirror structure
			const mirroredPath = normalizePath(
				`${this.settings.pdfOutputFolder}/${parts.folder}/${fileName}`
			);
			return mirroredPath;
		} else {
			// No folders, just put in PDF output root
			return normalizePath(`${this.settings.pdfOutputFolder}/${fileName}`);
		}
	}

	/**
	 * Calculate Anki deck name from folder structure
	 * Example: folder1/folder2/file.md -> folder1::folder2::file
	 */
	private calculateAnkiDeckName(file: TFile): string {
		const parts = this.getPathParts(file.path);

		if (parts.folder) {
			// Has folders, create nested deck name
			// Replace / with :: for Anki deck hierarchy
			const folderDeck = parts.folder.replace(/\//g, '::');
			return `${folderDeck}::${file.basename}`;
		} else {
			// No folders, just use filename
			return file.basename;
		}
	}

	/**
	 * Parse path into folder and filename components
	 */
	private getPathParts(path: string): { folder: string; filename: string } {
		const lastSlash = path.lastIndexOf('/');

		if (lastSlash === -1) {
			// No folder
			return { folder: '', filename: path };
		} else {
			return {
				folder: path.substring(0, lastSlash),
				filename: path.substring(lastSlash + 1)
			};
		}
	}

	/**
	 * Check if file needs syncing based on modification time
	 */
	private async fileNeedsSync(file: TFile): Promise<boolean> {
		const lastSyncTime = this.settings.lastSyncTimes[file.path];

		if (!lastSyncTime) {
			// Never synced before
			return true;
		}

		const fileStat = await this.app.vault.adapter.stat(file.path);
		if (!fileStat) {
			// File doesn't exist? Skip
			return false;
		}

		// Check if file modified after last sync
		return fileStat.mtime > lastSyncTime;
	}

	/**
	 * Mark file as synced (update last sync time)
	 */
	async markFileSynced(file: TFile): Promise<void> {
		const fileStat = await this.app.vault.adapter.stat(file.path);
		if (fileStat) {
			this.settings.lastSyncTimes[file.path] = fileStat.mtime;
		}
	}

	/**
	 * Ensure mirrored folder structure exists
	 */
	async ensureFolderStructure(pdfOutputPath: string): Promise<void> {
		const parts = this.getPathParts(pdfOutputPath);

		if (parts.folder) {
			// Create folder if it doesn't exist
			try {
				await this.app.vault.adapter.mkdir(parts.folder);
			} catch (error) {
				// Folder might already exist, that's OK
			}
		}
	}

	/**
	 * Get statistics about sync status
	 */
	async getSyncStats(): Promise<{
		total: number;
		needsSync: number;
		upToDate: number;
	}> {
		const files = await this.scanFolders();

		return {
			total: files.length,
			needsSync: files.filter(f => f.needsSync).length,
			upToDate: files.filter(f => !f.needsSync).length
		};
	}
}
