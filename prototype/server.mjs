import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const page = new URL("./index.html", import.meta.url);
createServer(async (request, response) => {
  if (request.method !== "GET" || request.url !== "/") {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(await readFile(page));
  } catch {
    response.writeHead(500).end("Prototype unavailable");
  }
}).listen(8173, "127.0.0.1");
