export function ActionIconButton({
  onClick,
  label,
  variant = "default",
  disabled = false,
  className = "",
  children,
  type = "button",
}) {
  const isDanger = variant === "danger";
  const variantClass =
    variant === "success"
      ? "text-emerald-300 hover:text-emerald-200"
      : isDanger
        ? "text-red-500 hover:text-red-400"
        : "text-stone-100 hover:text-white";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`admin-icon-button inline-flex h-8 w-8 items-center justify-center rounded-none border-none bg-transparent p-0 transition hover:bg-transparent ${variantClass} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function EditIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

export function DeleteIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.6">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function StatusToggle({ checked, onChange, labelOn, labelOff, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      title={checked ? labelOn : labelOff}
      aria-label={checked ? labelOn : labelOff}
      className={`admin-toggle-button inline-flex h-6 w-11 items-center rounded-full border p-0 transition ${
        checked
          ? "border-stone-200 bg-white hover:bg-stone-100"
          : "border-stone-400 bg-stone-500 hover:bg-stone-400"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full shadow-sm transition-transform ${
          checked ? "translate-x-6 bg-stone-400" : "translate-x-1 bg-white"
        }`}
      />
    </button>
  );
}
