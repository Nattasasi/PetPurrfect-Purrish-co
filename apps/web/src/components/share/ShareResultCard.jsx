import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
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
  captionsLoading = false,
  onDownload,
  getShareFile,
  resultId = null,
  sharePath = null,
  crossPromoText = null,
  crossPromoPath = null
}) {
  const [copyState, setCopyState] = useState("Copy link");
  const [isOpen, setIsOpen] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);
  const hasGeneratedCaptions = shareCaptions.length > 0;
  const captions = hasGeneratedCaptions ? shareCaptions : [shareText || subtitle || title];
  // While Ollama captions are still generating, hide the static fallback text
  // so it can't be shared by mistake before the real caption arrives.
  const showCaptionLoading = captionsLoading && !hasGeneratedCaptions;
  // Auto-pick a random caption instead of asking the user to choose one.
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState(0);
  useEffect(() => {
    setSelectedCaptionIndex(Math.floor(Math.random() * captions.length));
  }, [shareCaptions]);
  const selectedCaption = captions[selectedCaptionIndex] || captions[0];
  // Prefer the public result URL (sharePath) so new visitors actually see the
  // result; fall back to the current page when persistence is unavailable.
  const baseShareUrl = sharePath
    ? new URL(sharePath, window.location.origin).toString()
    : window.location.href;

  const platformUrl = (source) => buildShareUrl(baseShareUrl, source);

  // Each post links to only this result (one URL, not the quiz and sticker
  // both) with a short cross-feature prompt; the link itself carries the
  // preview card, so it's only appended as text where a platform has no
  // separate URL field (Instagram copy) to avoid burning the caption limit.
  const shareCaption = (source, { includeUrl = false } = {}) => {
    const lines = [selectedCaption];
    if (crossPromoText) {
      lines.push(crossPromoText);
    }
    if (includeUrl) {
      lines.push(platformUrl(source));
    }
    return lines.join("\n\n");
  };

  // Web intents must open synchronously inside the click handler: awaiting first
  // (image generation, navigator.share) makes popup blockers silently block the tab.
  const shareLinks = [
    {
      label: "Share",
      platform: "social",
      icon: "fas fa-share-nodes",
      url: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(platformUrl("social"))}`,
      copyCaption: true,
      tryShareImage: true
    },
    {
      label: "X",
      platform: "x",
      icon: "fab fa-x-twitter",
      url: () => `https://twitter.com/intent/tweet?url=${encodeURIComponent(platformUrl("x"))}&text=${encodeURIComponent(shareCaption("x"))}`
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
  const handlePlatformShare = async (shareLink) => {
    // Copy caption to clipboard first (before any share attempt)
    // This makes it available for platforms like Facebook/Instagram native apps
    if (shareLink.copyCaption) {
      navigator.clipboard
        .writeText(shareCaption(shareLink.platform, { includeUrl: true }))
        .then(() => {
          setCaptionCopied(true);
          // Clear notification after 2 seconds
          setTimeout(() => setCaptionCopied(false), 2000);
        })
        .catch(() => {
          // Ignore clipboard restrictions; the platform tab still opens.
        });
    }

    // Try to share the image file via OS share sheet for Instagram/Facebook on supported devices
    if (shareLink.tryShareImage && getShareFile && navigator.share && navigator.canShare) {
      try {
        const file = await getShareFile();
        if (file && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title,
            text: shareCaption(shareLink.platform, { includeUrl: true })
          });
          trackShareEvent(resultId, shareLink.platform);
          return;
        }
      } catch (error) {
        // Silently fall through to web dialog if share fails or is aborted
        if (error?.name !== "AbortError") {
          // Non-abort errors still fall back to web dialog
        } else {
          // User cancelled the share
          return;
        }
      }
    }

    // Fall back to web dialog for platforms without image share support
    trackShareEvent(resultId, shareLink.platform);
    openShareLink(shareLink.url());
  };

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
            </div>
            {showCaptionLoading && (
              <div className="share-caption-loading" role="status" aria-live="polite">
                <span className="share-caption-spinner" aria-hidden="true" />
                <span>Generating your caption...</span>
              </div>
            )}
            {hasGeneratedCaptions && !showCaptionLoading && (
              <div className="share-caption-display" role="status" aria-live="polite">
                <p className="share-caption-text">{selectedCaption}</p>
              </div>
            )}
            {crossPromoText && crossPromoPath && (
              <div className="share-cross-promo">
                <p>{crossPromoText}</p>
                <Link to={crossPromoPath} className="share-text-button" onClick={() => setIsOpen(false)}>
                  Try it now <i className="fas fa-arrow-right" aria-hidden="true" />
                </Link>
              </div>
            )}
            {captionCopied && (
              <div className="share-caption-copied-notification" role="status" aria-live="polite">
                <i className="fas fa-check" aria-hidden="true" /> Caption copied to clipboard
              </div>
            )}
            <div className="share-result-actions">
              {shareLinks.map((shareLink) => (
                <button
                  key={shareLink.label}
                  type="button"
                  className="share-icon-button"
                  onClick={() => handlePlatformShare(shareLink)} // supports both image and web fallback
                  aria-label={`Share on ${shareLink.label}`}
                  title={`Share on ${shareLink.label}`}
                >
                  <i className={shareLink.icon} aria-hidden="true" />
                </button>
              ))}

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
