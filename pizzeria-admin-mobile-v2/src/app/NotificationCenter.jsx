export function NotificationCenter({ pushState, sessionState }) {
  return (
    <section className="notification-dock">
      <p className="eyebrow">Centre de notifications</p>
      <p>
        Session : <strong>{sessionState === "authenticated" ? "admin connecte" : sessionState}</strong>
      </p>
      <p>
        Push : <strong>{pushState}</strong>
      </p>
    </section>
  );
}
