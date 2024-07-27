import mongoose from "mongoose";

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
    index: { expires: "30d" }, // Set TTL index for 30 days
  },
});

const Price = mongoose.model("Price", priceSchema);

export default Price;
