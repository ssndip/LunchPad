import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataList, DataListColumn, DataListRow, ACTIONS_COLUMN_KEY } from './DataList';

const responsive = vi.hoisted(() => ({ value: { isPhone: true } }));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: responsive.value.isPhone ? 390 : 1280,
    height: 840, isPortrait: true, isLandscape: false,
    isPhone: responsive.value.isPhone, isTablet: false,
    isDesktop: !responsive.value.isPhone, useMobileLayout: responsive.value.isPhone,
    sm: true, md: !responsive.value.isPhone, lg: !responsive.value.isPhone, xl: false, xxl: false,
  }),
}));

const columns: DataListColumn[] = [
  { key: 'name', label: 'Name', role: 'title' },
  { key: 'price', label: 'Price', align: 'right' },
  { key: 'status', label: 'Status', role: 'meta' },
  { key: 'internal', label: 'Internal', hideOnPhone: true },
];

const rows: DataListRow[] = [
  {
    key: 1,
    cells: { name: 'Soup', price: '€1.80', status: 'Available', internal: 'id-1' },
    actions: <button>Edit</button>,
  },
  {
    key: 2,
    cells: { name: 'Salad', price: '€2.50', status: 'Sold out', internal: 'id-2' },
  },
];

describe('DataList', () => {
  beforeEach(() => {
    responsive.value.isPhone = true;
  });

  it('renders a table above md', () => {
    responsive.value.isPhone = false;
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2
  });

  it('renders cards and no table on a phone', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('datalist-card')).toHaveLength(2);
  });

  it('shows every non-hidden column value on the phone card', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.getByText('€1.80')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('omits hideOnPhone columns from the card but keeps them in the table', () => {
    const { unmount } = render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.queryByText('id-1')).not.toBeInTheDocument();
    unmount(); // otherwise the second render stacks a table beside the cards

    responsive.value.isPhone = false;
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getByText('id-1')).toBeInTheDocument();
  });

  it('labels body cells on the card so a value is never orphaned', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getAllByText('Price').length).toBeGreaterThan(0);
  });

  it('renders row actions on the card', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('shows the empty message in both modes', () => {
    const { unmount } = render(<DataList columns={columns} rows={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    unmount();

    responsive.value.isPhone = false;
    render(<DataList columns={columns} rows={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders expanded content when a row is expanded', () => {
    const expandable: DataListRow[] = [
      { key: 1, cells: { name: 'Soup', price: '€1.80', status: 'x', internal: 'y' },
        isExpanded: true, expandedContent: <div>breakdown</div> },
    ];
    render(<DataList columns={columns} rows={expandable} emptyMessage="none" />);
    expect(screen.getByText('breakdown')).toBeInTheDocument();
  });

  it('fires onClick from a card', () => {
    const onClick = vi.fn();
    render(
      <DataList
        columns={columns}
        rows={[{ key: 1, cells: { name: 'Soup', price: '', status: '', internal: '' }, onClick }]}
        emptyMessage="none"
      />,
    );
    fireEvent.click(screen.getByTestId('datalist-card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes sortable columns on the phone', () => {
    const onSort = vi.fn();
    const sortable: DataListColumn[] = [
      { key: 'name', label: 'Name', role: 'title', sortable: true, onSort, sortDirection: 'asc' },
    ];
    render(<DataList columns={sortable} rows={[{ key: 1, cells: { name: 'Soup' } }]} emptyMessage="none" />);
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('renders row actions in the table when the consumer never declares an __actions column', () => {
    // `columns` has no __actions entry; row 1 still carries `actions`. Before
    // the fix this rendered on the phone card but silently vanished above md.
    responsive.value.isPhone = false;
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    const editButton = screen.getByText('Edit');
    expect(editButton).toBeInTheDocument();
    expect(editButton.closest('td')).toBeInTheDocument();
  });

  it('still renders actions in both modes when the consumer never declares __actions (card side)', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('excludes a declared __actions column from the card body pairs, and still renders it in the table', () => {
    const withActionsColumn: DataListColumn[] = [
      { key: 'name', label: 'Name', role: 'title' },
      { key: ACTIONS_COLUMN_KEY, label: 'Actions', align: 'center' },
    ];
    const rowsWithActions: DataListRow[] = [
      { key: 1, cells: { name: 'Soup' }, actions: <button>Edit</button> },
    ];

    const { unmount } = render(
      <DataList columns={withActionsColumn} rows={rowsWithActions} emptyMessage="none" />,
    );
    // No labelled "Actions" dt/dd pair with an empty value on the card.
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    unmount();

    responsive.value.isPhone = false;
    render(<DataList columns={withActionsColumn} rows={rowsWithActions} emptyMessage="none" />);
    // Header renders the declared label exactly once; the button still shows in its cell.
    expect(screen.getAllByText('Actions')).toHaveLength(1);
    expect(screen.getByText('Edit').closest('td')).toBeInTheDocument();
  });

  it('activates a clickable card via Enter and Space; a non-clickable card is not focusable', () => {
    const onClick = vi.fn();
    render(
      <DataList
        columns={columns}
        rows={[
          { key: 1, cells: { name: 'Soup', price: '', status: '', internal: '' }, onClick },
          { key: 2, cells: { name: 'Salad', price: '', status: '', internal: '' } },
        ]}
        emptyMessage="none"
      />,
    );
    const cards = screen.getAllByTestId('datalist-card');
    fireEvent.keyDown(cards[0], { key: 'Enter' });
    fireEvent.keyDown(cards[0], { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(cards[0]).toHaveAttribute('tabindex', '0');
    expect(cards[1]).not.toHaveAttribute('tabindex');
  });

  it('drives the table branch: click and keyboard activate onClick, expanded content colSpan matches the column count, and a header click fires onSort', () => {
    responsive.value.isPhone = false;
    const onClick = vi.fn();
    const onSort = vi.fn();
    const sortableColumns: DataListColumn[] = [
      { key: 'name', label: 'Name', sortable: true, onSort, sortDirection: null },
      { key: 'price', label: 'Price', align: 'right' },
    ];
    const expandableRows: DataListRow[] = [
      {
        key: 1,
        cells: { name: 'Soup', price: '€1.80' },
        onClick,
        isExpanded: true,
        expandedContent: <div>breakdown</div>,
      },
    ];
    render(<DataList columns={sortableColumns} rows={expandableRows} emptyMessage="none" />);

    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledTimes(1);

    // A clickable <tr> takes role="button" for keyboard focusability, which
    // means it is no longer exposed as role="row" — look it up by its new role.
    const dataRow = screen.getByRole('button');
    expect(dataRow.tagName).toBe('TR');
    expect(dataRow).toHaveAttribute('tabindex', '0');
    fireEvent.click(dataRow);
    fireEvent.keyDown(dataRow, { key: 'Enter' });
    fireEvent.keyDown(dataRow, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(3);

    const expandedCell = screen.getByText('breakdown').closest('td');
    expect(expandedCell).toHaveAttribute('colspan', '2');
  });
});
