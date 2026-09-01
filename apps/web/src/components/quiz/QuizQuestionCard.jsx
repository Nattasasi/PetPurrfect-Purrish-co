export default function QuizQuestionCard({ question }) {
  if (!question) {
    return <p>No question found.</p>;
  }

  return (
    <article>
      <h3>{question.text}</h3>
      <ul>
        {question.options.map((option) => (
          <li key={option.value}>{option.label}</li>
        ))}
      </ul>
    </article>
  );
}
