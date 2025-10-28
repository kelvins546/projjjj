import { useState } from "react";
import "./dropdown1.css";

export const CustomDropdown = ({ label = "", options = [], }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const handleSelect = (option) => {
    setSelected(option);
    setIsOpen(false);
    if (onSelect) onSelect(option);
  };

  return (
    <div className="dropdown-container">
      <label className="dropdown-label">{label}</label>
      <div className="dropdown-box" onClick={() => setIsOpen(!isOpen)}>
        <span className={`dropdown-placeholder ${selected ? "selected" : ""}`}>
          {selected || "Year"}
        </span>
        <span className="dropdown-arrow">▾</span>
      </div>

      {isOpen && (
        <ul className="dropdown-list">
          {options.map((opt, i) => (
            <li
              key={i}
              className={`dropdown-item ${selected === opt ? "active" : ""}`}
              onClick={() => handleSelect(opt)}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
