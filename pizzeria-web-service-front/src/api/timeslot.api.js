import api, { authConfig } from "./http";

export const getPublicWeeklySettings = async () => {
  const response = await api.get("/timeslots/public-weekly-settings");
  return response.data;
};

export const getWeeklySettings = async (token) => {
  const response = await api.get("/timeslots/weekly-settings", authConfig(token));
  return response.data;
};

export const upsertWeeklySetting = async (token, dayOfWeek, data) => {
  const response = await api.put(
    `/timeslots/weekly-settings/${dayOfWeek}`,
    data,
    authConfig(token)
  );
  return response.data;
};

export const deleteWeeklyService = async (token, dayOfWeek, data) => {
  const response = await api.delete(`/timeslots/weekly-settings/${dayOfWeek}/service`, {
    ...authConfig(token),
    params: data,
  });
  return response.data;
};

export const getPickupAvailability = async (token, filters = {}) => {
  const response = await api.get("/timeslots/availability", {
    ...authConfig(token),
    params: filters,
  });
  return response.data;
};

export const getConcreteSlots = async (token, filters = {}) => {
  const response = await api.get("/timeslots/concrete-slots", {
    ...authConfig(token),
    params: filters,
  });
  return response.data;
};

export const updateConcreteSlotActiveState = async (token, data) => {
  const response = await api.patch(
    "/timeslots/concrete-slots/active",
    data,
    authConfig(token)
  );
  return response.data;
};

export const getTruckClosures = async (token) => {
  const response = await api.get("/timeslots/closures", authConfig(token));
  return response.data;
};

export const createTruckClosure = async (token, data) => {
  const response = await api.post("/timeslots/closures", data, authConfig(token));
  return response.data;
};

export const deleteTruckClosure = async (token, closureId) => {
  const response = await api.delete(`/timeslots/closures/${closureId}`, authConfig(token));
  return response.data;
};
