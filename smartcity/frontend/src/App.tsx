import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/pages/dashboard";
import { ReportPage } from "@/pages/report";
import { IssuesPage } from "@/pages/issues";
import { IssueDetailPage } from "@/pages/issue-detail";
import { AdminPage } from "@/pages/admin";
import { ImportPage } from "@/pages/import";
import { NotFoundPage } from "@/pages/not-found";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="issues" element={<IssuesPage />} />
        <Route path="issues/:issueId" element={<IssueDetailPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="admin/import" element={<ImportPage />} />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
