import express from "express";
import {
  calculateBestPrice,
  updateProductMetafield,
  fetchAndStorePrices,
} from "../controllers/priceController.js";

const router = express.Router();

router.get("/fetch", fetchAndStorePrices);
router.get("/calculate/:productId", calculateBestPrice);
router.put("/update/:productId", updateProductMetafield);

export default router;
