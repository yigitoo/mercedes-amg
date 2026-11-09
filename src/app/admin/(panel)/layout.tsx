import { AdminShell } from "@/components/admin/admin-shell";
import { storageKind } from "@/server/env";

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell storage={storageKind}>{children}</AdminShell>;
}
