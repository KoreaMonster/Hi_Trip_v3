'use client';

export default function JsonCard({ title, data }: { title: string; data: unknown }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Mock Data</span>
      </div>
      <pre className="max-h-60 overflow-auto rounded-md bg-slate-900/95 p-4 text-xs leading-relaxed text-white">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
