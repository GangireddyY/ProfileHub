<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowLeft,
  SendHorizontal,
  Check,
  CheckCheck,
  Clock3,
  CircleAlert,
  Lock,
  RotateCw,
  Trash2,
  ShieldAlert,
  TriangleAlert,
  MoreVertical,
  MoreHorizontal,
  Flag,
  Ban,
  UserRound,
  ImagePlus,
  X,
  Pencil,
  Copy,
  CircleSlash as DeletedIcon,
  MessageSquareX,
} from 'lucide-vue-next';
import { SENSITIVE_PATTERN } from '@/constants/legal';
import { api, errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import { dialog } from '@/composables/useDialog';
import UiDropdown from '@/components/ui/UiDropdown.vue';
import ReportDialog from '@/components/ReportDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useRealtimeStore } from '@/stores/realtime';
import { formatTime, formatDay, lastSeenLabel } from '@/utils/format';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiSpinner from '@/components/ui/UiSpinner.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import ProfessionBadge from '@/components/ProfessionBadge.vue';

const props = defineProps({
  userId: { type: String, required: true },
  /** Pre-filled text, e.g. "Is this still available?" when coming from a listing. */
  initialDraft: { type: String, default: '' },
});

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const { t: tr } = useI18n();
const auth = useAuthStore();
const chat = useChatStore();
const realtime = useRealtimeStore();
/** Photos per message allowed by the member's plan; 0 means photos aren't included. */
const MAX_PHOTOS = computed(() => auth.user?.limits?.maxChatPhotos ?? 4);
/** The member's plan has messaging switched off, so nothing can be sent in any chat. */
const messagingLocked = computed(() => auth.user?.limits?.messaging === false);

const scroller = ref(null);
const input = ref(null);
const fileInput = ref(null);
const draft = ref('');
const draftLooksSensitive = computed(() => SENSITIVE_PATTERN.test(draft.value));

// ---------- Report, block & delete conversation ----------
const reportOpen = ref(false);
const blocking = ref(false);
async function toggleBlock() {
  const blocked = t.value?.blockedByMe;
  const name = other.value?.name || '';
  if (
    !blocked &&
    !(await dialog.confirm({
      title: tr('chat.block', { name }),
      message: tr('chat.blockConfirm', { name }),
      confirmLabel: tr('chat.block', { name: name.split(' ')[0] }),
      tone: 'block',
    }))
  ) {
    return;
  }
  blocking.value = true;
  try {
    if (blocked) await api.delete(`/blocks/${props.userId}`);
    else await api.post(`/blocks/${props.userId}`);
    toast.success(blocked ? tr('chat.unblocked', { name }) : tr('chat.blocked', { name }));
    await chat.openThread(props.userId);
    chat.loadConversations().catch(() => {});
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    blocking.value = false;
  }
}

async function deleteConversation() {
  const confirmed = await dialog.confirm({
    title: tr('chat.deleteChat'),
    message: tr('chat.deleteChatConfirm', { name: other.value?.name || '' }),
    confirmLabel: tr('common.delete'),
    tone: 'danger',
  });
  if (!confirmed) return;
  try {
    await chat.clearConversation(props.userId);
    toast.success(tr('chat.chatDeleted'));
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

const t = computed(() => chat.threads[props.userId]);
const other = computed(() => t.value?.user);
const online = computed(() => realtime.isOnline(props.userId, other.value?.online));
const lastSeen = computed(() => realtime.lastSeen(props.userId, other.value?.lastSeenAt));
const isTyping = computed(() => chat.typing[props.userId]);
const myId = computed(() => auth.user?.id);

/** Flatten messages into rows with day separators and same-sender grouping. */
const rows = computed(() => {
  const out = [];
  let lastDay = null;
  let prev = null;
  for (const m of t.value?.messages || []) {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) {
      out.push({ type: 'day', key: `day-${day}`, label: formatDay(m.createdAt) });
      lastDay = day;
      prev = null;
    }
    const grouped = prev && prev.senderId === m.senderId && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60 * 1000;
    out.push({ type: 'msg', key: m.id, m, mine: m.senderId === myId.value, grouped });
    prev = m;
  }
  return out;
});

function isNearBottom() {
  const el = scroller.value;
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
}

async function scrollToBottom(smooth = false) {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

async function onScroll() {
  const el = scroller.value;
  if (!el || el.scrollTop > 80 || !t.value?.hasMore || t.value.loadingOlder) return;
  const prevHeight = el.scrollHeight;
  const prevTop = el.scrollTop;
  await chat.loadOlder(props.userId);
  await nextTick();
  el.scrollTop = el.scrollHeight - prevHeight + prevTop;
}

// Watch the newest message (not the length) so prepending older history doesn't jump to the bottom.
const lastMessage = computed(() => {
  const list = t.value?.messages;
  return list?.length ? list[list.length - 1] : null;
});
watch(
  () => lastMessage.value?.id,
  (id, prevId) => {
    if (!id || id === prevId) return;
    if (lastMessage.value.senderId === myId.value || isNearBottom()) scrollToBottom(true);
  },
);

watch(isTyping, (v) => v && isNearBottom() && scrollToBottom(true));

// Typing indicator: throttle "typing" pings and send "stopped" after a short pause.
let lastTypingSent = 0;
let typingStopTimer;
function onInput() {
  autoGrow();
  if (!t.value?.canMessage || editing.value) return;
  const now = Date.now();
  if (now - lastTypingSent > 2500) {
    realtime.emit('typing', { to: props.userId, typing: true });
    lastTypingSent = now;
  }
  clearTimeout(typingStopTimer);
  typingStopTimer = setTimeout(() => stopTyping(props.userId), 3000);
}
function stopTyping(to) {
  clearTimeout(typingStopTimer);
  if (lastTypingSent) realtime.emit('typing', { to, typing: false });
  lastTypingSent = 0;
}

function autoGrow() {
  const el = input.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  el.style.overflowY = el.scrollHeight > 140 ? 'auto' : 'hidden';
}

// ---------- Photos ----------
const photos = ref([]);

function addFiles(list) {
  const files = [...(list || [])];
  if (!MAX_PHOTOS.value) return pickPhotos();
  for (const file of files) {
    if (photos.value.length >= MAX_PHOTOS.value) {
      toast.error(tr('chat.maxPhotos', { n: MAX_PHOTOS.value }), { action: { label: tr('common.viewPlans'), to: '/plans' } });
      break;
    }
    if (!PHOTO_TYPES.includes(file.type)) {
      toast.error(tr('chat.photoType'));
      continue;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error(tr('chat.photoTooBig'));
      continue;
    }
    photos.value.push({ file, url: URL.createObjectURL(file), key: `${file.name}-${file.size}-${Math.random()}` });
  }
  if (fileInput.value) fileInput.value.value = '';
  if (photos.value.length) nextTick(() => input.value?.focus());
}

function pickPhotos() {
  if (!MAX_PHOTOS.value) {
    toast.info(tr('chat.photosLocked'), { action: { label: tr('common.viewPlans'), to: '/plans' } });
    return;
  }
  fileInput.value?.click();
}

function removePhoto(key) {
  const p = photos.value.find((x) => x.key === key);
  if (p) URL.revokeObjectURL(p.url);
  photos.value = photos.value.filter((x) => x.key !== key);
}

function clearPhotos() {
  photos.value.forEach((p) => URL.revokeObjectURL(p.url));
  photos.value = [];
}

function onPaste(e) {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length || !t.value?.canMessage || editing.value) return;
  e.preventDefault();
  addFiles(files);
}

// ---------- Edit ----------
const editing = ref(null);

const canEdit = (m) => !m.deletedAt && !m.pending && !m.failed && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;

function startEdit(m) {
  clearPhotos();
  editing.value = m;
  draft.value = m.body;
  nextTick(() => {
    autoGrow();
    input.value?.focus();
  });
}

function cancelEdit() {
  if (!editing.value) return;
  editing.value = null;
  draft.value = '';
  nextTick(autoGrow);
}

async function saveEdit() {
  const m = editing.value;
  const body = draft.value.trim();
  if (!m || (!body && !m.attachments?.length)) return;
  try {
    await chat.editMessage(m.id, body);
    cancelEdit();
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

async function removeMessage(m) {
  const confirmed = await dialog.confirm({
    title: tr('chat.deleteConfirm'),
    message: tr('chat.deleteMessageText'),
    confirmLabel: tr('chat.deleteMessage'),
    tone: 'danger',
  });
  if (!confirmed) return;
  try {
    await chat.deleteMessage(m.id);
    if (editing.value?.id === m.id) cancelEdit();
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

async function copyText(m) {
  try {
    await navigator.clipboard.writeText(m.body);
    toast.success(tr('chat.copied'));
  } catch {
    /* clipboard blocked */
  }
}

// ---------- Send ----------
const canSend = computed(() => Boolean(draft.value.trim() || photos.value.length));

function send() {
  if (editing.value) return saveEdit();
  const body = draft.value.trim();
  if (!canSend.value || !t.value?.canMessage) return;
  draft.value = '';
  nextTick(autoGrow);
  stopTyping(props.userId);
  if (photos.value.length) {
    const files = photos.value.map((p) => p.file);
    clearPhotos();
    chat.sendPhotos(props.userId, files, body);
  } else {
    chat.send(props.userId, body);
  }
  if (!coarsePointer) input.value?.focus();
}

function onKeydown(e) {
  if (e.key === 'Escape' && editing.value) {
    e.preventDefault();
    cancelEdit();
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey && !coarsePointer && !e.isComposing) {
    e.preventDefault();
    send();
  }
}

// ---------- Photo viewer ----------
const viewer = ref(null);
function openViewer(list, index) {
  if (list[index]?.local) return;
  viewer.value = { list, index };
}
function onViewerKey(e) {
  if (e.key === 'Escape') viewer.value = null;
}

function onVisibility() {
  if (document.visibilityState === 'visible') chat.markRead(props.userId);
}

// Runs immediately, so it must stay below every ref and helper it touches (photos, editing, draft…).
watch(
  () => props.userId,
  async (id, oldId) => {
    if (oldId) {
      stopTyping(oldId);
      chat.closeThread(oldId);
    }
    draft.value = oldId ? '' : props.initialDraft;
    clearPhotos();
    cancelEdit();
    await chat.openThread(id);
    scrollToBottom();
    if (draft.value) nextTick(autoGrow);
    if (!coarsePointer || draft.value) input.value?.focus();
  },
  { immediate: true },
);

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onViewerKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('keydown', onViewerKey);
  stopTyping(props.userId);
  chat.closeThread(props.userId);
  clearPhotos();
});
</script>

<template>
  <div class="chat">
    <header class="chat__head">
      <UiButton to="/messages" variant="ghost" :icon="ArrowLeft" icon-only :aria-label="tr('chat.back')" class="chat__back" />
      <RouterLink v-if="other" :to="`/u/${other.id}`" class="chat__who">
        <UiAvatar :name="other.name" :src="other.avatarUrl" :size="42" :online="online" />
        <div class="chat__who-text">
          <strong class="truncate">{{ other.name }}</strong>
          <span class="chat__status" :class="{ 'is-online': online || isTyping }">
            {{ isTyping ? tr('common.typing') : lastSeenLabel(online, lastSeen) }}
          </span>
        </div>
      </RouterLink>
      <ProfessionBadge v-if="other" :profession="other.profession" size="sm" class="chat__badge" />
      <UiDropdown v-if="other && t?.loaded">
        <template #trigger="{ toggle }">
          <UiButton variant="ghost" :icon="MoreVertical" icon-only :aria-label="tr('chat.options')" @click="toggle" />
        </template>
        <RouterLink :to="`/u/${other.id}`" class="menu-item"><UserRound /> {{ tr('common.viewProfile') }}</RouterLink>
        <button v-if="t.messages.length" type="button" class="menu-item" @click="deleteConversation">
          <MessageSquareX /> {{ tr('chat.deleteChat') }}
        </button>
        <div class="menu-sep" />
        <button type="button" class="menu-item menu-item--danger" @click="reportOpen = true"><Flag /> {{ tr('chat.report') }}</button>
        <button type="button" class="menu-item menu-item--danger" @click="toggleBlock">
          <Ban />
          {{ t.blockedByMe ? tr('chat.unblock', { name: other.name.split(' ')[0] }) : tr('chat.block', { name: other.name.split(' ')[0] }) }}
        </button>
      </UiDropdown>
    </header>
    <ReportDialog
      v-if="other"
      v-model:open="reportOpen"
      target-type="conversation"
      :target-id="userId"
      :target-label="tr('chat.reportLabel', { name: other.name })"
    />

    <div ref="scroller" class="chat__scroll" @scroll.passive="onScroll">
      <div v-if="t?.loading" class="chat__center"><UiSpinner :size="28" /></div>

      <UiEmpty v-else-if="t?.error" compact :title="tr('chat.cantOpen')" :description="t.error" />

      <template v-else>
        <div v-if="t?.loadingOlder" class="chat__older"><UiSpinner :size="20" /></div>

        <div v-if="t?.loaded && !t.hasMore" class="safety-note" role="note">
          <ShieldAlert />
          <p>
            <strong>{{ tr('chat.safetyTitle') }}</strong> {{ tr('chat.safetyText') }}
            <RouterLink to="/terms#safety">{{ tr('chat.safetyTips') }}</RouterLink>
          </p>
        </div>

        <div v-if="t?.loaded && !t.messages.length" class="chat__intro">
          <UiAvatar :name="other?.name" :src="other?.avatarUrl" :size="72" />
          <strong>{{ other?.name }}</strong>
          <p class="muted">{{ other?.roleTitle }}</p>
          <p class="subtle">{{ tr('chat.sayHello') }}</p>
        </div>

        <template v-for="row in rows" :key="row.key">
          <div v-if="row.type === 'day'" class="day"><span>{{ row.label }}</span></div>
          <div
            v-else
            class="msg"
            :class="{
              'msg--mine': row.mine,
              'msg--grouped': row.grouped,
              'msg--failed': row.m.failed,
              'msg--editing': editing?.id === row.m.id,
            }"
          >
            <div class="msg__line">
              <div class="bubble" :class="{ 'bubble--deleted': row.m.deletedAt, 'bubble--photos': row.m.attachments?.length && !row.m.deletedAt }">
                <p v-if="row.m.deletedAt" class="bubble__text bubble__deleted">
                  <DeletedIcon /> {{ tr('messages.deleted') }}
                </p>
                <template v-else>
                  <div
                    v-if="row.m.attachments?.length"
                    class="photos"
                    :class="`photos--${Math.min(row.m.attachments.length, 4)}`"
                  >
                    <button
                      v-for="(a, i) in row.m.attachments"
                      :key="a.url"
                      type="button"
                      class="photos__item"
                      :aria-label="tr('chat.openPhoto')"
                      @click="openViewer(row.m.attachments, i)"
                    >
                      <img :src="a.url" alt="" loading="lazy" :width="a.width || undefined" :height="a.height || undefined" />
                    </button>
                    <span v-if="row.m.pending" class="photos__progress">{{ tr('chat.uploading', { p: row.m.progress || 0 }) }}</span>
                  </div>
                  <p v-if="row.m.body" class="bubble__text">{{ row.m.body }}</p>
                </template>
                <span class="bubble__meta">
                  <span v-if="row.m.editedAt && !row.m.deletedAt" class="bubble__edited">{{ tr('messages.edited') }} ·</span>
                  {{ formatTime(row.m.createdAt) }}
                  <template v-if="row.mine">
                    <Clock3 v-if="row.m.pending" class="tick" :aria-label="tr('chat.sending')" />
                    <CircleAlert v-else-if="row.m.failed" class="tick" :aria-label="tr('chat.failed')" />
                    <CheckCheck v-else-if="row.m.readAt" class="tick tick--read" :aria-label="tr('chat.read')" />
                    <Check v-else class="tick" :aria-label="tr('chat.sent')" />
                  </template>
                </span>
              </div>

              <UiDropdown
                v-if="!row.m.deletedAt && !row.m.pending && !row.m.failed && (row.m.body || row.mine)"
                class="msg__menu"
                :align="row.mine ? 'right' : 'left'"
              >
                <template #trigger="{ toggle }">
                  <button type="button" class="msg__menu-btn" :aria-label="tr('chat.messageActions')" @click="toggle">
                    <MoreHorizontal />
                  </button>
                </template>
                <button v-if="row.m.body" type="button" class="menu-item" @click="copyText(row.m)"><Copy /> {{ tr('chat.copy') }}</button>
                <template v-if="row.mine">
                  <button v-if="canEdit(row.m) && t.canMessage" type="button" class="menu-item" @click="startEdit(row.m)">
                    <Pencil /> {{ tr('chat.editMessage') }}
                  </button>
                  <button type="button" class="menu-item menu-item--danger" @click="removeMessage(row.m)">
                    <Trash2 /> {{ tr('chat.deleteMessage') }}
                  </button>
                </template>
              </UiDropdown>
            </div>
            <p v-if="!row.mine && !row.m.deletedAt && SENSITIVE_PATTERN.test(row.m.body)" class="msg__warn">
              <TriangleAlert /> {{ tr('chat.sensitiveIncoming') }}
            </p>
            <div v-if="row.m.failed" class="msg__failed">
              <span>{{ row.m.error || tr('chat.notSent') }}</span>
              <button type="button" @click="chat.retry(userId, row.m.id)"><RotateCw /> {{ tr('common.retry') }}</button>
              <button type="button" @click="chat.discard(userId, row.m.id)"><Trash2 /> {{ tr('common.delete') }}</button>
            </div>
          </div>
        </template>

        <Transition name="fade">
          <div v-if="isTyping" class="msg">
            <div class="bubble bubble--typing" :aria-label="tr('common.typing')"><span /><span /><span /></div>
          </div>
        </Transition>
      </template>
    </div>

    <div v-if="t?.loaded && !t.canMessage" class="chat__locked">
      <template v-if="t.blockedByMe">
        <Ban />
        <span>{{ tr('chat.youBlocked') }}</span>
        <UiButton size="sm" variant="soft" :loading="blocking" @click="toggleBlock">{{ tr('chat.unblockShort') }}</UiButton>
      </template>
      <template v-else-if="t.unavailable">
        <Lock />
        <span>{{ tr('chat.unavailable') }}</span>
      </template>
      <template v-else-if="messagingLocked">
        <Lock />
        <span>{{ tr('chat.planLocked') }}</span>
        <UiButton to="/plans" size="sm" variant="soft">{{ tr('chat.seePlans') }}</UiButton>
      </template>
      <template v-else>
        <Lock />
        <span>{{ tr('chat.locked') }}</span>
        <UiButton :to="`/u/${userId}`" size="sm" variant="soft">{{ tr('common.viewProfile') }}</UiButton>
      </template>
    </div>

    <template v-else>
      <p v-if="draftLooksSensitive" class="composer__warn" role="alert">
        <TriangleAlert />
        {{ tr('chat.sensitiveDraft') }}
      </p>
      <div v-if="editing" class="composer__banner">
        <Pencil />
        <div class="grow">
          <strong>{{ tr('chat.editing') }}</strong>
          <span class="truncate">{{ editing.body }}</span>
        </div>
        <button type="button" :aria-label="tr('chat.cancelEdit')" @click="cancelEdit"><X /></button>
      </div>
      <div v-if="photos.length" class="composer__photos">
        <div v-for="p in photos" :key="p.key" class="composer__photo">
          <img :src="p.url" alt="" />
          <button type="button" :aria-label="tr('chat.removePhoto')" @click="removePhoto(p.key)"><X /></button>
        </div>
      </div>
      <form class="composer" @submit.prevent="send">
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          hidden
          @change="addFiles($event.target.files)"
        />
        <button
          v-if="!editing"
          type="button"
          class="composer__attach"
          :aria-label="tr('chat.attach')"
          :title="tr('chat.attach')"
          :class="{ 'is-locked': !MAX_PHOTOS }"
          :disabled="!t?.loaded || (MAX_PHOTOS > 0 && photos.length >= MAX_PHOTOS)"
          @click="pickPhotos"
        >
          <ImagePlus />
        </button>
        <textarea
          ref="input"
          v-model="draft"
          rows="1"
          maxlength="2000"
          :placeholder="photos.length ? tr('chat.captionPlaceholder') : tr('chat.placeholder')"
          :aria-label="tr('chat.messageLabel')"
          enterkeyhint="send"
          :disabled="!t?.loaded"
          @input="onInput"
          @keydown="onKeydown"
          @paste="onPaste"
        />
        <button type="submit" class="composer__send" :disabled="!canSend && !(editing && editing.attachments?.length)" :aria-label="editing ? tr('chat.saveEdit') : tr('chat.send')">
          <Check v-if="editing" />
          <SendHorizontal v-else />
        </button>
      </form>
    </template>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="viewer" class="viewer" role="dialog" aria-modal="true" @click.self="viewer = null">
          <button type="button" class="viewer__close" :aria-label="tr('common.close')" @click="viewer = null"><X /></button>
          <img :src="viewer.list[viewer.index].url" alt="" />
          <div v-if="viewer.list.length > 1" class="viewer__dots">
            <button
              v-for="(a, i) in viewer.list"
              :key="a.url"
              type="button"
              :class="{ 'is-active': i === viewer.index }"
              :aria-label="`${i + 1}`"
              @click="viewer.index = i"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--surface);
}
.chat__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  min-height: 66px;
}
.chat__who {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.chat__who-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chat__status {
  font-size: 0.78rem;
  color: var(--text-3);
}
.chat__status.is-online {
  color: var(--success);
  font-weight: 600;
}

.chat__scroll {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px clamp(12px, 3vw, 28px);
  display: flex;
  flex-direction: column;
  gap: 3px;
  background-image: radial-gradient(color-mix(in srgb, var(--text-3) 14%, transparent) 1px, transparent 1px);
  background-size: 20px 20px;
  background-color: var(--surface-2);
}
.chat__center,
.chat__older {
  display: grid;
  place-items: center;
  padding: 24px;
  color: var(--primary);
}
.chat__center {
  flex: 1;
}
.safety-note {
  display: flex;
  gap: 10px;
  align-self: center;
  max-width: 560px;
  margin: 4px auto 12px;
  padding: 10px 14px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border));
  background: var(--warning-soft);
  font-size: 0.8rem;
  color: var(--text-2);
}
.safety-note > svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--warning);
}
.safety-note strong {
  color: var(--text);
}
.safety-note a {
  color: var(--primary);
  font-weight: 600;
  white-space: nowrap;
}
.msg__warn {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: min(78%, 560px);
  margin-top: 4px;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--danger);
}
.msg__warn svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.composer__warn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  background: var(--danger-soft);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--danger);
}
.composer__warn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.chat__intro {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  padding: 24px;
}

