"use server";

import { recordLoginEvent } from "./login-events";

/** İstemci taraflı giriş (şifre ile) sonrası çağrılır. */
export async function recordLoginAction(provider = "password"): Promise<void> {
  await recordLoginEvent(provider);
}
