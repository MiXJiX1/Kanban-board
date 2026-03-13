<script setup lang="ts">
import { onMounted, ref, nextTick, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../api/client";
import draggable from "vuedraggable";

const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
};

import { useAppStore } from "../stores/appStore";

/* ---------- Types ---------- */
type Tag   = { id: string; name: string; color: string };
type User  = { id: string; email: string; avatar?: string };
type Member = { user: User };
type Assignee = { user: User };
type Task  = {
  id: string; title: string; position: number;
  taskTags: { tag: Tag }[];
  assignees?: Assignee[];
};
type Column= { id: string; title: string; position: number; tasks: Task[] };
type Board = { id: string; title: string; columns: Column[]; tags: Tag[]; memberships: Member[] };

/* ---------- State ---------- */
const route = useRoute();
const router = useRouter();
const store = useAppStore();

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push("/boards");
}

const board = ref<Board|null>(null);
const tags  = ref<Tag[]>([]);

const newColTitle   = ref("");
const newTaskTitle  = ref<Record<string,string>>({});
const inviteEmail   = ref("");
const inviteLink    = ref("");
const newTagName    = ref("");

const renaming  = ref(false);
const boardTitle= ref("");
const showAddModal = ref(false);
const activeTab = ref("tags"); // tags, invite, columns
const selectedColor = ref("#3b82f6");

const labelColors = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Green', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
];

const editing   = ref<{type:"task"|"col"; id:string}|null>(null);
const editText  = ref("");
const isSaving = ref(false);
const showTaskInput = ref<Record<string, boolean>>({});

/* ---------- Load ---------- */
async function load(){
  // Optimistic UI: Preload if available in store
  const cached = store.boards.find(b => b.id === route.params.id);
  if (cached && !board.value) {
    board.value = cached as any;
  }
  
  const data: Board = (await api.get(`/boards/${route.params.id}`)).data;
  board.value = data;
  tags.value  = data.tags ?? [];
}
onMounted(load);

const members = computed<User[]>(() =>
  board.value?.memberships?.map(m => m.user) ?? []
);

/* ---------- Columns / Tasks ---------- */
async function addColumn(){
  if(!board.value || !newColTitle.value.trim()) return;
  await api.post(`/boards/${board.value.id}/columns`, {
    title: newColTitle.value.trim(),
    position: board.value.columns.length
  });
  newColTitle.value = "";
  await load();
}

async function deleteCurrentBoard(){
  if(!board.value) return;
  if(!confirm(`ลบกระดาน "${board.value.title}" และข้อมูลทั้งหมดใช่หรือไม่?`)) return;
  await api.delete(`/boards/${board.value.id}`);
  router.push("/boards");
}

function startRenameBoard(){
  if(!board.value) return;
  renaming.value  = true;
  boardTitle.value= board.value.title;
}
async function saveBoardTitle(){
  if(!board.value) return;
  const title = boardTitle.value.trim();
  if(!title){ renaming.value=false; return; }
  const { data } = await api.patch(`/boards/${board.value.id}`, { title });
  board.value.title = data.title;
  renaming.value=false;
}

async function addTask(col: Column){
  const title = (newTaskTitle.value[col.id] || "").trim();
  if(!title) {
    showTaskInput.value[col.id] = false;
    return;
  }
  await api.post(`/columns/${col.id}/tasks`, { title, position: col.tasks.length });
  newTaskTitle.value[col.id] = "";
  showTaskInput.value[col.id] = false;
  await load();
}

function startAddTask(col: Column) {
  showTaskInput.value[col.id] = true;
  newTaskTitle.value[col.id] = "";
}

/* Drag & drop */
async function saveAllTaskOrders(){
  if(!board.value || isSaving.value) return;
  isSaving.value = true;
  try {
    // We'll save sequentially to avoid race conditions and help identify where it fails
    for (const c of board.value.columns) {
      if (c.tasks.length === 0) continue; // Skip empty columns to reduce overhead
      await api.patch("/tasks/reorder", {
        columnId: c.id,
        items: c.tasks.map((t,i)=>({ id:t.id, position:i }))
      });
    }
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message;
    alert("บันทึกลำดับงานไม่สำเร็จ: " + msg);
    console.error("Full reorder error object:", err);
    await load();
  } finally {
    isSaving.value = false;
  }
}
async function onTasksChange(){ await nextTick(); await saveAllTaskOrders(); }
async function onColsChange(){
  if(!board.value) return;
  try {
    await api.patch("/columns/reorder", {
      items: board.value.columns.map((c,i)=>({ id:c.id, position:i }))
    });
  } catch (err: any) {
    alert("บันทึกลำดับคอลัมน์ไม่สำเร็จ: " + (err.response?.data?.message || err.message));
    await load();
  }
}

