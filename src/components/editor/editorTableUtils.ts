export const TABLE_MIN_DIMENSION = 1;
export const TABLE_MAX_DIMENSION = 20;

export type TableCommand =
  | 'addRowBefore'
  | 'addRowAfter'
  | 'deleteRow'
  | 'addColumnBefore'
  | 'addColumnAfter'
  | 'deleteColumn'
  | 'deleteTable';

export const canGrowEditorTableDimension = (currentSize: number): boolean =>
  Number.isInteger(currentSize) && currentSize < TABLE_MAX_DIMENSION;

export const getEditorTableColumnCount = (table: HTMLTableElement): number =>
  Array.from(table.rows).reduce(
    (maxColumns, row) =>
      Math.max(
        maxColumns,
        Array.from(row.cells).reduce((columns, cell) => columns + Math.max(1, cell.colSpan), 0)
      ),
    0
  );
