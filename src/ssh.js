import { createHash, timingSafeEqual } from "node:crypto";
import { Client } from "ssh2";
import { getSshConfig } from "./config.js";

function fingerprintSha256(key) {
  const digest = createHash("sha256")
    .update(key)
    .digest("base64")
    .replace(/=+$/u, "");
  return `SHA256:${digest}`;
}

function safeEqual(a, b) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function appendLimited(state, chunk, maxBytes) {
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  const room = Math.max(0, maxBytes - state.bytes);
  if (room === 0) {
    state.truncated = true;
    return;
  }
  const slice = buf.subarray(0, room);
  state.parts.push(slice);
  state.bytes += slice.length;
  if (slice.length < buf.length) state.truncated = true;
}

export async function runSsh(command, requestedTimeoutSeconds) {
  const cfg = getSshConfig();
  const timeoutSeconds = Math.min(
    requestedTimeoutSeconds ?? cfg.maxCommandSeconds,
    cfg.maxCommandSeconds
  );
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const client = new Client();
    let settled = false;
    let timer;
    const stdout = { parts: [], bytes: 0, truncated: false };
    const stderr = { parts: [], bytes: 0, truncated: false };

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      client.end();
      if (error) reject(error);
      else resolve(result);
    };

    const connection = {
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      privateKey: cfg.privateKey,
      readyTimeout: 60000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 12
    };

    if (cfg.hostKeySha256) {
      connection.hostVerifier = (key) =>
        safeEqual(fingerprintSha256(key), cfg.hostKeySha256);
    }

    client.once("ready", () => {
      timer = setTimeout(() => {
        const error = new Error(`SSH command timed out after ${timeoutSeconds}s`);
        error.code = "SSH_COMMAND_TIMEOUT";
        finish(error);
      }, timeoutSeconds * 1000);

      client.exec(command, (err, stream) => {
        if (err) return finish(err);

        stream.on("data", (chunk) =>
          appendLimited(stdout, chunk, cfg.maxOutputBytes)
        );
        stream.stderr.on("data", (chunk) =>
          appendLimited(stderr, chunk, cfg.maxOutputBytes)
        );

        stream.once("close", (code, signal) => {
          finish(null, {
            host: cfg.host,
            user: cfg.username,
            command,
            exitCode: code ?? null,
            signal: signal ?? null,
            durationMs: Date.now() - startedAt,
            stdout: Buffer.concat(stdout.parts).toString("utf8"),
            stderr: Buffer.concat(stderr.parts).toString("utf8"),
            stdoutTruncated: stdout.truncated,
            stderrTruncated: stderr.truncated
          });
        });
      });
    });

    client.once("error", (err) => finish(err));
    client.connect(connection);
  });
}
