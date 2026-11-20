import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/common/status-badge";
import { StatusStepper } from "@/components/issues/status-stepper";
import { HistoryTimeline, IssueFacts } from "@/components/issues/history-timeline";
import { EmptyState } from "@/components/common/states";
import { useIssue, useIssueHistory } from "@/hooks/use-issues";
import { useMunicipalRole } from "@/hooks/use-role";

export function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const issue = useIssue(issueId);
  const history = useIssueHistory(issueId);
  const role = useMunicipalRole();

  if (issue.isLoading) {
    return (
      <div className="page-shell py-10">
        <p className="meta">Chargement du signalement…</p>
      </div>
    );
  }

  if (!issue.data) {
    return (
      <div className="page-shell py-10">
        <EmptyState
          title="Signalement introuvable"
          description={`Aucun signalement ${issueId ?? ""} n'est enregistré sur ce réseau.`}
          action={
            <Button asChild variant="outline">
              <Link to="/issues">Retour à la liste</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const data = issue.data;

  return (
    <div className="page-shell space-y-8 py-8 sm:py-10">
      <Link to="/issues" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Tous les signalements
      </Link>

      <PageHeading
        title={data.issueId}
        description={`${data.issueType} · ${data.location}`}
        actions={
          <>
            <StatusBadge status={data.status} className="px-3 py-1" />
            {role.isAgent ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin">Gérer</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <section aria-label="Progression du signalement" className="space-y-3">
        <h2 className="text-[16px] font-semibold">Progression</h2>
        <StatusStepper current={data.status} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold">Détails déclarés</h2>
          <div className="panel p-5">
            <p className="text-[13px] leading-relaxed">{data.description}</p>
            <div className="mt-6 border-t border-border pt-5">
              <IssueFacts
                type={data.issueType}
                priority={data.priority}
                reportedBy={data.reportedBy}
                reportDate={data.reportDate}
                createdAt={data.createdAt}
                updatedAt={data.updatedAt}
              />
            </div>
            <div className="mt-6 border-t border-border pt-5">
              <p className="meta">Équipe affectée</p>
              <p className="mt-1 text-[13px]">{data.assignedTo || "—"}</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Historique des interventions</h2>
            <span className="meta">{history.data?.length ?? 0} entrée(s)</span>
          </div>
          <div className="panel p-5">
            {history.isLoading ? (
              <p className="meta">Chargement de l'historique…</p>
            ) : (
              <HistoryTimeline entries={history.data ?? []} />
            )}
            <div className="mt-6 border-t border-border pt-5">
              <p className="meta">
                Chaque entrée est horodatée et signée par l'adresse du wallet ayant effectué l'action.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/report">
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Nouveau signalement
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
