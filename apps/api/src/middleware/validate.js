export function validateQuizRequest(req, res, next) {
  if (!req.body) {
    return res.status(400).json({ error: "Missing request body" });
  }
  next();
}
