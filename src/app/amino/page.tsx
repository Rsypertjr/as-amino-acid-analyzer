import { checkDatabaseStatus, checkMiniMotifSize } from "@/app/actions";
import AminoAnalyzer from "@/components/AminoAnalyzer";

export const dynamic = "force-dynamic";

export default async function AminoPage() {
  // Server-side data fetching
  const [status, motifSize] = await Promise.all([
    checkDatabaseStatus(),
    checkMiniMotifSize(),
  ]);

  return (
    <AminoAnalyzer
      initialStatus={status}
      initialMotifSize={motifSize}
    />
  );
}
