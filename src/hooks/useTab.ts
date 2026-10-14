import { useSearchParams } from "react-router";

/** Tab sederhana yang disimpan di query string (?tab=…), sehingga bisa ditautkan langsung. */
export function useTab<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const current = (tabs as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;
  const set = (tab: T) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      },
      { replace: true },
    );
  return [current, set];
}
