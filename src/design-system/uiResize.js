import { useEffect, useRef } from 'react';

const UI_RESIZE_PREFIX = 'fixer:ui-resize';
const DEFAULT_UI_RESIZE_CONSTRAINTS = Object.freeze({});
const EMPTY_UI_RESIZE_LEGACY_KEYS = Object.freeze([]);

const LEGACY_ALIASES = {
  'fixer:ui-resize:client-editor:notes': ['fixer:textarea:client:notes'],
  'fixer:ui-resize:set-editor:description': ['fixer:textarea:set:description'],
  'fixer:ui-resize:equipment-editor:description': ['fixer:textarea:equipment:description'],
  'fixer:ui-resize:equipment-editor:historyNotes': ['fixer:textarea:equipment:history_notes'],
  'fixer:ui-resize:equipment-editor:serviceNotes': ['fixer:textarea:equipment:service_notes'],
  'fixer:ui-resize:service-editor:faultDescription': ['fixer:textarea:service:fault_description'],
  'fixer:ui-resize:service-editor:intakeAccessories': ['fixer:textarea:service:intake_accessories'],
  'fixer:ui-resize:service-editor:intakeVisualNotes': ['fixer:textarea:service:intake_visual_notes'],
  'fixer:ui-resize:service-editor:externalNotes': ['fixer:textarea:service:external_notes'],
  'fixer:ui-resize:service-editor:internalNotes': ['fixer:textarea:service:internal_notes'],
  'fixer:ui-resize:project-editor:description': ['fixer:textarea:project:description'],
  'fixer:ui-resize:project-editor:notes': ['fixer:textarea:project:notes'],
  'fixer:ui-resize:document-designer:content': ['fixer:textarea:document-designer:content'],
  'fixer:ui-resize:rental-editor:itemsSection': ['fixer-rental-modal:items-section-height'],
  'fixer:ui-resize:document-designer:right-panel': ['fixer-document-designer-properties-width']
};

export function buildUiResizeStorageKey(windowKey, elementKey) {
  return `${UI_RESIZE_PREFIX}:${windowKey}:${elementKey}`;
}

function getViewportLimits() {
  if (typeof window === 'undefined') {
    return { maxHeight: 520, maxWidth: 960 };
  }
  return {
    maxHeight: Math.floor(window.innerHeight * 0.65),
    maxWidth: Math.floor(window.innerWidth * 0.9)
  };
}

export function normalizeUiResizeConstraints(constraints = {}) {
  const viewport = getViewportLimits();
  const requestedMaxHeight = constraints.maxHeight ?? viewport.maxHeight;
  const requestedMaxWidth = constraints.maxWidth ?? viewport.maxWidth;
  return {
    minHeight: constraints.minHeight ?? 64,
    maxHeight: Math.min(requestedMaxHeight, viewport.maxHeight),
    minWidth: constraints.minWidth ?? 120,
    maxWidth: Math.min(requestedMaxWidth, viewport.maxWidth),
    defaultHeight: constraints.defaultHeight,
    defaultWidth: constraints.defaultWidth
  };
}

export function clampUiResizeValue(value, min, max) {
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseStoredUiSize(raw) {
  if (raw == null || raw === '') return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      return { height: parsed };
    }
    if (parsed && typeof parsed === 'object') {
      return {
        ...(parsed.height != null ? { height: Number(parsed.height) } : {}),
        ...(parsed.width != null ? { width: Number(parsed.width) } : {})
      };
    }
  } catch {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return { height: numeric };
  }
  return null;
}

export function readPersistedUiSize(storageKey, constraints = {}, legacyKeys = []) {
  if (!storageKey) return null;
  const normalized = normalizeUiResizeConstraints(constraints);
  const keys = [storageKey, ...(LEGACY_ALIASES[storageKey] ?? []), ...legacyKeys];

  for (const key of keys) {
    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return null;
    }
    const parsed = parseStoredUiSize(raw);
    if (!parsed) continue;

    const result = {};
    if (parsed.height != null) {
      const height = clampUiResizeValue(parsed.height, normalized.minHeight, normalized.maxHeight);
      if (height != null) result.height = height;
    }
    if (parsed.width != null) {
      const width = clampUiResizeValue(parsed.width, normalized.minWidth, normalized.maxWidth);
      if (width != null) result.width = width;
    }
    if (Object.keys(result).length) return result;
  }

  return null;
}

