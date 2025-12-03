# Documentation Index

Complete documentation for the Anki Image Occlusion Plugin (v1.2.3)

## Core Documentation

### 📖 [FEATURES.md](./FEATURES.md)
**Purpose:** User-facing feature documentation

**Contents:**
- ✅ Current features and capabilities
- ⚠️ Known limitations
- 🔧 Settings and configuration
- 📊 Usage examples
- 🐛 Troubleshooting guide
- 📋 Version history

**Best For:** Understanding what the plugin can do right now

---

### 🔄 [WORKFLOW.md](./WORKFLOW.md)
**Purpose:** Technical workflow documentation

**Contents:**
- Complete export pipeline walkthrough
- Phase-by-phase process explanation
- Code snippets and technical details
- Key architectural decisions
- Testing procedures

**Best For:** Understanding how the plugin works internally

---

### 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)
**Purpose:** System architecture overview

**Contents:**
- High-level architecture diagram
- Component descriptions
- Better-export-pdf integration details
- Known issues and solutions
- Version history

**Best For:** Understanding the overall system design

---

### 📋 [TODO.md](./TODO.md)
**Purpose:** Implementation roadmap

**Contents:**
- Phase-by-phase implementation plan (0-12)
- Detailed task breakdown
- Estimated effort and priorities
- Success criteria
- Technical decisions

**Best For:** Planning future development

---

### 📝 [next steps.md](./next steps.md)
**Purpose:** User-requested feature ideas

**Contents:**
- Semi-automatic sync with folder watching
- Additional settings (margins, page numbers)
- Files without highlights (placeholder clozes)
- Quality checks

**Best For:** Feature requests and future enhancements

---

## Quick Reference

### Current Status (v1.2.3)

**What Works:**
- ✅ PDF export with theme styling
- ✅ Highlight coordinate extraction
- ✅ Better-export-pdf integration
- ✅ CSS snippet loading (enabled only)
- ✅ Theme-aware title rendering
- ✅ Sequential cloze generation
- ✅ Validation and error handling

**What's Missing:**
- ⚠️ PDF-to-PNG conversion (Phase 12)
- ⚠️ Anki sync (disabled until PNG ready)
- ⚠️ Folder watch system (Phase 10)
- ⚠️ Custom margins (Phase 11)
- ⚠️ Page numbers (Phase 11)

---

## Documentation Hierarchy

```
┌─────────────────────────────────────────┐
│  DOCUMENTATION_INDEX.md (You Are Here)  │
│  ├─ Quick overview of all docs          │
│  └─ Navigation guide                    │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│ FEATURES.md  │        │  WORKFLOW.md │
│ (User Docs)  │        │ (Technical)  │
└──────────────┘        └──────────────┘
        │                       │
        ├─ What it does         ├─ How it works
        ├─ How to use           ├─ Code walkthrough
        ├─ Troubleshooting      ├─ Technical insights
        └─ Examples             └─ Testing guide
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────────┐    ┌──────────────┐
│ ARCHITECTURE.md  │    │  TODO.md     │
│ (System Design)  │    │ (Roadmap)    │
└──────────────────┘    └──────────────┘
        │                       │
        ├─ Component diagram    ├─ Phases 0-12
        ├─ Integration details  ├─ Task breakdown
        ├─ Known issues         ├─ Effort estimates
        └─ Design rationale     └─ Success criteria
                    │
                    ▼
            ┌──────────────────┐
            │  next steps.md   │
            │ (Future Ideas)   │
            └──────────────────┘
                    │
                    ├─ Semi-auto sync
                    ├─ QoL features
                    └─ User requests
```

---

## Reading Guide

### For Users

