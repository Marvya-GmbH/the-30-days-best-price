import Price from "../models/Price.js";
import fetchProducts from "../services/fetch-products.js";

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
    const prices = await Price.find({ productId }).sort({ price: 1 });
    const bestPrice = prices[0].price; // Assume prices are sorted ascending
    res.status(200).json({ bestPrice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProductMetafield = async (req, res) => {
  // Implement logic to update product metafield in Shopify
};
