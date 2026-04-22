"use client";

import { useState, useCallback, useRef } from "react";
import {
  checkDatabaseStatus,
  checkMiniMotifSize,
  dropTables,
  searchMotif,
  type StatusResult,
  type MotifSizeResult,
  type SearchResult,
} from "@/app/actions";
import ResultTable from "./ResultTable";
import StatusDisplay from "./StatusDisplay";
import LoadingSpinner from "./LoadingSpinner";

const ACID_NAMES = [
  "G - Glycine", "A - Alanine", "V - Valine", "L - Leucine",
  "I - Isoleucine", "M - Methionine", "F - Phenylalanine", "W - Tryptophan",
  "P - Proline", "S - Serine", "T - Threonine", "C - Cysteine",
  "Y - Tyrosine", "N - Asparagine", "Q - Glutamine", "D - Aspartic Acid",
  "E - Glutamic Acid", "K - Lysine", "R - Arginine", "H - Histidine",
];

const ACID_INITIALS = [
  "G", "A", "V", "L", "I", "M", "F", "W", "P", "S",
  "T", "C", "Y", "N", "Q", "D", "E", "K", "R", "H",
];

const PROTEIN_ANALYTICS = [
  "Get All Accession Numbers for chosen miniMotif",
  "Get All Motif Instances in All Proteins",
  "Get Start Positions of selected Motif in All Proteins",
  "Get Number of Motifs for Each Protein",
  "Get All Species Names in which selected Motif occurs",
  "Get Average Length of All Proteins for the selected Motif",
];

interface AminoAnalyzerProps {
  initialStatus: StatusResult;
  initialMotifSize: MotifSizeResult;
}

