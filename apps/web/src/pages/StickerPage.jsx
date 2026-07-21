export default function StickerPage() {
  return (
    <>
      <section className="page-header">
        <h1>🐶 For Your Pet</h1>
        <p>
          Upload a photo of your pet and receive a personalized sticker created
          just for them.
        </p>
      </section>

      <section className="upload-section">
        <div className="upload-card">
          <i className="fa-solid fa-cloud-arrow-up upload-icon" />
          <h2>Upload Your Pet Photo</h2>
          <p>Supported formats: JPG, PNG, JPEG</p>
          <div className="upload-box">
            <i className="fa-solid fa-image" />
            <p>Drag &amp; Drop your image here</p>
            <span>or</span>
            <button className="btn btn-primary">Choose Image</button>
          </div>
        </div>
      </section>

      <section className="features">
        <h2>How It Works</h2>
        <div className="cards">
          <div className="card">
            <i className="fa-solid fa-camera" />
            <h3>Upload</h3>
            <p>Upload a clear photo of your pet.</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-brain" />
            <h3>AI Detection</h3>
            <p>Our AI will identify the breed, color and appearance.</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-wand-magic-sparkles" />
            <h3>Create Sticker</h3>
            <p>A cute personalized sticker will be generated for your order.</p>
          </div>
        </div>
      </section>

      <section className="preview-section">
        <h2>Sticker Preview</h2>
        <div className="preview-box">
          <i className="fa-solid fa-paw" />
          <h3>Your Sticker Will Appear Here</h3>
          <p>AI feature coming soon...</p>
        </div>
      </section>

      <section className="info-section">
        <div className="info-card">
          <h2>✨ Why Use This Feature?</h2>
          <ul>
            <li>Identify your pet breed automatically</li>
            <li>Create a personalized cartoon sticker</li>
            <li>Receive a free sticker with every order</li>
            <li>Fun and interactive shopping experience</li>
          </ul>
        </div>
      </section>

      <section className="coming-soon">
        <h2>🚀 Coming Soon</h2>
        <p>
          Our AI-powered sticker generator is currently under development. Stay
          tuned for future updates!
        </p>
      </section>
    </>
  );
}
