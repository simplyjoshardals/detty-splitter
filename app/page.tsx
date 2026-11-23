import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ResultsPanel } from "@/components/ResultsPanel";
import { TripControls } from "@/components/TripControls";
import { AppStateProvider } from "@/state/AppStateProvider";

/**
 * The provider wraps Header, main and Footer, because the currency control in the header
 * reads state. Home, Header and Footer stay server components: children passed through a
 * client provider are still rendered on the server.
 */
export default function Home() {
  return (
    <AppStateProvider>
      <Header />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-6">
        <TripControls />
        <ResultsPanel />
      </main>
      <Footer />
    </AppStateProvider>
  );
}
