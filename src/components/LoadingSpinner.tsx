export default function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="loader-spin mb-4" />
      <p className="text-lg text-gray-700">{message}</p>
    </div>
  );
}