.day {
  display: flex;
  justify-content: center;
  margin: 14px 0 8px;
  position: sticky;
  top: 0;
  z-index: 1;
}
.day span {
  padding: 4px 12px;
  border-radius: 99px;
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-2);
  box-shadow: var(--shadow-xs);
}

.msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 8px;
}
.msg--grouped {
  margin-top: 0;
}
.msg--mine {
  align-items: flex-end;
}
.msg__line {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: min(84%, 600px);
}
.msg--mine .msg__line {
  flex-direction: row-reverse;
}
.msg__menu {
  opacity: 0;
  transition: opacity 0.15s var(--ease);
}
.msg:hover .msg__menu,
.msg__menu:focus-within {
  opacity: 1;
}
@media (pointer: coarse) {
  .msg__menu {
    opacity: 0.7;
  }
}
.msg__menu-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-3);
  box-shadow: var(--shadow-xs);
}
.msg__menu-btn:hover {
  color: var(--text);
}
.msg__menu-btn svg {
  width: 16px;
  height: 16px;
}
.msg--editing .bubble {
  outline: 2px solid var(--warning);
  outline-offset: 2px;
}
.bubble {
  position: relative;
  min-width: 0;
  padding: 8px 12px 6px;
  border-radius: 18px 18px 18px 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  animation: bubble-in 0.22s var(--ease);
}
.bubble--photos {
  padding: 4px 4px 6px;
}
.bubble--photos .bubble__text {
  padding: 4px 8px 0;
}
.bubble--photos .bubble__meta {
  padding: 0 8px;
}
.msg--grouped .bubble {
  border-top-left-radius: 6px;
}
.msg--mine .bubble {
  border-radius: 18px 18px 6px 18px;
  background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 78%, var(--accent)));
  border-color: transparent;
  color: #fff;
}
.msg--mine.msg--grouped .bubble {
  border-top-right-radius: 6px;
}
.msg--mine .bubble--deleted,
.bubble--deleted {
  background: var(--surface);
  border: 1px dashed var(--border-strong);
  color: var(--text-3);
}
.bubble__deleted {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-style: italic;
  font-size: 0.88rem;
}
.bubble__deleted svg {
  width: 14px;
  height: 14px;
}
.msg--mine .bubble--deleted .bubble__meta {
  color: var(--text-3);
}
.msg--failed .bubble {
  opacity: 0.7;
}
.bubble__text {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  font-size: 0.95rem;
}
.bubble__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 2px;
  font-size: 0.68rem;
  color: var(--text-3);
}
.bubble__edited {
  font-style: italic;
}
.msg--mine .bubble__meta {
  color: rgba(255, 255, 255, 0.78);
}
.tick {
  width: 14px;
  height: 14px;
}
.tick--read {
  color: #a5f3fc;
}

