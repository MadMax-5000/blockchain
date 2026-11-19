import { Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "@/components/layout/site-layout";
import { HomePage } from "@/pages/home";
import { AdminPage } from "@/pages/admin";
import { VerifyPage } from "@/pages/verify";
import { AuditPage } from "@/pages/audit";
import { NotFoundPage } from "@/pages/not-found";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
