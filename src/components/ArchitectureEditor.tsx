import { useMemo, useState } from "react";
import type { ArchitectureSpec, ConverterType } from "../lib/modelTypes";
import {
  validateArchitecture,
  hasAny,
  CONVERTER_TYPES,
  type FieldErrors,
} from "../lib/validation";
import { Modal } from "./Modal";
import { Tooltip } from "./Tooltip";
import { PencilIcon, Square2StackIcon, TrashIcon } from "@heroicons/react/24/outline";

const CONVERTER_LABEL: Record<ConverterType, string> = {
  direct: "Direct (no converter)",
  buck: "Buck",
  boost: "Boost",
  buck_boost: "Buck-boost",
};

function emptyArch(): Partial<ArchitectureSpec> {
  return {
    name: "",
    converter_type: "buck_boost",
    pack_nom_min_v: 20,
    pack_nom_max_v: 60,
    pack_oper_min_v: 20,
    pack_oper_max_v: 60,
    target_bus_v: 48,
    converter_overload_factor: 1.05,
  };
}

function uniqueName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

function ArchForm({
  draft,
  setDraft,
  errors,
  curves,
}: {
  draft: Partial<ArchitectureSpec>;
  setDraft: (a: Partial<ArchitectureSpec>) => void;
  errors: FieldErrors;
  curves: string[];
}) {
  const ct = draft.converter_type ?? "direct";
  const setN = (key: keyof ArchitectureSpec) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === "") {
      const next: Partial<ArchitectureSpec> = { ...draft };
      delete (next as Record<string, unknown>)[key as string];
      setDraft(next);
    } else {
      const n = parseFloat(v);
      setDraft({ ...draft, [key]: Number.isNaN(n) ? undefined : n });
    }
  };

  return (
    <>
      <div className="field-grid">
        <div className="field">
          <label>Name *</label>
          <input
            value={draft.name ?? ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>
        <div className="field">
          <label>Converter type *</label>
          <select
            value={draft.converter_type ?? "direct"}
            onChange={(e) =>
              setDraft({ ...draft, converter_type: e.target.value as ConverterType })
            }
          >
            {CONVERTER_TYPES.map((c) => (
              <option key={c} value={c}>{CONVERTER_LABEL[c]}</option>
            ))}
          </select>
          {errors.converter_type && <span className="field-error">{errors.converter_type}</span>}
        </div>
      </div>

      <div style={{ height: 10 }} />
      <div className="field-grid">
        <div className="field">
          <label>Pack nominal min (V) *</label>
          <input type="number" step={0.5} value={draft.pack_nom_min_v ?? ""} onChange={setN("pack_nom_min_v")} />
          {errors.pack_nom_min_v && <span className="field-error">{errors.pack_nom_min_v}</span>}
        </div>
        <div className="field">
          <label>Pack nominal max (V) *</label>
          <input type="number" step={0.5} value={draft.pack_nom_max_v ?? ""} onChange={setN("pack_nom_max_v")} />
          {errors.pack_nom_max_v && <span className="field-error">{errors.pack_nom_max_v}</span>}
        </div>
        <div className="field">
          <label>Pack operating min (V)</label>
          <input type="number" step={0.5} value={draft.pack_oper_min_v ?? ""} onChange={setN("pack_oper_min_v")} />
          {errors.pack_oper_min_v && <span className="field-error">{errors.pack_oper_min_v}</span>}
        </div>
        <div className="field">
          <label>Pack operating max (V)</label>
          <input type="number" step={0.5} value={draft.pack_oper_max_v ?? ""} onChange={setN("pack_oper_max_v")} />
          {errors.pack_oper_max_v && <span className="field-error">{errors.pack_oper_max_v}</span>}
        </div>
      </div>

      {ct !== "direct" && (
        <>
          <div style={{ height: 10 }} />
          <div className="field-grid">
            <div className="field">
              <label>Target bus voltage (V) *</label>
              <input
                type="number"
                step={0.5}
                value={draft.target_bus_v ?? ""}
                onChange={setN("target_bus_v")}
              />
              {errors.target_bus_v && <span className="field-error">{errors.target_bus_v}</span>}
            </div>
            <div className="field">
              <label>Efficiency curve *</label>
              <select
                value={draft.efficiency_curve ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, efficiency_curve: e.target.value || undefined })
                }
              >
                <option value="">— select curve —</option>
                {curves.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.efficiency_curve && <span className="field-error">{errors.efficiency_curve}</span>}
            </div>
            {ct === "buck" && (
              <div className="field">
                <label>Buck headroom (V)</label>
                <input
                  type="number"
                  step={0.1}
                  value={draft.buck_headroom_v ?? ""}
                  placeholder="default 0"
                  onChange={setN("buck_headroom_v")}
                />
                {errors.buck_headroom_v && <span className="field-error">{errors.buck_headroom_v}</span>}
              </div>
            )}
            <div className="field">
              <label>Converter overload factor</label>
              <input
                type="number"
                step={0.01}
                value={draft.converter_overload_factor ?? ""}
                placeholder="default 1.05"
                onChange={setN("converter_overload_factor")}
              />
              {errors.converter_overload_factor && (
                <span className="field-error">{errors.converter_overload_factor}</span>
              )}
            </div>
          </div>
        </>
      )}

      {ct === "direct" && (
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Direct architectures don't go through a converter. Operating voltage limits define
          the acceptable bus voltage range presented to the load.
        </div>
      )}
    </>
  );
}

interface Props {
  architectures: ArchitectureSpec[];
  selected: Set<string>;
  knownCurves: string[];
  onArchitecturesChange: (a: ArchitectureSpec[]) => void;
  onSelectedChange: (s: Set<string>) => void;
  onResetDefaults: () => void;
}

