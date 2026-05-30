# Lampstand — Open Scripture Study

A free, open, no-login Bible study tool that runs entirely in the browser and hosts as a static site. Read scripture across 1,000+ public-domain translations, follow cross-references, read public-domain commentaries, search everything at once, and add your own PDFs — which are processed and stored **only on your device** and never uploaded anywhere.

## Features
- **Reader** with 1,000+ free/public-domain translations (English pinned to top; right-to-left supported)
- **Cross-references** — tap any verse (CC-BY data from OpenBible.info)
- **Commentaries** — Adam Clarke, Jamieson-Fausset-Brown, and others (public domain)
- **Original languages** — tap any verse → "Original" tab shows the Greek (NT) or Hebrew (OT) with tap-a-word study: Strong's number, lemma, transliteration, full lexicon definition, KJV renderings, and morphological parsing
- **Unified search** across scripture and your own PDFs, in one place
- **Personal library** — add PDFs that are parsed in-browser and saved locally (IndexedDB); nothing is uploaded
- **Light / dark** themes, mobile-friendly, no account required

## A note on translations
Public-domain and freely-licensed translations only: BSB (default), WEB, KJV, ASV, NET, Geneva, Darby, Young's Literal, and ~1,000 others in many languages. **NIV, ESV, NKJV, NASB, and NLT are not included and cannot be** — they are commercially copyrighted, and no free/open tool may legally distribute them. For original-meaning study, use the Original-language tab, which surfaces the actual Greek/Hebrew words behind any translation.

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
- Hebrew Old Testament text & morphology: **OpenScriptures Hebrew Bible (WLC)**, lemma/morphology licensed **CC-BY 4.0** (https://hb.openscriptures.org/); the WLC text is public domain.
- Greek New Testament text & morphology: **MorphGNT / SBLGNT** (https://github.com/morphgnt/sblgnt).
- Strong's lexicons (Greek & Hebrew): **OpenScriptures**, **CC-BY-SA** (https://github.com/openscriptures/strongs).
- PDF parsing: pdf.js (Apache-2.0).
- Fonts: Fraunces, Newsreader, Frank Ruhl Libre (Google Fonts, open licensed).

The original-language datasets are vendored into the `orig/` folder (per-book files loaded on demand). They are open data, not a runtime service.
