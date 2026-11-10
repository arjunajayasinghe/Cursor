"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type EmailOutboxItem,
  type ExceptionItem,
  type NotificationEvent,
  type NotificationRule,
  type SlaRule,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";

export default function AutomationSettingsPage() {
  const { canView, canEdit, role, refresh } = useAuth();
  const editable = canEdit("automation");
  const [sla, setSla] = useState<SlaRule[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [outbox, setOutbox] = useState<EmailOutboxItem[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"sla" | "rules" | "alerts" | "outbox" | "exceptions">("sla");

  const load = useCallback(async () => {
    if (!canView("automation")) return;
    try {
      setError(null);
      const [s, r, e, o, x] = await Promise.all([
        api.automationSlaRules(),
        api.automationNotificationRules(),
        api.automationEvents("open"),
        api.automationOutbox(),
        api.automationExceptions("open"),
      ]);
      setSla(s);
      setRules(r);
      setEvents(e);
      setOutbox(o);
      setExceptions(x);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load, role]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!canView("automation")) {
    return (
      <div className="rounded-panel border border-red-soft bg-red-soft p-6 text-sm text-red-ink">
        SLA and notification settings are restricted. Switch to Administrator or a role with automation access.
      </div>
    );
  }

  async function runEvaluate() {
    setBusy(true);
    try {
      const result = await api.automationEvaluate();
      setToast(
        `Evaluated ${result.detected} triggers · ${result.created} new · ${result.emailsQueued} email stubs · ${result.exceptionsOpened} exceptions`,
      );
      await load();
      await refresh();
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
            Administration
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.85px]">SLA & notifications</h1>
          <p className="mt-2 max-w-3xl text-[13px] text-sub">
            Configurable 48h quotation / evaluation / payment targets and FCL/LCL clearance masters. Spec §12
            triggers write deduplicated in-app alerts and a stubbed email outbox.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-[5px] border border-[#dae6f2] bg-[#edf3fa] px-2 py-1 text-[11px] font-semibold text-[#365470]">
            Signed in as {role}
          </span>
          <Button variant="primary" disabled={busy} onClick={runEvaluate}>
            {busy ? "Evaluating…" : "Run evaluation"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["sla", "SLA targets"],
            ["rules", "Notification rules"],
            ["alerts", `Open alerts (${events.length})`],
            ["exceptions", `Exceptions (${exceptions.length})`],
            ["outbox", `Email outbox (${outbox.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "rounded-[5px] border border-[#075bb3] bg-[#075bb3] px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-[5px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-[#365470]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sla" ? (
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] px-4 py-3.5">
            <h2 className="text-[17px] font-semibold">SLA / KPI targets</h2>
            <p className="text-[11px] text-muted">Masters — not hardcoded in the engine</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-[#f6f8fb] text-[#52657b]">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Rule</th>
                  <th className="px-3.5 py-2.5 font-bold">Module</th>
                  <th className="px-3.5 py-2.5 font-bold">Load</th>
                  <th className="px-3.5 py-2.5 font-bold">Target</th>
                  <th className="px-3.5 py-2.5 font-bold">Unit</th>
                  <th className="px-3.5 py-2.5 font-bold">Active</th>
                  <th className="px-3.5 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {sla.map((row) => (
                  <tr key={row.id} className="border-t border-[#e8eef5]">
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-[11px] text-sub">{row.description}</div>
                    </td>
                    <td className="px-3.5 py-2.5">{row.moduleKey}</td>
                    <td className="px-3.5 py-2.5">{row.loadType || "—"}</td>
                    <td className="px-3.5 py-2.5">
                      <input
                        type="number"
                        className="w-20 rounded-[5px] border border-[#cdd8e4] px-2 py-1"
                        disabled={!editable}
                        value={row.targetValue}
                        onChange={(e) =>
                          setSla((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, targetValue: Number(e.target.value) } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <select
                        className="rounded-[5px] border border-[#cdd8e4] px-2 py-1"
                        disabled={!editable}
                        value={row.unit}
                        onChange={(e) =>
                          setSla((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, unit: e.target.value } : r)),
                          )
                        }
                      >
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={row.active}
                        onChange={(e) =>
                          setSla((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, active: e.target.checked } : r)),
                          )
                        }
                      />
                    </td>
                    <td className="px-3.5 py-2.5">
                      {editable ? (
                        <Button
                          onClick={async () => {
                            try {
                              const saved = await api.updateSlaRule(row.key, {
                                targetValue: row.targetValue,
                                unit: row.unit,
                                active: row.active,
                              });
                              setSla((prev) => prev.map((r) => (r.id === row.id ? saved : r)));
                              setToast(`Saved ${saved.name}`);
                            } catch (err) {
                              setToast((err as Error).message);
                            }
                          }}
                        >
                          Save
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "rules" ? (
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] px-4 py-3.5">
            <h2 className="text-[17px] font-semibold">Notification / escalation rules</h2>
            <p className="text-[11px] text-muted">Functional-spec §12 trigger matrix</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-[#f6f8fb] text-[#52657b]">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Trigger</th>
                  <th className="px-3.5 py-2.5 font-bold">Action</th>
                  <th className="px-3.5 py-2.5 font-bold">Recipients</th>
                  <th className="px-3.5 py-2.5 font-bold">Dedupe h</th>
                  <th className="px-3.5 py-2.5 font-bold">Channels</th>
                  <th className="px-3.5 py-2.5 font-bold">On</th>
                  <th className="px-3.5 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {rules.map((row) => (
                  <tr key={row.id} className="border-t border-[#e8eef5]">
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-[11px] text-sub">{row.triggerKey}</div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <StatusBadge status={row.action} />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <input
                        className="min-w-[160px] rounded-[5px] border border-[#cdd8e4] px-2 py-1"
                        disabled={!editable}
                        value={row.recipientRoles}
                        onChange={(e) =>
                          setRules((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, recipientRoles: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <input
                        type="number"
                        className="w-16 rounded-[5px] border border-[#cdd8e4] px-2 py-1"
                        disabled={!editable}
                        value={row.dedupeHours}
                        onChange={(e) =>
                          setRules((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, dedupeHours: Number(e.target.value) } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <input
                        className="w-28 rounded-[5px] border border-[#cdd8e4] px-2 py-1"
                        disabled={!editable}
                        value={row.channels}
                        onChange={(e) =>
                          setRules((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, channels: e.target.value } : r)),
                          )
                        }
                      />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={row.active}
                        onChange={(e) =>
                          setRules((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, active: e.target.checked } : r)),
                          )
                        }
                      />
                    </td>
                    <td className="px-3.5 py-2.5">
                      {editable ? (
                        <Button
                          onClick={async () => {
                            try {
                              const saved = await api.updateNotificationRule(row.triggerKey, {
                                recipientRoles: row.recipientRoles,
                                dedupeHours: row.dedupeHours,
                                channels: row.channels,
                                active: row.active,
                              });
                              setRules((prev) => prev.map((r) => (r.id === row.id ? saved : r)));
                              setToast(`Saved ${saved.name}`);
                            } catch (err) {
                              setToast((err as Error).message);
                            }
                          }}
                        >
                          Save
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "alerts" ? (
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] px-4 py-3.5">
            <h2 className="text-[17px] font-semibold">Open notification events</h2>
            <p className="text-[11px] text-muted">Deduplicated · logged in notification_events</p>
          </div>
          <div className="divide-y divide-[#e8eef5]">
            {events.map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={ev.severity} />
                    <strong className="text-sm">{ev.title}</strong>
                  </div>
                  <p className="mt-1 text-xs text-sub">{ev.message}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {ev.triggerKey} · {ev.recipientRoles} · ×{ev.occurrenceCount}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      await api.automationAck(ev.id);
                      await load();
                    }}
                  >
                    Ack
                  </Button>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      await api.automationResolve(ev.id);
                      await load();
                    }}
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
            {!events.length ? <p className="p-8 text-center text-sub">No open alerts. Run evaluation.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "exceptions" ? (
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] px-4 py-3.5">
            <h2 className="text-[17px] font-semibold">Exception register</h2>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-[#f6f8fb] text-[#52657b]">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Title</th>
                  <th className="px-3.5 py-2.5 font-bold">Module</th>
                  <th className="px-3.5 py-2.5 font-bold">Record</th>
                  <th className="px-3.5 py-2.5 font-bold">Owner</th>
                  <th className="px-3.5 py-2.5 font-bold">Severity</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((x) => (
                  <tr key={x.id} className="border-t border-[#e8eef5]">
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold">{x.title}</div>
                      <div className="text-[11px] text-sub">{x.detail}</div>
                    </td>
                    <td className="px-3.5 py-2.5">{x.moduleKey}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-[#075bb3]">{x.recordId}</td>
                    <td className="px-3.5 py-2.5">{x.ownerRole || "—"}</td>
                    <td className="px-3.5 py-2.5">
                      <StatusBadge status={x.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!exceptions.length ? <p className="p-8 text-center text-sub">No open exceptions.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "outbox" ? (
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] px-4 py-3.5">
            <h2 className="text-[17px] font-semibold">Email outbox (stub)</h2>
            <p className="text-[11px] text-muted">Messages marked stubbed — SMTP not connected</p>
          </div>
          <div className="divide-y divide-[#e8eef5]">
            {outbox.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={m.status} />
                  <strong className="text-sm">{m.subject}</strong>
                </div>
                <p className="mt-1 text-[11px] text-muted">To roles: {m.toRoles}</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-[#f6f8fb] p-2 text-[11px] text-sub">
                  {m.body}
                </pre>
              </div>
            ))}
            {!outbox.length ? <p className="p-8 text-center text-sub">Outbox empty.</p> : null}
          </div>
        </section>
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 right-5 z-50 max-w-[90vw] rounded-md bg-[#183954] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
