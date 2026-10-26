import { AppShell } from "@/components/layout/AppShell";
import { ProjectView } from "@/components/project/ProjectView";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <ProjectView projectId={params.id} />
    </AppShell>
  );
}
