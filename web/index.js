import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import dotenv from "dotenv";
import shopify from "./shopify.js";
import PrivacyWebhookHandlers from "./privacy.js";
import connectDB from "./config/db.js";
import priceRoutes from "./routes/priceRoutes.js";
import cron from "node-cron";
import { getSession } from "./utils/index.js";
import { fetchStoreAndUpdatePrices } from "./controllers/priceController.js";

dotenv.config();

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

connectDB();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

// UNUSED
/* app.use("/api/prices", priceRoutes); */

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

// Schedule task to run at midnight every day
cron.schedule("0 0 * * *", async () => {
  console.log("Running cron job to fetch, store, and update product prices");
  try {
    const session = await getSession();
    await fetchStoreAndUpdatePrices(
      { locals: { shopify: { session } } },
      {
        status: () => ({
          json: () => {},
          send: () => {},
        }),
      }
    );
  } catch (error) {
    console.error(`Error running cron job: ${error.message}`);
  }
});

app.listen(PORT);
