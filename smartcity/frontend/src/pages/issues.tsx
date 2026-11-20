import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/layout/page-heading";
import { IssueTable } from "@/components/issues/issue-table";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useIssues } from "@/hooks/use-issues";
import { STATUS_LABELS } from "@/lib/issues";
import { cn } from "@/lib/utils";

export function IssuesPage() {
  const issues = useIssues();
  const [status, setStatus] = useState<number | "all">("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => STATUS_LABELS.map((_, index) => issues.data?.filter((item) => item.status === index).length ?? 0),
    [issues.data],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (issues.data ?? [])
      .filter((item) => status === "all" || item.status === status)
      .filter(
        (item) =>
          !needle ||
          [item.issueId, item.issueType, item.location, item.description, item.reportedBy]
            .join(" ")
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  }, [issues.data, query, status]);

  return (
    <div className="page-shell space-y-6 py-8 sm:py-10">
      <PageHeading
        title="Signalements"
        description="Consultation publique de tous les signalements enregistrés et de leur état courant."
      />

      {issues.isError ? (
        <ErrorState title="Liste indisponible" message="Impossible de lire le registre sur ce réseau." />
      ) : null}

      <div className="space-y-5">
        <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Filtrer par statut">
          <FilterTab active={status === "all"} onClick={() => setStatus("all")} label="Tous" count={issues.data?.length ?? 0} />
          {STATUS_LABELS.map((label, index) => (
            <FilterTab
              key={label}
              active={status === index}
              onClick={() => setStatus(index)}
              label={label}
              count={counts[index]}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un identifiant, un lieu, un type…"
            className="h-9 sm:w-[320px]"
            aria-label="Rechercher un signalement"
          />
          <p className="mono text-muted-foreground">
            {filtered.length} / {issues.data?.length ?? 0} signalements
          </p>
        </div>

        <section className="panel px-5 py-1">
          {issues.isLoading ? (
            <p className="meta py-10">Chargement des signalements…</p>
          ) : filtered.length === 0 ? (
            <div className="py-6">
              <EmptyState
                title="Aucun signalement affiché"
                description="Modifiez le filtre ou la recherche, ou déclarez un nouveau signalement."
                action={
                  <ButtonAsLink to="/report">Nouveau signalement</ButtonAsLink>
                }
              />
            </div>
          ) : (
            <IssueTable issues={filtered} />
          )}
        </section>
      </div>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative shrink-0 px-3 py-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
        active && "text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-px after:bg-primary",
      )}
    >
      {label}
      <span className="mono ml-1.5 text-muted-foreground">{count}</span>
    </button>
  );
}

function ButtonAsLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-[13px] font-medium text-background"
    >
      {children}
    </Link>
  );
}
