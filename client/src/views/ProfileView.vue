<script setup>
import { ref, computed, watch } from 'vue';
import {
  MapPin,
  Navigation,
  Users,
  Pencil,
  Share2,
  MoreHorizontal,
  UserMinus,
  Link2,
  Briefcase,
  CalendarDays,
  Clock3,
  UserX,
  Sparkles,
  Award,
} from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useRealtimeStore } from '@/stores/realtime';
import { toast } from '@/composables/useToast';
import { getProfession } from '@/constants/professions';
import { formatDistance, lastSeenLabel, formatCount } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiBadge from '@/components/ui/UiBadge.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSkeleton from '@/components/ui/UiSkeleton.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiDropdown from '@/components/ui/UiDropdown.vue';
import ProfessionBadge from '@/components/ProfessionBadge.vue';
import ConnectButton from '@/components/ConnectButton.vue';
import ExperienceTimeline from '@/components/profile/ExperienceTimeline.vue';
import ExperienceEditor from '@/components/profile/ExperienceEditor.vue';

const props = defineProps({ id: { type: String, required: true } });

const auth = useAuthStore();
const realtime = useRealtimeStore();

const user = ref(null);
const loading = ref(true);
const error = ref('');
const confirmRemove = ref(false);
const removing = ref(false);
const editorOpen = ref(false);
const editingEntry = ref(null);
const editorKind = ref('work');

function openEditor(entry, kind = entry?.kind || 'work') {
  editingEntry.value = entry;
  editorKind.value = kind;
  editorOpen.value = true;
}

