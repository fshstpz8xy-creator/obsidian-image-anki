import { App, TFile, MarkdownRenderer, Component } from 'obsidian';
import { PDFCoordinateExtractor } from './pdf-coordinate-extractor';

// File-based logging to bypass console filtering
const fs = require('fs').promises;
const path = require('path');
let logFilePath: string | null = null;

async function logToFile(message: string) {
	try {
		if (!logFilePath) {
			const pluginDir = (window as any).app.vault.adapter.basePath + '/.obsidian/plugins/new-pdf-anki';
			logFilePath = path.join(pluginDir, 'debug.log');
			// Clear log file on first write
			await fs.writeFile(logFilePath, `=== NEW SESSION ${new Date().toISOString()} ===\n`);
		}
		const timestamp = new Date().toISOString();
		await fs.appendFile(logFilePath, `[${timestamp}] ${message}\n`);
	} catch (error) {
		console.error('Failed to write to log file:', error);
	}
}

/**
 * EXACT COPY of better-export-pdf plugin's PDF generation workflow
 * DO NOT MODIFY - this is the proven working implementation
 */

/**
 * Generate CSS patch with conditional @page margins based on user settings
 */
function getCSS_PATCH(pdfMarginType: '0' | '1' | '2' | '3', pdfMarginTop: number, pdfMarginBottom: number, pdfMarginLeft: number, pdfMarginRight: number): string {
	// Calculate @page margin CSS (better-export-pdf approach)
	let pageMarginCSS = 'margin: 0;';

	if (pdfMarginType !== '0') {
		let topMm: number, rightMm: number, bottomMm: number, leftMm: number;

		if (pdfMarginType === '1') {
			// Default margins (~6mm)
			topMm = rightMm = bottomMm = leftMm = 6;
		} else if (pdfMarginType === '2') {
			// Minimal margins (~2.5mm)
			topMm = rightMm = bottomMm = leftMm = 2.5;
		} else if (pdfMarginType === '3') {
			// Custom margins (use user-specified values)
			topMm = pdfMarginTop;
			rightMm = pdfMarginRight;
			bottomMm = pdfMarginBottom;
			leftMm = pdfMarginLeft;
		} else {
			topMm = rightMm = bottomMm = leftMm = 0;
		}

		// Use @page margins (same approach as better-export-pdf)
		pageMarginCSS = `margin: ${topMm}mm ${rightMm}mm ${bottomMm}mm ${leftMm}mm;`;
		console.log(`[PDF MARGINS] Applied @page margins: ${topMm}mm ${rightMm}mm ${bottomMm}mm ${leftMm}mm`);
	}

	return `
/* ---------- css patch ---------- */

body {
  overflow: auto !important;
  width: 794px !important;     /* A4 width at 96 DPI */
  max-width: 794px !important;
  padding: 0 !important;
  margin: 0 auto !important;   /* Center the content */
  box-sizing: border-box !important;
}

/* Remove all padding/margins from Obsidian markdown containers */
.markdown-preview-view,
.markdown-preview-sizer,
.markdown-rendered {
  padding: 0 !important;
  margin: 0 !important;
}

/* Pagination rules to prevent content cut-off */
@page {
  size: A4;
  ${pageMarginCSS}  /* Conditional margins based on user settings */
}

@media print {
  .print .markdown-preview-view {
    height: auto !important;
  }
  .md-print-anchor, .blockid {
    white-space: pre !important;
    border-left: none !important;
    border-right: none !important;
    border-top: none !important;
    border-bottom: none !important;
    display: inline-block !important;
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    right: 0 !important;
    outline: 0 !important;
    background: 0 0 !important;
    text-decoration: initial !important;
    text-shadow: initial !important;
  }

  /* Prevent content cut-off at page boundaries */
  p, ul, ol, div, h1, h2, h3, h4, h5, h6 {
    page-break-inside: avoid;
    orphans: 3;
    widows: 3;
  }

  /* Allow natural page breaks between elements */
  h1, h2, h3 {
    page-break-after: avoid;
  }
}

@media print {
  table {
    break-inside: auto;
  }
  tr {
    break-inside: avoid;
    break-after: auto;
  }
}

img.__canvas__ {
  width: 100% !important;
  height: 100% !important;
}
`;
}

/**
 * Extract @media print rules and unwrap them
 * EXACT COPY from better-export-pdf
 */
