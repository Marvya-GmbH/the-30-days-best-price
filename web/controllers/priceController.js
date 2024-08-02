import Price from "../models/Price.js";
import fetchProducts from "../services/fetch-products.js";
import shopify from "../shopify.js";

// Function to fetch products and store prices
export const fetchAndStorePrices = async (req, res) => {
  let status = 200;
  let error = null;

  try {
    const session = req.locals.shopify.session;
    const products = await fetchProducts(session);

    // Extract prices from products and prepare data for insertion
    const prices = products.map((product) => ({
      productId: product.id,
      price: parseFloat(product.variants.edges[0].node.price),
    }));

    // Store prices in the database
    await Price.insertMany(prices);

    res
      .status(status)
      .json({ message: "Prices fetched and stored successfully" });
  } catch (e) {
    console.log(`Failed to process products/fetch: ${e.message}`);
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error });
};

export const calculateBestPrice = async (req, res) => {
  try {
    const { productId } = req.params;
    const prices = await Price.find({
      productId,
      timestamp: {
        $gte: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
      },
    }).sort({ price: 1 });

    if (prices.length === 0) {
      return res
        .status(404)
        .json({ message: "No prices found for the past 30 days" });
    }

    const bestPrice = prices[0].price; // Assume prices are sorted ascending
    res.status(200).json({ bestPrice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProductMetafield = async (req, res) => {
  try {
    const { productId } = req.params;
    const { bestPrice } = req.body;

    const session = req.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });

    const mutation = `mutation {
      productUpdate(input: {
        id: "${productId}",
        metafields: [{
          namespace: "custom",
          key: "best_price_30_days",
          value: "${bestPrice}",
          valueType: STRING
        }]
      }) {
        product {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`;

    const response = await client.query({ data: { query: mutation } });

    if (response.body.data.productUpdate.userErrors.length) {
      throw new Error(response.body.data.productUpdate.userErrors[0].message);
    }

    res.status(200).json({ message: "Metafield updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
