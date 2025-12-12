<script lang="ts" setup>
const localePath = useLocalePath()
</script>

<template>
  <!-- Navigation -->
  <nav class="fixed h-16 top-0 left-0 right-0 z-50 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
    <UContainer class="flex h-full items-center justify-between">
      <NuxtLink
        :to="localePath('/')"
        class="flex items-center gap-2"
      >
        <Logo />
      </NuxtLink>

      <slot name="center" />
      <slot name="right" />
    </UContainer>
  </nav>
</template>
