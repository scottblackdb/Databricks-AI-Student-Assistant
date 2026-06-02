// Student picker (port of iOS SettingsView).
import type { Student } from "../api";

interface Props {
  students: Student[];
  selectedStudentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function SettingsModal({ students, selectedStudentId, onSelect, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="text-button" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="modal-body">
          <div className="form-section-label">STUDENT</div>
          <select
            className="student-select"
            value={selectedStudentId}
            onChange={(e) => onSelect(e.target.value)}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
          <p className="form-footer">
            The selected student's ID is sent to the agent when fetching missing assignments.
          </p>
        </div>
      </div>
    </div>
  );
}
