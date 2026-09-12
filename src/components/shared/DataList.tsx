import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

/**
 * The one authoritative spelling of the actions-column key. A tab that wants
 * an actions *column* in the table adds `{ key: ACTIONS_COLUMN_KEY, label,
 * align: 'center' }` to `columns` and puts the buttons in `row.actions`.
 * The table renders them in that column; the card renders them in its own
 * action row, and never as a labelled body pair. If a consumer supplies
 * `row.actions` on any row and forgets to declare this column, DataList adds
 * one itself so the table and the card never disagree about whether the
 * buttons exist.
 */
export const ACTIONS_COLUMN_KEY = '__actions';

export interface DataListColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  /**
   * How the cell presents on a phone card. 'title' becomes the card heading,
   * 'body' a label/value pair, 'meta' a muted footer entry.
   */
  role?: 'title' | 'body' | 'meta';
  /** Omit from the phone card. Still rendered in the table. */
  hideOnPhone?: boolean;
  sortable?: boolean;
  onSort?: () => void;
  sortDirection?: 'asc' | 'desc' | null;
}

export interface DataListRow {
  key: string | number;
  cells: Record<string, React.ReactNode>;
  actions?: React.ReactNode;
  expandedContent?: React.ReactNode;
  isExpanded?: boolean;
  onClick?: () => void;
}

export interface DataListProps {
  columns: DataListColumn[];
  rows: DataListRow[];
  emptyMessage: string;
  /** Extra classes for the table element, e.g. a desktop min-width. */
  tableClassName?: string;
}

const alignClass = (align?: DataListColumn['align']) =>
  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

/** Enter/Space activates a clickable row or card exactly like a click would. */
const handleActivationKeyDown =
  (onClick?: () => void) => (event: React.KeyboardEvent) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

/**
 * A table above md, a stacked card list below it.
 *
 * The four admin tables carried min-widths of 500-640px inside an
 * overflow-x-auto, so reading a row on a phone meant scrolling sideways and
 * losing the row header. Cards keep every value labelled and on screen.
 *
 * Cells must arrive without <td> layout classes: this component owns padding
 * and alignment in both modes.
 *
 * See `ACTIONS_COLUMN_KEY` above for the actions-column convention: no
 * consumer supplies the buttons twice, and DataList — not the consumer — is
 * responsible for keeping the table and the card in agreement about whether
 * an actions column exists.
 */
export const DataList: React.FC<DataListProps> = ({
  columns,
  rows,
  emptyMessage,
  tableClassName = '',
}) => {
  const { isPhone } = useResponsive();

  // If any row carries actions but the consumer never declared the actions
  // column, add it ourselves. Otherwise the card (which renders row.actions
  // unconditionally) and the table (which only has a cell for a declared
  // column) silently disagree: the buttons show on the phone and vanish on
  // desktop.
  const hasDeclaredActionsColumn = columns.some((col) => col.key === ACTIONS_COLUMN_KEY);
  const hasRowActions = rows.some((row) => row.actions);
  const effectiveColumns: DataListColumn[] =
    !hasDeclaredActionsColumn && hasRowActions
      ? [...columns, { key: ACTIONS_COLUMN_KEY, label: '', align: 'center' }]
      : columns;

  if (!isPhone) {
    return (
      <div className="overflow-x-auto">
        <table className={`w-full text-left border-collapse ${tableClassName}`}>
          <thead>
            <tr>
              {effectiveColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? col.onSort : undefined}
                  className={`p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 border-b border-neutral-100 ${alignClass(col.align)} ${
                    col.sortable ? 'cursor-pointer hover:text-neutral-900 transition-colors' : ''
                  }`}
                >
                  <span className={`inline-flex items-center gap-2 ${col.align === 'center' ? 'justify-center' : ''}`}>
                    {col.label}
                    {col.sortable && (
                      <ArrowUpDown
                        className={`w-3 h-3 transition-opacity ${col.sortDirection ? 'opacity-100' : 'opacity-30'}`}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <React.Fragment key={row.key}>
                <tr
                  onClick={row.onClick}
                  role={row.onClick ? 'button' : undefined}
                  tabIndex={row.onClick ? 0 : undefined}
                  onKeyDown={handleActivationKeyDown(row.onClick)}
                  className={`transition-colors ${row.onClick ? 'cursor-pointer' : ''} ${
                    row.isExpanded ? 'bg-neutral-50' : 'hover:bg-neutral-50'
                  }`}
                >
                  {effectiveColumns.map((col) => (
                    <td key={col.key} className={`p-6 ${alignClass(col.align)}`}>
                      {col.key === ACTIONS_COLUMN_KEY ? row.actions : row.cells[col.key]}
                    </td>
                  ))}
                </tr>
                {row.isExpanded && row.expandedContent && (
                  <tr>
                    <td colSpan={effectiveColumns.length} className="p-0 bg-neutral-50 border-b border-neutral-100">
                      {row.expandedContent}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={effectiveColumns.length} className="p-12 text-center text-neutral-400 italic text-sm">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // The actions column (declared or auto-appended) is never a body pair on
  // the card: row.actions already gets its own action row below, so
  // including it here would render a labelled "Actions" pair whose value is
  // always undefined.
  const visible = effectiveColumns.filter(
    (col) => !col.hideOnPhone && col.key !== ACTIONS_COLUMN_KEY,
  );
  const titleCols = visible.filter((col) => col.role === 'title');
  const bodyCols = visible.filter((col) => !col.role || col.role === 'body');
  const metaCols = visible.filter((col) => col.role === 'meta');
  const sortCols = effectiveColumns.filter((col) => col.sortable);

  if (rows.length === 0) {
    return <p className="p-12 text-center text-neutral-400 italic text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col">
      {sortCols.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-4 pb-1">
          {sortCols.map((col) => (
            <button
              key={col.key}
              onClick={col.onSort}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 touch-target rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
                col.sortDirection ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {col.label}
              <ArrowUpDown className={`w-3 h-3 ${col.sortDirection === 'desc' ? 'rotate-180' : ''}`} />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col divide-y divide-neutral-100">
        {rows.map((row) => (
          <div key={row.key} className={row.isExpanded ? 'bg-neutral-50' : ''}>
            <div
              data-testid="datalist-card"
              onClick={row.onClick}
              role={row.onClick ? 'button' : undefined}
              tabIndex={row.onClick ? 0 : undefined}
              onKeyDown={handleActivationKeyDown(row.onClick)}
              className={`flex flex-col gap-2 px-4 py-4 ${row.onClick ? 'cursor-pointer active:bg-neutral-50' : ''}`}
            >
              {titleCols.map((col) => (
                <div key={col.key} className="text-base font-bold text-neutral-900 leading-snug">
                  {row.cells[col.key]}
                </div>
              ))}

              {bodyCols.length > 0 && (
                <dl className="flex flex-col gap-1.5">
                  {bodyCols.map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-4">
                      <dt className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 shrink-0 pt-0.5">
                        {col.label}
                      </dt>
                      <dd className="text-sm text-neutral-900 text-right min-w-0 flex-1">
                        {row.cells[col.key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {metaCols.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
                  {metaCols.map((col) => (
                    <span key={col.key}>{row.cells[col.key]}</span>
                  ))}
                </div>
              )}

              {row.actions && (
                <div className="flex flex-wrap items-center gap-2 pt-1">{row.actions}</div>
              )}
            </div>

            {row.isExpanded && row.expandedContent && (
              <div className="border-t border-neutral-100">{row.expandedContent}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
