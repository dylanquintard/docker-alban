import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteUser, getAllUsers, updateUserRole } from "../api/admin.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { ActionIconButton, DeleteIcon } from "../components/ui/AdminActions";
import { splitPersonName } from "../utils/personName";

const USERS_PER_PAGE = 10;

export default function Users() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return users;

    return users.filter((entry) => {
      const parsedName = splitPersonName(entry);
      const fields = [entry.name, parsedName.firstName, parsedName.lastName, entry.email, entry.phone]
        .map((value) => String(value || "").toLowerCase());

      return fields.some((value) => value.includes(normalizedQuery));
    });
  }, [users, searchQuery]);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !token) {
      navigate("/login");
      return;
    }

    if (user.role !== "ADMIN") {
      setMessage(tr("Accès refusé : administrateur uniquement", "Access denied: admin only"));
      return;
    }

    async function fetchUsers() {
      try {
        const data = await getAllUsers(token);
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        setMessage(err.response?.data?.error || tr("Erreur lors du chargement des utilisateurs", "Error while loading users"));
      }
    }

    fetchUsers();
  }, [authLoading, token, user, navigate, tr]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const updatedUser = await updateUserRole(token, userId, newRole);
      setUsers((prev) => prev.map((entry) => (entry.id === userId ? updatedUser : entry)));
      setMessage(tr("Rôle mis à jour avec succès.", "Role updated successfully."));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la mise à jour du rôle", "Error while updating role"));
    }
  };

  const handleDelete = async (userId) => {
    try {
      await deleteUser(token, userId);
      setUsers((prev) => prev.filter((entry) => entry.id !== userId));
      setMessage(tr("Utilisateur supprime.", "User deleted."));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la suppression", "Error while deleting"));
    }
  };

  const totalUsers = users.length;
  const visibleUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(visibleUsers / USERS_PER_PAGE));
  const hasPagination = visibleUsers > USERS_PER_PAGE;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(
    pageStartIndex,
    pageStartIndex + USERS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const renderPaginationControls = () => (
    <div className="flex justify-end">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
        <button
          type="button"
          onClick={goToPreviousPage}
          disabled={safeCurrentPage <= 1}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {tr("Precedent", "Previous")}
        </button>
        <p className="min-w-[90px] text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-300">
          {tr("Page", "Page")} {safeCurrentPage} / {totalPages}
        </p>
        <button
          type="button"
          onClick={goToNextPage}
          disabled={safeCurrentPage >= totalPages}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {tr("Suivant", "Next")}
        </button>
      </div>
    </div>
  );

  if (authLoading) return <p>{tr("Chargement du contexte utilisateur...", "Loading user context...")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">
            {tr("Infos clients", "Customer details")}
          </p>
          <h2 className="text-2xl font-bold text-white">{tr("Clients", "Customers")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-300">
            {tr(
              "Recherche rapide par nom, prénom, numéro ou email pour retrouver un client sans perdre de temps.",
              "Quick search by last name, first name, phone number or email to find a customer fast."
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
            {tr("Clients visibles", "Visible customers")}
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{visibleUsers}</p>
          <p className="text-xs text-stone-400">
            {tr("Sur", "Out of")} {totalUsers}
          </p>
        </div>
      </div>

      {message && (
        <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-stone-200">{message}</p>
      )}

      <div className="grid gap-2 sm:max-w-xl">
        <label htmlFor="users-search" className="text-xs font-semibold uppercase tracking-wide text-stone-300">
          {tr("Recherche client", "Customer search")}
        </label>
        <input
          id="users-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={tr(
            "Rechercher par nom, prénom, numéro ou email",
            "Search by last name, first name, phone number or email"
          )}
        />
      </div>

      <div className="grid gap-2.5">
        {hasPagination ? renderPaginationControls() : null}

        {filteredUsers.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-stone-300">
            {tr("Aucun utilisateur trouve.", "No users found.")}
          </div>
        ) : (
          paginatedUsers.map((entry) => {
            const parsedName = splitPersonName(entry);
            const displayName =
              [parsedName.lastName, parsedName.firstName].filter(Boolean).join(" ") ||
              entry.name ||
              "-";

            return (
              <article
                key={entry.id}
                className="rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-white/20 hover:bg-black/30"
              >
                <div className="space-y-2.5">
                  <h3 className="text-base font-semibold text-white">{displayName}</h3>

                  <div className="grid gap-2 md:grid-cols-[minmax(120px,0.72fr)_minmax(170px,0.95fr)_minmax(130px,0.62fr)_auto] md:items-start">
                    <div className="max-w-[220px] rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                        {tr("Numéro", "Phone")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-100">{entry.phone || "-"}</p>
                    </div>

                    <div className="max-w-[280px] rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                        {tr("Email", "Email")}
                      </p>
                      <p className="mt-0.5 break-all text-[11px] text-stone-100">{entry.email || "-"}</p>
                    </div>

                    <div className="max-w-[220px] rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                          {tr("Role", "Role")}
                        </p>
                        <p className="text-[11px] font-semibold text-white">{entry.role}</p>
                        {entry.role === "CLIENT" ? (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(entry.id, "ADMIN")}
                            className="text-[10px] font-medium text-stone-300 transition hover:text-white"
                          >
                            {tr("Promouvoir admin", "Promote to admin")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(entry.id, "CLIENT")}
                            className="text-[10px] font-medium text-stone-300 transition hover:text-white"
                          >
                            {tr("Retrograder client", "Demote to client")}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start justify-end md:items-center">
                      <ActionIconButton
                        onClick={() => handleDelete(entry.id)}
                        label={tr("Supprimer utilisateur", "Delete user")}
                        variant="danger"
                      >
                        <DeleteIcon />
                      </ActionIconButton>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}

        {hasPagination ? renderPaginationControls() : null}
      </div>
    </div>
  );
}
