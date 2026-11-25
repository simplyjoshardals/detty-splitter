import { DamageMeter } from "@/components/DamageMeter";
import { ExportButton } from "@/components/ExportButton";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LinkNotice } from "@/components/LinkNotice";
import { Receipt } from "@/components/Receipt";
import { ReceiptPrerender } from "@/components/ReceiptPrerender";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ShareBar } from "@/components/ShareBar";
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
 * unique and the meter's "See receipt" jump always finds it. `ReceiptPrerender` renders nothing; it keeps
 * the PNG pre-render in step with the state (T7.3), and sits first so the meter stays the last child.
 *
 * `LinkNotice` is the first thing in the calculator column: an empty live region that raises the
 * bad-link banner, and takes no space until it does (T8.2). `ExportButton` (T9.1) and `ShareBar`
 * (Copy link) hang under the receipt, in that order, inside the sticky column, so on desktop they
 * stay on screen with the receipt.
 */
export default function Home() {
  return (
    <AppStateProvider>
      <ReceiptPrerender />
      <Header />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-6 min-[1280px]:grid min-[1280px]:max-w-[940px] min-[1280px]:grid-cols-[minmax(0,480px)_minmax(0,380px)] min-[1280px]:items-start min-[1280px]:gap-12">
        <div>
          <LinkNotice />
          <TripControls />
          <ResultsPanel />
        </div>
        <StickyColumn>
          <Receipt />
          <ExportButton />
          <ShareBar />
        </StickyColumn>
      </main>
      <Footer />
      <DamageMeter watchId="receipt-totals" />
    </AppStateProvider>
  );
}