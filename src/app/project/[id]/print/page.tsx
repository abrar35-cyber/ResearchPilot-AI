import { PrintView } from "@/components/project/PrintView";

export default function PrintPage({ params }: { params: { id: string } }) {
  return <PrintView projectId={params.id} />;
}
