<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api, setToken } from "../api/client";

const router = useRouter();

const email = ref("demo@local");
const password = ref("123456");
const loading = ref(false);
const errorMsg = ref("");

async function login() {
  if (!email.value.trim() || !password.value.trim()) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    const { data } = await api.post("/auth/login", {
      email: email.value,
      password: password.value,
    });
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("sessionStartTime", Date.now().toString());
    setToken(data.token);
    router.push("/boards");
  } catch {
    errorMsg.value = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-72px)] grid place-items-center">
    <div class="card w-full max-w-md p-6 bg-[var(--bg-card)] border border-[var(--border-color)]">
      <div class="mb-5 text-center">
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">
          ยินดีต้อนรับกลับมา
        </h1>
        <p class="text-[var(--text-secondary)] text-sm">
          ลงชื่อเข้าใช้กระดานคัมบังของคุณ
        </p>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >อีเมล</label
          >
          <input
            v-model="email"
            class="input w-full bg-[var(--bg-main)]/50 text-[var(--text-primary)] placeholder-slate-500 border-slate-300 dark:border-[var(--border-color)]"
            type="email"
            placeholder="you@example.com"
            @keyup.enter="login"
            autofocus
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >รหัสผ่าน</label
          >
          <input
            v-model="password"
            class="input w-full bg-[var(--bg-main)]/50 text-[var(--text-primary)] placeholder-slate-500 border-slate-300 dark:border-[var(--border-color)]"
            type="password"
            placeholder="••••••••"
            @keyup.enter="login"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>

        <button
          class="btn btn-primary w-full"
          :disabled="loading"
          @click="login"
        >
          <span v-if="!loading">เข้าสู่ระบบ</span>
          <span v-else>กำลังเข้าสู่ระบบ…</span>
        </button>

        <p class="text-center text-sm text-slate-500 dark:text-slate-400">
          ยังไม่มีบัญชีใช่หรือไม่?
          <router-link class="text-violet-400 hover:underline" to="/register">
            สมัครสมาชิก
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
