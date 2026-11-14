/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 集市 App 安装包地址（按构建环境注入，留空表示暂未发布） */
  readonly VITE_APP_DOWNLOAD_ANDROID?: string
  readonly VITE_APP_DOWNLOAD_HARMONY?: string
  readonly VITE_APP_DOWNLOAD_WINDOWS?: string
}
