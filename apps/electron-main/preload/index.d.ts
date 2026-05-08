import type { RendererApi } from './index'
import type { AvatarImportPlan } from '../../../packages/contracts/ts/avatar-import-plan'

export type AvatarImportBridge = {
  pickAvatarFolder(): Promise<string | null>
  requestImportPlan(folder: string): Promise<AvatarImportPlan>
  commitAvatarOverrides(plan: AvatarImportPlan): Promise<{ status: string; path: string }>
}

declare global {
  interface Window {
    api: RendererApi
  }
}

export {}