/* edit / delete */
function startEditCol(c:Column){ editing.value={type:"col", id:c.id}; editText.value=c.title; }
function startEditTask(t:Task){  editing.value={type:"task",id:t.id}; editText.value=t.title; }
async function saveEdit(){
  if(!editing.value) return;
  if(editing.value.type==="col")
    await api.patch(`/columns/${editing.value.id}`, { title: editText.value.trim() });
  else
    await api.patch(`/tasks/${editing.value.id}`,   { title: editText.value.trim() });
  editing.value=null; editText.value=""; await load();
}
async function delCol(c:Column){ if(confirm("ลบคอลัมน์และงานทั้งหมดในนี้ใช่หรือไม่?")){ await api.delete(`/columns/${c.id}`); await load(); } }
async function delTask(t:Task){ if(confirm("ลบงานนี้ใช่หรือไม่?")){ await api.delete(`/tasks/${t.id}`); await load(); } }

/* Invites */
async function createInvite(){
  const { data } = await api.post(`/boards/${route.params.id}/invites`, {
    email: inviteEmail.value || undefined
  });
  inviteLink.value = data.inviteUrl;
}

/* Tags */
async function addTag(){
  if(!newTagName.value.trim()) return;
  const t: Tag = (await api.post(`/boards/${route.params.id}/tags`, { 
    name: newTagName.value.trim(),
    color: selectedColor.value 
  })).data;
  tags.value.push(t); newTagName.value="";
}
async function removeTag(tagId: string) {
  await api.delete(`/boards/${route.params.id}/tags/${tagId}`);
  tags.value = tags.value.filter(t => t.id !== tagId);
  await load();
}
async function toggleTag(taskId:string, tagId:string, on:boolean){
  if(on) await api.post(`/tasks/${taskId}/tags/${tagId}`);
  else   await api.delete(`/tasks/${taskId}/tags/${tagId}`);
  await load();
}

/* Assignees */
function isAssigned(t: Task, userId: string){
  return !!t.assignees?.some(a => a.user.id === userId);
}
async function toggleAssignee(taskId: string, userId: string, on: boolean){
  if(on) await api.post(`/tasks/${taskId}/assignees/${userId}`);
  else   await api.delete(`/tasks/${taskId}/assignees/${userId}`);
  await load();
}
</script>

