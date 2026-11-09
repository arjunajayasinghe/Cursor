"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type PermissionsRole, type PermissionsRoleDetail, type RecordAssignment } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";

const LEVELS = ["No access", "View only", "Create and edit"];

export default function RoleAdminPage() {
  const { canView, canEdit, role, refresh } = useAuth();
  const [roles, setRoles] = useState<PermissionsRole[]>([]);
  const [matrixRole, setMatrixRole] = useState("Procurement");
  const [detail, setDetail] = useState<PermissionsRoleDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [assignments, setAssignments] = useState<RecordAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editable = canEdit("roles");

  useEffect(() => {
    if (!canView("roles")) return;
    api
      .permissionsRoles()
      .then((list) => {
        setRoles(list);
        const initial = list.find((r) => r.name === "Procurement")?.name || list.find((r) => r.name !== "Administrator")?.name;
        if (initial) setMatrixRole(initial);
      })
      .catch((e) => setError(e.message));
    api
      .permissionsAssignments()
      .then(setAssignments)
      .catch(() => setAssignments([]));
  }, [canView, role]);

  useEffect(() => {
    if (!matrixRole || !canView("roles")) return;
    api
      .permissionsRole(matrixRole)
      .then((d) => {
        setDetail(d);
        setDraft(Object.fromEntries(d.modules.map((m) => [m.key, m.level])));
      })
      .catch((e) => setError(e.message));
  }, [matrixRole, canView, role]);

  const roleOptions = useMemo(() => roles.filter((r) => r.name !== "Administrator"), [roles]);

  if (!canView("roles")) {
    return (
      <div className="rounded-panel border border-red-soft bg-red-soft p-6 text-sm text-red-ink">
        Role administration is restricted to Administrator (and roles granted access).
      </div>
    );
  }

  async function save() {
    if (!editable || !detail) return;
    setSaving(true);
    try {
      const saved = await api.savePermissionsRole(detail.name, draft);
      setDetail(saved);
      setToast(`Saved permissions for ${saved.name}`);
      await refresh();
      const list = await api.permissionsRoles();
      setRoles(list);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
            Administration
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.85px]">Role administration</h1>
          <p className="mt-2 max-w-3xl text-[13px] text-sub">
            Per-module no access / view / create-edit matrix. Seeded from the proposed Alumex authorization table.
            API enforces these levels via the demo role selector.
          </p>
        </div>
        <span className="rounded-[5px] border border-[#dae6f2] bg-[#edf3fa] px-2 py-1 text-[11px] font-semibold text-[#365470]">
          Signed in as {role}
        </span>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <div className="mb-4 rounded-md border border-[#d7e7fb] bg-[#eef6ff] p-3 text-xs text-[#244c74]">
        Administrator always has full access. External <strong>Supplier</strong> and <strong>Clearing Agent</strong>{" "}
        roles are assigned-only — they only receive explicitly linked records (demo assignments seeded).
      </div>

      <section className="rounded-panel border border-line bg-white shadow-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <label className="text-xs font-semibold text-[#465d74]" htmlFor="matrix-role">
            Role
          </label>
          <select
            id="matrix-role"
            className="min-h-[35px] rounded-[5px] border border-[#cdd8e4] bg-white px-2 text-sm"
            value={matrixRole}
            onChange={(e) => setMatrixRole(e.target.value)}
          >
            {roleOptions.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
                {r.assignedOnly ? " (assigned only)" : ""}
              </option>
            ))}
          </select>
          <span className="spacer flex-1" />
          {editable ? (
            <Button variant="primary" disabled={saving || !detail} onClick={save}>
              Save permissions
            </Button>
          ) : (
            <span className="text-xs text-muted">View only</span>
          )}
        </div>

        {detail ? (
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-[#f6f8fb] text-[#52657b]">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Module</th>
                  <th className="px-3.5 py-2.5 font-bold">Process owner</th>
                  <th className="px-3.5 py-2.5 font-bold">Access</th>
                </tr>
              </thead>
              <tbody>
                {detail.modules
                  .filter((m) => m.key !== "roles")
                  .map((m) => (
                    <tr key={m.key} className="border-t border-[#e8eef5]">
                      <td className="px-3.5 py-2.5 font-semibold">{m.label}</td>
                      <td className="px-3.5 py-2.5 text-sub">{m.owner}</td>
                      <td className="px-3.5 py-2.5">
                        <select
                          aria-label={`${m.label} access`}
                          className="min-h-[32px] rounded-[5px] border border-[#cdd8e4] bg-white px-2"
                          disabled={!editable}
                          value={draft[m.key] ?? 0}
                          onChange={(e) => setDraft((d) => ({ ...d, [m.key]: Number(e.target.value) }))}
                        >
                          {LEVELS.map((label, i) => (
                            <option key={label} value={i}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="border-t border-line px-4 py-3 text-[11px] text-muted">{detail.description}</div>
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-panel border border-line bg-white shadow-panel">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[17px] font-semibold">Record assignments (external roles)</h2>
          <p className="text-[11px] text-muted">
            Stub hooks for supplier / clearing-agent assigned-only access. Enforced on list and get in the API.
          </p>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                <th className="px-3.5 py-2.5 font-bold">Role</th>
                <th className="px-3.5 py-2.5 font-bold">Module</th>
                <th className="px-3.5 py-2.5 font-bold">Record</th>
                <th className="px-3.5 py-2.5 font-bold">Party</th>
                <th className="px-3.5 py-2.5 font-bold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-t border-[#e8eef5]">
                  <td className="px-3.5 py-2.5">
                    <StatusBadge status={a.role.name} />
                  </td>
                  <td className="px-3.5 py-2.5">{a.moduleKey}</td>
                  <td className="px-3.5 py-2.5 font-semibold text-[#075bb3]">{a.recordId}</td>
                  <td className="px-3.5 py-2.5">{a.partyLabel || "—"}</td>
                  <td className="px-3.5 py-2.5 text-sub">{a.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!assignments.length ? (
            <p className="p-6 text-center text-sub">No record assignments seeded.</p>
          ) : null}
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-4 right-5 z-50 max-w-[90vw] rounded-md bg-[#183954] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
