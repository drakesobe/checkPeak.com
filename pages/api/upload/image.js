import { v2 as cloudinary } from "cloudinary";
import formidable from "formidable";

export const config = {
  api: {
    bodyParser: false, // REQUIRED for file uploads
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: "Failed to parse upload" });
    }

    const file = files?.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const upload = await cloudinary.uploader.upload(file.filepath, {
        folder: "athlete-workouts",
        resource_type: "image",
      });

      return res.status(200).json({
        url: upload.secure_url,
        public_id: upload.public_id,
      });
    } catch (e) {
      console.error("[cloudinary upload]", e);
      return res.status(500).json({ error: "Upload failed" });
    }
  });
}
