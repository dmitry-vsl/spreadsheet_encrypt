const SPREADSHEET_EXTENSIONS = [".csv", ".xlsx", ".xls", ".ods", ".tsv"];
const SPREADSHEET_MIMES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/tab-separated-values",
];

// State: { fileName -> { sheetName -> { headers: string[], rows: string[][], selected: Set<string> } } }
const state = {};

// ── Build DOM ─────────────────────────────────────────────────────

function buildDOM(dropZone) {
  // Modal
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "ss-modal-overlay";

  const modalContent = document.createElement("div");
  modalContent.className = "ss-modal-content";

  const modalClose = document.createElement("button");
  modalClose.className = "ss-modal-close";
  modalClose.innerHTML = "&times;";
  modalContent.appendChild(modalClose);

  const modalTitle = document.createElement("h2");
  modalTitle.className = "ss-modal-title";
  modalTitle.textContent = "Select columns to encrypt";
  modalContent.appendChild(modalTitle);

  const resultsEl = document.createElement("div");
  modalContent.appendChild(resultsEl);

  const applyBtn = document.createElement("button");
  applyBtn.className = "ss-apply-btn";
  applyBtn.textContent = "Get Selected Columns";
  modalContent.appendChild(applyBtn);

  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  return { dropZone, modalOverlay, modalClose, resultsEl, applyBtn };
}

// ── Mount ─────────────────────────────────────────────────────────

