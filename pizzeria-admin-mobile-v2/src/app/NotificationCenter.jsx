export function NotificationCenter({ activeAppId, pushState, sessionState }) {
  return (
    <section className="notification-dock">
      <p className="eyebrow">Centre de notifications</p>
      <p>
        {activeAppId === "launcher"
          ? "Pret a recevoir des notifications et a ouvrir la bonne app."
          : "Les notifications pourront revenir directement sur cette app via deep link."}
      </p>
      <p>
        Session : <strong>{sessionState === "authenticated" ? "admin connecte" : sessionState}</strong>
      </p>
      <p>
        Push : <strong>{pushState}</strong>
      </p>
    </section>
  );
}
