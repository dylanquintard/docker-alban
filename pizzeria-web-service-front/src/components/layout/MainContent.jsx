export default function MainContent({ children }) {
  return <main className="min-h-screen" style={{ paddingTop: "var(--app-header-offset, 112px)" }}>{children}</main>;
}
