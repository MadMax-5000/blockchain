export const STATUS_NAMES = [
  "Reported",
  "Assigned",
  "InProgress",
  "Resolved",
  "Closed",
] as const;

export const STATUS_LABELS = [
  "Signalé",
  "Affecté",
  "En cours",
  "Résolu",
  "Clôturé",
] as const;

export const PRIORITY_NAMES = ["Low", "Medium", "High", "Critical"] as const;
export const PRIORITY_LABELS = ["Faible", "Moyenne", "Haute", "Critique"] as const;

export type IssueInput = {
  issueId: string;
  issueType: string;
  location: string;
  description: string;
  reportDate: string;
  priority: number;
  reportedBy: string;
  assignedTo: string;
  status: number;
};

export type IssueRecord = IssueInput & {
  createdAt: bigint;
  updatedAt: bigint;
  exists: boolean;
};

export type HistoryEntry = {
  timestamp: bigint;
  status: number;
  assignedTo: string;
  comment: string;
  actor: `0x${string}`;
};

export type ParsedRow = IssueInput & {
  rawPriority: string;
  rawStatus: string;
  rowNumber: number;
  errors: string[];
  onChainDuplicate?: boolean;
  selected: boolean;
};

export type ParseResult = {
  rows: ParsedRow[];
  sheetName: string;
  fileName: string;
};

export function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? STATUS_LABELS[0];
}

export function statusName(status: number): string {
  return STATUS_NAMES[status] ?? STATUS_NAMES[0];
}

export function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? PRIORITY_LABELS[0];
}

export function priorityName(priority: number): string {
  return PRIORITY_NAMES[priority] ?? PRIORITY_NAMES[0];
}

export function statusTone(status: number): "muted" | "info" | "warning" | "success" | "outline" {
  switch (status) {
    case 1:
      return "info";
    case 2:
      return "warning";
    case 3:
      return "success";
    case 4:
      return "outline";
    default:
      return "muted";
  }
}
