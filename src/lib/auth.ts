import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { CompanyRole } from "@prisma/client";

const COOKIE = "aetria_session";
const secret = () =>
  new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "dev-secret-change-me-in-production-aetria-mvp"
  );

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isAetriaOperator: boolean;
};

export type SessionPayload = SessionUser & {
  /** Active company workspace (null = AS master for operators) */
  activeCompanyId: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser, activeCompanyId: string | null = null) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    isAetriaOperator: user.isAetriaOperator,
    activeCompanyId,
  } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function setActiveCompany(companyId: string | null) {
  const session = await requireSession();
  await createSession(session, companyId);
}

export async function loginWithPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    isAetriaOperator: user.isAetriaOperator,
  };

  // Default workspace: AS master for operators; first company for others
  let activeCompanyId: string | null = null;
  if (!user.isAetriaOperator) {
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    activeCompanyId = membership?.companyId ?? null;
  }

  await createSession(sessionUser, activeCompanyId);
  return sessionUser;
}

export type EffectiveAccess = {
  session: SessionPayload;
  companyId: string | null;
  isMasterView: boolean;
  isAetriaOperator: boolean;
  companyRole: CompanyRole | null;
  membershipId: string | null;
  canEdit: boolean;
  canAdmin: boolean;
  /** Process node IDs (and implied descendants) an area editor may edit; null = unrestricted for role */
  areaScopeNodeIds: string[] | null;
};

export async function getEffectiveAccess(): Promise<EffectiveAccess | null> {
  const session = await getSession();
  if (!session) return null;

  const companyId = session.activeCompanyId;
  const isMasterView = companyId === null;

  if (isMasterView) {
    if (!session.isAetriaOperator) return null;
    return {
      session,
      companyId: null,
      isMasterView: true,
      isAetriaOperator: true,
      companyRole: null,
      membershipId: null,
      canEdit: true,
      canAdmin: true,
      areaScopeNodeIds: null,
    };
  }

  // Company workspace: Aetria operators always have admin-level access
  if (session.isAetriaOperator) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return null;
    return {
      session,
      companyId,
      isMasterView: false,
      isAetriaOperator: true,
      companyRole: "ADMIN",
      membershipId: null,
      canEdit: true,
      canAdmin: true,
      areaScopeNodeIds: null,
    };
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_companyId: { userId: session.id, companyId: companyId! },
    },
    include: { areaScopes: true },
  });
  if (!membership) return null;

  const areaScopeNodeIds =
    membership.role === "AREA_EDITOR"
      ? membership.areaScopes.map((s) => s.processNodeId)
      : null;

  return {
    session,
    companyId,
    isMasterView: false,
    isAetriaOperator: false,
    companyRole: membership.role,
    membershipId: membership.id,
    canEdit: membership.role === "ADMIN" || membership.role === "AREA_EDITOR",
    canAdmin: membership.role === "ADMIN",
    areaScopeNodeIds,
  };
}
