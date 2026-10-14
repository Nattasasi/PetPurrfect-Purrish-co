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

export default function StickerSaveFlow({ stickerUrl, breed, active }) {
  const { user } = useAuth();

  const save = async (getIdToken) => {
    const blob = await (await fetch(stickerUrl)).blob();
    if (!/^image\/(png|webp|jpeg)$/.test(blob.type)) throw new Error("unsupported_image");
    const storagePath = `users/${user.uid}/stickers/${crypto.randomUUID()}.${blob.type.split("/")[1]}`;
    await uploadBytes(ref(getCustomerStorage(), storagePath), blob, { contentType: blob.type });
    await meRequest(await getIdToken(), "/stickers", "POST", { breed, storagePath });
  };

  return (
    <SaveFlow
      itemId={stickerUrl ? stickerKey(stickerUrl) : null}
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