export function ArchitectureEditor({
  architectures,
  selected,
  knownCurves,
  onArchitecturesChange,
  onSelectedChange,
  onResetDefaults,
}: Props) {
  const [editing, setEditing] = useState<{
    index: number | null;
    draft: Partial<ArchitectureSpec>;
  } | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const names = useMemo(() => new Set(architectures.map((a) => a.name)), [architectures]);
  const editErrors = editing ? validateArchitecture(editing.draft, knownCurves) : {};
  const canSave = editing != null && !hasAny(editErrors);

  const toggle = (n: string) => {
    const next = new Set(selected);
    next.has(n) ? next.delete(n) : next.add(n);
    onSelectedChange(next);
  };

  const onAdd = () => setEditing({ index: null, draft: emptyArch() });

  const onEdit = (i: number) => setEditing({ index: i, draft: { ...architectures[i] } });

  const onDuplicate = (i: number) => {
    const src = architectures[i];
    const newName = uniqueName(`${src.name} copy`, names);
    setEditing({ index: null, draft: { ...src, name: newName } });
  };

  const onSave = () => {
    if (!editing) return;
    const arch = editing.draft as ArchitectureSpec;
    let next: ArchitectureSpec[];
    if (editing.index === null) {
      next = [...architectures, arch];
      onSelectedChange(new Set([...selected, arch.name]));
    } else {
      const old = architectures[editing.index];
      next = architectures.map((a, i) => (i === editing.index ? arch : a));
      if (old.name !== arch.name) {
        const sel = new Set(selected);
        if (sel.has(old.name)) {
          sel.delete(old.name);
          sel.add(arch.name);
          onSelectedChange(sel);
        }
      }
    }
    onArchitecturesChange(next);
    setEditing(null);
  };

  const onDelete = (i: number) => setDeletingIndex(i);

  const confirmDelete = () => {
    if (deletingIndex == null) return;
    const target = architectures[deletingIndex];
    onArchitecturesChange(architectures.filter((_, i) => i !== deletingIndex));
    const sel = new Set(selected);
    sel.delete(target.name);
    onSelectedChange(sel);
    setDeletingIndex(null);
  };

  return (
    <div>
      <div className="entity-actions-bar">
        <button className="btn" onClick={onAdd}>+ Add architecture</button>
        <button className="btn" onClick={onResetDefaults} title="Restore built-in architectures">Defaults</button>
      </div>

      <div className="toggle-actions">
        <button onClick={() => onSelectedChange(new Set(architectures.map((a) => a.name)))}>All</button>
        <button onClick={() => onSelectedChange(new Set())}>None</button>
        <span className="muted" style={{ alignSelf: "center", fontSize: 11 }}>
          {selected.size} / {architectures.length} selected
        </span>
      </div>

      <div className="entity-list">
        {architectures.map((a, i) => {
          const errs = validateArchitecture(a, knownCurves);
          const invalid = hasAny(errs);
          return (
            <div key={`${a.name}-${i}`} className={`entity-row ${invalid ? "invalid" : ""}`}>
              <input
                type="checkbox"
                checked={selected.has(a.name)}
                onChange={() => toggle(a.name)}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.name || <em>(unnamed)</em>}
                </div>
                <div className="ent-meta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {CONVERTER_LABEL[a.converter_type]}
                  {a.target_bus_v != null ? ` · ${a.target_bus_v}V bus` : ""}
                  {` · ${a.pack_nom_min_v}–${a.pack_nom_max_v}V`}
                </div>
                {invalid && (
                  <div className="field-error" style={{ marginTop: 2 }}>
                    {Object.values(errs)[0]}
                  </div>
                )}
              </div>
              <div className="ent-actions">
                <Tooltip text="Edit architecture">
                  <button
                    className="icon-btn-lg"
                    onClick={() => onEdit(i)}
                    aria-label="Edit architecture"
                  >
                    <PencilIcon className="icon-svg" />
                  </button>
                </Tooltip>
                <Tooltip text="Duplicate architecture">
                  <button
                    className="icon-btn-lg"
                    onClick={() => onDuplicate(i)}
                    aria-label="Duplicate architecture"
                  >
                    <Square2StackIcon className="icon-svg" />
                  </button>
                </Tooltip>
                <Tooltip text="Delete architecture">
                  <button
                    className="icon-btn-lg danger"
                    onClick={() => onDelete(i)}
                    aria-label="Delete architecture"
                  >
                    <TrashIcon className="icon-svg" />
                  </button>
                </Tooltip>
              </div>
            </div>
          );
        })}
        {architectures.length === 0 && (
          <div className="empty-state">No architectures. Click <strong>+ Add architecture</strong> or <strong>Defaults</strong>.</div>
        )}
      </div>

      <Modal
        open={editing !== null}
        title={editing?.index === null ? "Add architecture" : "Edit architecture"}
        onClose={() => setEditing(null)}
        onSubmit={onSave}
        submitDisabled={!canSave}
        submitLabel="Save architecture"
        width={680}
      >
        {editing && (
          <ArchForm
            draft={editing.draft}
            setDraft={(d) => setEditing({ ...editing, draft: d })}
            errors={editErrors}
            curves={knownCurves}
          />
        )}
      </Modal>

      <Modal
        open={deletingIndex !== null}
        title="Delete architecture?"
        onClose={() => setDeletingIndex(null)}
        onSubmit={confirmDelete}
        submitLabel="Delete"
        destructive
        width={400}
      >
        {deletingIndex !== null && (
          <div>
            Delete <strong>{architectures[deletingIndex]?.name}</strong>?
          </div>
        )}
      </Modal>
    </div>
  );
}
