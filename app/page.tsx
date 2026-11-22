import { CurrencyControl } from "@/components/CurrencyControl";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ResultsPanel } from "@/components/ResultsPanel";
import { TripControls } from "@/components/TripControls";
import { AppStateProvider } from "@/state/AppStateProvider";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-6">
        <AppStateProvider>
          {/* Temporary home: T6.1 moves the currency control into the header band. */}
          <div className="mb-6">
            <CurrencyControl />
          </div>
          <TripControls />
          <ResultsPanel />
        </AppStateProvider>
      </main>
      <Footer />
    </>
  );
}
