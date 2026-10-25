// In-page router standing in for next/link and next/navigation in the
// single-file artifact build. Same API surface the app uses, no URL changes.

import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

const KEY = "shapers-artifact-route";
let current = "/";
try {
  current = sessionStorage.getItem(KEY) || "/";
} catch {}
const history: string[] = [];
const subs = new Set<() => void>();

export function navigate(href: string, replace = false) {
  if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return;
  if (!replace) history.push(current);
  current = href;
  try {
    sessionStorage.setItem(KEY, href);
  } catch {}
  subs.forEach((f) => f());
  if (!replace) window.scrollTo(0, 0);
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

export function useHref(): string {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

export function usePathname(): string {
  return useHref().split("?")[0];
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(useHref().split("?")[1] ?? "");
}

// One stable object, like Next's router: effects that depend on it must not re-run every render.
const router = {
  push: (h: string) => navigate(h),
  replace: (h: string) => navigate(h, true),
  back: () => {
    const prev = history.pop() ?? "/";
    current = prev;
    subs.forEach((f) => f());
  },
};

export function useRouter() {
  return router;
}

export function useParams<T extends Record<string, string>>(): T {
  const m = usePathname().match(/^\/(?:team|meetings)\/([^/]+)/);
  return { id: m ? decodeURIComponent(m[1]) : "" } as unknown as T;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; scroll?: boolean };

export default function Link({ href, onClick, children, scroll: _scroll, ...rest }: LinkProps) {
  void _scroll;
  return (
    <a
      href="#"
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        onClick?.(e);
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
