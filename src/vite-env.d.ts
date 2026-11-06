/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Version of the 3D assets, appended to their URLs (see vite.config.ts). */
  readonly VITE_ASSET_V: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
