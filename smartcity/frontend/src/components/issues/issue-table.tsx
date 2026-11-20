import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/status-badge";
import { priorityLabel, type IssueRecord } from "@/lib/issues";

export function IssueTable({ issues }: { issues: IssueRecord[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[168px] pl-0">Identifiant</TableHead>
          <TableHead>Signalement</TableHead>
          <TableHead className="w-[96px]">Priorité</TableHead>
          <TableHead className="w-[104px]">Statut</TableHead>
          <TableHead className="w-[112px]">Déclarant</TableHead>
          <TableHead className="w-[112px] text-right">Déclaré le</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow key={issue.issueId}>
            <TableCell className="pl-0">
              <Link
                to={`/issues/${encodeURIComponent(issue.issueId)}`}
                className="mono text-primary hover:underline"
              >
                {issue.issueId}
              </Link>
            </TableCell>
            <TableCell>
              <p className="max-w-[440px] truncate text-[13px]">{issue.description}</p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {issue.issueType} · {issue.location}
              </p>
            </TableCell>
            <TableCell className="text-[13px] text-muted-foreground">
              {priorityLabel(issue.priority)}
            </TableCell>
            <TableCell>
              <StatusBadge status={issue.status} />
            </TableCell>
            <TableCell className="mono text-muted-foreground">{issue.reportedBy}</TableCell>
            <TableCell className="mono text-right text-muted-foreground">
              {issue.reportDate}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
