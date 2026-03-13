<script setup lang="ts">
import { ref, onMounted, computed, markRaw } from "vue";
import { api } from "../api/client";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/appStore";

// Icons (Inline SVG Components)
const ProfileIcon = { template: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>` };
const SecurityIcon = { template: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>` };
const BoardsIcon = { template: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>` };
const InviteIcon = { template: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>` };

const router = useRouter();
const store = useAppStore();

const user = computed(() => store.user);
const invites = computed(() => store.invites);
const boards = computed(() => store.boards);

const activeSection = ref("profile");
const showPassModal = ref(false);

const navItems = [
  { id: "profile", label: "การตั้งค่าโปรไฟล์", icon: markRaw(ProfileIcon) },
  { id: "security", label: "ความปลอดภัย", icon: markRaw(SecurityIcon) },
  { id: "boards", label: "กระดานงาน", icon: markRaw(BoardsIcon) },
  { id: "invites", label: "ประวัติการเชิญ", icon: markRaw(InviteIcon) },
];

const oldPassword = ref("");
const newPassword = ref("");
const passMessage = ref("");
const passError = ref(false);

const userName = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

async function fetchProfile() {
  await store.fetchUser();
  if (store.user) {
    userName.value = store.user.email.split('@')[0];
  }
}

async function fetchInvites() {
  await store.fetchInvites();
}

async function changePassword() {
  passMessage.value = "";
  passError.value = false;
  try {
    await api.patch("/auth/change-password", {
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    });
    passMessage.value = "อัปเดตสำเร็จแล้ว";
    oldPassword.value = "";
    newPassword.value = "";
    setTimeout(() => { showPassModal.value = false; passMessage.value = ""; }, 1500);
  } catch (err: any) {
    passError.value = true;
    passMessage.value = err.response?.data?.message || "ล้มเหลว";
  }
}

function selectAvatar() {
  fileInput.value?.click();
}

async function uploadAvatar(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = async () => {
    try {
      const base64Str = reader.result as string;
      await api.post("/users/me/avatar", { avatar: base64Str });
      if (store.user) store.user.avatar = base64Str;
    } catch (err) {
      alert("อัปโหลดไม่สำเร็จ");
    }
  };
  reader.readAsDataURL(file);
}

async function removeAvatar() {
  try {
     await api.post("/users/me/avatar", { avatar: null });
     if (store.user) store.user.avatar = undefined;
  } catch (e) {
     alert("ลบออกไม่สำเร็จ");
  }
}

function saveProfile() {
   alert("บันทึกการตั้งค่าโปรไฟล์สำเร็จ!");
}

function formatDate(d: string) {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const date = new Date(d);
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("sessionStartTime");
  store.clearAuth();
  router.push("/login");
}

onMounted(() => {
  fetchProfile();
  fetchInvites();
  store.fetchBoards();
});
</script>

