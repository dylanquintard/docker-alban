const reviewService = require("../services/review.service");

async function getPublicReviews(req, res) {
  try {
    const limit = Number(req.query?.limit);
    const locationId = Number(req.query?.locationId);
    const payload = await reviewService.getPublicReviews({ limit, locationId });
    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unable to load reviews" });
  }
}

module.exports = {
  getPublicReviews,
};
