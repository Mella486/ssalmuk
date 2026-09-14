# 쌀먹지수

Official-source game economy guides and a browser-local personal record calculator.

## Edit and verify

Content sources: `content/games.cjs`, `content/articles.cjs`.
Shared templates and informational pages: `scripts/build-site.cjs`.
Calculator implementation: `assets/calculator-core.js`, `assets/calculator.js`.

```sh
node scripts/build-site.cjs
node --test tests/site.test.cjs
node scripts/build-site.cjs --check
```

For browser regressions, run `node tests/calculator-browser.cjs` with Playwright available. If using an existing installation, set `PLAYWRIGHT_MODULE` to its module path and `CHROMIUM_EXECUTABLE` to the browser executable. This checks concurrent tab writes/deletions, storage failure, invalid time values, disabled JavaScript and script-load failures. These are development tools; the published site has no third-party runtime dependency.

GitHub Pages publishes the committed HTML and assets. Build scripts, tests and editorial source modules are excluded by `_config.yml`.

Do not reintroduce invented wages, participant counts, automatic user posts or unsupported first-hand experience claims. Official mechanics, editorial interpretation and hypothetical arithmetic must remain distinguishable. Historical Firebase records are preserved externally and are not accessed by this public version.

The original pre-change version remains in the Git tag `자동-채팅-수정-전`.
