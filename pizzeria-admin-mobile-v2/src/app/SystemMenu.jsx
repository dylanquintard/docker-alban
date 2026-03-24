export function SystemMenu({
  isOpen,
  notificationLabel,
  notificationsEnabled,
  onClose,
  onToggleNotifications,
  onLogout,
  pushActionPending,
  userLabel,
}) {
  if (!isOpen) return null;

  return (
    <div className="system-menu-shell" role="dialog" aria-modal="true">
      <button type="button" className="system-menu-backdrop" aria-label="Fermer le menu" onClick={onClose} />
      <div className="system-menu-card">
        <div className="system-menu-head">
          <p className="eyebrow">Systeme</p>
          <p className="system-menu-user">{userLabel}</p>
        </div>
        <button
          type="button"
          className="system-menu-item"
          onClick={onToggleNotifications}
          disabled={pushActionPending}
        >
          <span>Notifications</span>
          <strong>{pushActionPending ? "Activation..." : notificationLabel}</strong>
        </button>
        {notificationsEnabled ? (
          <p className="system-menu-hint">Les notifications pourront reouvrir directement la bonne app.</p>
        ) : null}
        <button type="button" className="system-menu-item system-menu-item-danger" onClick={onLogout}>
          <span>Session</span>
          <strong>Deconnecter</strong>
        </button>
        <button type="button" className="system-menu-item system-menu-item-muted" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
