import { useEffect, useState } from "react";
import { getBreedInfo } from "../lib/apiClient";

export default function BreedInfoCard({ breedId, breedName }) {
  const [breedInfo, setBreedInfo] = useState(null);
  const [loading, setLoading] = useState(Boolean(breedId));

  useEffect(() => {
    if (!breedId) {
      setBreedInfo(null);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    getBreedInfo(breedId).then((info) => {
      if (active) {
        setBreedInfo(info);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [breedId]);

  return (
    <section className="breed-info-card" aria-live="polite">
      <h2>About {breedInfo?.name || breedName || "this breed"}</h2>
      {loading ? (
        <p className="quiz-hint">Loading breed details...</p>
      ) : breedInfo?.info ? (
        <>
          <div className="breed-info-grid">
            <div><strong>Life span</strong><span>{breedInfo.info.lifeSpan || "Not available"}</span></div>
            <div><strong>Origin</strong><span>{breedInfo.info.origin || "Not available"}</span></div>
            <div><strong>Height</strong><span>{breedInfo.info.height || "Not available"}</span></div>
            <div><strong>Weight</strong><span>{breedInfo.info.weight || "Not available"}</span></div>
            <div><strong>Temperament</strong><span>{breedInfo.info.temperament || "Not available"}</span></div>
            <div><strong>Exercise</strong><span>{breedInfo.info.exerciseMinutesDaily ? `${breedInfo.info.exerciseMinutesDaily} min/day` : "Not available"}</span></div>
            <div><strong>Grooming</strong><span>{breedInfo.info.groomingHoursMonthly ? `${breedInfo.info.groomingHoursMonthly} hr/month` : "Not available"}</span></div>
            <div><strong>Price range</strong><span>{breedInfo.info.purchasePrice ? formatPriceRange(breedInfo.info.purchasePrice) : (breedInfo.info.priceResearchUrl ? <a href={breedInfo.info.priceResearchUrl} target="_blank" rel="noreferrer">Check current local prices</a> : "Not available")}</span></div>
            <div><strong>Adoption</strong><span>{breedInfo.info.adoption?.url ? <a href={breedInfo.info.adoption.url} target="_blank" rel="noreferrer">View current listings{breedInfo.info.adoption.location ? ` in ${breedInfo.info.adoption.location}` : ""}</a> : (breedInfo.info.adoption?.message || "Live listings unavailable")}</span></div>
          </div>
          {breedInfo.info.healthNote && (
            <details className="breed-info-note">
              <summary>Care considerations</summary>
              <p>{breedInfo.info.healthNote}</p>
            </details>
          )}
          {breedInfo.info.sources?.length > 0 && (
            <p className="breed-info-sources">
              Current-info sources:{" "}
              {breedInfo.info.sources.map((source, index) => (
                <span key={source.url}>
                  {index > 0 && ", "}
                  <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                </span>
              ))}
              {breedInfo.info.source?.includes("brave-search") && (
                <> · Search results provided by <a href="https://brave.com/search/api/" target="_blank" rel="noreferrer">Brave</a></>
              )}
            </p>
          )}
          <p className="breed-info-disclaimer">Breed information is a general guide, not veterinary advice. Price links and adoption listings are location-aware where supported; verify availability and fees with the linked provider.</p>
        </>
      ) : (
        <p className="quiz-hint">Breed details are unavailable right now. Your match and summary are still available.</p>
      )}
    </section>
  );
}

function formatPriceRange(price) {
  if (!price || (!price.min && !price.max)) return "Not available";
  const currency = price.currency ? ` ${price.currency}` : "";
  if (price.min && price.max) return `${price.min.toLocaleString()}–${price.max.toLocaleString()}${currency}`;
  return `${(price.min || price.max).toLocaleString()}+${currency}`;
}
