import { DamageMeter } from "@/components/DamageMeter";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Receipt } from "@/components/Receipt";
import { ResultsPanel } from "@/components/ResultsPanel";
import { StickyColumn } from "@/components/StickyColumn";
import { TripControls } from "@/components/TripControls";
import { AppStateProvider } from "@/state/AppStateProvider";

/**
 * The provider wraps Header, main and Footer, because the currency control in the header
 * reads state. Home, Header and Footer stay server components: children passed through a
 * client provider are still rendered on the server. The damage meter is the last child, so its
 * sticky bottom bar follows the footer and nothing above it moves (DESIGN §4).
 *
 * From 1280px `main` is two columns: the calculator (480px) and the receipt (380px), 48px apart,
 * with the receipt column sticky; the meter hides itself at that width. Below 1280px it is one
 * column and the receipt follows the rates. The receipt is one element in the page, so its id is
 * unique and the meter's "See receipt" jump always finds it.
 */
export default function Home() {
  return (
    <AppStateProvider>
      <Header />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-6 min-[1280px]:grid min-[1280px]:max-w-[940px] min-[1280px]:grid-cols-[minmax(0,480px)_minmax(0,380px)] min-[1280px]:items-start min-[1280px]:gap-12">
        <div>
          <TripControls />
          <ResultsPanel />
        </div>
        <StickyColumn>
          <Receipt />
        </StickyColumn>
      </main>
      <Footer />
      <DamageMeter watchId="receipt-totals" />
    </AppStateProvider>
  );
}