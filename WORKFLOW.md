# Current Workflow Documentation (v1.2.3)

## Overview

The plugin currently exports Obsidian markdown files with highlights to PDF format, extracting highlight coordinates for future Anki image occlusion card creation.

**Current Status:** PDF + Coordinates Export (v1.2.0-1.2.3)
**Next Phase:** PDF-to-PNG conversion and Anki sync

---

## Complete Export Workflow

### Phase 1: File Reading and Validation

**Location:** `src/main.ts:75-98`

1. **Read Markdown File**
   - Uses `readMarkdownFile()` to parse file content
   - Extracts frontmatter, content, and highlights
   - Returns structured `MarkdownContent` object

2. **Validation Checks**
   ```typescript
   // Empty file check
   if (!fullContent || fullContent.trim().length === 0)

   // Content without frontmatter check
   if (!contentWithoutFrontmatter || contentWithoutFrontmatter.trim().length === 0)

   // Highlights check
   if (highlights.length === 0)
   ```

3. **Tag Extraction** (Optional)
   - If `settings.extractTags` enabled
   - Extracts tags from frontmatter
   - Formats for Anki compatibility

**Output:** Validated markdown content with highlights array

---

### Phase 2: PDF Rendering Pipeline

**Location:** `src/rendering/pipeline.ts:37-95`

#### Step 1: Export to PDF
**Method:** `BetterPDFIntegration.exportFileToPDF()`

**Workflow:**
```
markdown content
  → MarkdownRenderer.render()
  → HTML document
  → webview injection
  → CSS styling
  → printToPDF()
```

#### Step 2: Better-Export-PDF Integration

**Location:** `src/rendering/better-pdf-integration.ts`

**Key Functions Used:**

1. **Fragment Capture Pattern** (lines 218-243)
   ```typescript
   const fragment: any = {
       children: undefined,
       appendChild(e: any) {
           this.children = e?.children;
           throw new Error('exit');
       }
   };
   ```
   - Captures rendered children without DOM pollution
   - Throws error to exit early after capture

2. **Post-Processing** (lines 246-259)
   ```typescript
   await MarkdownRenderer.postProcess(this.app, {
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
   ```
   - Resolves embeds and dataview queries
   - Processes internal links
   - Handles async rendering operations

3. **Wait for Embeds** (lines 273-280)
   ```typescript
   await fixWaitRender(data, viewEl);
   ```
   - Waits 2 seconds if file contains `![[embeds]]`, dataview, or events
   - Additional 1 second for DOM stabilization

4. **Canvas to Image Conversion** (line 283)
   ```typescript
   fixCanvasToImage(viewEl);
   ```
   - Converts all `<canvas>` elements to `<img>` tags
   - Preserves visual content for PDF generation

#### Step 3: Title Injection (v1.2.3)

**Location:** lines 285-307

```typescript
// Clone printEl structure
const clonedPrintEl = printEl.cloneNode(true) as HTMLElement;

// Find markdown-preview-view div
const markdownView = clonedPrintEl.querySelector('.markdown-preview-view');

// Create title with minimal styling
const titleEl = doc.createElement('h1');
titleEl.textContent = file.basename;
titleEl.style.cssText = 'display: block !important; visibility: visible !important;';

// Insert as first child to inherit theme styles
markdownView.insertBefore(titleEl, markdownView.firstChild);
```

**Why Inside markdown-preview-view?**
- Inherits theme CSS variables (`--text-normal`, `--h1-color`, etc.)
- Gets proper heading styles from theme
- Colors and borders automatically match theme

#### Step 4: Embed Encoding

**Location:** lines 309-310

```typescript
encodeEmbeds(doc);
```

**Function:** `encodeEmbeds()` (lines 172-177)
```typescript
function encodeEmbeds(doc: Document): void {
    const spans = Array.from(doc.querySelectorAll('span.markdown-embed')).reverse();
    spans.forEach((span: HTMLElement) => {
        span.innerHTML = encodeURIComponent(span.innerHTML);
    });
}
```

**Purpose:** Safely transport nested embed HTML through webview injection

