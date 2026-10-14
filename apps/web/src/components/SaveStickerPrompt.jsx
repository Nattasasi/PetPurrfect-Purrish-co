import { useState } from "react";
import { Link } from "react-router-dom";
import { ref, uploadBytes } from "firebase/storage";
import { useAuth } from "../auth/AuthProvider.js";
import { meRequest } from "../lib/apiClient";
import { getCustomerStorage } from "../lib/firebaseClient";

// Uploads the generated sticker to the user's Storage folder, then records it via the API.
export default function SaveStickerPrompt({ stickerUrl, breed }) {
  const { user, loading, getIdToken } = useAuth();
  const [status, setStatus] = useState("idle");

  if (loading || !stickerUrl) return null;

  if (status === "saved") {
    return <p role="status">Saved to your profile. <Link to="/profile">View it</Link></p>;
  }

  if (!user) {
    return (
      <p>
        <Link className="btn btn-outline" to="/login?mode=signup&next=%2Fpet">Sign up to save this sticker</Link>
      </p>
    );
  }

  const save = async () => {
    setStatus("saving");
    try {
      const blob = await (await fetch(stickerUrl)).blob();
      if (!/^image\/(png|webp|jpeg)$/.test(blob.type)) throw new Error("unsupported_image");
      const extension = blob.type.split("/")[1];
      const storagePath = `users/${user.uid}/stickers/${crypto.randomUUID()}.${extension}`;
      await uploadBytes(ref(getCustomerStorage(), storagePath), blob, { contentType: blob.type });
      await meRequest(await getIdToken(), "/stickers", "POST", { breed, storagePath });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div>
      {status === "error" && <p className="quiz-error" role="alert">Couldn't save the sticker. Please try again.</p>}
      <button className="btn btn-outline" type="button" disabled={status === "saving"} onClick={save}>
        {status === "saving" ? "Saving..." : "Save sticker to profile"}
      </button>
    </div>
  );
}
