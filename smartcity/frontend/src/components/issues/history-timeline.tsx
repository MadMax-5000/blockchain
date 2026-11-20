import { formatTimestamp, shortenAddress } from "@/lib/format";
import { priorityLabel, statusLabel } from "@/lib/issues";
import type { HistoryEntry } from "@/lib/issues";

export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="meta">Aucune entrée d'historique disponible.</p>;
  }

  return (
    <ol className="relative ml-1 border-l border-border pl-5">
      {entries.map((entry, index) => (
        <li key={`${entry.timestamp}-${index}`} className="relative pb-6 last:pb-0">
          <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-primary" />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium">{statusLabel(entry.status)}</span>
            <span className="mono text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">{entry.comment || "—"}</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
            {entry.assignedTo ? <span>Équipe : {entry.assignedTo}</span> : null}
            <span title={entry.actor}>Acteur : {shortenAddress(entry.actor, 6)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function IssueFacts({
  type,
  priority,
  reportedBy,
  reportDate,
  createdAt,
  updatedAt,
}: {
  type: string;
  priority: number;
  reportedBy: string;
  reportDate: string;
  createdAt: bigint;
  updatedAt: bigint;
}) {
  const facts = [
    ["Type", type],
    ["Priorité", priorityLabel(priority)],
    ["Déclarant", reportedBy],
    ["Date déclarée", reportDate],
    ["Créé on-chain", formatTimestamp(createdAt)],
    ["Dernière mise à jour", formatTimestamp(updatedAt)],
  ];

  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {facts.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <dt className="meta">{label}</dt>
          <dd className="text-right text-[13px]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
