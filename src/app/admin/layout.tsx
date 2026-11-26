import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ADMIN PANEL SEP — SMA Progresif",
  description: "Panel Admin Monitoring Ekstrakurikuler & Bisyaroh SEP",
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Admin SEP",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
