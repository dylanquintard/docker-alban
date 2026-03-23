export function getOrderNote(order = {}) {
  const candidates = [
    order.note,
    order.notes,
    order.customerNote,
    order.clientNote,
    order.orderNote,
    order.specialInstructions,
    order.pickupNote,
    order.pickupNotes,
  ];

  const note = candidates.find((value) => typeof value === "string" && value.trim() !== "");
  return note ? note.trim() : "";
}
