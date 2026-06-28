export function useDatasetCatalog() {
  const api = useApiClient()
  const catalog = ref<unknown>(null)
  const source = ref<string>('unknown')
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const data = await api.getDatasetCatalog()
      catalog.value = data.catalog
      source.value = data.source
    } catch (err) {
      error.value = String(err)
    } finally {
      loading.value = false
    }
  }

  return { catalog, source, loading, error, refresh }
}
