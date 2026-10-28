<script setup>
import { ref, onMounted } from 'vue';
import { MonitorSmartphone, LogOut, Ban, Download, ShieldCheck } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import { timeAgo } from '@/utils/format';
import UiButton from '@/components/ui/UiButton.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiSpinner from '@/components/ui/UiSpinner.vue';

/** "Where you're signed in", blocked members and "Download my data", shown in Settings. */
const sessions = ref([]);
const blocked = ref([]);
const loading = ref(true);
const busy = ref('');

/** "Chrome on Windows" from a user-agent string; good enough to recognise your own devices. */
function deviceName(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'device';
  return `${browser} on ${os}`;
}

async function load() {
  try {
    const [s, b] = await Promise.all([api.get('/users/me/sessions'), api.get('/blocks')]);
    sessions.value = s.data.items;
    blocked.value = b.data.items;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function signOut(session) {
  busy.value = session.id;
  try {
    await api.delete(`/users/me/sessions/${session.id}`);
    sessions.value = sessions.value.filter((s) => s.id !== session.id);
    toast.success(`Signed out ${deviceName(session.userAgent)}`);
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = '';
  }
}

async function signOutOthers() {
  busy.value = 'others';
  try {
    const { data } = await api.post('/users/me/sessions/revoke-others');
    sessions.value = sessions.value.filter((s) => s.current);
    toast.success(data.signedOut ? `Signed out ${data.signedOut} other session${data.signedOut === 1 ? '' : 's'}` : 'No other sessions were signed in');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = '';
  }
}

async function unblock(member) {
  busy.value = member.id;
  try {
    await api.delete(`/blocks/${member.id}`);
    blocked.value = blocked.value.filter((b) => b.id !== member.id);
    toast.success(`${member.name} is unblocked`);
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = '';
  }
}

async function download() {
  busy.value = 'export';
  try {
    const { data } = await api.get('/users/me/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `profilehub-data-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Your data was downloaded');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <div class="safety">
    <section class="block">
      <header class="block__head">
        <div>
          <h3 class="block__title"><MonitorSmartphone /> Where you're signed in</h3>
          <p class="muted">Each browser tab or device you sign in on. Sessions end after 14 days without use.</p>
        </div>
        <UiButton
          v-if="sessions.length > 1"
          variant="secondary"
          size="sm"
          :icon="LogOut"
          :loading="busy === 'others'"
          @click="signOutOthers"
        >
          Sign out all others
        </UiButton>
      </header>
      <div v-if="loading" class="center"><UiSpinner :size="22" /></div>
      <ul v-else class="list">
        <li v-for="s in sessions" :key="s.id">
          <span class="list__icon"><MonitorSmartphone /></span>
          <div class="grow" style="min-width: 0">
            <strong>
              {{ deviceName(s.userAgent) }}
              <UiBadge v-if="s.current" tone="success" dot>This tab</UiBadge>
            </strong>
            <small>
              Active {{ timeAgo(s.lastSeenAt) }} · signed in {{ timeAgo(s.createdAt) }}<template v-if="s.ip"> · {{ s.ip }}</template>
            </small>
          </div>
          <UiButton v-if="!s.current" variant="ghost" size="sm" :loading="busy === s.id" @click="signOut(s)">Sign out</UiButton>
        </li>
      </ul>
    </section>

    <section class="block">
      <header class="block__head">
        <div>
          <h3 class="block__title"><Ban /> Blocked members</h3>
          <p class="muted">They can't message you, invite you or see you in Discover and search, and you won't see them.</p>
        </div>
      </header>
      <p v-if="!loading && !blocked.length" class="subtle empty">You haven't blocked anyone.</p>
      <ul v-else class="list">
        <li v-for="b in blocked" :key="b.id">
          <UiAvatar :name="b.name" :src="b.avatarUrl" :size="36" />
          <div class="grow" style="min-width: 0">
            <strong class="truncate">{{ b.name }}</strong>
            <small>Blocked {{ timeAgo(b.blockedAt) }}</small>
          </div>
          <UiButton variant="ghost" size="sm" :loading="busy === b.id" @click="unblock(b)">Unblock</UiButton>
        </li>
      </ul>
    </section>

    <section class="block">
      <header class="block__head">
        <div>
          <h3 class="block__title"><ShieldCheck /> Your data</h3>
          <p class="muted">
            Download your profile, connections, messages, listings and requests as a JSON file. See our
            <RouterLink to="/privacy" class="link">Privacy policy</RouterLink>.
          </p>
        </div>
        <UiButton variant="secondary" size="sm" :icon="Download" :loading="busy === 'export'" @click="download">
          Download my data
        </UiButton>
      </header>
    </section>
  </div>
</template>

<style scoped>
.safety {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.block + .block {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.block__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px 16px;
}
.block__head p {
  font-size: 0.84rem;
  margin-top: 2px;
}
.block__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 700;
}
.block__title svg {
  width: 17px;
  height: 17px;
  color: var(--primary);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.list strong {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}
.list small {
  display: block;
  font-size: 0.76rem;
  color: var(--text-3);
}
.list__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-2);
}
.list__icon svg {
  width: 18px;
  height: 18px;
}
.center {
  display: grid;
  place-items: center;
  padding: 12px;
}
.empty {
  font-size: 0.86rem;
}
.link {
  color: var(--primary);
  font-weight: 600;
}
</style>
