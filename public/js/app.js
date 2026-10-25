(() => {
  let state = {
    access: null,
    session: null,
    nodes: [],
    valueStreams: [],
    companies: [],
    assignments: [],
    selectedId: null,
    search: "",
  };

  const $ = (id) => document.getElementById(id);

  function showBanner(text, isError = false) {
    const el = $("banner");
    el.hidden = !text;
    el.textContent = text || "";
    el.classList.toggle("error", !!isError);
  }

  function buildTree(nodes) {
    const map = new Map();
    nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
    const roots = [];
    nodes.forEach((n) => {
      const node = map.get(n.id);
      if (n.parentId && map.has(n.parentId)) map.get(n.parentId).children.push(node);
      else roots.push(node);
    });
    const sortRec = (list) => {
      list.sort((a, b) => a.code.localeCompare(b.code));
      list.forEach((c) => sortRec(c.children));
    };
    sortRec(roots);
    return roots;
  }

  function filterTree(nodes, q) {
    if (!q.trim()) return nodes;
    const needle = q.trim().toLowerCase();
    const walk = (list) => {
      const out = [];
      for (const n of list) {
        const kids = walk(n.children || []);
        const match =
          n.code.toLowerCase().includes(needle) ||
          n.name.toLowerCase().includes(needle) ||
          (n.description || "").toLowerCase().includes(needle);
        if (match || kids.length) out.push({ ...n, children: kids });
      }
      return out;
    };
    return walk(nodes);
  }

  function editableSet() {
    const roots = state.access?.areaScopeNodeIds;
    if (!roots) return null;
    const byParent = new Map();
    state.nodes.forEach((n) => {
      if (!n.parentId) return;
      const list = byParent.get(n.parentId) || [];
      list.push(n.id);
      byParent.set(n.parentId, list);
    });
    const set = new Set();
    const stack = [...roots];
    while (stack.length) {
      const id = stack.pop();
      if (set.has(id)) continue;
      set.add(id);
      (byParent.get(id) || []).forEach((c) => stack.push(c));
    }
    return set;
  }

  function renderTree() {
    const tree = filterTree(buildTree(state.nodes), state.search);
    const editable = editableSet();
    const root = $("tree");
    root.innerHTML = "";
    if (!tree.length) {
      root.innerHTML = `<p class="muted" style="padding:1.5rem;text-align:center">No processes match.</p>`;
      return;
    }

    const render = (list, depth) => {
      list.forEach((n) => {
        const row = document.createElement("div");
        row.className = "tree-item" + (state.selectedId === n.id ? " active" : "");
        row.style.paddingLeft = 8 + depth * 14 + "px";
        const inScope = !editable || editable.has(n.id);
        row.innerHTML = `
          <div>
            <span class="code">${escapeHtml(n.code)}</span>
            <span class="name">${escapeHtml(n.name)}</span>
            ${n.isHidden ? '<span class="badge" style="opacity:.7">hidden</span>' : ""}
            ${editable && inScope ? '<span class="badge">editable</span>' : ""}
          </div>`;
        row.addEventListener("click", () => {
          state.selectedId = n.id;
          showBanner("");
          renderTree();
          renderDetails();
        });
        root.appendChild(row);
        if (n.children?.length) render(n.children, depth + 1);
      });
    };
    render(tree, 0);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function selectedNode() {
    return state.nodes.find((n) => n.id === state.selectedId) || null;
  }

  function canEditSelected() {
    const n = selectedNode();
    if (!n || !state.access?.canEdit) return false;
    const editable = editableSet();
    return !editable || editable.has(n.id);
  }

  function renderDetails() {
    const box = $("details");
    const n = selectedNode();
    $("assign-btn").disabled = !(n && state.access?.canAssign);
    if (!n) {
      box.innerHTML = `<p class="muted">Select a process in the tree.</p>`;
      return;
    }
    const vsOptions = state.valueStreams
      .map(
        (v) =>
          `<option value="${v.id}" ${n.valueStreamId === v.id ? "selected" : ""}>${escapeHtml(
            v.code
          )} — ${escapeHtml(v.name)}</option>`
      )
      .join("");
    const editable = canEditSelected();
    box.innerHTML = `
      <div class="muted" style="font-size:0.75rem;text-transform:uppercase">Code</div>
      <div style="font-family:ui-monospace,monospace;margin-bottom:0.75rem">${escapeHtml(n.code)}</div>
      <label>Name
        <input id="f-name" type="text" value="${escapeHtml(n.name)}" ${editable ? "" : "disabled"} />
      </label>
      <label>Description
        <textarea id="f-desc" rows="3" ${editable ? "" : "disabled"}>${escapeHtml(
          n.description || ""
        )}</textarea>
      </label>
      <label>Value stream
        <select id="f-vs" ${editable && state.access.canAdmin ? "" : "disabled"}>
          <option value="">Unassigned</option>
          ${vsOptions}
        </select>
      </label>
      ${
        state.access.canAdmin
          ? `<label style="display:flex;gap:0.5rem;align-items:center;margin-top:0.75rem">
              <input id="f-hidden" type="checkbox" ${n.isHidden ? "checked" : ""} />
              Hidden in company map
            </label>`
          : ""
      }
      ${
        state.access.canEdit && !editable
          ? `<p class="muted" style="color:var(--warn);font-size:0.8rem;margin-top:0.75rem">Outside your area scope — view only.</p>`
          : ""
      }
    `;

    const save = async (patch) => {
      showBanner("");
      const res = await fetch("/api/processes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id, ...patch }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showBanner(data.error || "Save failed", true);
        return;
      }
      showBanner("Saved");
      await load();
      state.selectedId = n.id;
      renderTree();
      renderDetails();
    };

    $("f-name")?.addEventListener("blur", (e) => {
      if (e.target.value !== n.name) save({ name: e.target.value });
    });
    $("f-desc")?.addEventListener("blur", (e) => {
      if (e.target.value !== (n.description || "")) save({ description: e.target.value });
    });
    $("f-vs")?.addEventListener("change", (e) => {
      save({ valueStreamId: e.target.value || null });
    });
    $("f-hidden")?.addEventListener("change", (e) => {
      save({ isHidden: e.target.checked });
    });
  }

  function renderShell() {
    const a = state.access;
    $("title").textContent = a.isMasterView
      ? "Aetria Solution — Master library"
      : a.companyName || "Company processes";
    $("subtitle").textContent = a.isMasterView
      ? "Full APQC-style taxonomy. Upload at AS level, then push branches to companies."
      : "Assigned processes only. Area editors can edit scoped branches.";
    $("topbar").textContent = a.isMasterView
      ? "Viewing Aetria Solution master library"
      : `Company workspace: ${a.companyName || "Unknown"}`;
    $("user-meta").innerHTML = `
      <div style="color:var(--sidebar-fg);font-weight:600;margin-bottom:0.25rem">${escapeHtml(
        state.session.name
      )}</div>
      <div>${escapeHtml(state.session.email)}</div>
      <div style="margin-top:0.5rem">${
        a.isMasterView
          ? "Role: Aetria operator · Master"
          : a.isAetriaOperator
            ? `Role: Aetria in ${escapeHtml(a.companyName || "company")}`
            : `Role: ${(a.companyRole || "—").replace("_", " ")}`
      }</div>`;

    const ws = $("workspace");
    ws.innerHTML = "";
    if (a.isAetriaOperator) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Aetria Solution (master)";
      ws.appendChild(opt);
    }
    state.companies.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      ws.appendChild(opt);
    });
    ws.value = a.companyId || "";

    $("upload-panel").hidden = !a.canUpload;
    $("assign-panel").hidden = !a.canAssign;
    $("stub-panel").hidden = !a.canExport;
    $("export-btn").hidden = !a.canExport;
    if (a.canExport && a.companyId) {
      $("export-btn").href = `/api/export?companyId=${encodeURIComponent(a.companyId)}`;
    }

    const ac = $("assign-company");
    ac.innerHTML = state.companies
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");
    $("assignments").innerHTML = state.assignments?.length
      ? `<div style="text-transform:uppercase;font-size:0.7rem;margin-bottom:0.35rem">Recent assignments</div>` +
        state.assignments
          .slice(0, 8)
          .map(
            (x) =>
              `<div>${escapeHtml(x.masterNode.code)} → ${escapeHtml(x.company.name)}</div>`
          )
          .join("")
      : "";
  }

  async function load() {
    const res = await fetch("/api/bootstrap");
    if (res.status === 401) {
      location.href = "/login.html";
      return;
    }
    const data = await res.json();
    state = { ...state, ...data };
    // companies for workspace switcher
    const me = await fetch("/api/me").then((r) => r.json());
    state.companies = me.companies || state.companies || [];
    state.session = me.session || state.session;
    renderShell();
    renderTree();
    renderDetails();
  }

  $("search").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderTree();
  });

  $("workspace").addEventListener("change", async (e) => {
    const companyId = e.target.value || null;
    await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    state.selectedId = null;
    await load();
  });

  $("logout").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login.html";
  });

  $("assign-btn").addEventListener("click", async () => {
    const n = selectedNode();
    if (!n) return;
    const companyId = $("assign-company").value;
    showBanner("");
    const res = await fetch("/api/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, masterNodeId: n.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showBanner(data.error || "Assign failed", true);
      return;
    }
    showBanner(`Assigned ${n.code} (+ subtree) — ${data.copied ?? 0} nodes`);
    await load();
  });

  $("upload").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    showBanner("");
    const res = await fetch("/api/processes/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showBanner(data.error || "Upload failed", true);
      return;
    }
    showBanner(`Upload complete: ${data.created} created, ${data.updated} updated`);
    await load();
  });

  load();
})();
