import { useMemo } from "react";
import SaveFlow from "./SaveFlow";
import { useAuth } from "../auth/AuthProvider.js";
import { ref, uploadBytes } from "firebase/storage";
import { meRequest } from "../lib/apiClient";
import { getCustomerStorage } from "../lib/firebaseClient";

// Short stable id for the current sticker image, used to avoid saving or prompting twice.
function stickerKey(url) {
  let hash = 5381;
  for (let i = 0; i < url.length; i += 1) hash = ((hash * 33) ^ url.charCodeAt(i)) >>> 0;
  return `sticker:${url.length}:${hash}`;
}

// Composed stickers are ~4500px; downscale so the PNG fits the 2MB storage rule.
async function downscaleToPng(url, maxSize = 1024) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("unsupported_image"))), "image/png"));
}

export default function StickerSaveFlow({ stickerUrl, breed, active }) {
  const { user } = useAuth();
  // Identical composites hash the same, so add a nonce to keep a repeat generation from being treated as already saved/dismissed.
  const itemId = useMemo(() => (stickerUrl ? `${stickerKey(stickerUrl)}:${Date.now()}` : null), [stickerUrl]);

  const save = async (getIdToken) => {
    const blob = await downscaleToPng(stickerUrl);
    if (!/^image\/(png|webp|jpeg)$/.test(blob.type)) throw new Error("unsupported_image");
    const storagePath = `users/${user.uid}/stickers/${crypto.randomUUID()}.${blob.type.split("/")[1]}`;
    await uploadBytes(ref(getCustomerStorage(), storagePath), blob, { contentType: blob.type });
    await meRequest(await getIdToken(), "/stickers", "POST", { breed, storagePath });
  };

  return (
    <SaveFlow
      itemId={itemId}
      save={save}
      savedText="Sticker saved to your profile"
      errorText="Couldn't save your sticker."
      modalTitle="Keep your sticker"
      modalBody="Create a free account to save this sticker to your profile, add your pet and get care reminders."
      next="/pet"
      active={active}
    />
  );
}
