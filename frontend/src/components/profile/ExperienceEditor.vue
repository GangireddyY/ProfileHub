<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { Briefcase, GraduationCap, Trash2 } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { toast } from '@/composables/useToast';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiTabs from '@/components/ui/UiTabs.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiToggle from '@/components/ui/UiToggle.vue';
import UiButton from '@/components/ui/UiButton.vue';

const open = defineModel('open', { type: Boolean, default: false });
const props = defineProps({
  /** Existing entry to edit, or null to create. */
  entry: { type: Object, default: null },
  kind: { type: String, default: 'work' },
});
const emit = defineEmits(['saved']);

const blank = () => ({
  kind: props.kind,
  title: '',
  organization: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
});

const form = reactive(blank());
const errors = ref({});
const saving = ref(false);
const deleting = ref(false);
const confirmDelete = ref(false);
const thisMonth = new Date().toISOString().slice(0, 7);

const isEdit = computed(() => Boolean(props.entry?.id));
const isWork = computed(() => form.kind === 'work');
const kindTabs = [
  { key: 'work', label: 'Work', icon: Briefcase },
  { key: 'education', label: 'Education', icon: GraduationCap },
];

watch(open, (value) => {
  if (!value) return;
  Object.assign(form, blank(), props.entry ? { ...props.entry, endDate: props.entry.endDate || '' } : {});
  errors.value = {};
  confirmDelete.value = false;
});

async function save() {
  saving.value = true;
  errors.value = {};
  const payload = {
    kind: form.kind,
    title: form.title,
    organization: form.organization,
    location: form.location,
    startDate: form.startDate,
    endDate: form.current ? null : form.endDate || null,
    current: form.current,
    description: form.description,
  };
  try {
    const { data } = isEdit.value
      ? await api.put(`/users/me/experiences/${props.entry.id}`, payload)
      : await api.post('/users/me/experiences', payload);
    emit('saved', data.items);
    toast.success(isEdit.value ? 'Entry updated' : 'Added to your profile');
    open.value = false;
  } catch (err) {
    errors.value = fieldErrors(err);
    if (!Object.keys(errors.value).length) toast.error(errorMessage(err));
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!confirmDelete.value) {
    confirmDelete.value = true;
    return;
  }
  deleting.value = true;
  try {
    const { data } = await api.delete(`/users/me/experiences/${props.entry.id}`);
    emit('saved', data.items);
    toast.success('Entry removed');
    open.value = false;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <UiSheet v-model:open="open" :title="isEdit ? 'Edit entry' : 'Add to profile'" width="560px">
    <form id="experience-form" class="stack" style="--gap: 16px" novalidate @submit.prevent="save">
      <UiTabs v-if="!isEdit" v-model="form.kind" :tabs="kindTabs" />

      <UiInput
        v-model="form.title"
        :label="isWork ? 'Title' : 'Degree or course'"
        :placeholder="isWork ? 'e.g. Senior Software Engineer' : 'e.g. B.Tech, Computer Science'"
        maxlength="100"
        :error="errors.title"
      />
      <UiInput
        v-model="form.organization"
        :label="isWork ? 'Company or organization' : 'School or university'"
        :placeholder="isWork ? 'e.g. Apollo Hospitals' : 'e.g. IIT Madras'"
        maxlength="120"
        :error="errors.organization"
      />
      <UiInput v-model="form.location" label="Location (optional)" placeholder="e.g. Bengaluru" maxlength="100" :error="errors.location" />

      <UiToggle v-model="form.current" :label="isWork ? 'I currently work here' : 'I currently study here'" />

      <div class="form-grid form-grid--2">
        <UiInput v-model="form.startDate" label="Start" type="month" :max="thisMonth" placeholder="YYYY-MM" :error="errors.startDate" />
        <UiInput
          v-if="!form.current"
          v-model="form.endDate"
          label="End"
          type="month"
          :min="form.startDate || undefined"
          :max="thisMonth"
          placeholder="YYYY-MM"
          :error="errors.endDate"
        />
      </div>

      <UiTextarea
        v-model="form.description"
        label="Description (optional)"
        :maxlength="1000"
        :rows="4"
        :placeholder="isWork ? 'What did you work on? Key achievements?' : 'Activities, specialisation, honours…'"
        :error="errors.description"
      />
    </form>

    <template #footer>
      <UiButton
        v-if="isEdit"
        variant="danger"
        :icon="Trash2"
        :loading="deleting"
        :icon-only="!confirmDelete"
        :aria-label="confirmDelete ? undefined : 'Delete entry'"
        @click="remove"
      >
        <template v-if="confirmDelete">Confirm delete</template>
      </UiButton>
      <UiButton variant="secondary" class="grow" @click="open = false">Cancel</UiButton>
      <UiButton type="submit" form="experience-form" class="grow" :loading="saving">Save</UiButton>
    </template>
  </UiSheet>
</template>
