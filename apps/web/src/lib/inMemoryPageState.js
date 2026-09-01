import { useState } from "react";

const pageState = new Map();

export function useInMemoryPageState(key, initialValue) {
  const [value, setValue] = useState(() =>
    pageState.has(key)
      ? pageState.get(key)
      : typeof initialValue === "function"
        ? initialValue()
        : initialValue
  );

  const updateValue = (nextValue) => {
    const currentValue = pageState.has(key) ? pageState.get(key) : value;
    const resolvedValue = typeof nextValue === "function"
      ? nextValue(currentValue)
      : nextValue;

    pageState.set(key, resolvedValue);
    setValue(resolvedValue);
  };

  return [value, updateValue];
}
