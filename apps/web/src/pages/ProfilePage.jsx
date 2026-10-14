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

export default function ProfilePage() {
  const { user, loading, getIdToken } = useAuth();
  const [results, setResults] = useState(null);
  const [pets, setPets] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [stickers, setStickers] = useState([]);
  const [emailReminders, setEmailReminders] = useState(true);
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
    const withUrls = await Promise.all(st.stickers.map(async (item) => (
      { ...item, url: await getDownloadURL(ref(storage, item.storagePath)).catch(() => null) }
    )));
    setStickers(withUrls);
  }, [call]);

  useEffect(() => {
    if (user) refresh().catch(() => setResults((current) => current ?? []));
  }, [user, refresh]);

  if (loading) return <section className="page-header"><p role="status">Loading...</p></section>;
  if (!user) return <Navigate to="/login?next=%2Fprofile" replace />;

  const petName = (id) => pets.find((pet) => pet.id === id)?.name || "Pet";
  const act = (path, method, payload) => call(path, method, payload).then(refresh).catch(() => {});

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
    <>
      <section className="page-header">
        <h1>My Profile</h1>
        <p>{user.displayName || user.email}</p>
      </section>

      <section className="info-section">
        {error && <p className="quiz-error" role="alert">{error}</p>}

        <div className="info-card">
          <h2>My pets</h2>
          {pets.length === 0 && <p>Add your pet to get reminders and care tips for their breed.</p>}
          {pets.map((pet) => <PetCard key={pet.id} pet={pet} call={call} act={act} refresh={refresh} />)}
          <PetForm call={call} onSaved={refresh} />
        </div>

        <div className="info-card">
          <h2>Reminders</h2>
          <label>
            <input
              type="checkbox"
              checked={emailReminders}
              onChange={(event) => call("/preferences", "PUT", { emailReminders: event.target.checked }).then((p) => setEmailReminders(p.emailReminders)).catch(() => {})}
            /> Email me when reminders are due
          </label>
          {reminders.filter((item) => !item.done).length === 0 && <p>No reminders yet.</p>}
          {reminders.filter((item) => !item.done).map((item) => (
            <div key={item.id} className="saved-result">
              <div>
                <strong>{item.title}</strong>
                <p>{petName(item.petId)} · due {item.dueDate}{item.repeat !== "none" ? ` · repeats ${item.repeat}` : ""}</p>
              </div>
              <button className="btn btn-outline" type="button" onClick={() => act(`/reminders/${item.id}/complete`, "POST")}>Done</button>
              <button className="btn btn-outline" type="button" onClick={() => act(`/reminders/${item.id}`, "DELETE")}>Delete</button>
            </div>
          ))}
          {pets.length > 0 && <ReminderForm pets={pets} call={call} onSaved={refresh} />}
        </div>

        <div className="info-card">
          <h2>Saved stickers</h2>
          {stickers.length === 0 && <p>No stickers saved yet. <Link to="/pet">Make one with Purrify</Link>.</p>}
          {stickers.map((item) => (
            <div key={item.id} className="saved-result">
              {item.url && <img src={item.url} alt={`${item.breed} sticker`} width="96" height="96" />}
              <div>
                <strong>{item.breed}</strong>
                <p>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</p>
              </div>
              <button className="btn btn-outline" type="button" onClick={() => removeSticker(item)}>Delete</button>
            </div>
          ))}
        </div>

        <div className="info-card">
          <h2>Saved quiz results</h2>
          {results === null && <p role="status">Loading...</p>}
          {results?.length === 0 && <p>Nothing saved yet. <Link to="/quiz">Take the quiz</Link> and save your match.</p>}
          {results?.map((item) => (
            <div key={item.id} className="saved-result">
              <img src={resolvePetImageUrl(item.imageUrl, item.matchId, item.matchName)} alt={item.matchName || "Pet match"} width="72" height="72" />
              <div>
                <strong>{item.matchName || "Pet match"}</strong>
                <p>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</p>
                <Link to={`/quiz/result/${item.id}`}>View result</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function PetCard({ pet, call, act, refresh }) {
  const [editing, setEditing] = useState(false);
  const [panel, setPanel] = useState(null);
  const [items, setItems] = useState([]);

  const open = async (kind) => {
    if (panel === kind) return setPanel(null);
    const body = await call(`/pets/${pet.id}/${kind}`).catch(() => null);
    if (!body) return;
    setItems(body[kind]);
    setPanel(kind);
  };
  const addReminder = (item) => act("/reminders", "POST", {
    petId: pet.id, type: item.type, title: item.title, repeat: item.repeat, dueDate: item.dueDate
  });

  if (editing) {
    return (
      <PetForm
        call={call}
        pet={pet}
        onSaved={async () => { await refresh(); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="pet-card">
      <strong>{pet.name}</strong> <span>({pet.species}{pet.breedId ? `, ${pet.breedId.replace(/_/g, " ")}` : ""})</span>
      <div className="quiz-buttons">
        <button className="btn btn-outline" type="button" onClick={() => open("suggestions")}>Care tips</button>
        <button className="btn btn-outline" type="button" onClick={() => open("presets")}>Suggested reminders</button>
        <button className="btn btn-outline" type="button" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn btn-outline" type="button" onClick={() => window.confirm(`Delete ${pet.name} and their reminders?`) && act(`/pets/${pet.id}`, "DELETE")}>Delete</button>
      </div>
      {panel === "suggestions" && items.map((card) => (
        <div key={card.id} className="suggestion-card">
          <strong>{card.title}</strong> <em>{card.category}</em>
          <p>{card.body}</p>
          {card.reminder && <button className="btn btn-outline" type="button" onClick={() => addReminder(card.reminder)}>Add as reminder</button>}
        </div>
      ))}
      {panel === "presets" && items.map((preset) => (
        <div key={preset.title} className="suggestion-card">
          <strong>{preset.title}</strong>
          <p>First due {preset.dueDate}, repeats {preset.repeat}. General guidance; confirm with your vet.</p>
          <button className="btn btn-outline" type="button" onClick={() => addReminder(preset)}>Add</button>
        </div>
      ))}
    </div>
  );
}

function PetForm({ call, pet, onSaved, onCancel }) {
  const [open, setOpen] = useState(Boolean(pet));
  const [form, setForm] = useState(pet
    ? { ...EMPTY_PET, ...pet, breedId: pet.breedId || "", birthDate: pet.birthDate || "", weightKg: pet.weightKg ?? "" }
    : EMPTY_PET);
  const [breeds, setBreeds] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || breeds.length) return;
    getJson("/api/quiz/profiles").then((data) => setBreeds(data.breeds || [])).catch(() => {});
  }, [open, breeds.length]);

  if (!open) return <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>Add a pet</button>;

  const set = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event.target.value,
    ...(key === "species" ? { breedId: "" } : {})
  }));
  const options = breeds.filter((breed) => breed.petType === form.species).sort((a, b) => a.name.localeCompare(b.name));

  const submit = async (event) => {
    event.preventDefault();
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
      if (!pet) {
        setForm(EMPTY_PET);
        setOpen(false);
      }
      await onSaved();
    } catch {
      // Error is shown by the page.
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Name<input value={form.name} onChange={set("name")} maxLength={60} required /></label>
      <label>Species
        <select value={form.species} onChange={set("species")}>
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
        </select>
      </label>
      <label>Breed
        <select value={form.breedId} onChange={set("breedId")}>
          <option value="">Mixed / unknown</option>
          {options.map((breed) => <option key={breed.id} value={breed.id}>{breed.name}</option>)}
        </select>
      </label>
      <label>Birth date<input type="date" value={form.birthDate} onChange={set("birthDate")} max={new Date().toISOString().slice(0, 10)} /></label>
      <label>Weight (kg)<input type="number" min="0.1" max="150" step="0.1" value={form.weightKg} onChange={set("weightKg")} /></label>
      <div className="quiz-buttons">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save pet"}</button>
        <button className="btn btn-outline" type="button" onClick={() => { setOpen(false); onCancel?.(); }}>Cancel</button>
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
    <form className="auth-form" onSubmit={submit}>
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
      <button className="btn btn-primary" type="submit">Add reminder</button>
    </form>
  );
}
