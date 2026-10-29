import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { errorJson, unsafeOrigin } from "@/lib/api";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ImageKind = { extension: "jpg" | "png" | "webp"; mime: string };

function detectImage(bytes: Buffer): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mime: "image/jpeg" };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: "png", mime: "image/png" };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { extension: "webp", mime: "image/webp" };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;

  const user = await currentUser();
  if (!user || user.role !== "admin") return errorJson("Admin access required", 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorJson("Upload a valid image file");
  }

  const entry = formData.get("image");
  if (!(entry instanceof File)) return errorJson("Choose an image file");
  if (entry.size <= 0) return errorJson("The selected image is empty");
  if (entry.size > MAX_IMAGE_BYTES) return errorJson("Image must be 5 MB or smaller");
  if (!["image/jpeg", "image/png", "image/webp"].includes(entry.type)) {
    return errorJson("Only JPG, PNG, and WEBP images are supported");
  }

  const bytes = Buffer.from(await entry.arrayBuffer());
  const imageKind = detectImage(bytes);
  if (!imageKind || imageKind.mime !== entry.type) {
    return errorJson("The file contents do not match a supported image type");
  }

  const filename = `${randomUUID()}.${imageKind.extension}`;
  const uploadDirectory = path.join(process.cwd(), "public", "uploads", "products");
  try {
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(path.join(uploadDirectory, filename), bytes, { flag: "wx" });
  } catch (error) {
    console.error("Flipazon image upload failed:", error);
    return errorJson("Could not save image on this server. Check folder permissions and disk space", 500);
  }

  return NextResponse.json({ image: `/uploads/products/${filename}`, mime: imageKind.mime }, { status: 201 });
}
