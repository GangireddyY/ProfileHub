<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
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
} from 'lucide-vue-next';
import { SENSITIVE_PATTERN } from '@/constants/legal';
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

const auth = useAuthStore();
const chat = useChatStore();
const realtime = useRealtimeStore();

const scroller = ref(null);
const input = ref(null);
const draft = ref('');
const draftLooksSensitive = computed(() => SENSITIVE_PATTERN.test(draft.value));
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

watch(
  () => props.userId,
  async (id, oldId) => {
    if (oldId) {
      stopTyping(oldId);
      chat.closeThread(oldId);
    }
    draft.value = oldId ? '' : props.initialDraft;
    await chat.openThread(id);
    scrollToBottom();
    if (draft.value) nextTick(autoGrow);
    if (!coarsePointer || draft.value) input.value?.focus();
  },
  { immediate: true },
);

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
  if (!t.value?.canMessage) return;
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

function send() {
  const body = draft.value.trim();
  if (!body || !t.value?.canMessage) return;
  draft.value = '';
  nextTick(autoGrow);
  stopTyping(props.userId);
  chat.send(props.userId, body);
  if (!coarsePointer) input.value?.focus();
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !coarsePointer && !e.isComposing) {
    e.preventDefault();
    send();
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') chat.markRead(props.userId);
}

onMounted(() => document.addEventListener('visibilitychange', onVisibility));
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility);
  stopTyping(props.userId);
  chat.closeThread(props.userId);
});
</script>

<template>
  <div class="chat">
    <header class="chat__head">
      <UiButton to="/messages" variant="ghost" :icon="ArrowLeft" icon-only aria-label="Back to conversations" class="chat__back" />
      <RouterLink v-if="other" :to="`/u/${other.id}`" class="chat__who">
        <UiAvatar :name="other.name" :src="other.avatarUrl" :size="42" :online="online" />
        <div class="chat__who-text">
          <strong class="truncate">{{ other.name }}</strong>
          <span class="chat__status" :class="{ 'is-online': online || isTyping }">
            {{ isTyping ? 'typing…' : lastSeenLabel(online, lastSeen) }}
          </span>
        </div>
      </RouterLink>
      <ProfessionBadge v-if="other" :profession="other.profession" size="sm" class="chat__badge" />
    </header>

    <div ref="scroller" class="chat__scroll" @scroll.passive="onScroll">
      <div v-if="t?.loading" class="chat__center"><UiSpinner :size="28" /></div>

      <UiEmpty v-else-if="t?.error" compact title="Couldn't open this chat" :description="t.error" />

      <template v-else>
        <div v-if="t?.loadingOlder" class="chat__older"><UiSpinner :size="20" /></div>

        <div v-if="t?.loaded && !t.hasMore" class="safety-note" role="note">
          <ShieldAlert />
          <p>
            <strong>Stay safe.</strong> Never share OTPs, passwords, UPI PINs or bank details, and don't pay in advance to someone
            you haven't met. Harassment, spam and misusing contact details break our guidelines.
            <RouterLink to="/terms#safety">Safety tips</RouterLink>
          </p>
        </div>

        <div v-if="t?.loaded && !t.messages.length" class="chat__intro">
          <UiAvatar :name="other?.name" :src="other?.avatarUrl" :size="72" />
          <strong>{{ other?.name }}</strong>
          <p class="muted">{{ other?.roleTitle }}</p>
          <p class="subtle">Say hello and start the conversation 👋</p>
        </div>

        <template v-for="row in rows" :key="row.key">
          <div v-if="row.type === 'day'" class="day"><span>{{ row.label }}</span></div>
          <div
            v-else
            class="msg"
            :class="{ 'msg--mine': row.mine, 'msg--grouped': row.grouped, 'msg--failed': row.m.failed }"
          >
            <div class="bubble">
              <p class="bubble__text">{{ row.m.body }}</p>
              <span class="bubble__meta">
                {{ formatTime(row.m.createdAt) }}
                <template v-if="row.mine">
                  <Clock3 v-if="row.m.pending" class="tick" aria-label="Sending" />
                  <CircleAlert v-else-if="row.m.failed" class="tick" aria-label="Failed" />
                  <CheckCheck v-else-if="row.m.readAt" class="tick tick--read" aria-label="Read" />
                  <Check v-else class="tick" aria-label="Sent" />
                </template>
              </span>
            </div>
            <p v-if="!row.mine && SENSITIVE_PATTERN.test(row.m.body)" class="msg__warn">
              <TriangleAlert /> Never share OTPs, passwords, PINs or bank details. ProfileHUB will never ask for them.
            </p>
            <div v-if="row.m.failed" class="msg__failed">
              <span>{{ row.m.error || 'Not sent' }}</span>
              <button type="button" @click="chat.retry(userId, row.m.id)"><RotateCw /> Retry</button>
              <button type="button" @click="chat.discard(userId, row.m.id)"><Trash2 /> Delete</button>
            </div>
          </div>
        </template>

        <Transition name="fade">
          <div v-if="isTyping" class="msg">
            <div class="bubble bubble--typing" aria-label="Typing"><span /><span /><span /></div>
          </div>
        </Transition>
      </template>
    </div>

    <div v-if="t?.loaded && !t.canMessage" class="chat__locked">
      <Lock />
      <span>You can message people in your network, or members who are selling something.</span>
      <UiButton :to="`/u/${userId}`" size="sm" variant="soft">View profile</UiButton>
    </div>

    <template v-else>
      <p v-if="draftLooksSensitive" class="composer__warn" role="alert">
        <TriangleAlert />
        Careful: never send OTPs, passwords, PINs, card or bank details in chat, even to people you trust.
      </p>
      <form class="composer" @submit.prevent="send">
        <textarea
          ref="input"
          v-model="draft"
          rows="1"
          maxlength="2000"
          placeholder="Write a message…"
          aria-label="Message"
          enterkeyhint="send"
          :disabled="!t?.loaded"
          @input="onInput"
          @keydown="onKeydown"
        />
        <button type="submit" class="composer__send" :disabled="!draft.trim()" aria-label="Send message">
          <SendHorizontal />
        </button>
      </form>
    </template>
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
.bubble {
  position: relative;
  max-width: min(78%, 560px);
  padding: 8px 12px 6px;
  border-radius: 18px 18px 18px 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  animation: bubble-in 0.22s var(--ease);
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

.composer {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 10px 14px calc(10px + var(--safe-bottom));
  border-top: 1px solid var(--border);
  background: var(--surface);
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
