<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../api/client";
import { useRouter } from "vue-router";

const router = useRouter();

const user = ref<{ id: string; email: string; avatar: string | null } | null>(null);
const invites = ref<any[]>([]);

// Password state
const oldPassword = ref("");
const newPassword = ref("");
const passMessage = ref("");
const passError = ref(false);

const fileInput = ref<HTMLInputElement | null>(null);

async function fetchProfile() {
  try {
    const { data } = await api.get("/users/me");
    user.value = data;
  } catch (err) {
    console.error("Failed to load user", err);
  }
}

async function fetchInvites() {
  try {
    const { data } = await api.get("/users/me/invites");
    invites.value = data;
  } catch (err) {
    console.error("Failed to load invites", err);
  }
}

async function changePassword() {
  passMessage.value = "";
  passError.value = false;
  if (!oldPassword.value || !newPassword.value) return;

  try {
    await api.patch("/auth/change-password", {
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    });
    passMessage.value = "Password updated successfully.";
    oldPassword.value = "";
    newPassword.value = "";
  } catch (err: any) {
    passError.value = true;
    passMessage.value = err.response?.data?.message || "Failed to change password.";
  }
}

function selectAvatar() {
  fileInput.value?.click();
}

async function uploadAvatar(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert("Image size should be less than 2MB");
    return;
  }

  const reader = new FileReader();
  reader.onloadend = async () => {
    try {
      const base64Str = reader.result as string;
      await api.post("/users/me/avatar", { avatar: base64Str });
      if (user.value) {
        user.value.avatar = base64Str;
      }
    } catch (err) {
      alert("Failed to upload avatar");
    }
  };
  reader.readAsDataURL(file);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

onMounted(() => {
  fetchProfile();
  fetchInvites();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="card p-6">
      <div class="flex items-center gap-6">
        <!-- Avatar -->
        <div class="relative flex-shrink-0 group">
          <div 
            class="h-24 w-24 rounded-full overflow-hidden bg-slate-100 border-4 border-slate-200 grid place-items-center text-3xl font-bold text-violet-500 cursor-pointer"
            @click="selectAvatar"
          >
            <img v-if="user?.avatar" :src="user.avatar" class="h-full w-full object-cover" />
            <span v-else-if="user">{{ user.email[0].toUpperCase() }}</span>
            <span v-else>...</span>
          </div>
          <div 
            class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer pointer-events-none transition-opacity"
          >
            <span class="text-white text-xs font-semibold">Change</span>
          </div>
          <input type="file" ref="fileInput" class="hidden" accept="image/png, image/jpeg, image/webp" @change="uploadAvatar" />
        </div>
        
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Your Profile</h1>
          <p class="text-slate-500 mt-1">{{ user?.email }}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      <!-- Change Password -->
      <div class="card p-6">
        <h2 class="text-xl font-bold text-slate-900 mb-4">Security</h2>
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <input v-model="oldPassword" type="password" required class="input w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input v-model="newPassword" type="password" required class="input w-full" />
          </div>
          <div>
            <button type="submit" class="btn btn-primary w-full shadow-lg" :disabled="!oldPassword || !newPassword">
              Update Password
            </button>
          </div>
          <p v-if="passMessage" :class="passError ? 'text-rose-500' : 'text-emerald-600'" class="text-sm font-medium">
            {{ passMessage }}
          </p>
        </form>
      </div>

      <!-- Invite History -->
      <div class="card p-6">
        <h2 class="text-xl font-bold text-slate-900 mb-4">Board Invitations</h2>
        
        <div v-if="!invites.length" class="text-slate-500 text-sm text-center py-6">
          You haven't received any board invitations yet.
        </div>
        <div v-else class="space-y-3 max-h-72 overflow-y-auto pr-2">
          <div v-for="inv in invites" :key="inv.id" class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between">
            <div>
              <div class="font-medium text-slate-800">{{ inv.board.title }}</div>
              <div class="text-xs text-slate-500 mt-1">
                Expires: {{ formatDate(inv.expiresAt) }}
              </div>
            </div>
            <div>
              <span v-if="inv.accepted" class="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                Accepted
              </span>
              <span v-else-if="new Date(inv.expiresAt) < new Date()" class="text-xs font-semibold text-rose-600 bg-rose-100 px-2 py-1 rounded">
                Expired
              </span>
              <span v-else class="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                Pending
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
