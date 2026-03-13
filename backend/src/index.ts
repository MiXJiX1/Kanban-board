import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import asyncHandler from "express-async-handler";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

/* ------------------------------ CORS / JSON ------------------------------ */
const allowedOrigins =
  process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) : true;

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_: Request, res: Response) => res.json({ ok: true }));

/* ------------------------------- Helpers -------------------------------- */
const normalizeEmail = (e?: string | null) => (e ?? "").trim().toLowerCase();

async function notify(userId: string, title: string, body?: string, data?: any) {
  try {
    await prisma.notification.create({
      data: { userId, title, body, data: (data ?? {}) as any },
    });
  } catch (e) {
    console.error("notify() failed", e);
  }
}

/* --------------------------------- Auth --------------------------------- */
app.post("/auth/register", asyncHandler(async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail((req.body as any).email);
    const password = (req.body as any).password as string;
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hash } });
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
  } catch (e: any) {
    if (e.code === "P2002") {
       res.status(409).json({ message: "Email already used" });
       return;
    }
    res.status(500).json({ message: "Register failed" });
  }
}));

app.post("/auth/login", asyncHandler(async (req: Request, res: Response) => {
  const email = normalizeEmail((req.body as any).email);
  const password = (req.body as any).password as string;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
     res.status(401).json({ message: "Invalid" });
     return;
  }
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
}));

function auth(req: Request & { userId?: string }, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.userId = (jwt.verify(h.slice(7), JWT_SECRET) as any).sub as string;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

/* --------------------------------- Profile --------------------------------- */
app.get("/users/me", auth, asyncHandler(async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, avatar: true } });
  if (!user) { res.status(404).json({ message: "User not found" }); return; }
  res.json(user);
}));

app.post("/users/me/avatar", auth, asyncHandler(async (req: any, res) => {
  const { avatar } = req.body as { avatar?: string };
  await prisma.user.update({ where: { id: req.userId }, data: { avatar } });
  res.json({ ok: true });
}));

app.patch("/auth/change-password", auth, asyncHandler(async (req: any, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) { res.status(400).json({ message: "Required" }); return; }
  
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
    res.status(400).json({ message: "Invalid old password" }); return;
  }
  
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: req.userId }, data: { password: hash } });
  res.json({ ok: true });
}));

app.get("/users/me/invites", auth, asyncHandler(async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) { res.status(404).json({ message: "Not found" }); return; }
  
  const items = await prisma.invitation.findMany({
    where: { email: user.email },
    include: { board: { select: { title: true } } },
    orderBy: { expiresAt: "desc" }
  });
  res.json(items);
}));

/* ---------------------------- Helpers / ACL ----------------------------- */
async function isBoardMember(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { id: true, ownerId: true } });
  if (!board) {
    console.log(`isBoardMember: Board ${boardId} not found`);
    return false;
  }
  if (board.ownerId === userId) {
    console.log(`isBoardMember: User ${userId} is owner of board ${boardId}`);
    return true;
  }
  const m = await prisma.membership.findUnique({ where: { boardId_userId: { boardId, userId } } });
  console.log(`isBoardMember: Membership for user ${userId} on board ${boardId}: ${!!m}`);
  return !!m;
}
async function isBoardOwner(boardId: string, userId: string) {
  const b = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  return !!b && b.ownerId === userId;
}
async function getBoardIdByColumn(colId: string) {
  const col = await prisma.column.findUnique({ where: { id: colId }, select: { boardId: true } });
  return col?.boardId;
}
async function getBoardIdByTask(taskId: string) {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { column: { select: { boardId: true } } },
  });
  return t?.column.boardId;
}

/* -------------------------------- Boards -------------------------------- */
app.get("/boards", auth, asyncHandler(async (req: any, res) => {
  const userId = req.userId as string;
  const [owned, member] = await Promise.all([
    prisma.board.findMany({ where: { ownerId: userId } }),
    prisma.membership.findMany({
      where: { userId, board: { ownerId: { not: userId } } },
      select: { board: true },
    }),
  ]);
  res.json([...owned, ...member.map((m) => m.board)]);
}));

app.get("/boards/overview", auth, asyncHandler(async (req: any, res) => {
  const userId = req.userId as string;
  
  // Fetch boards where user is owner or member
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { boardId: true }
  });
  const boardIds = memberships.map(m => m.boardId);

  const boards = await prisma.board.findMany({
    where: { id: { in: boardIds } },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            orderBy: { position: "asc" },
            include: {
              taskTags: { include: { tag: true } },
              assignees: { include: { user: { select: { id: true, email: true, avatar: true } } } }
            }
          }
        }
      }
    },
    orderBy: { title: "asc" }
  });

  res.json(boards);
}));

