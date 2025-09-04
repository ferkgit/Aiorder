import cors from "cors";
import axios from "axios";
import { Buffer } from "buffer";
import { cfg } from "./config";
import express from "express";
import { runPipeline } from "./pipeline";
import { startScheduler } from "./scheduler";
import { writeCSV } from "./csv";
import { getStockBySKU } from "./inventory";
import { fetchOrders } from "./merchantpro";
import { fetchAllOrders, fetchAllProducts } from "./mpClient";


const app = express();
app.use(express.json());

app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // Vite dev
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Client-Key"]
}));

app.post("/sync", async (req, res) => {
  try {
    const withInventory = String(req.query.withInventory ?? "0") === "1";
    const maxOrders = Math.max(1, Number(req.query.maxOrders ?? 10000));

    const [products, orders] = await Promise.all([
      fetchAllProducts(),        // može i fetchAllProducts(maxProducts) ako kasnije dodaš parametar
      fetchAllOrders(maxOrders)
    ]);

    // TODO: tvoja ABC i predlozi logika ovde...
    // const { abc, suggestions } = compute(products, orders, withInventory);

    res.json({
      productsCount: products.length,
      ordersCount: orders.length,
      abc: [],            // popuni kada dodaš obradu
      suggestions: []     // isto
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

    // TODO: ovde ide tvoja računica ABC / predlozi (ostaje ista)
    // const { abc, suggestions } = compute(products, orders, withInventory);

    res.json({
      productsCount: products.length,
      ordersCount: orders.length,
      abc: [],            // vrati tvoj rezultat
      suggestions: []     // vrati tvoj rezultat
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});


// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/debug/mp/order1raw", async (_req, res) => {
  try {
    const list = await fetchOrders();
    res.json(list?.[0] ?? {});
  } catch (e:any) {
    res.status(500).json({ error: e?.message || "debug_failed" });
  }
});

// Ručno pokretanje pipeline-a
// Query opcije: ?export=1  i/ili  ?withInventory=1
app.post("/sync", async (req, res) => {
  try {
    const withInventory = String(req.query.withInventory || "").trim() === "1";
    const doExport = String(req.query.export || "").trim() === "1";

    const out = await runPipeline(new Date(), { withInventory });

    if (doExport) {
      const abcRows = out.abc.map(r => ({
        sku: r.sku,
        qty: r.qty,
        revenue: r.revenue,
        class: r.cls,
        share: r.share
      }));
      const sugRows = out.suggestions.map(s => ({
        sku: s.sku,
        class: s.class,
        qtyYear: s.qtyYear,
        daily: s.daily,
        rop: s.rop,
        target: s.target,
        onHand: s.onHand ?? "",
        suggestOrder: s.suggestOrder
      }));
      const abcPath = writeCSV("abc.csv", abcRows);
      const sugPath = writeCSV("suggestions.csv", sugRows);
      return res.json({ ...out, exports: { abc: abcPath, suggestions: sugPath } });
    }

    res.json(out);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "sync_failed" });
  }
});

// Jednostavan inventory proxy po SKU (za brzo testiranje)
app.get("/inventory/:sku", async (req, res) => {
  try {
    const qty = await getStockBySKU(req.params.sku);
    res.json({ sku: req.params.sku, onHand: qty });
  } catch (e:any) {
    res.status(500).json({ error: e?.message || "inventory_failed" });
  }
});

app.listen(8080, () => {
  console.log("Server on :8080");
  startScheduler();
});
app.get("/debug/mp/products1", async (_req, res) => { /* ... */ });
app.get("/debug/mp/orders1", async (_req, res) => { /* ... */ });
// (opciono) mali logger da vidiš svaki zahtev u server konzoli
app.use((req, _res, next) => { console.log(req.method, req.url); next(); });

// 1) Provera da je .env učitan (maskira tajne)
app.get("/debug/env", (_req, res) => {
  res.json({
    MP_BASE_URL: cfg.baseUrl,
    MP_KEY: cfg.key ? cfg.key.slice(0,4) + "•••" : null,
    MP_SECRET: cfg.secret ? cfg.secret.slice(0,4) + "•••" : null
  });
});

// 2) Direct ping ka MerchantPro – 1 proizvod
app.get("/debug/mp/products1", async (_req, res) => {
  try {
    const token = Buffer.from(`${cfg.key}:${cfg.secret}`).toString("base64");
    const r = await axios.get(`${cfg.baseUrl}/api/v2/products?limit=1`, {
      headers: { Authorization: `Basic ${token}` },
      validateStatus: () => true,
    });
    res.status(r.status).json(r.data);
  } catch (e:any) {
    res.status(500).json({ error: e?.message || "debug_failed" });
  }
});

// 3) Direct ping ka MerchantPro – 1 porudžbina
app.get("/debug/mp/orders1", async (_req, res) => {
  try {
    const token = Buffer.from(`${cfg.key}:${cfg.secret}`).toString("base64");
    const r = await axios.get(`${cfg.baseUrl}/api/v2/orders?limit=1`, {
      headers: { Authorization: `Basic ${token}` },
      validateStatus: () => true,
    });
    res.status(r.status).json(r.data);
  } catch (e:any) {
    res.status(500).json({ error: e?.message || "debug_failed" });
  }
});