---

### Phase 3: Webview Injection and PDF Generation

**Location:** `src/rendering/better-pdf-integration.ts:318-476`

#### Step 1: Webview Creation (lines 318-329)

```typescript
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
```

**Scale Factor:** 1.25 for better rendering quality

#### Step 2: CSS Injection (lines 346-379)

**Order:**
1. **Document Styles** (concurrent, lines 347-350)
   ```typescript
   getAllStyles().forEach(async (css) => {
       await webview.insertCSS(css);
   });
   ```

2. **Enabled CSS Snippets** (v1.2.2, lines 352-379)
   ```typescript
   // Read appearance.json
   const appearancePath = basePath + '/.obsidian/appearance.json';
   const appearanceData = JSON.parse(await fs.readFile(appearancePath, 'utf8'));
   const enabledSnippets = appearanceData.enabledCssSnippets || [];

   // Load only enabled snippets
   for (const snippetName of enabledSnippets) {
       const cssPath = path.join(snippetsDir, snippetName + '.css');
       const cssContent = await fs.readFile(cssPath, 'utf8');
       await webview.insertCSS(cssContent);
   }
   ```

**Key Features (v1.2.2):**
- Filters by `enabledCssSnippets` array from appearance.json
- Only loads snippets toggled on in Obsidian settings
- Preserves user's color schemes and styling

3. **Patch Styles** (after HTML injection, lines 400-403)
   ```typescript
   getPatchStyle().forEach(async (css) => {
       await webview.insertCSS(css);
   });
   ```

**Why This Order?**
- Document styles provide base theme
- User snippets override with custom colors/borders
- Patch styles ensure print compatibility

#### Step 3: HTML Injection (lines 371-395)

```typescript
await webview.executeJavaScript(`
    // Inject body and head content
    document.body.innerHTML = decodeURIComponent(\`${encodeURIComponent(doc.body.innerHTML)}\`);
    document.head.innerHTML = decodeURIComponent(\`${encodeURIComponent(document.head.innerHTML)}\`);

    // CRITICAL: Recursively decode embedded content
    function decodeAndReplaceEmbed(element) {
        element.innerHTML = decodeURIComponent(element.innerHTML);
        const newEmbeds = element.querySelectorAll("span.markdown-embed");
        newEmbeds.forEach(decodeAndReplaceEmbed);
    }
    document.querySelectorAll("span.markdown-embed").forEach(decodeAndReplaceEmbed);

    // Apply theme classes
    document.body.classList.add("theme-light");
    document.body.classList.remove("theme-dark");

    document.title = \`${doc.title}\`;
`);
```

**Encode/Decode Cycle:**
1. `encodeEmbeds(doc)` - Encode before transport
2. `encodeURIComponent(doc.body.innerHTML)` - Encode for JavaScript string
3. `decodeURIComponent()` in webview - Decode outer layer
4. `decodeAndReplaceEmbed()` - Recursively decode nested embeds

#### Step 4: Layout Wait and Verification (lines 405-420)

```typescript
// Wait for layout
await new Promise(r => setTimeout(r, 2000));

// Verify content loaded correctly
const bodyLength = await webview.executeJavaScript('document.body.innerHTML.length');
const bodyHeight = await webview.executeJavaScript('document.body.scrollHeight');

if (bodyLength < 100) {
    throw new Error(`Webview content failed (bodyLength: ${bodyLength})`);
}

// Wait for paint
await new Promise(r => setTimeout(r, 1500));
```

**Total Wait Time:** 3.5 seconds for layout + paint

#### Step 5: PDF Generation (lines 425-445)

```typescript
const printOptions = {
    pageSize: 'A4' as const,
    landscape: false,
    printBackground: true,
    margins: {
        marginType: 'custom' as const,
        top: 0.1,
        bottom: 0.1,
        left: 0.1,
        right: 0.1
    }
};

