const path = require("path");
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 4174);
const buildDir = path.resolve(__dirname, "build");

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(
  express.static(buildDir, {
    index: false,
  })
);

app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(buildDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`pizzeria-admin-web listening on ${PORT}`);
});
