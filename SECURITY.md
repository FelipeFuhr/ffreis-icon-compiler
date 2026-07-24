# Security Policy

This is a build-time tool with no runtime network surface: it reads local
config + glyph packages and renders PNGs through a headless Chromium instance.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository, or email the
maintainer. Please do not file public issues for undisclosed vulnerabilities.

## Scope notes

- The renderer executes local HTML/CSS in headless Chromium. Do not feed it
  untrusted template or glyph input without review — arbitrary SVG/CSS is
  rendered as-authored.
- Glyph packages (`@fortawesome/free-solid-svg-icons`, `simple-icons`) are
  pinned and dependency-scanned via Renovate.
