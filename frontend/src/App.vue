<template>
  <div class="h-screen flex flex-col bg-[var(--bg-main)] transition-colors duration-300 overflow-hidden relative">
    <!-- Shared Stacking Context Container -->
    <div class="contents">
      <TopBar v-if="!isAuthPage" />
      <main class="flex-1 overflow-hidden w-full relative">
        <div class="h-full w-full">
          <RouterView v-slot="{ Component }">
            <transition
              name="fade"
              mode="out-in"
              appear
            >
              <component :is="Component" />
            </transition>
          </RouterView>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, watch } from "vue";
import { useRoute } from "vue-router";
import TopBar from "./components/TopBar.vue";
import { setToken } from "./api/client";
import { useAppStore } from "./stores/appStore";

const route = useRoute();
const store = useAppStore();

const isAuthPage = computed(() => {
  return route.path === "/login" || route.path === "/register";
});

const updateThemeClass = (isDark: boolean) => {
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

watch(() => store.isDarkMode, (isDark) => {
  updateThemeClass(isDark);
});

const checkSession = () => {
  const token = sessionStorage.getItem("token");
  const sessionStartTime = sessionStorage.getItem("sessionStartTime");

  if (token && sessionStartTime) {
    const ONE_HOUR = 3600000;
    const elapsed = Date.now() - parseInt(sessionStartTime);

    if (elapsed > ONE_HOUR) {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("sessionStartTime");
      setToken(""); 
      store.clearAuth();
      window.location.href = "/login";
      return true;
    }
  }
  return false;
};

watch(() => route.path, () => {
  if (!isAuthPage.value) {
    checkSession();
  }
});

onMounted(() => {
  const expired = checkSession();
  if (!expired) {
    const token = sessionStorage.getItem("token");
    if (token) setToken(token);
  }

  updateThemeClass(store.isDarkMode);
  if (!document.title || document.title === "Kanban Board") document.title = "กระดานคัมบัง";
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
