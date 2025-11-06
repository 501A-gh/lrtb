import PerspectiveCorrector from "@/components/perspective-corrector";
import { PWAInstaller } from "@/components/pwa-installer";

export default function Home() {
  return (
    <main className="min-h-screen bg-accent flex flex-col">
      <header className="px-6 py-4 flex items-center gap-2 sm:gap-4 flex-col sm:flex-row">
        <h1 className="text-lg font-semibold tracking-tight">LRTB</h1>
        <p className="text-muted-foreground text-sm">
          Perspective Correction Tool
        </p>
      </header>

      <PerspectiveCorrector />
      <PWAInstaller />
    </main>
  );
}
