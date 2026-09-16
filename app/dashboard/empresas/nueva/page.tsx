import { PageHeader } from "@/components/ui/primitives";
import { CompanyForm } from "@/components/companies/company-form";

export default function NewCompanyPage() {
  return (
    <div>
      <PageHeader title="Nueva empresa" />
      <CompanyForm />
    </div>
  );
}
