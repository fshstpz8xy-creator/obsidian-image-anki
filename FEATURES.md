# Anki Image Occlusion Plugin - Feature Documentation (v1.2.3)

## Current Features

### ✅ PDF Export with Theme Styling

**What It Does:**
Exports your Obsidian markdown files to high-quality PDF with full theme styling preserved.

**Key Features:**
- **Theme-Aware Rendering:** PDF matches your active Obsidian theme colors, fonts, and styling
- **CSS Snippet Support:** Automatically loads your enabled CSS snippets from `.obsidian/snippets/`
- **Page Title:** File basename appears as styled h1 at top of PDF (follows theme styling)
- **Full Content Export:** Entire file rendered with all formatting, embeds, tables, lists, callouts

**How to Use:**
1. Open a markdown file in Obsidian
2. Run command: "Export to Anki (Current File)"
3. PDF saved to plugin directory as `debug-export.pdf`

**Settings:**
- `includeFrontmatter`: Toggle to include/exclude YAML frontmatter in PDF
- `imageQuality`: Quality setting for rendering (1-4x, default 2x)
- `maxImageWidth`: Maximum width constraint (default: 2400px)
- `maxImageHeight`: Maximum height constraint (default: 10000px)

---

### ✅ Highlight Coordinate Extraction

**What It Does:**
Detects all `==highlighted text==` in your markdown and extracts precise bounding box coordinates.

**Output Format:** `coordinates.json`
```json
{
  "filePath": "path/to/your/file.md",
  "pdfPath": "/full/path/to/debug-export.pdf",
  "coordinates": [
    {
      "left": 0.121910,    // Proportional 0-1 (12.2% from left)
      "top": 0.147457,     // Proportional 0-1 (14.7% from top)
      "width": 0.139139,   // Proportional width
      "height": 0.012912   // Proportional height
    }
  ],
  "pdfDimensions": {
    "width": 794,         // A4 width at 96 DPI
    "height": 1123        // A4 height at 96 DPI
  },
  "timestamp": "2025-12-02T08:59:50.527Z"
}
```

**Coordinate System:**
- Proportional values (0-1 range) relative to PDF page dimensions
- Independent of display resolution
- Ready for Anki image occlusion format conversion

**Use Cases:**
- Future: Convert to Anki cloze rectangles
- PDF annotation tools
- Custom highlight processing

---

### ✅ Better-Export-PDF Integration

**What It Does:**
Uses proven workflow from the popular better-export-pdf Obsidian plugin for reliable rendering.

**Key Components:**

1. **Fragment Capture Pattern**
   - Captures rendered content without DOM pollution
   - Preserves Obsidian's component lifecycle

2. **Embed Resolution**
   - Fully resolves `![[embedded notes]]`
   - Handles nested embeds (embeds within embeds)
   - Supports Dataview queries and dynamic content

3. **Canvas to Image Conversion**
   - Converts `<canvas>` elements to static images
   - Preserves charts, graphs, and visual content

4. **Encode/Decode Cycle**
   - Safely transports complex HTML through webview
   - Recursive decoding for nested embeds
   - Preserves structure and formatting

**Technical Details:**
- Uses Electron webview for isolated rendering
- Concurrent CSS injection (non-blocking)
- 3.5 second wait for layout and paint
- A4 page size (794x1123px at 96 DPI)
- 0.1 inch margins (customizable in future)

---

### ✅ Theme and CSS Snippet Loading (v1.2.2-1.2.3)

**What It Does:**
Loads your active theme and enabled CSS snippets for accurate PDF styling.

**How It Works:**

1. **Document Stylesheets**
   ```typescript
   getAllStyles() // Loads all active theme CSS
   ```

2. **Enabled Snippets Only** (v1.2.2)
   ```typescript
   // Reads .obsidian/appearance.json
   const enabledSnippets = appearance.json.enabledCssSnippets;
   // Loads only: inlineAdmonitionsPluginReadOnly, embed_rules_FINAL_FIXED, etc.
   ```

3. **Patch Styles**
   ```typescript
   getPatchStyle() // Print media rules + compatibility patches
   ```

**Result:** PDF visually matches your Obsidian vault exactly.

