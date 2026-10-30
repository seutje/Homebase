import { useState } from 'react';
import { ConfirmProvider } from './components/Dialog';
import { TaskForm } from './features/tasks/TaskForm';
import { CategoryManager } from './features/categories/CategoryManager';
import { Settings } from './features/settings/Settings';
import { useHomebase } from './lib/useHomebase';
import { dueLabel, fullDate, lastDone, recurrence } from './lib/format';
import type { Status, Task } from './types';

export default function App() {
  return (
    <ConfirmProvider>
      <Homebase />
    </ConfirmProvider>
  );
}
function Homebase() {
  const { data, categories, display, error, loading, refresh } = useHomebase();
  const [category, setCategory] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [form, setForm] = useState<Task | 'new' | null>(null);
  const [manageCategories, setManageCategories] = useState(false);
  const [settings, setSettings] = useState(false);
  const tasks = data?.tasks ?? [];
  const activeCategory = categories.find((c) => c.id === category);
  const categoryTasks = activeCategory
    ? tasks.filter((t) => t.categoryId === category)
    : tasks;
  const visible = status
    ? categoryTasks.filter((t) => t.status === status)
    : categoryTasks;
  const filtered = !!activeCategory || !!status;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">⌂</span>Homebase
        </div>
        <p className="eyebrow">YOUR HOME, AT A GLANCE</p>
        <button
          className={`nav-item ${!activeCategory ? 'selected' : ''}`}
          onClick={() => {
            setCategory(null);
            setStatus(null);
          }}
        >
          All tasks <span>{tasks.length}</span>
        </button>
        <p className="eyebrow category-heading">CATEGORIES</p>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`nav-item ${category === c.id ? 'selected' : ''}`}
            onClick={() => {
              setCategory(c.id);
              setStatus(null);
            }}
          >
            {c.name}
            <span>{tasks.filter((t) => t.categoryId === c.id).length}</span>
          </button>
        ))}
        <button
          className="nav-item subtle"
          onClick={() => setManageCategories(true)}
        >
          + Manage categories
        </button>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setSettings(true)}>
            ⚙ Settings
          </button>
          <p>Made for your everyday.</p>
        </div>
      </aside>
      <main>
        <header className="page-header">
          <div>
            <p className="eyebrow">
              {data ? fullDate(data.asOfDate) : 'YOUR DAILY OVERVIEW'}
            </p>
            <h1>{activeCategory?.name ?? 'All tasks'}</h1>
          </div>
          <button
            className="primary"
            disabled={!data}
            onClick={() => setForm('new')}
          >
            + Add task
          </button>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => void refresh()}>Retry</button>
          </div>
        )}
        <div className="summary">
          {(
            [
              { key: 'attention', label: 'Needs attention' },
              { key: 'upcoming', label: 'Coming up' },
              { key: 'good', label: 'All good' },
            ] as const
          ).map((tile) => (
            <button
              key={tile.key}
              className={`summary-tile ${status === tile.key ? 'active' : ''}`}
              onClick={() => setStatus(status === tile.key ? null : tile.key)}
            >
              <strong>
                {categoryTasks.filter((t) => t.status === tile.key).length}
              </strong>
              <span>{tile.label}</span>
            </button>
          ))}
        </div>
        <div className="list-toolbar">
          <p>
            {filtered
              ? `Showing ${visible.length} of ${tasks.length}`
              : `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} · A little less to remember.`}
          </p>
          {filtered && (
            <button
              className="text-button"
              onClick={() => {
                setCategory(null);
                setStatus(null);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        {loading ? (
          <div className="empty-state">
            <p>Opening your home…</p>
          </div>
        ) : visible.length === 0 ? (
          <section className="empty-state">
            <span className="empty-mark">⌂</span>
            <h2>
              {tasks.length === 0
                ? 'A calmer home starts here.'
                : 'Nothing here right now.'}
            </h2>
            <p>
              {tasks.length === 0
                ? 'Your chores and the last time you did them, together in one place.'
                : 'Try another category or clear your filters.'}
            </p>
            <button onClick={() => setForm('new')} disabled={!data}>
              + Add your first task
            </button>
          </section>
        ) : (
          <div className="task-list">
            <div className="list-head">
              <span>YOUR TASKS</span>
              <span>LAST COMPLETED</span>
              <span />
            </div>
            {visible.map((task) => (
              <article key={task.id} className={`task-row ${task.status}`}>
                <button className="task-title" onClick={() => setForm(task)}>
                  <strong>{task.title}</strong>
                  <span>
                    {recurrence(task.schedule)} · {task.categoryName}
                  </span>
                </button>
                <div
                  className="completion-value"
                  title={
                    task.lastCompletedOn
                      ? fullDate(task.lastCompletedOn)
                      : 'No completion history yet'
                  }
                >
                  <strong>{lastDone(task, display)}</strong>
                  <span>{dueLabel(task)}</span>
                </div>
                <button
                  disabled
                  title="Completion controls arrive in the next phase"
                >
                  Done
                </button>
              </article>
            ))}
          </div>
        )}
      </main>
      {form && data && (
        <TaskForm
          task={form === 'new' ? undefined : form}
          categories={categories}
          today={data.asOfDate}
          onSaved={refresh}
          onClose={() => setForm(null)}
        />
      )}
      {manageCategories && (
        <CategoryManager
          categories={categories}
          onSaved={refresh}
          onClose={() => setManageCategories(false)}
        />
      )}
      {settings && (
        <Settings
          display={display}
          onSaved={refresh}
          onClose={() => setSettings(false)}
        />
      )}
    </div>
  );
}
