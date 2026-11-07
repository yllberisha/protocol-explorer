# Protocol Explorer — local classroom copy

A self-contained snapshot of <https://protocol-explorer-alpha.vercel.app/> with the visible designer credit removed as requested. The deployed lessons, packet animations and inspection, search, keyboard controls, responsive layouts, themes, and language selection are preserved.

## Run

Requires Node.js 22.16 or newer. No dependency installation is needed.

```sh
npm run dev
```

Open **http://127.0.0.1:3000/**. Use an HTTP server; opening `index.html` directly with `file://` will not load the modules correctly.

To choose another port:

```sh
npm run dev -- --port 5173
```

All application assets are local. After the copy is downloaded, running it does not require the reference site or an internet connection. Original canonical/sharing metadata remains preserved. Preferences are stored in browser local storage for the local origin, independently of preferences on the reference site.

## Build and verify

```sh
npm run check
npm run build
npm run preview
```

`dist/` is a complete static website that can be hosted on any static host. The build uses only Node's standard library. Verification checks every captured file's SHA-256 and size, recursively checks module/style/font dependencies, parses all JavaScript, and requests all files through the local server to check their contents and MIME types.

## Files

- `public/index.html`: original document and startup theme handling.
- `public/assets/`: original production JavaScript, translations, CSS, and font subsets.
- `public/*.png`, `public/*.svg`, `public/*.ico`, `public/site.webmanifest`: original brand assets and manifest.
- `scripts/serve.mjs`: small local static server.
- `scripts/build.mjs`: verifies and copies the site to `dist/`.
- `verification/reference-manifest.json`: capture date, source URL, original file sizes, and SHA-256 hashes.
- `verification/local-overrides.json`: verified hashes and descriptions of intentional local customizations.

This is the deployed production frontend, including compiled/minified modules; it is not the author's original uncompiled source tree. Intentional customizations are recorded separately so verification preserves the original reference hashes.

Original creator: **Dilum Sanjaya**. The visible designer credit has been removed at the user's request. This local educational copy was prepared with their stated permission.

Browser automation was unavailable in the preparation environment. Asset and HTTP checks are automated; pixel comparison and browser interaction checks have not been performed.
