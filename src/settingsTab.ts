import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import AnkiImageOcclusionPlugin from './main';

export class AnkiImageOcclusionSettingTab extends PluginSettingTab {
	plugin: AnkiImageOcclusionPlugin;

	constructor(app: App, plugin: AnkiImageOcclusionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Anki Image Occlusion Settings' });

		// AnkiConnect Settings
		containerEl.createEl('h3', { text: 'AnkiConnect Settings' });

		new Setting(containerEl)
			.setName('AnkiConnect Port')
			.setDesc('Port number for AnkiConnect (default: 8765)')
			.addText(text => text
				.setPlaceholder('8765')
				.setValue(String(this.plugin.settings.ankiConnectPort))
				.onChange(async (value) => {
					const port = parseInt(value);
					if (!isNaN(port) && port > 0 && port < 65536) {
						this.plugin.settings.ankiConnectPort = port;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Target Deck')
			.setDesc('Anki deck name for exported cards')
			.addText(text => text
				.setPlaceholder('Default')
				.setValue(this.plugin.settings.targetDeck)
				.onChange(async (value) => {
					this.plugin.settings.targetDeck = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Test connection to AnkiConnect')
			.addButton(button => button
				.setButtonText('Test')
				.onClick(async () => {
					await this.plugin.testAnkiConnection();
				}));

		// Document Processing Settings
		containerEl.createEl('h3', { text: 'Document Processing' });

		new Setting(containerEl)
			.setName('Include Frontmatter')
			.setDesc('Include frontmatter in rendered image')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeFrontmatter)
				.onChange(async (value) => {
					this.plugin.settings.includeFrontmatter = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sequential Cloze Mode')
			.setDesc('All highlights use c1 for sequential reveal (recommended)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.sequentialClozeMode)
				.onChange(async (value) => {
					this.plugin.settings.sequentialClozeMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Extract Tags')
			.setDesc('Extract frontmatter tags as Anki tags')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.extractTags)
				.onChange(async (value) => {
					this.plugin.settings.extractTags = value;
					await this.plugin.saveSettings();
				}));

		// Image Settings
		containerEl.createEl('h3', { text: 'Image Settings' });

		new Setting(containerEl)
			.setName('Image Quality')
			.setDesc('Pixel density multiplier (1-4x)')
			.addSlider(slider => slider
				.setLimits(1, 4, 1)
				.setValue(this.plugin.settings.imageQuality)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.imageQuality = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max Image Width')
			.setDesc('Maximum image width in pixels')
			.addText(text => text
				.setPlaceholder('800')
				.setValue(String(this.plugin.settings.maxImageWidth))
				.onChange(async (value) => {
					const width = parseInt(value);
					if (!isNaN(width) && width > 0) {
						this.plugin.settings.maxImageWidth = width;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Max Image Height')
			.setDesc('Maximum image height in pixels (warning at 20000)')
			.addText(text => text
				.setPlaceholder('20000')
				.setValue(String(this.plugin.settings.maxImageHeight))
				.onChange(async (value) => {
					const height = parseInt(value);
					if (!isNaN(height) && height > 0) {
						this.plugin.settings.maxImageHeight = height;
						await this.plugin.saveSettings();
					}
				}));

		// PDF Page Margins
		containerEl.createEl('h3', { text: 'PDF Page Margins' });

		containerEl.createDiv({ cls: 'setting-item-description' }, (el) => {
			el.setText(
				'Add visual white space margins around the PDF content. ' +
				'⚠️ WARNING: Adding margins may affect coordinate accuracy. Use "None" for best results.'
			);
		});

		new Setting(containerEl)
			.setName('Margin Type')
			.setDesc('Select margin preset or custom margins')
			.addDropdown(dropdown => dropdown
				.addOption('0', 'None (recommended for coordinates)')
				.addOption('1', 'Default (~6mm)')
				.addOption('2', 'Minimal (~2.5mm)')
				.addOption('3', 'Custom (configure below)')
				.setValue(this.plugin.settings.pdfMarginType)
				.onChange(async (value) => {
					this.plugin.settings.pdfMarginType = value as '0' | '1' | '2' | '3';
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide custom margin inputs
				}));

		// Custom margin inputs (only visible when marginType is '3')
		if (this.plugin.settings.pdfMarginType === '3') {
			new Setting(containerEl)
				.setName('Top/Bottom Margins')
				.setDesc('Margins in millimeters')
				.addText(text => text
					.setPlaceholder('10')
					.setValue(String(this.plugin.settings.pdfMarginTop))
					.onChange(async (value) => {
						const margin = parseFloat(value);
						if (!isNaN(margin) && margin >= 0) {
							this.plugin.settings.pdfMarginTop = margin;
							await this.plugin.saveSettings();
						}
					}))
				.addText(text => text
					.setPlaceholder('10')
					.setValue(String(this.plugin.settings.pdfMarginBottom))
					.onChange(async (value) => {
						const margin = parseFloat(value);
						if (!isNaN(margin) && margin >= 0) {
							this.plugin.settings.pdfMarginBottom = margin;
							await this.plugin.saveSettings();
						}
					}));

			new Setting(containerEl)
				.setName('Left/Right Margins')
				.setDesc('Margins in millimeters')
				.addText(text => text
					.setPlaceholder('10')
					.setValue(String(this.plugin.settings.pdfMarginLeft))
					.onChange(async (value) => {
						const margin = parseFloat(value);
						if (!isNaN(margin) && margin >= 0) {
							this.plugin.settings.pdfMarginLeft = margin;
							await this.plugin.saveSettings();
						}
					}))
				.addText(text => text
					.setPlaceholder('10')
					.setValue(String(this.plugin.settings.pdfMarginRight))
					.onChange(async (value) => {
						const margin = parseFloat(value);
						if (!isNaN(margin) && margin >= 0) {
							this.plugin.settings.pdfMarginRight = margin;
							await this.plugin.saveSettings();
						}
					}));
		}

		// File Margin and Coordinate Settings

		// File Margin Settings
		containerEl.createEl('h3', { text: 'File Margin Correction' });

		containerEl.createDiv({ cls: 'setting-item-description' }, (el) => {
			el.setText(
				'⚠️ ADVANCED: These correct coordinate offsets from Obsidian\'s rendering, NOT page margins. ' +
				'Only adjust if boxes are systematically offset. Default: left=103px (Obsidian offset), others=0px. ' +
				'Use "Coordinate Adjustment" below for fine-tuning instead.'
			);
		});

		new Setting(containerEl)
			.setName('Left Margin')
			.setDesc('Correction for left margin in pixels (default: 103px for standard Obsidian rendering)')
			.addText(text => text
				.setPlaceholder('103')
				.setValue(String(this.plugin.settings.fileMarginLeft))
				.onChange(async (value) => {
					const margin = parseInt(value);
					if (!isNaN(margin)) {
						this.plugin.settings.fileMarginLeft = margin;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Top Margin')
			.setDesc('⚠️ Rarely needed! Only change if ALL boxes are offset vertically. Positive values shift boxes UP, not down. (default: 0px)')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.plugin.settings.fileMarginTop))
				.onChange(async (value) => {
					const margin = parseInt(value);
					if (!isNaN(margin)) {
						this.plugin.settings.fileMarginTop = margin;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Right Margin')
			.setDesc('Correction for right margin in pixels (default: 0px, currently unused)')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.plugin.settings.fileMarginRight))
				.onChange(async (value) => {
					const margin = parseInt(value);
					if (!isNaN(margin)) {
						this.plugin.settings.fileMarginRight = margin;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Bottom Margin')
			.setDesc('Correction for bottom margin in pixels (default: 0px, currently unused)')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.plugin.settings.fileMarginBottom))
				.onChange(async (value) => {
					const margin = parseInt(value);
					if (!isNaN(margin)) {
						this.plugin.settings.fileMarginBottom = margin;
						await this.plugin.saveSettings();
					}
				}));

		// Coordinate Offset Settings
		containerEl.createEl('h3', { text: 'Coordinate Adjustment' });

		new Setting(containerEl)
			.setName('Horizontal Offset (X)')
			.setDesc('Fine-tune horizontal alignment in pixels (positive = shift right, negative = shift left)')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.plugin.settings.coordinateOffsetX))
				.onChange(async (value) => {
					const offset = parseInt(value);
					if (!isNaN(offset)) {
						this.plugin.settings.coordinateOffsetX = offset;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Vertical Offset (Y)')
			.setDesc('Fine-tune vertical alignment in pixels (positive = shift down, negative = shift up)')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.plugin.settings.coordinateOffsetY))
				.onChange(async (value) => {
					const offset = parseInt(value);
					if (!isNaN(offset)) {
						this.plugin.settings.coordinateOffsetY = offset;
						await this.plugin.saveSettings();
					}
				}));
		containerEl.createEl('h3', { text: 'Sync Behavior' });

		new Setting(containerEl)
			.setName('Update Existing Cards')
			.setDesc('Update existing Anki cards instead of creating duplicates')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.updateExistingCards)
				.onChange(async (value) => {
					this.plugin.settings.updateExistingCards = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Dry Run Mode')
			.setDesc('Preview changes without syncing to Anki')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.dryRunMode)
				.onChange(async (value) => {
					this.plugin.settings.dryRunMode = value;
					await this.plugin.saveSettings();
				}));

		// Folder-Based Sync Settings
		containerEl.createEl('h3', { text: 'Folder-Based Sync' });

		containerEl.createDiv({ cls: 'setting-item-description' }, (el) => {
			el.innerHTML = 'Configure folders to sync and PDF output location. PDFs and Anki decks will mirror your folder structure.';
		});

		new Setting(containerEl)
			.setName('Sync Folders')
			.setDesc('Folders to sync (one per line, relative to vault root)')
			.addTextArea(text => text
				.setPlaceholder('folder1\nfolder2/subfolder\nfolder3')
				.setValue(this.plugin.settings.syncFolders.join('\n'))
				.onChange(async (value) => {
					this.plugin.settings.syncFolders = value
						.split('\n')
						.map(f => f.trim())
						.filter(f => f.length > 0);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('PDF Output Folder')
			.setDesc('Where to save exported PDFs (will mirror source folder structure)')
			.addText(text => text
				.setPlaceholder('PDF Exports')
				.setValue(this.plugin.settings.pdfOutputFolder)
				.onChange(async (value) => {
					this.plugin.settings.pdfOutputFolder = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Clear Sync History')
			.setDesc('Reset last sync timestamps (will re-sync all files)')
			.addButton(button => button
				.setButtonText('Clear')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.lastSyncTimes = {};
					await this.plugin.saveSettings();
					new Notice('Sync history cleared');
				}));
	}
}
