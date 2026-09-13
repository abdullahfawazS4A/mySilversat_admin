/// <reference types="vite/client" />

/**
 * The one environment variable the console reads.
 *
 * Declared explicitly rather than left to `vite/client`'s index signature so
 * a typo in `import.meta.env.VITE_API_BAES` is a compile error, not a silent
 * fallback to the default host at runtime.
 */
interface ImportMetaEnv {
  /** Base URL of the API, without a trailing slash. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