.photos {
  position: relative;
  display: grid;
  gap: 3px;
  width: min(300px, 62vw);
  border-radius: 14px;
  overflow: hidden;
}
.photos--1 {
  grid-template-columns: 1fr;
}
.photos--2,
.photos--4 {
  grid-template-columns: 1fr 1fr;
}
.photos--3 {
  grid-template-columns: 1fr 1fr;
}
.photos--3 .photos__item:first-child {
  grid-column: 1 / -1;
}
.photos__item {
  display: block;
  padding: 0;
  border: 0;
  background: var(--surface-3);
  cursor: zoom-in;
}
.photos__item img {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 320px;
  aspect-ratio: auto;
  object-fit: cover;
}
.photos--2 .photos__item img,
.photos--3 .photos__item img,
.photos--4 .photos__item img {
  aspect-ratio: 1;
}
.photos__progress {
  position: absolute;
  inset: auto 8px 8px auto;
  padding: 3px 8px;
  border-radius: 99px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
}

.msg__failed {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  font-size: 0.76rem;
  color: var(--danger);
}
.msg__failed button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: none;
  color: var(--primary);
  font-weight: 700;
  padding: 0;
}
.msg__failed svg {
  width: 13px;
  height: 13px;
}

.bubble--typing {
  display: flex;
  gap: 4px;
  padding: 14px 16px;
}
.bubble--typing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-3);
  animation: blink 1.2s infinite ease-in-out;
}
.bubble--typing span:nth-child(2) {
  animation-delay: 0.15s;
}
.bubble--typing span:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes blink {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
}

