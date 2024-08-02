// UNUSED

import express from "express";
import {
  fetchStoreAndUpdatePrices,
  calculateBestPrice,
  updateProductMetafield,
} from "../controllers/priceController.js";

const router = express.Router();

router.get("/fetch", fetchStoreAndUpdatePrices);
router.get("/calculate/:productId", calculateBestPrice);
router.put("/update/:productId", updateProductMetafield);

export default router;
