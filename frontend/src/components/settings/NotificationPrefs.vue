<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Mail, BellRing, MonitorSmartphone, MessageCircle, Users, Crown, UserCheck, ShieldHalf, TriangleAlert } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/composables/useToast';
import { api, errorMessage } from '@/api/http';
import { pushStatus, enablePush, disablePush } from '@/utils/push';
import UiToggle from '@/components/ui/UiToggle.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiBadge from '@/components/ui/UiBadge.vue';

const { t } = useI18n();
const auth = useAuthStore();
const me = computed(() => auth.user);

const CATEGORIES = computed(() =>
  me.value?.role === 'admin'
    ? [
        { key: 'admin', icon: ShieldHalf },
        { key: 'account', icon: UserCheck },
      ]
    : [
        { key: 'messages', icon: MessageCircle },
        { key: 'network', icon: Users },
        { key: 'plans', icon: Crown },
        { key: 'account', icon: UserCheck },
      ],
);

/** Message, network and plan alerts are plan features; account and admin notices are always on. */
const PLAN_GATED = ['messages', 'network', 'plans'];
const emailLocked = computed(() => me.value?.limits && !me.value.limits.emailAlerts);
const pushLocked = computed(() => me.value?.limits && !me.value.limits.pushAlerts);
const locked = (channel, category) => PLAN_GATED.includes(category) && (channel === 'email' ? emailLocked.value : pushLocked.value);

const saving = reactive({});
const prefs = computed(() => me.value?.notifyPrefs || { email: {}, push: {} });

async function setPref(channel, category, value) {
  const id = `${channel}.${category}`;
  saving[id] = true;
  try {
    await auth.updateSettings({ notifyPrefs: { [channel]: { [category]: value } } });
    toast.success(t('notify.saved'));
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    saving[id] = false;
  }
}

const model = (channel, category) =>
  computed({
    get: () => !locked(channel, category) && prefs.value[channel]?.[category] !== false,
    set: (v) => setPref(channel, category, v),
  });
const toggles = computed(() =>
  Object.fromEntries(CATEGORIES.value.map((c) => [c.key, { email: model('email', c.key), push: model('push', c.key) }])),
);

// ---------- This device ----------
const device = ref({ supported: true, enabled: true, subscribed: false, permission: 'default', devices: 0 });
const deviceLoading = ref(true);
const deviceBusy = ref(false);

async function refreshDevice() {
  try {
    device.value = await pushStatus();
  } catch {
    /* leave the defaults */
  } finally {
    deviceLoading.value = false;
  }
}

const PUSH_ERRORS = { unsupported: 'notify.unsupported', server_off: 'notify.serverOff', denied: 'notify.denied' };

async function toggleDevice() {
  deviceBusy.value = true;
  try {
    if (device.value.subscribed) {
      await disablePush();
      toast.info(t('notify.disabled'));
    } else {
      await enablePush();
      toast.success(t('notify.enabled'));
    }
  } catch (err) {
    toast.error(PUSH_ERRORS[err.code] ? t(PUSH_ERRORS[err.code]) : errorMessage(err));
  } finally {
    deviceBusy.value = false;
    refreshDevice();
  }
}

async function sendTest() {
  deviceBusy.value = true;
  try {
    const { data } = await api.post('/push/test');
    if (data.delivered) toast.success(t('notify.testSent'));
    else toast.error(t('notify.testNone'));
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    deviceBusy.value = false;
  }
}

const deviceProblem = computed(() => {
  if (!device.value.supported) return t('notify.unsupported');
  if (!device.value.enabled) return t('notify.serverOff');
  if (device.value.permission === 'denied') return t('notify.denied');
  return '';
});

onMounted(refreshDevice);
</script>

