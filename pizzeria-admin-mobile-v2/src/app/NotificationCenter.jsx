export function NotificationCenter({ activeAppId }) {
  return (
    <section className="notification-dock">
      <p className="eyebrow">Centre de notifications</p>
      <p>
        {activeAppId === "launcher"
          ? "Pret a recevoir des notifications et a ouvrir la bonne app."
          : "Les notifications pourront revenir directement sur cette app via deep link."}
      </p>
    </section>
  );
}
