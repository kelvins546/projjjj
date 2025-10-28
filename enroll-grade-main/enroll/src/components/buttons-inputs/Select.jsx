import './select.css';

export const Select = ({ children, className }) => {
  return <select className={className}>{children}</select>;
};
