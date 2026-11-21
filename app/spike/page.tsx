import { SpikeClient } from "./SpikeClient";

// THROWAWAY (T2.1/T2.2): delete the whole app/spike folder before launch (T11.3).
export default function SpikePage() {
  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <SpikeClient />
    </main>
  );
}
