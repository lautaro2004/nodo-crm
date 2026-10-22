import { ListPageSkeleton } from "@/components/ui/skeletons";

// Fallback de navegación para todo /dashboard/** que no tenga uno propio
// (convención de Next.js: se muestra mientras el server component de la
// página siguiente resuelve sus datos). Los detalles ([id]) y formularios
// (nuevo/editar) tienen skeletons con su propia forma.
export default function DashboardLoading() {
  return <ListPageSkeleton />;
}
