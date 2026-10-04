function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInt(name, fallback, max) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return value;
}

export function getAuthSecret() {
  const secret = required("MCP_SHARED_SECRET");
  if (secret.length < 32) {
    throw new Error("MCP_SHARED_SECRET must be at least 32 characters");
  }
  return secret;
}

export function getSshConfig() {
  const keyB64 = required("SSH_PRIVATE_KEY_B64");
  const privateKey = Buffer.from(keyB64, "base64").toString("utf8");

  if (!privateKey.includes("PRIVATE KEY")) {
    throw new Error("SSH_PRIVATE_KEY_B64 did not decode to a private key");
  }

  return {
    host: required("SSH_HOST"),
    port: positiveInt("SSH_PORT", 22, 65535),
    username: required("SSH_USER"),
    privateKey,
    hostKeySha256: process.env.SSH_HOST_KEY_SHA256?.trim() || null,
    maxCommandSeconds: positiveInt("MAX_COMMAND_SECONDS", 120, 300),
    maxOutputBytes: positiveInt("MAX_OUTPUT_BYTES", 200000, 5000000)
  };
}
