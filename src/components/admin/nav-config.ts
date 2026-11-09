import {
  ChartLineIcon,
  ClockCounterClockwiseIcon,
  GaugeIcon,
  ListChecksIcon,
  type Icon,
  MonitorIcon,
  SquaresFourIcon,
  SteeringWheelIcon,
} from "@phosphor-icons/react";

/** Admin navigasyonunun tek kaynağı: masaüstü sidebar ve mobil alt sekme çubuğu buradan okur. */
export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Mobil alt çubukta doğrudan sekme mi (yoksa "Diğer" menüsünde mi). */
  primary: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operasyon",
    items: [
      { href: "/admin", label: "Genel bakış", icon: SquaresFourIcon, primary: true },
      { href: "/admin/drivers", label: "Sürücüler", icon: SteeringWheelIcon, primary: true },
      { href: "/admin/vehicles", label: "Araçlar", icon: GaugeIcon, primary: false },
      { href: "/admin/boardings", label: "Biniş kayıtları", icon: ListChecksIcon, primary: true },
    ],
  },
  {
    label: "Analiz",
    items: [
      { href: "/admin/reports", label: "Raporlar", icon: ChartLineIcon, primary: true },
      { href: "/admin/activity", label: "Kayıtlar", icon: ClockCounterClockwiseIcon, primary: false },
    ],
  },
  {
    label: "Canlı ekran",
    items: [{ href: "/admin/display", label: "Ekran ayarları", icon: MonitorIcon, primary: false }],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** Ana sayfa yalnız tam eşleşmede, diğerleri alt yollarda da etkin sayılır. */
export const isActive = (href: string, pathname: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
