import { Link, NavLink } from "react-router-dom";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NetworkSelect } from "@/components/wallet/network-select";
import { VersionSwitch } from "@/components/wallet/version-switch";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Accueil", end: true },
  { to: "/admin", label: "Admin" },
  { to: "/verify", label: "Vérifier" },
  { to: "/audit", label: "Audit" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="page-shell flex h-16 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-7">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-[0_0_20px_-6px_hsl(var(--primary)/0.8)]">
              <ShieldCheck className="h-4 w-4" strokeWidth={2.6} />
            </span>
            <span className="font-display text-[17px] font-bold tracking-tight">Certify</span>
            <Badge variant="outline" className="hidden font-mono text-[10px] lg:inline-flex">
              on-chain
            </Badge>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <VersionSwitch className="hidden sm:flex" />
          <NetworkSelect />
          <ConnectButton />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
          isActive
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )
      }
    >
      {label}
    </NavLink>
  );
}

function MobileNav() {
  return (
    <div className="flex items-center md:hidden">
      <Button
        variant="outline"
        size="icon"
        aria-label="Menu"
        onClick={() => {
          const menu = document.getElementById("mobile-nav");
          menu?.classList.toggle("hidden");
        }}
      >
        <span className="flex flex-col gap-1">
          <span className="h-px w-4 bg-foreground" />
          <span className="h-px w-4 bg-foreground" />
          <span className="h-px w-4 bg-foreground" />
        </span>
      </Button>
      <div
        id="mobile-nav"
        className="absolute left-0 right-0 top-16 hidden border-b border-border bg-card p-4 shadow-xl"
      >
        <div className="page-shell flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Check className="h-3.5 w-3.5 text-primary" />
              {item.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-border pt-3">
            <VersionSwitch className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
