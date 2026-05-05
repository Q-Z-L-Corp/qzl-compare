/**
 * Global constants for QZL Compare
 * 
 * This file centralizes magic numbers and configuration constants
 * to make them easy to maintain and adjust globally.
 */

// File size limits
export const FILE_SIZE_HARD_LIMIT = 20 * 1024 * 1024; // 20 MB
export const FILE_SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024; // 5 MB

// Editor rendering
export const LINE_HEIGHT = 20; // pixels
export const GUTTER_WIDTH = 50; // pixels
export const CHAR_WIDTH = 8; // approximate pixels for monospace font

// Diff computation
export const DIFF_DEBOUNCE_DELAY_MS = 220; // milliseconds
export const EDIT_DIFF_DEBOUNCE_DELAY_MS = 240; // milliseconds

// History / Undo-Redo
export const MAX_UNDO_HISTORY = 400; // maximum undo/redo snapshots

// UI feedback
export const TOAST_DURATION_MS = 3000; // milliseconds
export const FLASH_HIGHLIGHT_DURATION_MS = 600; // milliseconds

// Folder compare
export const FOLDER_ROW_HEIGHT = 30; // pixels
export const MAX_FOLDER_ROWS_PER_BATCH = 100; // items per virtualization batch

// Worker queue
export const MAX_CONCURRENT_DIFFS = 2; // simultaneous worker tasks

// Performance thresholds
export const LARGE_FILE_LINE_COUNT = 5000; // lines
export const LARGE_FOLDER_FILE_COUNT = 1000; // files
