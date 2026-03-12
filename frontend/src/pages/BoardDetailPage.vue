<script setup lang="ts">
import { onMounted, ref, nextTick, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../api/client";
import draggable from "vuedraggable";

import { useAppStore } from "../stores/appStore";

/* ---------- Types ---------- */
type Tag   = { id: string; name: string; color: string };
type User  = { id: string; email: string };
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
  if(!confirm(`Delete "${board.value.title}" and all data?`)) return;
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
  if(!title) return;
  await api.post(`/columns/${col.id}/tasks`, { title, position: col.tasks.length });
  newTaskTitle.value[col.id] = "";
  await load();
}

/* Drag & drop */
async function saveAllTaskOrders(){
  if(!board.value) return;
  try {
    await Promise.all(
      board.value.columns.map(c =>
        api.patch("/tasks/reorder", {
          columnId: c.id,
          items: c.tasks.map((t,i)=>({ id:t.id, position:i }))
        })
      )
    );
  } catch (err: any) {
    alert("Failed to save task order: " + (err.response?.data?.message || err.message));
    await load();
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
    alert("Failed to save column order: " + (err.response?.data?.message || err.message));
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
async function delCol(c:Column){ if(confirm("Delete column and its tasks?")){ await api.delete(`/columns/${c.id}`); await load(); } }
async function delTask(t:Task){ if(confirm("Delete task?")){ await api.delete(`/tasks/${t.id}`); await load(); } }

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
  <section v-if="board" class="space-y-6 p-4">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3">
      <template v-if="!renaming">
        <!-- ปุ่มย้อนกลับ -->
        <button class="btn btn-ghost" @click="goBack" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10.828 12l4.95-4.95-1.414-1.414L8 12l6.364 6.364 1.414-1.414z"/>
          </svg>
          <span class="hidden sm:inline">Back</span>
        </button>

        <h2 class="text-2xl font-bold text-slate-800">{{ board.title }}</h2>
        <button class="btn bg-white text-slate-700 border-slate-200 hover:bg-slate-50" @click="showAddModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Board Options
        </button>
        <button class="btn btn-outline" @click="startRenameBoard">Rename</button>
        <button class="btn btn-danger"  @click="deleteCurrentBoard">Delete</button>
      </template>
      <template v-else>
        <input
          v-model="boardTitle"
          class="input w-72 bg-white text-slate-900 placeholder-slate-400 border-slate-300"
          placeholder="Board title"
          @keyup.enter="saveBoardTitle"
        />
        <button class="btn btn-primary" @click="saveBoardTitle">Save</button>
        <button class="btn btn-ghost"    @click="renaming=false">Cancel</button>
      </template>
    </div>

    <!-- Board Options Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" @click="showAddModal = false">
      <div class="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden relative border border-slate-200" @click.stop>
        
        <!-- Modal Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 class="text-lg font-bold text-slate-800">Board Options</h3>
          </div>
          <button @click="showAddModal = false" class="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex px-6 border-b border-slate-100 overflow-x-auto no-scrollbar">
          <button 
            v-for="tab in ['tags', 'invite', 'columns']" 
            :key="tab"
            @click="activeTab = tab"
            class="px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap border-b-2"
            :class="activeTab === tab ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700'"
          >
            {{ tab.charAt(0).toUpperCase() + tab.slice(1).replace('tags', 'Manage Tags').replace('invite', 'Invite Team').replace('columns', 'Column Settings') }}
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 h-[400px] overflow-y-auto">
          
          <!-- Manage Tags Tab -->
          <div v-if="activeTab === 'tags'" class="space-y-6">
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Label Colors</label>
              <div class="flex flex-wrap gap-3">
                <button 
                  v-for="color in labelColors" 
                  :key="color.value"
                  @click="selectedColor = color.value"
                  class="w-8 h-8 rounded-full transition-transform hover:scale-110 relative"
                  :style="{ backgroundColor: color.value }"
                >
                  <div v-if="selectedColor === color.value" class="absolute inset-[-4px] border-2 border-indigo-500 rounded-full"></div>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tag Label Name</label>
              <div class="flex gap-2">
                <input
                  v-model="newTagName"
                  class="input flex-1 border-slate-200"
                  placeholder="e.g. High Priority, Marketing, Bug..."
                  @keyup.enter="addTag"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Existing Tags</label>
              <div class="flex flex-wrap gap-2">
                <div 
                  v-for="tg in tags" 
                  :key="tg.id"
                  class="pill px-3 py-1 flex items-center gap-2"
                  :style="{ backgroundColor: tg.color + '22', color: tg.color, border: `1px solid ${tg.color}44` }"
                >
                  <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: tg.color }"></div>
                  {{ tg.name }}
                  <button @click="removeTag(tg.id)" class="hover:opacity-60">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Invite Team Tab -->
          <div v-else-if="activeTab === 'invite'" class="space-y-6">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Invite by Email</label>
              <p class="text-xs text-slate-500 mb-4">Users will receive an invitation to join this board.</p>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  v-model="inviteEmail"
                  class="input flex-1 border-slate-200"
                  placeholder="name@example.com"
                />
                <button class="btn btn-primary" @click="createInvite">Send Invite</button>
              </div>
            </div>

            <div v-if="inviteLink" class="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Shareable Link</label>
              <div class="flex gap-2">
                <input
                  :value="inviteLink"
                  readonly
                  class="input flex-1 bg-white border-slate-200 text-xs"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </div>
              <p class="text-[10px] text-slate-400 mt-2">Anyone with this link can join the board.</p>
            </div>
          </div>

          <!-- Column Settings Tab -->
          <div v-else-if="activeTab === 'columns'" class="space-y-6">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">New Column</label>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  v-model="newColTitle"
                  class="input flex-1 border-slate-200"
                  placeholder="e.g. Done, Quality Assurance..."
                  @keyup.enter="addColumn"
                />
                <button class="btn btn-primary" @click="addColumn">Add Column</button>
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Current Columns</label>
              <div class="divide-y divide-slate-100">
                <div v-for="col in board.columns" :key="col.id" class="py-3 flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-700">{{ col.title }}</span>
                  <div class="flex gap-2">
                    <button @click="startEditCol(col)" class="text-xs text-indigo-600 hover:underline">Rename</button>
                    <button @click="delCol(col)" class="text-xs text-rose-600 hover:underline">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
        
        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button class="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition" @click="showAddModal = false">Discard</button>
          <button class="btn btn-primary px-6" @click="addTag(); showAddModal = false" v-if="activeTab === 'tags' && newTagName">Save Changes</button>
          <button class="btn btn-primary px-6" @click="showAddModal = false" v-else>Done</button>
        </div>
      </div>
    </div>

    <!-- Columns (draggable) -->
    <draggable
      v-model="board.columns"
      group="columns"
      item-key="id"
      class="grid gap-4 md:grid-cols-3"
      @change="onColsChange"
    >
      <template #item="{ element: col }">
        <div class="rounded-2xl border border-slate-200 bg-white text-slate-900 p-4 shadow">
          <div class="flex items-center gap-2">
            <strong v-if="!(editing && editing.type==='col' && editing.id===col.id)" class="truncate">
              {{ col.title }}
            </strong>
            <template v-else>
              <input
                v-model="editText"
                class="input bg-white text-slate-900 placeholder-slate-400 border-slate-300"
                @keyup.enter="saveEdit"
              />
              <button class="btn btn-primary" @click="saveEdit">Save</button>
            </template>
            <div class="ml-auto flex gap-2">
              <button class="btn btn-outline" @click="startEditCol(col)">Rename</button>
              <button class="btn btn-danger"  @click="delCol(col)">Delete</button>
            </div>
          </div>

          <!-- Tasks -->
          <draggable
            v-model="col.tasks"
            group="tasks"
            item-key="id"
            class="mt-3"
            @change="onTasksChange"
          >
            <template #item="{ element: t }">
              <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm mt-2">
                <div class="flex items-start gap-2">
                  <span v-if="!(editing && editing.type==='task' && editing.id===t.id)" class="flex-1">
                    {{ t.title }}
                  </span>
                  <template v-else>
                    <input
                      v-model="editText"
                      class="input bg-white text-slate-900 placeholder-slate-400 border-slate-300"
                      @keyup.enter="saveEdit"
                    />
                    <button class="btn btn-primary" @click="saveEdit">Save</button>
                  </template>
                  <div class="ml-auto flex gap-2">
                    <button class="btn btn-ghost"  @click="startEditTask(t)">Edit</button>
                    <button class="btn btn-danger" @click="delTask(t)">Del</button>
                  </div>
                </div>

                <!-- current tags -->
                <div class="mt-2">
                  <span
                    v-for="tt in t.taskTags"
                    :key="tt.tag.id"
                    class="mr-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                    :style="{ background: tt.tag.color }"
                  >
                    {{ tt.tag.name }}
                  </span>
                </div>

                <!-- current assignees -->
                <div class="mt-2 flex flex-wrap gap-2">
                  <span
                    v-for="a in t.assignees || []"
                    :key="a.user.id"
                    class="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800 border border-slate-200"
                    title="Assignee"
                  >
                    {{ a.user.email }}
                  </span>
                </div>

                <!-- tag selector -->
                <details class="mt-2">
                  <summary class="cursor-pointer text-sm text-slate-700">Tags</summary>
                  <div class="mt-2 space-y-1">
                    <label v-for="tg in tags" :key="tg.id" class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        :checked="t.taskTags?.some((x: any)=>x.tag.id===tg.id)"
                        @change="toggleTag(t.id, tg.id, ($event.target as HTMLInputElement).checked)"
                      />
                      <span
                        class="inline-flex items-center rounded px-1.5 py-0.5 text-white text-xs"
                        :style="{ background: tg.color }"
                      >
                        {{ tg.name }}
                      </span>
                    </label>
                  </div>
                </details>

                <!-- assignee selector -->
                <details class="mt-2">
                  <summary class="cursor-pointer text-sm text-slate-700">Assignees</summary>
                  <div class="mt-2 space-y-1">
                    <label
                      v-for="u in members"
                      :key="u.id"
                      class="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        :checked="isAssigned(t, u.id)"
                        @change="toggleAssignee(t.id, u.id, ($event.target as HTMLInputElement).checked)"
                      />
                      <span class="text-slate-800">{{ u.email }}</span>
                    </label>
                  </div>
                </details>
              </div>
            </template>
          </draggable>

          <div class="mt-3 flex items-center gap-2">
            <input
              v-model="newTaskTitle[col.id]"
              class="input flex-1 bg-white text-slate-900 placeholder-slate-400 border-slate-300"
              placeholder="New task..."
            />
            <button class="btn btn-primary" @click="addTask(col)">Add</button>
          </div>
        </div>
      </template>
    </draggable>
  </section>

  <div v-else class="p-4 text-slate-500">Loading…</div>
</template>
