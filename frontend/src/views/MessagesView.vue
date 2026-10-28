<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagesSquare, Search, Users, Sparkles, Lock } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import ConversationList from '@/components/chat/ConversationList.vue';
import ChatPanel from '@/components/chat/ChatPanel.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiSpinner from '@/components/ui/UiSpinner.vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({ userId: { type: String, default: '' } });
const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

// This view stays mounted while switching conversations, so this is the page before Messages was opened.
const previous = router.options.history.state.back;
const backTo = typeof previous === 'string' && !previous.startsWith('/messages') ? previous : '/';

const newChatOpen = ref(false);
const connections = ref([]);
const loadingConnections = ref(false);
const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return connections.value.filter((u) => !q || u.name.toLowerCase().includes(q) || u.roleTitle?.toLowerCase().includes(q));
});

/** Plans with "Message anyone" can also start chats with members outside their network. */
const messagingLocked = computed(() => auth.user?.limits?.messaging === false);
const canMessageAnyone = computed(() => !messagingLocked.value && Boolean(auth.user?.limits?.messageAnyone));
const members = ref([]);
const searchingMembers = ref(false);
const otherMembers = computed(() => {
  const known = new Set(connections.value.map((u) => u.id));
  return members.value.filter((u) => !known.has(u.id));
});
const noResults = computed(
  () => search.value.trim() && !filtered.value.length && !otherMembers.value.length && !searchingMembers.value,
);

let memberSearch = 0;
let memberTimer;
watch(search, (value) => {
  clearTimeout(memberTimer);
  const q = value.trim();
  if (!canMessageAnyone.value || q.length < 2) {
    memberSearch++;
    members.value = [];
    searchingMembers.value = false;
    return;
  }
  searchingMembers.value = true;
  memberTimer = setTimeout(async () => {
    const id = ++memberSearch;
    try {
      const { data } = await api.get('/search', { params: { q, limit: 12 } });
      if (id === memberSearch) members.value = data.people.items;
    } catch (err) {
      if (id === memberSearch) toast.error(errorMessage(err));
    } finally {
      if (id === memberSearch) searchingMembers.value = false;
    }
  }, 250);
});

async function openNewChat() {
  newChatOpen.value = true;
  search.value = '';
  members.value = [];
  loadingConnections.value = true;
  try {
    const { data } = await api.get('/connections');
    connections.value = data.items;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loadingConnections.value = false;
  }
}

function startChat(u) {
  newChatOpen.value = false;
  router.push(`/messages/${u.id}`);
}
</script>

<template>
  <div class="messages-page">
    <div class="messages" :class="{ 'has-active': props.userId }">
      <aside class="messages__list">
        <ConversationList :active-id="props.userId" :back-to="backTo" @new-chat="openNewChat" />
      </aside>
      <section class="messages__chat">
        <ChatPanel
          v-if="props.userId"
          :user-id="props.userId"
          :initial-draft="typeof route.query.text === 'string' ? route.query.text.slice(0, 500) : ''"
        />
        <div v-else class="messages__placeholder">
          <UiEmpty
            :icon="MessagesSquare"
            :title="t('messages.yourConversations')"
            :description="t('messages.pickText')"
          >
            <UiButton @click="openNewChat">{{ t('messages.newMessage') }}</UiButton>
          </UiEmpty>
        </div>
      </section>
    </div>

    <UiSheet v-model:open="newChatOpen" :title="t('messages.newMessage')" width="460px">
      <UiEmpty v-if="messagingLocked" compact :icon="Lock" :title="t('chat.planLocked')">
        <UiButton to="/plans" size="sm" @click="newChatOpen = false">{{ t('chat.seePlans') }}</UiButton>
      </UiEmpty>
      <div v-else class="stack" style="--gap: 12px">
        <UiInput
          v-model="search"
          :icon="Search"
          :placeholder="canMessageAnyone ? t('messages.searchMembers') : t('messages.searchConnections')"
          type="search"
          :aria-label="canMessageAnyone ? t('messages.searchMembers') : t('messages.searchConnections')"
        />
        <p v-if="canMessageAnyone && !search.trim()" class="anyone-hint"><Sparkles /> {{ t('messages.anyoneHint') }}</p>
        <div v-if="loadingConnections" class="center"><UiSpinner :size="24" /></div>
        <UiEmpty
          v-else-if="!connections.length && !canMessageAnyone"
          compact
          :icon="Users"
          :title="t('messages.noConnections')"
          :description="t('messages.noConnectionsText')"
        >
          <UiButton to="/" size="sm" @click="newChatOpen = false">{{ t('common.discoverPeople') }}</UiButton>
        </UiEmpty>
        <div v-else class="pick-list">
          <template v-if="filtered.length">
            <p v-if="canMessageAnyone" class="pick-group">{{ t('messages.yourConnections') }}</p>
            <button v-for="u in filtered" :key="u.id" type="button" class="pick" @click="startChat(u)">
              <UiAvatar :name="u.name" :src="u.avatarUrl" :size="42" :online="u.online" />
              <span class="pick__text">
                <strong class="truncate">{{ u.name }}</strong>
                <span class="muted truncate">{{ u.roleTitle }}</span>
              </span>
            </button>
          </template>
          <template v-if="otherMembers.length">
            <p class="pick-group">{{ t('messages.otherMembers') }}</p>
            <button v-for="u in otherMembers" :key="u.id" type="button" class="pick" @click="startChat(u)">
              <UiAvatar :name="u.name" :src="u.avatarUrl" :size="42" :online="u.online" />
              <span class="pick__text">
                <strong class="truncate">{{ u.name }}</strong>
                <span class="muted truncate">{{ [u.roleTitle, u.city].filter(Boolean).join(' · ') }}</span>
              </span>
            </button>
          </template>
          <div v-if="searchingMembers" class="center"><UiSpinner :size="20" /></div>
          <p v-else-if="noResults" class="subtle center">{{ t('messages.noPeopleMatch', { q: search.trim() }) }}</p>
        </div>
      </div>
    </UiSheet>
  </div>
</template>

<style scoped>
.messages-page {
  height: 100%;
  width: 100%;
}
.messages {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  background: var(--surface);
}
.messages__list {
  min-height: 0;
  border-right: 1px solid var(--border);
}
.messages__chat {
  display: none;
  min-height: 0;
  min-width: 0;
}
.messages.has-active .messages__list {
  display: none;
}
.messages.has-active .messages__chat {
  display: block;
}
.messages__placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  background: var(--surface-2);
}
.center {
  display: grid;
  place-items: center;
  padding: 20px;
}
.pick-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 55dvh;
  overflow-y: auto;
}
.pick {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  text-align: left;
}
.pick:hover {
  background: var(--surface-2);
}
.pick-group {
  padding: 8px 10px 4px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}
.anyone-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--primary-soft);
  color: var(--text-2);
  font-size: 0.82rem;
}
.anyone-hint svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--primary);
}
.pick__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 0.9rem;
}

@media (min-width: 900px) {
  .messages-page {
    padding: 24px var(--page-pad);
    max-width: var(--content-max);
    margin: 0 auto;
  }
  .messages {
    grid-template-columns: 360px minmax(0, 1fr);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .messages.has-active .messages__list,
  .messages__list {
    display: block;
  }
  .messages__chat {
    display: block;
  }
}
</style>