export default function AminoAnalyzer({
  initialStatus,
  initialMotifSize,
}: AminoAnalyzerProps) {
  const [startMotif, setStartMotif] = useState("");
  const [endMotif, setEndMotif] = useState("");
  const [aminoString, setAminoString] = useState("X......X");
  const [motifAnalytic, setMotifAnalytic] = useState("Select an Analytic");
  const [motifAnalyticIndex, setMotifAnalyticIndex] = useState(-1);

  const [statusMessage, setStatusMessage] = useState(initialStatus.message);
  const [numRows, setNumRows] = useState(initialMotifSize.numRows ?? 0);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);

  const [dropConfirm, setDropConfirm] = useState(
    !initialStatus.proteinExists && !initialStatus.miniMotifExists
  );

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleStartMotif = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setStartMotif(val);
    setAminoString(val + aminoString.slice(1));
  };

  const handleEndMotif = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setEndMotif(val);
    setAminoString(aminoString.slice(0, -1) + val);
  };

  const handleMotifAnalytic = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setMotifAnalytic(val);
    setMotifAnalyticIndex(PROTEIN_ANALYTICS.indexOf(val));
  };

  const handleCancelBuild = useCallback(async () => {
    setCancelling(true);
    try {
      await fetch("/api/cancel-build", { method: "POST" });
    } catch {
      // ignore
    }
  }, []);

  const handleBuildDatabase = useCallback(
    async (fileName: string) => {
      if (!fileName || !fileName.endsWith(".txt")) {
        alert("Please input a FASTA type file with .txt extension");
        return;
      }

      setLoading(true);
      setLoadingMessage("Starting database build...");
      setShowResults(false);

      // Start polling for progress via API route
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/build-progress");
          const progress = await res.json();
          if (progress.phase === "proteins") {
            setLoadingMessage(
              `Building Protein Table... ${progress.proteinRows.toLocaleString()} rows inserted`
            );
          } else if (progress.phase === "minimotifs") {
            setLoadingMessage(
              `Protein Table complete (${progress.proteinRows.toLocaleString()} rows). Building MiniMotif Table... ${progress.miniMotifRows.toLocaleString()} rows inserted (${progress.miniMotifPercent}%)`
            );
          }
        } catch {
          // ignore polling errors
        }
      }, 2000);

      // Use fetch API (not server action) so React doesn't block re-renders
      const res = await fetch("/api/build-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      const result = await res.json();

      stopPolling();
      setCancelling(false);
      setStatusMessage(result.message);

      if (result.success) {
        const size = await checkMiniMotifSize();
        setNumRows(size.numRows ?? 0);
        setDropConfirm(false);
      }

      setLoading(false);
      setLoadingMessage(result.message);
    },
    [stopPolling]
  );

  const handleDropTables = useCallback(async () => {
    if (!confirm("Are you sure that you want to Drop Tables?")) return;

    setLoading(true);
    setLoadingMessage("Dropping the Protein and miniMotif Tables...");
    setShowResults(false);

    await dropTables();

    setNumRows(0);
    setDropConfirm(true);
    setStatusMessage("The Protein and MimiMotif Tables are Dropped");
    setLoading(false);
    setLoadingMessage("Tables dropped successfully.");
  }, []);

  const handleUpdateStatus = useCallback(async () => {
    setLoading(true);
    setLoadingMessage("Checking database status...");

    const [status, size] = await Promise.all([
      checkDatabaseStatus(),
      checkMiniMotifSize(),
    ]);

    setStatusMessage(status.message);
    setNumRows(size.numRows ?? 0);
    setDropConfirm(!status.proteinExists && !status.miniMotifExists);
    setLoading(false);
  }, []);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!startMotif || !endMotif || motifAnalyticIndex < 0) {
        alert("Please select start motif, end motif, and an analytic.");
        return;
      }

      setLoading(true);
      setLoadingMessage("Please Wait for Query Result Table");
      setShowResults(false);

      const results = await searchMotif(startMotif, endMotif, motifAnalyticIndex);

      setSearchResults(results);
      setShowResults(true);
      setLoading(false);
    },
    [startMotif, endMotif, motifAnalyticIndex]
  );

  const closeResults = () => {
    setShowResults(false);
    setLoading(false);
    setLoadingMessage("");
  };

  return (
    <>
      {/* Database Build Section */}
      <section className="viewer">
        <h2 className="text-xl font-semibold mb-4">
          Input Form for Minimotif Search
        </h2>

        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <h3 className="font-medium mb-2">Input the file name below</h3>
          <p className="text-sm text-gray-600 mb-3">
            <em>
              <strong>FASTA-TEST.txt</strong>{" "}is an example file that will work.
              However, the database tables take several minutes to build with
              10&apos;s of thousands of entries.
            </em>{" "}
            If tables already exist you can <strong>Drop Tables</strong> to
            restart. Another file can be used but it must be in the{" "}
            <strong>FASTA format</strong> and <strong>.txt</strong> extension.
          </p>

          <FileInputForm
            onBuild={handleBuildDatabase}
            onDrop={handleDropTables}
            onUpdate={handleUpdateStatus}
            onCancel={handleCancelBuild}
            loading={loading}
            cancelling={cancelling}
          />
        </div>

        <div className="bg-[beige] p-4 rounded-lg text-center">
          {loading ? (
            <LoadingSpinner message={loadingMessage} />
          ) : showResults && searchResults ? (
            <div className="relative">
              <div className="text-center mb-4">
                <button
                  onClick={closeResults}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
              <ResultTable
                headers={searchResults.headers}
                rows={searchResults.rows}
              />
            </div>
          ) : (
            <StatusDisplay
              message={statusMessage}
              numRows={numRows}
              dropConfirm={dropConfirm}
            />
          )}
        </div>
      </section>

      {/* Motif Selection Section */}
      <section className="viewer">
        <div className="bg-[beige] p-6 rounded-lg mb-4">
          <p className="bg-gray-100 p-3 rounded mb-4">
            Select below the first and last letter codes for minimotif sequence
            you want to search. (e.g. P and G for P.....G where dots represent
            any other amino acid codes in between).
          </p>

          <div className="grid grid-cols-3 gap-4 items-center">
            <MotifSelect
              value={startMotif}
              placeholder="Start Motif"
              names={ACID_NAMES}
              initials={ACID_INITIALS}
              onChange={handleStartMotif}
            />
            <h2 className="text-center text-green-600 text-2xl font-bold">
              {aminoString}
            </h2>
            <MotifSelect
              value={endMotif}
              placeholder="End Motif"
              names={ACID_NAMES}
              initials={ACID_INITIALS}
              onChange={handleEndMotif}
            />
          </div>
        </div>

        <div className="bg-[beige] p-6 rounded-lg mb-4">
          <p className="bg-gray-100 p-3 rounded mb-4">
            Select an Analytic to be performed on the MiniMotif Table.
          </p>
          <MotifSelect
            value={motifAnalytic === "Select an Analytic" ? "" : motifAnalytic}
            placeholder="Select an Analytic"
            names={PROTEIN_ANALYTICS}
            initials={PROTEIN_ANALYTICS}
            onChange={handleMotifAnalytic}
          />
          <p className="mt-3">
            <span className="text-blue-600 text-lg">
              Analytic to be Performed:
            </span>{" "}
            <span className="text-green-600 text-lg ml-2">
              {motifAnalytic}
            </span>
          </p>
        </div>

        {numRows > 0 && (
          <button
            type="submit"
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Submit Search
          </button>
        )}
      </section>
    </>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function FileInputForm({
  onBuild,
  onDrop,
  onUpdate,
  onCancel,
  loading,
  cancelling,
}: {
  onBuild: (fileName: string) => void;
  onDrop: () => void;
  onUpdate: () => void;
  onCancel: () => void;
  loading: boolean;
  cancelling: boolean;
}) {
  const [fileName, setFileName] = useState("");

  return (
    <div>
      <input
        type="text"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        onClick={() => setFileName("")}
        placeholder="Input File Name"
        className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onBuild(fileName)}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Verify File and Start Database Build
        </button>
        <button
          onClick={onDrop}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          Drop Tables
        </button>
        <button
          onClick={onUpdate}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Update Database Status
        </button>
        {loading && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {cancelling ? "Cancelling..." : "Stop Build"}
          </button>
        )}
      </div>
    </div>
  );
}

function MotifSelect({
  value,
  placeholder,
  names,
  initials,
  onChange,
}: {
  value: string;
  placeholder: string;
  names: string[];
  initials: string[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <option value="">{placeholder}</option>
      {names.map((name, i) => (
        <option key={i} value={initials[i]}>
          {name}
        </option>
      ))}
    </select>
  );
}
