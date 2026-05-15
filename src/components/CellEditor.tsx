import { useMemo, useRef, useState } from "react";
import type { CellSpec } from "../lib/modelTypes";
import { validateCell, hasAny, type FieldErrors } from "../lib/validation";
import {
  cellsToCsv,
  parseCellsCsv,
  parseCellsJson,
  readFileAsText,
} from "../lib/io";
import { downloadTextFile } from "../lib/csvExport";
import { Modal } from "./Modal";
import { Tooltip } from "./Tooltip";
import { PencilIcon, Square2StackIcon, TrashIcon } from "@heroicons/react/24/outline";

function emptyCell(): Partial<CellSpec> {
  return {
    name: "",
    chemistry: "",
    form_factor: "",
    v_nom: 3.6,
    v_max: 4.2,
    v_min: 2.5,
    capacity_ah: 0,
    i_cont_a: 0,
    r_int_model_ohm: 0,
    mass_g: 0,
    cost_usd: 0,
  };
}

interface CellEditorProps {
  cells: CellSpec[];
  selected: Set<string>;
  onCellsChange: (cells: CellSpec[]) => void;
  onSelectedChange: (sel: Set<string>) => void;
  onResetDefaults: () => void;
}

function uniqueName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  error,
  step,
  placeholder,
  fullWidth,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  type?: "text" | "number";
  error?: string;
  step?: number;
  placeholder?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={`field ${fullWidth ? "full" : ""}`}>
      <label>{label}</label>
      <input
        type={type}
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function CellForm({
  draft,
  setDraft,
  errors,
}: {
  draft: Partial<CellSpec>;
  setDraft: (c: Partial<CellSpec>) => void;
  errors: FieldErrors;
}) {
  const setN = (key: keyof CellSpec) => (v: string) => {
    if (v === "") {
      const next: Partial<CellSpec> = { ...draft };
      delete (next as Record<string, unknown>)[key as string];
      setDraft(next);
    } else {
      setDraft({ ...draft, [key]: parseFloat(v) });
    }
  };
  const setS = (key: keyof CellSpec) => (v: string) => setDraft({ ...draft, [key]: v });

  return (
    <>
      <div className="field-grid">
        <FieldInput
          label="Name *"
          value={draft.name}
          onChange={setS("name")}
          error={errors.name}
        />
        <FieldInput
          label="Chemistry *"
          value={draft.chemistry}
          onChange={setS("chemistry")}
          error={errors.chemistry}
          placeholder="e.g. NCA, LiFePO4"
        />
        <FieldInput
          label="Form factor *"
          value={draft.form_factor}
          onChange={setS("form_factor")}
          error={errors.form_factor}
          placeholder="e.g. 21700 cylindrical"
          fullWidth
        />
      </div>

      <div style={{ height: 10 }} />
      <div className="field-grid three">
        <FieldInput label="V min *" type="number" step={0.01} value={draft.v_min} onChange={setN("v_min")} error={errors.v_min} />
        <FieldInput label="V nom *" type="number" step={0.01} value={draft.v_nom} onChange={setN("v_nom")} error={errors.v_nom} />
        <FieldInput label="V max *" type="number" step={0.01} value={draft.v_max} onChange={setN("v_max")} error={errors.v_max} />
      </div>

      <div style={{ height: 10 }} />
      <div className="field-grid">
        <FieldInput label="Capacity (Ah) *" type="number" step={0.01} value={draft.capacity_ah} onChange={setN("capacity_ah")} error={errors.capacity_ah} />
        <FieldInput label="Continuous current (A) *" type="number" step={0.1} value={draft.i_cont_a} onChange={setN("i_cont_a")} error={errors.i_cont_a} />
        <FieldInput label="Internal resistance (Ω) *" type="number" step={0.0001} value={draft.r_int_model_ohm} onChange={setN("r_int_model_ohm")} error={errors.r_int_model_ohm} />
        <FieldInput label="Mass (g) *" type="number" step={0.1} value={draft.mass_g} onChange={setN("mass_g")} error={errors.mass_g} />
        <FieldInput label="Cost (USD) *" type="number" step={0.1} value={draft.cost_usd} onChange={setN("cost_usd")} error={errors.cost_usd} />
        <FieldInput label="Realized capacity factor" type="number" step={0.01} value={draft.realized_capacity_factor} onChange={setN("realized_capacity_factor")} error={errors.realized_capacity_factor} placeholder="default 1.0" />
      </div>

      <div style={{ height: 10 }} />
      <div className="field-grid">
        <FieldInput label="Cycle life estimate" value={draft.cycle_life_est} onChange={setS("cycle_life_est")} />
        <FieldInput label="Source quality" value={draft.source_quality} onChange={setS("source_quality")} />
      </div>

      <div style={{ height: 10 }} />
      <div className="field full">
        <label>Notes</label>
        <textarea
          rows={3}
          value={draft.notes ?? ""}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>
    </>
  );
}

