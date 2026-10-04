export default function PageHeading({ icon: Icon, title, children }) {
  return (
    <header className="page-heading">
      {Icon && (
        <span className="page-heading-icon">
          <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
        </span>
      )}
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{children}</p>
      </div>
    </header>
  );
}
