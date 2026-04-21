import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Minimotif Analyzer | Amino Acid Code Sequence Analyzer",
  description: "Build protein databases and search minimotif patterns",
};

export default function AminoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Minimotif Sequence Analyzer
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Build protein databases from FASTA files and query minimotif patterns
        </p>
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
