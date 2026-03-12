import { defineStore } from "pinia";
import { api } from "../api/client";

export const useAppStore = defineStore("app", {
  state: () => ({
    user: null as any,
    boards: [] as any[],
    invites: [] as any[],
    boardsLoaded: false,
    userLoaded: false,
    invitesLoaded: false,
  }),
  actions: {
    async fetchUser(force = false) {
      if (this.userLoaded && !force) return;
      try {
        const { data } = await api.get("/users/me");
        this.user = data;
        this.userLoaded = true;
      } catch (err) {
        console.error(err);
      }
    },
    async fetchBoards(force = false) {
      if (this.boardsLoaded && !force) {
        // fetch silently in background to update
        api.get("/boards").then(({ data }) => {
          this.boards = data;
        }).catch(console.error);
        return;
      }
      try {
        const { data } = await api.get("/boards");
        this.boards = data;
        this.boardsLoaded = true;
      } catch (err) {
        console.error(err);
      }
    },
    async fetchInvites(force = false) {
      if (this.invitesLoaded && !force) {
        api.get("/users/me/invites").then(({ data }) => {
          this.invites = data;
        }).catch(console.error);
        return;
      }
      try {
        const { data } = await api.get("/users/me/invites");
        this.invites = data;
        this.invitesLoaded = true;
      } catch (err) {
        console.error(err);
      }
    },
    clearAuth() {
      this.user = null;
      this.boards = [];
      this.invites = [];
      this.userLoaded = false;
      this.boardsLoaded = false;
      this.invitesLoaded = false;
    }
  }
});
