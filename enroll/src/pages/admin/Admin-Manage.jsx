import { Header } from '../../components/Header';
import { Navigation_Bar } from '../../components/NavigationBar';
import './admin_manage.css';
import { useEffect, useMemo, useState } from 'react';
import { ReusableModalBox } from '../../components/modals/Reusable_Modal';
import { supabase } from '../../supabaseClient';

export const Admin_Manage = () => {
  // Filters and sort
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    search: '',
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState({ by: 'role', order: 'asc' });
  const [showConfirmReactivate, setShowConfirmReactivate] = useState(false);

  // Data and UI state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalRows = users.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const pageRows = users.slice(startIdx, endIdx); // client-side slice
  const [showReactivateNotif, setShowReactivateNotif] = useState(false);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const MAX_PAGES = 5;
  const getPageNumbers = () => {
    if (totalPages <= MAX_PAGES)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const half = Math.floor(MAX_PAGES / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + MAX_PAGES - 1);
    if (end - start + 1 < MAX_PAGES) start = Math.max(1, end - MAX_PAGES + 1);
    const list = [];
    if (start > 1) {
      list.push(1);
      if (start > 2) list.push('…');
    }
    for (let i = start; i <= end; i++) list.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) list.push('…');
      list.push(totalPages);
    }
    return list;
  };
  const gotoPage = (n) => setPage(Math.min(Math.max(1, n), totalPages));
  const firstPage = () => gotoPage(1);
  const prevPage = () => gotoPage(page - 1);
  const nextPage = () => gotoPage(page + 1);
  const lastPage = () => gotoPage(totalPages);

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showDeleteNotif, setShowDeleteNotif] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddUserConfirm, setShowAddUserConfirm] = useState(false);
  const [showAddUserNotif, setShowAddUserNotif] = useState(false);

  // Add user form state
  const [newUser, setNewUser] = useState({
    last_name: '',
    first_name: '',
    middle_name: '',
    suffix: '',
    role: 'Student',
    password: '',
    confirm_password: '',
    email: '',
  });
  useEffect(() => {
    if (showDeleteNotif) {
      const timer = setTimeout(() => {
        setShowDeleteNotif(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showDeleteNotif]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch((filters.search || '').trim()),
      400
    );
    return () => clearTimeout(t);
  }, [filters.search]);

  // Fetch users from Supabase when filters/sort change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let q = supabase
          .from('users')
          .select(
            'user_id, email, first_name, last_name, middle_name, suffix, role, is_active'
          )
          .order(sort.by === 'name' ? 'last_name' : 'role', {
            ascending: sort.order === 'asc',
          })
          .range(0, 199);

        if (sort.by === 'name') {
          q = q.order('first_name', { ascending: sort.order === 'asc' });
        }
        if (filters.role && filters.role !== 'all')
          q = q.eq('role', filters.role);
        if (filters.status === 'active') q = q.eq('is_active', true);
        if (filters.status === 'inactive') q = q.eq('is_active', false);

        const term = debouncedSearch;
        if (term) {
          q = q.or(
            `email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`
          );
        }

        const { data, error } = await q;
        if (cancelled) return;
        if (error) throw error;

        const mapped = (data || []).map((u) => ({
          user_id: u.user_id,
          full_name: `${u.last_name || ''}, ${u.first_name || ''}${
            u.middle_name ? ' ' + u.middle_name : ''
          }${u.suffix ? ' ' + u.suffix : ''}`
            .replace(/^,?\s+/, '')
            .trim(),
          role: u.role || 'applicant',
          department_or_level: '—',
          status: u.is_active ? 'active' : 'inactive',
          email: u.email || '',
        }));

        setUsers(mapped);
        setSelectedIds([]);
        setPage(1); // reset to first page on new fetch
      } catch (e) {
        console.error(e);
        setUsers([]);
        setSelectedIds([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    filters.role,
    filters.status,
    sort.by,
    sort.order,
    refreshKey,
  ]);

  const allSelected = useMemo(
    () => users.length > 0 && selectedIds.length === users.length,
    [users, selectedIds]
  );

  const toggleSelectAll = (checked) => {
    setSelectedIds(checked ? users.map((u) => u.user_id) : []);
  };
  const toggleOne = (id, checked) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    );
  };

  const openRowDelete = (id) => {
    setSelectedIds([id]);
    setShowConfirmDelete(true);
  };

  const handleDelete = async () => {
    try {
      if (selectedIds.length === 0) return;
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .in('user_id', selectedIds);
      if (error) throw error;
      setShowConfirmDelete(false);
      setShowDeleteNotif(true);
      setRefreshKey((k) => k + 1); // triggers reload
    } catch (e) {
      console.error(e);
    }
  };

  // Create user row in public.users
  const handleCreate = async () => {
    if (
      !newUser.email ||
      !newUser.password ||
      newUser.password !== newUser.confirm_password
    )
      return;
    try {
      const payload = {
        email: newUser.email,
        password_hash: newUser.password,
        first_name: newUser.first_name || null,
        last_name: newUser.last_name || null,
        middle_name: newUser.middle_name || null,
        suffix: newUser.suffix || null,
        role: (newUser.role || 'Student').toLowerCase(),
        is_active: true,
      };
      const { error } = await supabase.from('users').insert([payload]).select();
      if (error) throw error;
      setShowAddUserConfirm(false);
      setShowAddUser(false);
      setShowAddUserNotif(true);
      setNewUser({
        last_name: '',
        first_name: '',
        middle_name: '',
        suffix: '',
        role: 'Student',
        password: '',
        confirm_password: '',
        email: '',
      });
      setFilters((f) => ({ ...f })); // refetch
    } catch (e) {
      console.error(e);
    }
  };
  const handleReactivate = async (userId) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('user_id', userId);

      if (error) throw error;
      setShowReactivateNotif(true);

      setRefreshKey((k) => k + 1); // refresh user list
    } catch (e) {
      console.error('Reactivate failed', e);
    }
  };

  return (
    <>
      <Header userRole="admin" />
      <Navigation_Bar userRole="super_admin" />
      <div className="userManagementContainer">
        <h2>Manage Users</h2>

        <div className="userManageSorter">
          <div className="userManageSearch">
            <i className="fa fa-search" aria-hidden="true"></i>
            <input
              className="userManageSearchbar"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </div>

          <div className="sort">
            <label>Select Users</label>
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            >
              <option value="all">All Users</option>
              <option value="applicant">Applicant</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="adviser">Adviser</option>
              <option value="dept_head">Department head</option>
              <option value="principal">Principal</option>
            </select>
          </div>

          <div className="sort">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="userManageTableContainer">
          <div className="userManageBtnContainer">
            <div className="userSelectAll">
              {users.length > 0 && (
                <>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                  <label>Select All</label>

                  {/* Reactivate icon + text */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      selectedIds.length > 0 && setShowConfirmReactivate(true)
                    }
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ')
                        setShowConfirmReactivate(true);
                    }}
                    style={{
                      cursor: 'pointer',
                      marginRight: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    aria-label="Reactivate selected users"
                    title="Reactivate selected users"
                  >
                    <i
                      className="fa fa-repeat"
                      aria-hidden="true"
                      style={{ color: 'green' }}
                    />
                    <span>Reactivate</span>
                  </span>

                  {/* Deactivate icon + text */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      selectedIds.length > 0 && setShowConfirmDelete(true)
                    }
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ')
                        setShowConfirmDelete(true);
                    }}
                    style={{
                      cursor: 'pointer',
                      color: 'gray',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    aria-label="Deactivate selected users"
                    title="Deactivate selected users"
                  >
                    <i className="fa fa-archive" aria-hidden="true" />

                    <span>Deactivate</span>
                  </span>
                </>
              )}
            </div>

            <div className="userManageBtns">
              <button onClick={() => setShowAddUser(true)}>Add New User</button>
              <button
                onClick={() =>
                  setSort((s) => ({
                    ...s,
                    order: s.order === 'asc' ? 'desc' : 'asc',
                  }))
                }
              >
                Sort: {sort.by} {sort.order}
              </button>
              <button
                onClick={() =>
                  setSort((s) => ({
                    by: s.by === 'role' ? 'name' : 'role',
                    order: 'asc',
                  }))
                }
              >
                Toggle Sort By
              </button>
            </div>
          </div>

          <div className="userManageTable">
            <table className="user-manage-table">
              <thead>
                <tr>
                  <th className="column1"></th>
                  <th className="column2" scope="col">
                    #
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  pageRows.map((u, index) => (
                    <tr key={u.user_id}>
                      <td className="column1">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.user_id)}
                          onChange={(e) =>
                            toggleOne(u.user_id, e.target.checked)
                          }
                        />
                      </td>
                      <td className="column2">{index + 1}</td>
                      <td>{u.full_name}</td>
                      <td>{u.role}</td>

                      <td>{u.status}</td>
                      <td className="actionButtons">
                        <button onClick={() => handleReactivate(u.user_id)}>
                          Reactivate
                        </button>

                        <button
                          className="removeBtn"
                          onClick={() => openRowDelete(u.user_id)}
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                {loading && (
                  <tr>
                    <td colSpan={7}>Loading...</td>
                  </tr>
                )}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={7}>No results</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="pagination-bar">
            <div className="pager-left">
              <label className="pager-label">Rows per page</label>
              <select
                className="pager-size"
                value={pageSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  setPageSize(newSize);
                  setPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="pager-info">
              {totalRows === 0
                ? 'Showing 0 of 0'
                : `Showing ${startIdx + 1}–${endIdx} of ${totalRows}`}
            </div>

            <div className="pager-right">
              <button
                className="pager-btn"
                onClick={firstPage}
                disabled={page === 1}
                aria-label="First page"
              >
                <ion-icon name="play-back-outline"></ion-icon>
              </button>

              <button
                className="pager-btn"
                onClick={prevPage}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ion-icon name="chevron-back-outline"></ion-icon>
              </button>

              {getPageNumbers().map((pkey, idx) =>
                pkey === '…' ? (
                  <span key={`ellipsis-${idx}`} className="pager-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={pkey}
                    className={`pager-page ${page === pkey ? 'active' : ''}`}
                    onClick={() => gotoPage(pkey)}
                    aria-current={page === pkey ? 'page' : undefined}
                  >
                    {pkey}
                  </button>
                )
              )}

              <button
                className="pager-btn"
                onClick={nextPage}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ion-icon name="chevron-forward-outline"></ion-icon>
              </button>

              <button
                className="pager-btn"
                onClick={lastPage}
                disabled={page === totalPages}
                aria-label="Last page"
              >
                <ion-icon name="play-forward-outline"></ion-icon>
              </button>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        <ReusableModalBox
          show={showConfirmDelete}
          onClose={() => setShowConfirmDelete(false)}
        >
          <div className="deleteConfirmation">
            <h2>Are you sure that you want to deactivate these users?</h2>
            <div className="confirmDelBtn">
              <button
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid black',
                  color: 'black',
                }}
                onClick={() => setShowConfirmDelete(false)}
              >
                Cancel
              </button>
              <button onClick={handleDelete}>Confirm</button>
            </div>
          </div>
        </ReusableModalBox>
        <ReusableModalBox
          show={showReactivateNotif}
          onClose={() => setShowReactivateNotif(false)}
        >
          <div className="notif">
            <div className="img" style={{ paddingTop: '10px' }}>
              <img
                src="checkImg.png"
                style={{ height: '50px', width: '50px' }}
              />
            </div>
            <div className="notifMessage">
              <span>Account Reactivated </span>
              <span>Successfully!</span>
            </div>
          </div>
        </ReusableModalBox>

        {/* Add User */}
        <ReusableModalBox
          show={showAddUser}
          onClose={() => setShowAddUser(false)}
        >
          <div className="addNewUser">
            <div className="addNewUserBackButton">
              <i
                className="fa fa-chevron-left"
                aria-hidden="true"
                onClick={() => setShowAddUser(false)}
              />
            </div>

            <div className="addNewInputs">
              {/* Name fields */}
              <fieldset className="addNewUserInput">
                <legend>Personal Details</legend>
                <div className="newUserInput">
                  <label htmlFor="lastName">Last Name*</label>
                  <input
                    id="lastName"
                    autoComplete="family-name"
                    required
                    placeholder="Last name"
                    value={newUser.last_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, last_name: e.target.value })
                    }
                  />
                </div>
                <div className="newUserInput">
                  <label htmlFor="firstName">First Name*</label>
                  <input
                    id="firstName"
                    autoComplete="given-name"
                    required
                    placeholder="First name"
                    value={newUser.first_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="newUserInput">
                  <label htmlFor="middleName">Middle Name</label>
                  <input
                    id="middleName"
                    autoComplete="additional-name"
                    placeholder="Middle name"
                    value={newUser.middle_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, middle_name: e.target.value })
                    }
                  />
                </div>
                <div className="newUserInput">
                  <label htmlFor="suffix">Suffix</label>
                  <input
                    id="suffix"
                    autoComplete="honorific-suffix"
                    className="suffix"
                    placeholder="Jr., Sr., III"
                    value={newUser.suffix}
                    onChange={(e) =>
                      setNewUser({ ...newUser, suffix: e.target.value })
                    }
                  />
                </div>
              </fieldset>

              {/* Account fields */}
              <fieldset className="addNewUserInput">
                <legend>Account Details</legend>
                <div className="newUserInput">
                  <label htmlFor="email">Email*</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Official email address"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                  />
                </div>
                <div className="newUserInput">
                  <label htmlFor="role">Select Role*</label>
                  <select
                    id="role"
                    required
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({ ...newUser, role: e.target.value })
                    }
                  >
                    <option value="">Select Role</option>
                    <option value="teacher">Teacher</option>

                    <option value="dept_head">Department Head</option>
                    <option value="principal">Principal</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </fieldset>

              {/* Password fields */}
              <fieldset className="addNewUserInput">
                <legend>Password</legend>
                <div className="newUserInput">
                  <label htmlFor="password">Password*</label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Password"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                  />
                </div>
                <div className="newUserInput">
                  <label htmlFor="confirmPassword">Confirm Password*</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Retype password"
                    value={newUser.confirm_password}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        confirm_password: e.target.value,
                      })
                    }
                  />
                </div>
              </fieldset>
            </div>

            <div className="createAccountButton">
              <button onClick={() => setShowAddUserConfirm(true)}>
                Create Account
              </button>
            </div>
          </div>
        </ReusableModalBox>

        <ReusableModalBox
          show={showAddUserConfirm}
          onClose={() => setShowAddUserConfirm(false)}
        >
          <div className="addConfirmation">
            <h2>Are you sure that all details are correct?</h2>
            <div className="confirmAddBtn">
              <button
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid black',
                  color: 'black',
                }}
                onClick={() => setShowAddUserConfirm(false)}
              >
                Cancel
              </button>
              <button onClick={handleCreate}>Confirm</button>
            </div>
          </div>
        </ReusableModalBox>

        <ReusableModalBox
          show={showAddUserNotif}
          onClose={() => setShowAddUserNotif(false)}
        >
          <div className="notif">
            <div className="img" style={{ paddingTop: '10px' }}>
              <img
                src="checkImg.png"
                style={{ height: '50px', width: '50px' }}
              />
            </div>
            <div className="notifMessage">
              <span>Account Created </span>
              <span>Successfully!</span>
            </div>
          </div>
        </ReusableModalBox>

        <ReusableModalBox
          show={showDeleteNotif}
          onClose={() => setShowDeleteNotif(false)}
        >
          <div className="notif">
            <div className="img" style={{ paddingTop: '10px' }}>
              <img
                src="checkImg.png"
                style={{ height: '50px', width: '50px' }}
              />
            </div>
            <div className="notifMessage">
              <span>Account Deactivated </span>
              <span>Successfully!</span>
            </div>
          </div>
        </ReusableModalBox>
      </div>
    </>
  );
};
