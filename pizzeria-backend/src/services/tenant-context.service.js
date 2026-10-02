function parsePositiveTenantId(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getDefaultTenantId() {
  if (process.env.NODE_ENV === "test") return null;
  return parsePositiveTenantId(process.env.DEFAULT_TENANT_ID);
}

function withDefaultTenantWhere(where = {}) {
  const tenantId = getDefaultTenantId();
  if (!tenantId) return where;
  return {
    ...where,
    tenantId,
  };
}

function withDefaultTenantData(data = {}) {
  const tenantId = getDefaultTenantId();
  if (!tenantId) return data;
  return {
    ...data,
    tenantId,
  };
}

module.exports = {
  getDefaultTenantId,
  withDefaultTenantWhere,
  withDefaultTenantData,
};
