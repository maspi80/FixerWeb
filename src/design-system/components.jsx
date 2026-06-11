import React from 'react';

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

export function AppTextarea({ className = '', ...props }) {
  return <textarea className={joinClassNames('app-input app-textarea', className)} {...props} />;
}

export function AppTabs({ className = '', children, ...props }) {
  return <div className={joinClassNames('app-tabs', className)} role="tablist" {...props}>{children}</div>;
}

export function AppTable({ className = '', children, ...props }) {
  return <table className={joinClassNames('app-table', className)} {...props}>{children}</table>;
}

export function AppBadge({ className = '', tone = 'neutral', children, ...props }) {
  return <span className={joinClassNames('app-badge', `app-badge-${tone}`, className)} {...props}>{children}</span>;
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

export function AppModal({ className = '', eyebrow, title, description, onClose, footer, children }) {
  return <div className="modal-backdrop">
    <div className={joinClassNames('app-modal', className)}>
      <div className="app-modal-header">
        <div>
          {eyebrow && <p className="app-eyebrow">{eyebrow}</p>}
          {title && <h2>{title}</h2>}
          {description && <p className="app-muted">{description}</p>}
        </div>
        {onClose && <IconButton label="Zamknij" onClick={onClose}>×</IconButton>}
      </div>
      <div className="app-modal-content">{children}</div>
      {footer && <div className="app-modal-footer">{footer}</div>}
    </div>
  </div>;
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

export function SectionPanel({ className = '', title, actions = null, children }) {
  return <AppSection className={className} title={title} actions={actions}>{children}</AppSection>;
}

export function ModalFrame({ className = '', eyebrow, title, description, onClose, footer, children }) {
  return <div className="modal-backdrop">
    <div className={joinClassNames('ds-modal-frame', className)}>
      <div className="ds-modal-header">
        <div>
          {eyebrow && <p className="ds-eyebrow">{eyebrow}</p>}
          {title && <h2>{title}</h2>}
          {description && <p className="ds-muted">{description}</p>}
        </div>
        {onClose && <IconButton label="Zamknij" onClick={onClose}>×</IconButton>}
      </div>
      <div className="ds-modal-content">{children}</div>
      {footer && <div className="ds-modal-footer">{footer}</div>}
    </div>
  </div>;
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

function formatSystemStatusLabel(value) {
  const text = String(value ?? '');
  const key = text.trim().toLowerCase();
  return SYSTEM_STATUS_LABELS[key] ?? text;
}

export function StatusPill({ value, tone = 'auto', className = '' }) {
  const text = formatSystemStatusLabel(value);
  const lower = text.toLowerCase();
  const resolvedTone = tone === 'auto'
    ? lower.includes('przetermin') || lower.includes('po terminie') || lower.includes('problematyczny') || lower.includes('zablokowany') || lower.includes('zagub') || lower.includes('uszk') ? 'danger'
      : lower.includes('zwró') || lower.includes('zwro') || lower.includes('dostęp') || lower.includes('dostep') || lower.includes('sprawny') || lower.includes('gotowe') || lower.includes('vip') || lower.includes('stały') || lower.includes('staly') ? 'success'
      : lower.includes('serwis') || lower.includes('kontrol') || lower.includes('brak akces') || lower.includes('rezerwacja') || lower.includes('pracownik') || lower.includes('nowy') ? 'warning'
      : lower.includes('aktywn') || lower.includes('wypo') || lower.includes('wydania') || lower.includes('wydany') ? 'info'
      : 'neutral'
    : tone;
  return <AppBadge tone={resolvedTone} className={joinClassNames('ds-status-pill', `tone-${resolvedTone}`, className)}>{text}</AppBadge>;
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