export function CellEditor({
  cells,
  selected,
  onCellsChange,
  onSelectedChange,
  onResetDefaults,
}: CellEditorProps) {
  const [editing, setEditing] = useState<{ index: number | null; draft: Partial<CellSpec> } | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const names = useMemo(() => new Set(cells.map((c) => c.name)), [cells]);
  const editErrors = editing ? validateCell(editing.draft) : {};
  const canSave = editing != null && !hasAny(editErrors) && (
    editing.index !== null ||
    !names.has((editing.draft.name ?? "").trim())
  );

  const toggle = (n: string) => {
    const next = new Set(selected);
    next.has(n) ? next.delete(n) : next.add(n);
    onSelectedChange(next);
  };

  const onAdd = () => setEditing({ index: null, draft: emptyCell() });

  const onEdit = (i: number) => setEditing({ index: i, draft: { ...cells[i] } });

  const onDuplicate = (i: number) => {
    const src = cells[i];
    const newName = uniqueName(`${src.name} copy`, names);
    setEditing({ index: null, draft: { ...src, name: newName } });
  };

  const onSave = () => {
    if (!editing) return;
    const cell = editing.draft as CellSpec;
    let nextCells: CellSpec[];
    if (editing.index === null) {
      nextCells = [...cells, cell];
      onSelectedChange(new Set([...selected, cell.name]));
    } else {
      const old = cells[editing.index];
      nextCells = cells.map((c, i) => (i === editing.index ? cell : c));
      if (old.name !== cell.name) {
        const sel = new Set(selected);
        if (sel.has(old.name)) {
          sel.delete(old.name);
          sel.add(cell.name);
          onSelectedChange(sel);
        }
      }
    }
    onCellsChange(nextCells);
    setEditing(null);
  };

  const onDelete = (i: number) => setDeletingIndex(i);

  const confirmDelete = () => {
    if (deletingIndex == null) return;
    const target = cells[deletingIndex];
    onCellsChange(cells.filter((_, i) => i !== deletingIndex));
    const sel = new Set(selected);
    sel.delete(target.name);
    onSelectedChange(sel);
    setDeletingIndex(null);
  };

  const onExportCsv = () => downloadTextFile("cells.csv", cellsToCsv(cells), "text/csv;charset=utf-8");

  const onImportClick = () => fileRef.current?.click();

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    const result = file.name.toLowerCase().endsWith(".csv")
      ? parseCellsCsv(text)
      : parseCellsJson(text);

    if (result.imported.length > 0) {
      const existingNames = new Set(cells.map((c) => c.name));
      const renamed = result.imported.map((c) => {
        if (!existingNames.has(c.name)) {
          existingNames.add(c.name);
          return c;
        }
        const n = uniqueName(c.name, existingNames);
        existingNames.add(n);
        return { ...c, name: n };
      });
      onCellsChange([...cells, ...renamed]);
      const sel = new Set(selected);
      for (const c of renamed) sel.add(c.name);
      onSelectedChange(sel);
    }
    setImportErrors(result.errors.length > 0 ? result.errors : null);
    e.target.value = "";
  };

  return (
    <div>
      <div className="entity-actions-bar">
        <button className="btn" onClick={onAdd}>+ Add cell</button>
        <button className="btn" onClick={onImportClick}>Import</button>
        <button className="btn" onClick={onExportCsv}>Export CSV</button>
        <button className="btn" onClick={onResetDefaults} title="Restore built-in cells">Defaults</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          style={{ display: "none" }}
          onChange={onImportFile}
        />
      </div>

      <div className="toggle-actions">
        <button onClick={() => onSelectedChange(new Set(cells.map((c) => c.name)))}>All</button>
        <button onClick={() => onSelectedChange(new Set())}>None</button>
        <span className="muted" style={{ alignSelf: "center", fontSize: 11 }}>
          {selected.size} / {cells.length} selected
        </span>
      </div>

      {importErrors && (
        <div className="import-errors" style={{ marginBottom: 8 }}>
          <strong>Import warnings:</strong>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            {importErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          <div style={{ marginTop: 4 }}>
            <button className="btn" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => setImportErrors(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="entity-list">
        {cells.map((c, i) => {
          const errs = validateCell(c);
          const invalid = hasAny(errs);
          return (
            <div key={`${c.name}-${i}`} className={`entity-row ${invalid ? "invalid" : ""}`}>
              <input
                type="checkbox"
                checked={selected.has(c.name)}
                onChange={() => toggle(c.name)}
                title="Include in run"
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.name || <em>(unnamed)</em>}
                </div>
                <div className="ent-meta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.chemistry} · {c.capacity_ah}Ah · {c.i_cont_a}A · {c.mass_g}g · ${c.cost_usd}
                </div>
                {invalid && (
                  <div className="field-error" style={{ marginTop: 2 }}>
                    {Object.values(errs)[0]}
                  </div>
                )}
              </div>
              <div className="ent-actions">
                <Tooltip text="Edit cell">
                  <button
                    className="icon-btn-lg"
                    onClick={() => onEdit(i)}
                    aria-label="Edit cell"
                  >
                    <PencilIcon className="icon-svg" />
                  </button>
                </Tooltip>
                <Tooltip text="Duplicate cell">
                  <button
                    className="icon-btn-lg"
                    onClick={() => onDuplicate(i)}
                    aria-label="Duplicate cell"
                  >
                    <Square2StackIcon className="icon-svg" />
                  </button>
                </Tooltip>
                <Tooltip text="Delete cell">
                  <button
                    className="icon-btn-lg danger"
                    onClick={() => onDelete(i)}
                    aria-label="Delete cell"
                  >
                    <TrashIcon className="icon-svg" />
                  </button>
                </Tooltip>
              </div>
            </div>
          );
        })}
        {cells.length === 0 && (
          <div className="empty-state">No cells. Click <strong>+ Add cell</strong> or <strong>Defaults</strong>.</div>
        )}
      </div>

      <Modal
        open={editing !== null}
        title={editing?.index === null ? "Add cell" : "Edit cell"}
        onClose={() => setEditing(null)}
        onSubmit={onSave}
        submitDisabled={!canSave}
        submitLabel="Save cell"
        width={720}
      >
        {editing && (
          <CellForm
            draft={editing.draft}
            setDraft={(d) => setEditing({ ...editing, draft: d })}
            errors={editErrors}
          />
        )}
      </Modal>

      <Modal
        open={deletingIndex !== null}
        title="Delete cell?"
        onClose={() => setDeletingIndex(null)}
        onSubmit={confirmDelete}
        submitLabel="Delete"
        destructive
        width={400}
      >
        {deletingIndex !== null && (
          <div>
            Delete <strong>{cells[deletingIndex]?.name}</strong>? This removes the cell from the
            project list but you can restore built-ins with <strong>Defaults</strong>.
          </div>
        )}
      </Modal>
    </div>
  );
}