const profession = computed(() => getProfession(user.value?.profession));
const online = computed(() =>
  user.value?.isMe ? realtime.connected && user.value.showOnlineStatus : realtime.isOnline(user.value?.id, user.value?.online),
);
const lastSeen = computed(() => realtime.lastSeen(user.value?.id, user.value?.lastSeenAt));
const memberSince = computed(() =>
  user.value ? new Date(user.value.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '',
);

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/users/${props.id}`);
    user.value = data.user;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}

watch(() => props.id, () => load(), { immediate: true });
watch(() => realtime.networkVersion, () => load({ silent: true }));
watch(
  () => auth.user,
  (me) => {
    if (user.value?.isMe && me) user.value = { ...user.value, ...me };
  },
);

function onStatusChange({ status }) {
  const wasConnected = user.value.connectionStatus === 'connected';
  user.value.connectionStatus = status;
  if (status === 'connected' && !wasConnected) user.value.connectionCount++;
  load({ silent: true });
}

async function removeConnection() {
  removing.value = true;
  try {
    await api.delete(`/connections/${user.value.id}`);
    user.value.connectionStatus = 'none';
    user.value.connectionCount = Math.max(0, user.value.connectionCount - 1);
    confirmRemove.value = false;
    toast.success(`${user.value.name} was removed from your network`);
    auth.fetchMe().catch(() => {});
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    removing.value = false;
  }
}

async function share() {
  const url = `${location.origin}/u/${user.value.id}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${user.value.name} on ProfileHUB`, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Profile link copied');
    }
  } catch {
    /* user dismissed the share sheet */
  }
}
</script>

<template>
  <div class="container profile">
    <template v-if="loading">
      <UiCard :padded="false" class="overflow-hidden">
        <UiSkeleton height="180px" radius="0" />
        <div class="stack" style="--gap: 12px; padding: 0 24px 24px; margin-top: -56px">
          <UiSkeleton width="120px" height="120px" radius="50%" />
          <UiSkeleton width="40%" height="24px" />
          <UiSkeleton width="60%" height="14px" />
        </div>
      </UiCard>
    </template>

    <UiCard v-else-if="error">
      <UiEmpty :icon="UserX" title="Profile unavailable" :description="error">
        <UiButton to="/" variant="secondary">Back to Discover</UiButton>
      </UiEmpty>
    </UiCard>

    <template v-else-if="user">
      <UiCard :padded="false" class="header" :style="{ '--hue': profession.hue }">
        <div class="cover">
          <component :is="profession.icon" class="cover__watermark" aria-hidden="true" />
        </div>

        <div class="header__body">
          <div class="header__top">
            <UiAvatar :name="user.name" :src="user.avatarUrl" :size="128" :online="online" ring class="header__avatar" />
            <div class="header__actions">
              <template v-if="user.isMe">
                <UiButton to="/settings" variant="secondary" :icon="Pencil">Edit profile</UiButton>
                <UiButton variant="secondary" :icon="Share2" icon-only aria-label="Share profile" @click="share" />
              </template>
              <template v-else>
                <ConnectButton :user="user" @change="onStatusChange" />
                <UiDropdown>
                  <template #trigger="{ toggle }">
                    <UiButton variant="secondary" :icon="MoreHorizontal" icon-only aria-label="More actions" @click="toggle" />
                  </template>
                  <button type="button" class="menu-item" @click="share"><Link2 /> Share profile</button>
                  <template v-if="user.connectionStatus === 'connected'">
                    <div class="menu-sep" />
                    <button type="button" class="menu-item menu-item--danger" @click="confirmRemove = true">
                      <UserMinus /> Remove connection
                    </button>
                  </template>
                </UiDropdown>
              </template>
            </div>
          </div>

          <div class="header__info">
            <div class="row wrap" style="--gap: 10px">
              <h1 class="header__name">{{ user.name }}</h1>
              <ProfessionBadge :profession="user.profession" />
            </div>
            <p class="header__role">{{ user.roleTitle || 'No role added yet' }}</p>
            <p v-if="user.headline && user.headline !== user.roleTitle" class="muted">{{ user.headline }}</p>

            <div class="header__meta">
              <span v-if="user.city"><MapPin /> {{ user.city }}</span>
              <span v-if="user.distanceKm != null" class="accent"><Navigation /> {{ formatDistance(user.distanceKm) }}</span>
              <UiBadge :tone="online ? 'success' : 'neutral'" dot>{{ lastSeenLabel(online, lastSeen) }}</UiBadge>
            </div>

            <div class="header__stats">
              <component :is="user.isMe ? 'RouterLink' : 'div'" :to="user.isMe ? '/network' : undefined" class="stat">
                <strong>{{ formatCount(user.connectionCount) }}</strong>
                <span>connections</span>
              </component>
              <div v-if="!user.isMe && user.mutualCount" class="stat stat--mutual">
                <div class="avatars">
                  <UiAvatar v-for="m in user.mutualPreview" :key="m.id" :name="m.name" :src="m.avatarUrl" :size="28" ring />
                </div>
                <span>
                  <strong>{{ user.mutualCount }}</strong> mutual {{ user.mutualCount === 1 ? 'connection' : 'connections' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </UiCard>

      <div class="columns">
        <div class="stack" style="--gap: 16px">
          <UiCard>
            <h2 class="section-title">About</h2>
            <p v-if="user.bio" class="bio">{{ user.bio }}</p>
            <UiEmpty
              v-else-if="user.isMe"
              compact
              :icon="Sparkles"
              title="Tell people about yourself"
              description="A short bio helps others decide to connect."
            >
              <UiButton to="/settings" size="sm" variant="soft">Add a bio</UiButton>
            </UiEmpty>
            <p v-else class="subtle bio">{{ user.name.split(' ')[0] }} hasn't written a bio yet.</p>
          </UiCard>

          <ExperienceTimeline
            kind="work"
            :items="user.experiences"
            :editable="user.isMe"
            @add="openEditor(null, $event)"
            @edit="openEditor($event)"
          />
          <ExperienceTimeline
            kind="education"
            :items="user.experiences"
            :editable="user.isMe"
            @add="openEditor(null, $event)"
            @edit="openEditor($event)"
          />

          <UiCard>
            <h2 class="section-title">Skills</h2>
            <div v-if="user.skills?.length" class="skills">
              <span v-for="s in user.skills" :key="s" class="skill">{{ s }}</span>
            </div>
            <p v-else class="subtle bio">{{ user.isMe ? 'Add skills from settings so people can find you.' : 'No skills listed.' }}</p>
          </UiCard>
        </div>

        <UiCard as="aside" class="details">
          <h2 class="section-title">Details</h2>
          <ul>
            <li>
              <span class="details__icon"><component :is="profession.icon" /></span>
              <div><small>Profession</small>{{ profession.label }}</div>
            </li>
            <li v-if="user.roleTitle">
              <span class="details__icon"><Briefcase /></span>
              <div><small>Role</small>{{ user.roleTitle }}</div>
            </li>
            <li>
              <span class="details__icon"><Award /></span>
              <div>
                <small>Experience</small>
                {{ user.experienceYears ? `${user.experienceYears}+ years` : 'Getting started' }}
              </div>
            </li>
            <li v-if="user.city">
              <span class="details__icon"><MapPin /></span>
              <div><small>Location</small>{{ user.city }}</div>
            </li>
            <li>
              <span class="details__icon"><Users /></span>
              <div><small>Network</small>{{ user.connectionCount }} connections</div>
            </li>
            <li>
              <span class="details__icon"><CalendarDays /></span>
              <div><small>Member since</small>{{ memberSince }}</div>
            </li>
            <li v-if="!online && lastSeen">
              <span class="details__icon"><Clock3 /></span>
              <div><small>Last active</small>{{ lastSeenLabel(false, lastSeen).replace('Active ', '') }}</div>
            </li>
          </ul>
        </UiCard>
      </div>
    </template>

    <ExperienceEditor
      v-if="user?.isMe"
      v-model:open="editorOpen"
      :entry="editingEntry"
      :kind="editorKind"
      @saved="user.experiences = $event"
    />

    <UiSheet v-model:open="confirmRemove" title="Remove connection?" width="420px">
      <p class="muted">
        {{ user?.name }} won't be notified, but you'll need to send a new invitation to chat again.
      </p>
      <template #footer>
        <UiButton variant="secondary" class="grow" @click="confirmRemove = false">Cancel</UiButton>
        <UiButton variant="danger" class="grow" :icon="UserMinus" :loading="removing" @click="removeConnection">Remove</UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1040px;
}
.overflow-hidden,
.header {
  overflow: hidden;
}
.cover {
  position: relative;
  height: clamp(120px, 22vw, 200px);
  background: radial-gradient(80% 120% at 0% 0%, hsl(var(--hue) 90% 75%), transparent 60%),
    radial-gradient(60% 100% at 100% 100%, hsl(calc(var(--hue) + 50) 80% 60%), transparent 60%),
    linear-gradient(135deg, hsl(var(--hue) 70% 52%), hsl(calc(var(--hue) + 30) 70% 45%));
  overflow: hidden;
}
.cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.22) 1.2px, transparent 1.2px);
  background-size: 18px 18px;
  mask-image: linear-gradient(to left, black, transparent 75%);
}
.cover__watermark {
  position: absolute;
  right: 6%;
  top: 50%;
  width: clamp(110px, 18vw, 180px);
  height: clamp(110px, 18vw, 180px);
  transform: translateY(-50%) rotate(-12deg);
  color: rgba(255, 255, 255, 0.18);
  stroke-width: 1.4;
}
.header__body {
  padding: 0 clamp(16px, 3vw, 28px) clamp(18px, 3vw, 26px);
}
.header__top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.header__avatar {
  margin-top: -64px;
}
.header__actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
}
.header__info {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.header__name {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 800;
}
.header__role {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-2);
}
.header__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: 4px;
  font-size: 0.9rem;
  color: var(--text-2);
}
.header__meta > span:not(.badge) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.header__meta svg {
  width: 16px;
  height: 16px;
}
.header__meta .accent {
  color: hsl(var(--hue) 65% 45%);
  font-weight: 600;
}
[data-theme='dark'] .header__meta .accent {
  color: hsl(var(--hue) 85% 72%);
}
.header__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  margin-top: 10px;
}
.stat {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: var(--text-2);
}
a.stat:hover strong {
  text-decoration: underline;
}
.stat strong {
  font-size: 1.15rem;
  color: var(--primary);
}
.stat--mutual {
  align-items: center;
  gap: 10px;
}
.stat--mutual strong {
  font-size: inherit;
  color: var(--text);
}
.avatars {
  display: flex;
}
.avatars > * + * {
  margin-left: -8px;
}

.columns {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr);
}
.bio {
  margin-top: 10px;
  white-space: pre-line;
  color: var(--text-2);
}
.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.skill {
  padding: 7px 14px;
  border-radius: 99px;
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
  font-size: 0.86rem;
}
.details ul {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.details li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  font-size: 0.92rem;
}
.details small {
  display: block;
  font-weight: 500;
  font-size: 0.76rem;
  color: var(--text-3);
}
.details__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--surface-3);
  color: var(--text-2);
}
.details__icon svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 559px) {
  .header__top {
    flex-direction: column;
    align-items: flex-start;
  }
  .header__actions {
    width: 100%;
  }
  .header__actions > :first-child {
    flex: 1;
  }
  .header__actions > :first-child :deep(.btn) {
    width: 100%;
  }
}

@media (min-width: 900px) {
  .columns {
    grid-template-columns: minmax(0, 1fr) 320px;
    align-items: start;
  }
  .details {
    position: sticky;
    top: calc(var(--nav-h) + 24px);
  }
}
</style>
