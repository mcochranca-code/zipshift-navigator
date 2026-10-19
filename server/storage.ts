import crypto from "node:crypto";

function storageConfig() {
  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL;
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!forgeUrl || !forgeKey) throw new Error("Storage configuration is unavailable.");
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

export async function storagePut(relKey: string, data: Buffer, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = storageConfig();
  const keyBase = relKey.replace(/^\/+/, "");
  const dot = keyBase.lastIndexOf(".");
  const key = `${dot > 0 ? keyBase.slice(0, dot) : keyBase}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}${dot > 0 ? keyBase.slice(dot) : ""}`;
  const presign = await fetch(`${forgeUrl}/v1/storage/presign/put?path=${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!presign.ok) throw new Error("Unable to authorize secure file storage.");
  const { url } = await presign.json() as { url?: string };
  if (!url) throw new Error("Secure storage did not return an upload URL.");
  const uploaded = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: data });
  if (!uploaded.ok) throw new Error("Unable to upload the secure document.");
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string) {
  const { forgeUrl, forgeKey } = storageConfig();
  const response = await fetch(`${forgeUrl}/v1/storage/presign/get?path=${encodeURIComponent(relKey.replace(/^\/+/, ""))}`, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!response.ok) throw new Error("Unable to authorize secure document download.");
  const { url } = await response.json() as { url?: string };
  if (!url) throw new Error("Secure storage did not return a download URL.");
  return url;
}
