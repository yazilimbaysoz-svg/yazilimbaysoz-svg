# Security Policy

**Maintained by Baysöz Yazılım** (baysozlabs@proton.me)

## Reporting

Report security vulnerabilities by contacting `baysozlabs@proton.me`. Provide a clear description, reproduction steps, and potential impact.

## Secure Development Controls

- No secrets, credentials, or private keys in source or artifacts.
- No unsafe DOM sinks (`innerHTML`, `eval`, `document.write`, inline handlers).
- External links use `rel="noopener noreferrer"` and `target="_blank"` where applicable.
- The image acquisition pipeline uses HTTPS, host allowlists, redirect host validation, timeouts, size caps, and subprocess calls with `shell=False`.
- Verification artifacts are regenerated from real logs and scanned for privacy leaks.
