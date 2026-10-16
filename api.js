// Small API client. Include BEFORE script.js:  <script src="api.js"></script>
const API = (() => {
  const KEY = "nightguard_token";
  const token = () => localStorage.getItem(KEY);

  async function call(method, url, body) {
    const res = await fetch("/api" + url, {
      method,
      headers: { "Content-Type": "application/json", ...(token() ? { Authorization: "Bearer " + token() } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token()) localStorage.removeItem(KEY);
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  return {
    isLoggedIn: () => !!token(),
    logout: () => localStorage.removeItem(KEY),
    async login(email, password) { const d = await call("POST", "/auth/login", { email, password }); localStorage.setItem(KEY, d.token); return d.user; },
    async register(name, email, password) { const d = await call("POST", "/auth/register", { name, email, password }); localStorage.setItem(KEY, d.token); return d.user; },
    me: () => call("GET", "/auth/me"),

    saveTrip: (trip) => call("POST", "/trips", trip),
    activeTrip: () => call("GET", "/trips/active"),
    completeTrip: (id) => call("POST", `/trips/${id}/complete`),
    sendLocation: (c) => call("POST", "/trips/location", c),
    lastLocation: () => call("GET", "/trips/location/last"),

    contacts: () => call("GET", "/contacts"),
    addContact: (name, phone) => call("POST", "/contacts", { name, phone }),
    removeContact: (id) => call("DELETE", `/contacts/${id}`),

    sos: (payload) => call("POST", "/sos", payload)
  };
})();
