import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          Amino Acid Code Sequence Analyzer
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Parse FASTA-format protein data files, build minimotif databases, and
          run analytics on amino acid code sequences. Select start and end amino
          acid letter codes to query minimotif patterns across all proteins.
        </p>
        <Link
          href="/amino"
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Launch Analyzer
        </Link>
      </div>
    </div>
  );
}
