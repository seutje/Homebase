import { useRef, useState } from 'react';
import { ConfirmProvider } from './components/Dialog';
import { TaskForm } from './features/tasks/TaskForm';
import { CategoryManager } from './features/categories/CategoryManager';
import { Settings } from './features/settings/Settings';
import { useHomebase } from './lib/useHomebase';
import { dueLabel, fullDate, lastDone, recurrence } from './lib/format';
import type { Status, Task } from './types';
import { api, errorMessage } from './lib/api';
import { TaskDetail } from './features/tasks/TaskDetail';
import { DateForm } from './features/tasks/DateForm';
import { CompletionActions } from './features/tasks/CompletionActions';
import { useToasts } from './lib/useToasts';
import { Toasts } from './components/Toasts';
import { ChoreLibrary } from './features/library/ChoreLibrary';
import { SnoozeForm } from './features/tasks/SnoozeForm';
import {
  matchesSearch,
  sortTasks,
  type SortMode,
} from './features/tasks/taskFilters';

export default function App() {
  return (
    <ConfirmProvider>
      <Homebase />
    </ConfirmProvider>
  );
}
function Homebase() {
  const { data, categories, display, error, setError, loading, refresh } =
    useHomebase();
  const [selected, setSelected] = useState<number | null>(null);
  const [backdate, setBackdate] = useState<Task | null>(null);
  const [snoozing, setSnoozing] = useState<Task | null>(null);
  const [pending, setPending] = useState<number[]>([]);
  const locks = useRef(new Set<number>());
  const { toasts, notify, remove, clear } = useToasts();
  const [category, setCategory] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [form, setForm] = useState<Task | 'new' | null>(null);
  const [manageCategories, setManageCategories] = useState(false);
  const [settings, setSettings] = useState(false);
  const [library, setLibrary] = useState(false);
  const [query, setQuery] = useState('');
  const [includeNotes, setIncludeNotes] = useState(false);
  const [sort, setSort] = useState<SortMode>('due');
  const tasks = data?.tasks ?? [];
  const selectedTask = tasks.find((t) => t.id === selected);
  const complete = async (task: Task, completedOn: string) => {
    if (locks.current.has(task.id)) return;
    locks.current.add(task.id);
    setPending((ids) => [...ids, task.id]);
    try {
      const result = await api.record(task.id, completedOn);
      await refresh();
      if (result.inserted)
        notify(
          `${task.title} completed ${completedOn === data?.asOfDate ? 'today' : `on ${fullDate(completedOn)}`}`,
          async () => {
            try {
              await api.undoCompletion(result.id);
              await refresh();
            } catch (e) {
              setError(errorMessage(e));
              throw e;
            }
          },
        );
      else notify('Already recorded on that date.');
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    } finally {
      locks.current.delete(task.id);
      setPending((ids) => ids.filter((id) => id !== task.id));
    }
  };
  const done = (task: Task) => {
    if (data) void complete(task, data.asOfDate).catch(() => {});
  };
  const activeCategory = categories.find((c) => c.id === category);
  const inCategory = activeCategory
    ? tasks.filter((t) => t.categoryId === category)
    : tasks;
  const categoryTasks = inCategory.filter((t) =>
    matchesSearch(t, query, includeNotes),
  );
  const visible = sortTasks(
    status
      ? categoryTasks.filter((t) =>
          status === 'snoozed' ? t.isSnoozed : t.status === status,
        )
      : categoryTasks,
    sort,
  );
  const filtered = !!activeCategory || !!status || !!query.trim();
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
        <div className="category-scroll">
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
        </div>
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
              {data ? fullDate(data.asOfDate, true) : 'YOUR DAILY OVERVIEW'}
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
        <div className="search-toolbar">
          <label className="search-field">
            Search
            <input
              type="search"
              placeholder="Search tasks or categories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="notes-search">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
            />
            Include notes
          </label>
          <label className="sort-field">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="due">Next due</option>
              <option value="overdue">Most overdue</option>
              <option value="elapsed">Longest since done</option>
              <option value="category">Category</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </label>
        </div>
        <div className="summary">
          {(
            [
              { key: 'attention', label: 'Needs attention' },
              { key: 'upcoming', label: 'Coming up' },
              { key: 'good', label: 'All good' },
              ...(categoryTasks.some((t) => t.status === 'grace')
                ? [{ key: 'grace' as const, label: 'Due within grace' }]
                : []),
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
          {categoryTasks.some((t) => t.isOutOfSeason) && (
            <button
              className={`filter-chip ${status === 'outOfSeason' ? 'active' : ''}`}
              onClick={() =>
                setStatus(status === 'outOfSeason' ? null : 'outOfSeason')
              }
            >
              Out of season ·{' '}
              {categoryTasks.filter((t) => t.isOutOfSeason).length}
            </button>
          )}
          <button
            className={`filter-chip ${status === 'snoozed' ? 'active' : ''}`}
            onClick={() => setStatus(status === 'snoozed' ? null : 'snoozed')}
          >
            Snoozed · {categoryTasks.filter((t) => t.isSnoozed).length}
          </button>
          <p>
            {filtered
              ? `Showing ${visible.length} of ${tasks.length}`
              : `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} · A little less to remember.`}
          </p>
          {!filtered && (
            <button
              className="text-button"
              disabled={!data}
              onClick={() => setLibrary(true)}
            >
              Browse suggested chores
            </button>
          )}
          {filtered && (
            <button
              className="text-button"
              onClick={() => {
                setCategory(null);
                setStatus(null);
                setQuery('');
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
            {tasks.length === 0 && (
              <button
                className="library-start"
                disabled={!data}
                onClick={() => setLibrary(true)}
              >
                Browse suggested chores
              </button>
            )}
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
                <button
                  className="task-title"
                  onClick={() => setSelected(task.id)}
                >
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
                  {task.isOutOfSeason && (
                    <span className="state-label">Out of season</span>
                  )}
                  {task.isSnoozed && task.snoozedUntil && (
                    <span className="state-label">
                      Snoozed until {fullDate(task.snoozedUntil)}
                    </span>
                  )}
                </div>
                <CompletionActions
                  busy={pending.includes(task.id)}
                  onDone={() => done(task)}
                  onBackdate={() => setBackdate(task)}
                  onSnooze={() => setSnoozing(task)}
                />
              </article>
            ))}
          </div>
        )}
      </main>
      {selectedTask && data && (
        <TaskDetail
          key={selectedTask.id}
          task={selectedTask}
          display={display}
          today={data.asOfDate}
          busy={pending.includes(selectedTask.id)}
          onDone={() => done(selectedTask)}
          onBackdate={() => setBackdate(selectedTask)}
          onSnooze={() => setSnoozing(selectedTask)}
          onEdit={() => setForm(selectedTask)}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
      {backdate && data && (
        <DateForm
          title={`Complete ${backdate.title}`}
          date={data.asOfDate}
          today={data.asOfDate}
          onSave={(value) => complete(backdate, value)}
          onClose={() => setBackdate(null)}
        />
      )}
      {snoozing && data && (
        <SnoozeForm
          task={tasks.find((t) => t.id === snoozing.id) ?? snoozing}
          today={data.asOfDate}
          onSave={async (until) => {
            await api.snooze(snoozing.id, until);
            await refresh();
          }}
          onClose={() => setSnoozing(null)}
        />
      )}
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
          urgency={
            data?.urgencyDefaults ?? { comingUpDays: null, graceDays: 0 }
          }
          display={display}
          onSaved={refresh}
          onRestored={async () => {
            clear();
            setSelected(null);
            setBackdate(null);
            setSnoozing(null);
            setCategory(null);
            setStatus(null);
            setQuery('');
            await refresh();
          }}
          onClose={() => setSettings(false)}
        />
      )}
      <Toasts toasts={toasts} remove={remove} />
      {library && (
        <ChoreLibrary
          tasks={tasks}
          onSaved={refresh}
          onClose={() => setLibrary(false)}
        />
      )}
    </div>
  );
}