app.post("/boards", auth, asyncHandler(async (req: any, res) => {
  const userId = req.userId as string;
  const { title } = req.body as { title: string };
  const board = await prisma.board.create({ data: { title, ownerId: userId } });
  await prisma.membership.create({ data: { boardId: board.id, userId, role: "OWNER" } });
  res.json(board);
}));

// PATCH เปลี่ยนชื่อบอร์ด
app.patch("/boards/:id", auth, asyncHandler(async (req: any, res) => {
  const { id } = req.params as { id: string };
  const { title } = req.body as { title: string };
  if (!title?.trim()) { res.status(400).json({ message: "Title required" }); return; }
  if (!(await isBoardMember(id, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${id}` }); return; }
  const updated = await prisma.board.update({ where: { id }, data: { title: title.trim() } });
  res.json(updated);
}));

app.get("/boards/:id", auth, asyncHandler(async (req: any, res) => {
  const { id } = req.params;
  if (!(await isBoardMember(id, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${id} for viewing` }); return; }
  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            orderBy: { position: "asc" },
            include: {
              taskTags: { include: { tag: true } },
              assignees: { include: { user: { select: { id: true, email: true, avatar: true } } } },
            },
          },
        },
      },
      tags: true,
      memberships: { include: { user: { select: { id: true, email: true, avatar: true } } } },
    },
  });
  if (!board) { res.status(404).json({ message: "Board not found" }); return; }
  res.json(board);
}));

app.delete("/boards/:id", auth, asyncHandler(async (req: any, res) => {
  const { id } = req.params as { id: string };
  if (!(await isBoardOwner(id, req.userId))) { res.status(403).json({ message: "Only board owner can delete" }); return; }

  await prisma.$transaction(async (tx) => {
    const cols = await tx.column.findMany({ where: { boardId: id }, select: { id: true } });
    const colIds = cols.map((c) => c.id);

    if (colIds.length) {
      const tasks = await tx.task.findMany({ where: { columnId: { in: colIds } }, select: { id: true } });
      const taskIds = tasks.map((t) => t.id);

      if (taskIds.length) {
        await tx.taskTag.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.task.deleteMany({ where: { id: { in: taskIds } } });
      }
      await tx.column.deleteMany({ where: { id: { in: colIds } } });
    }

    await tx.membership.deleteMany({ where: { boardId: id } });
    await tx.tag.deleteMany({ where: { boardId: id } });
    await tx.invitation.deleteMany({ where: { boardId: id } });
    await tx.board.delete({ where: { id } });
  });

  res.json({ ok: true });
}));

/* -------------------------------- Columns ------------------------------- */
app.post("/boards/:boardId/columns", auth, asyncHandler(async (req: any, res) => {
  const { boardId } = req.params;
  if (!(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for column creation` }); return; }
  const { title, position } = req.body as { title: string; position: number };
  res.json(await prisma.column.create({ data: { title, boardId, position } }));
}));

app.patch("/columns/reorder", auth, asyncHandler(async (req: any, res) => {
  const { items } = req.body as { items?: { id: string; position: number }[] };
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ message: "Invalid payload" }); return; }

  // Extract all unique column IDs
  const colIds = items.map(i => i.id);
  
  // Verify user has access to ALL corresponding boards
  const cols = await prisma.column.findMany({ where: { id: { in: colIds } }, select: { id: true, boardId: true } });
  if (cols.length !== colIds.length) { res.status(404).json({ message: "Some columns not found" }); return; }
  
  // Check membership for all unique boardIds
  const uniqueBoardIds = Array.from(new Set(cols.map(c => c.boardId)));
  for (const bId of uniqueBoardIds) {
    if (!(await isBoardMember(bId, req.userId))) { 
      res.status(403).json({ message: `Forbidden: No access to board ${bId} of column` }); 
      return; 
    }
  }

  await Promise.all(items.map((i) => prisma.column.update({ where: { id: i.id }, data: { position: i.position } })));
  res.json({ ok: true });
}));

app.patch("/columns/:colId", auth, asyncHandler(async (req: any, res) => {
  const { colId } = req.params;
  const boardId = await getBoardIdByColumn(colId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} of column ${colId}` }); return; }
  const { title } = req.body as { title: string };
  res.json(await prisma.column.update({ where: { id: colId }, data: { title } }));
}));

