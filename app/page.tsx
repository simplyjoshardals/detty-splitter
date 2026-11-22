import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ResultsPanel } from "@/components/ResultsPanel";
import { AppStateProvider } from "@/state/AppStateProvider";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-6">
        <AppStateProvider>
          <ResultsPanel />
        </AppStateProvider>
      </main>
      <Footer />
    </>
  );
}
