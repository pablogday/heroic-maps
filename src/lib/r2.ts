import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 client (S3-compatible). Single shared instance — the SDK
 * pools connections internally.
 *
 * R2 specifics worth knowing:
 *   - The endpoint must include the account id; region is "auto".
 *   - Public reads are served via the R2.dev subdomain (`R2_PUBLIC_URL`)
 *     once the bucket has Public Access enabled. Writes always go
 *     through the SDK with credentials.
 */

// Read process.env lazily — scripts call dotenv.config() after imports
// are hoisted, so anything captured at module-load time would be empty.
export function getR2Bucket() {
  return process.env.R2_BUCKET ?? "heroic-maps";
}
export function getR2PublicUrl() {
  return process.env.R2_PUBLIC_URL ?? "";
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (_client) return _client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
    );
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

/** Upload a buffer or stream under a given key. */
export async function r2Put(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Fetch an object's bytes. */
export async function r2Get(key: string): Promise<Buffer> {
  const res = await client().send(
    new GetObjectCommand({ Bucket: getR2Bucket(), Key: key })
  );
  const stream = res.Body as ReadableStream | undefined;
  if (!stream) throw new Error(`r2Get: empty body for key ${key}`);
  const chunks: Buffer[] = [];
  // @ts-expect-error — Node stream iterator typings vary by version
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Returns true if the object exists (HEAD doesn't transfer body). */
export async function r2Exists(key: string): Promise<boolean> {
  try {
    await client().send(
      new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key })
    );
    return true;
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "$metadata" in e &&
      (e as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    ) {
      return false;
    }
    throw e;
  }
}

/** Delete an object. Idempotent on R2. */
export async function r2Delete(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key })
  );
}

/**
 * Build the public URL for a key. Requires `R2_PUBLIC_URL` to be set
 * (the bucket's public r2.dev subdomain or your custom domain).
 */
export function r2PublicUrl(key: string): string {
  const base = getR2PublicUrl();
  if (!base) {
    throw new Error("R2_PUBLIC_URL is not set");
  }
  return `${base.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}
