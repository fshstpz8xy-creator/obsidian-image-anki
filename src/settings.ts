export interface AnkiImageOcclusionSettings {
	// AnkiConnect settings
	ankiConnectUrl: string;
	ankiConnectPort: number;
	targetDeck: string;

	// Document processing settings
	includeFrontmatter: boolean;
	sequentialClozeMode: boolean;
	extractTags: boolean;

	// Image settings
	imageQuality: number; // 1-4x devicePixelRatio
	maxImageWidth: number;
	maxImageHeight: number;
	imageFormat: 'png' | 'jpeg';

	// Rendering pipeline
	usePDFPipeline: boolean; // PDF-first workflow (markdown → PDF → images)

	// Coordinate offset adjustments (for fine-tuning alignment)
	coordinateOffsetX: number; // Horizontal offset in pixels (positive = shift right)
	coordinateOffsetY: number; // Vertical offset in pixels (positive = shift down)

	// File margin corrections (for Obsidian rendering environment)
	fileMarginLeft: number;   // Left margin correction in pixels (default: 103)
	fileMarginTop: number;    // Top margin correction in pixels (default: 0)
	fileMarginRight: number;  // Right margin correction in pixels (default: 0)
	fileMarginBottom: number; // Bottom margin correction in pixels (default: 0)

	// PDF page margins (visual margins on exported PDF)
	pdfMarginType: '0' | '1' | '2' | '3'; // 0=none, 1=default, 2=minimal, 3=custom
	pdfMarginTop: number;    // Top page margin in mm (only for custom)
	pdfMarginBottom: number; // Bottom page margin in mm (only for custom)
	pdfMarginLeft: number;   // Left page margin in mm (only for custom)
	pdfMarginRight: number;  // Right page margin in mm (only for custom)

	// Sync behavior
	autoSyncOnSave: boolean;
	updateExistingCards: boolean;
	dryRunMode: boolean;

	// Folder-based sync settings
	syncFolders: string[];              // Folders to sync (can be multiple)
	pdfOutputFolder: string;            // Where to save exported PDFs
	lastSyncTimes: Record<string, number>; // Track last sync time per file path (mtime)
}

export const DEFAULT_SETTINGS: AnkiImageOcclusionSettings = {
	ankiConnectUrl: 'http://127.0.0.1',
	ankiConnectPort: 8765,
	targetDeck: 'Default',

	includeFrontmatter: false,
	sequentialClozeMode: true,
	extractTags: true,

	imageQuality: 2,
	maxImageWidth: 800,
	maxImageHeight: 20000,
	imageFormat: 'png',

	usePDFPipeline: true, // Default to PDF-first workflow

	coordinateOffsetX: 0, // No horizontal offset by default
	coordinateOffsetY: 0, // No vertical offset by default

	fileMarginLeft: 103,   // Obsidian's internal left margin (empirically determined)
	fileMarginTop: 0,      // No top margin by default
	fileMarginRight: 0,    // No right margin by default
	fileMarginBottom: 0,   // No bottom margin by default

	pdfMarginType: '0',    // No PDF page margins by default (for coordinate accuracy)
	pdfMarginTop: 10,      // 10mm top margin (only used if marginType is '3')
	pdfMarginBottom: 10,   // 10mm bottom margin
	pdfMarginLeft: 10,     // 10mm left margin
	pdfMarginRight: 10,    // 10mm right margin

	autoSyncOnSave: false,
	updateExistingCards: true,
	dryRunMode: false,

	syncFolders: [],              // No folders selected by default
	pdfOutputFolder: 'PDF Exports', // Default PDF output folder
	lastSyncTimes: {}             // Empty sync history
};
