# Anki Image Occlusion Plugin - Architecture

## Version 1.1.4 - Current Implementation

### Overview
Export Obsidian markdown notes with `==highlights==` to Anki as image occlusion cards using PDF-first workflow.

### Core Workflow

```
1. Read markdown file
   ↓
2. Render to HTML (Obsidian MarkdownRenderer API)
   - Open file in workspace leaf (provides embed context)
   - Render with MarkdownRenderer.render()
   - PostProcess with MarkdownRenderer.postProcess()
   ↓
3. Wait for embeds to load (fixWaitRender)
   - Detects: ![[embeds]], ```dataview, ```gEvent
   - Waits 2-3 seconds for async content
   ↓
4. Fix canvas elements (fixCanvasToImage)
   - Converts <canvas> to <img> for print compatibility
   ↓
5. Clone to Document
   - Create new HTMLDocument
   - Clone rendered content
   - Add page title <h1>
   ↓
6. Encode embeds (encodeEmbeds)
   - Find all span.markdown-embed elements
   - Encode innerHTML with encodeURIComponent
   - Process innermost-to-outermost (reverse())
   ↓
7. Extract highlight coordinates
   - Find all <mark> tags in container
   - Get bounding rectangles (pixel coordinates)
   ↓
8. Inject into webview for PDF generation
   - Create Electron <webview> element
   - Inject CSS (getAllStyles + getPatchStyle)
   - Inject HTML via executeJavaScript
   - Decode embeds (decodeAndReplaceEmbed)
   ↓
9. Generate PDF
   - webview.printToPDF() with A4, 0.1" margins
   - Save to debug-export.pdf
   ↓
10. Capture PNG (DEPRECATED - will be removed)
    - webview.capturePage()
    - Convert to base64
    ↓
11. Convert coordinates to proportional (0-100%)
    ↓
12. Generate Anki occlusion string
    - Format: {{c1::image-occlusion:rect:left=4.66:top=1.75:width=1.38:height=0.96:fill=#55aaff}}
    ↓
13. Sync to Anki
    - Built-in Image Occlusion note type (Anki 23.10+)
    - Fields: Occlusion, Image, Header, Back Extra, Comments
```

### Key Components

#### better-pdf-integration.ts
Main PDF export engine, EXACT copy of better-export-pdf plugin workflow:

**CSS Handling**:
- `getAllStyles()` - Collects all document stylesheets (skips svelte)
- `getPrintStyle()` - Extracts @media print rules
- `getPatchStyle()` - Returns CSS_PATCH + print styles
- `CSS_PATCH` - Fixes body overflow, embed styling, table breaks

**Embed Processing**:
- `fixWaitRender()` - Waits for async embeds/dataview
- `fixCanvasToImage()` - Converts canvas to images
- `encodeEmbeds()` - Encodes embed innerHTML for transport
- `decodeAndReplaceEmbed()` - Recursively decodes in webview

**Webview Workflow**:
1. CSS injection (concurrent, forEach without await)
2. HTML injection (body + head separately)
3. Embed decoding
4. Body styling (theme-light, class/style attrs)
5. Patch styles injection (AFTER HTML)
6. Wait for layout (2000ms)
7. Verify content (body length, scroll height)
8. Wait for paint (1500ms)
9. Generate PDF

#### coordinate-extractor.ts
Extracts highlight bounding boxes and converts to proportional coordinates.

#### anki/sync.ts
Manages Anki card creation/updates with built-in Image Occlusion format.

### Known Issues (v1.1.4)

1. **Embed colors broken** - Custom CSS from embed_rules_FINAL_FIXED.css not applying correctly
   - Possible cause: CSS selectors not matching exported structure
   - Need to debug: Are `.markdown-embed[src*="Rule"]` selectors matching?

2. **Page title styling broken** - `<h1>` added but may need custom styling
   - Simple text title, may need formatting/positioning

3. **PNG from webview doesn't match PDF** - Viewport capture may have different rendering
   - SOLUTION: Extract pages from PDF instead (upcoming)

