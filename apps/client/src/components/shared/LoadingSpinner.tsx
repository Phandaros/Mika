export function LoadingSpinner() {
  return (
    <div className="flex min-h-48 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-brand-orange" />
    </div>
  );
}