const pdfData = await webview.printToPDF(printOptions);
```

**Margins:** 0.1 inches (reduced from 0.4" in v1.1.2)

**PDF Dimensions (A4 at 96 DPI):**
```typescript
const pdfWidth = 794;   // 8.27 inches × 96 DPI
const pdfHeight = 1123; // 11.69 inches × 96 DPI
```

**Output:**
```typescript
{
    pdfData: Buffer,
    pdfWidth: 794,
    pdfHeight: 1123
}
```

---

### Phase 4: Highlight Coordinate Extraction

**Location:** `src/rendering/pipeline.ts:55-73`

#### Process:

1. **Find Highlight Elements**
   ```typescript
   const highlights = Array.from(printEl.querySelectorAll('mark'));
   ```

2. **Extract Bounding Rectangles**
   ```typescript
   for (const mark of highlights) {
       const rect = mark.getBoundingClientRect();
       const containerRect = printEl.getBoundingClientRect();

       // Calculate relative position
       const absoluteCoords = {
           left: rect.left - containerRect.left,
           top: rect.top - containerRect.top,
           width: rect.width,
           height: rect.height
       };
   }
   ```

3. **Convert to Proportional Coordinates**
   ```typescript
   const proportionalCoords = absoluteCoords.map(coord => ({
       left: coord.left / pdfWidth,
       top: coord.top / pdfHeight,
       width: coord.width / pdfWidth,
       height: coord.height / pdfHeight
   }));
   ```

**Coordinate Format:**
```typescript
{
    left: 0.12191042,    // 0-1 range (proportion of page width)
    top: 0.14745659,     // 0-1 range (proportion of page height)
    width: 0.13913925,   // proportion of page width
    height: 0.01291184   // proportion of page height
}
```

---

### Phase 5: File Export

**Location:** `src/rendering/pipeline.ts:76-95`, `src/main.ts:150-174`

#### Outputs:

1. **PDF File** (`debug-export.pdf`)
   ```typescript
   const pdfPath = path.join(pluginDir, 'debug-export.pdf');
   await fs.writeFile(pdfPath, pdfData);
   ```

2. **Coordinates File** (`coordinates.json`)
   ```typescript
   const coordsPath = path.join(pluginDir, 'coordinates.json');
   await fs.writeFile(coordsPath, JSON.stringify({
       filePath: file.path,
       pdfPath: pdfPath,
       coordinates: proportionalCoords,
       pdfDimensions: { width: 794, height: 1123 },
       timestamp: new Date().toISOString()
   }, null, 2));
   ```

3. **Debug Export File** (`debug-export.json`)
   ```typescript
   await this.app.vault.adapter.write(
       `${debugDir}/debug-export.json`,
       JSON.stringify({
           file: file.path,
           timestamp: new Date().toISOString(),
           fields: fields,
           occlusionCount: processed.highlights.length,
           occlusionStringLength: occlusionString.length,
           occlusionStringSample: occlusionString.substring(0, 500),
           pdfPath: processed.pdfPath,
           pdfDimensions: processed.pdfDimensions
       }, null, 2)
   );
   ```

**User Notifications:**
```typescript
new Notice('✅ PDF and coordinates exported successfully!', 5000);
new Notice('⚠️ Anki sync disabled - PDF-to-PNG conversion not yet implemented', 6000);
```

---

## Version History and Key Changes

### v1.2.3 (Current) - Theme-Aware Title
**Changes:**
- Title moved inside `.markdown-preview-view` div
- Removed hardcoded color/border styles
- Title now inherits theme CSS variables
- Only forces `display` and `visibility`

**Why:**
- Titles match theme colors automatically
- Works with all Obsidian themes
- Respects user's custom CSS snippets

### v1.2.2 - Filtered CSS Snippets
**Changes:**
- Read `appearance.json` for enabled snippets
- Only load snippets in `enabledCssSnippets` array
- Skip disabled snippet files

**Why:**
- Faster loading (fewer CSS files)
- Respects user's snippet preferences
- Reduces CSS conflicts

### v1.2.1 - CSS Snippet Loading
**Changes:**
- Added CSS snippet loading from `.obsidian/snippets/`
- Manual file reading and injection

**Why:**
- `getAllStyles()` doesn't include snippet files
- User's custom colors (like embed borders) weren't applying

### v1.2.0 - PDF-Only Export
**Changes:**
- Removed PNG capture (`webview.capturePage()`)
- Save coordinates to `coordinates.json`
- Return PDF dimensions instead of PNG dimensions
- Disabled Anki sync

**Why:**
- PNG capture was viewport-only (not full page)
- Coordinates needed for future PDF→PNG conversion
- Decouple PDF generation from Anki sync

### v1.1.4 - Complete Encode/Decode Cycle
**Changes:**
- Added `encodeEmbeds()` function
- Encode BEFORE webview injection
- Decode after HTML injection

**Why:**
- Embeds weren't rendering correctly
- Nested embeds lost structure during transport

### v1.1.3 - CSS Injection Fix
**Changes:**
- Changed CSS injection from sequential to concurrent
- Reduced margins from 0.4" to 0.1"

**Why:**
- Sequential `await` blocked main thread → gray screen crash
- Better-export-pdf uses concurrent injection
- Smaller margins match typical document formatting

---

## Key Technical Insights

### Why Fragment Capture Pattern?

```typescript
const fragment: any = {
    children: undefined,
    appendChild(e: any) {
        this.children = e?.children;
        throw new Error('exit');
    }
};
```

**Purpose:** Capture rendered children without adding to DOM

**How It Works:**
1. `MarkdownRenderer.render()` tries to append to fragment
2. Fragment captures children in `appendChild()`
3. Throws error to exit rendering early
4. We have captured children without DOM pollution

### Why Encode/Decode Embeds?

**Problem:** Nested embeds like `![[File A]]` which contains `![[File B]]` lose structure when transported through webview.

**Solution:**
1. **Before Transport:** `encodeEmbeds(doc)` - Encode all `span.markdown-embed` innerHTML
2. **Transport:** `encodeURIComponent(doc.body.innerHTML)` - Encode for JavaScript string
3. **After Transport:** `decodeAndReplaceEmbed()` - Recursively decode nested embeds

**Result:** Nested structure preserved through multiple encoding layers

### Why Concurrent CSS Injection?

**Problem:** Sequential await blocks main thread
```typescript
// WRONG - blocks main thread
for (const css of allStyles) {
    await webview.insertCSS(css);
}
```

**Solution:** Fire all requests concurrently
```typescript
// CORRECT - non-blocking
getAllStyles().forEach(async (css) => {
    await webview.insertCSS(css);
});
```

**Result:** No gray screen crash, faster execution

### Why Title Inside markdown-preview-view?

**Problem:** Title at body level doesn't get theme styling
```html
<body>
  <h1 style="color: #000;">Title</h1>  ← Hardcoded black
  <div class="print">
    <div class="markdown-preview-view">
      ... content with theme colors ...
    </div>
  </div>
