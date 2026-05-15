# Bai Tap Co Vua

`Bai Tap Co Vua` is a React + TypeScript application for building printable chess puzzle worksheets. It is designed for chess teachers and training centers that need to import puzzle packs, customize worksheet layouts, and export the final result as image-based PDFs.

## Features

- Import chess puzzles from PGN data with FEN tags
- Preview worksheet pages directly in the browser
- Build multi-page puzzle books with configurable rows and columns
- Customize cover pages, board themes, piece sets, fonts, and answer styles
- Switch between English and Vietnamese UI labels
- Export worksheets as image-based PDF files

## Tech Stack

- React 19
- TypeScript
- Vite
- `chess.js`
- `cm-chessboard`
- `pdf-lib`
- `playwright-core` for local export automation

## Getting Started

### Requirements

- Node.js 18+ recommended
- npm

### Install

```bash
npm install
```

### Run the app

```bash
npm run dev
```

The Vite dev server usually starts at `http://localhost:5173`.

## Available Scripts

```bash
npm run dev
```

Starts the development server.

```bash
npm run build
```

Builds the production bundle.

```bash
npm run preview
```

Previews the production build locally.

```bash
npm run lint
```

Runs ESLint across the project.

```bash
npm run export:image-pdf
```

Generates an image-based PDF using the local Playwright export script.

```bash
npm run export:pdf
```

Runs the legacy PDF export script kept for local verification workflows.

## Export Workflow

The main export flow in the UI uses the `Export Image PDF` button. The app posts the current worksheet state to a local Vite middleware endpoint, renders each page in Chromium, captures the pages as PNG images, and assembles them into a final PDF with `pdf-lib`.

For the local export scripts, make sure a Chrome or Chromium executable is available on your machine. If auto-detection fails, set:

```bash
CHROME_PATH=/path/to/chrome
```

If Playwright browser dependencies are missing, install them with:

```bash
npx playwright install chromium
```

On Linux you may also need:

```bash
npx playwright install-deps chromium
```

## PGN Input Notes

This project expects puzzle packs that include FEN tags. If the imported PGN does not contain valid FEN positions, the worksheet builder will not generate puzzles for export.

## Project Structure

```text
.
├── docs/                 Project documentation
├── exports/              Generated export samples and debug output
├── public/               Static assets
├── scripts/              Local export automation scripts
├── src/                  Application source
│   ├── data/             Bundled sample PGN data
│   └── export/           Browser-side PDF export helpers
├── package.json
└── vite.config.ts
```

## Notes

- The interface is optimized for worksheet creation rather than interactive puzzle solving.
- The repository currently includes sample exported files under `exports/` for testing and verification.
