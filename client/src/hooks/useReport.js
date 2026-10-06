import { useEffect, useState } from "react";

// Loads one report for the chosen cycle. An empty cycle asks the server for its default,
// which is the most recently completed one.
export function useReport(load, cycle) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    load(cycle || undefined)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [load, cycle]);

  return { data, error, loading: !data && !error };
}
