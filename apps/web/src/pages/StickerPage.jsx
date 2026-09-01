import { useEffect, useRef } from "react";
import { exportStickerResultImage } from "../lib/shareImage";
import { createPetDebugImage, runPetInference } from "../lib/cv/inference";
import { composeStickerImage } from "../lib/stickerComposer";
import { useInMemoryPageState } from "../lib/inMemoryPageState";

export default function StickerPage() {
  const inputRef = useRef(null);
  const stickerResultRef = useRef(null);
  const [imageUrl, setImageUrl] = useInMemoryPageState("sticker.imageUrl", "");
  const [fileName, setFileName] = useInMemoryPageState("sticker.fileName", "");
  const [isGenerated, setIsGenerated] = useInMemoryPageState("sticker.isGenerated", false);
  const [isAnalyzing, setIsAnalyzing] = useInMemoryPageState("sticker.isAnalyzing", false);
  const [analysisError, setAnalysisError] = useInMemoryPageState("sticker.analysisError", "");
  const [analysisResult, setAnalysisResult] = useInMemoryPageState("sticker.analysisResult", null);
  const [debugImageUrl, setDebugImageUrl] = useInMemoryPageState("sticker.debugImageUrl", "");
  const [debugMode, setDebugMode] = useInMemoryPageState("sticker.debugMode", true);
  const [detectedAttributes, setDetectedAttributes] = useInMemoryPageState("sticker.detectedAttributes", {});
  const [composedStickerUrl, setComposedStickerUrl] = useInMemoryPageState("sticker.composedStickerUrl", "");

  useEffect(() => {
    if (isGenerated) {
      stickerResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isGenerated]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageUrl);
    }

    setFileName(file.name);
    setImageUrl(URL.createObjectURL(file));
    setIsGenerated(false);
    setAnalysisResult(null);
    setAnalysisError("");
    setDebugImageUrl("");
    setDetectedAttributes({});
    setComposedStickerUrl("");
  };

  const handleGenerateSticker = async () => {
    if (!imageUrl) {
      return;
    }

    const img = new Image();
    img.onload = async () => {
      setIsAnalyzing(true);
      const inference = await runPetInference(img);
      setAnalysisResult(inference);

      if (!inference?.validPet) {
        setDetectedAttributes({});
        setDebugImageUrl("");
        setAnalysisError(inference?.reason || "Unable to analyze this image.");
        setIsGenerated(false);
        setIsAnalyzing(false);
        return;
      }

      const debugPreview = createPetDebugImage(img, inference);
      const composedImage = composeStickerImage(inference.breed, inference.attributes);

      setDetectedAttributes(inference.attributes);
      setComposedStickerUrl(composedImage);
      setDebugImageUrl(debugPreview);
      setAnalysisError("");
      setIsGenerated(true);
      setIsAnalyzing(false);
    };

    img.onerror = () => {
      setAnalysisError("We couldn't read that image. Please upload another file.");
      setIsGenerated(false);
      setIsAnalyzing(false);
    };

    img.src = imageUrl;
  };

  const handleDownload = () => {
    if (!imageUrl) {
      return;
    }

    exportStickerResultImage({
      title: "Purrish&Co. Sticker",
      subtitle: "Your custom pet sticker",
      petName: fileName ? fileName.replace(/\.[^/.]+$/, "") : "Your Pet",
      imageUrl: composedStickerUrl || imageUrl
    });
  };

  const resetUpload = () => {
    if (imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl("");
    setFileName("");
    setIsGenerated(false);
    setAnalysisResult(null);
    setAnalysisError("");
    setDebugImageUrl("");
    setDetectedAttributes({});
    setComposedStickerUrl("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const petDescriptor = analysisResult?.validPet
    ? `${analysisResult.breed} · ${detectedAttributes.furColor || "playful"} fur · ${detectedAttributes.faceShape || "round"} face`
    : "Upload a cat or dog photo to begin analysis";

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

          <div
            className={`upload-box ${imageUrl ? "upload-box--filled" : ""}`}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleFileChange}
              hidden
            />

            {imageUrl ? (
              <div className="uploaded-preview">
                <img src={imageUrl} alt="Pet upload preview" />
              </div>
            ) : (
              <>
                <i className="fa-solid fa-image" />
                <p>Drag &amp; Drop your image here</p>
                <span>or</span>
                <button type="button" className="btn btn-primary">Choose Image</button>
              </>
            )}
          </div>

          {fileName && (
            <div className="upload-meta">
              <span>{fileName}</span>
              <button type="button" className="btn btn-outline" onClick={resetUpload}>
                Remove
              </button>
            </div>
          )}

          <div className="upload-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerateSticker}
              disabled={!imageUrl || isAnalyzing}
            >
              {isAnalyzing ? "Analyzing..." : "Generate Sticker"}
            </button>
          </div>

          {analysisError && <p className="analysis-error">{analysisError}</p>}
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
            <p>Our AI will identify the breed, fur and body parts.</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-wand-magic-sparkles" />
            <h3>Create Sticker</h3>
            <p>A cute personalized sticker will be generated for your order.</p>
          </div>
        </div>
      </section>

      <section className="preview-section" ref={stickerResultRef}>
        <h2>Your Sticker!</h2>
        <div className="preview-box">
          {imageUrl && isGenerated && analysisResult?.validPet ? (
            <div className="sticker-result">
              <div className="sticker-preview-frame">
                {composedStickerUrl ? (
                  <img src={composedStickerUrl} alt="Composed pet sticker" className="composed-sticker" />
                ) : (
                  <p className="analysis-error">Sticker assets could not be loaded.</p>
                )}
              </div>

              <div className="sticker-result-meta">
                <p className="sticker-detection">Detected: {petDescriptor}</p>
              </div>

              <div className="sticker-result-actions">
                <button type="button" className="btn btn-primary" onClick={handleDownload}>
                  Download Sticker PNG
                </button>
              </div>
            </div>
          ) : (
            <>
              <i className="fa-solid fa-paw" />
              <h3>Your Sticker Will Appear Here</h3>
              <p>Upload a pet image and generate your custom sticker preview.</p>
            </>
          )}
        </div>
      </section>

      {debugMode && imageUrl && analysisResult?.validPet && debugImageUrl && (
        <section className="debug-section">
          <div className="debug-panel">
            <div className="debug-header">
              <h2>Debug Detection</h2>
              <button type="button" className="btn btn-outline" onClick={() => setDebugMode((current) => !current)}>
                {debugMode ? "Hide Debug" : "Show Debug"}
              </button>
            </div>

            <div className="debug-grid">
              <div className="debug-image-wrap">
                <img src={debugImageUrl} alt="Detected pet debug result" className="debug-image" />
              </div>

              <div className="debug-summary">
                <h3>Detected Breed</h3>
                <p className="debug-breed">{analysisResult.breed}</p>
                <p>Detection confidence: {(analysisResult.confidence * 100).toFixed(0)}%</p>
                <p>Breed match confidence: {((analysisResult.breedConfidence || 0) * 100).toFixed(0)}%</p>
                {(analysisResult.breedAlternatives || []).length > 0 && (
                  <>
                    <h4>Other Possibilities</h4>
                    <ul className="part-list">
                      {analysisResult.breedAlternatives.slice(0, 3).map((alt) => (
                        <li key={alt.className}>
                          {alt.className} · {(alt.probability * 100).toFixed(0)}%
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="info-section">
        <div className="info-card">
          <h2>✨ Why Use This Feature?</h2>
          <ul>
            <li>Identify your pet breed automatically</li>
            <li>Box each important pet body part</li>
            <li>Create a personalized cartoon sticker</li>
            <li>Receive a free sticker with every order</li>
          </ul>
        </div>
      </section>
    </>
  );
}