export function mount(dropZone) {
  const els = buildDOM(dropZone);

  // ── Modal controls ──────────────────────────────────────────────

  function openModal() {
    els.modalOverlay.classList.add("open");
  }

  function closeModal() {
    els.modalOverlay.classList.remove("open");
  }

  els.modalClose.addEventListener("click", closeModal);
  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.dropZone.classList.add("ss-drag-over");
  });

  document.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      els.dropZone.classList.remove("ss-drag-over");
    }
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropZone.classList.remove("ss-drag-over");
    handleSpreadsheets(e.dataTransfer.files);
  });

  document.addEventListener("paste", (e) => {
    const files = e.clipboardData && e.clipboardData.files;
    if (files && files.length) {
      e.preventDefault();
      handleSpreadsheets(files);
    }
  });

  // ── File handling ───────────────────────────────────────────────

  function isSpreadsheet(file) {
    const name = file.name.toLowerCase();
    if (SPREADSHEET_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
    if (SPREADSHEET_MIMES.includes(file.type)) return true;
    return false;
  }

  async function handleSpreadsheets(fileList) {
    const files = Array.from(fileList).filter(isSpreadsheet);
    if (!files.length) return;

    const parsed = await Promise.all(files.map(parseSpreadsheet));
    parsed.forEach(({ name, sheets }) => {
      state[name] = {};
      sheets.forEach(({ sheetName, headers, previewRows }) => {
        state[name][sheetName] = {
          headers,
          previewRows,
          selected: new Set(),
        };
      });
    });
    render();
    openModal();
  }

  function parseSpreadsheet(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          const sheets = workbook.SheetNames.map((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const headers = rows.length
              ? rows[0].map((h) => (h != null ? String(h) : ""))
              : [];
            const previewRows = rows.slice(1, 5).map((row) =>
              headers.map((_, i) => (row[i] != null ? String(row[i]) : ""))
            );
            return { sheetName, headers, previewRows };
          });

          resolve({ name: file.name, sheets });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  // ── Rendering ───────────────────────────────────────────────────

  function render() {
    els.resultsEl.innerHTML = "";
    const fileNames = Object.keys(state);
    if (!fileNames.length) {
      els.applyBtn.style.display = "none";
      return;
    }

    fileNames.forEach((fileName) => {
      const card = document.createElement("div");
      card.className = "ss-file-card";

      const sheetEntries = Object.entries(state[fileName]);
      const sheetCount = sheetEntries.length;

      const header = document.createElement("div");
      header.className = "ss-file-header";
      header.innerHTML =
        escapeHtml(fileName) +
        ` <span class="ss-badge">${sheetCount} sheet${sheetCount !== 1 ? "s" : ""}</span>`;
      card.appendChild(header);

      sheetEntries.forEach(([sheetName, { headers, previewRows, selected }]) => {
        const section = document.createElement("div");
        section.className = "ss-sheet-section";

        if (sheetCount > 1) {
          const nameEl = document.createElement("div");
          nameEl.className = "ss-sheet-name";
          nameEl.textContent = sheetName;
          section.appendChild(nameEl);
        }

        if (!headers.length) {
          const empty = document.createElement("div");
          empty.className = "ss-empty-sheet";
          empty.textContent = "No headers found in this sheet.";
          section.appendChild(empty);
          card.appendChild(section);
          return;
        }

        const grid = document.createElement("div");
        grid.className = "ss-columns-grid";

        headers.forEach((col, i) => {
          const displayName = col || `(Column ${i + 1})`;
          const id = `chk-${cssId(fileName)}-${cssId(sheetName)}-${i}`;

          const item = document.createElement("div");
          item.className = "ss-column-item";

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.id = id;
          cb.checked = selected.has(col);
          cb.addEventListener("change", () => {
            if (cb.checked) selected.add(col);
            else selected.delete(col);
          });

          const label = document.createElement("label");
          label.htmlFor = id;
          label.textContent = displayName;
          label.title = displayName;

          item.appendChild(cb);
          item.appendChild(label);
          grid.appendChild(item);
        });

        section.appendChild(grid);

        // Preview table (header + up to 4 data rows = 5 rows total)
        if (headers.length && previewRows.length) {
          const tableWrap = document.createElement("div");
          tableWrap.className = "ss-preview-wrap";

          const table = document.createElement("table");
          table.className = "ss-preview-table";

          const thead = document.createElement("thead");
          const headTr = document.createElement("tr");
          headers.forEach((col, i) => {
            const th = document.createElement("th");
            th.textContent = col || `(Column ${i + 1})`;
            headTr.appendChild(th);
          });
          thead.appendChild(headTr);
          table.appendChild(thead);

          const tbody = document.createElement("tbody");
          previewRows.forEach((row) => {
            const tr = document.createElement("tr");
            row.forEach((cell) => {
              const td = document.createElement("td");
              td.textContent = cell;
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);

          tableWrap.appendChild(table);
          section.appendChild(tableWrap);
        }

        const actions = document.createElement("div");
        actions.className = "ss-sheet-actions";

        const selAll = document.createElement("button");
        selAll.className = "ss-btn-sm";
        selAll.textContent = "Select all";
        selAll.addEventListener("click", () => {
          headers.forEach((h) => selected.add(h));
          render();
        });

        const selNone = document.createElement("button");
        selNone.className = "ss-btn-sm";
        selNone.textContent = "Select none";
        selNone.addEventListener("click", () => {
          selected.clear();
          render();
        });

        actions.appendChild(selAll);
        actions.appendChild(selNone);
        section.appendChild(actions);

        card.appendChild(section);
      });

      els.resultsEl.appendChild(card);
    });

    els.applyBtn.style.display = "block";
  }

  // ── Apply button ────────────────────────────────────────────────

  els.applyBtn.addEventListener("click", () => {
    const result = {};
    for (const [fileName, sheets] of Object.entries(state)) {
      result[fileName] = {};
      for (const [sheetName, { selected }] of Object.entries(sheets)) {
        if (selected.size) {
          result[fileName][sheetName] = Array.from(selected);
        }
      }
      if (!Object.keys(result[fileName]).length) delete result[fileName];
    }
    console.log("Columns selected for encryption:", result);
    alert("Selection logged to console.\n\n" + JSON.stringify(result, null, 2));
  });

  return { handleSpreadsheets };
}

// ── Helpers ─────────────────────────────────────────────────────

function escapeHtml(str) {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

function cssId(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}
