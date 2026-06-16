/**
 * Stream POST to an SSE endpoint with Bearer auth.
 * onEvent receives parsed JSON event objects: {type:"meta"|"delta"|"done"|"error", ...}
 */
export async function streamSSE(url, body, onEvent) {
  const token = localStorage.getItem("inkdrop_token");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Stream failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const data = JSON.parse(line.slice(5).trim());
        onEvent(data);
      } catch (e) {
        // skip malformed
      }
    }
  }
}
