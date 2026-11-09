import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { DisplayForm } from "@/components/admin/display-form";
import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { buttonClasses } from "@/components/ui/button";
import { getEventSettings } from "@/server/services/settings-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ekran ayarları" };

export default async function DisplayPage() {
  const settings = await getEventSettings();
  return (
    <>
      <PageHeader
        title="Ekran ayarları"
        description="65 inç ekranda ve paylaşılan linkte görünen metinler ve gösterge türü."
        actions={
          <a href="/" target="_blank" className={buttonClasses({ variant: "secondary" })}>
            <ArrowSquareOutIcon size={18} aria-hidden /> Canlı ekranı aç
          </a>
        }
      />
      <Panel className="max-w-3xl p-6">
        <DisplayForm settings={settings} />
      </Panel>
    </>
  );
}
