// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const authApi = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

const ordersApi = vi.hoisted(() => ({
  fetchOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

const ticketsApi = vi.hoisted(() => ({
  fetchTickets: vi.fn(),
  reprintTicket: vi.fn(),
}));

const customersApi = vi.hoisted(() => ({
  fetchCustomers: vi.fn(),
}));

const notificationsApi = vi.hoisted(() => ({
  getPushPublicKey: vi.fn(),
  removePushSubscription: vi.fn(),
  savePushSubscription: vi.fn(),
}));

vi.mock("./hooks/useSessionHeartbeat", () => ({
  useSessionHeartbeat: vi.fn(),
}));

vi.mock("./hooks/useRealtimeStream", () => ({
  useRealtimeStream: vi.fn(),
}));

vi.mock("./lib/api/auth", () => ({
  fetchMe: authApi.fetchMe,
  login: authApi.login,
  logout: authApi.logout,
}));

vi.mock("./lib/api/orders", () => ({
  fetchOrders: ordersApi.fetchOrders,
  updateOrderStatus: ordersApi.updateOrderStatus,
}));

vi.mock("./lib/api/tickets", () => ({
  fetchTickets: ticketsApi.fetchTickets,
  reprintTicket: ticketsApi.reprintTicket,
}));

vi.mock("./lib/api/customers", () => ({
  fetchCustomers: customersApi.fetchCustomers,
}));

vi.mock("./lib/api/notifications", () => ({
  getPushPublicKey: notificationsApi.getPushPublicKey,
  removePushSubscription: notificationsApi.removePushSubscription,
  savePushSubscription: notificationsApi.savePushSubscription,
}));

import App from "./App";

describe("App integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    authApi.login.mockResolvedValue({ ok: true });
    authApi.logout.mockResolvedValue({ ok: true });
    ordersApi.fetchOrders.mockResolvedValue([]);
    ordersApi.updateOrderStatus.mockResolvedValue({ ok: true });
    ticketsApi.fetchTickets.mockResolvedValue([]);
    ticketsApi.reprintTicket.mockResolvedValue({ ok: true });
    customersApi.fetchCustomers.mockResolvedValue([]);
    notificationsApi.getPushPublicKey.mockResolvedValue({ enabled: false, publicKey: "" });
    notificationsApi.removePushSubscription.mockResolvedValue({ ok: true });
    notificationsApi.savePushSubscription.mockResolvedValue({ ok: true });
  });

  it("shows login screen when there is no active session", async () => {
    authApi.fetchMe.mockRejectedValueOnce(new Error("No active session"));

    render(<App />);

    expect(await screen.findByRole("button", { name: "Entrer dans l'admin" })).toBeTruthy();
    expect(screen.getByLabelText("Email admin")).toBeTruthy();
    expect(screen.getByLabelText("Mot de passe")).toBeTruthy();
  });

  it("shows unauthorized message when connected user is not admin", async () => {
    authApi.fetchMe.mockResolvedValueOnce({ role: "MANAGER", email: "manager@pizza.test" });

    render(<App />);

    expect(
      await screen.findByText("Ce compte est connecte mais n'a pas le role admin.")
    ).toBeTruthy();
  });

  it("loads dashboard when bootstrap session is admin", async () => {
    authApi.fetchMe.mockResolvedValueOnce({ role: "ADMIN", email: "admin@pizza.test" });

    render(<App />);

    expect(await screen.findByText("Applications admin")).toBeTruthy();
    await waitFor(() => {
      expect(ordersApi.fetchOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "IN_PROGRESS",
        })
      );
    });
  });

  it("logs in from form and transitions to admin dashboard", async () => {
    authApi.fetchMe
      .mockRejectedValueOnce(new Error("No active session"))
      .mockResolvedValueOnce({ role: "ADMIN", email: "boss@pizza.test" });

    render(<App />);

    const loginButton = await screen.findByRole("button", { name: "Entrer dans l'admin" });
    fireEvent.change(screen.getByLabelText("Email admin"), {
      target: { value: "boss@pizza.test" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "super-secret" },
    });
    fireEvent.click(loginButton);

    expect(await screen.findByText("Applications admin")).toBeTruthy();
    expect(authApi.login).toHaveBeenCalledWith("boss@pizza.test", "super-secret");
  });

  it("scrolls to top when opening an app from the launcher", async () => {
    authApi.fetchMe.mockResolvedValueOnce({ role: "ADMIN", email: "admin@pizza.test" });

    render(<App />);
    const clickCollectButton = await screen.findByRole("button", { name: /click&collect/i });

    fireEvent.click(clickCollectButton);

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalled();
    });
  });
});