app.delete("/columns/:colId", auth, asyncHandler(async (req: any, res) => {
  const { colId } = req.params;
  const boardId = await getBoardIdByColumn(colId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for column deletion` }); return; }
  await prisma.task.deleteMany({ where: { columnId: colId } });
  await prisma.column.delete({ where: { id: colId } });
  res.json({ ok: true });
}));

/* --------------------------------- Tasks -------------------------------- */
app.post("/columns/:colId/tasks", auth, asyncHandler(async (req: any, res) => {
  const { colId } = req.params;
  const boardId = await getBoardIdByColumn(colId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for task creation` }); return; }
  const { title, position } = req.body as { title: string; position: number };
  if (typeof position !== "number") { res.status(400).json({ message: "Position required" }); return; }
  res.json(await prisma.task.create({ data: { title: title?.trim() || "New Task", columnId: colId, position } }));
}));

app.patch("/tasks/reorder", auth, asyncHandler(async (req: any, res) => {
  const { columnId, items } = req.body as { columnId?: string; items?: { id: string; position: number }[] };
  if (!columnId || !Array.isArray(items)) { res.status(400).json({ message: "Invalid payload" }); return; }

  // Verify access to destination column
  const destBoardId = await getBoardIdByColumn(columnId);
  if (!destBoardId) { res.status(403).json({ message: `Forbidden: Column ${columnId} not found or has no board` }); return; }
  if (!(await isBoardMember(destBoardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to destination board ${destBoardId}` }); return; }

  // Verify user has access to ALL corresponding boards of the tasks being moved (IDOR patch)
  const taskIds = items.map(i => i.id);
  const tasks = await prisma.task.findMany({ 
    where: { id: { in: taskIds } }, 
    select: { id: true, column: { select: { boardId: true } } } 
  });
  if (tasks.length !== taskIds.length) { res.status(404).json({ message: "Some tasks not found" }); return; }

  const uniqueBoardIds = Array.from(new Set(tasks.map(t => t.column.boardId)));
  console.log(`Reordering tasks in col ${columnId} for user ${req.userId}. Source boards: ${uniqueBoardIds.join(", ")}`);
  for (const bId of uniqueBoardIds) {
    const isMember = await isBoardMember(bId, req.userId);
    console.log(`Checking membership for board ${bId}: ${isMember}`);
    if (!isMember) { 
      res.status(403).json({ message: `Forbidden: No access to source board ${bId}` }); 
      return; 
    }
  }

  await Promise.all(
    items.map((it) => prisma.task.update({ where: { id: it.id }, data: { columnId, position: it.position } }))
  );
  res.json({ ok: true });
}));

app.patch("/tasks/:id", auth, asyncHandler(async (req: any, res) => {
  const { id } = req.params;
  const boardId = await getBoardIdByTask(id);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for task editing` }); return; }
  const { title } = req.body as { title: string };
  if (!title?.trim()) { res.status(400).json({ message: "Title required" }); return; }
  res.json(await prisma.task.update({ where: { id }, data: { title: title.trim() } }));
}));

app.delete("/tasks/:id", auth, asyncHandler(async (req: any, res) => {
  const { id } = req.params;
  const boardId = await getBoardIdByTask(id);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for task deletion` }); return; }
  await prisma.task.delete({ where: { id } });
  res.json({ ok: true });
}));

/* --------------------- Task Assignees (มอบหมายผู้รับผิดชอบ) -------------------- */
app.post("/tasks/:taskId/assignees/:userId", auth, asyncHandler(async (req: any, res) => {
  const { taskId, userId } = req.params;
  const boardId = await getBoardIdByTask(taskId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for task assignment` }); return; }
  const target = await prisma.membership.findUnique({ where: { boardId_userId: { boardId, userId } } });
  if (!target) { res.status(400).json({ message: "User is not a member of this board" }); return; }

  await prisma.taskAssignee.upsert({
    where: { taskId_userId: { taskId, userId } },
    update: {},
    create: { taskId, userId },
  });

  // แจ้งเตือนผู้ถูกมอบหมาย
  if (userId !== req.userId) {
    const [task, board] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId }, select: { title: true } }),
      prisma.board.findUnique({ where: { id: boardId }, select: { title: true } }),
    ]);
    await notify(
      userId,
      "Assigned to a task",
      `คุณถูกมอบหมายงาน "${task?.title ?? ""}" ในบอร์ด "${board?.title ?? ""}"`,
      { boardId, taskId }
    );
  }

  res.json({ ok: true });
}));

