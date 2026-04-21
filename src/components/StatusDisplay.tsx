export default function StatusDisplay({
  message,
  numRows,
  dropConfirm,
}: {
  message: string;
  numRows: number;
  dropConfirm: boolean;
}) {
  return (
    <div>
      <h3 className="font-semibold text-lg mb-2">Database Status</h3>
      <div>
        <p className={dropConfirm ? "text-red-600" : "text-green-700"}>
          {message}
        </p>
        {numRows > 0 && (
          <p className="mt-2 text-blue-700 font-medium">
            MiniMotif table has <strong>{numRows.toLocaleString()}</strong> rows.
          </p>
        )}
      </div>
    </div>
  );
}
