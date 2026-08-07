// Document 5 §5 — reusable UI only, no business logic. Used by the Phase
// 0/1 application shell to stand in for feature routes implemented in
// later phases (Document 9).

export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">Implemented in {phase}.</p>
    </div>
  );
}
