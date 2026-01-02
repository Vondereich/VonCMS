## v1.9.7 (2026-01-03) - THE "SMART" RELEASE 🧠

### 🌙 Smart Dark Mode Sanitizer

- **Algorithmic Color Cleaning**: Implemented a "Smart Sanitizer" (`colorSanitizer.ts`) that mathematically detects and removes "Neutral" inline colors (Black, White, Dark Gray) from content upon saving.
- **Universal Fix**: Works for any source (MS Word, Google Docs) without relying on hardcoded blacklists. Preserves legitimate colors (Red, Blue) while ensuring text is readable in Dark Mode.
- **Auto-Fix**: Old content is automatically repaired simply by opening and updating the post.

### 🚀 Enhanced SEO System

- **Real-time Analysis**: Restored and improved SEO Analyzer with 0-100 scoring and live checklist.
- **Intelligent Keyword Extraction**: Auto-generate logic now prioritizes words from the **Title** (weighted 5x) over general content, producing far more relevant tags.
- **Security Improved**: UI Panel integrated safely without interfering with Theme CSS.

### 🛡️ Security & Hygiene

- **XSS Protection**: Applied sanitization wrapper to Advertisement Blocks in Prism, Portfolio, and Digest themes.
- **Clean Build**: Removed demo data (`samples` folder) and optimized release package size.
