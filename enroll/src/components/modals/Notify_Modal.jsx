// components/modals/Notify_Modal.jsx
import React from 'react';
import Reusable_Modal from './Reusable_Modal'; // same folder as your other modals

const Notify_Modal = ({
  show,
  row, // { name, email, grade_level, enrollment_id, applicant_id }
  choice, // 'refer' | 'resubmit'
  notes,
  setChoice,
  setNotes,
  onClose,
  onSend,
  busy,
}) => {
  if (!show || !row) return null;

  return (
    <Reusable_Modal
      show={show}
      onClose={onClose}
      title="Notify Applicant"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            className="modal-btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn primary"
            onClick={onSend}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Send notification'}
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>
        {row.name} • {row.email} • {row.grade_level}
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="radio"
            name="notifyReason"
            value="refer"
            checked={choice === 'refer'}
            onChange={(e) => setChoice(e.target.value)}
          />
          <span>Refer to other school (slots are full)</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="radio"
            name="notifyReason"
            value="resubmit"
            checked={choice === 'resubmit'}
            onChange={(e) => setChoice(e.target.value)}
          />
          <span>Please resubmit documents (unclear)</span>
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <label
          style={{
            display: 'block',
            fontSize: 12,
            color: '#475569',
            marginBottom: 4,
          }}
        >
          Optional notes to include
        </label>
        <textarea
          rows={4}
          style={{ width: '100%' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add specific guidance or instructions…"
        />
      </div>
    </Reusable_Modal>
  );
};

export default Notify_Modal;
