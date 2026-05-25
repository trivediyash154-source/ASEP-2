import type { Metadata } from "next";
import { TopBar } from "@/components/shared/layout/TopBar";
import { AdminView } from "@/components/admin/AdminView";

export const metadata: Metadata = { title: "Users & Roles" };

export default function AdminPage() {
  return (
    <>
      <TopBar title="Users & Roles" subtitle="User management · Role-based access control · Audit log" />
      <AdminView />
    </>
  );
}