</body>
```

**Solution:** Insert title inside themed container
```html
<body>
  <div class="print">
    <div class="markdown-preview-view">
      <h1>Title</h1>  ← Inherits theme colors!
      ... content ...
    </div>
  </div>
</body>
```

**Result:** Title matches theme automatically

---

## Testing the Current Workflow

### Test Case 1: Simple Document
```markdown
# Test Document

This is some content.

==First highlight==

More content here.

==Second highlight==
```

**Expected Output:**
- `debug-export.pdf` - Full page with title, content, highlights
- `coordinates.json` - 2 coordinates (proportional 0-1 range)
- Title matches theme colors
- Highlights visible in PDF

### Test Case 2: Document with Embeds
```markdown
# Main Document

![[Embedded Note]]

==Highlight after embed==
```

**Expected Output:**
- Embed content appears inline
- Nested embeds render correctly
- Coordinates accurate relative to full page
- No encoding artifacts

### Test Case 3: Long Document (Multi-Page)
```markdown
# Very Long Document

[... 100+ paragraphs ...]

==Highlight near bottom==
```

**Expected Output:**
- Full PDF with all pages
- Highlight coordinates accurate on multi-page PDF
- Title on first page only
- All content rendered

---

## Next Steps (From next steps.md)

See updated TODO.md for complete roadmap integration.
