# Lampstand — Open Scripture Study

A free, open, no-login Bible study tool that runs entirely in the browser and hosts as a static site. Read scripture across 1,000+ public-domain translations, follow cross-references, read public-domain commentaries, search everything at once, and add your own PDFs — which are processed and stored **only on your device** and never uploaded anywhere.

## Features
- **Reader** with 1,000+ free/public-domain translations (right-to-left supported)
- **Cross-references** — tap any verse (CC-BY data from OpenBible.info)
- **Commentaries** — Adam Clarke, Jamieson-Fausset-Brown, and others (public domain)
- **Unified search** across scripture, and your own PDFs, in one place
- **Personal library** — add PDFs that are parsed in-browser and saved locally (IndexedDB); nothing is uploaded
- **Light / dark** themes, mobile-friendly, no account required

## How it works (privacy)
- Scripture, commentary, and translation data are fetched from the free [HelloAO Bible API](https://bible.helloao.org) (no key, no tracking).
- A complete translation is downloaded once for fast local search and cached in your browser.
- PDFs you add are parsed locally with [pdf.js](https://mozilla.github.io/pdf.js/) and stored only in your browser. They never leave your device.
- There is no backend and no analytics.

## Run locally
Because the app uses ES modules and `fetch`, open it through a local server (not `file://`):
```
cd lampstand
python3 -m http.server 8000
# then open http://localhost:8000
```

## Notes & limits (v1)
- PDFs must be **text-based**. Scanned/image-only PDFs have no extractable text and will be marked not-searchable (OCR is a future addition).
- Original-language (Greek/Hebrew) study is planned as a follow-up.
- Some browsers in private/incognito mode block IndexedDB; the app falls back to session-only use.

## Attribution & licensing
- Scripture & commentary data: [HelloAO Free Use Bible API](https://bible.helloao.org) — public domain / open-licensed translations and commentaries.
- Cross-reference data: **OpenBible.info**, licensed **CC-BY** (https://www.openbible.info/labs/cross-references/). The `cross_refs.json` file is derived from that dataset.
- PDF parsing: pdf.js (Apache-2.0).
- Fonts: Fraunces & Newsreader (Google Fonts, open licensed).
