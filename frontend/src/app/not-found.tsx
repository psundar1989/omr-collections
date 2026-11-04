import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="heading-display mt-2 text-5xl">Page not found</h1>
      <p className="mt-3 text-muted">This piece may have sold out or moved.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn-outline">Home</Link>
        <Link href="/shop" className="btn-primary">Shop all</Link>
      </div>
    </div>
  );
}
