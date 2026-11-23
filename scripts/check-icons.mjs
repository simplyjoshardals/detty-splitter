/**
 * Asserts that every Phosphor icon named in DESIGN.md §2 exists in the
 * installed package. Run: `yarn check:icons` (add `--list` to print all exports).
 * If a name is missing, swap it for the nearest icon and update DESIGN.md.
 */
import process from "node:process";

// Keep in sync with the icon map in DESIGN.md §2.
const REQUIRED = [
  "BedIcon",
  "TicketIcon",
  "ChampagneIcon",
  "CarIcon",
  "BeerBottleIcon",
  "BusIcon",
  "ConfettiIcon",
  "CrownSimpleIcon",
  "CurrencyNgnIcon",
  "CurrencyDollarIcon",
  "CurrencyGbpIcon",
  "ReceiptIcon",
  "CopyIcon",
  "CheckIcon",
  "ArrowDownIcon",
  "ArrowCounterClockwiseIcon",
  "DoorOpenIcon",
  "PlusIcon",
  "MinusIcon",
  "WarningIcon",
  "UsersThreeIcon",
  "UserIcon",
  "CaretDownIcon",
];

const ENTRIES = ["@phosphor-icons/react/ssr", "@phosphor-icons/react"];

async function loadPackage() {
  for (const entry of ENTRIES) {
    try {
      return { entry, mod: await import(entry) };
    } catch {
      // try the next entry point
    }
  }
  return null;
}

const out = (line) => process.stdout.write(`${line}\n`);

const loaded = await loadPackage();
if (!loaded) {
  out("Could not import @phosphor-icons/react. Run `yarn add --exact @phosphor-icons/react` first.");
  process.exit(1);
}

const exportNames = Object.keys(loaded.mod);
out(`Loaded "${loaded.entry}" with ${exportNames.length} exports.`);

if (process.argv.includes("--list")) {
  for (const name of exportNames.sort()) out(name);
}

const missing = REQUIRED.filter((name) => !exportNames.includes(name));

if (missing.length === 0) {
  out(`OK: all ${REQUIRED.length} icons from DESIGN.md §2 exist.`);
  process.exit(0);
}

out(`MISSING ${missing.length} of ${REQUIRED.length}:`);
for (const name of missing) {
  const base = name.replace(/Icon$/, "").toLowerCase();
  const hints = exportNames
    .filter((e) => e.toLowerCase().includes(base))
    .slice(0, 5);
  out(`  - ${name}${hints.length ? `  (similar: ${hints.join(", ")})` : ""}`);
}
process.exit(1);
