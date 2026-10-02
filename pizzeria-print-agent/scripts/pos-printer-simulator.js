const fs = require("fs");
const net = require("net");
const path = require("path");

const host = process.env.POS_SIM_HOST || "0.0.0.0";
const port = Number(process.env.POS_SIM_PORT || 9100);
const outputDir = path.resolve(process.env.POS_SIM_OUTPUT_DIR || path.join(__dirname, "..", "tmp", "pos-simulator"));

function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function stripEscPos(buffer) {
  return buffer
    .toString("latin1")
    .replace(/\x1b[@!Eadmt]\x00?/g, "")
    .replace(/\x1d[Vv]\x00?/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function saveTicket(buffer, remoteAddress) {
  ensureOutputDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeRemote = String(remoteAddress || "unknown").replace(/[^a-zA-Z0-9_.-]/g, "_");
  const basename = `${timestamp}-${safeRemote}`;
  const binPath = path.join(outputDir, `${basename}.bin`);
  const txtPath = path.join(outputDir, `${basename}.txt`);

  fs.writeFileSync(binPath, buffer);
  fs.writeFileSync(txtPath, `${stripEscPos(buffer)}\n`, "utf8");

  return { binPath, txtPath };
}

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("POS_SIM_PORT must be a positive integer");
}

ensureOutputDir();

const server = net.createServer((socket) => {
  const chunks = [];

  socket.on("data", (chunk) => {
    chunks.push(chunk);
  });

  socket.on("end", () => {
    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) return;

    const result = saveTicket(buffer, socket.remoteAddress);
    console.log(`ticket received: ${buffer.length} bytes`);
    console.log(`raw: ${result.binPath}`);
    console.log(`text: ${result.txtPath}`);
  });
});

server.on("error", (error) => {
  console.error(`POS simulator failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`POS printer simulator listening on ${host}:${port}`);
  console.log(`Tickets will be written to ${outputDir}`);
});
