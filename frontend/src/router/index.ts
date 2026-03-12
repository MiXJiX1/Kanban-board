import { createRouter, createWebHistory } from "vue-router";
import BoardsPage from "../pages/BoardsPage.vue";
import BoardDetailPage from "../pages/BoardDetailPage.vue";
import LoginPage from "../pages/LoginPage.vue";
import RegisterPage from "../pages/RegisterPage.vue";
import AcceptInvitePage from "../pages/AcceptInvitePage.vue";
import ProfilePage from "../pages/ProfilePage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/boards" },
    { path: "/login", component: LoginPage },
    { path: "/register", component: RegisterPage },
    { path: "/boards", component: BoardsPage },
    { path: "/boards/:id", component: BoardDetailPage, props: true },
    { path: "/accept-invite", component: AcceptInvitePage },
    { path: "/profile", component: ProfilePage }
  ],
});

router.beforeEach((to) => {
  const t = localStorage.getItem("token");
  if (!t && (to.path.startsWith("/boards") || to.path === "/profile")) return "/login";
});
export default router;
