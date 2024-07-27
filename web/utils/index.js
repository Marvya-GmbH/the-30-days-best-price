import shopify from "../shopify.js";

export const getSession = async () => {
  const sessionId = await shopify.config.sessionStorage.findSessionsByShop(
    process.env.SHOPIFY_SHOP
  );
  if (sessionId.length > 0) {
    return sessionId[0];
  }
  throw new Error("No active Shopify session found");
};
