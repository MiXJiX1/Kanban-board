<template>
  <div class="h-full overflow-y-auto px-10 py-12 animate-fade-up scroll-smooth">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-8">
      <div>
        <h2 class="text-[12px] font-medium text-indigo-500 uppercase tracking-[.3em] mb-3">ภาพรวมพื้นที่ทำงาน</h2>
        <h1 class="text-5xl font-medium text-[var(--text-primary)] tracking-tight">แดชบอร์ดหลัก</h1>
        <p class="text-[var(--text-secondary)] font-medium mt-3 text-lg">ศูนย์ควบคุมโปรเจกต์ งาน และผลิตภาพของทีมคุณ</p>
      </div>

      <button @click="showAddBoardModal = true" class="btn btn-primary h-14 px-10 text-sm tracking-widest uppercase">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        โปรเจกต์ใหม่
      </button>
    </div>

    <!-- Dashboard Content -->
    <div v-if="isLoading && !overviewData.length" class="space-y-10">
      <div v-for="i in 3" :key="i" class="animate-pulse space-y-6">
        <div class="h-9 w-56 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="j in 3" :key="j" class="h-36 bg-[var(--bg-main)]/50 rounded-[24px] border border-[var(--border-color)]"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!filteredBoards.length" class="py-24 text-center">
      <div class="h-24 w-24 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[32px] grid place-items-center mx-auto mb-8 shadow-sm">
         <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h3 class="text-2xl font-medium text-[var(--text-primary)] leading-tight">ไม่พบกระดานงาน</h3>
      <p class="text-[var(--text-secondary)] font-medium mt-2">เริ่มต้นโดยการสร้างกระดานงานแรกของคุณที่ด้านบน</p>
    </div>

    <!-- Boards & Tasks List -->
    <div v-else class="space-y-16">
      <section v-for="board in filteredBoards" :key="board.id" class="space-y-8">
        <div class="flex items-center justify-between group">
          <div class="flex items-center gap-4">
            <div class="h-9 w-1.5 bg-indigo-600 rounded-full glow-indigo"></div>
            
            <!-- Board Title Display / Edit -->
            <div v-if="editingBoardId !== board.id" class="flex items-baseline gap-3">
              <h2 class="text-2xl font-medium text-[var(--text-primary)] tracking-tight">{{ board.title }}</h2>
              <span class="px-2.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-[9px] font-medium uppercase tracking-widest shadow-sm">{{ getTotalTasks(board) }} งาน</span>
            </div>
            <div v-else class="flex items-center gap-3">
              <input 
                v-model="editBoardTitle" 
                class="input h-10 px-4 font-medium text-sm"
                @keyup.enter="handleRenameBoard(board)"
                @keyup.esc="editingBoardId = null"
                autofocus
              />
              <button @click="handleRenameBoard(board)" class="text-[11px] font-medium text-indigo-600 uppercase tracking-wider hover:text-indigo-500">บันทึก</button>
              <button @click="editingBoardId = null" class="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider hover:text-slate-500">ยกเลิก</button>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- Board actions -->
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
              <button @click="startEditBoard(board)" class="p-2.5 text-[var(--text-secondary)] hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition" title="Rename Board">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button @click="handleDeleteBoard(board)" class="p-2.5 text-[var(--text-secondary)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition" title="Delete Board">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <button @click="router.push(`/boards/${board.id}`)" class="btn btn-outline h-11 px-6 text-xs tracking-wider uppercase font-medium flex items-center gap-2">
              เปิดกระดานงาน 
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex gap-6 overflow-x-auto pb-8 snap-x">
          <div 
            v-for="col in board.columns" 
            :key="col.id" 
            class="col-card flex-shrink-0 space-y-5 snap-start border-transparent"
          >
            <div class="flex items-center justify-between px-1">
              <span class="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-[2px]">{{ col.title }}</span>
              <span class="px-2 py-0.5 rounded-md bg-[var(--bg-main)] text-[var(--text-secondary)] text-[10px] font-medium">{{ col.tasks.length }}</span>
            </div>

            <div class="space-y-4">
              <div 
                v-for="task in col.tasks" 
                :key="task.id"
                class="task-card !p-5 group/card relative cursor-pointer active:scale-[0.98]"
                @click="router.push(`/boards/${board.id}`)"
              >
                <!-- Task Tags -->
                <div v-if="task.taskTags?.length" class="flex flex-wrap gap-2 mb-4">
                  <span 
                    v-for="tt in task.taskTags" 
                    :key="tt.tag.id"
                    class="h-2 w-8 rounded-full shadow-sm"
                    :style="{ backgroundColor: tt.tag.color }"
                  ></span>
                </div>

                <h4 class="text-[15px] font-medium text-[var(--text-primary)] leading-snug">{{ task.title }}</h4>

                <div class="mt-5 flex items-center justify-between">
                  <div class="flex -space-x-2.5">
                    <div 
                      v-for="assignee in task.assignees?.slice(0, 3)" 
                      :key="assignee.user.id"
                      class="h-7 w-7 rounded-full border-2 border-[var(--bg-card)] bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-sm"
                    >
                       <img v-if="assignee.user.avatar" :src="assignee.user.avatar" class="h-full w-full object-cover" />
                       <div v-else class="h-full w-full grid place-items-center text-[9px] font-medium uppercase bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                         {{ assignee.user.email[0] }}
                       </div>
                    </div>
                  </div>
                  
                  <span class="text-[10px] font-medium text-[var(--text-secondary)]/30 dark:text-[var(--text-secondary)]/20 uppercase tracking-tighter">#{{ task.id.slice(-4) }}</span>
                </div>
              </div>

              <!-- Quick Add Placeholder -->
              <button 
                @click="router.push(`/boards/${board.id}`)"
                class="w-full py-5 border-2 border-dashed border-[var(--border-color)] rounded-2xl flex items-center justify-center text-[var(--text-secondary)] hover:border-indigo-500/30 hover:text-indigo-500 hover:bg-indigo-500/5 transition-all group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 group-hover:scale-110 transition duration-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Add Board Modal (Full Overlay) -->
    <Teleport to="body">
      <div v-if="showAddBoardModal" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" @click="showAddBoardModal = false">
        <div class="w-full max-w-2xl rounded-[32px] bg-white dark:bg-slate-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-2xl overflow-hidden p-12 border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 duration-300" @click.stop>
          <!-- Modal Top Glow -->
          <div class="absolute -top-20 -left-20 h-40 w-40 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none"></div>

          <div class="flex items-center justify-between mb-16 relative">
            <div class="max-w-xl">
              <h2 class="text-5xl font-medium text-[var(--text-primary)] tracking-tight mb-4 leading-tight">โปรเจกต์ใหม่</h2>
              <p class="text-[var(--text-secondary)] font-medium text-lg leading-relaxed">สร้างพื้นที่สำหรับไอเดียถัดไปของคุณ ตั้งชื่อให้ชัดเจนและเริ่มทำงานร่วมกับทีมของคุณวันนี้</p>
            </div>
            <button @click="showAddBoardModal = false" class="p-5 rounded-3xl hover:bg-[var(--bg-main)] text-[var(--text-secondary)] transition-all border border-transparent hover:border-[var(--border-color)]" title="ปิดหน้าต่าง">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="space-y-8">
            <div class="space-y-3">
              <label class="text-[11px] font-medium text-indigo-500 uppercase tracking-widest pl-1">ชื่อโปรเจกต์</label>
              <input 
                v-model="newBoardTitle" 
                type="text" 
                class="input w-full h-16 px-6 text-lg font-medium bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all"
                placeholder="เช่น การตลาด Q4, เปิดตัวผลิตภัณฑ์ใหม่..."
                @keyup.enter="handleCreateBoard"
              />
            </div>

            <button 
              @click="handleCreateBoard"
              :disabled="!newBoardTitle.trim() || isSubmitting"
              class="btn btn-primary w-full h-16 text-sm tracking-[0.3em] uppercase font-bold shadow-2xl shadow-indigo-500/30"
            >
              {{ isSubmitting ? 'กำลังสร้าง...' : 'สร้างพื้นที่ทำงาน' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { api } from "../api/client";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/appStore";

const router = useRouter();
const store = useAppStore();

const overviewData = ref<any[]>([]);
const isLoading = ref(false);
const q = ref("");

const editingBoardId = ref<string | null>(null);
const editBoardTitle = ref("");

const showAddBoardModal = ref(false);
const newBoardTitle = ref("");
const isSubmitting = ref(false);

async function fetchOverview() {
  isLoading.value = true;
  try {
    const { data } = await api.get("/boards/overview");
    overviewData.value = data;
  } catch (err) {
    console.error("Failed to fetch overview", err);
  } finally {
    isLoading.value = false;
  }
}

const filteredBoards = computed(() => {
  const searchTerm = q.value.trim().toLowerCase();
  if (!searchTerm) return overviewData.value;
  return overviewData.value.filter((b: any) => b.title.toLowerCase().includes(searchTerm));
});

function getTotalTasks(board: any) {
  return board.columns.reduce((sum: number, col: any) => sum + col.tasks.length, 0);
}

function startEditBoard(board: any) {
  editingBoardId.value = board.id;
  editBoardTitle.value = board.title;
}

async function handleRenameBoard(board: any) {
  if (!editBoardTitle.value.trim()) return;
  try {
    await api.patch(`/boards/${board.id}`, { title: editBoardTitle.value.trim() });
    board.title = editBoardTitle.value.trim();
    editingBoardId.value = null;
  } catch (err) {
    alert("Failed to rename board");
  }
}

async function handleDeleteBoard(board: any) {
  if (!confirm(`Are you sure you want to delete board "${board.title}"?`)) return;
  try {
    await api.delete(`/boards/${board.id}`);
    overviewData.value = overviewData.value.filter((b: any) => b.id !== board.id);
  } catch (err) {
    alert("Failed to delete board");
  }
}

async function handleCreateBoard() {
  if (!newBoardTitle.value.trim() || isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    await api.post("/boards", { title: newBoardTitle.value.trim() });
    newBoardTitle.value = "";
    showAddBoardModal.value = false;
    await fetchOverview(); // Refresh
  } catch (err) {
    alert("Failed to create board");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(fetchOverview);
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

