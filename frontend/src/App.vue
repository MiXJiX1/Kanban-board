<template>
  <div class="min-h-screen bg-slate-900">
    <TopBar v-if="!isAuthPage" />
    <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <RouterView v-slot="{ Component }">
        <transition
          name="fade"
          mode="out-in"
          appear
        >
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import TopBar from "./components/TopBar.vue";
import { setToken } from "./api/client";

const route = useRoute();
const isAuthPage = computed(() => {
  return route.path === "/login" || route.path === "/register";
});

onMounted(() => {
  const token = localStorage.getItem("token");
  if (token) setToken(token);

  if (!document.title) document.title = "Kanban Board";
});
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity .18s ease, transform .18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
