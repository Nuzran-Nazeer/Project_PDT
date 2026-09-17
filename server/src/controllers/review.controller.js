const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/review.service");

exports.publishReview = asyncHandler(async (req, res) => {
  res.json(await service.publishReview(req.params.id));
});
