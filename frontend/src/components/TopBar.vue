<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from "vue";
import { useRouter } from "vue-router";
import {
  api,
  getNotifications,
  readNotification,
  readAllNotifications,
} from "../api/client";

import { useAppStore } from "../stores/appStore";

type Noti = {
  id: string;
  title: string;
  body?: string;
  data?: any;   
  read: boolean;
  createdAt: string;
};

const router = useRouter();
const store = useAppStore();

const open = ref(false);
const profileOpen = ref(false);
const items = ref<Noti[]>([]);
const unreadCount = ref(0);
const user = computed(() => store.user);
let timer: any = null;

/* ---- fetch / poll ---- */
async function fetchUser() {
  await store.fetchUser();
}
async function fetchNoti() {
  const { data } = await getNotifications(true);
  items.value = data;
  unreadCount.value = data.length;
}
function startPolling() {
  stopPolling();
  timer = setInterval(fetchNoti, 5000);
}
function stopPolling() {
  if (timer) clearInterval(timer);
}

/* ---- actions ---- */
async function markOne(id: string) {
  await readNotification(id);
  await fetchNoti();
}
async function markAll() {
  await readAllNotifications();
  await fetchNoti();
}
function openBoard(boardId: string) {
  open.value = false;
  router.push(`/boards/${boardId}`);
}
async function acceptInvite(n: Noti) {
  try {
    const token = n.data?.token as string | undefined;
    if (!token) return;
    const { data } = await api.post("/invites/accept", { token });
    await markOne(n.id);   
    open.value = false;
    router.push(`/boards/${data.boardId}`);
  } catch (e: any) {
    alert(e?.response?.data?.message || "ยอมรับคำเชิญไม่สำเร็จ");
  }
}

function goProfile() {
  profileOpen.value = false;
  router.push("/profile");
}
async function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("sessionStartTime");
  router.replace("/login");
}

onMounted(() => { fetchUser(); fetchNoti(); startPolling(); });
onBeforeUnmount(stopPolling);
</script>

<template>
  <header class="glass sticky top-0 z-10 transition-all duration-500 border-b">
    <div class="w-full flex h-16 items-center justify-between px-6">
      
      <!-- Left: Logo & Title -->
      <router-link to="/boards" class="flex items-center gap-3 group">
        <div class="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200/50 dark:shadow-none glow-indigo group-hover:scale-105 transition-transform">
          <span class="text-white font-bold text-xl italic leading-none select-none">K</span>
        </div>
        <span class="text-xl font-bold text-[var(--text-primary)] tracking-tight">Kanban Board</span>
      </router-link>

      <!-- Center/Right: Search, Buttons, Profile -->
      <div class="flex items-center gap-4 flex-1 justify-end">
        
        <!-- Search Bar -->
        <div v-if="!$route.path.startsWith('/boards') && $route.path !== '/profile'" class="hidden md:flex items-center relative max-w-xs w-full">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="ค้นหางาน..." 
            class="input pl-10 w-full h-10 text-xs rounded-xl"
          />
        </div>

        <!-- Action Icons -->
        <div class="flex items-center gap-3 ml-2">
          <button class="btn btn-primary px-6 h-11 tracking-widest uppercase text-xs font-medium">
            เชิญ
          </button>
          
          <button 
            class="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
            @click="store.toggleDarkMode()"
            :title="store.isDarkMode ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'"
          >
            <!-- Sun Icon (shown in dark mode) -->
            <svg v-if="store.isDarkMode" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <!-- Moon Icon (shown in light mode) -->
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>

        <!-- Profile Dropdown -->
        <div class="relative flex items-center ml-2 border-l border-[var(--border-color)] pl-5">
          <button @click="profileOpen = !profileOpen" class="flex items-center group">
            <div class="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[var(--border-color)] shadow-sm overflow-hidden ring-4 ring-transparent group-hover:ring-indigo-500/10 transition-all active:scale-95">
              <img v-if="user?.avatar" :src="user.avatar" class="h-full w-full object-cover" />
              <div v-else class="h-full w-full grid place-items-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium text-xs">
                {{ user?.email[0].toUpperCase() }}
              </div>
            </div>
          </button>

          <div v-if="profileOpen" class="absolute right-0 top-full mt-3 w-56 rounded-2xl bg-[var(--bg-card)] p-2.5 shadow-2xl border border-[var(--border-color)] flex flex-col z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div class="px-3 py-2 mb-1 border-b border-[var(--border-color)]">
              <p class="text-xs font-semibold text-[var(--text-secondary)]">ลงชื่อเข้าใช้เป็น</p>
              <p class="text-sm font-medium truncate">{{ user?.email }}</p>
            </div>
            <button class="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm font-medium hover:bg-indigo-500/10 hover:text-indigo-500 rounded-xl transition" @click="goProfile">
               โปรไฟล์ของคุณ
            </button>
            <button class="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-500/10 rounded-xl transition" @click="logout">
               ออกจากระบบ
            </button>
          </div>
        </div>

      </div>
    </div>
  </header>
</template>
