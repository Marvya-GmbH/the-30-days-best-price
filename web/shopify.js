import { LATEST_API_VERSION } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { MongoDBSessionStorage } from "@shopify/shopify-app-session-storage-mongodb";
// eslint-disable-next-line import/no-unresolved
import { restResources } from "@shopify/shopify-api/rest/admin/2023-04";
import dotenv from "dotenv";

dotenv.config();

const shopify = shopifyApp({
  api: {
    apiVersion: LATEST_API_VERSION,
    restResources,
    billing: undefined,
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage: new MongoDBSessionStorage(
    process.env.MONGODB_URI,
    process.env.DB_NAME
  ),
});

export default shopify;
