import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { usePersistentElementSize } from './uiResize.js';

export function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function AppButton({ className = '', type = 'button', variant = 'secondary', size = 'md', children, ...props }) {
  return <button type={type} className={joinClassNames('app-button', `app-button-${variant}`, `app-button-${size}`, className)} {...props}>{children}</button>;
}

export const AppInput = React.forwardRef(function AppInput({ className = '', ...props }, ref) {
  return <input ref={ref} className={joinClassNames('app-input', className)} {...props} />;
});

export function AppSelect({ className = '', children, ...props }) {
  return <select className={joinClassNames('app-input app-select', className)} {...props}>{children}</select>;
}

/**
 * AppTextarea — textarea with optional size persistence.
 *
 * Pass resizeKey="fixer:ui-resize:<windowKey>:<elementKey>" to save and restore
 * the user-dragged height across sessions via localStorage.
 */
export const AppTextarea = React.forwardRef(function AppTextarea({ className = '', resizeKey, resizeConstraints, ...props }, forwardedRef) {
  // Textareas may be resized vertically, but their width always belongs to the
  // surrounding layout. Persisting width leaves stale inline styles when a
  // panel is resized and can permanently squeeze the field.
  const resizeRef = usePersistentElementSize(resizeKey, {
    constraints: resizeConstraints,
    persistWidth: false
  });

  const setRefs = (node) => {
    resizeRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  return <textarea ref={setRefs} className={joinClassNames('app-input app-textarea', className)} {...props} />;
});

export function AppTabs({ className = '', children, ...props }) {
  return <div className={joinClassNames('app-tabs', className)} role="tablist" {...props}>{children}</div>;
}

export function AppTable({ className = '', children, ...props }) {
  return <table className={joinClassNames('app-table', className)} {...props}>{children}</table>;
}

export function AppBadge({ className = '', tone = 'neutral', children, ...props }) {
  return <span className={joinClassNames('app-badge', `app-badge-${tone}`, className)} {...props}>{children}</span>;
}

export function ColorSwatchPicker({ options = [], value, onChange, disabled = false, label = 'Kolor', className = '' }) {
  return <div className={joinClassNames('ds-color-picker', className)} role="radiogroup" aria-label={label}>
    {options.map((option) => {
      const optionValue = option.value ?? option.id ?? option.color ?? '';
      const selected = value === optionValue;
      return <button
        key={`${option.id ?? option.label}:${optionValue}`}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={option.label}
        title={option.label}
        disabled={disabled}
        className={joinClassNames('ds-color-swatch', !option.color ? 'is-default' : '', selected ? 'is-selected' : '')}
        style={option.color ? { backgroundColor: option.color } : undefined}
        onClick={() => onChange?.(optionValue)}
      />;
    })}
  </div>;
}

const SAVE_STATE_LABELS = {
  saving: 'Zapisywanie…',
  saved: 'Zapisano',
  error: 'Błąd zapisu'
};

export function SaveStatusIndicator({ status = 'idle', className = '' }) {
  const label = SAVE_STATE_LABELS[status] ?? '';
  return <span
    className={joinClassNames('ds-save-status', label ? `is-${status}` : 'is-idle', className)}
    role={status === 'error' ? 'alert' : 'status'}
    aria-live={status === 'error' ? 'assertive' : 'polite'}
    aria-atomic="true"
  >{label}</span>;
}

export function AppSection({ className = '', title, actions = null, children }) {
  return <section className={joinClassNames('app-section', className)}>
    {(title || actions) && <div className="app-section-header">
      {title && <div className="app-section-title">{title}</div>}
      {actions && <div className="app-section-actions">{actions}</div>}
    </div>}
    {children}
  </section>;
}

export function AppToolbar({ className = '', children, ...props }) {
  return <div className={joinClassNames('app-toolbar', className)} {...props}>{children}</div>;
}

const MODAL_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function ModalSurface({ variant, className = '', eyebrow, title, description, onClose, footer, children }) {
  const dialogRef = useRef(null);
  const contentRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const modalPrefix = variant === 'app' ? 'app' : 'ds';
  const modalClass = variant === 'app' ? 'app-modal' : 'ds-modal-frame';

  useEffect(() => {
    const previousFocus = document.activeElement;
    const initialFocus = contentRef.current?.querySelector(MODAL_FOCUSABLE_SELECTOR)
      ?? dialogRef.current?.querySelector(MODAL_FOCUSABLE_SELECTOR);
    initialFocus?.focus({ preventScroll: true });
    return () => {
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll(MODAL_FOCUSABLE_SELECTOR) ?? [])
      .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div className="modal-backdrop">
    <div
      ref={dialogRef}
      className={joinClassNames(modalClass, className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      aria-label={!title ? eyebrow || 'Okno dialogowe' : undefined}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className={`${modalPrefix}-modal-header`}>
        <div>
          {eyebrow && <p className={`${modalPrefix}-eyebrow`}>{eyebrow}</p>}
          {title && <h2 id={titleId}>{title}</h2>}
          {description && <p id={descriptionId} className={`${modalPrefix}-muted`}>{description}</p>}
        </div>
        {onClose && <ModalCloseButton onClick={onClose} />}
      </div>
      <div ref={contentRef} className={`${modalPrefix}-modal-content`}>{children}</div>
      {footer && <div className={`${modalPrefix}-modal-footer`}>{footer}</div>}
    </div>
  </div>;
}

export function AppModal(props) {
  return <ModalSurface variant="app" {...props} />;
}

export function ButtonPrimary({ className = '', type = 'button', children, ...props }) {
  return <AppButton type={type} variant="primary" className={className} {...props}>{children}</AppButton>;
}

export function ButtonSecondary({ className = '', type = 'button', children, ...props }) {
  return <AppButton type={type} variant="secondary" className={className} {...props}>{children}</AppButton>;
}

export function ButtonDanger({ className = '', type = 'button', children, ...props }) {
  return <AppButton type={type} variant="danger" className={className} {...props}>{children}</AppButton>;
}

export function ButtonGhost({ className = '', type = 'button', children, ...props }) {
  return <AppButton type={type} variant="ghost" size="sm" className={className} {...props}>{children}</AppButton>;
}

export function IconButton({ className = '', type = 'button', label, children, ...props }) {
  return <button type={type} className={joinClassNames('ds-icon-button', className)} aria-label={label} title={label} {...props}>{children}</button>;
}

export function ModalCloseButton({ className = '', type = 'button', label = 'Zamknij', onClick }) {
  return <button type={type} className={joinClassNames('ds-modal-close-button', className)} onClick={onClick} aria-label={label} title={label}>
    <X size={16} aria-hidden="true" />
  </button>;
}

export function SectionPanel({ className = '', title, actions = null, children }) {
  return <AppSection className={className} title={title} actions={actions}>{children}</AppSection>;
}

export function ModalFrame(props) {
  return <ModalSurface variant="ds" {...props} />;
}

export function FormField({ className = '', label, error, hint, required = false, children }) {
  return <label className={joinClassNames('app-form-field ds-form-field', error ? 'has-error' : '', className)}>
    <span>{label}{required ? ' *' : ''}</span>
    {children}
    {error ? <small className="ds-error-message">{error}</small> : hint ? <small className="ds-field-hint">{hint}</small> : null}
  </label>;
}

const SYSTEM_STATUS_LABELS = {
  active: 'Aktywne',
  partially_returned: 'Częściowo zwrócone',
  returned: 'Zwrócone',
  issued: 'Wydany',
  damaged: 'Uszkodzony',
  lost: 'Zagubiony',
  service_required: 'Wymaga serwisu',
  available: 'Dostępny',
  unavailable: 'Niedostępny',
  pending: 'Oczekuje',
  completed: 'Zakończone',
  complete: 'Zakończone',
  cancelled: 'Anulowane',
  canceled: 'Anulowane'
};

export function formatStatusLabel(value) {
  const text = String(value ?? '');
  const key = text.trim().toLowerCase();
  return SYSTEM_STATUS_LABELS[key] ?? text;
}

export function StatusPill({ value, label, tone = 'auto', color = '', className = '' }) {
  const text = label ?? formatStatusLabel(value);
  const lower = text.toLowerCase();
  const resolvedTone = tone === 'auto'
    ? lower.includes('przetermin') || lower.includes('po terminie') || lower.includes('problematyczny') || lower.includes('zablokowany') || lower.includes('zagub') || lower.includes('uszk') ? 'danger'
      : lower.includes('zwró') || lower.includes('zwro') || lower.includes('dostęp') || lower.includes('dostep') || lower.includes('sprawny') || lower.includes('gotowe') || lower.includes('vip') || lower.includes('stały') || lower.includes('staly') ? 'success'
      : lower.includes('serwis') || lower.includes('kontrol') || lower.includes('brak akces') || lower.includes('rezerwacja') || lower.includes('pracownik') || lower.includes('nowy') ? 'warning'
      : lower.includes('aktywn') || lower.includes('wypo') || lower.includes('wydania') || lower.includes('wydany') ? 'info'
      : 'neutral'
    : tone;
  const customColor = /^#[0-9a-f]{6}$/i.test(String(color ?? '')) ? color : '';
  return <AppBadge
    tone={customColor ? 'neutral' : resolvedTone}
    className={joinClassNames('ds-status-pill', customColor ? 'has-custom-color' : `tone-${resolvedTone}`, className)}
    style={customColor ? { '--ds-status-color': customColor } : undefined}
  >{text}</AppBadge>;
}

export function EmptyState({ className = '', title, description, action = null }) {
  return <div className={joinClassNames('ds-empty-state', className)}>
    {title && <strong>{title}</strong>}
    {description && <p>{description}</p>}
    {action}
  </div>;
}

export function AppNotice({ variant = 'info', className = '', children }) {
  return <div className={joinClassNames('app-notice', `app-notice-${variant}`, className)} role="alert">{children}</div>;
}
