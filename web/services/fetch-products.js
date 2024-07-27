import shopify from "../shopify.js";

const PRODUCTS_QUERY = `{
  products(first: 250) {
    edges {
      node {
        id
        variants(first: 1) {
          edges {
            node {
              price
            }
          }
        }
      }
    }
  }
}`;

const fetchProducts = async (session) => {
  const client = new shopify.api.clients.Graphql({ session });
  const response = await client.query({
    data: {
      query: PRODUCTS_QUERY,
    },
  });

  if (response.errors) {
    throw new Error(`Error fetching products: ${response.errors}`);
  }

  return response.body.data.products.edges.map((edge) => edge.node);
};

export default fetchProducts;
