<script setup>
const model = defineModel({ type: String, required: true });
defineProps({
  /** [{ key, label, count?, icon? }] */
  tabs: { type: Array, required: true },
});
</script>

<template>
  <div class="tabs scroll-x" role="tablist">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      role="tab"
      class="tab"
      :class="{ 'is-active': model === t.key }"
      :aria-selected="model === t.key"
      @click="model = t.key"
    >
      <component :is="t.icon" v-if="t.icon" class="tab__icon" aria-hidden="true" />
      <span>{{ t.label }}</span>
      <span v-if="t.count" class="tab__count">{{ t.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.tabs {
  padding: 4px;
  background: var(--surface-3);
  border-radius: var(--radius);
  gap: 4px;
}
.tab {
  flex: 1 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.9rem;
  scroll-snap-align: start;
  transition: background-color 0.2s var(--ease), color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.tab:hover {
  color: var(--text);
}
.tab.is-active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}
.tab__icon {
  width: 17px;
  height: 17px;
}
.tab__count {
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 99px;
  background: var(--primary);
  color: #fff;
  font-size: 0.72rem;
  display: inline-grid;
  place-items: center;
}
</style>
