import { Link } from "react-router-dom";
import { ArrowRight, FilePlus2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/layout/page-heading";
import { IssueTable } from "@/components/issues/issue-table";
import { ErrorState } from "@/components/common/states";
import { AddressDisplay } from "@/components/common/address-display";
import { useDeployment } from "@/hooks/use-deployment";
import { useIssues } from "@/hooks/use-issues";
import { useNetwork } from "@/hooks/use-network";
import { STATUS_LABELS } from "@/lib/issues";
import { getChainMeta } from "@/lib/chains";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const { chainId } = useNetwork();
  const deployment = useDeployment();
  const chain = getChainMeta(chainId);
  const issues = useIssues();

  const counts = STATUS_LABELS.map((_, status) =>
    issues.data?.filter((issue) => issue.status === status).length ?? 0,
  );
  const total = issues.data?.length ?? 0;
  const awaiting = counts[0] + counts[1];
  const recent = [...(issues.data ?? [])]
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    .slice(0, 5);

  return (
    <div className="page-shell space-y-8 py-8 sm:py-10">
      <PageHeading
        title="Registre des signalements"
        description={`${total} signalement${total > 1 ? "s" : ""} déclaré${total > 1 ? "s" : ""} sur ${chain.name}, dont ${awaiting} en attente d'affectation ou d'intervention.`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/import">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Importer
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/report">
                <FilePlus2 className="h-3.5 w-3.5" />
                Nouveau signalement
              </Link>
            </Button>
          </>
        }
      />

      {issues.isError ? (
        <ErrorState
          title="Registre illisible"
          message="Impossible de charger les signalements depuis le contrat. Vérifiez le réseau et le déploiement."
        />
      ) : null}

      {!deployment.hasDeployment ? (
        <div className="panel px-5 py-4 text-[13px] text-amber-300">
          Aucun contrat déployé sur ce réseau. Lancez{" "}
          <code className="mono rounded bg-secondary px-1.5 py-0.5">npm run node</code> puis{" "}
          <code className="mono rounded bg-secondary px-1.5 py-0.5">npm run deploy:local</code>.
        </div>
      ) : null}

      <section aria-label="Indicateurs du registre" className="panel grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
        <Kpi label="Total déclaré" value={issues.isLoading ? "…" : String(total)} lead />
        <Kpi label="En attente" value={issues.isLoading ? "…" : String(awaiting)} />
        <Kpi label="En cours" value={issues.isLoading ? "…" : String(counts[2])} />
        <Kpi label="Clôturés" value={issues.isLoading ? "…" : String(counts[4])} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Derniers signalements</h2>
            <Link to="/issues" className="inline-flex items-center gap-1 text-[13px] text-primary">
              Voir les {total}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="panel px-5 py-1">
            {issues.isLoading ? (
              <p className="meta py-8">Chargement des signalements…</p>
            ) : recent.length === 0 ? (
              <p className="meta py-8">Aucun signalement pour le moment.</p>
            ) : (
              <IssueTable issues={recent} />
            )}
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Chaîne de traitement</h2>
            <span className="meta">État courant</span>
          </div>
          <div className="panel space-y-2 p-5">
            {STATUS_LABELS.map((label, status) => (
              <div key={label} className="flex items-center justify-between gap-4 py-1.5">
                <span
                  className={cn(
                    "flex items-center gap-2 text-[13px]",
                    status === 0 || status === 1 ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      status === 0 || status === 1 ? "bg-primary" : "bg-muted-foreground/50",
                    )}
                  />
                  {label}
                </span>
                <span className="mono">{counts[status]}</span>
              </div>
            ))}
            <div className="mt-4 border-t border-border pt-4">
              <p className="meta">Contrat actif</p>
              {deployment.address ? (
                <AddressDisplay address={deployment.address} chars={8} />
              ) : (
                <p className="mono text-muted-foreground">non déployé</p>
              )}
              <p className="meta mt-2">
                Déployé le {new Date(deployment.base?.deployedAt ?? Date.now()).toLocaleDateString("fr-FR")}
              </p>
              <p className="meta mt-3 border-t border-border pt-3">
                Les transitions sont strictement séquentielles : un dossier ne peut ni sauter une étape ni revenir en arrière.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, lead }: { label: string; value: string; lead?: boolean }) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn("mono mt-2", lead ? "text-[30px] text-foreground" : "text-[24px]")}>{value}</p>
    </div>
  );
}
