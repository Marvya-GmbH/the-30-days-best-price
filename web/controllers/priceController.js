import shopify from "../shopify.js";
import Price from "../models/Price.js";
import fetchProducts from "../services/fetch-products.js";

// Function to fetch products, store prices, calculate best price, and update product metafield
export const fetchStoreAndUpdatePrices = async (req, res) => {
  let status = 200;
  let error = null;

  try {
    const session = req.locals.shopify.session;
    const products = await fetchProducts(session);

    // Extract prices from products and prepare data for insertion
    const prices = products.map((product) => ({
      productId: product.id,
      // this is not the lowest price
      price: parseFloat(product.variants.edges[0].node.price),
    }));

    // Store prices in the database
    await Price.insertMany(prices);

    // Calculate the best price for each product and update the metafield
    for (const product of products) {
      const productId = product.id;
      const productPrices = await Price.find({ productId }).sort({ price: 1 });
      const bestPrice = productPrices[0].price;

      const client = new shopify.api.clients.Graphql({ session });

      // Step 1: Check if the metafield already exists
      const { body: metafieldResponse } = await client.query({
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
      });

      const existingMetafield = metafieldResponse.data.product.metafield;

      // no conditional needed. You can create and update with the same operation
      // Step 2: Update or create the metafield
      if (existingMetafield) {
        // Update existing metafield
        await client.query({
          data: {
            query: `
              mutation {
                productUpdate(input: {
                  id: "${productId}",
                  metafields: [
                    {
                      id: "${existingMetafield.id}",
                      value: "${bestPrice}"
                    }
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
              }`,
          },
        });
      } else {
        // Create new metafield
        await client.query({
          data: {
            query: `
              mutation {
                productUpdate(input: {
                  id: "${productId}",
                  metafields: [
                    {
                      namespace: "custom",
                      key: "best_price_30_days",
                      value: "${bestPrice}",
                      type: "single_line_text_field"
                    }
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
              }`,
          },
        });
      }
    }

    res
      .status(status)
      .json({ message: "Prices fetched, stored, and updated successfully" });
  } catch (e) {
    console.log(`Failed to process products/fetch/store/update: ${e.message}`);
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error });
};
