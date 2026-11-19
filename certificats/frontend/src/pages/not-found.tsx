import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="label-mono">404</span>
      <h1 className="mt-4 text-4xl tracking-[-0.02em]">Page introuvable</h1>
      <p className="mt-3 max-w-md text-[14px] text-muted-foreground">
        Cette route n'existe pas. Retournez à l'accueil pour émettre ou vérifier un certificat.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Retour à l'accueil
        </Link>
      </Button>
    </div>
  );
}