app.delete("/tasks/:taskId/assignees/:userId", auth, asyncHandler(async (req: any, res) => {
  const { taskId, userId } = req.params;
  const boardId = await getBoardIdByTask(taskId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for removing assignee` }); return; }

  await prisma.taskAssignee
    .delete({ where: { taskId_userId: { taskId, userId } } })
    .catch(() => void 0);

  res.json({ ok: true });
}));

/* ------------------------------- Invites -------------------------------- */
app.post("/boards/:boardId/invites", auth, asyncHandler(async (req: any, res) => {
  const { boardId } = req.params;
  if (!(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for creating invite` }); return; }

  const token = crypto.randomBytes(16).toString("hex");
  const inviteEmail = req.body?.email ? normalizeEmail(req.body.email) : undefined;

  const inv = await prisma.invitation.create({
    data: {
      token,
      boardId,
      email: inviteEmail,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 วัน
    },
  });


  if (inviteEmail) {
    const user = await prisma.user.findUnique({ where: { email: inviteEmail } });
    if (user) {
      const board = await prisma.board.findUnique({ where: { id: boardId }, select: { title: true } });
      await notify(user.id, "Board invitation", `คุณถูกเชิญให้เข้าร่วมบอร์ด "${board?.title ?? ""}"`, {
        boardId,
        token: inv.token,
      });
    }
  }

  res.json({
    inviteUrl: `${process.env.APP_ORIGIN ?? "http://localhost:5173"}/accept-invite?token=${inv.token}`,
  });
}));

app.post("/invites/accept", auth, asyncHandler(async (req: any, res) => {
  const { token } = req.body as { token: string };
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv || inv.accepted || inv.expiresAt < new Date()) { res.status(400).json({ message: "Invalid invite" }); return; }

  await prisma.membership.upsert({
    where: { boardId_userId: { boardId: inv.boardId, userId: req.userId } },
    update: {},
    create: { boardId: inv.boardId, userId: req.userId, role: "MEMBER" },
  });
  await prisma.invitation.update({ where: { token }, data: { accepted: true } });

  const board = await prisma.board.findUnique({ where: { id: inv.boardId }, select: { title: true, ownerId: true } });

  // แจ้งเตือนผู้ที่เข้าร่วม
  await notify(req.userId, "Joined the board", `คุณเข้าร่วมบอร์ด "${board?.title ?? ""}" แล้ว`, {
    boardId: inv.boardId,
  });

  // แจ้งเตือนเจ้าของบอร์ดว่ามีสมาชิกใหม่
  if (board?.ownerId && board.ownerId !== req.userId) {
    await notify(board.ownerId, "Member joined", "มีสมาชิกใหม่เข้าร่วมบอร์ดของคุณ", {
      boardId: inv.boardId,
    });
  }

  res.json({ ok: true, boardId: inv.boardId });
}));

/* ---------------------------------- Tags -------------------------------- */
app.get("/boards/:boardId/tags", auth, asyncHandler(async (req: any, res) => {
  const { boardId } = req.params;
  if (!(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for viewing tags` }); return; }
  res.json(await prisma.tag.findMany({ where: { boardId } }));
}));

app.post("/boards/:boardId/tags", auth, asyncHandler(async (req: any, res) => {
  const { boardId } = req.params;
  const { name, color } = req.body as { name: string; color?: string };
  if (!(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for creating tag` }); return; }
  res.json(await prisma.tag.create({ data: { boardId, name, color: color ?? "#3b82f6" } }));
}));

app.post("/tasks/:taskId/tags/:tagId", auth, asyncHandler(async (req: any, res) => {
  const { taskId, tagId } = req.params;
  const boardId = await getBoardIdByTask(taskId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for adding tag to task` }); return; }
  await prisma.taskTag.upsert({ where: { taskId_tagId: { taskId, tagId } }, update: {}, create: { taskId, tagId } });
  res.json({ ok: true });
}));

app.delete("/tasks/:taskId/tags/:tagId", auth, asyncHandler(async (req: any, res) => {
  const { taskId, tagId } = req.params;
  const boardId = await getBoardIdByTask(taskId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) { res.status(403).json({ message: `Forbidden: No access to board ${boardId} for removing tag from task` }); return; }
  await prisma.taskTag.delete({ where: { taskId_tagId: { taskId, tagId } } });
  res.json({ ok: true });
}));

/* ---------------------------- Notifications API ------------------------- */
app.get("/notifications", auth, asyncHandler(async (req: any, res) => {
  const unread = (req.query.unread ?? "").toString() === "true";
  const items = await prisma.notification.findMany({
    where: { userId: req.userId, ...(unread ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(items);
}));

app.patch("/notifications/:id/read", auth, asyncHandler(async (req: any, res) => {
  const { id } = req.params;
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== req.userId) { res.status(404).json({ message: "Not found" }); return; }
  const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json(updated);
}));

app.post("/notifications/read-all", auth, asyncHandler(async (req: any, res) => {
  await prisma.notification.updateMany({ where: { userId: req.userId, read: false }, data: { read: true } });
  res.json({ ok: true });
}));

/* --------------------------------- Global Error Handler ----------------- */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack || err);
  res.status(500).json({ message: "Internal server error", detail: err.message });
});

/* --------------------------------- Start -------------------------------- */
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API on port ${port}`));
