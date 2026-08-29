'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, ShoppingBag } from 'lucide-react';
import {
  admin,
  type ShopifyInventoryCode,
  type ShopifyOrder,
  type ShopifyProductMapping,
  type ShopifyProductType,
} from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable, StatusBadge } from '@/components/admin/data-table';

const SHOPIFY_STORE_DOMAIN =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? '' : '';

function shopifyAdminOrderUrl(orderId: string) {
  if (!SHOPIFY_STORE_DOMAIN) return null;
  return `https://${SHOPIFY_STORE_DOMAIN}/admin/orders/${orderId}`;
}

function typeLabel(types: ShopifyProductType[], key: string) {
  return types.find((t) => t.key === key)?.label ?? key;
}

type Tab = 'orders' | 'mappings';

export default function ShopifyOrdersPage() {
  const [tab, setTab] = useState<Tab>('orders');
  const [types, setTypes] = useState<ShopifyProductType[]>([]);

  useEffect(() => {
    admin.listShopifyProductTypes().then(setTypes).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <AdminPageHeader
        title="Shopify Orders"
        description="Paid orders allocate existing printed QR codes. Colour stays on the Shopify order for warehouse picking."
      />

      <div className="flex gap-1 rounded-lg border admin-border-color p-1 w-fit">
        {([
          { key: 'orders', label: 'Orders' },
          { key: 'mappings', label: 'Product mappings' },
        ] as const).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === item.key
                ? 'admin-accent-bg text-white'
                : 'admin-text-muted admin-hover'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'orders' ? <OrdersPanel types={types} /> : <MappingsPanel types={types} />}
    </div>
  );
}

function OrdersPanel({ types }: { types: ShopifyProductType[] }) {
  const [rows, setRows] = useState<ShopifyOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    admin
      .listShopifyOrders(limit, offset, statusFilter || undefined)
      .then((res) => {
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [offset, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setOffset(0);
        }}
        className="h-9 rounded-lg border admin-border-color admin-surface px-3 text-sm admin-text-color focus:outline-none admin-accent-ring"
      >
        <option value="">All statuses</option>
        <option value="allocated">Allocated</option>
        <option value="needs_stock">Needs stock</option>
      </select>
      <span className="text-xs admin-text-subtle">{total} order{total === 1 ? '' : 's'}</span>
      </div>

      <DataTable
        loading={loading}
        data={rows}
        getKey={(r) => r.id}
        offset={offset}
        limit={limit}
        onPrev={() => setOffset((o) => Math.max(0, o - limit))}
        onNext={() => setOffset((o) => o + limit)}
        emptyMessage="No Shopify QR orders yet. Map product IDs first, then place a paid test order."
        columns={[
          {
            key: 'order',
            header: 'Order',
            render: (r) => (
              <div>
                <p className="text-xs font-medium admin-text-color">{r.orderNumber ?? `#${r.shopifyOrderId}`}</p>
                <p className="text-[11px] admin-text-subtle">{r.customerName || r.customerEmail || '—'}</p>
              </div>
            ),
          },
          {
            key: 'items',
            header: 'Lines',
            render: (r) => (
              <span className="text-xs admin-text-subtle">
                {r.items.reduce((sum, i) => sum + i.quantity, 0)} tags · {r.items.length} type{r.items.length === 1 ? '' : 's'}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'date',
            header: 'Received',
            render: (r) => (
              <span className="text-xs admin-text-subtle">{new Date(r.createdAt).toLocaleString()}</span>
            ),
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (r) => (
              <button
                onClick={() => setSelectedId(r.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border admin-border-color admin-surface-raised px-2.5 py-1 text-xs admin-text-muted admin-hover transition-colors"
              >
                <ShoppingBag className="h-3 w-3" />
                Fulfil
              </button>
            ),
          },
        ]}
      />

      {selectedId && (
        <OrderDetail
          orderId={selectedId}
          types={types}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function OrderDetail({
  orderId,
  types,
  onClose,
  onChanged,
}: {
  orderId: string;
  types: ShopifyProductType[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<ShopifyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pickItemId, setPickItemId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    admin
      .getShopifyOrder(orderId)
      .then(setOrder)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function autoAssign() {
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      const updated = await admin.autoAssignShopifyOrder(order.id);
      setOrder(updated);
      onChanged();
    } catch (err: any) {
      setError(err?.message ?? 'Auto-assign failed');
    } finally {
      setBusy(false);
    }
  }

  async function unassign(itemId: string, qrCodeIds: string[]) {
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      const updated = await admin.unassignShopifyQrCodes(order.id, itemId, qrCodeIds);
      setOrder(updated);
      onChanged();
    } catch (err: any) {
      setError(err?.message ?? 'Unassign failed');
    } finally {
      setBusy(false);
    }
  }

  const adminUrl = order ? shopifyAdminOrderUrl(order.shopifyOrderId) : null;

  return (
    <div className="rounded-xl border admin-border-color admin-surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold admin-text-color">
            {order?.orderNumber ?? 'Order'} {order && <StatusBadge status={order.status} />}
          </h3>
          <p className="text-xs admin-text-subtle mt-1">
            {order?.customerName || '—'} {order?.customerEmail ? `· ${order.customerEmail}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {adminUrl && (
            <a
              href={adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
            >
              Shopify <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button onClick={onClose} className="text-xs admin-text-subtle hover:admin-text-color">
            Close
          </button>
        </div>
      </div>

      {loading || !order ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin admin-text-subtle" />
        </div>
      ) : (
        <>
          <button
            onClick={autoAssign}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg admin-accent-bg px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Auto-assign remaining
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="space-y-3">
            {order.items.map((item) => {
              const short = item.allocatedCount < item.quantity;
              return (
                <div key={item.id} className="rounded-lg border admin-border-color p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium admin-text-color">
                        {typeLabel(types, item.productType)}
                        {item.variantTitle ? ` · ${item.variantTitle}` : ''}
                      </p>
                      <p className="text-[11px] admin-text-subtle">
                        {item.title ?? 'QR tag'} · qty {item.quantity} · allocated {item.allocatedCount}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  {short && (
                    <p className="text-[11px] text-amber-400">
                      Short {item.quantity - item.allocatedCount}. Print a new batch of this type, then auto-assign — new codes are not generated from Shopify.
                    </p>
                  )}
                  <ul className="flex flex-wrap gap-1.5">
                    {(item.codes ?? []).map((code) => (
                      <li
                        key={code.id}
                        className="inline-flex items-center gap-1 rounded-md border admin-border-color px-2 py-0.5 text-[11px] font-mono admin-text-color"
                      >
                        {code.uniqueCode}
                        {code.status === 'unclaimed' && (
                          <button
                            disabled={busy}
                            onClick={() => unassign(item.id, [code.id])}
                            className="admin-text-subtle hover:text-red-400"
                            title="Return to inventory"
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {short && (
                    <button
                      onClick={() => setPickItemId(item.id)}
                      className="text-xs admin-accent-text hover:underline"
                    >
                      Pick specific codes
                    </button>
                  )}
                  {pickItemId === item.id && (
                    <PickCodes
                      orderId={order.id}
                      itemId={item.id}
                      productType={item.productType}
                      remaining={item.quantity - item.allocatedCount}
                      onDone={(updated) => {
                        setOrder(updated);
                        setPickItemId(null);
                        onChanged();
                      }}
                      onCancel={() => setPickItemId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PickCodes({
  orderId,
  itemId,
  productType,
  remaining,
  onDone,
  onCancel,
}: {
  orderId: string;
  itemId: string;
  productType: string;
  remaining: number;
  onDone: (order: ShopifyOrder) => void;
  onCancel: () => void;
}) {
  const [codes, setCodes] = useState<ShopifyInventoryCode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    admin
      .listShopifyInventory(productType, 100)
      .then(setCodes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [productType]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < remaining) next.add(id);
      return next;
    });
  }

  async function assign() {
    setSaving(true);
    setError('');
    try {
      const updated = await admin.assignShopifyQrCodes(orderId, itemId, Array.from(selected));
      onDone(updated);
    } catch (err: any) {
      setError(err?.message ?? 'Assign failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border admin-border-color p-3 space-y-2">
      <p className="text-[11px] admin-text-subtle">
        Select up to {remaining} unused {productType} code{remaining === 1 ? '' : 's'}
      </p>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin admin-text-subtle" />
      ) : codes.length === 0 ? (
        <p className="text-xs text-amber-400">No unused stock of this type. Generate a print batch first.</p>
      ) : (
        <ul className="max-h-40 overflow-y-auto space-y-1">
          {codes.map((code) => (
            <li key={code.id}>
              <label className="flex items-center gap-2 text-xs admin-text-color">
                <input
                  type="checkbox"
                  checked={selected.has(code.id)}
                  onChange={() => toggle(code.id)}
                />
                <span className="font-mono">{code.uniqueCode}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={assign}
          disabled={saving || selected.size === 0}
          className="rounded-lg admin-accent-bg px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Assign {selected.size || ''}
        </button>
        <button onClick={onCancel} className="text-xs admin-text-subtle">
          Cancel
        </button>
      </div>
    </div>
  );
}

function MappingsPanel({ types }: { types: ShopifyProductType[] }) {
  const [rows, setRows] = useState<ShopifyProductMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopifyProductId, setShopifyProductId] = useState('');
  const [productType, setProductType] = useState(types[0]?.key ?? '');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const usedTypes = useMemo(() => new Set(rows.map((r) => r.productType)), [rows]);

  const load = useCallback(() => {
    setLoading(true);
    admin
      .listShopifyMappings()
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!productType && types[0]) setProductType(types[0].key);
  }, [types, productType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopifyProductId.trim() || !productType) return;
    setSaving(true);
    setError('');
    try {
      await admin.createShopifyMapping({
        shopifyProductId: shopifyProductId.trim(),
        productType,
        label: label.trim() || undefined,
      });
      setShopifyProductId('');
      setLabel('');
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save mapping');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this product mapping? Future orders for that Shopify product will be ignored.')) return;
    await admin.deleteShopifyMapping(id);
    load();
  }

  return (
    <div className="space-y-5">
      <p className="text-sm admin-text-subtle max-w-2xl">
        Create one Shopify product per QR type (9 now, more later). Paste the product ID from the Admin URL
        after <code className="font-mono">/products/</code>. Colour variants on that product share the same ID.
      </p>

      <form onSubmit={submit} className="rounded-xl border admin-border-color admin-surface p-4 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium admin-text-subtle mb-1">Shopify product ID</label>
          <input
            value={shopifyProductId}
            onChange={(e) => setShopifyProductId(e.target.value)}
            placeholder="1234567890123"
            className="w-full rounded-lg border admin-border-color admin-surface admin-text-color px-3 py-1.5 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium admin-text-subtle mb-1">QR type</label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="w-full rounded-lg border admin-border-color admin-surface admin-text-color px-3 py-1.5 text-sm"
          >
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}{usedTypes.has(t.key) ? ' (mapped)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium admin-text-subtle mb-1">Label (optional)</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Storefront title"
            className="w-full rounded-lg border admin-border-color admin-surface admin-text-color px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg admin-accent-bg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save mapping'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400 sm:col-span-4">{error}</p>}
      </form>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin admin-text-subtle" />
      ) : (
        <DataTable
          data={rows}
          getKey={(r) => r.id}
          emptyMessage="No mappings yet. Add all 9 Shopify product IDs here."
          columns={[
            {
              key: 'id',
              header: 'Shopify product ID',
              render: (r) => <span className="font-mono text-xs admin-text-color">{r.shopifyProductId}</span>,
            },
            {
              key: 'type',
              header: 'QR type',
              render: (r) => <span className="text-xs admin-text-color">{typeLabel(types, r.productType)}</span>,
            },
            {
              key: 'label',
              header: 'Label',
              render: (r) => <span className="text-xs admin-text-subtle">{r.label ?? '—'}</span>,
            },
            {
              key: 'actions',
              header: '',
              className: 'text-right',
              render: (r) => (
                <button onClick={() => remove(r.id)} className="text-xs text-red-400 hover:underline">
                  Remove
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
