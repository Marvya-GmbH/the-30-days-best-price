import retry from "async-retry";
import shopify from "../shopify.js";
import Price from "../models/Price.js";
import fetchProducts from "../services/fetch-products.js";
import logger from "../utils/logger.js";

// Function to fetch products, store prices, calculate best price, and update product metafield
export const fetchStoreAndUpdatePrices = async (req, res) => {
  let status = 200;
  let error = null;

  try {
    const { session } = req.locals.shopify;
    const products = await fetchProducts(session);

    // Extract prices from products and prepare data for insertion
    const prices = products.map((product) => ({
      productId: product.id,
      price: parseFloat(product.variants.edges[0].node.price),
    }));

    // Store prices in the database
    await Price.insertMany(prices);

    // Calculate the best price for each product and update the metafield
    const updateMetafieldsPromises = products.map(async (product) => {
      const productId = product.id;
      const productPrices = await Price.find({ productId }).sort({ price: 1 });
      const bestPrice = productPrices[0].price;

      const client = new shopify.api.clients.Graphql({ session });

      // Step 1: Check if the metafield already exists
      const { body: metafieldResponse } = await retry(
        async () =>
          client.query({
            data: {
              query: `
                query {
                  product(id: "${productId}") {
                    metafield(namespace: "custom", key: "best_price_30_days") {
                      id
                      value
                    }
                  }
                }`,
            },
          }),
        { retries: 3 }
      );

      const existingMetafield = metafieldResponse.data.product.metafield;

      // Construct the metafield input for the mutation
      const metafieldInput = existingMetafield
        ? `{ id: "${existingMetafield.id}", value: "${bestPrice}" }`
        : `{ namespace: "custom", key: "best_price_30_days", value: "${bestPrice}", type: "single_line_text_field" }`;

      // Step 2: Update or create the metafield
      const mutation = `
        mutation {
          productUpdate(input: {
            id: "${productId}",
            metafields: [
              ${metafieldInput}
            ]
          }) {
            product {
              id
              metafields(first: 100) {
                edges {
                  node {
                    key
                    value
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }`;

      const mutationResponse = await retry(
        async () =>
          client.query({
            data: { query: mutation },
          }),
        { retries: 3 }
      );

      if (mutationResponse.body.data.productUpdate.userErrors.length > 0) {
        throw new Error(
          mutationResponse.body.data.productUpdate.userErrors[0].message
        );
      }
    });

    // Wait for all metafield updates to complete
    await Promise.all(updateMetafieldsPromises);

    res
      .status(status)
      .json({ message: "Prices fetched, stored, and updated successfully" });
  } catch (e) {
    logger.error(`Failed to process products/fetch/store/update: ${e.message}`);
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error });
};
