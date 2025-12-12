<script lang="ts" setup>
const { t } = useI18n()
</script>

<template>
  <footer class="w-full h-26 sm:h-16 border-t border-neutral-200 dark:border-neutral-800 py-4 z-1">
    <div class="container mx-auto px-4">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="flex items-center space-x-2">
          <UIcon name="i-lucide-code" />
          <span>{{ t('global.appName') }}</span>
          <USeparator
            orientation="vertical"
            class="hidden md:block"
          />
          <span class="text-sm text-neutral-500 dark:text-neutral-400">
            © {{ new Date().getFullYear() }} All rights reserved
          </span>
        </div>

        <div class="flex items-center space-x-4">
          <LocaleToggler />
          <ClientOnly>
            <ColorModeToggler />
          </ClientOnly>
        </div>
      </div>
    </div>
  </footer>
</template>
