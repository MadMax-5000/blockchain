import { Link } from "react-router-dom";
import { Github, ShieldCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="page-shell py-10">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="max-w-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.6} />
              </span>
              <span className="font-display text-[15px] font-bold tracking-tight">Certify</span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Certificats académiques vérifiables, émis on-chain. Devoir 1 (registre custom) et
              Devoir 2 (ERC-721 + audit de sécurité).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[13px] sm:grid-cols-3">
            <FooterColumn
              title="Produit"
              links={[
                { to: "/admin", label: "Émission" },
                { to: "/verify", label: "Vérification" },
                { to: "/audit", label: "Audit" },
              ]}
            />
            <FooterColumn
              title="Contrats"
              links={[
                { to: "/admin", label: "v1 · Registre" },
                { to: "/admin", label: "v2 · ERC-721" },
                { to: "/verify", label: "Explorateur" },
              ]}
            />
            <FooterColumn
              title="Ressources"
              links={[
                { to: "/audit", label: "Checklist" },
                { to: "/verify", label: "Vérifier un ID" },
              ]}
            />
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-start justify-between gap-3 text-[12px] text-muted-foreground sm:flex-row sm:items-center">
          <p>Hardhat · Solidity 0.8.24 · React · wagmi/viem · OpenZeppelin</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Réseau local / Sepolia
            </span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
              Dépôt
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <p className="label-mono">{title}</p>
      <ul className="space-y-1.5">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <Link to={link.to} className="text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