function getPrintStyle(): string[] {
	const cssTexts: string[] = [];
	Array.from(document.styleSheets).forEach((sheet) => {
		try {
			const cssRules = sheet?.cssRules ?? [];
			Array.from(cssRules).forEach((rule) => {
				if (rule.constructor.name === 'CSSMediaRule') {
					const mediaRule = rule as CSSMediaRule;
					if (mediaRule.conditionText === 'print') {
						const res = mediaRule.cssText.replace(/@media print\s*\{([\s\S]+)\}/gm, '$1');
						cssTexts.push(res);
					}
				}
			});
		} catch (error) {
			console.error(error);
		}
	});
	return cssTexts;
}

/**
 * Get patch styles (CSS_PATCH + print styles)
 * Modified to accept margin parameters for conditional @page CSS
 */
function getPatchStyle(pdfMarginType: '0' | '1' | '2' | '3', pdfMarginTop: number, pdfMarginBottom: number, pdfMarginLeft: number, pdfMarginRight: number): string[] {
	return [getCSS_PATCH(pdfMarginType, pdfMarginTop, pdfMarginBottom, pdfMarginLeft, pdfMarginRight), ...getPrintStyle()];
}

/**
 * Collect all CSS from document stylesheets
 * Modified to accept margin parameters for conditional @page CSS
 */
function getAllStyles(pdfMarginType: '0' | '1' | '2' | '3', pdfMarginTop: number, pdfMarginBottom: number, pdfMarginLeft: number, pdfMarginRight: number): string[] {
	const cssTexts: string[] = [];

	Array.from(document.styleSheets).forEach((sheet) => {
		const id = (sheet.ownerNode as any)?.id;

		// Skip svelte styles
		if (id?.startsWith('svelte-')) {
			return;
		}

		const href = (sheet.ownerNode as any)?.href;
		const division = `/* ----------${id ? `id:${id}` : href ? `href:${href}` : ''}---------- */`;
		cssTexts.push(division);

		try {
			Array.from(sheet?.cssRules ?? []).forEach((rule) => {
				cssTexts.push(rule.cssText);
			});
		} catch (error) {
			console.error(error);
		}
	});

	cssTexts.push(...getPatchStyle(pdfMarginType, pdfMarginTop, pdfMarginBottom, pdfMarginLeft, pdfMarginRight));
	return cssTexts;
}

/**
 * Create webview element
 * EXACT COPY from better-export-pdf
 */
function createWebview(scale: number = 1.25): HTMLElement {
	const webview = document.createElement('webview') as any;
	webview.src = `app://obsidian.md/help.html`;
	webview.setAttribute(
		'style',
		`height:calc(${scale} * 100%);
     width: calc(${scale} * 100%);
     transform: scale(${1 / scale}, ${1 / scale});
     transform-origin: top left;
     border: 1px solid #f2f2f2;
    `
	);
	webview.nodeintegration = true;
	return webview;
}

/**
 * Wait for embeds/dataview to render
 * EXACT COPY from better-export-pdf
 */
