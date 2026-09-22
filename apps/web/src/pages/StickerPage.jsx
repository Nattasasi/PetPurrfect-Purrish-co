import { useEffect, useRef } from "react";
import { exportStickerResultImage, createStickerResultImageFile } from "../lib/shareImage";
import { createPetDebugImage, runPetInference } from "../lib/cv/inference";
import { composeStickerImage } from "../lib/stickerComposer";
import { useInMemoryPageState } from "../lib/inMemoryPageState";
import { generateStickerCaptions } from "../lib/apiClient";
import ShareResultCard from "../components/share/ShareResultCard";
import { trackEvent } from "../../../../js/ingestion-client.mjs";

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("We couldn't load the image. Please try again."));
    image.src = url;
  });
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

const DEBUG_STICKERS = [
  { breed: "Siberian Husky", furColor: "silver", faceShape: "long" },
  { breed: "Golden Retriever", furColor: "golden", faceShape: "round" },
  { breed: "Shiba Inu", furColor: "orange", faceShape: "pointed" },
  { breed: "Ragdoll Cat", furColor: "cream", faceShape: "round" }
];

export default function StickerPage() {
  const inputRef = useRef(null);
  const stickerResultRef = useRef(null);
  const generationRef = useRef(0);
  const generatingRef = useRef(false);
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
  const [shareCaptions, setShareCaptions] = useInMemoryPageState("sticker.shareCaptions", []);
  const [captionsLoading, setCaptionsLoading] = useInMemoryPageState("sticker.captionsLoading", false);

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
    generationRef.current += 1;
    generatingRef.current = false;
    setIsAnalyzing(false);

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
    setShareCaptions([]);
    setCaptionsLoading(false);
  };

  const handleGenerateSticker = async () => {
    if (!imageUrl || generatingRef.current) return;
    generatingRef.current = true;
    const generation = ++generationRef.current;
    setIsAnalyzing(true);
    setAnalysisError("");
    try {
      const img = await loadImage(imageUrl);
      const inference = await runPetInference(img);
      if (generation !== generationRef.current) return;
      if (!inference?.validPet) {
        throw new Error(inference?.reason || "Unable to analyze this image.");
      }
      const debugPreview = createPetDebugImage(img, inference);
      const composedImage = composeStickerImage(inference.breed, inference.attributes);
      // Asset selection alone isn't a completed output: wait for a usable image.
      await loadImage(composedImage);
      if (generation !== generationRef.current) return;
      setAnalysisResult(inference);
      setDetectedAttributes(inference.attributes);
      setComposedStickerUrl(composedImage);
      setDebugImageUrl(debugPreview);
      setAnalysisError("");
      setIsGenerated(true);
      void trackEvent("sticker_generation");

      // Caption generation is non-blocking: the sticker is usable immediately,
      // and the local captions remain available if Ollama cannot be reached.
      setShareCaptions([]);
      setCaptionsLoading(true);
      try {
        const captions = await generateStickerCaptions(inference.breed, inference.attributes);
        if (generation === generationRef.current && captions.length > 0) {
          setShareCaptions(captions);
        }
      } catch {
        // ShareResultCard uses its supplied static caption when Ollama is unavailable.
      } finally {
        if (generation === generationRef.current) setCaptionsLoading(false);
      }
    } catch (error) {
      if (generation === generationRef.current) {
        setAnalysisError(error.message || "Sticker generation failed. Please try again.");
        setIsGenerated(false);
      }
    } finally {
      if (generation === generationRef.current) {
        generatingRef.current = false;
        setIsAnalyzing(false);
      }
    }
  };

  const showDebugSticker = async () => {
    generationRef.current += 1;
    generatingRef.current = false;
    setIsAnalyzing(false);
    const debugSticker = DEBUG_STICKERS[Math.floor(Math.random() * DEBUG_STICKERS.length)];
    const attributes = {
      furColor: debugSticker.furColor,
      faceShape: debugSticker.faceShape,
      earStyle: "pointed",
      petType: debugSticker.breed.toLowerCase().includes("cat") ? "cat" : "dog"
    };
    const composedImage = composeStickerImage(debugSticker.breed, attributes);
    const debugInference = {
      validPet: true,
      breed: debugSticker.breed,
      confidence: Number((0.82 + Math.random() * 0.17).toFixed(3)),
      breedConfidence: Number((0.7 + Math.random() * 0.29).toFixed(3)),
      attributes,
      bodyPartBoxes: {},
      reason: "Debug result"
    };

    setFileName("debug-pet.png");
    setImageUrl(composedImage);
    setAnalysisResult(debugInference);
    setDetectedAttributes(attributes);
    setComposedStickerUrl(composedImage);
    setDebugImageUrl("");
    setAnalysisError("");
    setIsGenerated(true);

    setShareCaptions([]);
    setCaptionsLoading(true);
    try {
      const captions = await generateStickerCaptions(debugSticker.breed, attributes);
      setShareCaptions(captions);
    } catch {
      setShareCaptions([]);
    } finally {
      setCaptionsLoading(false);
    }
  };

  const resetUpload = () => {
    generationRef.current += 1;
    generatingRef.current = false;
    setIsAnalyzing(false);
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
    setShareCaptions([]);
    setCaptionsLoading(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const petDescriptor = analysisResult?.validPet
    ? `${analysisResult.breed} · ${detectedAttributes.furColor || "playful"} fur · ${detectedAttributes.faceShape || "round"} face`
    : "Upload a cat or dog photo to begin analysis";

  const stickerShareCaption = analysisResult?.validPet
    ? `🐾 My pet just got turned into a ${analysisResult.breed} sticker by Purrish&Co! ${capitalize(detectedAttributes.furColor || "playful")} fur, ${detectedAttributes.faceShape || "round"} face, 100% adorable. Get yours free with every order! 🐶✨`
    : "";

  const handleDownload = () => {
    exportStickerResultImage({
      title: "Purrish&Co. Sticker",
      subtitle: "Your custom pet sticker",
      petName: fileName ? fileName.replace(/\.[^/.]+$/, "") : "Your Pet",
      imageUrl: composedStickerUrl || imageUrl
    });
  };

  const getShareFile = () =>
    createStickerResultImageFile({
      title: "Purrish&Co. Sticker",
      subtitle: "Your custom pet sticker",
      petName: fileName ? fileName.replace(/\.[^/.]+$/, "") : "Your Pet",
      imageUrl: composedStickerUrl || imageUrl
    });

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
            {import.meta.env.DEV && (
              <button type="button" className="btn btn-outline debug-launch-button" onClick={showDebugSticker}>
                <i className="fas fa-flask" aria-hidden="true" /> Random Debug Sticker
              </button>
            )}
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

              <ShareResultCard
                title="Share your sticker"
                subtitle={petDescriptor}
                shareText={stickerShareCaption}
                shareCaptions={shareCaptions}
                captionsLoading={captionsLoading}
                onDownload={handleDownload}
                getShareFile={getShareFile}
              />
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
