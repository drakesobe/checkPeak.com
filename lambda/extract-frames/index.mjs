// lambda/extract-frames/index.mjs
// AWS Lambda function — deployed separately from the Next.js app.
//
// Required Lambda layer: FFmpeg (provides /opt/bin/ffmpeg)
//   Public layer ARN (us-east-1): arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:1
//   Or build your own: https://github.com/nicholasgasior/lambda-ffmpeg
//
// Environment variables:
//   FILM_S3_BUCKET  — bucket where raw film lives (same as Next.js app)
//   AWS_REGION      — auto-set by Lambda runtime
//
// IAM permissions needed:
//   s3:GetObject on arn:aws:s3:::${FILM_S3_BUCKET}/raw/*
//   s3:PutObject on arn:aws:s3:::${FILM_S3_BUCKET}/frames/*
//
// Input event:
//   { filmId, playId, s3Key, timestamps: [10.0, 10.5, 11.0] }
//
// Output:
//   { ok: true, frames: [{ timestamp, s3Key, success }] }

import { execSync }                           from "child_process";
import { readFileSync, existsSync, unlinkSync } from "fs";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl }                       from "@aws-sdk/s3-request-presigner";

const s3     = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const BUCKET = process.env.FILM_S3_BUCKET;

const FFMPEG = existsSync("/opt/bin/ffmpeg") ? "/opt/bin/ffmpeg" : "ffmpeg";

export const handler = async (event) => {
  const { filmId, playId, s3Key, timestamps } = event;

  if (!filmId || !playId || !s3Key || !Array.isArray(timestamps)) {
    return { ok: false, error: "Missing required fields: filmId, playId, s3Key, timestamps" };
  }

  // Presigned GET URL so FFmpeg can seek via HTTP range requests
  // (avoids downloading the full video — FFmpeg only fetches the needed bytes)
  const videoUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
    { expiresIn: 300 }
  );

  const frames = [];

  for (const t of timestamps) {
    const tmpPath  = `/tmp/${playId}_${t}.jpg`;
    const frameKey = `frames/${filmId}/${playId}_${t}.jpg`;

    try {
      // -ss before -i = fast seek (keyframe only). Good enough for jersey reading.
      // scale=1280:-1 keeps aspect ratio, downsamples to 720p equivalent.
      execSync(
        `${FFMPEG} -ss ${t} -i "${videoUrl}" -vframes 1 -q:v 3 -vf "scale=1280:-1" "${tmpPath}" -y 2>/dev/null`,
        { timeout: 25_000, stdio: "pipe" }
      );

      const body = readFileSync(tmpPath);

      await s3.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         frameKey,
        Body:        body,
        ContentType: "image/jpeg",
        Metadata:    { filmId, playId, timestamp: String(t) },
      }));

      frames.push({ timestamp: t, s3Key: frameKey, success: true });
    } catch (err) {
      // Non-fatal — return partial results
      frames.push({ timestamp: t, success: false, error: err.message?.slice(0, 200) });
    } finally {
      try { if (existsSync(tmpPath)) unlinkSync(tmpPath); } catch {}
    }
  }

  return { ok: true, filmId, playId, frames };
};
