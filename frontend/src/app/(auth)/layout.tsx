// Auth pages (login) don't use the dashboard chrome.
// The login experience is art-directed as a dark control-room entry —
// it renders with explicit colors, independent of the console theme.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
