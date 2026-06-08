/**
 * Re-export SupportedLanguages from yummygraph-shared (single source of truth).
 *
 * HOW TO ADD A NEW LANGUAGE:
 *
 * 1. Add the enum member in yummygraph-shared/src/languages.ts
 * 2. Run `tsc --noEmit` — compiler errors guide you to every dispatch table
 * 3. Use the checklist in each ingestion file for what to add
 * 4. Add tree-sitter-<lang> to yummygraph/package.json dependencies
 * 5. Add file extension mapping in utils.ts getLanguageFromFilename()
 * 6. Run full test suite
 */
export { SupportedLanguages } from 'yummygraph-shared';
