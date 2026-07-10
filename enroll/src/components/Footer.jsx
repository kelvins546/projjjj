import './footer.css';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="text">
        <p>
          &copy; {currentYear} Benigno Aquino Jr. High School Student Enrollment
          and Grading System.
        </p>
        <p>All Rights Reserved.</p>
      </div>
    </footer>
  );
};
