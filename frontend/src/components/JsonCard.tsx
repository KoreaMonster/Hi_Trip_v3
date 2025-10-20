'use client';

export default function JsonCard({ title, data }: { title: string; data: unknown }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      <pre className="bg-neutral-900 text-neutral-100 p-3 rounded text-sm overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
