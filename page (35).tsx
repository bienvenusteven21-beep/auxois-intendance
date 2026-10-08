import { requireStaff } from "@/lib/auth";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { DocumentList, type DocumentWithCategory } from "@/components/documents";
import { DocumentUploader } from "@/components/uploads/document-uploader";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { supabase } = await requireStaff();
  const [{ data: docs }, { data: cats }, { data: properties }, { data: clients }] = await Promise.all([
    supabase.from("documents").select("*, document_categories(name), properties(name)").order("created_at", { ascending: false }).limit(200).returns<DocumentWithCategory[]>(),
    supabase.from("document_categories").select("id, name").order("position"),
    supabase.from("properties").select("id, name").eq("is_active", true).order("name"),
    supabase.from("clients").select("id, first_name, last_name").eq("is_active", true).order("last_name"),
  ]);
  return (
    <div className="animate-fade-up">
      <PageHeader title="Documents" subtitle="Contrats, factures, devis, rapports, notices et diagnostics." />
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div>
          {docs?.length ? <DocumentList documents={docs} staff showProperty /> : <EmptyState icon="file" title="Aucun document" />}
        </div>
        <section>
          <SectionTitle>Déposer un document</SectionTitle>
          <DocumentUploader categories={cats ?? []} properties={properties ?? []} clients={clients ?? []} />
        </section>
      </div>
    </div>
  );
}
