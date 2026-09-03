/** Fetch every page in a deterministic order; never return a truncated partial result. */
export async function collectTrackerPages<Row, QueryError>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: QueryError | null }>,
  pageSize = 500,
): Promise<{ data: Row[] | null; error: QueryError | null }> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new RangeError("Invalid tracker page size");
  }
  const rows: Row[] = [];
  for (let page = 0; page < 200; page += 1) {
    const from = page * pageSize;
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    const batch = result.data || [];
    rows.push(...batch);
    if (batch.length < pageSize) return { data: rows, error: null };
  }
  throw new Error("Слишком много записей для одного периода. Выберите другой год.");
}
