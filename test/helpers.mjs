import { Readable, Writable } from "node:stream";

export function createBufferStream() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  stream.toString = () => Buffer.concat(chunks).toString("utf8");
  return stream;
}

export function createMockStdin(content, { interactive = false } = {}) {
  const source = Array.isArray(content) ? content.join("") : content ?? "";
  const readable = Readable.from([source]);
  readable.setEncoding("utf8");
  readable.isTTY = interactive;
  return readable;
}

export function collectStream(stream) {
  if (!stream || typeof stream.toString !== "function") {
    return "";
  }
  return stream.toString();
}
