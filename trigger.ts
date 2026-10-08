import { after } from "next/server";
import { deliverPendingNotifications } from "./deliver";

/** Expédie les notifications en attente une fois la réponse envoyée. */
export function scheduleDelivery() {
  try {
    after(async () => {
      try {
        await deliverPendingNotifications();
      } catch (e) {
        console.error("Expédition des notifications :", e);
      }
    });
  } catch {
    // Hors contexte de requête : la tâche planifiée prendra le relais.
  }
}
