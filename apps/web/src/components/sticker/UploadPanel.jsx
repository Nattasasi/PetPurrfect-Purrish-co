export default function UploadPanel() {
  return (
    <article>
      <p>Upload JPG/PNG, then run local CV inference and map features to illustration layers.</p>
      <input type="file" accept="image/png,image/jpeg" />
      <button>Generate Sticker</button>
    </article>
  );
}