**Start here:**
1. [FEATURES.md](./FEATURES.md) - What can I do with this plugin?
2. [FEATURES.md#Usage Examples](./FEATURES.md#usage-examples) - How do I use it?
3. [FEATURES.md#Troubleshooting](./FEATURES.md#troubleshooting) - Something's not working

**Advanced:**
- [WORKFLOW.md](./WORKFLOW.md) - I want to understand how it works
- [TODO.md](./TODO.md) - What features are coming next?

---

### For Developers

**Start here:**
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
2. [WORKFLOW.md](./WORKFLOW.md) - Detailed implementation walkthrough
3. [TODO.md](./TODO.md) - Implementation roadmap

**Deep Dive:**
- [WORKFLOW.md#Phase 2](./WORKFLOW.md#phase-2-pdf-rendering-pipeline) - PDF rendering details
- [WORKFLOW.md#Phase 3](./WORKFLOW.md#phase-3-webview-injection-and-pdf-generation) - Webview injection process
- [ARCHITECTURE.md#Known Issues](./ARCHITECTURE.md#known-issues) - Current limitations

---

### For Contributors

**Onboarding:**
1. [FEATURES.md](./FEATURES.md) - Current capabilities
2. [TODO.md](./TODO.md) - What needs to be built
3. [WORKFLOW.md#Key Technical Insights](./WORKFLOW.md#key-technical-insights) - Why things work this way

**Before Starting:**
- Check [TODO.md#Phase 10-12](./TODO.md#phase-10-semi-automatic-sync-system-v130) for next priorities
- Review [next steps.md](./next steps.md) for user requests
- Read [WORKFLOW.md#Version History](./WORKFLOW.md#version-history-and-key-changes) for context

---

## Key Concepts

### Better-Export-PDF Integration

The plugin uses the proven workflow from the better-export-pdf Obsidian plugin. Key patterns:

1. **Fragment Capture:** Capture rendered children without DOM pollution
2. **Encode/Decode Cycle:** Safely transport embeds through webview
3. **Concurrent CSS Injection:** Non-blocking style loading
4. **Theme Awareness:** Title inside `.markdown-preview-view` inherits theme CSS

See: [WORKFLOW.md#Key Technical Insights](./WORKFLOW.md#key-technical-insights)

---

### Coordinate System

Highlights are stored as proportional coordinates (0-1 range):

```json
{
  "left": 0.121910,    // 12.19% from left edge
  "top": 0.147457,     // 14.75% from top edge
  "width": 0.139139,   // 13.91% of page width
  "height": 0.012912   // 1.29% of page height
}
```

**Why Proportional?**
- Resolution-independent
- Works with different PDF sizes
- Ready for Anki occlusion format
- Easier coordinate transformations

See: [WORKFLOW.md#Phase 4](./WORKFLOW.md#phase-4-highlight-coordinate-extraction)

---

### Sequential Cloze Mode

All highlights use `c1` cloze number for sequential reveal in Anki:

```
{{c1::rect:left=0.12:top=0.14:width=0.13:height=0.01}}
{{c1::rect:left=0.04:top=1.38:width=0.23:height=0.01}}
```

**Behavior:**
- First review: Show highlight 1
- Second review: Show highlight 2
- Third review: Show highlight 3
- "Hide All, Guess One" study pattern

See: [FEATURES.md#Sequential Cloze Mode](./FEATURES.md#-sequential-cloze-mode)

---

## Version Timeline

```
v1.1.2 → v1.1.3 → v1.1.4 → v1.2.0 → v1.2.1 → v1.2.2 → v1.2.3 (Current)
   │        │        │        │        │        │        │
Gray     CSS    Encode   PDF     CSS    Filter  Theme
screen   fix    /Decode  only  snippets snippets title
crash                           loading  enabled  aware
```

See: [ARCHITECTURE.md#Version History](./ARCHITECTURE.md#version-history) for details

---

## Common Tasks

### "I want to export a file"
→ [FEATURES.md#How to Use](./FEATURES.md#-pdf-export-with-theme-styling)

### "Something's not working"
→ [FEATURES.md#Troubleshooting](./FEATURES.md#troubleshooting)

### "What features are planned?"
→ [TODO.md](./TODO.md) + [next steps.md](./next steps.md)

### "How does the export work?"
→ [WORKFLOW.md](./WORKFLOW.md)

### "Why was it designed this way?"
→ [ARCHITECTURE.md](./ARCHITECTURE.md)

### "I want to contribute"
→ [TODO.md#Phase 10-12](./TODO.md#phase-10-semi-automatic-sync-system-v130)

---

## File Locations

**Plugin Directory:**
```
.obsidian/plugins/new-pdf-anki/
├── main.js                      # Compiled plugin
├── manifest.json                # Plugin metadata (v1.2.3)
├── styles.css                   # Plugin styles
│
├── src/                         # Source code
│   ├── main.ts                  # Entry point
│   ├── rendering/
│   │   ├── better-pdf-integration.ts
│   │   └── pipeline.ts
│   └── ...
│
├── DOCUMENTATION_INDEX.md       # This file
├── FEATURES.md                  # Feature documentation
├── WORKFLOW.md                  # Technical workflow
├── ARCHITECTURE.md              # System architecture
├── TODO.md                      # Implementation roadmap
├── next steps.md                # Feature requests
│
└── Debug Output:
    ├── debug-export.pdf         # Last exported PDF
    ├── coordinates.json         # Last highlight coordinates
    └── debug-export.json        # Last export metadata
```

---

## Contact

**Author:** Eleanor Cross
**Repository:** https://github.com/eleanorcross
**License:** MIT

---

## Update Log

**2025-12-02:** Initial documentation structure created (v1.2.3)
- Created FEATURES.md, WORKFLOW.md, DOCUMENTATION_INDEX.md
- Updated TODO.md with Phases 10-12 from next steps.md
- Integrated semi-automatic sync roadmap
- Added QoL feature planning
