# Protocol Explorer

Requires Node.js 22.16 or newer. No dependency installation is needed.

```sh
npm run dev
```

Open **http://127.0.0.1:3000/**. Use an HTTP server; opening `index.html` directly with `file://` will not load the modules correctly.

To choose another port:

```sh
npm run dev -- --port 5173
```

## Build and verify

```sh
npm run check
npm run build
npm run preview
```

`dist/` is a complete static website that can be hosted on any static host. The build uses only Node's standard library. Verification checks every captured file's SHA-256 and size, recursively checks module/style/font dependencies, parses all JavaScript, and requests all files through the local server to check their contents and MIME types.

## GitHub Pages

The included GitHub Actions workflow builds and publishes `dist/` to GitHub Pages. Enable **Settings → Pages → Source: GitHub Actions**, then push to the default branch. Asset URLs are relative, so project pages served at `https://<user>.github.io/protocol-explorer/` work correctly.
