function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A safe file name (without extension). Non-Latin questions fall back to "report". */
export function reportBaseName(question: string): string {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `researchpilot-${slug === "" ? "report" : slug}-${todayStamp()}`;
}

/** Saves the report as a .md file through the browser. */
export function downloadMarkdown(markdown: string, question: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${reportBaseName(question)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