**Benefits:**
- Custom embed colors preserved
- Callout styling maintained
- User CSS customizations applied
- Faster loading (only enabled snippets)

---

### ✅ Sequential Cloze Mode

**What It Does:**
Generates Anki occlusion string with all highlights as `c1` clozes for sequential reveal.

**Output:** (saved to `debug-export.json`)
```
{{c1::image-occlusion:rect:left=0.12:top=0.14:width=0.13:height=0.01}}
{{c1::image-occlusion:rect:left=0.04:top=1.38:width=0.23:height=0.01}}
{{c1::image-occlusion:rect:left=0.02:top=1.41:width=0.94:height=0.01}}
```

**Behavior in Anki:**
- All highlights reveal one-by-one in order
- Same cloze number (`c1`) for sequential mode
- "Hide All, Guess One" study pattern

**Future:** Option for separate cloze numbers (c1, c2, c3...) for parallel reveals.

---

### ✅ Validation and Error Handling

**Pre-Export Validation:**
- ✅ Empty file detection
- ✅ Content without frontmatter check
- ✅ Highlight presence validation
- ✅ File read error handling

**Export Validation:**
- ✅ Webview initialization timeout (10 seconds)
- ✅ Content verification (body length >100 characters)
- ✅ PDF generation success check
- ✅ Coordinate range validation (0-1)

**User Feedback:**
```
📖 Reading filename...
✅ Found 4 highlights
🎨 Rendering document...
✅ Rendered 4 occlusions
✅ PDF and coordinates exported successfully!
⚠️ Anki sync disabled - PDF-to-PNG conversion not yet implemented
```

**Error Messages:**
- Clear, actionable error descriptions
- Console logging for debugging
- Graceful fallback on failures

---

### ✅ Settings Configuration

**Current Settings Panel:**

