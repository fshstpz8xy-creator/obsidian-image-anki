import { Plugin, TFile, Notice } from 'obsidian';
import { AnkiImageOcclusionSettings, DEFAULT_SETTINGS } from './settings';
import { AnkiImageOcclusionSettingTab } from './settingsTab';
import { AnkiConnectClient } from './anki/client';
import { AnkiConnectError, ImageOcclusionFields } from './anki/models';
import { AnkiSyncManager } from './anki/sync';
import { readMarkdownFile, hasHighlights, extractFrontmatterTags, getContentForRendering } from './utils/markdown';
import { generateHighlightHash } from './utils/hash';
import { RenderingPipeline } from './rendering/pipeline';
import { FolderSyncManager } from './folder-sync-manager';

export default class AnkiImageOcclusionPlugin extends Plugin {
	settings!: AnkiImageOcclusionSettings;
	ankiClient!: AnkiConnectClient;
	syncManager!: AnkiSyncManager;
	renderingPipeline!: RenderingPipeline;
	folderSyncManager!: FolderSyncManager;

	async onload() {
		await this.loadSettings();

		// Migrate settings if needed (backward compatibility)
		if (this.settings.fileMarginLeft === undefined) {
			this.settings.fileMarginLeft = 103;  // Default to current behavior
			this.settings.fileMarginTop = 0;
			this.settings.fileMarginRight = 0;
			this.settings.fileMarginBottom = 0;
			await this.saveSettings();
			console.log('Migrated settings to include file margins');
		}
		if (this.settings.pdfMarginType === undefined) {
			this.settings.pdfMarginType = '0';  // No PDF margins by default
			this.settings.pdfMarginTop = 10;
			this.settings.pdfMarginBottom = 10;
			this.settings.pdfMarginLeft = 10;
			this.settings.pdfMarginRight = 10;
			await this.saveSettings();
			console.log('Migrated settings to include PDF page margins');
		}

		// Initialize AnkiConnect client
		this.ankiClient = new AnkiConnectClient(
			this.settings.ankiConnectUrl,
			this.settings.ankiConnectPort
		);

		// Initialize sync manager
		this.syncManager = new AnkiSyncManager(this.ankiClient);

		// Initialize rendering pipeline
		this.renderingPipeline = new RenderingPipeline(this.app);

		// Migrate folder sync settings if needed
		if (this.settings.syncFolders === undefined) {
			this.settings.syncFolders = [];
			this.settings.pdfOutputFolder = 'PDF Exports';
			this.settings.lastSyncTimes = {};
			await this.saveSettings();
			console.log('Migrated settings to include folder sync');
		}

		// Initialize folder sync manager
		this.folderSyncManager = new FolderSyncManager(this.app, this.settings);

		// Add command to export current file to Anki
		this.addCommand({
			id: 'export-to-anki',
			name: 'Export to Anki (Current File)',
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (file && file.extension === 'md') {
					if (!checking) {
						this.exportFileToAnki(file);
					}
					return true;
				}
				return false;
			}
		});

		// Add command to test AnkiConnect connection
		this.addCommand({
			id: 'test-anki-connection',
			name: 'Test AnkiConnect Connection',
			callback: () => {
				this.testAnkiConnection();
			}
		});

		// Add command for batch folder sync
		this.addCommand({
			id: 'batch-sync-folders',
			name: 'Sync All Folders',
			callback: () => {
				this.batchSyncFolders();
			}
		});

		// Add settings tab
		this.addSettingTab(new AnkiImageOcclusionSettingTab(this.app, this));

