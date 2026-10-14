import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { deleteObject, getDownloadURL, ref } from "firebase/storage";
import { useAuth } from "../auth/AuthProvider.js";
import { getJson, meRequest } from "../lib/apiClient";
import { getCustomerStorage } from "../lib/firebaseClient";
import { resolvePetImageUrl } from "../lib/petImages";

const REMINDER_TYPES = [
  ["vaccine", "Vaccine"], ["vet", "Vet visit"], ["grooming", "Grooming"], ["flea_tick", "Flea and tick"],
  ["deworming", "Deworming"], ["medication", "Medication"], ["custom", "Custom"]
];
const EMPTY_PET = { name: "", species: "dog", breedId: "", birthDate: "", weightKg: "" };
const DETAIL_TITLES = { suggestions: "Care tips", presets: "Suggested reminders", picks: "Shop picks" };
const today = () => new Date().toISOString().slice(0, 10);

function ageLabel(birthDate) {
  if (!birthDate) return "";
  const months = Math.max(0, Math.floor((Date.now() - Date.parse(birthDate)) / (30.44 * 86400000)));
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  return months % 12 ? `${years} yr ${months % 12} mo` : `${years} yr`;
}

export default function ProfilePage() {
  const { user, loading, getIdToken } = useAuth();
  const [results, setResults] = useState(null);
  const [pets, setPets] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [stickers, setStickers] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [emailReminders, setEmailReminders] = useState(true);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  // All /api/me calls go through here so errors surface in one place.
  const call = useCallback(async (path, method, payload) => {
    setError("");
    try {
      return await meRequest(await getIdToken(), path, method, payload);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [getIdToken]);

  const refresh = useCallback(async () => {
    const [r, p, rem, st, prefs] = await Promise.all([call("/results"), call("/pets"), call("/reminders"), call("/stickers"), call("/preferences")]);
    setEmailReminders(prefs.emailReminders);
    setResults(r.results);
    setPets(p.pets);
    setReminders(rem.reminders);
    const storage = getCustomerStorage();
    setStickers(await Promise.all(st.stickers.map(async (item) => (
      { ...item, url: await getDownloadURL(ref(storage, item.storagePath)).catch(() => null) }
    ))));
  }, [call]);

  useEffect(() => {
    if (user) refresh().catch(() => setResults((current) => current ?? []));
  }, [user, refresh]);

  useEffect(() => {
    if (user) getJson("/api/quiz/profiles").then((data) => setBreeds(data.breeds || [])).catch(() => {});
  }, [user]);

  if (loading) return <section className="page-header"><p role="status">Loading...</p></section>;
  if (!user) return <Navigate to="/login?next=%2Fprofile" replace />;

  const act = (path, method, payload) => call(path, method, payload).then(refresh).catch(() => {});
  const breedName = (id) => breeds.find((breed) => breed.id === id)?.name || "Mixed / unknown breed";
  const activeReminders = reminders.filter((item) => !item.done);
  const detailPet = pets.find((pet) => pet.id === detail?.petId);

  const removePet = async (pet) => {
    if (!window.confirm(`Delete ${pet.name} and their reminders?`)) return;
    if (detail?.petId === pet.id) setDetail(null);
    await act(`/pets/${pet.id}`, "DELETE");
  };

  const removeSticker = async (item) => {
    try {
      const { storagePath } = await call(`/stickers/${item.id}`, "DELETE");
      await deleteObject(ref(getCustomerStorage(), storagePath)).catch(() => {});
      await refresh();
    } catch {
      // Error is shown by the page.
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <span className="profile-avatar" aria-hidden="true">{(user.displayName || user.email || "?").charAt(0).toUpperCase()}</span>
        <div>
          <h1>{user.displayName || "My Profile"}</h1>
          <p>{user.email}</p>
        </div>
      </div>
      {error && <p className="quiz-error" role="alert">{error}</p>}

      <h2 className="profile-section-title">Pets</h2>
      <div className="pet-row">
        {pets.map((pet) => (
          <article key={pet.id} className={`pet-tile pet-tile--${pet.species}`}>
            <div className="pet-tile-top">
              <span className="pet-tile-icon" aria-hidden="true"><i className={`fa-solid ${pet.species === "cat" ? "fa-cat" : "fa-dog"}`} /></span>
              <div>
                <h3>{pet.name}</h3>
                <p>{breedName(pet.breedId)}</p>
                <p className="pet-tile-meta">{[ageLabel(pet.birthDate), pet.weightKg ? `${pet.weightKg} kg` : ""].filter(Boolean).join(" · ") || pet.species}</p>
              </div>
            </div>
            <div className="pet-tile-actions">
              <button className="btn btn-sm btn-tips" type="button" onClick={() => setDetail({ petId: pet.id, kind: "suggestions" })}><i className="fa-solid fa-lightbulb" aria-hidden="true" /> Tips</button>
              <button className="btn btn-sm btn-remind" type="button" onClick={() => setDetail({ petId: pet.id, kind: "presets" })}><i className="fa-solid fa-bell" aria-hidden="true" /> Reminders</button>
              <button className="btn btn-sm btn-shop" type="button" onClick={() => setDetail({ petId: pet.id, kind: "picks" })}><i className="fa-solid fa-bag-shopping" aria-hidden="true" /> Shop</button>
            </div>
            <div className="pet-tile-footer">
              <button className="btn btn-sm btn-ghost" type="button" onClick={() => setDetail({ petId: pet.id, kind: "edit" })}><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
              <button className="btn btn-sm btn-danger" type="button" aria-label={`Delete ${pet.name}`} onClick={() => removePet(pet)}><i className="fa-solid fa-trash" aria-hidden="true" /> Delete</button>
            </div>
          </article>
        ))}
        <button className="pet-tile pet-tile--add" type="button" onClick={() => setDetail({ kind: "add" })}>
          <i className="fa-solid fa-plus" aria-hidden="true" />
          <span>Add pet</span>
        </button>
      </div>

      {detail && (detail.kind === "add" || detailPet) && (
        <PetDetail
          key={`${detail.petId || "new"}-${detail.kind}`}
          detail={detail}
          pet={detailPet}
          breeds={breeds}
          call={call}
          act={act}
          refresh={refresh}
          onClose={() => setDetail(null)}
        />
      )}

      <div className="profile-section-head">
        <h2 className="profile-section-title">Reminders</h2>
        <label className="profile-toggle">
          <input
            type="checkbox"
            checked={emailReminders}
            onChange={(event) => call("/preferences", "PUT", { emailReminders: event.target.checked }).then((p) => setEmailReminders(p.emailReminders)).catch(() => {})}
          /> Email me when reminders are due
        </label>
      </div>
      {pets.length === 0 ? (
        <p className="profile-empty">Add a pet to start setting reminders.</p>
      ) : (
        <div className="reminder-grid">
          {pets.map((pet) => {
            const items = activeReminders.filter((item) => item.petId === pet.id);
            return (
              <div key={pet.id} className="info-card profile-card">
                <h3 className="reminder-card-title"><i className={`fa-solid ${pet.species === "cat" ? "fa-cat" : "fa-dog"}`} aria-hidden="true" /> {pet.name}</h3>
                {items.length === 0 && <p className="profile-empty">No reminders yet.</p>}
                {items.map((item) => (
                  <div key={item.id} className="profile-row">
                    <div>
                      <strong>{item.title}</strong>
                      <p className={item.dueDate <= today() ? "is-due" : ""}>
                        Due {item.dueDate}{item.repeat !== "none" ? ` · ${item.repeat}` : ""}
                      </p>
                    </div>
                    <button className="btn btn-sm btn-done" type="button" onClick={() => act(`/reminders/${item.id}/complete`, "POST")}><i className="fa-solid fa-check" aria-hidden="true" /> Done</button>
                    <button className="btn btn-sm btn-danger btn-icon" type="button" aria-label={`Delete reminder ${item.title}`} onClick={() => act(`/reminders/${item.id}`, "DELETE")}><i className="fa-solid fa-trash" aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="info-card profile-card">
            <ReminderForm pets={pets} call={call} onSaved={refresh} />
          </div>
        </div>
      )}

      <div className="profile-extras">
        <div className="info-card profile-card">
          <h2 className="profile-card-title">Saved stickers</h2>
          {stickers.length === 0 && <p className="profile-empty">No stickers saved yet. <Link to="/pet">Make one with Purrify</Link>.</p>}
          {stickers.map((item) => (
            <div key={item.id} className="profile-row">
              {item.url && <img src={item.url} alt={`${item.breed} sticker`} width="72" height="72" />}
              <div>
                <strong>{item.breed}</strong>
                <p>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</p>
              </div>
              <button className="btn btn-sm btn-danger btn-icon" type="button" aria-label={`Delete ${item.breed} sticker`} onClick={() => removeSticker(item)}><i className="fa-solid fa-trash" aria-hidden="true" /></button>
            </div>
          ))}
        </div>

        <div className="info-card profile-card">
          <h2 className="profile-card-title">Saved quiz results</h2>
          {results === null && <p role="status">Loading...</p>}
          {results?.length === 0 && <p className="profile-empty">Nothing saved yet. <Link to="/quiz">Take the quiz</Link> and save your match.</p>}
          {results?.map((item) => (
            <div key={item.id} className="profile-row">
              <img src={resolvePetImageUrl(item.imageUrl, item.matchId, item.matchName)} alt={item.matchName || "Pet match"} width="72" height="72" />
              <div>
                <strong>{item.matchName || "Pet match"}</strong>
                <p>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</p>
                <Link to={`/quiz/result/${item.id}`}>View result</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Full-width panel under the pet row: care tips, suggested reminders, shop picks, or the add/edit form.
function PetDetail({ detail, pet, breeds, call, act, refresh, onClose }) {
  const { kind } = detail;
  const isForm = kind === "add" || kind === "edit";
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (isForm) return undefined;
    let active = true;
    call(`/pets/${pet.id}/${kind}`).then((body) => active && setItems(body[kind])).catch(() => active && setItems([]));
    return () => { active = false; };
  }, [isForm, kind, pet?.id, call]);

  const addReminder = (item) => act("/reminders", "POST", {
    petId: pet.id, type: item.type, title: item.title, repeat: item.repeat, dueDate: item.dueDate
  });

  const title = isForm ? (kind === "add" ? "Add a pet" : `Edit ${pet.name}`) : `${DETAIL_TITLES[kind]} for ${pet.name}`;

  return (
    <div className="info-card profile-card pet-detail">
      <div className="pet-detail-head">
        <h2 className="profile-card-title">{title}</h2>
        <button className="btn btn-sm btn-ghost" type="button" onClick={onClose}><i className="fa-solid fa-xmark" aria-hidden="true" /> Close</button>
      </div>

      {isForm && (
        <PetForm
          pet={kind === "edit" ? pet : undefined}
          breeds={breeds}
          call={call}
          onSaved={async () => { await refresh(); onClose(); }}
          onCancel={onClose}
        />
      )}

      {!isForm && items === null && <p role="status">Loading...</p>}

      {kind === "suggestions" && items && (
        <div className="detail-grid">
          {items.map((card) => (
            <div key={card.id} className="suggestion-card">
              <strong>{card.title}</strong> <em>{card.category}</em>
              <p>{card.body}</p>
              {card.reminder && <button className="btn btn-sm btn-remind" type="button" onClick={() => addReminder(card.reminder)}><i className="fa-solid fa-plus" aria-hidden="true" /> Add as reminder</button>}
            </div>
          ))}
        </div>
      )}

      {kind === "presets" && items && (
        <div className="detail-grid">
          {items.map((preset) => (
            <div key={preset.title} className="suggestion-card">
              <strong>{preset.title}</strong>
              <p>First due {preset.dueDate}, repeats {preset.repeat}. General guidance; confirm with your vet.</p>
              <button className="btn btn-sm btn-remind" type="button" onClick={() => addReminder(preset)}><i className="fa-solid fa-plus" aria-hidden="true" /> Add</button>
            </div>
          ))}
        </div>
      )}

      {kind === "picks" && items && (
        <>
          <div className="detail-grid">
            {items.map((group) => (
              <div key={group.reason} className="suggestion-card">
                <strong>{group.reason}</strong>
                {group.products.length > 0 && (
                  <div className="pick-list">
                    {group.products.map((product) => (
                      <a key={product.id} className="pick-item" href={product.url} target="_blank" rel="sponsored noopener noreferrer">
                        {product.imageUrl && <img src={product.imageUrl} alt="" loading="lazy" width="64" height="64" />}
                        <div className="pick-text">
                          <span>{product.name}</span>
                          {(product.price !== null && product.price !== undefined) ? (
                            <em>{new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(product.price)}</em>
                          ) : product.priceLabel ? <em>{product.priceLabel}</em> : null}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                {group.searchUrl && (
                  <a className="btn btn-sm btn-shop" href={group.searchUrl} target="_blank" rel="sponsored noopener noreferrer">
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Browse on Shopee
                  </a>
                )}
              </div>
            ))}
          </div>
          <p className="profile-note">Some links are affiliate links; we may earn a commission at no extra cost to you. Prices change, so confirm on Shopee.</p>
        </>
      )}
    </div>
  );
}

function PetForm({ call, pet, breeds, onSaved, onCancel }) {
  const [form, setForm] = useState(pet
    ? { ...EMPTY_PET, ...pet, breedId: pet.breedId || "", birthDate: pet.birthDate || "", weightKg: pet.weightKg ?? "" }
    : EMPTY_PET);
  const [query, setQuery] = useState("");
  const [breedError, setBreedError] = useState("");
  const [busy, setBusy] = useState(false);

  // Fill the search box with the saved breed's name once the breed list arrives.
  useEffect(() => {
    const saved = breeds.find((breed) => breed.id === pet?.breedId);
    if (saved) setQuery(saved.name);
  }, [breeds, pet?.breedId]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const options = breeds.filter((breed) => breed.petType === form.species).sort((a, b) => a.name.localeCompare(b.name));

  const changeSpecies = (event) => {
    setForm((current) => ({ ...current, species: event.target.value, breedId: "" }));
    setQuery("");
    setBreedError("");
  };

  const changeBreed = (event) => {
    const text = event.target.value;
    const match = options.find((breed) => breed.name.toLowerCase() === text.trim().toLowerCase());
    setQuery(text);
    setBreedError("");
    setForm((current) => ({ ...current, breedId: match ? match.id : "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (query.trim() && !form.breedId) {
      setBreedError("Choose a breed from the suggestions, or clear the field if unknown.");
      return;
    }
    setBusy(true);
    const payload = {
      name: form.name,
      species: form.species,
      breedId: form.breedId || null,
      birthDate: form.birthDate || null,
      weightKg: form.weightKg === "" ? null : Number(form.weightKg)
    };
    try {
      await (pet ? call(`/pets/${pet.id}`, "PUT", payload) : call("/pets", "POST", payload));
      await onSaved();
    } catch {
      setBusy(false);
    }
  };

  const listId = `breeds-${pet?.id || "new"}`;
  return (
    <form className="profile-form" onSubmit={submit}>
      <label>Name<input value={form.name} onChange={set("name")} maxLength={60} required /></label>
      <label>Species
        <select value={form.species} onChange={changeSpecies}>
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
        </select>
      </label>
      <label>Breed
        <input type="search" list={listId} value={query} onChange={changeBreed} placeholder="Search breeds, or leave blank if mixed" autoComplete="off" />
        <datalist id={listId}>
          {options.map((breed) => <option key={breed.id} value={breed.name} />)}
        </datalist>
        {breedError && <span className="quiz-error" role="alert">{breedError}</span>}
      </label>
      <label>Birth date<input type="date" value={form.birthDate} onChange={set("birthDate")} max={today()} /></label>
      <label>Weight (kg)<input type="number" min="0.1" max="150" step="0.1" value={form.weightKg} onChange={set("weightKg")} /></label>
      <div className="form-actions">
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>{busy ? "Saving..." : "Save pet"}</button>
        <button className="btn btn-sm btn-ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ReminderForm({ pets, call, onSaved }) {
  const [form, setForm] = useState({ petId: pets[0].id, type: "vet", title: "", dueDate: "", repeat: "none" });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    try {
      await call("/reminders", "POST", form);
      setForm((current) => ({ ...current, title: "", dueDate: "" }));
      await onSaved();
    } catch {
      // Error is shown by the page.
    }
  };

  return (
    <form className="profile-form profile-form--stack" onSubmit={submit}>
      <h3>Add a reminder</h3>
      <label>Pet
        <select value={form.petId} onChange={set("petId")}>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select>
      </label>
      <label>Type
        <select value={form.type} onChange={set("type")}>{REMINDER_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      <label>Title<input value={form.title} onChange={set("title")} maxLength={100} required /></label>
      <label>Due date<input type="date" value={form.dueDate} onChange={set("dueDate")} required /></label>
      <label>Repeat
        <select value={form.repeat} onChange={set("repeat")}>
          <option value="none">Does not repeat</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </label>
      <div className="form-actions">
        <button className="btn btn-primary btn-sm" type="submit">Add reminder</button>
      </div>
    </form>
  );
}
