'use client';

import { useState } from 'react';
import { apiFetch, type SubProject, type SubTask } from '../lib/api';
import Modal from './Modal';
import ProgressBar from './ProgressBar';
import { softColorForId, textColorForId } from './AppShell/colors';

type Props = {
  open: boolean;
  isAdmin: boolean;
  currentUserId: number;
  subproject: SubProject | null;
  onClose: () => void;
  onChanged: () => void;
};

export default function PersonalModal({
  open,
  isAdmin,
  currentUserId,
  subproject,
  onClose,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (!subproject) return null;

  const canEdit =
    isAdmin ||
    (subproject.assignee_id !== null && subproject.assignee_id === currentUserId);

  const tasks = [...subproject.subtasks].sort(
    (left, right) => left.order_index - right.order_index,
  );
  const currentStep = tasks.find((task) => !task.is_done);
  const isAllDone = tasks.length > 0 && tasks.every((task) => task.is_done);
  const accentSurface = subproject.assignee_id
    ? softColorForId(subproject.assignee_id)
    : 'bg-[#F1EFE8]';
  const accentText = subproject.assignee_id
    ? textColorForId(subproject.assignee_id)
    : 'text-[#5F5E5A]';

  async function toggle(task: SubTask) {
    if (!canEdit || busy !== null) return;
    setBusy(task.id);
    setError('');
    try {
      await apiFetch(`/subtasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_done: !task.is_done }),
      });
      onChanged();
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel={subproject.name}>
      <div className="space-y-5">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[1px] text-[#888780]">
            Personal calendar assigned work
          </p>
          <h3 className="mt-2 text-[19px] font-bold text-[#1A1A1A]">
            {subproject.name}
          </h3>
          <p className="mt-2 text-[11px] text-[#888780]">
            {subproject.start_date} - {subproject.end_date}
          </p>
        </div>

        <div
          className={`rounded-[20px] border px-3 py-2 ${accentSurface} ${accentText}`}
        >
          <p className="text-[11px] font-semibold">
            Assignee {subproject.assignee?.name ?? 'Unassigned'}
          </p>
        </div>

        <div className={`rounded-[10px] border p-4 ${accentSurface}`}>
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-bold ${accentText}`}>
              Task progress
            </p>
            <span className={`text-[13px] font-bold ${accentText}`}>
              {Math.round(subproject.progress)}%
            </span>
          </div>
          <ProgressBar
            value={subproject.progress}
            size="md"
            className="mt-2"
            ariaLabel={`${subproject.name} progress`}
          />
        </div>

        {!canEdit && (
          <p className="rounded-xl bg-[#FAEEDA] px-4 py-3 text-sm text-[#854F0B]">
            Only the assigned member can update this task checklist.
          </p>
        )}

        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#D3D1C7] bg-[#FAFAFA] px-4 py-6 text-center text-sm text-[#888780]">
              No tasks have been added yet.
            </p>
          ) : (
            <div className="rounded-xl border border-[#EAEAE4] bg-white p-4">
              <div className="mb-3 flex items-center justify-between border-b border-[#EAEAE4] pb-2 pl-6">
                <span className="text-[9px] font-bold uppercase tracking-[0.8px] text-[#888780]">
                  Detail tasks
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.8px] text-[#888780]">
                  Weight
                </span>
              </div>

              <ul className="space-y-1">
                {tasks.map((task) => {
                  const isCurrent = currentStep?.id === task.id;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 border-b border-[#F1EFE8] py-2 last:border-b-0"
                    >
                      <button
                        type="button"
                        disabled={!canEdit || busy !== null}
                        onClick={() => void toggle(task)}
                        className={`flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border text-[9px] ${
                          task.is_done
                            ? 'border-[#22C55E] bg-[#22C55E] text-white'
                            : isCurrent
                              ? 'border-[#534AB7] bg-white text-[#534AB7]'
                              : 'border-[#D3D1C7] bg-white text-transparent'
                        }`}
                      >
                        ✓
                      </button>

                      <span
                        className={`flex-1 text-[12px] ${
                          task.is_done
                            ? 'text-[#B4B2A9] line-through'
                            : isCurrent
                              ? 'font-bold text-[#534AB7]'
                              : 'text-[#1A1A1A]'
                        }`}
                      >
                        {isCurrent && !task.is_done ? 'Now · ' : ''}
                        {task.name}
                      </span>

                      <span
                        className={`min-w-[32px] text-right text-[11px] font-semibold ${
                          task.is_done
                            ? 'text-[#22C55E]'
                            : isCurrent
                              ? 'text-[#534AB7]'
                              : 'text-[#888780]'
                        }`}
                      >
                        {Number(task.weight).toFixed(0)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {isAllDone && (
          <p className="rounded-xl bg-[#EAF3DE] px-4 py-3 text-sm text-[#3B6D11]">
            All detail tasks are complete and the project progress has been updated.
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-[#FCEBEB] px-4 py-3 text-sm text-[#A32D2D]">
            {error}
          </p>
        )}

        <div className="flex justify-end border-t border-[#EAEAE4] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#D3D1C7] px-4 py-2 text-[11px] font-bold text-[#5F5E5A] hover:bg-[#F8F8F5]"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