**Anki Settings:**
- `ankiConnectUrl`: AnkiConnect API URL (default: http://localhost)
- `ankiConnectPort`: Port number (default: 8765)
- `targetDeck`: Destination deck name (default: "Default")

**Export Settings:**
- `includeFrontmatter`: Include YAML frontmatter in PDF (default: false)
- `extractTags`: Extract tags from frontmatter (default: true)
- `sequentialClozeMode`: Use c1 for all highlights (default: true)

**Image Settings:**
- `imageQuality`: DPI multiplier 1-4x (default: 2)
- `maxImageWidth`: Max width in pixels (default: 2400)
- `maxImageHeight`: Max height in pixels (default: 10000)
- `imageFormat`: PNG or JPEG (default: png)

**Pipeline Settings:**
- `usePDFPipeline`: Use PDF pipeline (default: true)

**Commands:**
- "Export to Anki (Current File)": Export active file
- "Test AnkiConnect Connection": Verify Anki is running

---

## Known Limitations (v1.2.3)

### ⚠️ PDF-Only Export (No Anki Sync)

**Current State:** Plugin exports PDF + coordinates but does NOT sync to Anki yet.

**Why:**
- Phase 1 focused on reliable PDF generation
- PDF-to-PNG conversion requires additional library (pdf-lib or pdfjs-dist)
- Coordinate mapping to PNG pages needs implementation

**Workaround:** Manual import to Anki (future automation planned)

---

### ⚠️ No File Change Detection

**Current Behavior:** Re-exports create new PDF every time, no caching.

**Impact:**
- Slower for unchanged files
- No "smart sync" to update only modified files

**Future:**
- File modification timestamp tracking (Phase 10)
- Content hash comparison for change detection
- "Sync Watched Folders" command for batch updates

---

### ⚠️ No Folder-Based Auto-Sync

**Current Behavior:** Manual command per file.

**Future (Phase 10):**
- Watch specific folders for changes
- Auto-export modified files
- Mirror directory structure
- Batch sync command

---

### ⚠️ Fixed PDF Margins

**Current:** 0.1 inches on all sides (hardcoded)

**Future (Phase 11):**
- Custom margin settings (top, bottom, left, right)
- Preset options (minimal, standard, wide)

---

### ⚠️ No Page Numbers

**Current:** No page numbering in PDFs

**Future (Phase 11):**
- Toggle to enable page numbers
- Position options (bottom center, bottom right, etc.)
- Format options ("Page 1 of 5" vs "1 / 5")

---

### ⚠️ Requires Highlights

**Current Behavior:** Files without `==highlights==` are skipped with warning.

**Future (Phase 11):**
- Export files without highlights
- Generate 1-2 placeholder clozes
- Allow manual Anki editing later

---

## Technical Architecture

### File Structure

```
src/
├── main.ts                           # Plugin entry point
├── settings.ts                       # Settings definitions
├── settingsTab.ts                    # Settings UI
├── anki/
│   ├── client.ts                     # AnkiConnect HTTP client
│   ├── models.ts                     # Type definitions
│   └── sync.ts                       # Sync manager (unused currently)
├── rendering/
│   ├── pipeline.ts                   # Orchestrates export workflow
│   ├── better-pdf-integration.ts    # PDF generation engine
│   └── coordinate-extractor.ts      # Highlight detection
└── utils/
    ├── markdown.ts                   # Markdown parsing
    └── hash.ts                       # Content hashing
```

### Data Flow

```
Markdown File
  ↓
readMarkdownFile()
  ↓
{fullContent, highlights, frontmatter}
  ↓
RenderingPipeline.process()
  ↓
BetterPDFIntegration.exportFileToPDF()
  ↓
{pdfData, pdfWidth, pdfHeight}
  ↓
Coordinate Extraction
  ↓
{coordinates: [...], pdfDimensions: {...}}
  ↓
File System Output:
  - debug-export.pdf
  - coordinates.json
  - debug-export.json
```

### Key Dependencies

- **Obsidian API:** `obsidian` package
  - `MarkdownRenderer`: Convert markdown to HTML
  - `Component`: Lifecycle management
  - `TFile`: File abstraction

- **Node.js Built-ins:**
  - `fs.promises`: File system operations
  - `path`: Path manipulation

- **Electron:** (via Obsidian)
  - `webview`: Isolated rendering context
  - `printToPDF()`: PDF generation

---

## Version History

### v1.2.3 (Current) - Theme-Aware Title
**Released:** 2025-12-02

**Changes:**
- Title moved inside `.markdown-preview-view` div
- Inherits theme CSS variables automatically
- Removed hardcoded color/border styles
- Only forces display and visibility

**Impact:** Titles match theme across all Obsidian themes

---

### v1.2.2 - Filtered CSS Snippets
**Released:** 2025-12-02

**Changes:**
- Read `appearance.json` for enabled snippets list
- Only load snippets toggled on in Obsidian
- Skip disabled snippet files

**Impact:**
- Faster loading (21 enabled vs 30+ total snippets)
- Respects user preferences
- Reduced CSS conflicts

---

### v1.2.1 - CSS Snippet Loading
**Changes:**
- Manual loading of `.obsidian/snippets/*.css` files
- Inject into webview after document styles

**Impact:** User's custom colors (embed borders, callouts) now appear in PDF

---

### v1.2.0 - PDF-Only Export
**Changes:**
- Removed PNG viewport capture
- Save coordinates to `coordinates.json`
- Return PDF dimensions (794x1123)
- Disabled Anki sync temporarily

**Impact:** Decoupled PDF generation from Anki sync, preparing for proper PDF→PNG conversion

---

### v1.1.4 - Complete Encode/Decode Cycle
**Changes:**
- Added `encodeEmbeds()` function
- Encode embeds BEFORE webview injection
- Decode AFTER HTML injection

**Impact:** Nested embeds render correctly

---

### v1.1.3 - CSS Injection Fix
**Changes:**
- Concurrent CSS injection (non-blocking)
- Reduced margins from 0.4" to 0.1"

**Impact:** No more gray screen crash, better margins

---

## Future Roadmap

See [TODO.md](./TODO.md) for complete roadmap.

### Phase 10: Semi-Automatic Sync (v1.3.0)
- Watch folders for file changes
- Batch export modified files only
- Mirror directory structure
- Update Anki cards (don't duplicate)

### Phase 11: Quality of Life (v1.3.x)
- Custom PDF margins (settings)
- Page numbers (optional)
- Export files without highlights (with placeholders)
- Pre/post-export validation
- Performance optimizations

### Phase 12: PDF-to-PNG & Anki Integration (v1.4.0)
- Extract PDF pages to PNG with pdf-lib
- Map coordinates to PNG pages
- Re-enable Anki sync
- Complete Markdown → PDF → PNG → Anki pipeline

---

## Usage Examples

### Example 1: Basic Law Notes Export

**Markdown File:**
```markdown
---
tags: [civil-procedure, jurisdiction]
---

# Rule 7: Pleadings Allowed

==The following pleadings are allowed==:

1. Complaint
2. Answer
3. Reply to counterclaim

The court has ==discretion to order additional pleadings==.
```

**Result:**
- `debug-export.pdf`: Full page with title, content, 2 highlights
- `coordinates.json`: 2 coordinate objects
- Title matches theme (colored heading)
- Custom embed colors applied (if using snippets)

---

### Example 2: Document with Embeds

**Markdown File:**
```markdown
# Case Analysis

![[Case Brief - Smith v Jones]]

The key holding is ==jurisdiction requires minimum contacts==.

![[Related Cases/Precedent]]
```

**Result:**
- Embedded notes appear inline
- Nested embeds fully resolved
- 1 highlight coordinate extracted
- All styling preserved

---

### Example 3: Multi-Page Document

**Markdown File:**
```markdown
# Long Case Brief

[... 50 paragraphs of analysis ...]

==Key takeaway near end==
```

**Result:**
- PDF spans multiple pages (A4 at 794x1123px each)
- Coordinates accurate relative to full document
- Title on first page
- All content rendered

---

## Troubleshooting

### PDF Export Fails

**Symptoms:** Error message, no PDF generated

**Checklist:**
1. Check console for errors (Ctrl+Shift+I)
2. Verify file has content (not just frontmatter)
3. Try disabling complex plugins temporarily
4. Check webview initialization logs

**Common Causes:**
- Empty file or only frontmatter
- Extremely large file (>50,000 lines)
- Plugin conflicts
- CSS snippet syntax errors

---

### Colors Not Appearing

**Symptoms:** PDF is black/white, missing custom colors

**Fix (v1.2.2+):**
- Check `.obsidian/appearance.json` has `enabledCssSnippets` array
- Verify your snippet is toggled ON in Obsidian settings
- Check snippet filename matches exactly (case-sensitive)

**Example:**
```json
{
  "enabledCssSnippets": [
    "embed_rules_FINAL_FIXED"  // Must match filename (without .css)
  ]
}
```

---

### Title Not Visible

**Fixed in v1.2.3**

**Previous Issue:** Title had hardcoded styles that conflicted with theme

**Current Solution:** Title inside `.markdown-preview-view` inherits theme CSS

**Verify:** Check that `<h1>` appears at top of PDF with theme colors

---

### Highlights Not Detected

**Symptoms:** "No highlights found" warning

**Checklist:**
1. Use exactly `==` syntax (two equals signs)
2. Close highlights: `==text==` not `==text`
3. Check for smart quotes (use straight quotes)
4. No spaces: `== text ==` won't work

**Valid:**
```markdown
==This is highlighted==
```

**Invalid:**
```markdown
== This has spaces ==
=This is only one equals sign=
```

---

## Support and Contributing

**Plugin Directory:** `.obsidian/plugins/new-pdf-anki/`

**Key Files:**
- `main.js`: Compiled plugin
- `manifest.json`: Plugin metadata
- `debug-export.pdf`: Last exported PDF
- `coordinates.json`: Last extracted coordinates
- `debug-export.json`: Last export metadata

**Logging:**
- Open Developer Tools: Ctrl+Shift+I (Windows/Linux) or Cmd+Opt+I (Mac)
- Check Console tab for detailed logs
- Look for `BetterPDFIntegration:` and `RenderingPipeline:` prefixes

**Documentation:**
- [WORKFLOW.md](./WORKFLOW.md): Technical workflow details
- [ARCHITECTURE.md](./ARCHITECTURE.md): System architecture
- [TODO.md](./TODO.md): Complete roadmap and planning

---

## License

MIT License - See LICENSE file for details

**Author:** Eleanor Cross
**Repository:** https://github.com/eleanorcross
