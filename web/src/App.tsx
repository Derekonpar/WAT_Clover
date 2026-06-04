import { useState } from "react";
import InventoryTab from "./InventoryTab";
import LiquorInventoryTab from "./LiquorInventoryTab";
import UsagePanel from "./UsagePanel";

type Tab = "usage" | "beer-inventory" | "liquor-inventory";

export default function App() {
  const [tab, setTab] = useState<Tab>("usage");

  return (
    <div className="app">
      <header className="header">
        <h1>Wild Axe — Sales & Inventory</h1>
        <p>Usage, beer & liquor inventory ordering</p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${tab === "usage" ? "active" : ""}`}
          onClick={() => setTab("usage")}
        >
          Usage
        </button>
        <button
          className={`tab ${tab === "beer-inventory" ? "active" : ""}`}
          onClick={() => setTab("beer-inventory")}
        >
          Beer inventory
        </button>
        <button
          className={`tab ${tab === "liquor-inventory" ? "active" : ""}`}
          onClick={() => setTab("liquor-inventory")}
        >
          Liquor inventory
        </button>
      </nav>

      {tab === "usage" && <UsagePanel active={tab === "usage"} />}
      {tab === "beer-inventory" && <InventoryTab />}
      {tab === "liquor-inventory" && <LiquorInventoryTab />}
    </div>
  );
}
