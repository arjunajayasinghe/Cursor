import "dotenv/config";
import path from "path";
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import {
  assignMasterBranchToCompany,
  bulkUpsertMasterProcesses,
  isNodeInAreaScope,
  loadProcessNodes,
  type FlatUploadRow,
} from "../src/lib/process-tree";
import { exportCompanyByValueStream } from "../src/lib/export-stub";

const PORT = Number(process.env.PORT || 3000);
const COOKIE = "aetria_session";
const secret = () =>
  new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "dev-secret-change-me-in-production-aetria-mvp"
  );

type Session = {
  id: string;
  email: string;
  name: string;
  isAetriaOperator: boolean;
  activeCompanyId: string | null;
};

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "public")));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5_000_000 } });

async function readSession(req: express.Request): Promise<Session | null> {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

async function writeSession(res: express.Response, session: Session) {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function getAccess(req: express.Request) {
  const session = await readSession(req);
  if (!session) return null;
  const companyId = session.activeCompanyId;
  const isMasterView = companyId === null;

  if (isMasterView) {
    if (!session.isAetriaOperator) return null;
    return {
      session,
      companyId: null as string | null,
      isMasterView: true,
      isAetriaOperator: true,
      companyRole: null as string | null,
      canEdit: true,
      canAdmin: true,
      areaScopeNodeIds: null as string[] | null,
    };
  }

  if (session.isAetriaOperator) {
    return {
      session,
      companyId,
      isMasterView: false,
      isAetriaOperator: true,
      companyRole: "ADMIN",
      canEdit: true,
      canAdmin: true,
      areaScopeNodeIds: null,
    };
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: session.id, companyId: companyId! } },
    include: { areaScopes: true },
  });
  if (!membership) return null;

  return {
    session,
    companyId,
    isMasterView: false,
    isAetriaOperator: false,
    companyRole: membership.role,
    canEdit: membership.role === "ADMIN" || membership.role === "AREA_EDITOR",
    canAdmin: membership.role === "ADMIN",
    areaScopeNodeIds:
      membership.role === "AREA_EDITOR"
        ? membership.areaScopes.map((s) => s.processNodeId)
        : null,
  };
}

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  let activeCompanyId: string | null = null;
  if (!user.isAetriaOperator) {
    const m = await prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    activeCompanyId = m?.companyId ?? null;
  }

  const session: Session = {
    id: user.id,
    email: user.email,
    name: user.name,
    isAetriaOperator: user.isAetriaOperator,
    activeCompanyId,
  };
  await writeSession(res, session);
  res.json({ ok: true, user: session });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const access = await getAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized" });

  let companies;
  if (access.session.isAetriaOperator) {
    companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  } else {
    const memberships = await prisma.membership.findMany({
      where: { userId: access.session.id },
      include: { company: true },
    });
    companies = memberships.map((m) => m.company);
  }

  const company = access.companyId
    ? await prisma.company.findUnique({ where: { id: access.companyId } })
    : null;

  res.json({
    session: access.session,
    access: {
      isMasterView: access.isMasterView,
      isAetriaOperator: access.isAetriaOperator,
      companyRole: access.companyRole,
      canEdit: access.canEdit,
      canAdmin: access.canAdmin,
      areaScopeNodeIds: access.areaScopeNodeIds,
      companyId: access.companyId,
      companyName: company?.name ?? null,
    },
    companies,
  });
});

app.post("/api/workspace/switch", async (req, res) => {
  const session = await readSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const raw = req.body?.companyId;
  const companyId = raw === null || raw === "" ? null : String(raw);

  if (companyId === null) {
    if (!session.isAetriaOperator) {
      return res.status(403).json({ error: "Only Aetria operators can open master" });
    }
  } else {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (!session.isAetriaOperator) {
      const m = await prisma.membership.findUnique({
        where: { userId_companyId: { userId: session.id, companyId } },
      });
      if (!m) return res.status(403).json({ error: "No access" });
    }
  }

  const next = { ...session, activeCompanyId: companyId };
  await writeSession(res, next);
  res.json({ ok: true, activeCompanyId: companyId });
});

