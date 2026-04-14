type Option = { value: string | number; label: string };

export function FilterBar({
  action,
  values,
  categories,
  cities,
  markets,
  products,
  includeMarket = true,
  includeProduct = false,
}: {
  action: string;
  values: { category?: string; city?: string; marketId?: number; periodDays?: number; productId?: number };
  categories: Option[];
  cities: Option[];
  markets: Option[];
  products: Option[];
  includeMarket?: boolean;
  includeProduct?: boolean;
}) {
  return (
    <form
      action={action}
      className="grid gap-4 rounded-[28px] border border-line/80 bg-paper/95 p-5 shadow-card md:grid-cols-5"
    >
      <Select name="categoria" label="Categoria" options={categories} current={values.category} />
      <Select name="cidade" label="Cidade" options={cities} current={values.city} />
      <Select
        name="periodo"
        label="Periodo"
        options={[
          { value: 7, label: "7 dias" },
          { value: 30, label: "30 dias" },
          { value: 45, label: "45 dias" },
        ]}
        current={values.periodDays ?? 30}
      />
      {includeMarket ? <Select name="mercado" label="Mercado" options={markets} current={values.marketId} /> : null}
      {includeProduct ? <Select name="produto_id" label="Produto" options={products} current={values.productId} /> : null}
      <div className="flex items-end gap-2 md:col-span-1">
        <button className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm" type="submit">
          Aplicar filtros
        </button>
        <a className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold" href={action}>
          Limpar
        </a>
      </div>
    </form>
  );
}

function Select({
  name,
  label,
  options,
  current,
}: {
  name: string;
  label: string;
  options: Option[];
  current?: string | number;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-600">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={current == null ? "" : String(current)}
        className="rounded-2xl border border-line bg-white px-4 py-2 text-ink shadow-sm outline-none transition focus:border-accent"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