<template>
  <section v-if="board" class="h-full flex flex-col animate-fade-up">
    <!-- Header Refined -->
    <div class="px-10 pt-6 pb-2 flex-shrink-0">
      <div class="flex items-center gap-2 mb-2">
        <div class="flex items-center gap-2 px-3 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full text-[9px] font-medium uppercase tracking-[0.2em] border border-indigo-500/20 glow-indigo mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
          </svg>
          สปรินต์ที่เปิดอยู่
        </div>
      </div>
      
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div class="max-w-3xl">
          <h1 class="text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-2 leading-tight">{{ board.title }}</h1>
          <p class="text-[var(--text-secondary)] font-medium leading-relaxed text-sm max-w-2xl opacity-80">
            ปรับแต่งเวิร์กโฟลว์ของคุณ ทำงานร่วมกันแบบเรียลไทม์ และบรรลุเป้าหมาย
          </p>
        </div>
        
        <!-- Stacked Avatars -->
        <div class="flex items-center group cursor-pointer">
          <div class="flex -space-x-3 overflow-hidden p-1">
            <div v-for="(u, i) in members.slice(0, 5)" :key="u.id" 
              class="inline-block h-12 w-12 rounded-2xl ring-4 ring-[var(--bg-main)] bg-[var(--bg-surface)] overflow-hidden shadow-sm transition-transform hover:-translate-y-1"
              :style="{ zIndex: 10 - i }"
            >
              <img v-if="u.avatar" :src="u.avatar" class="h-full w-full object-cover" />
              <div v-else class="h-full w-full grid place-items-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium text-sm uppercase">
                {{ u.email[0] }}
              </div>
            </div>
            <div v-if="members.length > 5" class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] ring-4 ring-[var(--bg-main)] shadow-sm">
              +{{ members.length - 5 }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center gap-4 px-10 border-b border-[var(--border-color)] pb-4 flex-shrink-0">
      <template v-if="!renaming">
        <button class="p-2.5 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-indigo-500 border border-transparent hover:border-[var(--border-color)] transition-all duration-300" @click="goBack" title="กลับ">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button class="btn btn-primary h-11 px-8 rounded-2xl text-[11px] tracking-widest uppercase font-medium" @click="showAddModal = true">
          การตั้งค่า
        </button>
        <div class="h-6 w-[1px] bg-[var(--border-color)] mx-2"></div>
        <button class="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all" @click="startRenameBoard" title="เปลี่ยนชื่อกระดาน">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button class="p-2.5 rounded-xl text-rose-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all" @click="deleteCurrentBoard" title="ลบกระดาน">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </template>
      <template v-else>
        <div class="flex items-center gap-3 bg-[var(--bg-surface)] p-1.5 rounded-2xl shadow-sm border border-[var(--border-color)]">
          <input
            v-model="boardTitle"
            class="input border-none focus:ring-0 w-64 text-sm font-medium bg-transparent"
            placeholder="ชื่อกระดานงาน"
            @keyup.enter="saveBoardTitle"
          />
          <button class="btn btn-primary h-9 px-4 rounded-xl text-[10px] tracking-widest uppercase" @click="saveBoardTitle">บันทึก</button>
          <button class="p-2 text-[var(--text-secondary)] hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" @click="renaming=false">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </template>
    </div>

    <!-- Board Options Modal Refined -->
    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" @click="showAddModal = false">
        <div class="w-full max-w-2xl rounded-[32px] bg-white dark:bg-slate-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-2xl overflow-hidden relative border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300" @click.stop>
          <!-- Modal Top Glow (Premium Detail) -->
          <div class="absolute -top-24 -left-24 h-48 w-48 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none"></div>
          
          <!-- Modal Header (More Compact) -->
          <div class="flex items-center justify-between px-10 py-6">
            <div class="flex items-center gap-4">
              <div class="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg glow-indigo">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </div>
              <div>
                <h3 class="text-2xl font-medium text-[var(--text-primary)] tracking-tight">การตั้งค่ากระดาน</h3>
                <p class="text-sm font-medium text-[var(--text-secondary)]">ปรับแต่งประสบการณ์พื้นที่ทำงานของคุณ</p>
              </div>
            </div>
            <button @click="showAddModal = false" class="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="flex px-10 border-b border-[var(--border-color)] overflow-x-auto no-scrollbar">
            <button 
              v-for="tab in ['tags', 'invite', 'columns']" 
              :key="tab"
              @click="activeTab = tab"
              class="px-5 py-4 text-[11px] font-medium uppercase tracking-widest transition-all whitespace-nowrap border-b-2 outline-none focus:outline-none"
              :class="activeTab === tab ? 'text-indigo-500 border-indigo-500' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'"
            >
              {{ tab === 'tags' ? 'จัดการแท็ก' : tab === 'invite' ? 'เชิญทีมงาน' : 'การตั้งค่าคอลัมน์' }}
            </button>
          </div>

          <!-- Modal Body -->
          <div class="p-6 h-[400px] overflow-y-auto">
            
            <div v-if="activeTab === 'tags'" class="space-y-6">
              <div>
                <div class="flex justify-between items-center mb-3">
                  <label class="block text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest">สีป้ายกำกับ</label>
                  <span class="text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-widest">เลือกสีพื้นฐาน</span>
                </div>
                <div class="flex flex-wrap gap-3">
                  <button 
                    v-for="color in labelColors" 
                    :key="color.value"
                    @click="selectedColor = color.value"
                    class="w-9 h-9 rounded-full transition-transform hover:scale-110 relative"
                    :style="{ backgroundColor: color.value }"
                  >
                    <div v-if="selectedColor === color.value" class="absolute inset-[-4px] border-2 border-white ring-4 ring-indigo-500/30 rounded-full"></div>
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-2">ชื่อป้ายกำกับแท็ก</label>
                <div class="flex gap-2">
                  <input
                    v-model="newTagName"
                    class="input flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium text-[13px] h-11"
                    placeholder="เช่น ลำดับความสำคัญสูง, การตลาด, บั๊ก..."
                    @keyup.enter="addTag"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-3">แท็กที่มีอยู่</label>
                <div class="flex flex-wrap gap-2">
                  <div 
                    v-for="tg in tags" 
                    :key="tg.id"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition"
                    :style="{ backgroundColor: tg.color + '15', color: tg.color, border: `1px solid ${tg.color}30` }"
                  >
                    <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: tg.color }"></div>
                    {{ tg.name }}
                    <button @click="removeTag(tg.id)" class="ml-1 hover:opacity-60">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'invite'" class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-[var(--text-primary)] uppercase tracking-tight mb-2">เชิญด้วยอีเมล</label>
                <p class="text-xs font-medium text-[var(--text-secondary)] mb-4">ผู้ใช้จะได้รับคำเชิญให้เข้าร่วมกระดานงานนี้</p>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    v-model="inviteEmail"
                    class="input flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium text-[13px] h-11"
                    placeholder="name@example.com"
                  />
                  <button class="btn btn-primary" @click="createInvite">ส่งคำเชิญ</button>
                </div>
              </div>

              <div v-if="inviteLink" class="p-4 bg-[var(--bg-main)]/50 rounded-2xl border border-[var(--border-color)]">
                <label class="block text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-3">ลิงก์สำหรับแชร์</label>
                <div class="flex gap-2">
                  <input
                    :value="inviteLink"
                    readonly
                    class="input flex-1 bg-[var(--bg-card)] text-xs"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                </div>
                <p class="text-[10px] font-medium text-[var(--text-secondary)] mt-3">ทุกคนที่มีลิงก์นี้สามารถแสดงความคิดเห็นหรือแก้ไขกระดานงานได้</p>
              </div>
            </div>

            <!-- Column Settings Tab -->
            <div v-else-if="activeTab === 'columns'" class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-[var(--text-primary)] uppercase tracking-tight mb-2">คอลัมน์ใหม่</label>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    v-model="newColTitle"
                    class="input flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium text-[13px] h-11"
                    placeholder="เช่น เสร็จสิ้น, ตรวจสอบคุณภาพ..."
                    @keyup.enter="addColumn"
                  />
                  <button class="btn btn-primary" @click="addColumn">เพิ่มคอลัมน์</button>
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-3">คอลัมน์ปัจจุบัน</label>
                <div class="divide-y divide-[var(--border-color)]">
                  <div v-for="col in board.columns" :key="col.id" class="py-4 flex items-center justify-between group/colitem">
                    <span class="text-sm font-medium text-[var(--text-primary)]">{{ col.title }}</span>
                    <div class="flex gap-2">
                      <button @click="startEditCol(col)" class="text-xs text-indigo-600 hover:underline">เปลี่ยนชื่อ</button>
                      <button @click="delCol(col)" class="text-xs text-rose-600 hover:underline">ลบ</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
          
          <!-- Modal Footer -->
          <div class="px-10 py-5 border-t border-[var(--border-color)] bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 mt-4">
            <button class="px-6 py-2 text-[11px] font-medium uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all" @click="showAddModal = false">ยกเลิก</button>
            <button class="btn btn-primary px-6" @click="addTag(); showAddModal = false" v-if="activeTab === 'tags' && newTagName">บันทึกการเปลี่ยนแปลง</button>
            <button class="btn btn-primary px-6" @click="showAddModal = false" v-else>เสร็จสิ้น</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Columns (Refined) -->
    <draggable
      v-model="board.columns"
      group="columns"
      item-key="id"
      class="flex-1 flex gap-6 overflow-x-auto px-8 pt-4 pb-8 items-stretch"
      @change="onColsChange"
    >
      <template #item="{ element: col }">
        <div class="flex-shrink-0 w-[400px] h-full flex flex-col bg-slate-100 dark:bg-slate-900/50 rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-xl relative group/col">
          
          <!-- Column Header -->
          <div class="flex items-center justify-between px-3 py-2 mb-6 group/col">
            <div class="flex items-center gap-3">
              <span class="text-[12px] font-medium tracking-[0.2em] text-[var(--text-primary)] uppercase flex items-center gap-3">
                {{ col.title }}
                <span class="px-2 py-0.5 rounded-lg bg-[var(--bg-main)] text-[var(--text-secondary)] font-medium text-[10px] min-w-[20px] text-center border border-[var(--border-color)] shadow-sm">
                  {{ col.tasks.length }}
                </span>
              </span>
            </div>
            <button @click="startAddTask(col)" class="p-2 rounded-xl text-[var(--text-secondary)] hover:bg-indigo-500/10 hover:text-indigo-500 transition-all opacity-0 group-hover/col:opacity-100">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <!-- Tasks List -->
          <draggable
            v-model="col.tasks"
            group="tasks"
            item-key="id"
            class="flex-1 space-y-4 overflow-y-auto px-1 pr-2 pb-4 custom-scrollbar min-h-[150px]"
            @change="onTasksChange"
          >
            <template #item="{ element: t }">
              <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 relative group/card active:scale-[0.98] hover:shadow-md hover:border-indigo-500/30 transition-all duration-200">
                
                <!-- Card Header: Tag -->
                <div class="flex items-center justify-between mb-4">
                  <div class="flex gap-2 flex-wrap">
                    <span
                      v-for="tt in t.taskTags"
                      :key="tt.tag.id"
                      class="px-2.5 py-1 rounded-lg text-[9px] font-medium uppercase tracking-wider border"
                      :style="{ backgroundColor: tt.tag.color + '10', color: tt.tag.color, borderColor: tt.tag.color + '25' }"
                    >
                      {{ tt.tag.name }}
                    </span>
                    <span v-if="!t.taskTags.length" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)] text-[9px] font-medium uppercase tracking-wider">ทั่วไป</span>
                  </div>
                  <button class="p-1.5 text-slate-300 hover:text-indigo-500 opacity-0 group-hover/card:opacity-100 transition-all" @click.stop="startEditTask(t)">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                      </svg>
                  </button>
                </div>

                <!-- Card Body: Title / Edit Input -->
                <div v-if="editing?.id !== t.id">
                  <h4 class="text-[16px] font-semibold text-[var(--text-primary)] leading-relaxed mb-4">
                    {{ t.title }}
                  </h4>
                </div>
                <div v-else class="mb-4">
                  <input 
                    v-model="editText" 
                    autofocus
                    class="input w-full h-10 px-3 text-[14px] font-medium"
                    @keyup.enter="saveEdit"
                    @keyup.esc="editing = null"
                    @click.stop
                  />
                  <div class="flex gap-3 mt-3">
                    <button @click.stop="saveEdit" class="text-[11px] font-medium text-indigo-600 uppercase tracking-widest hover:text-indigo-500">บันทึก</button>
                    <button @click.stop="editing = null" class="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-widest hover:text-slate-500">ยกเลิก</button>
                  </div>
                </div>

                <!-- Priority / Badge -->
                <div v-if="t.taskTags.some((tt: any) => tt.tag.name.toLowerCase().includes('bug'))" class="flex items-center gap-2 text-[10px] font-bold text-rose-500 mb-5 uppercase tracking-wider bg-rose-500/10 w-fit px-2 py-1 rounded-md">
                   <span class="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                   🚨 ประเด็นสำคัญ
                </div>

                <!-- Card Footer -->
                <div class="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
                  <div class="flex items-center gap-4">
                    <div class="flex items-center gap-1.5 text-[var(--text-secondary)] text-[10px] font-medium">
                       <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      12 ต.ค.
                    </div>
                    
                    <button @click.stop="delTask(t)" class="p-1.5 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover/card:opacity-100">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div class="flex -space-x-2">
                    <div v-for="a in (t.assignees || []).slice(0, 1)" :key="a.user.id" class="h-7 w-7 rounded-lg border-2 border-[var(--bg-card)] bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-sm transition-transform hover:-translate-y-1">
                      <img v-if="a.user.avatar" :src="a.user.avatar" class="h-full w-full object-cover" />
                      <div v-else class="h-full w-full grid place-items-center bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium text-[9px] uppercase">
                        {{ a.user.email[0] }}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </template>
          </draggable>

          <!-- Footer: Add Task -->
          <div class="mt-4">
             <div v-if="showTaskInput[col.id]" class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-indigo-500 shadow-xl mb-3 animate-fade-up">
                <input 
                  v-model="newTaskTitle[col.id]"
                  v-focus
                  class="w-full px-1 py-1 text-[15px] font-medium text-[var(--text-primary)] bg-transparent outline-none"
                  placeholder="เพิ่มงานใหม่..."
                  @keyup.enter="addTask(col)"
                  @keyup.esc="showTaskInput[col.id] = false"
                />
                <div class="flex gap-4 mt-5">
                  <button @click="addTask(col)" class="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition">สร้าง</button>
                  <button @click="showTaskInput[col.id] = false" class="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-[var(--text-secondary)] rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-200 transition">ยกเลิก</button>
                </div>
             </div>
             <button v-else @click="startAddTask(col)" class="w-full py-3.5 flex items-center justify-center gap-3 text-[11px] font-bold text-[var(--text-secondary)] hover:text-indigo-600 hover:bg-indigo-500/10 rounded-xl transition-all uppercase tracking-widest">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
               เพิ่มงานใหม่
             </button>
          </div>
        </div>
      </template>
    </draggable>
  </section>

  <div v-else class="p-4 text-slate-500">กำลังโหลด…</div>
</template>
