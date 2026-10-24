<script setup>
defineProps({
  icon: { type: [Object, Function], default: null },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  compact: Boolean,
});
</script>

<template>
  <div class="empty" :class="{ 'empty--compact': compact }">
    <div v-if="icon" class="empty__icon"><component :is="icon" /></div>
    <h3 class="empty__title">{{ title }}</h3>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <div v-if="$slots.default" class="empty__actions"><slot /></div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 20px;
  gap: 8px;
}
.empty--compact {
  padding: 28px 16px;
}
.empty__icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: var(--primary-soft);
  color: var(--primary);
  margin-bottom: 8px;
}
.empty__icon :deep(svg) {
  width: 28px;
  height: 28px;
}
.empty__title {
  font-size: 1.05rem;
  font-weight: 700;
}
.empty__desc {
  color: var(--text-2);
  max-width: 380px;
}
.empty__actions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
