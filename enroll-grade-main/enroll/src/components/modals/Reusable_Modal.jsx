import './reusable_modal_box.css';
import { ReusableConfirmationModalBox } from './Reusable_Confirmation_Modal';

export const ReusableModalBox = ({ show, onClose, children }) => {
  if (!show) return null;

  return (
    <div className="reusable_modal_box-overlay" onClick={onClose}>
      <div className="reusable_modal_box" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};
