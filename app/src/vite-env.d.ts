/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SEMA_WFS_AUTHKEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
