// Auth pages (login) don't use the dashboard chrome
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
