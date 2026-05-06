import { useState, useEffect } from 'react';
import { api } from '../api';
import { Search, Plus, X, Eye, Pencil, Trash2, CheckCircle } from 'lucide-react';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [newItem, setNewItem] = useState({ item_code: '', name: '', category: 'General', unit_price: '', reorder_level: '10' });
  const [msg, setMsg] = useState(null);

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (catFilter) params.set('category', catFilter);
    api.getItems(params.toString()).then(setItems).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, catFilter]);
  useEffect(() => { api.getCategories().then(setCategories); }, []);

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000); };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.createItem({ ...newItem, unit_price: +newItem.unit_price, reorder_level: +newItem.reorder_level });
      setShowAdd(false);
      setNewItem({ item_code: '', name: '', category: 'General', unit_price: '', reorder_level: '10' });
      showMsg('success', 'Item created successfully');
      load();
    } catch (err) { showMsg('error', err.message); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await api.updateItem(editItem.item_code, {
        name: editItem.name,
        category: editItem.category,
        unit_price: parseFloat(editItem.unit_price),
        reorder_level: parseInt(editItem.reorder_level),
        status: editItem.status,
      });
      setEditItem(null);
      showMsg('success', 'Item updated successfully');
      load();
    } catch (err) { showMsg('error', err.message); }
  };

  const handleDelete = async (item) => {
    const isDiscontinued = item.status === 'Discontinued';
    const confirmMsg = isDiscontinued
      ? `⚠️ Permanently delete "${item.name}" (${item.item_code})?\n\nThis will remove the item AND all its transaction history. This cannot be undone.`
      : `Discontinue "${item.name}" (${item.item_code})?\n\nThe item will be marked as inactive and hidden from dashboard stats. You can permanently delete it afterwards.`;
    if (!confirm(confirmMsg)) return;
    try {
      await api.deleteItem(item.item_code);
      showMsg('success', isDiscontinued ? `Item ${item.item_code} permanently deleted` : `Item ${item.item_code} discontinued`);
      load();
    } catch (err) { showMsg('error', err.message); }
  };

  const viewDetail = async (code) => {
    const data = await api.getItem(code);
    setDetail(data);
  };

  const getStatusBadge = (item) => {
    if (item.status === 'Discontinued') return <span className="badge badge-neutral">Discontinued</span>;
    if (item.stock_qty === 0) return <span className="badge badge-danger">Out of Stock</span>;
    if (item.stock_qty <= item.reorder_level) return <span className="badge badge-warning">Low Stock</span>;
    return <span className="badge badge-success">In Stock</span>;
  };

  const fmt = (v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0 });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h2>Inventory Master</h2><p>Complete stock register with search & filter</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> New Item</button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.type === 'success' ? <CheckCircle size={16}/> : null}{msg.text}</div>}

      <div className="search-filter-bar">
        <div className="search-box">
          <Search className="search-icon" size={16} />
          <input className="form-input" placeholder="Search by Item Code or Name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <button className={`filter-btn ${catFilter === '' ? 'active' : ''}`} onClick={() => setCatFilter('')}>All</button>
          {categories.map(c => (
            <button key={c} className={`filter-btn ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th>Item Code</th><th>Name</th><th>Category</th><th>Unit Price</th><th>Stock Qty</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7"><div className="empty-state"><p>No items found</p></div></td></tr>
              ) : items.map(item => (
                <tr key={item.item_code}>
                  <td><span className="item-code">{item.item_code}</span></td>
                  <td>{item.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{item.category}</td>
                  <td className="amount">{fmt(item.unit_price)}</td>
                  <td className="amount" style={{ color: item.stock_qty <= item.reorder_level ? 'var(--warning)' : 'var(--text-primary)' }}>{item.stock_qty}</td>
                  <td>{getStatusBadge(item)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => viewDetail(item.item_code)} title="View history"><Eye size={14} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditItem({ ...item })} title="Edit item"><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item)} title={item.status === 'Discontinued' ? 'Permanently delete item' : 'Discontinue item'} style={{ color: 'var(--danger)', background: item.status === 'Discontinued' ? 'rgba(255,92,114,0.12)' : undefined }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Item Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Item</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Item Code (SKU)</label>
                  <input className="form-input" required value={newItem.item_code} onChange={e => setNewItem({ ...newItem, item_code: e.target.value.toUpperCase() })} placeholder="e.g. PROD-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Item Name</label>
                  <input className="form-input" required value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Steel Rod" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-input" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price (₹)</label>
                  <input className="form-input" type="number" step="0.01" value={newItem.unit_price} onChange={e => setNewItem({ ...newItem, unit_price: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reorder Level</label>
                <input className="form-input" type="number" value={newItem.reorder_level} onChange={e => setNewItem({ ...newItem, reorder_level: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Item — <span className="item-code">{editItem.item_code}</span></h3>
              <button className="modal-close" onClick={() => setEditItem(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label className="form-label">Item Name</label>
                <input className="form-input" required value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-input" value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price (₹)</label>
                  <input className="form-input" type="number" step="0.01" value={editItem.unit_price} onChange={e => setEditItem({ ...editItem, unit_price: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Reorder Level</label>
                  <input className="form-input" type="number" value={editItem.reorder_level} onChange={e => setEditItem({ ...editItem, reorder_level: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input form-select" value={editItem.status} onChange={e => setEditItem({ ...editItem, status: e.target.value })}>
                    <option value="Active">Active</option>
                    <option value="Discontinued">Discontinued</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{detail.name}</h3>
                <div style={{ marginTop: 4 }}><span className="item-code">{detail.item_code}</span></div>
              </div>
              <button className="modal-close" onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            <div className="form-row" style={{ marginBottom: 20 }}>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>STOCK</span><div className="kpi-value" style={{ fontSize: 22 }}>{detail.stock_qty}</div></div>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>UNIT PRICE</span><div className="kpi-value" style={{ fontSize: 22 }}>{fmt(detail.unit_price)}</div></div>
            </div>
            <div className="card-title" style={{ marginBottom: 12 }}>Transaction History</div>
            {detail.transactions && detail.transactions.length > 0 ? (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead><tr><th>Type</th><th>Qty</th><th>Amount</th><th>Date</th></tr></thead>
                  <tbody>
                    {detail.transactions.map(t => (
                      <tr key={t.id}>
                        <td><span className={`badge ${t.transaction_type === 'Purchase' ? 'badge-success' : t.transaction_type === 'Sale' ? 'badge-info' : t.transaction_type === 'Production' ? 'badge-purple' : 'badge-danger'}`}>{t.transaction_type}</span></td>
                        <td className={`amount ${['Purchase', 'Production'].includes(t.transaction_type) ? 'amount-positive' : 'amount-negative'}`}>
                          {['Purchase', 'Production'].includes(t.transaction_type) ? '+' : '-'}{t.quantity}
                        </td>
                        <td className="amount">{fmt(t.total_amount)}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{new Date(t.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><p>No transactions yet</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}
