import type * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Database,
  FileSpreadsheet,
  Fingerprint,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AddressDisplay } from "@/components/common/address-display";
import { getChainMeta } from "@/lib/chains";
import { formatNumber } from "@/lib/format";
import { VERSION_META } from "@/lib/contracts";
import { useDeployment } from "@/hooks/use-deployment";
import { useNetwork } from "@/hooks/use-network";
import { useTotals } from "@/hooks/use-totals";
import { cn } from "@/lib/utils";

export function HomePage() {
  const { chainId } = useNetwork();
  const deployment = useDeployment();
  const totals = useTotals();
  const chain = getChainMeta(chainId);
  const total = Number((totals.data?.v1 ?? 0n) + (totals.data?.v2 ?? 0n));

  return (
    <div className="relative overflow-hidden">
      <div className="hero-glow" aria-hidden />

      <section className="page-shell pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground animate-fade-up">
            <Sparkles className="h-3 w-3 text-primary" />
            Devoir 2 · ERC-721, AccessControl et audit de sécurité
          </div>

          <h1 className="text-balance font-display text-4xl leading-[1.05] tracking-[-0.03em] sm:text-6xl animate-fade-up">
            Des certificats académiques
            <span className="block text-muted-foreground">vérifiables, émis on-chain.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-balance text-[15px] leading-relaxed text-muted-foreground animate-fade-up">
            Émettez un diplôme à l'unité ou importez un fichier Excel, puis laissez chacun vérifier
            l'authenticité d'un certificat sans dépendre d'une base de données centrale.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/admin">
                Émettre un certificat
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/verify">
                <ScanSearch className="h-4 w-4" />
                Vérifier un certificat
              </Link>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-muted-foreground animate-fade-up">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
              Métadonnées on-chain
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
              Import Excel (SheetJS)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-primary" />
              Rôles MINTER / ADMIN
            </span>
          </div>
        </div>
      </section>

      <section className="page-shell mt-16">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Certificats émis"
            value={totals.isLoading ? "…" : formatNumber(total)}
            hint={`${formatNumber(totals.data?.v1 ?? 0n)} v1 · ${formatNumber(totals.data?.v2 ?? 0n)} v2`}
            icon={BadgeCheck}
          />
          <StatCard
            label="Réseau actif"
            value={chain.short}
            hint={`chainId ${chain.id}`}
            icon={Database}
          />
          <StatCard
            label="Contrats"
            value={deployment.hasDeployment ? "2 déployés" : "Non déployés"}
            hint={deployment.hasDeployment ? "Registre + ERC-721" : "Lancez npm run deploy:local"}
            icon={ShieldCheck}
          />
        </div>
      </section>

      <section className="page-shell mt-6">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="label-mono">Contrats déployés</span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {chain.name}
                </Badge>
              </div>
              {deployment.base ? (
                <span className="font-mono text-[11px] text-muted-foreground">
                  déployé le {new Date(deployment.base.deployedAt).toLocaleDateString("fr-FR")}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ContractRow
                version="v1"
                address={deployment.registry}
                count={totals.data?.v1}
                tone="muted"
              />
              <ContractRow
                version="v2"
                address={deployment.nft}
                count={totals.data?.v2}
                tone="accent"
              />
            </div>

            {!deployment.hasDeployment ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12.5px] text-amber-200">
                Aucun déploiement détecté sur ce réseau. Démarrez{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">npm run node</code>{" "}
                puis{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">npm run deploy:local</code>.
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="page-shell mt-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="label-mono">Deux versions, une même vérité</span>
          <h2 className="mt-3 text-balance text-3xl tracking-[-0.02em] sm:text-4xl">
            Du registre custom au standard ERC-721.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
            Le Devoir 1 pose le registre et le parcours complet. Le Devoir 2 le refactore en NFT
            interopérable, avec rôles OpenZeppelin et métadonnées générées dans le contrat.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <VersionCard
            version="v1"
            icon={Database}
            points={[
              "Struct Certificate stockée on-chain",
              "Owner + mapping d'admins",
              "Batch de 50 certificats maximum",
              "Révocation par flag, sans suppression",
            ]}
          />
          <VersionCard
            version="v2"
            icon={Fingerprint}
            points={[
              "ERC721URIStorage + AccessControl",
              "tokenURI JSON généré en base64",
              "MINTER_ROLE et DEFAULT_ADMIN_ROLE",
              "Soulbound, pausable, nonReentrant",
            ]}
            highlighted
          />
        </div>
      </section>

      <section className="page-shell mt-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <span className="label-mono">Parcours</span>
            <h2 className="mt-3 text-3xl tracking-[-0.02em]">Trois étapes, zéro base centrale.</h2>
            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
              Le fichier Excel est validé côté client avant toute transaction : colonnes, dates ISO,
              adresses, doublons dans le fichier et doublons déjà enregistrés on-chain.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <a href="/etudiants.xlsx" download>
                <FileSpreadsheet className="h-4 w-4" />
                Télécharger etudiants.xlsx
              </a>
            </Button>
          </div>

          <div className="space-y-3">
            <Step
              index="01"
              title="Importer ou saisir"
              description="Formulaire unitaire ou fichier .xlsx/.csv. Chaque ligne est validée et prévisualisée."
              icon={FileSpreadsheet}
            />
            <Step
              index="02"
              title="Émettre en lot"
              description="Une transaction batch ou des lots séquentiels de 5 à 15 certificats, avec hash par lot."
              icon={ShieldCheck}
            />
            <Step
              index="03"
              title="Vérifier publiquement"
              description="Recherche par certId ou studentId, statut valide/révoqué, tokenURI et QR code."
              icon={ScanSearch}
            />
          </div>
        </div>
      </section>

      <section className="page-shell mt-20">
        <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card p-8 sm:p-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-[11px] text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Audit & sécurité
              </div>
              <h2 className="mt-3 text-2xl tracking-[-0.02em] sm:text-3xl">
                Une checklist d'audit, pas une promesse.
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
                Contrôle d'accès, reentrancy, validation des entrées, double mint, révocation,
                tests automatisés et risques résiduels documentés.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link to="/audit">
                Lire la checklist
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="group transition-colors hover:border-border">
      <CardContent className="flex items-start justify-between p-5 sm:p-6">
        <div>
          <p className="label-mono">{label}</p>
          <p className="mt-2 font-display text-2xl tracking-tight">{value}</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-border/70 bg-secondary/50 text-muted-foreground transition-colors group-hover:text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function ContractRow({
  version,
  address,
  count,
  tone,
}: {
  version: "v1" | "v2";
  address?: string;
  count?: bigint;
  tone: "muted" | "accent";
}) {
  const meta = VERSION_META[version];
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-4 py-3.5",
        tone === "accent" ? "border-primary/20 bg-primary/[0.03]" : "border-border/70 bg-background/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              tone === "accent" ? "bg-primary" : "bg-muted-foreground/60",
            )}
          />
          <span className="text-[13px] font-medium">{meta.contract}</span>
          <Badge variant={tone === "accent" ? "default" : "muted"} className="font-mono text-[9.5px]">
            {meta.short}
          </Badge>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {count === undefined ? "—" : `${formatNumber(count)} cert.`}
        </span>
      </div>
      {address ? (
        <AddressDisplay address={address} chars={6} />
      ) : (
        <span className="font-mono text-[11.5px] text-muted-foreground">non déployé</span>
      )}
    </div>
  );
}

function VersionCard({
  version,
  icon: Icon,
  points,
  highlighted,
}: {
  version: "v1" | "v2";
  icon: React.ComponentType<{ className?: string }>;
  points: string[];
  highlighted?: boolean;
}) {
  const meta = VERSION_META[version];
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-6",
        highlighted && "border-primary/25 bg-primary/[0.02]",
      )}
    >
      {highlighted ? (
        <div className="absolute right-5 top-5">
          <Badge variant="default" className="font-mono text-[9.5px]">
            devoir 2
          </Badge>
        </div>
      ) : null}
      <div
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg border",
          highlighted
            ? "border-primary/25 bg-primary/10 text-primary"
            : "border-border/70 bg-secondary/50 text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-4 text-lg">{meta.contract}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{meta.description}</p>
      <Separator className="my-4" />
      <ul className="space-y-2">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
            {point}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Step({
  index,
  title,
  description,
  icon: Icon,
}: {
  index: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="group flex items-start gap-4 rounded-xl border border-border/70 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/60 font-mono text-[11px] text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
