import mongoose from "mongoose";

const THIRTY_DAYS_IN_SECONDS = 2592000;

const priceSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    expires: THIRTY_DAYS_IN_SECONDS
  },
});

const Price = mongoose.model("Price", priceSchema);

export default Price;
