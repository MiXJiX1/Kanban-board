<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/client";

const router = useRouter();

const email = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");

async function register() {
  if (!email.value.trim() || !password.value.trim()) {
    errorMsg.value = "กรุณากรอกอีเมลและรหัสผ่าน";
    return;
  }

  loading.value = true;
  errorMsg.value = "";

  try {
    await api.post("/auth/register", {
      email: email.value,
      password: password.value,
    });
    router.push("/login");
  } catch (e: any) {
    errorMsg.value =
      e?.response?.data?.message ||
      (e?.response?.status === 409
        ? "อีเมลนี้ถูกใช้งานไปแล้ว"
        : "สมัครสมาชิกไม่สำเร็จ");
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
          สร้างบัญชีใหม่
        </h1>
        <p class="text-[var(--text-secondary)] text-sm">
          เข้าร่วมกระดานคัมบังวันนี้
        </p>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            อีเมล
          </label>
          <input
            v-model="email"
            class="input w-full bg-[var(--bg-main)]/50 text-[var(--text-primary)] placeholder-slate-500 border-slate-300 dark:border-[var(--border-color)]"
            type="email"
            placeholder="you@example.com"
            @keyup.enter="register"
            autofocus
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            รหัสผ่าน
          </label>
          <input
            v-model="password"
            class="input w-full bg-[var(--bg-main)]/50 text-[var(--text-primary)] placeholder-slate-500 border-slate-300 dark:border-[var(--border-color)]"
            type="password"
            placeholder="••••••••"
            @keyup.enter="register"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-red-500">
          {{ errorMsg }}
        </p>

        <button
          class="btn btn-primary w-full"
          :disabled="loading"
          @click="register"
        >
          <span v-if="!loading">สร้างบัญชี</span>
          <span v-else>กำลังสร้าง…</span>
        </button>

        <p class="text-center text-sm text-slate-500 dark:text-slate-400">
          มีบัญชีอยู่แล้วใช่หรือไม่?
          <router-link class="text-violet-400 hover:underline" to="/login">
            เข้าสู่ระบบ
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
