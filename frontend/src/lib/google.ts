/**
 * Google Identity Services, loaded only if it is going to be used.
 *
 * The browser flow is not the app flow. On the web Google hands back an ID
 * token directly through a callback, so there is no redirect, no popup to be
 * blocked, and nothing to store — the token goes straight to the server, is
 * exchanged for the session cookie, and is never kept.
 *
 * The script is fetched from Google rather than bundled because it is the
 * supported distribution and because Google rotates it; a vendored copy would
 * quietly go stale. It is injected on demand, so a build with no client id
 * configured never talks to Google at all.
 */

/** Public identifier, safe in the bundle — it is not a secret. */
export const GOOGLE_CLIENT_ID: string | undefined =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;

const SRC = "https://accounts.google.com/gsi/client";

type GsiButtonOptions = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "small" | "medium" | "large";
  text?: "signin_with" | "signup_with" | "continue_with";
  shape?: "rectangular" | "pill";
  width?: number;
  logo_alignment?: "left" | "center";
};

type Gsi = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (r: { credential?: string }) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }): void;
      renderButton(parent: HTMLElement, options: GsiButtonOptions): void;
    };
  };
};

declare global {
  interface Window { google?: Gsi }
}

let pending: Promise<Gsi> | null = null;

/**
 * Resolve once the script is ready. Cached, because two mounts of the login
 * page must not inject two copies — the second would re-register the callback
 * and the first button would stop responding.
 */
export function loadGoogle(): Promise<Gsi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (pending) return pending;

  pending = new Promise<Gsi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new Error("Google sign-in loaded but did not initialise."));
    });
    // An ad blocker or an offline machine lands here. The caller hides the
    // button rather than showing one that cannot work.
    script.addEventListener("error", () => {
      pending = null;
      reject(new Error("Google sign-in could not be loaded."));
    });
    if (!existing) document.head.appendChild(script);
  });

  return pending;
}