### Architectural Decisions

#### Why PDF-first?
- User wants PDF backups
- PDF is authoritative output format
- Better-export-pdf proven reliable for Obsidian rendering

#### Why encode/decode cycle?
- Embeds contain nested HTML and special characters
- URI encoding preserves structure during serialization
- Webview executeJavaScript requires safe string transport
- Decoding restores exact DOM structure with CSS selectors

#### Why workspace leaf?
- Embeds need view context to resolve `![[...]]` syntax
- Dataview queries need file context
- Obsidian API requires active leaf for full rendering

### Next Steps (Roadmap)

#### Phase 1: Remove PNG Capture (v1.2.0)
- [ ] Remove webview.capturePage()
- [ ] Remove imageData/width/height from return type
- [ ] Save coordinates to JSON file instead
- [ ] Remove PDF size checks (min/max)

#### Phase 2: PDF-to-PNG Conversion (v1.3.0)
- [ ] Add command: Extract PDF pages to PNG
- [ ] Use pdf-lib or similar to extract pages
- [ ] Apply saved coordinates to each page
- [ ] Generate one Anki card per page

#### Phase 3: Fix Styling (v1.4.0)
- [ ] Debug embed CSS selectors
- [ ] Fix page title formatting
- [ ] Ensure custom CSS applies correctly

### File Structure

```
src/
├── main.ts                          # Plugin entry, export command
├── settings.ts                      # Plugin settings
├── settingsTab.ts                   # Settings UI
├── rendering/
│   ├── pipeline.ts                  # Orchestrates full pipeline
│   ├── better-pdf-integration.ts    # PDF export (EXACT better-export-pdf)
│   ├── markdown-renderer.ts         # HTML rendering
│   ├── coordinate-extractor.ts      # Highlight coordinate extraction
│   ├── screenshot.ts                # (DEPRECATED) html2canvas fallback
│   ├── pdf-exporter.ts              # (DEPRECATED) PDF utilities
│   └── pdf-to-images.ts             # (DEPRECATED) PDF page extraction
├── anki/
│   ├── client.ts                    # AnkiConnect HTTP client
│   ├── sync.ts                      # Card sync manager
│   └── models.ts                    # TypeScript types
└── utils/
    ├── markdown.ts                  # Markdown parsing
    └── hash.ts                      # Content hashing

debug-export.pdf                     # Generated PDF (for inspection)
debug-export.json                    # Export metadata
debug-image.png                      # Captured image (DEPRECATED)
```

### Dependencies

- **Obsidian API**: MarkdownRenderer, Component, TFile
- **Electron**: webview element, printToPDF, capturePage
- **better-export-pdf**: Workflow reference (not direct dependency)

### Testing

1. Create markdown file with:
   - `==highlights==` for occlusions
   - `![[embeds]]` for testing embed resolution
   - Tables, lists, formatted content

2. Run "Export to Anki (Current File)"

3. Check outputs:
   - `debug-export.pdf` - visual inspection
   - `debug-export.json` - metadata/coordinates
   - `debug-image.png` - viewport capture (DEPRECATED)
   - Anki card created successfully

### Version History

- **1.1.0**: Initial better-export-pdf workflow integration
- **1.1.1**: Complete CSS_PATCH with table rules
- **1.1.2**: Fixed CSS injection (concurrent), reduced margins
- **1.1.3**: Added decodeAndReplaceEmbed (incomplete)
- **1.1.4**: Added encodeEmbeds (complete encode/decode cycle), page title
- **1.2.0**: Removed PNG capture, save coordinates.json, disabled Anki sync
- **1.2.1**: Load CSS snippets from .obsidian/snippets/ folder
- **1.2.2**: Filter CSS snippets by enabled list from appearance.json, fixed title visibility with !important styles and proper placement
- **1.2.3**: Title now inserted inside markdown-preview-view div to inherit theme styling (colors, borders, fonts) instead of using hardcoded styles
