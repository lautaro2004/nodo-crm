import { PageHeader } from "@/components/ui/primitives";
import { TemplateForm } from "@/components/email/template-form";

export default function NewTemplatePage() {
  return (
    <div>
      <PageHeader title="Nueva plantilla" backHref="/dashboard/configuracion/plantillas" />
      <TemplateForm />
    </div>
  );
}
