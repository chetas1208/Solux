import { loadMonorepoEnv } from '../utils/monorepo-env'

export default defineNitroPlugin(() => {
  loadMonorepoEnv()
})
