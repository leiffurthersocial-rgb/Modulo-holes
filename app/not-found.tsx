import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-display text-7xl font-bold">404</p>
      <p className="text-dim">That hole doesn&apos;t exist… yet.</p>
      <Link href="/" className="rounded-2xl bg-accent px-6 py-3 font-display font-semibold text-white">
        Back to the hub
      </Link>
    </main>
  );
}
