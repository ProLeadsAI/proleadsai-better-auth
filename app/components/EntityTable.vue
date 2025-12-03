<script setup lang="ts">
interface Column {
  key: string
  label: string
  class?: string
}

const props = defineProps<{
  data: any[]
  columns: Column[]
  searchPlaceholder?: string
  emptyIcon?: string
  emptyTitle?: string
  emptyDescription?: string
}>()

const _emit = defineEmits<{
  rowClick: [item: any]
  create: []
}>()

const searchQuery = ref('')

const filteredData = computed(() => {
  if (!searchQuery.value)
    return props.data
  const q = searchQuery.value.toLowerCase()
  return props.data?.filter(item =>
    Object.values(item).some(val =>
      String(val || '').toLowerCase().includes(q)
    )
  ) || []
})
</script>

<template>
  <div>
    <!-- Empty State -->
    <UCard
      v-if="!data?.length"
      class="text-center py-12"
    >
      <UIcon
        :name="emptyIcon || 'i-lucide-inbox'"
        class="w-12 h-12 text-neutral-300 mx-auto mb-4"
      />
      <h3 class="text-lg font-medium mb-2">
        {{ emptyTitle || 'No data yet' }}
      </h3>
      <p class="text-neutral-500 mb-4">
        {{ emptyDescription || 'Create your first item to get started.' }}
      </p>
      <UButton
        label="Create"
        @click="$emit('create')"
      />
    </UCard>

    <!-- Table -->
    <UCard
      v-else
      :ui="{ body: 'p-0' }"
    >
      <!-- Search Bar -->
      <div class="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-4">
        <UInput
          v-model="searchQuery"
          :placeholder="searchPlaceholder || 'Search...'"
          icon="i-lucide-search"
          class="w-64"
        />
      </div>

      <!-- Table -->
      <table class="w-full">
        <thead class="border-b border-neutral-200 dark:border-neutral-800">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-3 text-sm font-medium text-neutral-500"
              :class="[
                col.class || 'text-left'
              ]"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, idx) in filteredData"
            :key="item.id || idx"
            class="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
            @click="$emit('rowClick', item)"
          >
            <slot
              name="row"
              :item="item"
              :columns="columns"
            >
              <td
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-3"
                :class="[col.class]"
              >
                {{ item[col.key] || '—' }}
              </td>
            </slot>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
