// Auth pages (login) don't use the dashboard chrome.
// The login experience is art-directed for the light warm-mesh treatment,
// so this scope pins the light design tokens even while the platform
// defaults to dark — see .theme-light-scope in globals.css.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-light-scope">{children}</div>;
}
