export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">⌂</span>Homebase
        </div>
        <p className="eyebrow">YOUR HOME, AT A GLANCE</p>
        <button className="nav-item selected">
          All tasks <span>0</span>
        </button>
        <div className="sidebar-bottom">Made for your everyday.</div>
      </aside>
      <main>
        <header className="page-header">
          <div>
            <p className="eyebrow">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <h1>All tasks</h1>
          </div>
          <span className="small muted">A little less to remember.</span>
        </header>
        <div className="summary">
          {['Needs attention', 'Coming up', 'All good'].map((label) => (
            <div className="summary-tile" key={label}>
              <strong>0</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <section className="empty-state">
          <span className="empty-mark">⌂</span>
          <h2>A calmer home starts here.</h2>
          <p>
            Your chores and the last time you did them, together in one place.
          </p>
          <p className="muted">
            Your task list is ready for the next implementation phase.
          </p>
        </section>
      </main>
    </div>
  );
}
