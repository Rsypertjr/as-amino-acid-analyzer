export default function ResultTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Record<string, unknown>[];
}) {
  if (!headers.length) return null;

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
      <table className="border-collapse border border-gray-300 text-sm w-auto">
        <thead>
          <tr className="bg-gray-200 sticky top-0 z-10">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border border-gray-300 px-3 py-2 text-center font-semibold bg-gray-200"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const values = Object.values(row);
            return (
              <tr
                key={ri}
                className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                {values.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border border-gray-300 px-3 py-1 whitespace-nowrap"
                  >
                    {String(cell ?? "")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
