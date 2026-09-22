import { PageHeader } from "@/components/ui/primitives";
import { ImportWizard } from "@/components/import/import-wizard";

export default function ImportPage() {
  return (
    <div>
      <PageHeader title="Importar" description="Subí un Excel o CSV y cargalo en Contactos, Empresas o Leads." />
      <ImportWizard />
    </div>
  );
}