async function fixWaitRender(data: string, viewEl: HTMLElement): Promise<void> {
	// Wait 2 seconds if file contains embeds, dataview, or events
	if (data.includes('```dataview') || data.includes('```gEvent') || data.includes('![[')) {
		await new Promise(resolve => setTimeout(resolve, 2000));
	}
	// Additional wait for DOM changes
	await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Convert canvas elements to images
 * EXACT COPY from better-export-pdf
 */
function fixCanvasToImage(el: HTMLElement): void {
	const canvases = Array.from(el.querySelectorAll('canvas'));
	for (const canvas of canvases) {
		const data = (canvas as HTMLCanvasElement).toDataURL();
		const img = document.createElement('img');
		img.src = data;
		// Copy attributes
		Array.from(canvas.attributes).forEach(attr => {
			img.setAttribute(attr.name, attr.value);
		});
		img.className = '__canvas__';
		canvas.replaceWith(img);
	}
}

/**
 * Encode embed contents for safe transport to webview
 * EXACT COPY from better-export-pdf
 */
function encodeEmbeds(doc: Document): void {
	const spans = Array.from(doc.querySelectorAll('span.markdown-embed')).reverse();
	spans.forEach((span: HTMLElement) => {
		span.innerHTML = encodeURIComponent(span.innerHTML);
	});
}

export class BetterPDFIntegration {
	constructor(private app: App) {}

	/**
	 * Export file to PDF only (no PNG capture)
	 * Based on better-export-pdf workflow
	 * Returns PDF data AND coordinates extracted from final rendering
	 */
	async exportFileToPDF(
		file: TFile,
		offsetX: number = 0,
		offsetY: number = 0,
		marginLeft: number = 103,
		marginTop: number = 0,
		pdfMarginType: '0' | '1' | '2' | '3' = '0',
		pdfMarginTop: number = 10,
		pdfMarginBottom: number = 10,
		pdfMarginLeft: number = 10,
		pdfMarginRight: number = 10
	): Promise<{
		pdfData: Buffer;
		pdfWidth: number;
		pdfHeight: number;
		coordinates: Array<{left: number; top: number; width: number; height: number}>;
		webviewCoordinates: Array<{left: number; top: number; width: number; height: number}>;
		pdfCoordinates: Array<{left: number; top: number; width: number; height: number; pageNum: number; text?: string}>;
	}> {
		console.log('BetterPDFIntegration: Exporting file:', file.path);
		await logToFile(`========== EXPORT STARTED: ${file.path} ==========`);

		// EXACT better-export-pdf workflow starts here
		const ws = this.app.workspace;
		const leaf = ws.getLeaf(true);
		await leaf.openFile(file);
		const view = leaf.view as any;

		// Get data from view with fallback
		const data = view?.data ?? (await this.app.vault.read(file));

		if (!data) {
			throw new Error('File data is empty');
		}

		console.log('Got file data, length:', data.length);
		await logToFile(`Got file data, length: ${data.length}`);

		// DIAGNOSTIC: Check if markdown contains embed syntax
		const hasEmbedSyntax = data.includes('![[');
		const embedMatches = data.match(/!\[\[([^\]]+)\]\]/g);
		await logToFile(`Markdown contains embed syntax (![[): ${hasEmbedSyntax}`);
		if (embedMatches) {
			await logToFile(`Found ${embedMatches.length} embed references: ${embedMatches.join(', ')}`);
		}

		const comp = new Component();
		comp.load();

		// Create printEl directly in body (NOT off-screen)
		const printEl = document.body.createDiv('print');
		const viewEl = printEl.createDiv({
			cls: 'markdown-preview-view markdown-rendered'
		});

		try {
			// Fragment capture pattern (EXACT better-export-pdf)
			const fragment: any = {
				children: undefined,
				appendChild(e: any) {
					this.children = e?.children;
					throw new Error('exit');
				}
			};

			const promises: Promise<any>[] = [];

			try {
				await MarkdownRenderer.render(this.app, data, fragment, file.path, comp);
			} catch (error) {
				// Expected - fragment throws after capturing children
			}

			// Append captured children using Obsidian API
			const el = document.createDocumentFragment();
			if (fragment.children) {
				Array.from(fragment.children).forEach((item: any) => {
					const div = document.createElement('div');
					div.appendChild(item);
					el.appendChild(div);
				});
			}
			viewEl.appendChild(el);

			// DIAGNOSTIC: Check for embeds after initial render
			let embedCount = viewEl.querySelectorAll('span.markdown-embed').length;
			let markCount = viewEl.querySelectorAll('mark').length;
			await logToFile(`After MarkdownRenderer.render(): ${embedCount} embeds, ${markCount} marks`);

			// Post-process (EXACT better-export-pdf)
			await (MarkdownRenderer as any).postProcess(this.app, {
				docId: this.generateDocId(16),
				sourcePath: file.path,
				frontmatter: {},
				promises,
				addChild: (e: any) => comp.addChild(e),
				getSectionInfo: () => null,
				containerEl: viewEl,
				el: viewEl,
				displayMode: true
			});

			// DIAGNOSTIC: Check for embeds after postProcess
			embedCount = viewEl.querySelectorAll('span.markdown-embed').length;
			markCount = viewEl.querySelectorAll('mark').length;
			await logToFile(`After postProcess(): ${embedCount} embeds, ${markCount} marks, ${promises.length} promises`);

			await Promise.all(promises);

			// DIAGNOSTIC: Check for embeds after Promise.all
			embedCount = viewEl.querySelectorAll('span.markdown-embed').length;
			markCount = viewEl.querySelectorAll('mark').length;
			await logToFile(`After Promise.all(): ${embedCount} embeds, ${markCount} marks`);

			// Remove internal link hrefs
			printEl.findAll('a.internal-link').forEach((el: any) => {
				const href = el.dataset.href;
				if (href) {
					const [title, anchor] = href.split('#');
					if ((!title || title.length === 0 || title === file.basename) && anchor?.startsWith('^')) {
						return;
					}
				}
				el.removeAttribute('href');
			});

			// CRITICAL: Wait for embeds to load (better-export-pdf does this!)
			console.log('Waiting for embeds to render...');
			await logToFile('Waiting for embeds to render...');
			try {
				await fixWaitRender(data, viewEl);
				console.log('Embeds rendered');
				await logToFile('Embeds rendered successfully');
			} catch (error) {
				console.warn('Wait timeout:', error);
				await logToFile(`Wait timeout: ${error}`);
			}

			// Fix canvas elements
			fixCanvasToImage(viewEl);

			// DIAGNOSTIC: Check for embeds and marks after fixWaitRender
			embedCount = viewEl.querySelectorAll('span.markdown-embed').length;
			markCount = viewEl.querySelectorAll('mark').length;
			await logToFile(`After fixWaitRender(): ${embedCount} embeds, ${markCount} marks`);

			// DIAGNOSTIC: Check for marks inside embeds specifically
			const embedElements = viewEl.querySelectorAll('span.markdown-embed');
			let marksInEmbeds = 0;
			embedElements.forEach((embed) => {
				const embedMarks = embed.querySelectorAll('mark');
				marksInEmbeds += embedMarks.length;
			});
			await logToFile(`Marks inside embeds: ${marksInEmbeds} out of ${markCount} total marks`);

			// DIAGNOSTIC: Extract highlighted texts from RENDERED HTML (includes transcluded content)
			await logToFile('About to extract highlights from viewEl');
			const highlightedTexts: string[] = [];
			const marks = viewEl.querySelectorAll('mark');
			await logToFile(`Found ${marks.length} mark elements in viewEl`);
			marks.forEach((mark: HTMLElement) => {
				const text = mark.textContent?.trim();
				if (text && text.length > 0) {
					highlightedTexts.push(text);
				}
			});
			await logToFile(`Extracted ${highlightedTexts.length} highlighted texts from rendered HTML`);
			for (let i = 0; i < highlightedTexts.length; i++) {
				const text = highlightedTexts[i];
				await logToFile(`  Highlight ${i}: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
			}

			// Initialize PDF coordinate extractor for later use
			const pdfExtractor = new PDFCoordinateExtractor();

			// DIAGNOSTIC: Check if transclusions are in printEl
			await logToFile('Checking printEl content before cloning');
			const embedsInPrintEl = printEl.querySelectorAll('span.markdown-embed');
			await logToFile(`Found ${embedsInPrintEl.length} markdown-embed elements in printEl`);
			const marksInPrintEl = printEl.querySelectorAll('mark');
			await logToFile(`Found ${marksInPrintEl.length} mark elements in printEl`);
			await logToFile(`printEl HTML length: ${printEl.innerHTML.length} chars`);
			await logToFile(`printEl text preview (first 500 chars): "${printEl.textContent?.substring(0, 500)}"`);

			// Create HTML document
			const doc = document.implementation.createHTMLDocument('export');
			doc.head.innerHTML = document.head.innerHTML;
			doc.title = file.basename;
			await logToFile(`Created HTML document, title: ${doc.title}`);

			// Clone printEl and insert title inside markdown-preview-view for theme styling
			const clonedPrintEl = printEl.cloneNode(true) as HTMLElement;

			// Find markdown-preview-view div inside cloned printEl
			const markdownView = clonedPrintEl.querySelector('.markdown-preview-view');

			if (markdownView) {
				// Create title with minimal styling - let theme handle colors/borders
				const titleEl = doc.createElement('h1');
				titleEl.textContent = file.basename;
				// Only force visibility, let theme CSS handle all visual styling
				titleEl.style.cssText = 'display: block !important; visibility: visible !important;';

				// Insert as first child of markdown-preview-view to get theme styling
				markdownView.insertBefore(titleEl, markdownView.firstChild);
			}

			doc.body.appendChild(clonedPrintEl);
			await logToFile(`Appended cloned printEl to doc.body`);
			await logToFile(`doc.body HTML length BEFORE encoding: ${doc.body.innerHTML.length} chars`);
			await logToFile(`doc.body embeds BEFORE encoding: ${doc.body.querySelectorAll('span.markdown-embed').length}`);

			// CRITICAL: Encode embeds for safe transport to webview (better-export-pdf)
			encodeEmbeds(doc);
			await logToFile(`Encoded embeds for webview transport`);
			await logToFile(`doc.body HTML length AFTER encoding: ${doc.body.innerHTML.length} chars`);
			await logToFile(`doc.body embeds AFTER encoding: ${doc.body.querySelectorAll('span.markdown-embed').length}`);

			// Clean up
			printEl.detach();
			comp.unload();
			printEl.remove();
			leaf.detach();

			console.log('Document created:', {
				headLength: doc.head.innerHTML.length,
				bodyLength: doc.body.innerHTML.length
			});

			// Now inject into webview for PDF/PNG generation
			const webview = createWebview(1.25) as any;

			const webviewContainer = document.body.createDiv();
			webviewContainer.style.position = 'fixed';
			webviewContainer.style.top = '0';
			webviewContainer.style.left = '0';
			webviewContainer.style.width = '800px';
			webviewContainer.style.height = '600px';
			webviewContainer.style.zIndex = '9999';
			webviewContainer.style.opacity = '0.1';
			webviewContainer.style.pointerEvents = 'none';
			webviewContainer.appendChild(webview);

			try {
				const result = await new Promise<{
					pdfData: Buffer;
					pdfWidth: number;
					pdfHeight: number;
					coordinates: Array<{left: number; top: number; width: number; height: number}>;
					webviewCoordinates: Array<{left: number; top: number; width: number; height: number}>;
					pdfCoordinates: Array<{left: number; top: number; width: number; height: number; pageNum: number; text?: string}>;
				}>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(new Error('Webview initialization timeout'));
					}, 10000);

					webview.addEventListener('dom-ready', async () => {
						try {
							clearTimeout(timeout);
							console.log('Webview dom-ready');
							await logToFile('Webview dom-ready event fired');

							// Inject CSS concurrently with conditional @page margins
							getAllStyles(pdfMarginType, pdfMarginTop, pdfMarginBottom, pdfMarginLeft, pdfMarginRight).forEach(async (css) => {
								await webview.insertCSS(css);
							});
							console.log('CSS injection started (concurrent) with margin type:', pdfMarginType);

							// Load custom CSS snippets from .obsidian/snippets/ (only enabled ones)
							const fs = require('fs').promises;
							const path = require('path');
							const basePath = (this.app.vault.adapter as any).basePath;
							const snippetsDir = basePath + '/.obsidian/snippets';

							try {
								// Read enabled snippets from appearance.json
								const appearancePath = basePath + '/.obsidian/appearance.json';
								const appearanceData = JSON.parse(await fs.readFile(appearancePath, 'utf8'));
								const enabledSnippets = appearanceData.enabledCssSnippets || [];

								console.log(`Loading ${enabledSnippets.length} enabled CSS snippets`);

								// Only load enabled snippets
								for (const snippetName of enabledSnippets) {
									const cssPath = path.join(snippetsDir, snippetName + '.css');
									try {
										const cssContent = await fs.readFile(cssPath, 'utf8');
										await webview.insertCSS(cssContent);
										console.log(`Loaded enabled snippet: ${snippetName}`);
									} catch (error) {
										console.warn(`Could not load snippet ${snippetName}:`, error);
									}
								}
							} catch (error) {
								console.warn('Could not load CSS snippets:', error);
							}

							// Inject HTML (EXACT better-export-pdf method)
							await webview.executeJavaScript(`
								document.body.innerHTML = decodeURIComponent(\`${encodeURIComponent(doc.body.innerHTML)}\`);
								document.head.innerHTML = decodeURIComponent(\`${encodeURIComponent(document.head.innerHTML)}\`);

								// CRITICAL: Recursively decode embedded content (better-export-pdf)
								function decodeAndReplaceEmbed(element) {
									element.innerHTML = decodeURIComponent(element.innerHTML);
									const newEmbeds = element.querySelectorAll("span.markdown-embed");
									newEmbeds.forEach(decodeAndReplaceEmbed);
								}
								document.querySelectorAll("span.markdown-embed").forEach(decodeAndReplaceEmbed);

								document.body.setAttribute("class", \`${document.body.getAttribute("class")}\`);
								document.body.setAttribute("style", \`${document.body.getAttribute("style")}\`);

								if (document.body.addClass) {
									document.body.addClass("theme-light");
									document.body.removeClass("theme-dark");
								} else {
									document.body.classList.add("theme-light");
									document.body.classList.remove("theme-dark");
								}

								document.title = \`${doc.title}\`;

								// DEBUG: Log webview content after injection
								window.__debugInfo = {
									bodyLength: document.body.innerHTML.length,
									embedCount: document.querySelectorAll('span.markdown-embed').length,
									textPreview: document.body.textContent.substring(0, 500)
								};
							`);

							console.log('HTML injected');

							// Get debug info from webview
							const debugInfo = await webview.executeJavaScript('window.__debugInfo');
							await logToFile(`Webview AFTER injection: bodyLength=${debugInfo.bodyLength}, embeds=${debugInfo.embedCount}`);
							await logToFile(`Webview text preview: "${debugInfo.textPreview}"`);

							// CRITICAL: Check embed visibility and dimensions
							const embedDiagnostics = await webview.executeJavaScript(`
								(() => {
									const embeds = document.querySelectorAll('span.markdown-embed');
									const diagnostics = [];
									embeds.forEach((embed, i) => {
										const rect = embed.getBoundingClientRect();
										const computed = window.getComputedStyle(embed);
										diagnostics.push({
											index: i,
											display: computed.display,
											visibility: computed.visibility,
											height: computed.height,
											offsetHeight: embed.offsetHeight,
											scrollHeight: embed.scrollHeight,
											rect: {
												top: rect.top,
												height: rect.height,
												bottom: rect.bottom
											},
											textPreview: embed.textContent.substring(0, 100)
										});
									});
									return diagnostics;
								})()
							`);

							await logToFile(`=== EMBED DIAGNOSTICS (${embedDiagnostics.length} embeds) ===`);
							for (const diag of embedDiagnostics) {
								await logToFile(`Embed ${diag.index}: display=${diag.display}, visibility=${diag.visibility}, height=${diag.height}, offsetHeight=${diag.offsetHeight}, rect.top=${diag.rect.top}, rect.height=${diag.rect.height}`);
								await logToFile(`  Text: "${diag.textPreview}"`);
							}

							// Inject patch styles AFTER HTML with conditional @page margins
							getPatchStyle(pdfMarginType, pdfMarginTop, pdfMarginBottom, pdfMarginLeft, pdfMarginRight).forEach(async (css) => {
								await webview.insertCSS(css);
							});
							console.log('Patch styles injected with margin type:', pdfMarginType);

							// DIAGNOSTIC: Extract coordinates from webview (NO scroll offsets)
							console.log('[DIAGNOSTIC] Extracting coordinates from webview...');

							const webviewCoordinates = await webview.executeJavaScript(`
								const offsetX = ${offsetX};
								const offsetY = ${offsetY};
								const marginLeft = ${marginLeft};
								const marginTop = ${marginTop};

								(() => {
									const marks = document.querySelectorAll('mark');
									const coords = [];
									const pageHeight = 1123;  // A4 height at 96 DPI

									// DIAGNOSTIC: Log first few marks to debug coordinate issues
									marks.forEach((mark, index) => {
										const rects = mark.getClientRects();
										for (let i = 0; i < rects.length; i++) {
											const rect = rects[i];

											// Apply configurable margin corrections + user offset adjustments
											const correctedLeft = rect.left - marginLeft + offsetX;
											const correctedTop = rect.top - marginTop + offsetY;

											// Calculate proportional coordinates with multi-page encoding
											// Top coordinate: Page 1 (0.0-1.0), Page 2 (1.0-2.0), etc.
											// Divide by SINGLE page height to maintain page encoding
											const rawLeft = correctedLeft / 794;
											const rawTop = correctedTop / pageHeight;  // Multi-page encoding

											// Log first 3 marks for debugging
											if (index < 3) {
												console.log('[COORDINATE DEBUG] Mark ' + index + ':', {
													rawPosition: { left: rect.left, top: rect.top },
													corrected: { left: correctedLeft, top: correctedTop },
													proportional: { left: rawLeft, top: rawTop },
													pageNum: Math.floor(rawTop) + 1,
													topWithinPage: rawTop - Math.floor(rawTop)
												});
											}

											coords.push({
												left: rawLeft,
												top: rawTop,  // Preserve multi-page encoding for coordinate mapper
												width: rect.width / 794,
												height: rect.height / pageHeight
											});
										}
									});

									console.log('[DIAGNOSTIC] Webview extracted ' + coords.length + ' coordinates');
									return coords;
								})()
							`);

							console.log(`[DIAGNOSTIC] Webview extracted ${webviewCoordinates.length} coordinates`);

							// TEMPORARILY DISABLED: Margin coordinate adjustment
							// Coordinates work correctly WITHOUT adjustment when margins are disabled
							// TODO: Figure out correct margin offset calculation
							if (false && pdfMarginType !== '0') {
								console.log('[COORDINATE ADJUSTMENT] Margin adjustment DISABLED for debugging');
							}

							// Wait for layout (scale with content size for longer documents)
							const baseWait = 2000;
							const contentLength = doc.body.innerHTML.length;
							const extraWait = Math.min(3000, Math.floor(contentLength / 10000) * 500);
							const totalLayoutWait = baseWait + extraWait;
							console.log(`Waiting ${totalLayoutWait}ms for layout (content: ${contentLength} chars)`);
							await new Promise(r => setTimeout(r, totalLayoutWait));

							// Verify content
							const bodyLength = await webview.executeJavaScript('document.body.innerHTML.length');
							const bodyHeight = await webview.executeJavaScript('document.body.scrollHeight');

							console.log('Webview content verified:', {
								bodyLength,
								bodyHeight,
								expectedLength: doc.body.innerHTML.length
							});

							if (bodyLength < 100) {
								throw new Error(`Webview content failed (bodyLength: ${bodyLength})`);
							}

							// Wait for paint
							await new Promise(r => setTimeout(r, 1500));

							// Generate PDF with NO printToPDF margins
							// Margins are implemented via CSS body padding instead (more reliable)
							const printOptions: any = {
								pageSize: 'A4',
								landscape: false,
								printBackground: true,
								margins: {
									marginType: 'custom',
									top: 0,
									bottom: 0,
									left: 0,
									right: 0
								}
							};

							console.log('PDF generation (margins via CSS padding, not printToPDF):', {
								pdfMarginType,
								cssMargins: pdfMarginType !== '0' ? 'active' : 'none'
							});

							// CRITICAL: Scroll to top before printToPDF
							// This ensures we capture from the very beginning of the document
							await webview.executeJavaScript(`
								window.scrollTo(0, 0);
								document.documentElement.scrollTop = 0;
								document.body.scrollTop = 0;
							`);
							await logToFile(`Scrolled webview to top before PDF generation`);

							// DIAGNOSTIC: Check document state before printToPDF
							const prePDFDiagnostics = await webview.executeJavaScript(`
								(() => {
									const bodyStyle = window.getComputedStyle(document.body);
									return {
										bodyScrollHeight: document.body.scrollHeight,
										bodyOffsetHeight: document.body.offsetHeight,
										bodyClientHeight: document.body.clientHeight,
										documentHeight: document.documentElement.scrollHeight,
										embedCount: document.querySelectorAll('span.markdown-embed').length,
										firstEmbedTop: document.querySelector('span.markdown-embed')?.getBoundingClientRect().top || null,
										scrollY: window.scrollY,
										documentScrollTop: document.documentElement.scrollTop,
										bodyScrollTop: document.body.scrollTop,
										bodyPadding: {
											top: bodyStyle.paddingTop,
											bottom: bodyStyle.paddingBottom,
											left: bodyStyle.paddingLeft,
											right: bodyStyle.paddingRight
										},
										bodyMargin: {
											top: bodyStyle.marginTop,
											bottom: bodyStyle.marginBottom
										}
									};
								})()
							`);
							await logToFile(`=== PRE-PDF DIAGNOSTICS ===`);
							await logToFile(`Body scrollHeight: ${prePDFDiagnostics.bodyScrollHeight}, offsetHeight: ${prePDFDiagnostics.bodyOffsetHeight}`);
							await logToFile(`Document height: ${prePDFDiagnostics.documentHeight}, embedCount: ${prePDFDiagnostics.embedCount}`);
							await logToFile(`First embed top position: ${prePDFDiagnostics.firstEmbedTop}`);
							await logToFile(`Scroll position: window.scrollY=${prePDFDiagnostics.scrollY}, document.scrollTop=${prePDFDiagnostics.documentScrollTop}, body.scrollTop=${prePDFDiagnostics.bodyScrollTop}`);
							await logToFile(`Body padding: top=${prePDFDiagnostics.bodyPadding.top}, bottom=${prePDFDiagnostics.bodyPadding.bottom}, left=${prePDFDiagnostics.bodyPadding.left}, right=${prePDFDiagnostics.bodyPadding.right}`);
							await logToFile(`Body margin: top=${prePDFDiagnostics.bodyMargin.top}, bottom=${prePDFDiagnostics.bodyMargin.bottom}`);

							console.log('Generating PDF...');
							await logToFile(`Calling printToPDF with options: ${JSON.stringify(printOptions)}`);
							const pdfData = await webview.printToPDF(printOptions);

							console.log('PDF generated:', {
								size: pdfData.length,
								sizeKB: (pdfData.length / 1024).toFixed(1)
							});
							await logToFile(`PDF generated: ${pdfData.length} bytes`);

							// DIAGNOSTIC: Verify PDF page count
							try {
								const { PDFDocument } = require('pdf-lib');
								const verifyPDF = await PDFDocument.load(pdfData);
								const pageCount = verifyPDF.getPageCount();
								console.log(`PDF Verification: Generated PDF has ${pageCount} page(s)`);

								if (pageCount === 0) {
									console.error('ERROR: PDF has 0 pages! Generation failed.');
								}
							} catch (verifyError) {
								console.warn('Could not verify PDF page count:', verifyError);
							}

							// Get PDF page dimensions (A4 at 96 DPI)
							// A4 = 210x297mm = 8.27x11.69 inches = 794x1123 pixels at 96 DPI
							const pdfWidth = 794;  // A4 width in pixels at 96 DPI
							const pdfHeight = 1123; // A4 height in pixels at 96 DPI

							// DIAGNOSTIC: Extract coordinates from PDF text layer for comparison
							console.log('[DIAGNOSTIC] Extracting coordinates from PDF text layer...');
							let pdfCoordinates: Array<{left: number; top: number; width: number; height: number; pageNum: number; text?: string}> = [];

							try {
								const pdfHighlights = await pdfExtractor.extractFromPDF(Buffer.from(pdfData), highlightedTexts);

								// Convert to multi-page proportional coordinates
								pdfCoordinates = pdfHighlights.map(highlight => ({
									left: highlight.left,
									top: highlight.top + (highlight.pageNum - 1),  // Multi-page offset
									width: highlight.width,
									height: highlight.height,
									pageNum: highlight.pageNum,
									text: highlight.text
								}));

								console.log(`[DIAGNOSTIC] PDF extracted ${pdfCoordinates.length} coordinates`);
							} catch (extractError) {
								console.error('[DIAGNOSTIC] Error extracting from PDF:', extractError);
								pdfCoordinates = [];
							}

							// Use whichever coordinate source found MORE highlights
							// PDF extraction can miss highlights in embedded content
							// Webview extraction is more reliable for finding all highlights
							const finalCoordinates = (pdfCoordinates.length >= webviewCoordinates.length)
								? pdfCoordinates
								: webviewCoordinates;

							console.log(`[COORDINATE SELECTION] Webview: ${webviewCoordinates.length}, PDF: ${pdfCoordinates.length}`);
							console.log(`[COORDINATE SELECTION] Using ${finalCoordinates === pdfCoordinates ? 'PDF' : 'webview'} coordinates (${finalCoordinates.length} total)`);
							if (finalCoordinates === pdfCoordinates) {
								console.log('[COORDINATE SELECTION] ✓ Using PDF coordinates - found equal or more highlights than webview');
							} else {
								console.warn('[COORDINATE SELECTION] ⚠ Using webview coordinates - PDF missed some highlights (likely in embeds)');
							}

							resolve({
								pdfData,
								pdfWidth,
								pdfHeight,
								coordinates: finalCoordinates,  // Use PDF coordinates (post page-break)
								webviewCoordinates,  // For comparison
								pdfCoordinates  // For comparison
							});
						} catch (error) {
							console.error('Error in webview:', error);
							reject(error);
						}
					});

					webview.addEventListener('crashed', () => {
						clearTimeout(timeout);
						reject(new Error('Webview crashed'));
					});
				});

				return result;
			} finally {
				// Cleanup webview
				console.log('Cleaning up webview...');
				setTimeout(() => {
					webviewContainer.remove();
					console.log('Webview removed');
				}, 100);
			}

		} catch (error) {
			// Ensure cleanup on error
			printEl?.remove();
			comp?.unload();
			leaf?.detach();
			throw error;
		}
	}

	/**
	 * Generate random document ID
	 */
	private generateDocId(length: number): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = '';
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	/**
	 * Save PDF to file
	 */
	async savePDF(pdfData: Buffer, filePath: string): Promise<void> {
		const fs = require('fs').promises;
		await fs.writeFile(filePath, pdfData);
		console.log('PDF saved to:', filePath);
	}
}
