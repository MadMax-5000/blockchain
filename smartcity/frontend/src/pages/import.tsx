import { PageHeading } from "@/components/layout/page-heading";
import { ExcelImport } from "@/components/admin/excel-import";

export function ImportPage() {
  return (
    <div className="page-shell space-y-8 py-8 sm:py-10">
      <PageHeading
        title="Import Excel"
        description="Chargez un classeur de signalements, vérifiez les lignes invalides ou déjà présentes on-chain, sélectionnez les lignes à importer puis signez une seule transaction par lot (50 lignes maximum)."
      />
      <ExcelImport />
    </div>
  );
}
