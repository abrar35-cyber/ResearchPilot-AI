import {
  ListChecks,
  Microscope,
  PenLine,
  Scale,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AgentName } from "@/lib/schemas/research";

// Order matches the backend pipeline. Agent names are shown in English in every language.
export const AGENT_META: { key: AgentName; name: string; Icon: LucideIcon }[] = [
  { key: "planner", name: "Planner", Icon: ListChecks },
  { key: "discovery", name: "Discovery", Icon: Search },
  { key: "evidence", name: "Evidence Analyst", Icon: Microscope },
  { key: "critical", name: "Critical Analyst", Icon: Scale },
  { key: "verification", name: "Verification Auditor", Icon: ShieldCheck },
  { key: "writer", name: "Research Writer", Icon: PenLine },
];
