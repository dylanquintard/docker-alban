export function SystemMenu({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="system-menu-shell" role="dialog" aria-modal="true">
      <button type="button" className="system-menu-backdrop" aria-label="Fermer le menu" onClick={onClose} />
      <div className="system-menu-card">
        <p className="eyebrow">Systeme</p>
        <button type="button" className="system-menu-item" onClick={onClose}>
          Notifications
        </button>
        <button type="button" className="system-menu-item" onClick={onClose}>
          Session
        </button>
        <button type="button" className="system-menu-item system-menu-item-muted" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
