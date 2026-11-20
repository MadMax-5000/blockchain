import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileSpreadsheet, Pause, Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/common/status-badge";
import { StatusStepper } from "@/components/issues/status-stepper";
import { HistoryTimeline } from "@/components/issues/history-timeline";
import { TxHash } from "@/components/common/tx-hash";
import { ConnectButton } from "@/components/wallet/connect-button";
import { useIssueActions } from "@/hooks/use-actions";
import { useIssueHistory } from "@/hooks/use-issues";
import { useIssues } from "@/hooks/use-issues";
import { useMunicipalRole } from "@/hooks/use-role";
import { getErrorMessage } from "@/lib/errors";
import { STATUS_LABELS, type IssueRecord } from "@/lib/issues";

export function AdminPage() {
  const issues = useIssues();
  const role = useMunicipalRole();
  const { assignTeam, updateStatus, setPaused, isPending } = useIssueActions();
  const [selectedId, setSelectedId] = useState<string>();
  const [team, setTeam] = useState("UrbanTeam01");
  const [comment, setComment] = useState("Intervention municipale");
  const [hash, setHash] = useState<string>();

  const openIssues = useMemo(
    () => (issues.data ?? []).filter((issue) => issue.status < 4).sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1)),
    [issues.data],
  );
  const selected = openIssues.find((issue) => issue.issueId === selectedId) ?? openIssues[0];
  const history = useIssueHistory(selected?.issueId);

  async function run(action: () => Promise<{ hash: string; message: string }>) {
    try {
      const result = await action();
      setHash(result.hash);
      toast.success(result.message);
    } catch (error) {
      toast.error("Transaction échouée", { description: getErrorMessage(error) });
    }
  }

  return (
    <div className="page-shell space-y-8 py-8 sm:py-10">
      <PageHeading
        title="Espace municipal"
        description="Affectation des équipes, avancement du statut et contrôle du registre. Les actions sont réservées au compte disposant du rôle AGENT_ROLE et signées via MetaMask."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/import">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Import Excel
              </Link>
            </Button>
            <ConnectButton />
          </>
        }
      />

      <section className="panel grid gap-4 p-5 sm:grid-cols-3 sm:items-center">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-[13px]">
            Rôle municipal : <strong>{role.isAgent ? "accordé" : "non accordé"}</strong>
          </span>
        </div>
        <div className="text-[13px]">
          Registre : <strong>{role.paused ? "en pause" : "actif"}</strong>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || !role.isAgent}
            onClick={() => void run(() => setPaused(!role.paused))}
          >
            {role.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {role.paused ? "Réactiver" : "Mettre en pause"}
          </Button>
        </div>
      </section>

      {!role.isConnected ? (
        <div className="panel px-5 py-4 text-[13px] text-muted-foreground">
          Connectez le compte municipal (Hardhat Account #0) pour afficher les actions d'affectation.
        </div>
      ) : !role.isAgent ? (
        <div className="panel border-l-2 border-l-amber-400 px-5 py-4 text-[13px] text-amber-300">
          Ce compte n'a pas AGENT_ROLE. Utilisez le compte déployeur pour la démonstration.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Dossiers à traiter</h2>
            <span className="mono meta">{openIssues.length} ouvert(s)</span>
          </div>
          <div className="panel divide-y divide-border">
            {openIssues.length === 0 ? (
              <p className="meta p-5">Aucun dossier ouvert.</p>
            ) : (
              openIssues.map((issue) => (
                <IssueRowButton
                  key={issue.issueId}
                  issue={issue}
                  active={issue.issueId === selected?.issueId}
                  onClick={() => setSelectedId(issue.issueId)}
                />
              ))
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-3">
          <h2 className="text-[16px] font-semibold">Traiter le dossier</h2>
          <div className="panel space-y-5 p-5">
            {!selected ? (
              <p className="meta">Sélectionnez un dossier ouvert.</p>
            ) : (
              <>
                <div>
                  <p className="mono text-primary">{selected.issueId}</p>
                  <p className="mt-1 text-[13px]">{selected.description}</p>
                  <p className="meta mt-1">{selected.location}</p>
                  <div className="mt-3">
                    <StatusStepper current={selected.status} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team">Équipe affectée</Label>
                  <Input
                    id="team"
                    value={team}
                    onChange={(event) => setTeam(event.target.value)}
                    disabled={isPending || selected.status >= 3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">Commentaire d'intervention</Label>
                  <Input
                    id="comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    disabled={isPending}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Button
                    size="sm"
                    disabled={isPending || !role.isAgent || !team.trim() || selected.status >= 4}
                    onClick={() =>
                      void run(() =>
                        selected.status === 0
                          ? assignTeam(selected.issueId, team.trim(), comment.trim() || "Affectation")
                          : updateStatus(selected.issueId, selected.status + 1, comment.trim() || STATUS_LABELS[selected.status + 1]),
                      )
                    }
                  >
                    {selected.status === 0
                      ? "Affecter l'équipe"
                      : `Passer à ${STATUS_LABELS[selected.status + 1]}`}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <StatusBadge status={selected.status} />
                </div>

                <div className="border-t border-border pt-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-[13px] font-semibold">Historique</h3>
                    <span className="meta">{history.data?.length ?? 0} entrée(s)</span>
                  </div>
                  <HistoryTimeline entries={history.data ?? []} />
                </div>
              </>
            )}

            {hash ? (
              <div className="border-t border-border pt-4">
                <p className="meta mb-2">Dernière transaction</p>
                <TxHash hash={hash} />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function IssueRowButton({
  issue,
  active,
  onClick,
}: {
  issue: IssueRecord;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 ${
        active ? "border-l-2 border-l-primary bg-primary/5" : "border-l-2 border-l-transparent"
      }`}
    >
      <span className="min-w-0">
        <span className="mono text-[13px] text-primary">{issue.issueId}</span>
        <span className="mt-1 block truncate text-[13px]">{issue.description}</span>
        <span className="meta mt-0.5 block truncate">{issue.location}</span>
      </span>
      <StatusBadge status={issue.status} />
    </button>
  );
}