.composer__banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  background: var(--warning-soft);
  font-size: 0.82rem;
}
.composer__banner > svg {
  width: 16px;
  height: 16px;
  color: var(--warning);
  flex-shrink: 0;
}
.composer__banner .grow {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.composer__banner span {
  color: var(--text-2);
}
.composer__banner button,
.composer__photo button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-2);
}
.composer__banner button svg,
.composer__photo button svg {
  width: 14px;
  height: 14px;
}
.composer__photos {
  display: flex;
  gap: 8px;
  padding: 10px 14px 0;
  border-top: 1px solid var(--border);
  background: var(--surface);
  overflow-x: auto;
}
.composer__photo {
  position: relative;
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.composer__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.composer__photo button {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 22px;
  height: 22px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 14px calc(10px + var(--safe-bottom));
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.composer__photos + .composer {
  border-top: 0;
}
.composer textarea {
  flex: 1;
  resize: none;
  min-height: 46px;
  max-height: 140px;
  padding: 12px 16px;
  border-radius: 23px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 16px;
  line-height: 1.35;
  overflow-y: hidden;
}
.composer textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
  background: var(--surface);
}
.composer__attach {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-2);
  transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
}
.composer__attach:hover:not(:disabled) {
  background: var(--primary-soft);
  color: var(--primary);
}
.composer__attach:disabled,
.composer__attach.is-locked {
  opacity: 0.4;
}
.composer__attach svg {
  width: 21px;
  height: 21px;
}
.composer__send {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, var(--accent)));
  color: #fff;
  transition: transform 0.15s var(--ease), opacity 0.15s;
}
.composer__send:hover:not(:disabled) {
  transform: scale(1.06);
}
.composer__send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.composer__send svg {
  width: 20px;
  height: 20px;
}
.chat__locked {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  padding: 14px 16px calc(14px + var(--safe-bottom));
  border-top: 1px solid var(--border);
  font-size: 0.88rem;
  color: var(--text-2);
}
.chat__locked svg {
  width: 18px;
  height: 18px;
}

.viewer {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 6, 23, 0.88);
}
.viewer img {
  max-width: 100%;
  max-height: calc(100dvh - 96px);
  border-radius: 12px;
  object-fit: contain;
}
.viewer__close {
  position: absolute;
  top: 16px;
  right: 16px;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}
.viewer__close svg {
  width: 20px;
  height: 20px;
}
.viewer__dots {
  position: absolute;
  bottom: 20px;
  display: flex;
  gap: 8px;
}
.viewer__dots button {
  width: 10px;
  height: 10px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
}
.viewer__dots button.is-active {
  background: #fff;
}

@media (min-width: 900px) {
  .chat__back {
    display: none;
  }
}
@media (max-width: 479px) {
  .chat__badge {
    display: none;
  }
}
</style>
