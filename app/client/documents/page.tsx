import { requireClient } from "@/lib/auth";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { DocumentList, type DocumentWithCategory } from "@/components/documents";
import { PropertySwitcher, WaitingForActivation, pickProperty } from "@/components/client/property-context";

export const metadata = { title: "Mes documents" };

export default async function ClientDocumentsPage({ searchParams }: { searchParams: Promise<{ maison?: string }> }) {
  const { supabase, properties, client } = await requireClient();
  const { maison } = await searchParams;
  const property = pickProperty(properties, maison);
  if (!property) return <WaitingForActivation />;
  const { data } = await supabase
    .from("documents")
    .select("*, document_categories(name)")
    .or(`property_id.eq.${property.id},client_id.eq.${client?.id ?? property.id}`)
    .order("created_at", { ascending: false })
    .returns<DocumentWithCategory[]>();
  const docs = data ?? [];
  const categories = [...new Set(docs.map((d) => d.document_categories?.name ?? "Autres"))];
  return (
    <div className="animate-fade-up max-w-3xl">
      <PageHeader title="Mes documents" subtitle="Contrat, factures, rapports, notices : tout est conservé ici." />
      <PropertySwitcher properties={properties} current={property} basePath="/client/documents" />
      {docs.length === 0 ? (
        <EmptyState icon="file" title="Aucun document pour l’instant" />
      ) : (
        categories.map((c) => (
          <section key={c} className="mb-6">
            <SectionTitle>{c}</SectionTitle>
            <DocumentList documents={docs.filter((d) => (d.document_categories?.name ?? "Autres") === c)} />
          </section>
        ))
      )}
    </div>
  );
}
