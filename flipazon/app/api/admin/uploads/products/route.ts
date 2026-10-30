import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { errorJson, unsafeOrigin } from "@/lib/api";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ImageKind = {
  extension: "jpg" | "png" | "webp";
  mime: string;
};

function detectImage(bytes: Buffer): ImageKind | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { extension: "jpg", mime: "image/jpeg" };
  }

  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return { extension: "png", mime: "image/png" };
  }

  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { extension: "webp", mime: "image/webp" };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;

  const user = await currentUser();

  if (!user || user.role !== "admin") {
    return errorJson("Admin access required", 403);
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return errorJson("Upload a valid image file");
  }

  const entry = formData.get("image");

  if (!(entry instanceof File)) {
    return errorJson("Choose an image file");
  }

  if (entry.size <= 0) {
    return errorJson("The selected image is empty");
  }

  if (entry.size > MAX_IMAGE_BYTES) {
    return errorJson("Image must be 5 MB or smaller");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(entry.type)) {
    return errorJson("Only JPG, PNG, and WEBP images are supported");
  }

  const bytes = Buffer.from(await entry.arrayBuffer());
  const imageKind = detectImage(bytes);

  if (!imageKind || imageKind.mime !== entry.type) {
    return errorJson("The file contents do not match a supported image type");
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return errorJson("Cloudinary storage is not configured", 500);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  try {
    const uploaded = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "flipazon/products",
            public_id: randomUUID(),
            resource_type: "image",
            overwrite: false,
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else if (!result) {
              reject(new Error("Cloudinary returned no result"));
            } else {
              resolve(result);
            }
          }
        );

        stream.end(bytes);
      }
    );

    return NextResponse.json(
      {
        image: uploaded.secure_url,
        mime: imageKind.mime,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Flipazon Cloudinary upload failed:", error);
    return errorJson("Could not upload image to Cloudinary", 500);
  }
}