<template>
  <div class="max-w-6xl mx-auto min-h-[calc(100vh-120px)] flex flex-col px-4 sm:px-6 animate-fade-up">
    <div class="flex-1 flex flex-col lg:flex-row gap-10">
      
      <!-- Left Sidebar -->
      <aside class="w-full md:w-64 flex flex-col justify-between">
        <div class="mb-8 pl-2 flex items-center gap-3">
          <div class="h-10 w-10 rounded-full bg-[var(--bg-main)] border-2 border-[var(--border-color)] shadow-sm overflow-hidden flex-shrink-0">
            <img v-if="user?.avatar" :src="user.avatar" class="h-full w-full object-cover" />
            <div v-else class="h-full w-full grid place-items-center bg-indigo-500/10 text-indigo-500 font-bold text-xs uppercase">
              {{ user?.email[0] }}
            </div>
          </div>
          <div class="min-w-0">
            <h2 class="text-sm font-medium text-[var(--text-primary)] truncate">การตั้งค่า</h2>
            <p class="text-[10px] text-[var(--text-secondary)] font-bold truncate">{{ user?.email }}</p>
          </div>
        </div>

        <nav class="space-y-1">
          <button 
            v-for="item in navItems" 
            :key="item.id"
            @click="activeSection = item.id"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all"
            :class="activeSection === item.id 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.label }}
          </button>
        </nav>

        <div class="mt-auto pt-8 border-t border-[var(--border-color)]">
          <button @click="logout" class="flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors w-full text-left">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 space-y-8">
        
        <transition name="fade" mode="out-in">
          <div :key="activeSection">
            <!-- Section: Personal Information -->
            <div v-if="activeSection === 'profile'" class="bg-[var(--bg-card)] rounded-[24px] border border-[var(--border-color)] p-8 shadow-sm">
              <div class="mb-8">
                <h2 class="text-2xl font-medium text-[var(--text-primary)] tracking-tight">ข้อมูลส่วนตัว</h2>
                <p class="text-[13px] text-[var(--text-secondary)] font-medium mt-1">จัดการโปรไฟล์สาธารณะและรายละเอียดบัญชีของคุณ</p>
              </div>
          
          <div class="flex flex-col sm:flex-row items-center gap-8 mb-10">
            <!-- Avatar with Camera Overlay -->
            <div class="relative group">
              <div class="h-32 w-32 rounded-full overflow-hidden border-4 border-[var(--bg-main)] shadow-inner bg-[var(--bg-main)] ring-1 ring-[var(--border-color)]">
                <img v-if="user?.avatar" :src="user.avatar" class="h-full w-full object-cover" />
                <div v-else class="h-full w-full grid place-items-center bg-indigo-500/10 text-indigo-500 text-3xl font-medium uppercase">
                  {{ user?.email[0] }}
                </div>
              </div>
              <button @click="selectAvatar" class="absolute bottom-1 right-1 h-9 w-9 bg-indigo-600 text-white rounded-full flex items-center justify-center border-4 border-[var(--bg-card)] shadow-lg hover:scale-110 active:scale-95 transition pointer-events-auto">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                </svg>
              </button>
              <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="uploadAvatar" />
            </div>

            <div class="flex-1 space-y-1 text-center sm:text-left">
              <h3 class="text-xl font-bold text-[var(--text-primary)]">{{ user?.email.split('@')[0] }}</h3>
              <p class="text-sm text-[var(--text-secondary)] font-medium">ไฟล์ JPG, GIF หรือ PNG ขนาดไม่เกิน 800K</p>
              <div class="flex items-center justify-center sm:justify-start gap-3 mt-4">
                <button @click="selectAvatar" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition">อัปโหลดใหม่</button>
                <button @click="removeAvatar" class="px-5 py-2.5 bg-[var(--bg-main)] text-[var(--text-secondary)] rounded-xl text-sm font-bold hover:bg-[var(--bg-card)] border border-[var(--border-color)] transition">ลบออก</button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest pl-1">ชื่อเต็ม</label>
              <input 
                type="text" 
                v-model="userName" 
                class="input w-full h-14 bg-[var(--bg-card)] border-slate-300 dark:border-[var(--border-color)] text-[var(--text-primary)]"
                placeholder="ชื่อเต็ม"
              />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest pl-1">Email Address</label>
              <input 
                type="email" 
                :value="user?.email" 
                readonly
                class="input w-full h-14 bg-[var(--bg-card)] border-slate-300 dark:border-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed"
              />
            </div>
          </div>
        </div>

            <!-- Section: Password & Security -->
            <div v-else-if="activeSection === 'security'" class="bg-[var(--bg-card)] rounded-[24px] border border-[var(--border-color)] p-8 shadow-sm">
              <div class="flex items-center gap-3 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h2 class="text-2xl font-medium text-[var(--text-primary)] tracking-tight">รหัสผ่านและความปลอดภัย</h2>
              </div>
              <p class="text-[13px] text-[var(--text-secondary)] font-medium mb-8">จัดการความปลอดภัยของบัญชีและการตั้งค่าการรับรองตัวตน</p>


          <div class="p-6 bg-[var(--bg-main)]/50 rounded-2xl border border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div class="max-w-md">
              <h4 class="text-sm font-bold text-[var(--text-primary)] mb-1">อัปเดตรหัสผ่าน</h4>
              <p class="text-[13px] text-[var(--text-secondary)] font-medium">ให้แน่ใจว่าบัญชีของคุณใช้รหัสผ่านที่ยาวและสุ่มเพื่อความปลอดภัย</p>
            </div>
            <button @click="showPassModal = true" class="px-6 py-3 border-2 border-indigo-600 text-indigo-500 rounded-xl text-sm font-extrabold hover:bg-indigo-600 hover:text-white transition whitespace-nowrap">
              รีเซ็ตรหัสผ่าน
            </button>
          </div>
        </div>

            <!-- Section: Invite History -->
            <div v-else-if="activeSection === 'invites'" class="bg-[var(--bg-card)] rounded-[24px] border border-[var(--border-color)] p-8 shadow-sm">
              <div class="mb-8">
                <h2 class="text-2xl font-medium text-[var(--text-primary)] tracking-tight">ประวัติการเชิญ</h2>
                <p class="text-[13px] text-[var(--text-secondary)] font-medium mt-1">คำเชิญเข้าร่วมกระดานล่าสุดที่คุณได้รับ</p>
              </div>

          <div v-if="!invites.length" class="text-center py-12 text-[var(--text-secondary)] font-medium italic">
            ยังไม่มีประวัติคำเชิญ
          </div>
          <div v-else class="space-y-4">
            <div v-for="inv in invites" :key="inv.id" class="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-[var(--bg-main)] rounded-2xl transition group/item border border-transparent hover:border-[var(--border-color)]">
              <div class="flex items-center gap-4">
                <div class="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 group/icon">
                   <svg v-if="inv.accepted" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h4 class="text-sm font-medium text-[var(--text-primary)]">{{ inv.board.title }}</h4>
                  <p class="text-xs text-[var(--text-secondary)] font-bold mt-1 uppercase tracking-tight">ส่งโดยทีมผลิตภัณฑ์ • {{ formatDate(inv.expiresAt) }}</p>
                </div>
              </div>

              <div class="mt-4 sm:mt-0 flex items-center gap-2">
                <template v-if="!inv.accepted">
                  <button class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium uppercase tracking-wider hover:bg-indigo-700 transition">ยอมรับ</button>
                  <button class="px-4 py-2 bg-[var(--bg-main)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-[var(--bg-card)] transition">ปฏิเสธ</button>
                </template>
                <template v-else>
                  <span class="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">ยอมรับแล้ว</span>
                </template>
              </div>
            </div>
          </div>
          
              <button v-if="invites.length" class="w-full mt-6 py-3 text-sm font-bold text-indigo-500 hover:text-indigo-400 transition">
                ดูคำเชิญทั้งหมด
              </button>
            </div>

            <!-- Section: Boards -->
            <div v-else-if="activeSection === 'boards'" class="bg-[var(--bg-card)] rounded-[24px] border border-[var(--border-color)] p-8 shadow-sm">
               <div class="mb-8 flex items-center justify-between">
                 <div>
                   <h2 class="text-2xl font-medium text-[var(--text-primary)] tracking-tight">กระดานงานของคุณ</h2>
                   <p class="text-[13px] text-[var(--text-secondary)] font-medium mt-1">จัดการกระดานงานและการเป็นสมาชิกทีมของคุณ</p>
                 </div>
                 <button @click="$router.push('/boards')" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition">
                   ไปยังแดชบอร์ด
                 </button>
               </div>

               <div v-if="!boards.length" class="text-center py-20 border-2 border-dashed border-[var(--border-color)] rounded-3xl">
                  <div class="h-16 w-16 bg-indigo-500/10 text-indigo-500 rounded-2xl grid place-items-center mx-auto mb-4">
                    <component :is="navItems.find(n => n.id === 'boards')?.icon" class="h-8 w-8" />
                  </div>
                  <h3 class="text-lg font-bold text-[var(--text-primary)]">ไม่พบกระดานงาน</h3>
                  <p class="text-sm text-[var(--text-secondary)] mt-1">คุณยังไม่ได้สร้างกระดานงานใดๆ</p>
               </div>

               <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div v-for="board in boards" :key="board.id" 
                    @click="$router.push(`/boards/${board.id}`)"
                    class="p-5 bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition cursor-pointer group">
                    <div class="flex items-center justify-between mb-3">
                      <div class="h-10 w-10 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[var(--border-color)] grid place-items-center group-hover:scale-110 transition duration-300">
                        <component :is="navItems.find(n => n.id === 'boards')?.icon" class="h-5 w-5 text-indigo-500" />
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 class="font-bold text-[var(--text-primary)] group-hover:text-indigo-500 transition">{{ board.title }}</h4>
                    <p class="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-tight mt-1">แสดงบอร์ดส่วนตัว</p>
                  </div>
               </div>
            </div>
          </div>
        </transition>
      </main>
    </div>

    <!-- Sticky Footer -->
    <div class="sticky bottom-0 mt-8 py-6 bg-[var(--bg-main)]/80 backdrop-blur-md border-t border-[var(--border-color)] flex items-center justify-end gap-4 z-40 px-6 rounded-t-3xl shadow-2xl">
      <button @click="$router.push('/boards')" class="text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition px-4">ยกเลิก</button>
      <button @click="saveProfile" class="h-12 px-10 bg-indigo-600 text-white rounded-2xl text-sm font-medium shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition active:scale-95">
        บันทึกการเปลี่ยนแปลง
      </button>
    </div>

    <!-- Password Modal (Mocked for now) -->
    <div v-if="showPassModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" @click="showPassModal = false">
      <div class="bg-[var(--bg-card)] rounded-[24px] w-full max-w-md shadow-2xl p-8 border border-[var(--border-color)]" @click.stop>
        <h2 class="text-2xl font-medium text-[var(--text-primary)] mb-6">เปลี่ยนรหัสผ่าน</h2>
        <form @submit.prevent="changePassword" class="space-y-4">
          <div class="space-y-2">
            <label class="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest pl-1">รหัสผ่านปัจจุบัน</label>
            <input v-model="oldPassword" type="password" required class="input w-full h-12 bg-[var(--bg-main)]/50 border-[var(--border-color)]" />
          </div>
          <div class="space-y-2">
            <label class="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest pl-1">รหัสผ่านใหม่</label>
            <input v-model="newPassword" type="password" required class="input w-full h-12 bg-[var(--bg-main)]/50 border-[var(--border-color)]" />
          </div>
          <div class="pt-4 flex gap-3">
             <button type="button" @click="showPassModal = false" class="flex-1 px-4 py-3 bg-[var(--bg-main)] text-[var(--text-secondary)] rounded-xl text-sm font-bold transition">ยกเลิก</button>
             <button type="submit" class="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition">อัปเดต</button>
          </div>
          <p v-if="passMessage" :class="passError ? 'text-rose-500' : 'text-emerald-600'" class="text-xs font-bold text-center mt-2">
            {{ passMessage }}
          </p>
        </form>
      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

