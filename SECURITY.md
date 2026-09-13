# Security Policy

## Reporting a Vulnerability

The BizGuides team takes security and user privacy seriously. If you discover a potential security vulnerability in this extension, please report it responsibly.

### How to Report

Please **do not** open a public issue on GitHub for security vulnerabilities.

Instead, please send a private disclosure email detailing:
1. A description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or a proof-of-concept (PoC).
3. The affected extension version and Chrome version.

### Security Architecture Highlights

- **Zero Hardcoded Secrets**: No API keys, passwords, or tokens exist in this repository.
- **Client-Side Isolation**: All user-provided Gemini API keys are saved exclusively in sandboxed `chrome.storage.local`.
- **Header-Based Authentication**: AI requests transmit keys via `x-goog-api-key` HTTP headers, preventing log and query string exposure.
- **Minimal Permissions**: The extension only requests host permissions for Google Maps (`*://www.google.com/maps/*`, `*://maps.google.com/*`) and Google's official Gemini endpoint (`https://generativelanguage.googleapis.com/*`).
- **CSV Sanitization (CWE-1236)**: Formula injection protection prevents spreadsheet command execution upon CSV export.
- **Strict Content Security Policy (CSP)**: Extension pages disallow inline eval and untrusted remote scripts (`script-src 'self'; object-src 'none';`).
