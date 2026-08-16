export function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-600">
      {message}
    </p>
  );
}