		console.log('Anki Image Occlusion plugin loaded');
	}

	onunload() {
		console.log('Anki Image Occlusion plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async exportFileToAnki(file: TFile) {
		new Notice(`📖 Reading ${file.basename}...`);

		try {
			// Step 1: Read and parse markdown file
			const markdownContent = await readMarkdownFile(this.app, file);

			// Validate file is not empty
			if (!markdownContent.fullContent || markdownContent.fullContent.trim().length === 0) {
				new Notice(`⚠️ File is empty. Please add content before exporting.`, 6000);
				return;
			}

			// Validate content without frontmatter exists
			if (!markdownContent.contentWithoutFrontmatter || markdownContent.contentWithoutFrontmatter.trim().length === 0) {
				new Notice(`⚠️ File only contains frontmatter. Please add content before exporting.`, 6000);
				return;
			}

			// Step 2: Validate highlights exist
			if (markdownContent.highlights.length === 0) {
				new Notice(`⚠️ No highlights found in ${file.basename}. Use ==highlight syntax== to mark content.`, 6000);
				return;
			}

			new Notice(`✅ Found ${markdownContent.highlights.length} highlights`);

			// Step 3: Extract tags if enabled
			let tags: string[] = [];
			if (this.settings.extractTags && markdownContent.frontmatter) {
				tags = extractFrontmatterTags(markdownContent.frontmatter);
			}

			// Step 4: Render markdown to image with coordinates
			new Notice('🎨 Rendering document...');

			const contentForRendering = getContentForRendering(
				markdownContent,
				this.settings.includeFrontmatter
			);

			console.log('Content for rendering length:', contentForRendering.length);
			console.log('First 200 chars:', contentForRendering.substring(0, 200));

			const processed = await this.renderingPipeline.process(file, contentForRendering, {
				includeFrontmatter: this.settings.includeFrontmatter,
				imageQuality: this.settings.imageQuality,
				maxImageWidth: this.settings.maxImageWidth,
				maxImageHeight: this.settings.maxImageHeight,
				imageFormat: this.settings.imageFormat,
				usePDFPipeline: this.settings.usePDFPipeline,
				coordinateOffsetX: this.settings.coordinateOffsetX,
				coordinateOffsetY: this.settings.coordinateOffsetY,
				fileMarginLeft: this.settings.fileMarginLeft,
				fileMarginTop: this.settings.fileMarginTop,
				fileMarginRight: this.settings.fileMarginRight,
				fileMarginBottom: this.settings.fileMarginBottom,
				pdfMarginType: this.settings.pdfMarginType,
				pdfMarginTop: this.settings.pdfMarginTop,
				pdfMarginBottom: this.settings.pdfMarginBottom,
				pdfMarginLeft: this.settings.pdfMarginLeft,
				pdfMarginRight: this.settings.pdfMarginRight
			});

			new Notice(`✅ Rendered ${processed.highlights.length} occlusions`);

			// Step 5: Generate occlusion string
			const occlusionString = this.syncManager.generateOcclusionString(
				processed.highlights,
				this.settings.sequentialClozeMode
			);

			console.log('Occlusion string:', { length: occlusionString.length, first200: occlusionString.substring(0, 200) });

		// Step 6: Prepare Anki fields (built-in Image Occlusion format)
			const imageFilename = this.syncManager.generateImageFilename(file);
			const fields: ImageOcclusionFields = {
				Image: `<img src="${imageFilename}">`,  // HTML img tag for Anki media display
				Occlusion: occlusionString,  // Singular! Not "Occlusions"
				Header: file.path,
				'Back Extra': `File: ${file.basename}\nHighlights: ${processed.highlights.length}\nCreated: ${new Date().toISOString()}`,
				Comments: ''  // Required by built-in Image Occlusion
			};

			console.log('Fields for Anki:', { imageFilename, fields });

		// DEBUG: Export data to disk for inspection
		const debugDir = this.manifest.dir;
		const debugData = {
			file: file.path,
			timestamp: new Date().toISOString(),
			fields: fields,
			occlusionCount: processed.highlights.length,
			occlusionStringLength: occlusionString.length,
			occlusionStringSample: occlusionString.substring(0, 500),
			pdfPath: processed.pdfPath,
			pdfDimensions: processed.pdfDimensions
		};
		await this.app.vault.adapter.write(
			`${debugDir}/debug-export.json`,
			JSON.stringify(debugData, null, 2)
		);

		// Step 7: Sync to Anki (with PNG pages)
		if (processed.pages && processed.pages.length > 0) {
			new Notice('📤 Syncing to Anki...', 3000);

			try {
				const results = await this.syncManager.syncPages(
					file,
					processed.pages,
					this.settings.targetDeck,
					tags,
					this.settings.sequentialClozeMode
				);

				const successful = results.filter(r => r.success).length;
				const created = results.filter(r => r.success && !r.wasUpdate).length;
				const updated = results.filter(r => r.success && r.wasUpdate).length;

				if (successful === results.length) {
					new Notice(`✅ Synced ${successful} ${successful === 1 ? 'card' : 'cards'} to Anki! (${created} created, ${updated} updated)`, 5000);
				} else {
					new Notice(`⚠️ Partially synced: ${successful}/${results.length} cards succeeded`, 6000);
				}

				console.log('Anki sync complete:', {
					totalPages: processed.pages.length,
					successful,
					created,
					updated,
					failed: results.length - successful
				});

			} catch (ankiError) {
				console.error('Anki sync error:', ankiError);
				new Notice(`⚠️ Anki sync failed: ${ankiError.message}`, 8000);
				// Don't throw - PDF/coordinates were still exported successfully
			}
		} else {
			new Notice('⚠️ No pages generated - Anki sync skipped', 5000);
		}

		console.log('Export complete:', {
			pdfPath: processed.pdfPath,
			coordinatesFile: `${debugDir}/coordinates.json`,
			highlightCount: processed.highlights.length,
			pageCount: processed.pages?.length || 0
		});

		} catch (error) {
			console.error('Export error:', error);
			console.error('Error stack:', error.stack);

			// More detailed error message
			let errorMsg = error.message || 'Unknown error';
			if (error.stack) {
				console.error('Full error details:', error);
			}

			new Notice(`❌ Export failed: ${errorMsg}`, 10000);
		}
	}

	async testAnkiConnection() {
		new Notice('Testing AnkiConnect connection...');

		try {
			// Test basic connection
			const version = await this.ankiClient.getVersion();

			// Check for Image Occlusion note type
			const hasImageOcclusion = await this.ankiClient.hasImageOcclusionNoteType();

			if (!hasImageOcclusion) {
				new Notice('⚠️ Connected, but Image Occlusion note type not found. Please install Image Occlusion Enhanced add-on in Anki.', 8000);
				return;
			}

			// Check if target deck exists
			const decks = await this.ankiClient.deckNames();
			const deckExists = decks.includes(this.settings.targetDeck);

			if (!deckExists) {
				new Notice(`⚠️ Connected, but deck "${this.settings.targetDeck}" not found. Creating deck...`, 4000);
				await this.ankiClient.createDeck(this.settings.targetDeck);
			}

			new Notice(`✅ AnkiConnect v${version} connected successfully! Image Occlusion ready.`, 5000);
			console.log('AnkiConnect test successful:', { version, hasImageOcclusion, deckExists });
		} catch (error) {
			console.error('Connection test error:', error);

			if (error instanceof AnkiConnectError) {
				new Notice(`❌ ${error.message}`, 8000);
			} else {
				new Notice(`❌ Connection test failed: ${error.message}`, 8000);
			}
		}
	}

	getAnkiClient(): AnkiConnectClient {
		return this.ankiClient;
	}

	async batchSyncFolders() {
		new Notice('📂 Scanning folders for sync...');

		try {
			// Scan all configured folders
			const syncFiles = await this.folderSyncManager.scanFolders();

			if (syncFiles.length === 0) {
				new Notice('⚠️ No files found in configured sync folders', 5000);
				return;
			}

			// Filter to files that need syncing
			const filesToSync = syncFiles.filter(f => f.needsSync);

			if (filesToSync.length === 0) {
				new Notice(`✅ All ${syncFiles.length} files are up to date!`, 5000);
				return;
			}

			new Notice(`🔄 Syncing ${filesToSync.length} of ${syncFiles.length} files...`, 4000);

			let successful = 0;
			let failed = 0;

			for (const syncInfo of filesToSync) {
				try {
					new Notice(`📄 Processing ${syncInfo.file.basename}...`);

					// Read and validate file
					const markdownContent = await readMarkdownFile(this.app, syncInfo.file);

					if (!markdownContent.fullContent || markdownContent.fullContent.trim().length === 0) {
						console.warn(`Skipping empty file: ${syncInfo.file.path}`);
						failed++;
						continue;
					}

					if (markdownContent.highlights.length === 0) {
						console.warn(`Skipping file with no highlights: ${syncInfo.file.path}`);
						failed++;
						continue;
					}

					// Extract tags if enabled
					let tags: string[] = [];
					if (this.settings.extractTags && markdownContent.frontmatter) {
						tags = extractFrontmatterTags(markdownContent.frontmatter);
					}

					// Render document
					const contentForRendering = getContentForRendering(
						markdownContent,
						this.settings.includeFrontmatter
					);

					const processed = await this.renderingPipeline.process(syncInfo.file, contentForRendering, {
						includeFrontmatter: this.settings.includeFrontmatter,
						imageQuality: this.settings.imageQuality,
						maxImageWidth: this.settings.maxImageWidth,
						maxImageHeight: this.settings.maxImageHeight,
						imageFormat: this.settings.imageFormat,
						usePDFPipeline: this.settings.usePDFPipeline,
						coordinateOffsetX: this.settings.coordinateOffsetX,
						coordinateOffsetY: this.settings.coordinateOffsetY,
						fileMarginLeft: this.settings.fileMarginLeft,
						fileMarginTop: this.settings.fileMarginTop,
						fileMarginRight: this.settings.fileMarginRight,
						fileMarginBottom: this.settings.fileMarginBottom,
						pdfMarginType: this.settings.pdfMarginType,
						pdfMarginTop: this.settings.pdfMarginTop,
						pdfMarginBottom: this.settings.pdfMarginBottom,
						pdfMarginLeft: this.settings.pdfMarginLeft,
						pdfMarginRight: this.settings.pdfMarginRight
					});

					// Ensure output folder structure exists
					await this.folderSyncManager.ensureFolderStructure(syncInfo.pdfOutputPath);

					// Copy PDF from debug location to mirrored folder structure
					if (processed.pdfPath) {
						// Read PDF from debug location
						const pdfBuffer = await this.app.vault.adapter.readBinary(processed.pdfPath);

						// Write to sync location
						await this.app.vault.adapter.writeBinary(
							syncInfo.pdfOutputPath,
							pdfBuffer
						);
						console.log(`Saved PDF to: ${syncInfo.pdfOutputPath}`);
					}

					// Save coordinates JSON
					const coordinatesData = {
						file: syncInfo.file.path,
						pdfPath: syncInfo.pdfOutputPath,
						timestamp: new Date().toISOString(),
						highlights: processed.highlights,
						pdfDimensions: processed.pdfDimensions
					};

					await this.app.vault.adapter.write(
						syncInfo.coordinatesPath,
						JSON.stringify(coordinatesData, null, 2)
					);
					console.log(`Saved coordinates to: ${syncInfo.coordinatesPath}`);

					// Ensure Anki deck exists (with nested structure)
					await this.syncManager.ensureDeck(syncInfo.ankiDeck);

					// Sync to Anki with folder-based deck name
					if (processed.pages && processed.pages.length > 0) {
						const results = await this.syncManager.syncPages(
							syncInfo.file,
							processed.pages,
							syncInfo.ankiDeck,  // Use folder-based deck name
							tags,
							this.settings.sequentialClozeMode
						);

						const syncSuccessful = results.filter(r => r.success).length;
						if (syncSuccessful === results.length) {
							successful++;
							// Mark file as synced
							await this.folderSyncManager.markFileSynced(syncInfo.file);
							await this.saveSettings(); // Save updated sync times
						} else {
							failed++;
						}
					} else {
						failed++;
					}

				} catch (error) {
					console.error(`Error syncing ${syncInfo.file.path}:`, error);
					failed++;
				}
			}

			// Show summary
			const summary = `✅ Batch sync complete: ${successful} succeeded, ${failed} failed`;
			new Notice(summary, 8000);
			console.log('Batch sync summary:', { total: filesToSync.length, successful, failed });

		} catch (error) {
			console.error('Batch sync error:', error);
			new Notice(`❌ Batch sync failed: ${error.message}`, 8000);
		}
	}
}