export function writePersistedUiSize(storageKey, size) {
  if (!storageKey || !size || typeof size !== 'object') return;
  const payload = {};
  if (Number.isFinite(size.height)) payload.height = Math.round(size.height);
  if (Number.isFinite(size.width)) payload.width = Math.round(size.width);
  if (!Object.keys(payload).length) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    /* storage unavailable */
  }
}

export function usePersistentElementSize(storageKey, {
  constraints = DEFAULT_UI_RESIZE_CONSTRAINTS,
  legacyKeys = EMPTY_UI_RESIZE_LEGACY_KEYS,
  persistHeight = true,
  persistWidth = true
} = {}) {
  const ref = useRef(null);
  const constraintsRef = useRef(constraints);
  const lastSavedRef = useRef(null);

  useEffect(() => {
    constraintsRef.current = constraints;
  }, [constraints]);

  useEffect(() => {
    if (!storageKey) return undefined;
    const element = ref.current;
    if (!element) return undefined;

    const getConstraints = () => normalizeUiResizeConstraints(constraintsRef.current);
    const saved = readPersistedUiSize(storageKey, getConstraints(), legacyKeys);
    if (persistHeight && saved?.height != null) element.style.height = `${saved.height}px`;
    if (persistWidth && saved?.width != null) element.style.width = `${saved.width}px`;
    const normalizedSaved = {
      ...(persistHeight && saved?.height != null ? { height: saved.height } : {}),
      ...(persistWidth && saved?.width != null ? { width: saved.width } : {})
    };
    lastSavedRef.current = normalizedSaved;
    if (Object.keys(normalizedSaved).length) writePersistedUiSize(storageKey, normalizedSaved);

    let lastHeight = element.offsetHeight;
    let lastWidth = element.offsetWidth;

    const persistCurrentSize = () => {
      const node = ref.current;
      if (!node || !storageKey) return;
      const normalized = getConstraints();
      const next = {};
      const height = persistHeight ? clampUiResizeValue(node.offsetHeight, normalized.minHeight, normalized.maxHeight) : null;
      const width = persistWidth ? clampUiResizeValue(node.offsetWidth, normalized.minWidth, normalized.maxWidth) : null;
      if (height != null) next.height = height;
      if (width != null) next.width = width;
      if (!Object.keys(next).length) return;
      if (lastSavedRef.current?.height === next.height && lastSavedRef.current?.width === next.width) return;
      lastSavedRef.current = next;
      writePersistedUiSize(storageKey, next);
    };

    const syncSizeToViewport = () => {
      const node = ref.current;
      if (!node) return;
      const normalized = getConstraints();
      const next = {};
      if (persistHeight && lastSavedRef.current?.height != null) {
        const height = clampUiResizeValue(node.offsetHeight, normalized.minHeight, normalized.maxHeight);
        if (height != null) {
          node.style.height = `${height}px`;
          next.height = height;
        }
      }
      if (persistWidth && lastSavedRef.current?.width != null) {
        const width = clampUiResizeValue(node.offsetWidth, normalized.minWidth, normalized.maxWidth);
        if (width != null) {
          node.style.width = `${width}px`;
          next.width = width;
        }
      }
      if (!Object.keys(next).length) return;
      const unchanged = lastSavedRef.current?.height === next.height
        && lastSavedRef.current?.width === next.width;
      if (unchanged) return;
      lastSavedRef.current = next;
      writePersistedUiSize(storageKey, next);
    };

    const handleResizeEnd = () => {
      const node = ref.current;
      if (!node) return;
      const height = node.offsetHeight;
      const width = node.offsetWidth;
      if (height === lastHeight && width === lastWidth) return;
      lastHeight = height;
      lastWidth = width;
      persistCurrentSize();
    };

    const handleBeforeUnload = () => persistCurrentSize();

    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('pointerup', handleResizeEnd);
    window.addEventListener('resize', syncSizeToViewport);
    window.visualViewport?.addEventListener('resize', syncSizeToViewport);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('pointerup', handleResizeEnd);
      window.removeEventListener('resize', syncSizeToViewport);
      window.visualViewport?.removeEventListener('resize', syncSizeToViewport);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      persistCurrentSize();
    };
  }, [storageKey, legacyKeys, persistHeight, persistWidth]);

  return ref;
}
