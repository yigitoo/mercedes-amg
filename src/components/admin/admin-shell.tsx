"use client";

import { ArrowSquareOutIcon, DotsThreeOutlineIcon, ListMagnifyingGlassIcon, SignOutIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { logout } from "@/app/admin/actions";
import { AmgLogo, MercedesBenzLockup } from "@/components/brand/logos";
import { cn } from "@/lib/cn";
import { ExportButton } from "./export-dialog";
import { isActive, NAV_GROUPS, NAV_ITEMS, type NavItem } from "./nav-config";

interface AdminShellProps {
  storage: "mongodb" | "memory";
  children: ReactNode;
}

/**
 * Admin iskeleti. Masaüstü (lg+): sabit sol sidebar. Mobil: üstte marka şeridi, altta yüzen sekme çubuğu
 * (4 ana sekme + "Diğer"). İçerik alt çubuğun altında kalmasın diye mobilde alt boşluk bırakılır.
 */
export function AdminShell({ storage, children }: AdminShellProps) {
  const pathname = usePathname();
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[18.5rem_1fr]">
      <Sidebar pathname={pathname} storage={storage} />

      <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-ink/90 px-4 backdrop-blur lg:hidden">
        <MercedesBenzLockup className="text-sm" />
        <AmgLogo className="h-3 w-auto" />
      </header>

      <main className="min-w-0 px-4 pt-6 pb-32 sm:px-8 lg:px-10 lg:pt-10 lg:pb-16">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <TabBar pathname={pathname} />
    </div>
  );
}

function Sidebar({ pathname, storage }: { pathname: string; storage: AdminShellProps["storage"] }) {
  return (
    // Yüzen panel: kenarlardan boşluklu, kendi içinde kayar.
    <aside className="no-print sticky top-3 m-3 mr-0 hidden h-[calc(100dvh-1.5rem)] flex-col rounded-sm border border-line bg-surface shadow-2xl shadow-black/40 lg:flex">
      <div className="px-6 pt-7 pb-6">
        <MercedesBenzLockup className="text-base" />
        <div className="mt-5 border-t border-line pt-5">
          <AmgLogo className="h-3.5 w-auto" />
          <p className="mt-3 font-title text-lg leading-none font-bold whitespace-nowrap">Etkinlik paneli</p>
        </div>
      </div>

      <nav aria-label="Panel" className="flex-1 overflow-y-auto px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="px-3 pb-2 font-label text-[0.68rem] tracking-[0.16em] text-dim uppercase">{group.label}</p>
            <ul className="grid gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} active={isActive(item.href, pathname)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Link
          href="/"
          target="_blank"
          className="mx-0 flex h-10 items-center gap-3 rounded-sm px-3 text-sm text-soft transition-colors hover:bg-raised hover:text-fg"
        >
          <ArrowSquareOutIcon size={18} aria-hidden />
          Canlı ekranı aç
        </Link>
      </nav>

      <div className="border-t border-line px-3 pt-3">
        <SidebarLink item={{ href: "/admin/logs", label: "Tüm loglar", icon: ListMagnifyingGlassIcon, primary: false }} active={isActive("/admin/logs", pathname)} />
        <ExportButton size="sm" className="mt-2 w-full" />
      </div>

      <div className="mt-3 border-t border-line px-6 py-5">
        <StorageBadge storage={storage} />
        <form action={logout} className="mt-4">
          <button type="submit" className="flex cursor-pointer items-center gap-2 text-sm text-muted transition-colors hover:text-fg">
            <SignOutIcon size={16} aria-hidden /> Çıkış yap
          </button>
        </form>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-colors",
        active ? "bg-raised font-bold text-fg" : "text-soft hover:bg-raised/60 hover:text-fg",
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-[3px] bg-amg" aria-hidden />}
      <Icon size={18} weight={active ? "fill" : "regular"} aria-hidden />
      {item.label}
    </Link>
  );
}

function StorageBadge({ storage }: { storage: AdminShellProps["storage"] }) {
  const persistent = storage === "mongodb";
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", persistent ? "bg-fg" : "bg-amg")} aria-hidden />
      <div>
        <p className="text-sm font-bold">{persistent ? "Veritabanı bağlı" : "Bellek modu"}</p>
        <p className="text-xs text-muted">{persistent ? "Her değişiklik MongoDB'ye kaydediliyor." : "MONGODB_URI yok, veriler kalıcı değil."}</p>
      </div>
    </div>
  );
}

/** Mobil: ekranın altında yüzen sekme çubuğu. "Diğer" ikincil sayfaları ve çıkışı açar. */
function TabBar({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);
  const secondaryActive = secondary.some((i) => isActive(i.href, pathname)) || isActive("/admin/logs", pathname);

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      {moreOpen && (
        <div className="mb-2 rounded-sm border border-line-strong bg-raised/95 p-2 shadow-2xl shadow-black/60 backdrop-blur" role="menu">
          {secondary.map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" onClick={() => setMoreOpen(false)} className="flex h-11 items-center gap-3 rounded-sm px-3 text-sm hover:bg-line">
              <item.icon size={18} aria-hidden /> {item.label}
            </Link>
          ))}
          <Link href="/admin/logs" role="menuitem" onClick={() => setMoreOpen(false)} className="flex h-11 items-center gap-3 rounded-sm px-3 text-sm hover:bg-line">
            <ListMagnifyingGlassIcon size={18} aria-hidden /> Tüm loglar
          </Link>
          <Link href="/" target="_blank" role="menuitem" onClick={() => setMoreOpen(false)} className="flex h-11 items-center gap-3 rounded-sm px-3 text-sm hover:bg-line">
            <ArrowSquareOutIcon size={18} aria-hidden /> Canlı ekranı aç
          </Link>
          <form action={logout}>
            <button type="submit" role="menuitem" className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-sm px-3 text-sm text-muted hover:bg-line">
              <SignOutIcon size={18} aria-hidden /> Çıkış yap
            </button>
          </form>
        </div>
      )}
      <nav aria-label="Panel" className="grid grid-cols-5 rounded-sm border border-line-strong bg-raised/95 p-1 shadow-2xl shadow-black/60 backdrop-blur">
        {primary.map((item) => (
          <TabLink key={item.href} label={item.label} icon={item.icon} href={item.href} active={isActive(item.href, pathname)} onNavigate={() => setMoreOpen(false)} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className={cn("flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm text-[0.68rem]", secondaryActive || moreOpen ? "bg-line text-fg" : "text-muted")}
        >
          <DotsThreeOutlineIcon size={20} weight={secondaryActive ? "fill" : "regular"} aria-hidden />
          Diğer
        </button>
      </nav>
    </div>
  );
}

function TabLink({ href, label, icon: Icon, active, onNavigate }: Pick<NavItem, "href" | "label" | "icon"> & { active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("relative flex h-14 flex-col items-center justify-center gap-1 rounded-sm text-[0.68rem]", active ? "bg-line text-fg" : "text-muted")}
    >
      {active && <span className="absolute inset-x-4 top-0 h-[2px] bg-amg" aria-hidden />}
      <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
      <span className="max-w-full truncate px-1">{label}</span>
    </Link>
  );
}
