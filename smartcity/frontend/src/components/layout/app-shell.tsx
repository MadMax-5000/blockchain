import { NavLink, Outlet } from "react-router-dom";
import {
  ClipboardList,
  FilePlus2,
  FileSpreadsheet,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NetworkSelect } from "@/components/wallet/network-select";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Vue d'ensemble", short: "Accueil", icon: LayoutDashboard, end: true },
  { to: "/report", label: "Nouveau signalement", short: "Signaler", icon: FilePlus2 },
  { to: "/issues", label: "Signalements", short: "Liste", icon: ClipboardList },
  { to: "/admin", label: "Espace municipal", short: "Agent", icon: ShieldCheck },
  { to: "/admin/import", label: "Import Excel", short: "Import", icon: FileSpreadsheet },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-14 flex-col border-r border-border bg-background md:flex">
        <NavLink
          to="/"
          aria-label="CityTrace — accueil"
          title="CityTrace"
          className="grid h-14 place-items-center border-b border-border text-[13px] font-bold tracking-tight text-foreground"
        >
          CT
        </NavLink>
        <nav className="mt-4 flex flex-col gap-1" aria-label="Navigation principale">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "grid h-11 place-items-center border-l text-muted-foreground transition-colors hover:text-foreground",
                  isActive ? "border-primary text-foreground" : "border-transparent",
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="md:pl-14">
        <header className="sticky top-0 z-30 h-12 border-b border-border bg-background">
          <div className="page-shell flex h-full items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded bg-foreground text-[11px] font-bold text-background md:hidden">
                CT
              </span>
              <span className="text-[13px] font-semibold">CityTrace</span>
              <span className="hidden text-[13px] text-muted-foreground sm:inline">
                / registre municipal
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <NetworkSelect />
              <ConnectButton />
            </div>
          </div>
        </header>

        <main className="pb-24 md:pb-12">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-border bg-background md:hidden"
        aria-label="Navigation mobile"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 text-[13px]",
                isActive ? "text-foreground" : "text-muted-foreground",
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
            {item.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
