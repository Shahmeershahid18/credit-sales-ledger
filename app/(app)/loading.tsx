export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-zinc-200" />
        <div className="h-4 w-32 rounded-md bg-zinc-200/70" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-white border border-zinc-200" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-white border border-zinc-200" />
    </div>
  );
}
