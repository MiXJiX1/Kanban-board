# Modern Kanban Board System

A full-stack, responsive Kanban Board application built for professional task management and collaboration.

## 🚀 Features

### 📋 Board Management
- **Workspace Overview**: View all your boards in a clean, responsive grid.
- **Search & Filter**: Quickly find boards by title.
- **Create/Manage**: Easily create new boards, rename existing ones, or delete them when finished.

### 🏗️ Kanban Core (Drag & Drop)
- **Dynamic Columns**: Add, rename, and reorder columns to fit your workflow.
- **Task Management**: Create tasks with titles, edit them, or move them between columns.
- **Seamless Reordering**: Fully interactive drag-and-drop support for both tasks and columns.

### 👥 Collaboration & Tags
- **Team Invitations**: Invite others to your board via email or a unique shareable link.
- **Task Assignment**: Assign team members to specific tasks.
- **Custom Tags**: Create color-coded tags (e.g., "Bug", "Feature", "High Priority") and attach them to tasks for better organization.
- **Quick Actions**: All board options (Tags, Invites, Columns) are consolidated into a clean, easy-to-use popup modal.

### 👤 User Profile & Security
- **Authentication**: Secure registration and login system using JWT.
- **Avatar Customization**: Upload and change your profile picture (stored efficiently as Base64).
- **Security Control**: Change your password directly from the profile settings.
- **Invite History**: Track all board invitations you've received in a dedicated history view.

### ⚡ Performance & UX
- **Lightning Fast Loading**: Implemented **Stale-while-revalidate** caching using Pinia. Navigating between pages is now near-instant without redundant loading screens.
- **Optimistic UI**: Board structures pre-load instantly from the cache while background synchronization ensures data consistency.
- **Responsive Design**: Mobile-friendly interface that works on all screen sizes.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: [Vue.js 3](https://vuejs.org/) (Composition API)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Routing**: [Vue Router](https://router.vuejs.org/)
- **Drag & Drop**: [vuedraggable](https://github.com/SortableJS/vue.draggable.next)
- **Styling**: Vanilla CSS with modern flexbox/grid layouts.

### Backend
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (Hosted on Supabase)
- **Auth**: JWT (JSON Web Tokens) & Bcrypt for password hashing.

---

## 🔒 Environment Variables

### Backend (`.env`)
```env
DATABASE_URL=your_postgresql_url
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=frontend_url
APP_ORIGIN=frontend_url (for invite links)
```

### Frontend (`.env`)
```env
VITE_API_BASE_URL=backend_url
```

---

## 📦 Installation & Setup

1. **Clone the repository**
2. **Setup Backend**:
   - `cd backend`
   - `npm install`
   - Configure `.env`
   - `npx prisma db push`
   - `npm run dev`
3. **Setup Frontend**:
   - `cd frontend`
   - `npm install`
   - Configure `.env`
   - `npm run dev`

---

Developed with ❤️ for efficient productivity.
