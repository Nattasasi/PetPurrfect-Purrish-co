export default function ShareResultCard({ title, subtitle }) {
  return (
    <article>
      <div aria-label="result-card-preview">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <button>Download PNG</button>
    </article>
  );
}