<template>
  <div class="np">
    <div class="np__device">
      <span class="np__device-icon"><MonitorSmartphone /></span>
      <div class="grow" style="min-width: 0">
        <strong>{{ t('notify.device') }}</strong>
        <p class="muted">{{ device.subscribed ? t('notify.deviceOn') : t('notify.deviceOff') }}</p>
        <p v-if="deviceProblem" class="np__problem"><TriangleAlert /> {{ deviceProblem }}</p>
        <p v-else-if="device.devices" class="subtle">{{ t('notify.devices', { n: device.devices }) }}</p>
      </div>
      <div class="np__device-actions">
        <UiButton v-if="device.subscribed" size="sm" variant="ghost" :disabled="deviceBusy" @click="sendTest">{{ t('notify.test') }}</UiButton>
        <UiButton
          size="sm"
          :variant="device.subscribed ? 'secondary' : 'primary'"
          :loading="deviceBusy || deviceLoading"
          :disabled="!device.supported || !device.enabled"
          @click="toggleDevice"
        >
          {{ device.subscribed ? t('notify.disable') : t('notify.enable') }}
        </UiButton>
      </div>
    </div>

    <p v-if="!me.emailVerifiedAt" class="np__problem"><Mail /> {{ t('notify.emailNeedsVerify') }}</p>
    <p v-if="emailLocked || pushLocked" class="np__plan">
      <Crown />
      <span>{{ emailLocked && pushLocked ? t('notify.bothPlan') : emailLocked ? t('notify.emailPlan') : t('notify.pushPlan') }}</span>
      <RouterLink to="/plans">{{ t('common.viewPlans') }}</RouterLink>
    </p>

    <div class="np__table" role="table" :aria-label="t('notify.title')">
      <div class="np__row np__row--head" role="row">
        <span role="columnheader">{{ t('notify.category') }}</span>
        <span role="columnheader" class="np__col"><Mail /> {{ t('notify.email') }}</span>
        <span role="columnheader" class="np__col"><BellRing /> {{ t('notify.push') }}</span>
      </div>
      <div v-for="c in CATEGORIES" :key="c.key" class="np__row" role="row">
        <div class="np__cat" role="cell">
          <span class="np__cat-icon"><component :is="c.icon" /></span>
          <div>
            <strong>{{ t(`notify.cat.${c.key}`) }}</strong>
            <p class="muted">{{ t(`notify.cat.${c.key}Text`) }}</p>
          </div>
        </div>
        <div class="np__col" role="cell">
          <UiToggle
            v-model="toggles[c.key].email.value"
            :disabled="locked('email', c.key)"
            :loading="saving[`email.${c.key}`]" :aria-label="`${t(`notify.cat.${c.key}`)} · ${t('notify.email')}`" />
        </div>
        <div class="np__col" role="cell">
          <UiToggle
            v-model="toggles[c.key].push.value"
            :disabled="locked('push', c.key)"
            :loading="saving[`push.${c.key}`]" :aria-label="`${t(`notify.cat.${c.key}`)} · ${t('notify.push')}`" />
        </div>
      </div>
    </div>
    <UiBadge v-if="me.emailVerifiedAt" tone="success" dot class="np__verified">{{ t('settings.emailVerified') }}</UiBadge>
  </div>
</template>

<style scoped>
.np {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.np__device {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 14px;
  border-radius: var(--radius);
  background: var(--surface-2);
}
.np__device p {
  font-size: 0.86rem;
}
.np__device-icon,
.np__cat-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--surface);
  color: var(--primary);
}
.np__device-icon svg,
.np__cat-icon svg {
  width: 18px;
  height: 18px;
}
.np__device-actions {
  display: flex;
  gap: 8px;
}
.np__problem {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--warning);
}
.np__problem svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.np__plan {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--primary-soft);
  font-size: 0.84rem;
  color: var(--text-2);
}
.np__plan svg {
  width: 16px;
  height: 16px;
  color: var(--warning);
  flex-shrink: 0;
}
.np__plan a {
  margin-left: auto;
  font-weight: 700;
  color: var(--primary);
}
.np__table {
  display: flex;
  flex-direction: column;
}
.np__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px 72px;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
}
.np__row--head {
  padding-top: 0;
  border-top: 0;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-3);
}
.np__col {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.np__col svg {
  width: 14px;
  height: 14px;
}
.np__cat {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}
.np__cat p {
  font-size: 0.82rem;
}
.np__verified {
  align-self: flex-start;
}
@media (max-width: 479px) {
  .np__row {
    grid-template-columns: minmax(0, 1fr) 56px 56px;
  }
  .np__cat-icon {
    display: none;
  }
}
</style>
