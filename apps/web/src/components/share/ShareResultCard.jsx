import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { trackShareEvent } from "../../lib/apiClient";

// Builds a share URL with UTM attribution so we can measure which platform
// actually brings new visitors back to the site.
function buildShareUrl(baseUrl, source) {
  try {
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.set("utm_source", source);
    url.searchParams.set("utm_medium", "social");
    url.searchParams.set("utm_campaign", "result_share");
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export default function ShareResultCard({
  title,
  subtitle,
  shareText,
  shareCaptions = [],
  onDownload,
  getShareFile,
  resultId = null,
  sharePath = null
}) {
  const [copyState, setCopyState] = useState("Copy link");
  const [isOpen, setIsOpen] = useState(false);
  const captions = shareCaptions.length > 0 ? shareCaptions : [shareText || subtitle || title];
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState(0);
  const selectedCaption = captions[selectedCaptionIndex] || captions[0];
  // Prefer the public result URL (sharePath) so new visitors actually see the
  // result; fall back to the current page when persistence is unavailable.
  const baseShareUrl = sharePath
    ? new URL(sharePath, window.location.origin).toString()
    : window.location.href;

  const platformUrl = (source) => buildShareUrl(baseShareUrl, source);

  // Keep links outside the model output so they are always valid, attributed,
  // and separated from the caption by a blank line on every platform.
  const shareCaption = (source) => {
    const quizUrl = buildShareUrl("/quiz", source);
    const stickerUrl = buildShareUrl("/pet", source);
    return `${selectedCaption}\n\nFind your pet match: ${quizUrl}\nCreate your own pet sticker: ${stickerUrl}`;
  };

  // Web intents must open synchronously inside the click handler: awaiting first
  // (image generation, navigator.share) makes popup blockers silently block the tab.
  const shareLinks = [
    {
      label: "Facebook",
      platform: "facebook",
      icon: "fab fa-facebook-f",
      url: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(platformUrl("facebook"))}`
    },
    {
      label: "X",
      platform: "x",
      icon: "fab fa-x-twitter",
      url: () => `https://twitter.com/intent/tweet?url=${encodeURIComponent(platformUrl("x"))}&text=${encodeURIComponent(shareCaption("x"))}`
    },
    // Instagram has no web share intent with a caption field, so copy the caption first.
    {
      label: "Instagram",
      platform: "instagram",
      icon: "fab fa-instagram",
      url: () => "https://www.instagram.com/",
      copyCaption: true
    }
  ];

  const openShareLink = (url) => {
    window.open(url, "_blank", "noopener,noreferrer,width=640,height=560");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(platformUrl("copy"));
      setCopyState("Copied");
      window.setTimeout(() => setCopyState("Copy link"), 1800);
      trackShareEvent(resultId, "copy");
    } catch {
      setCopyState("Copy failed");
    }
  };

  // Attaches the real generated image via the OS share sheet (Instagram, X, Messages, etc.),
  // where supported. Triggered by the dedicated native share button only.
  const shareImageFile = async () => {
    if (!getShareFile || !navigator.share || !navigator.canShare) {
      return false;
    }

    try {
      const file = await getShareFile();
      if (!file || !navigator.canShare({ files: [file] })) {
        return false;
      }

      await navigator.share({ files: [file], title, text: shareCaption("native") });
      trackShareEvent(resultId, "native");
      return true;
    } catch (error) {
      return error?.name === "AbortError";
    }
  };

  const handlePlatformShare = (shareLink) => {
    if (shareLink.copyCaption) {
      navigator.clipboard
        .writeText(shareCaption(shareLink.platform))
        .catch(() => {
          // Ignore clipboard restrictions; the platform tab still opens.
        });
    }
    trackShareEvent(resultId, shareLink.platform);
    openShareLink(shareLink.url());
  };

  const canNativeShare = Boolean(getShareFile && navigator.share && navigator.canShare);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button type="button" className="btn btn-primary share-trigger" onClick={() => setIsOpen(true)}>
        Share Result
      </button>
      {isOpen && createPortal(
        <div className="share-modal" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <article
            className="share-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-result-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="share-modal-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close sharing popup"
            >
              <i className="fas fa-xmark" aria-hidden="true" />
            </button>
            <div className="share-result-heading">
              <h3 id="share-result-title">{title}</h3>
              <p>{subtitle}</p>
            </div>
            <label className="share-caption-picker">
              <span>Choose your caption</span>
              <select
                value={selectedCaptionIndex}
                onChange={(event) => setSelectedCaptionIndex(Number(event.target.value))}
              >
                {captions.map((caption, index) => (
                  <option key={`${caption}-${index}`} value={index}>
                    {caption}
                  </option>
                ))}
              </select>
            </label>
            <div className="share-result-actions">
              {shareLinks.map((shareLink) => (
                <button
                  key={shareLink.label}
                  type="button"
                  className="share-icon-button"
                  onClick={() => handlePlatformShare(shareLink)}
                  aria-label={`Share on ${shareLink.label}`}
                  title={`Share on ${shareLink.label}`}
                >
                  <i className={shareLink.icon} aria-hidden="true" />
                </button>
              ))}
              {canNativeShare && (
                <button
                  type="button"
                  className="share-icon-button"
                  onClick={shareImageFile}
                  aria-label="Share image with more apps"
                  title="Share image with more apps"
                >
                  <i className="fas fa-share-nodes" aria-hidden="true" />
                </button>
              )}
              <button type="button" className="share-text-button" onClick={copyLink}>
                <i className="fas fa-link" aria-hidden="true" /> {copyState}
              </button>
              {onDownload && (
                <button type="button" className="share-text-button share-native-button" onClick={onDownload}>
                  <i className="fas fa-download" aria-hidden="true" /> Download img
                </button>
              )}
            </div>
          </article>
        </div>,
        document.body
      )}
    </>
  );
}
