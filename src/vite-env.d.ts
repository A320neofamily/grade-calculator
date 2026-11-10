/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MASTER_UID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
