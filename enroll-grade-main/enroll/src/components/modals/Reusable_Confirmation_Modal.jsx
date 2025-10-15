import './reusable_modal_box.css';

export const ReusableConfirmationModalBox = ({
  showConfirm,
  onCloseConfirm,
  children,
}) => {
  if (!showConfirm) return null;

  return (
    <div
      className="reusable_confirmation_modal_box-overlay"
      onClick={onCloseConfirm}
    >
      <div
        className="reusable_confirmation_modal_box"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside box
      >
        {children}
      </div>
    </div>
  );
};