app.get("/api/bootstrap", async (req, res) => {
  const access = await getAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized" });

  const [nodes, valueStreams] = await Promise.all([
    loadProcessNodes(access.companyId),
    prisma.valueStream.findMany({
      where: { companyId: access.companyId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  let companies: Awaited<ReturnType<typeof prisma.company.findMany>> = [];
  let assignments: unknown[] = [];
  if (access.isMasterView) {
    companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
    assignments = await prisma.processAssignment.findMany({
      include: { masterNode: true, company: true },
      orderBy: { assignedAt: "desc" },
      take: 20,
    });
  }

  const company = access.companyId
    ? await prisma.company.findUnique({ where: { id: access.companyId } })
    : null;

  res.json({
    access: {
      isMasterView: access.isMasterView,
      isAetriaOperator: access.isAetriaOperator,
      companyRole: access.companyRole,
      canEdit: access.canEdit,
      canAdmin: access.canAdmin,
      areaScopeNodeIds: access.areaScopeNodeIds,
      companyId: access.companyId,
      companyName: company?.name ?? null,
      canUpload: access.isMasterView,
      canAssign: access.isMasterView,
      canExport: !access.isMasterView,
    },
    session: access.session,
    nodes,
    valueStreams,
    companies,
    assignments,
  });
});

app.patch("/api/processes", async (req, res) => {
  const access = await getAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized" });
  if (!access.canEdit) return res.status(403).json({ error: "Read-only" });

  const id = String(req.body?.id ?? "");
  if (!id) return res.status(400).json({ error: "id required" });

  const node = await prisma.processNode.findUnique({ where: { id } });
  if (!node || node.companyId !== access.companyId) {
    return res.status(403).json({ error: "Wrong workspace" });
  }

  if (access.areaScopeNodeIds) {
    const ok = await isNodeInAreaScope(access.companyId!, id, access.areaScopeNodeIds);
    if (!ok) return res.status(403).json({ error: "Outside your area scope" });
  }

  const data: Record<string, unknown> = {};
  if (typeof req.body.name === "string") data.name = req.body.name.trim();
  if (typeof req.body.description === "string") data.description = req.body.description;
  if (typeof req.body.isHidden === "boolean") {
    if (!access.canAdmin) return res.status(403).json({ error: "Only admins can hide" });
    data.isHidden = req.body.isHidden;
  }
  if ("valueStreamId" in (req.body ?? {})) {
    data.valueStreamId = req.body.valueStreamId ? String(req.body.valueStreamId) : null;
  }

  const updated = await prisma.processNode.update({ where: { id }, data });
  res.json({ node: updated });
});

app.post("/api/assign", async (req, res) => {
  const access = await getAccess(req);
  if (!access?.isAetriaOperator) return res.status(403).json({ error: "Forbidden" });

  const companyId = String(req.body?.companyId ?? "");
  const masterNodeId = String(req.body?.masterNodeId ?? "");
  if (!companyId || !masterNodeId) {
    return res.status(400).json({ error: "companyId and masterNodeId required" });
  }

  const result = await assignMasterBranchToCompany({
    companyId,
    masterNodeId,
    assignedById: access.session.id,
  });
  res.json({ ok: true, ...result });
});

app.post("/api/processes/upload", upload.single("file"), async (req, res) => {
  const access = await getAccess(req);
  if (!access?.isMasterView) {
    return res.status(403).json({ error: "Upload only on AS master" });
  }
  if (!req.file) return res.status(400).json({ error: "file required" });

  const name = req.file.originalname.toLowerCase();
  let rows: FlatUploadRow[] = [];
  try {
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const parsed = Papa.parse<Record<string, string>>(req.file.buffer.toString("utf8"), {
        header: true,
        skipEmptyLines: true,
      });
      rows = parsed.data
        .map((raw) => {
          const norm = Object.fromEntries(
            Object.entries(raw).map(([k, v]) => [
              k.trim().toLowerCase().replace(/[\s_-]+/g, ""),
              String(v ?? "").trim(),
            ])
          );
          const code = norm.code || norm.processcode || "";
          const pname = norm.name || norm.processname || "";
          if (!code || !pname) return null;
          return {
            code,
            name: pname,
            description: norm.description || undefined,
            parentCode: norm.parentcode || norm.parent || undefined,
            valueStreamCode: norm.valuestream || norm.valuestreamcode || norm.vs || undefined,
          };
        })
        .filter((r): r is FlatUploadRow => !!r);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer as unknown as ExcelJS.Buffer);
      const sheet = wb.worksheets[0];
      if (!sheet) throw new Error("No sheet");
      const headers: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
        headers[col] = String(cell.value ?? "");
      });
      sheet.eachRow((row, n) => {
        if (n === 1) return;
        const raw: Record<string, string> = {};
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          if (headers[col]) raw[headers[col]] = String(cell.value ?? "");
        });
        const entries = Object.entries(raw).map(([k, v]) => [
          k.trim().toLowerCase().replace(/[\s_-]+/g, ""),
          v.trim(),
        ]);
        const get = (...keys: string[]) => {
          for (const [k, v] of entries) if (keys.includes(k) && v) return v;
          return "";
        };
        const code = get("code", "processcode");
        const pname = get("name", "processname");
        if (!code || !pname) return;
        rows.push({
          code,
          name: pname,
          description: get("description") || undefined,
          parentCode: get("parentcode", "parent") || undefined,
          valueStreamCode: get("valuestream", "vs") || undefined,
        });
      });
    } else {
      return res.status(400).json({ error: "Use .csv or .xlsx" });
    }
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "Parse failed" });
  }

  const result = await bulkUpsertMasterProcesses(rows);
  res.json({ ok: true, ...result });
});

app.get("/api/export", async (req, res) => {
  const access = await getAccess(req);
  if (!access) return res.status(401).json({ error: "Unauthorized" });

  const companyId = String(req.query.companyId || access.companyId || "");
  if (!companyId) return res.status(400).json({ error: "companyId required" });
  if (!access.isAetriaOperator && companyId !== access.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return res.status(404).json({ error: "Not found" });

  const buffer = await exportCompanyByValueStream(companyId);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${company.slug}-processes-by-value-stream-STUB.xlsx"`
  );
  res.setHeader("X-Export-Stub", "true");
  res.send(buffer);
});

app.get("/", (_req, res) => res.redirect("/login.html"));
app.get("/login", (_req, res) => res.redirect("/login.html"));
app.get("/app", (_req, res) => res.redirect("/app.html"));

app.listen(PORT, () => {
  console.log(`Aetria Process Mapping (HTML/CSS/JS) → http://localhost:${PORT}`);
  console.log(`Login: http://localhost:${PORT}/login.html`);
});
